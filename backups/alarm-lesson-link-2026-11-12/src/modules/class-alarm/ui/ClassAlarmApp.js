'use client';
// ⏰ «منبّه الحصص الذكي» — الواجهة الرئيسية.
// الأداة مستقلة عن المنصة: تستقبل getToken فقط (لخدمات الخادم الاختيارية)، فيسهل نقلها لتطبيق مستقل لاحقًا.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from './parts';
import TodayView from './TodayView';
import ScheduleView from './ScheduleView';
import AlertsView from './AlertsView';
import ExportView from './ExportView';
import DataView from './DataView';
import ImportWizard from './ImportWizard';
import { AlarmOverlay, DisplayMode } from './Overlays';
import { AlarmRuntime, askNotify, notifyPermission, registerSW, showSystemNotification, closeSystemNotification } from './runtime';
import { TONES, CUSTOM_PREFIX, playTone, stopAll, unlockAudio, audioState, setCustomResolver, forgetCustom, inspectToneFile } from './audio';
import { loadStore, saveStore, listTones, saveTone, deleteTone, wipeAll, requestPersist, setStorageUser } from './storage';
import { loadWorkspace, saveWorkspace, PLANS_CHANNEL } from '../../lesson-plans/ui/storage';
import { normalizeWorkspace } from '../../lesson-plans/core/model.js';
import { linksForDay, eveningDigest } from '../../lesson-plans/core/links.js';
import { withOverride } from '../../lesson-plans/core/auto.js';
import { createApi } from './api';
import { normalizeStore, normalizeProfile, normalizeSettings, emptyStore, cloneProfile, uid } from '../core/model.js';
import { zonedParts } from '../core/time.js';
import './class-alarm.css';

const TABS = [
  { id: 'today', label: 'اليوم', icon: 'sun' },
  { id: 'schedule', label: 'الجدول', icon: 'grid' },
  { id: 'alerts', label: 'التنبيهات', icon: 'bell' },
  { id: 'export', label: 'الطباعة والتقويم', icon: 'print' },
  { id: 'data', label: 'البيانات', icon: 'shield' },
];
const ADHOC_KEY = 'mt-class-alarm:adhoc';
const TAB_ID = Math.random().toString(36).slice(2);

