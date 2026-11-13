'use client';
// 🗺️ «مولد الخطط الفصلية» — الواجهة الرئيسية: 🔎 موعد الدرس • 📚 الخطط الدراسية المقترحة • ⚙️ الإعدادات (صفوفي، خططي حسب الصف، الربط بجدولي، الحفظ)
// الجدول المدرسي يُقرأ من «منبّه الحصص» مباشرة (قراءة فقط) ولا يُنسخ؛ وكل ما يخص الخطط محفوظ لكل حساب على حدة.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../../class-alarm/ui/parts';
import { readAlarmStoreFor, ALARM_CHANNEL } from '../../class-alarm/ui/storage';
import { normalizeStore } from '../../class-alarm/core/model.js';
import { zonedParts } from '../../class-alarm/core/time.js';
import { normalizeWorkspace, emptyWorkspace, gradeNum } from '../core/model.js';
import { conflicts, classesFromProfile } from '../core/track.js';
import { loadWorkspace, saveWorkspace, wipeWorkspace, PLANS_CHANNEL } from './storage';
import LessonTimeView from './LessonTimeView';
import SuggestedView from './SuggestedView';
import SettingsView, { SETTINGS_TABS, GradesPicker } from './SettingsView';
import { RecordModal } from './lpParts';
import '../../class-alarm/ui/class-alarm.css';
import './lesson-plans.css';

const TABS = [
  { id: 'time', label: '🔎 موعد الدرس' },
  { id: 'suggested', label: '📚 الخطط الدراسية المقترحة' },
];
// روابط قديمة (?tab=plans …) تبقى صالحة وتفتح القسم الجديد المقابل
const LEGACY = { official: ['time'], today: ['time'], progress: ['time'], plans: ['settings', 'plans'], link: ['settings', 'link'] };
const TAB_ID = Math.random().toString(36).slice(2);

function createApi(base, getToken) {
  const call = async (action, method = 'GET', body, signal) => {
    const token = getToken ? await getToken() : null;
    if (!token) throw new Error('سجّل الدخول أولًا (أو حدّث الصفحة) لاستخدام هذه الخدمة.');
    let res;
    try { res = await fetch(`${base}/${action}`, { method, signal, cache: 'no-store', headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined }); } catch (e) { if (e && e.name === 'AbortError') throw e; throw new Error('تعذر الاتصال بالخادم. تأكد من الإنترنت.'); }
    let data = null; try { data = await res.json(); } catch { /* */ }
    if (!res.ok || !data || data.ok === false) { const er = new Error((data && data.error) || (res.status === 413 ? 'الملف كبير جدًا.' : `خطأ في الخادم (${res.status}).`)); er.code = data && data.code; er.updatedAt = data && data.updatedAt; throw er; }
    return data;
  };
  const q = (id) => `?id=${encodeURIComponent(id)}`;
  return {
    status: () => call('status'), extract: (p, s) => call('extract', 'POST', p, s), pull: () => call('sync'), push: (ws, baseUpdatedAt) => call('sync', 'POST', { ws, baseUpdatedAt }), remove: () => call('sync', 'DELETE'),
    prefsGet: () => call('prefs'), prefsSet: (grades) => call('prefs', 'POST', { grades }),
    suggestedList: () => call('suggested'), suggestedFile: (id) => call(`suggested-file${q(id)}`),
    suggestedCreate: (b) => call('suggested', 'POST', b), suggestedPatch: (id, b) => call(`suggested${q(id)}`, 'PATCH', b), suggestedRemove: (id) => call(`suggested${q(id)}`, 'DELETE'),
  };
}

