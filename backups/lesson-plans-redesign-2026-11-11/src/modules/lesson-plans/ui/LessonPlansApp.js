'use client';
// 🗺️ «مولد الخطط الفصلية» — الواجهة الرئيسية: الخطة الرسمية • خططي • ربط الخطة بجدولي • اليوم وغدًا • التقدم
// الجدول المدرسي يُقرأ من «منبّه الحصص» مباشرة (قراءة فقط) ولا يُنسخ؛ وكل ما يخص الخطط محفوظ لكل حساب على حدة.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../../class-alarm/ui/parts';
import { readAlarmStoreFor, ALARM_CHANNEL } from '../../class-alarm/ui/storage';
import { normalizeStore } from '../../class-alarm/core/model.js';
import { zonedParts } from '../../class-alarm/core/time.js';
import { normalizeWorkspace, emptyWorkspace } from '../core/model.js';
import { conflicts } from '../core/track.js';
import { loadWorkspace, saveWorkspace, wipeWorkspace, PLANS_CHANNEL } from './storage';
import OfficialView from './OfficialView';
import PlansView from './PlansView';
import LinkView from './LinkView';
import TodayPlanView from './TodayPlanView';
import ProgressView from './ProgressView';
import { RecordModal } from './lpParts';
import '../../class-alarm/ui/class-alarm.css';
import './lesson-plans.css';

const TABS = [
  { id: 'official', label: 'الخطة الرسمية', icon: 'calendar' },
  { id: 'plans', label: 'خططي', icon: 'note' },
  { id: 'link', label: 'ربط الخطة بجدولي', icon: 'grid' },
  { id: 'today', label: 'اليوم وغدًا', icon: 'sun' },
  { id: 'progress', label: 'التقدم', icon: 'sparkle' },
];
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
  return { status: () => call('status'), extract: (p, s) => call('extract', 'POST', p, s), pull: () => call('sync'), push: (ws, baseUpdatedAt) => call('sync', 'POST', { ws, baseUpdatedAt }), remove: () => call('sync', 'DELETE') };
}

export default function LessonPlansApp({ plansData, getToken, getUserId, apiBase = '/api/lesson-plans', alarmHref = '/dashboard/tools/class-alarm', backHref = '/dashboard/tools' }) {
  const [uid, setUid] = useState(undefined);
  const [ws, setWs] = useState(null);
  const [alarm, setAlarm] = useState(null);       // نسخة قراءة فقط من بيانات المنبّه
  const [tab, setTab] = useState('official');
  const [now, setNow] = useState(() => Date.now());
  const [toast, setToast] = useState(null);
  const [svc, setSvc] = useState({ ai: false, sync: false });
  const [sync, setSync] = useState({ on: false, state: 'idle', at: 0, error: '' });
  const [record, setRecord] = useState(null);
  const [pendingDraft, setPendingDraft] = useState(null);
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
      setWs(normalizeWorkspace(raw || emptyWorkspace()));
      try { setSync((s) => ({ ...s, on: localStorage.getItem(`mt-plans:sync:${id || 'guest'}`) === '1' })); } catch { /* */ }
      const q = new URLSearchParams(window.location.search);
      const t = q.get('tab'); if (TABS.some((x) => x.id === t)) setTab(t);
      else if (raw && raw.plans && raw.plans.length) setTab('today');
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
  useEffect(() => { if (!api) return; api.status().then((r) => setSvc({ ai: !!r.ai, sync: !!r.sync })).catch(() => setSvc({ ai: false, sync: false })); }, [api]);
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
  const cf = hasSchedule ? conflicts(ws, profile, today) : [];
  const ai = api && svc.ai ? (payload, signal) => api.extract(payload, signal) : null;
  const common = { ws, update, profile, today, now, notify, alarmHref, onRecord: setRecord, onGoto: setTab, hasSchedule };

  return (
    <div className="ca-root lp-root" dir="rtl">
      <div className="ca-shell">
        <div className="ca-topbar">
          <a href={backHref} className="ca-back"><Icon n="back" size={16} />أدوات المعلم</a>
          <a href={alarmHref} className={`lp-link-chip${hasSchedule ? '' : ' is-off'}`} title="الجدول المدرسي يُقرأ من منبّه الحصص">
            <Icon n="bell" size={15} />{hasSchedule ? <>متصل بجدولك في «منبّه الحصص»: <b>{profile.name}</b></> : 'لا يوجد جدول في «منبّه الحصص» بعد — فتح الجدول الذكي'}
          </a>
        </div>
        <header className="ca-head">
          <div>
            <h1><span className="ca-logo lp-logo" aria-hidden="true"><Icon n="calendar" size={26} /></span>مولد الخطط الفصلية</h1>
            <p>ماذا أدرّس؟ (خطتي) • متى؟ (جدولي في المنبّه) • ماذا درّست فعلًا؟ (سجل التنفيذ)</p>
          </div>
        </header>
        {cf.length > 0 && (
          <div className="ca-notice is-warn lp-mb"><Icon n="warn" /><span>{cf.length === 1 ? 'حصة مرتبطة بدرس' : `${cf.length} حصص مرتبطة بدروس`} لم تعد متاحة في جدولك بعد تعديل المنبّه (مثل: {cf[0].reason}). لم نغيّر شيئًا تلقائيًا.</span><button type="button" className="ca-btn is-sm" onClick={() => setTab('link')}>مراجعة واختيار البديل</button></div>
        )}
        <nav className="ca-tabs" role="tablist" aria-label="أقسام الخطط">
          {TABS.map((t) => <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'is-on' : ''} onClick={() => setTab(t.id)}><Icon n={t.icon} size={17} /><span>{t.label}</span></button>)}
        </nav>
        <main className="ca-main" role="tabpanel">
          {tab === 'official' && <OfficialView plansData={plansData} uid={uid} onUseAsDraft={(semester, grade) => { setPendingDraft({ semester, grade, t: Date.now() }); setTab('plans'); }} />}
          {tab === 'plans' && <PlansView {...common} plansData={plansData} ai={ai} aiReady={!!ai} pendingDraft={pendingDraft} clearPendingDraft={() => setPendingDraft(null)}
            sync={{ available: svc.sync && !!api, on: sync.on, state: sync.state, at: sync.at, error: sync.error, conflict: sync.conflict, toggle: toggleSync, push: () => push(true), pull }}
            onWipe={async () => { await wipeWorkspace(uid); skip.current = false; setWs(emptyWorkspace()); notify('حُذفت كل بيانات الخطط من هذا الجهاز.'); }} />}
          {tab === 'link' && <LinkView {...common} conflicts={cf} />}
          {tab === 'today' && <TodayPlanView {...common} />}
          {tab === 'progress' && <ProgressView {...common} />}
        </main>
        <p className="ca-foot">الخطط والتوزيع وسجل التنفيذ محفوظة في حسابك على هذا الجهاز{sync.on ? ' ومتزامنة مع حسابك' : ''}، ولا يطّلع عليها غيرك.</p>
      </div>
      {record && <RecordModal {...common} assignmentId={record} onClose={() => { setRecord(null); try { const u = new URL(window.location.href); if (u.searchParams.has('record')) { u.searchParams.delete('record'); window.history.replaceState(null, '', u.toString()); } } catch { /* */ } }} />}
      {toast && <div key={toast.k} className={`ca-toast is-${toast.kind}`} role="status"><Icon n={toast.kind === 'err' ? 'warn' : 'check'} />{toast.text}</div>}
    </div>
  );
}