export default function ClassAlarmApp({ getToken, getUserId, apiBase = '/api/class-alarm', backHref = '/dashboard/tools', swScope = '/dashboard/tools/class-alarm', plansHref = '/dashboard/tools/plans' }) {
  const [store, setStore] = useState(null);
  const [toneRecs, setToneRecs] = useState([]);
  const [tab, setTab] = useState('today');
  const [now, setNow] = useState(() => Date.now());
  const [ringing, setRinging] = useState([]);
  const [ringMuted, setRingMuted] = useState(false);
  const [adhoc, setAdhoc] = useState([]);
  const [missed, setMissed] = useState([]);
  const [rt, setRt] = useState({ leader: false, worker: false, locks: false });
  const [audio, setAudio] = useState('none');
  const [perm, setPerm] = useState('default');
  const [toast, setToast] = useState(null);
  const [importing, setImporting] = useState(false);
  const [display, setDisplay] = useState(false);
  const [svc, setSvc] = useState({ ai: false, sync: false, checked: false, reason: '' });
  const [syncState, setSyncState] = useState({ state: 'idle', at: 0, error: '' });
  const [syncOffer, setSyncOffer] = useState(null);
  const [installEvt, setInstallEvt] = useState(null);
  const [uid, setUid] = useState(undefined);
  const [plansWs, setPlansWs] = useState(null); // بيانات «الخطط الفصلية» للقراءة فقط (اختيارية)

  const api = useMemo(() => (getToken ? createApi({ base: apiBase, getToken }) : null), [getToken, apiBase]);
  const notify = useCallback((text, kind = 'ok') => { setToast({ text, kind, k: Date.now() }); }, []);
  useEffect(() => { if (!toast) return undefined; const t = setTimeout(() => setToast(null), 4800); return () => clearTimeout(t); }, [toast]);

  const profile = store ? store.profiles.find((p) => p.id === store.activeId) || store.profiles[0] : null;
  const settings = store ? store.settings : null;

  // ---------- التحميل ----------
  const skipSave = useRef(true);
  useEffect(() => {
    let alive = true;
    (async () => {
      const id = getUserId ? await getUserId() : null;
      setStorageUser(id);
      const [raw, tn, ws] = await Promise.all([loadStore(), listTones(), loadWorkspace(id).catch(() => null)]);
      if (!alive) return;
      setUid(id);
      setPlansWs(ws ? normalizeWorkspace(ws) : null);
      skipSave.current = !raw ? false : true;
      setStore(normalizeStore(raw || emptyStore()));
      setToneRecs(tn);
      try { setAdhoc((JSON.parse(localStorage.getItem(ADHOC_KEY) || '[]') || []).filter((a) => a.due > Date.now() - 120000)); } catch { /* */ }
      setPerm(notifyPermission());
      setAudio(audioState());
      requestPersist();
    })();
    registerSW(swScope);
    const bip = (e) => { e.preventDefault(); setInstallEvt(e); };
    window.addEventListener('beforeinstallprompt', bip);
    return () => { alive = false; window.removeEventListener('beforeinstallprompt', bip); };
  }, [swScope]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- الحفظ + مزامنة التبويبات ----------
  const bc = useRef(null);
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return undefined;
    bc.current = new BroadcastChannel('musiteacher-class-alarm');
    bc.current.onmessage = async (e) => {
      if (!e.data || e.data.from === TAB_ID) return;
      if (e.data.type === 'store') { const raw = await loadStore(); if (raw) { skipSave.current = true; setStore(normalizeStore(raw)); } }
      if (e.data.type === 'ack') { stopAll(); setRinging([]); }
      if (e.data.type === 'tones') setToneRecs(await listTones());
    };
    return () => bc.current && bc.current.close();
  }, []);
  // إشعارات النظام مفعّلة افتراضيًا: المتصفح لا يسمح بطلب الإذن إلا بعد تفاعل المستخدم،
  // فنطلبه مرة واحدة عند أول نقرة في الأداة (ما لم يوقف المعلم التنبيهات أو إشعارات النظام من الإعدادات)
  const sysWanted = !!(settings && settings.enabled && settings.system);
  useEffect(() => {
    if (!sysWanted || perm !== 'default') return undefined;
    const once = () => { askNotify().then(setPerm); };
    window.addEventListener('pointerdown', once, { once: true });
    return () => window.removeEventListener('pointerdown', once);
  }, [sysWanted, perm]);
  // تحديثات «الخطط الفصلية» من تبويب آخر (ربط درس، تسجيل تنفيذ...) تنعكس فورًا
  useEffect(() => {
    if (uid === undefined || typeof BroadcastChannel === 'undefined') return undefined;
    const ch = new BroadcastChannel(PLANS_CHANNEL);
    ch.onmessage = async () => { const ws = await loadWorkspace(uid).catch(() => null); setPlansWs(ws ? normalizeWorkspace(ws) : null); };
    const vis = async () => { if (document.visibilityState === 'visible') { const ws = await loadWorkspace(uid).catch(() => null); setPlansWs(ws ? normalizeWorkspace(ws) : null); } };
    document.addEventListener('visibilitychange', vis);
    return () => { ch.close(); document.removeEventListener('visibilitychange', vis); };
  }, [uid]);

  useEffect(() => {
    if (!store) return undefined;
    if (skipSave.current) { skipSave.current = false; return undefined; }
    const t = setTimeout(async () => { await saveStore(store); if (bc.current) bc.current.postMessage({ from: TAB_ID, type: 'store' }); }, 300);
    return () => clearTimeout(t);
  }, [store]);
  useEffect(() => { try { localStorage.setItem(ADHOC_KEY, JSON.stringify(adhoc)); } catch { /* */ } }, [adhoc]);

  const onStore = useCallback((fn) => setStore((s) => normalizeStore({ ...fn(s), updatedAt: Date.now() })), []);
  const onProfile = useCallback((fn) => setStore((s) => ({ ...s, updatedAt: Date.now(), profiles: s.profiles.map((p) => (p.id === s.activeId ? normalizeProfile({ ...fn(p), updatedAt: Date.now() }) : p)) })), []);
  const onSettings = useCallback((patch) => setStore((s) => ({ ...s, updatedAt: Date.now(), settings: normalizeSettings({ ...s.settings, ...patch }) })), []);
  const onOverride = useCallback((dateKey, fn) => onProfile((p) => {
    const overrides = { ...p.overrides };
    const cur = overrides[dateKey] || { muted: false, note: '', cancelled: {}, changed: {}, notes: {}, extra: [] };
    overrides[dateKey] = fn(cur);
    return { ...p, overrides };
  }), [onProfile]);

  // ---------- النغمات ----------
  const tonesRef = useRef(toneRecs);
  tonesRef.current = toneRecs;
  useEffect(() => { setCustomResolver(async (id) => tonesRef.current.find((t) => t.id === id) || null); }, []);
  const tones = useMemo(() => ({ builtin: TONES, custom: toneRecs.map((t) => ({ id: CUSTOM_PREFIX + t.id, name: t.name, size: t.size, duration: t.duration })) }), [toneRecs]);
  const preview = useCallback(async (toneId) => {
    await unlockAudio(); setAudio(audioState());
    stopAll();
    const r = await playTone(toneId, store ? store.settings.volume : 0.8);
    if (!r.ok) notify('تعذر تشغيل الصوت في هذا المتصفح.', 'err');
  }, [store, notify]);
  const addTone = async (file, replaceId) => {
    await unlockAudio();
    const info = await inspectToneFile(file);
    const old = replaceId && toneRecs.find((t) => t.id === replaceId);
    const rec = { id: replaceId || uid('t'), name: old ? old.name : file.name.replace(/\.[^.]+$/, '').slice(0, 40) || 'نغمتي', type: file.type, size: file.size, duration: info.duration, blob: file, createdAt: old ? old.createdAt : Date.now() };
    await saveTone(rec);
    forgetCustom(rec.id);
    setToneRecs((l) => [...l.filter((t) => t.id !== rec.id), rec].sort((a, b) => a.createdAt - b.createdAt));
    if (bc.current) bc.current.postMessage({ from: TAB_ID, type: 'tones' });
    notify(info.trimmed ? `أُضيفت النغمة؛ سيُشغَّل أول 30 ثانية منها فقط.` : 'أُضيفت النغمة إلى «نغماتي».');
    setTimeout(() => preview(CUSTOM_PREFIX + rec.id), 50);
  };
  const removeTone = async (fullId) => {
    const raw = fullId.slice(CUSTOM_PREFIX.length);
    await deleteTone(raw); forgetCustom(raw);
    setToneRecs((l) => l.filter((t) => t.id !== raw));
    const fix = (plan) => plan && { ...plan, before: plan.before.map((b) => (b.tone === fullId ? { ...b, tone: 'chime' } : b)), start: plan.start.tone === fullId ? { ...plan.start, tone: 'start' } : plan.start, end: plan.end.tone === fullId ? { ...plan.end, tone: 'soft' } : plan.end };
    onStore((s) => ({ ...s, profiles: s.profiles.map((p) => ({ ...p, plan: fix(p.plan), lessons: Object.fromEntries(Object.entries(p.lessons).map(([d, r]) => [d, Object.fromEntries(Object.entries(r).map(([k, l]) => [k, { ...l, plan: fix(l.plan) }]))])) })) }));
  };
  const renameTone = (raw, name) => {
    setToneRecs((l) => l.map((t) => (t.id === raw ? { ...t, name } : t)));
    const t = toneRecs.find((x) => x.id === raw);
    if (t) saveTone({ ...t, name: name.slice(0, 40) || t.name });
  };

  // ---------- المحرك ----------
  const stateRef = useRef(null);
  const todayKey = profile ? zonedParts(now, profile.tz).dateKey : '';
  const planCtx = useMemo(() => {
    if (!profile || !plansWs || !plansWs.assignments.length && !plansWs.plans.length) return {};
    const cache = new Map();
    const linksFor = (k) => { if (!cache.has(k)) cache.set(k, linksForDay(plansWs, profile, k, todayKey)); return cache.get(k); };
    const pr = settings.planReminders;
    // تصحيح درس حصة من المنبّه: يُحفظ في بيانات «الخطط الفصلية» نفسها (أحدث نسخة من التخزين) ويُبلَّغ تبويب الخطط
    const saveOverride = async (dateKey, e, choice) => {
      const cur = normalizeWorkspace((await loadWorkspace(uid).catch(() => null)) || plansWs);
      const next = normalizeWorkspace({ ...withOverride(cur, { profileId: profile.id, dateKey, slotKey: e.key, ...choice }), updatedAt: Date.now() });
      await saveWorkspace(uid, next);
      setPlansWs(next);
      try { const ch = new BroadcastChannel(PLANS_CHANNEL); ch.postMessage({ from: 'alarm', type: 'ws' }); ch.close(); } catch { /* */ }
      notify(choice.lessonId === null ? 'أُعيدت الحصة للربط التلقائي.' : 'حُفظ تصحيح درس هذه الحصة.');
    };
    return { linksFor, digest: (k, next) => eveningDigest(plansWs, profile, next, k, pr), hasPlans: plansWs.plans.length > 0, ws: plansWs, saveOverride };
  }, [profile, plansWs, todayKey, settings, uid]); // eslint-disable-line react-hooks/exhaustive-deps
  stateRef.current = profile ? { profile, settings, adhoc, ctx: planCtx } : null;
  const ringRef = useRef([]);
  ringRef.current = ringing;
  const mutedRef = useRef(false);
  mutedRef.current = ringMuted;
  const titleRef = useRef('');

  const fire = useRef(null);
  fire.current = async (list, miss) => {
    const s = stateRef.current && stateRef.current.settings;
    if (!s) return;
    const t = Date.now();
    if (miss && miss.length) {
      const real = miss.filter((m) => m.type !== 'test' && t - m.due < 12 * 3600 * 1000);
      if (real.length) setMissed((m) => [...m, ...real.map((x) => ({ id: x.id, what: x.what || x.title, dateKey: x.dateKey, due: x.due }))].slice(-30));
      setAdhoc((a) => a.filter((x) => !miss.some((m) => m.id === x.id)));
    }
    if (!list.length) return;
    setAdhoc((a) => a.filter((x) => !list.some((m) => m.id === x.id)));
    const last = list[list.length - 1];
    const repeats = s.repeat.on && last.type !== 'digest' && (s.visual || last.type === 'test') ? s.repeat.count : 0;
    const entries = list.map((a) => ({ ...a, ringsLeft: last.type === 'test' ? 0 : repeats, nextRingAt: t + s.repeat.every * 1000 }));
    if (s.visual || last.type === 'test') { setRingMuted(false); setRinging((r) => [...r.filter((x) => !entries.some((e) => e.id === x.id)), ...entries]); }
    let soundOk = false;
    if (s.sound) { const r = await playTone(last.tone, s.volume); soundOk = r.ok; setAudio(audioState()); }
    const away = typeof document !== 'undefined' && (document.hidden || !document.hasFocus());
    if (s.system && (away || !s.visual)) for (const a of list) await showSystemNotification(a, { silent: soundOk });
    if (typeof document !== 'undefined' && !titleRef.current) titleRef.current = document.title;
  };

  const beat = useRef(null);
  beat.current = (t) => {
    setNow(t);
    const r = ringRef.current;
    if (r.length) {
      if (document.hidden && titleRef.current) document.title = Math.floor(t / 1000) % 2 ? `🔔 ${r[r.length - 1].title}` : titleRef.current;
      const s = stateRef.current && stateRef.current.settings;
      const due = r.filter((x) => x.ringsLeft > 0 && t >= x.nextRingAt);
      if (due.length && s && s.sound && !mutedRef.current) {
        playTone(due[due.length - 1].tone, s.volume);
        setRinging((cur) => cur.map((x) => (due.some((d) => d.id === x.id) ? { ...x, ringsLeft: x.ringsLeft - 1, nextRingAt: t + s.repeat.every * 1000 } : x)));
      }
    }
  };

  const loaded = !!store;
  useEffect(() => {
    if (!loaded) return undefined;
    const r = new AlarmRuntime({ getState: () => stateRef.current, onFire: (a, m) => fire.current(a, m), onStatus: setRt, onBeat: (t) => beat.current(t) });
    r.start();
    return () => r.stop();
  }, [loaded]);

  const ack = useCallback(() => {
    stopAll();
    for (const a of ringRef.current) closeSystemNotification(a.id);
    setRinging([]); setRingMuted(false);
    if (titleRef.current) { document.title = titleRef.current; titleRef.current = ''; }
    if (bc.current) bc.current.postMessage({ from: TAB_ID, type: 'ack' });
  }, []);
  const snooze = useCallback((a, min) => {
    ack();
    setAdhoc((l) => [...l, { ...a, id: `${a.id}|snz${Date.now()}`, due: Date.now() + min * 60000, type: 'snooze', title: `تذكير: ${a.what || a.title}`, ringsLeft: undefined, nextRingAt: undefined }]);
    notify(`سنذكّرك بعد ${min === 1 ? 'دقيقة' : min === 2 ? 'دقيقتين' : `${min} دقائق`}.`);
  }, [ack, notify]);
  const test = useCallback(async (sec) => {
    await unlockAudio(); setAudio(audioState());
    const tone = (profile && profile.plan.before[0] && profile.plan.before[0].tone) || 'chime';
    setAdhoc((l) => [...l, { id: `test|${Date.now()}`, due: Date.now() + Math.max(300, sec * 1000), type: 'test', tone, title: 'تجربة منبّه الحصص', what: 'تنبيه تجريبي', body: 'تنبيه تجريبي\nإذا سمعت النغمة ورأيت هذه الرسالة فالمنبه جاهز.', startMs: null, endMs: null }]);
    if (sec) notify(`سيصدر تنبيه تجريبي بعد ${sec} ثانية. يمكنك الانتقال لتبويب آخر أو تصغير المتصفح لتجربة التنبيه في الخلفية.`);
  }, [profile, notify]);

  // فك قيد الصوت عند أول نقرة/لمسة + رسائل الـ Service Worker
  useEffect(() => {
    const h = () => { unlockAudio().then(() => setAudio(audioState())); };
    window.addEventListener('pointerdown', h, true); window.addEventListener('keydown', h, true);
    const m = (e) => { if (e.data && e.data.type === 'class-alarm-ack') ack(); };
    if (navigator.serviceWorker) navigator.serviceWorker.addEventListener('message', m);
    const w = () => ack();
    window.addEventListener('class-alarm-ack', w);
    return () => { window.removeEventListener('pointerdown', h, true); window.removeEventListener('keydown', h, true); if (navigator.serviceWorker) navigator.serviceWorker.removeEventListener('message', m); window.removeEventListener('class-alarm-ack', w); };
  }, [ack]);

  // ---------- خدمات الخادم (اختيارية) ----------
  useEffect(() => {
    if (!api) { setSvc({ ai: false, sync: false, checked: true, reason: 'الخدمات السحابية غير متصلة في هذه النسخة.' }); return; }
    api.status().then((r) => setSvc({ ai: !!r.ai, sync: !!r.sync, checked: true, reason: r.sync ? '' : 'المزامنة غير مفعّلة على الخادم.' }))
      .catch((e) => setSvc({ ai: false, sync: false, checked: true, reason: e.message }));
  }, [api]);
  const syncOn = !!(settings && settings.sync && svc.sync && api);
  const pushNow = useCallback(async () => {
    if (!api || !store) return;
    setSyncState((s) => ({ ...s, state: 'saving' }));
    try { const r = await api.push(store); setSyncState({ state: 'ok', at: r.updatedAt || Date.now(), error: '' }); } catch (e) { setSyncState({ state: 'error', at: 0, error: e.message }); }
  }, [api, store]);
  useEffect(() => { if (!syncOn) return undefined; const t = setTimeout(pushNow, 4000); return () => clearTimeout(t); }, [store, syncOn]); // eslint-disable-line react-hooks/exhaustive-deps
  const checked = useRef(false);
  useEffect(() => {
    if (!syncOn || checked.current) return;
    checked.current = true;
    api.pull().then((r) => { if (r.store && r.updatedAt > (store.updatedAt || 0) + 5000) setSyncOffer(r); }).catch(() => {});
  }, [syncOn]); // eslint-disable-line react-hooks/exhaustive-deps
  const pull = async () => {
    try {
      const r = await api.pull();
      if (!r.store) { notify('لا توجد نسخة محفوظة في حسابك بعد.', 'err'); return; }
      if (window.confirm(`استبدال الجداول على هذا الجهاز بالنسخة المحفوظة في حسابك (${new Date(r.updatedAt).toLocaleString('ar-OM')})؟`)) { restore(r.store); notify('تم الاسترجاع من حسابك.'); }
    } catch (e) { notify(e.message, 'err'); }
  };
  const removeRemote = async () => { if (!window.confirm('حذف النسخة المحفوظة في حسابك؟ (تبقى بياناتك على هذا الجهاز)')) return; try { await api.remove(); onSettings({ sync: false }); notify('حُذفت النسخة من حسابك.'); } catch (e) { notify(e.message, 'err'); } };
  const restore = (s) => setStore(normalizeStore({ ...s, settings: { ...s.settings, sync: settings ? settings.sync : false }, updatedAt: Date.now() }));

  if (!store || !profile || uid === undefined) {
    return <div className="ca-root"><div className="ca-loading"><span className="ca-spin" />جارٍ تجهيز المنبه...</div></div>;
  }

  const paused = settings.pausedUntil > now;
  const status = !settings.enabled ? { k: 'off', t: 'المنبه متوقف' } : paused ? { k: 'warn', t: 'متوقف مؤقتًا' } : settings.sound && audio !== 'running' ? { k: 'warn', t: 'الصوت يحتاج تفعيلًا' } : !rt.leader && rt.locks ? { k: 'info', t: 'يعمل من تبويب آخر' } : { k: 'ok', t: 'المنبه يعمل' };
  const zp = zonedParts(now, profile.tz);

  return (
    <div className="ca-root" dir="rtl">
      <div className="ca-shell">
        <div className="ca-topbar">
          <a href={backHref} className="ca-back"><Icon n="back" size={16} />أدوات المعلم</a>
          <span className={`ca-status is-${status.k}`} role="status"><i aria-hidden="true" />{status.t}</span>
        </div>
        <header className="ca-head">
          <div>
            <h1><span className="ca-logo" aria-hidden="true"><Icon n="bell" size={26} /></span>منبّه الحصص الذكي</h1>
            <p>مساعدك الذكي لتنظيم اليوم الدراسي والتنبيه بمواعيد الحصص.</p>
          </div>
          {store.profiles.length > 1 && (
            <label className="ca-profile-pick"><span>الجدول النشط</span>
              <select className="ca-input" value={store.activeId} onChange={(e) => onStore((s) => ({ ...s, activeId: e.target.value }))}>{store.profiles.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
            </label>
          )}
        </header>

        {settings.sound && audio !== 'running' && settings.enabled && (
          <button type="button" className="ca-unlock" onClick={() => unlockAudio().then(() => setAudio(audioState()))}><Icon n="bell" />المتصفح يمنع الصوت حتى تتفاعل مع الصفحة. انقر هنا مرة واحدة لتفعيل صوت المنبه.</button>
        )}
        {syncOffer && <div className="ca-notice is-info"><Icon n="cloud" /><span>توجد نسخة أحدث من جداولك في حسابك ({new Date(syncOffer.updatedAt).toLocaleString('ar-OM')}).</span><button type="button" className="ca-btn is-sm" onClick={() => { restore(syncOffer.store); setSyncOffer(null); notify('تم الاسترجاع.'); }}>استرجاعها</button><button type="button" className="ca-btn is-ghost is-sm" onClick={() => setSyncOffer(null)}>تجاهل</button></div>}

        <nav className="ca-tabs" role="tablist" aria-label="أقسام المنبه">
          {TABS.map((t) => <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'is-on' : ''} onClick={() => setTab(t.id)}><Icon n={t.icon} size={17} /><span>{t.label}</span></button>)}
        </nav>

        <main className="ca-main" role="tabpanel">
          {tab === 'today' && <TodayView profile={profile} settings={settings} now={now} planCtx={planCtx} plansHref={plansHref} onOverride={onOverride} onGoto={setTab} onOpenImport={() => setImporting(true)} profilesCount={store.profiles.length} missed={missed} rt={rt} onDisplay={() => setDisplay(true)} onTest={test}
            onCopyFrom={() => { const src = [...store.profiles].filter((p) => p.id !== store.activeId).sort((a, b) => b.updatedAt - a.updatedAt)[0]; if (!src) return; const c = cloneProfile(src, { name: `${src.name} (نسخة)` }); onStore((s) => ({ ...s, profiles: [...s.profiles, c], activeId: c.id })); setTab('schedule'); notify(`نسخنا «${src.name}». عدّل الأوقات والأيام للفصل الجديد.`); }} />}
          {tab === 'schedule' && <ScheduleView profile={profile} store={store} settings={settings} onProfile={onProfile} onStore={onStore} onImport={() => setImporting(true)} tones={tones} onPreview={preview} notify={notify} />}
          {tab === 'alerts' && <AlertsView profile={profile} settings={settings} onProfile={onProfile} onSettings={onSettings} tones={tones} onPreview={preview} onAddTone={addTone} onDeleteTone={removeTone} onRenameTone={renameTone}
            readiness={{ audio, perm, leader: rt.leader, worker: rt.worker }} onAskNotify={async () => { const p = await askNotify(); setPerm(p); if (p === 'granted') notify('تم السماح بالإشعارات.'); else if (p === 'denied') notify('رُفض الإذن. يمكنك تغييره من أيقونة القفل بجوار عنوان الموقع.', 'err'); }}
            onUnlock={() => unlockAudio().then(() => setAudio(audioState()))} onTest={test} now={now} hasPlans={!!planCtx.hasPlans} plansHref={plansHref} canInstall={!!installEvt} onInstall={async () => { installEvt.prompt(); await installEvt.userChoice.catch(() => {}); setInstallEvt(null); }} onGoto={setTab} />}
          {tab === 'export' && <ExportView profile={profile} settings={settings} notify={notify} />}
          {tab === 'data' && <DataView store={store} settings={settings} onSettings={onSettings} tonesCount={toneRecs.length} notify={notify} onRestore={restore}
            onWipe={async () => { await wipeAll(); setToneRecs([]); skipSave.current = false; setStore(emptyStore()); setTab('today'); notify('حُذفت كل البيانات من هذا الجهاز.'); }}
            sync={{ available: svc.sync && !!api, reason: svc.reason, state: syncState.state, at: syncState.at, error: syncState.error, push: pushNow, pull, remove: removeRemote }} />}
        </main>
        <p className="ca-foot">الوقت حسب {profile.tz === 'Asia/Muscat' ? 'توقيت سلطنة عُمان' : profile.tz} • {String(zp.hh).padStart(2, '0')}:{String(zp.mm).padStart(2, '0')}</p>
      </div>

      {importing && <ImportWizard onClose={() => setImporting(false)} ai={api ? (payload, signal) => api.extract(payload, signal) : null} aiReady={svc.ai && !!api} activeProfile={profile}
        onApply={(p, dest) => { onStore((s) => (dest === 'replace' ? { ...s, profiles: s.profiles.map((x) => (x.id === s.activeId ? { ...p, id: x.id } : x)) } : { ...s, profiles: [...s.profiles, p], activeId: p.id })); setImporting(false); setTab('schedule'); notify('اعتُمد الجدول. راجع بيانات المعلم والمدرسة وخطة التنبيه.'); }} />}
      {display && <DisplayMode profile={profile} settings={settings} now={now} onClose={() => setDisplay(false)} />}
      <AlarmOverlay ringing={ringing} now={now} onAck={ack} onSnooze={snooze} muted={ringMuted} onMute={() => { stopAll(); setRingMuted(true); }} />
      {toast && <div key={toast.k} className={`ca-toast is-${toast.kind}`} role="status"><Icon n={toast.kind === 'err' ? 'warn' : 'check'} />{toast.text}</div>}
    </div>
  );
}