export default function LessonPlansApp({ plansData, getToken, getUserId, apiBase = '/api/lesson-plans', alarmHref = '/dashboard/tools/class-alarm', backHref = '/dashboard/tools' }) {
  const [uid, setUid] = useState(undefined);
  const [ws, setWs] = useState(null);
  const [alarm, setAlarm] = useState(null);       // نسخة قراءة فقط من بيانات المنبّه
  const [tab, setTab] = useState('time');          // time | suggested | settings
  const [section, setSection] = useState('grades');  // أقسام ⚙️
  const [prefsState, setPrefsState] = useState('');
  const [onboard, setOnboard] = useState(false);     // بطاقة البداية: تبقى حتى يضغط المعلم «متابعة» ليختار أكثر من صف
  const [now, setNow] = useState(() => Date.now());
  const [toast, setToast] = useState(null);
  const [svc, setSvc] = useState({ ai: false, sync: false, admin: false, suggested: false, prefs: false });
  const [sync, setSync] = useState({ on: false, state: 'idle', at: 0, error: '' });
  const [record, setRecord] = useState(null);
  const api = useMemo(() => (getToken ? createApi(apiBase, getToken) : null), [getToken, apiBase]);
  const notify = useCallback((text, kind = 'ok') => setToast({ text, kind, k: Date.now() }), []);
  useEffect(() => { if (!toast) return undefined; const t = setTimeout(() => setToast(null), 5200); return () => clearTimeout(t); }, [toast]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);

  // التحميل: الحساب ← الخطط + جدول المنبّه
  const skip = useRef(true);
  const reloadAlarm = useCallback(async (id) => { const raw = await readAlarmStoreFor(id); setAlarm(raw ? normalizeStore(raw) : null); }, []);
  useEffect(() => {
    let alive = true;
    (async () => {
      const id = getUserId ? await getUserId() : null;
      const [raw] = await Promise.all([loadWorkspace(id), reloadAlarm(id)]);
      if (!alive) return;
      skip.current = true;
      setUid(id);
      const w0 = normalizeWorkspace(raw || emptyWorkspace());
      setWs(w0);
      setOnboard(!w0.settings.grades.length && !w0.plans.length);
      try { setSync((s) => ({ ...s, on: localStorage.getItem(`mt-plans:sync:${id || 'guest'}`) === '1' })); } catch { /* */ }
      const q = new URLSearchParams(window.location.search);
      const t = q.get('tab'), sec = q.get('section');
      const go = LEGACY[t] || (t === 'settings' ? ['settings', sec] : TABS.some((x) => x.id === t) ? [t] : null);
      if (go) { setTab(go[0]); if (go[1] && SETTINGS_TABS.some((x) => x.id === go[1])) setSection(go[1]); }
      if (q.get('record')) setRecord(q.get('record'));
    })();
    return () => { alive = false; };
  }, [getUserId, reloadAlarm]);

  // أي تعديل في المنبّه (جدول، إلغاء حصة، تغيير وقت) يصل فورًا — لا نسخة موازية للجدول
  useEffect(() => {
    if (uid === undefined) return undefined;
    const chs = [];
    if (typeof BroadcastChannel !== 'undefined') {
      const a = new BroadcastChannel(ALARM_CHANNEL); a.onmessage = (e) => { if (e.data && e.data.type === 'store') reloadAlarm(uid); }; chs.push(a);
      const p = new BroadcastChannel(PLANS_CHANNEL); p.onmessage = async (e) => { if (e.data && e.data.from !== TAB_ID) { const raw = await loadWorkspace(uid); skip.current = true; setWs(normalizeWorkspace(raw || emptyWorkspace())); } }; chs.push(p);
    }
    const vis = () => { if (document.visibilityState === 'visible') reloadAlarm(uid); };
    document.addEventListener('visibilitychange', vis);
    return () => { chs.forEach((c) => c.close()); document.removeEventListener('visibilitychange', vis); };
  }, [uid, reloadAlarm]);

  // الحفظ المحلي + إبلاغ المنبّه
  const bc = useRef(null);
  useEffect(() => { if (typeof BroadcastChannel !== 'undefined') bc.current = new BroadcastChannel(PLANS_CHANNEL); return () => bc.current && bc.current.close(); }, []);
  useEffect(() => {
    if (!ws || uid === undefined) return undefined;
    if (skip.current) { skip.current = false; return undefined; }
    const t = setTimeout(async () => { await saveWorkspace(uid, ws); if (bc.current) bc.current.postMessage({ from: TAB_ID, type: 'ws' }); }, 250);
    return () => clearTimeout(t);
  }, [ws, uid]);

  const update = useCallback((fn) => setWs((w) => normalizeWorkspace({ ...fn(w), updatedAt: Date.now() })), []);

  // الخدمات الاختيارية: القراءة الذكية + المزامنة
  useEffect(() => { if (!api) return; api.status().then((r) => setSvc({ ai: !!r.ai, sync: !!r.sync, admin: !!r.admin, suggested: !!r.suggested, prefs: !!r.prefs })).catch(() => setSvc({ ai: false, sync: false, admin: false, suggested: false, prefs: false })); }, [api]);

  // «صفوفي» تُحفظ في الحساب على الخادم (إن توفر) لتبقى ثابتة بين الأجهزة، وعلى هذا الجهاز دائمًا
  const prefsLoaded = useRef(false);
  useEffect(() => {
    if (!api || !svc.prefs || !ws || prefsLoaded.current) return;
    prefsLoaded.current = true;
    api.prefsGet().then((r) => {
      if (!r || !Array.isArray(r.grades)) { if (ws.settings.grades.length) api.prefsSet(ws.settings.grades).catch(() => {}); return; }
      if (r.updatedAt > (ws.settings.gradesAt || 0) || !ws.settings.grades.length) {
        setWs((w) => normalizeWorkspace({ ...w, settings: { ...w.settings, grades: r.grades, gradesAt: r.updatedAt }, updatedAt: Date.now() }));
        if (r.grades.length) setOnboard(false);
      }
      setPrefsState('saved');
    }).catch(() => {});
  }, [api, svc.prefs, ws]);
  const prefsTimer = useRef(null);
  const setGrades = useCallback((grades) => {
    const at = Date.now();
    update((w) => ({ ...w, settings: { ...w.settings, grades, gradesAt: at } }));
    if (!api || !svc.prefs) { setPrefsState('local'); return; }
    setPrefsState('saving');
    clearTimeout(prefsTimer.current);
    prefsTimer.current = setTimeout(() => { api.prefsSet(grades).then(() => setPrefsState('saved')).catch(() => setPrefsState('error')); }, 600);
  }, [api, svc.prefs, update]);
  const lastRemote = useRef(0);
  const push = useCallback(async (force = false) => {
    if (!api || !ws) return;
    setSync((s) => ({ ...s, state: 'saving' }));
    try { const r = await api.push(ws, force ? undefined : lastRemote.current || undefined); lastRemote.current = r.updatedAt; setSync((s) => ({ ...s, state: 'ok', at: r.updatedAt, error: '' })); }
    catch (e) { setSync((s) => ({ ...s, state: 'error', error: e.code === 'conflict' ? 'توجد نسخة أحدث في حسابك من جهاز آخر؛ استرجعها أو احفظ نسختك فوقها.' : e.message, conflict: e.code === 'conflict' })); }
  }, [api, ws]);
  useEffect(() => { if (!sync.on || !svc.sync) return undefined; const t = setTimeout(() => push(false), 4000); return () => clearTimeout(t); }, [ws, sync.on, svc.sync]); // eslint-disable-line react-hooks/exhaustive-deps
  const toggleSync = async (on) => {
    try { localStorage.setItem(`mt-plans:sync:${uid || 'guest'}`, on ? '1' : '0'); } catch { /* */ }
    setSync((s) => ({ ...s, on }));
    if (on && api) { try { const r = await api.pull(); lastRemote.current = r.updatedAt || 0; if (r.ws && r.updatedAt > (ws.updatedAt || 0) && window.confirm('توجد نسخة من خططك في حسابك أحدث من هذا الجهاز. استرجاعها الآن؟')) { setWs(normalizeWorkspace(r.ws)); notify('تم الاسترجاع من حسابك.'); } } catch (e) { notify(e.message, 'err'); } }
  };
  const pull = async () => { try { const r = await api.pull(); if (!r.ws) { notify('لا توجد نسخة في حسابك بعد.', 'err'); return; } if (window.confirm(`استبدال الخطط على هذا الجهاز بنسخة حسابك (${new Date(r.updatedAt).toLocaleString('ar-OM')})؟`)) { lastRemote.current = r.updatedAt; setWs(normalizeWorkspace(r.ws)); notify('تم الاسترجاع من حسابك.'); } } catch (e) { notify(e.message, 'err'); } };

  if (uid === undefined || !ws) return <div className="ca-root"><div className="ca-loading"><span className="ca-spin" />جارٍ تجهيز الخطط الفصلية...</div></div>;

  const profile = alarm ? alarm.profiles.find((p) => p.id === alarm.activeId) || alarm.profiles[0] : null;
  const tz = profile ? profile.tz : 'Asia/Muscat';
  const today = zonedParts(now, tz).dateKey;
  const hasSchedule = !!(profile && Object.values(profile.lessons).some((r) => Object.keys(r).length));
  const grades = ws.settings.grades;
  const cf = hasSchedule ? conflicts(ws, profile, today) : [];
  const ai = api && svc.ai ? (payload, signal) => api.extract(payload, signal) : null;
  const openSettings = (sec) => { setTab('settings'); if (sec) setSection(sec); };
  const common = { ws, update, profile, today, now, notify, alarmHref, onRecord: setRecord, hasSchedule, conflicts: cf };
  // تنبيه الربط المختصر: يظهر فقط عندما يكون الربط قائمًا فعلًا (جدول + خطة لصف موجود في الجدول + الربط التلقائي مفعّل)
  const linked = hasSchedule && ws.settings.autoLink !== false && classesFromProfile(profile).some((c) => { const n = gradeNum(c.grade); return (!grades.length || grades.includes(n)) && ws.plans.some((p) => gradeNum(p.grade) === n); });

  return (
    <div className="ca-root lp-root" dir="rtl">
      <div className="ca-shell">
        <div className="ca-topbar">
          <a href={backHref} className="ca-back"><Icon n="back" size={16} />أدوات المعلم</a>
          {!hasSchedule && <a href={alarmHref} className="lp-link-chip is-off"><Icon n="bell" size={15} />لا يوجد جدول في «منبّه الحصص الذكي» بعد</a>}
        </div>
        <header className="ca-head lp-head">
          <h1><span className="ca-logo lp-logo" aria-hidden="true"><Icon n="calendar" size={26} /></span>مولد الخطط الفصلية</h1>
          <button type="button" className={`lp-gear${tab === 'settings' ? ' is-on' : ''}`} onClick={() => (tab === 'settings' ? setTab('time') : openSettings())} aria-label="الإعدادات" aria-pressed={tab === 'settings'} title="الإعدادات: صفوفي، خططي حسب الصف، الربط بجدولي"><span aria-hidden="true">⚙️</span><span className="lp-gear-t">الإعدادات</span></button>
        </header>
        {linked && <p className="lp-linked" role="status">✅ تم ربط خطتك الدراسية تلقائيًا بجدول حصصك في «منبّه الحصص الذكي».</p>}
        {cf.length > 0 && (
          <div className="ca-notice is-warn lp-mb"><Icon n="warn" /><span>{cf.length === 1 ? 'حصة مرتبطة يدويًا بدرس' : `${cf.length} حصص مرتبطة يدويًا بدروس`} لم تعد متاحة في جدولك بعد تعديل المنبّه (مثل: {cf[0].reason}). لم نغيّر شيئًا تلقائيًا.</span><button type="button" className="ca-btn is-sm" onClick={() => openSettings('link')}>مراجعة</button></div>
        )}
        {onboard && tab !== 'settings' && (
          <section className="ca-card lp-onboard lp-mb">
            <div className="ca-card-head"><div><h3>ابدأ باختيار صفوفك</h3><p className="ca-muted">اختر صفًا أو أكثر؛ تظهر في القوائم صفوفك فقط، ويمكنك تغييرها لاحقًا من ⚙️.</p></div></div>
            <GradesPicker ws={ws} onChange={setGrades} compact />
            <div className="ca-row ca-wrap ca-mt">
              <button type="button" className="ca-btn" disabled={!grades.length} onClick={() => { setOnboard(false); openSettings('plans'); }}><Icon n="upload" />متابعة: رفع خطة لكل صف</button>
              <button type="button" className="ca-btn is-ghost" onClick={() => setOnboard(false)}>لاحقًا</button>
            </div>
          </section>
        )}
        {tab !== 'settings' ? (
          <nav className="ca-tabs" role="tablist" aria-label="أقسام الخطط">
            {TABS.map((t) => <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'is-on' : ''} onClick={() => setTab(t.id)}><span>{t.label}</span></button>)}
          </nav>
        ) : (
          <div className="lp-settings-head"><button type="button" className="ca-btn is-ghost is-sm" onClick={() => setTab('time')}><Icon n="back" size={15} />رجوع</button><h2>⚙️ الإعدادات</h2></div>
        )}
        <main className="ca-main" role="tabpanel">
          {tab === 'time' && <LessonTimeView plansData={plansData} uid={uid} ws={ws} grades={grades} onOpenSettings={() => openSettings('grades')} />}
          {tab === 'suggested' && <SuggestedView api={api} svc={svc} grades={grades} ws={ws} update={update} notify={notify} onOpenSettings={() => openSettings('grades')} />}
          {tab === 'settings' && <SettingsView section={section} onSection={setSection} ws={ws} update={update} notify={notify} setGrades={setGrades} prefsState={prefsState} common={common} plansData={plansData} ai={ai} aiReady={!!ai}
            sync={{ available: svc.sync && !!api, on: sync.on, state: sync.state, at: sync.at, error: sync.error, conflict: sync.conflict, toggle: toggleSync, push: () => push(true), pull }}
            onWipe={async () => { await wipeWorkspace(uid); skip.current = false; setWs(emptyWorkspace()); notify('حُذفت كل بيانات الخطط من هذا الجهاز.'); }} />}
        </main>
        <p className="ca-foot">خططك وإعداداتك محفوظة في حسابك على هذا الجهاز{sync.on ? ' ومتزامنة مع حسابك' : ''}، ولا يطّلع عليها غيرك.</p>
      </div>
      {record && <RecordModal {...common} assignmentId={record} onClose={() => { setRecord(null); try { const u = new URL(window.location.href); if (u.searchParams.has('record')) { u.searchParams.delete('record'); window.history.replaceState(null, '', u.toString()); } } catch { /* */ } }} />}
      {toast && <div key={toast.k} className={`ca-toast is-${toast.kind}`} role="status"><Icon n={toast.kind === 'err' ? 'warn' : 'check'} />{toast.text}</div>}
    </div>
  );
}
