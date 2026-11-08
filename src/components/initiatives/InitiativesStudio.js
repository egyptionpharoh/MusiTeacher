'use client';
// مبادرات تعليمية — مساعد يحوّل الإبداع التربوي إلى مبادرات مدرسية قابلة للتخطيط والتنفيذ والقياس.
// أربع مساحات: استكشاف (المكتبة) · ابتكر (الذكاء الاصطناعي) · المحفوظة · مبادراتي (قيد التخطيط والتنفيذ).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { auth } from '@/lib/firebase';
import { DOMAINS, LEADS, COSTS, SIZES, STAGES, DURATIONS, NATURES, STATUSES, DOMAIN, label } from '@/lib/initiatives/taxonomy';
import { libraryInitiatives, filterInitiatives, countsBy, randomInitiative, EMPTY_FILTERS } from '@/lib/initiatives/catalog';
import { normalizeInitiative, normalizeProject, projectFromInitiative, duplicateProject, syncTasks, progressOf } from '@/lib/initiatives/schema';
import { loadLocal, saveLocal, mergeData } from '@/lib/initiatives/store';
import { api, ApiError, downloadBlob, printHTML, copyRich, safeFileName } from '@/lib/pd-workshops/browser';
import { Icon, EXTRA, InitiativeCard, StatusPill, Progress, Select, DomainIcon } from './parts';
import InitiativeDetail from './InitiativeDetail';
import Workspace from './Workspace';
import './initiatives.css';

const MSG = {
  unauthenticated: 'انتهت جلسة الدخول. حدّث الصفحة وسجّل الدخول من جديد.',
  forbidden: 'هذه الخدمة متاحة لحسابات المنصة المفعّلة فقط.',
  origin: 'تعذر التحقق من مصدر الطلب. افتح الأداة من داخل المنصة.',
  'ai-not-configured': 'الذكاء الاصطناعي غير مفعّل على الخادم بعد. المكتبة والتخطيط اليدوي والتصدير متاحة كاملة.',
  'rate-limited': 'طلبات كثيرة خلال وقت قصير. انتظر دقيقة ثم أعد المحاولة.',
  'ai-rate-limited': 'خدمة الذكاء الاصطناعي مشغولة الآن. أعد المحاولة بعد قليل.',
  'ai-timeout': 'استغرق الذكاء الاصطناعي وقتًا أطول من المعتاد. أعد المحاولة.',
  'ai-bad-output': 'جاءت نتيجة الذكاء الاصطناعي غير مكتملة. أعد المحاولة.',
  'ai-empty': 'لم يأتِ الذكاء الاصطناعي بأفكار جديدة غير مكررة هذه المرة. غيّر الطلب أو أعد المحاولة.',
  'ai-blocked': 'رفض النموذج هذا الطلب. أعد صياغته.',
  'ai-auth': 'مفتاح خدمة الذكاء الاصطناعي على الخادم غير صالح. أبلغ مسؤول المنصة.',
  'sync-disabled': 'المزامنة مع الحساب غير مفعّلة على الخادم.',
  'too-large': 'البيانات أكبر من المسموح للمزامنة.',
  network: 'تعذر الاتصال بالخادم. تحقق من الإنترنت ثم أعد المحاولة.',
  'db-error': 'تعذر الاتصال بقاعدة البيانات حاليًا.',
};
const msgOf = (e) => MSG[e && e.code] || 'حدث خطأ غير متوقع. أعد المحاولة.';
const getToken = async () => {
  if (!auth) return null;
  if (typeof auth.authStateReady === 'function') { try { await auth.authStateReady(); } catch { /* */ } }
  const u = auth.currentUser; return u ? u.getIdToken() : null;
};
const EXAMPLES = [
  'أريد مبادرة لتحسين القراءة لدى طلبة الصف الخامس',
  'اقترح مبادرة مدرسية مبتكرة بمناسبة العيد الوطني العُماني',
  'أريد مبادرة فنية يمكن تنفيذها بإمكانات بسيطة',
  'أريد مبادرة لتوظيف الذكاء الاصطناعي في المدرسة',
  'اقترح مبادرة يقودها الطلبة بأنفسهم',
  'أريد مبادرة لتحسين الانضباط المدرسي',
  'أريد مبادرة مجتمعية بمشاركة أولياء الأمور',
  'أريد فكرة غير تقليدية يمكن تنفيذها خلال أسبوع واحد',
];
const SPACES = [
  { id: 'explore', label: 'استكشاف المبادرات', icon: 'search' },
  { id: 'create', label: 'ابتكر لي مبادرة', icon: 'wand' },
  { id: 'saved', label: 'المحفوظة', icon: 'heart' },
  { id: 'projects', label: 'مبادراتي', icon: EXTRA.rocket },
];

function useElapsed(active) {
  const [s, setS] = useState(0);
  useEffect(() => { if (!active) { setS(0); return undefined; } const t0 = Date.now(); const id = setInterval(() => setS(Math.floor((Date.now() - t0) / 1000)), 500); return () => clearInterval(id); }, [active]);
  return s;
}

// ======================================================================================
export default function InitiativesStudio() {
  const library = useMemo(() => libraryInitiatives(), []);
  const counts = useMemo(() => countsBy(library, 'domain'), [library]);
  const [data, setData] = useState(null);                       // يُحمّل من الجهاز بعد التركيب
  const [space, setSpace] = useState('explore');
  const [openId, setOpenId] = useState(null);                   // مبادرة مفتوحة (مكتبة/مولدة)
  const [projectId, setProjectId] = useState(null);
  const [wsTab, setWsTab] = useState('plan');
  const [filters, setFilters] = useState({ ...EMPTY_FILTERS });
  const [statusFilter, setStatusFilter] = useState('');
  const [server, setServer] = useState({ ai: null, sync: false });
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState(null);
  const [req, setReq] = useState('');
  const [opts, setOpts] = useState({ domain: '', stage: '', audience: '', size: '', weeks: 0, cost: '', participants: 0, nature: '' });
  const [syncState, setSyncState] = useState('');               // '', 'syncing', 'ok', 'err'
  const abortRef = useRef(null);
  const elapsed = useElapsed(!!busy && !busy.startsWith('export'));

  // ---------- التحميل الأول
  useEffect(() => {
    setData(loadLocal());
    let alive = true;
    api('/api/initiatives/status').then((d) => { if (alive) setServer({ ai: !!d.ai, sync: !!d.sync }); }).catch(() => { if (alive) setServer({ ai: false, sync: false }); });
    return () => { alive = false; };
  }, []);
  // ---------- الحفظ على الجهاز عند كل تغيير
  useEffect(() => { if (data) saveLocal(data); }, [data]);
  // ---------- العودة لأعلى الصفحة عند الانتقال
  useEffect(() => { try { window.scrollTo({ top: 0, behavior: 'auto' }); } catch { /* */ } }, [space, openId, projectId]);

  const flash = useCallback((type, text) => { setNotice({ type, text }); if (type !== 'err') setTimeout(() => setNotice((n) => (n && n.text === text ? null : n)), 3800); }, []);
  const D = data || { projects: [], favs: [], aiIdeas: [], recent: [], deleted: {}, sync: false };
  const allIdeas = useMemo(() => [...D.aiIdeas, ...library], [D.aiIdeas, library]);
  const opened = openId ? allIdeas.find((i) => i.id === openId) : null;
  const project = projectId ? D.projects.find((p) => p.id === projectId) : null;
  const filtered = useMemo(() => filterInitiatives(library, filters), [library, filters]);
  const hasFilters = Object.values(filters).some(Boolean);
  const change = (fn) => setData((d) => ({ ...d, ...fn(d) }));

  // ---------- المزامنة مع الحساب (اختيارية، على نمط منبّه الحصص)
  const syncTimer = useRef(null);
  const doSync = useCallback(async (mode = 'both') => {
    if (!data) return;
    setSyncState('syncing');
    try {
      let merged = { projects: data.projects, favs: data.favs, deleted: data.deleted };
      if (mode !== 'push') {
        const r = await api('/api/initiatives/sync', { getToken, method: 'GET' });
        merged = mergeData(data, r.data);
        setData((d) => ({ ...d, ...merged }));
      }
      await api('/api/initiatives/sync', { getToken, body: { data: merged } });
      setData((d) => ({ ...d, syncedAt: Date.now() }));
      setSyncState('ok');
    } catch (e) { setSyncState('err'); if (mode !== 'push') flash('err', `تعذرت المزامنة: ${msgOf(e)}`); }
  }, [data, flash]);
  // رفع تلقائي بعد التعديلات (مؤجل) عند تفعيل المزامنة
  const dataVersion = data ? JSON.stringify([data.projects.map((p) => p.updatedAt), data.favs, data.deleted]) : '';
  useEffect(() => {
    if (!data || !data.sync || !server.sync) return undefined;
    clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(() => { doSync('push'); }, 4000);
    return () => clearTimeout(syncTimer.current);
  }, [dataVersion, server.sync]); // eslint-disable-line react-hooks/exhaustive-deps
  // سحب مرة عند الفتح إن كانت المزامنة مفعّلة
  const pulled = useRef(false);
  useEffect(() => { if (data && data.sync && server.sync && !pulled.current) { pulled.current = true; doSync('both'); } }, [data, server.sync, doSync]);

  // ---------- التنقل
  const openIdea = (id) => { setOpenId(id); setProjectId(null); };
  const openProject = (id, tab = 'plan') => { setProjectId(id); setOpenId(null); setWsTab(tab); setSpace('projects'); };
  const goSpace = (s) => { setSpace(s); setOpenId(null); setProjectId(null); };
  const isFav = (id) => D.favs.includes(id);
  const toggleFav = (id) => change((d) => {
    const on = d.favs.includes(id);
    const deleted = { ...d.deleted }; if (on) deleted[`fav:${id}`] = Date.now(); else delete deleted[`fav:${id}`];
    return { favs: on ? d.favs.filter((x) => x !== id) : [id, ...d.favs], deleted };
  });
  const surprise = () => {
    const i = randomInitiative(filtered.length ? filtered : library, D.recent);
    if (!i) return;
    change((d) => ({ recent: [i.id, ...d.recent.filter((x) => x !== i.id)].slice(0, Math.min(15, library.length - 1)) }));
    openIdea(i.id);
  };

  // ---------- المشروعات
  const saveProject = (p) => change((d) => ({ projects: [normalizeProject({ ...p, updatedAt: Date.now() }), ...d.projects.filter((x) => x.id !== p.id)] }));
  const adopt = (item) => {
    const p = projectFromInitiative(item);
    change((d) => ({ projects: [p, ...d.projects] }));
    flash('ok', item.brief ? 'حُفظت الفكرة في «مبادراتي». طوّرها إلى خطة كاملة متى شئت.' : 'أُضيفت المبادرة إلى «مبادراتي». عدّل خطتها وابدأ التخطيط.');
    openProject(p.id);
  };
  const deleteProject = (id) => { change((d) => ({ projects: d.projects.filter((x) => x.id !== id), deleted: { ...d.deleted, [id]: Date.now() } })); setProjectId(null); flash('ok', 'حُذفت المبادرة.'); };
  const duplicate = (p) => { const c = duplicateProject(p); change((d) => ({ projects: [c, ...d.projects] })); openProject(c.id); flash('ok', 'أُنشئت نسخة مستقلة يمكنك تعديلها.'); };

  // ---------- الذكاء الاصطناعي
  const run = async (kind, fn) => {
    if (busy) return;
    const ctrl = new AbortController(); abortRef.current = ctrl;
    setBusy(kind); setNotice(null);
    try { await fn(ctrl.signal); }
    catch (e) {
      if (e instanceof ApiError && e.code === 'aborted') flash('info', 'أُلغي الطلب.');
      else { if (e && e.code === 'ai-not-configured') setServer((s) => ({ ...s, ai: false })); flash('err', msgOf(e)); }
    } finally { setBusy(''); abortRef.current = null; }
  };
  const cleanOpts = () => Object.fromEntries(Object.entries(opts).filter(([, v]) => v));
  const generate = (request) => run('ideas', async (signal) => {
    const exclude = D.aiIdeas.map((i) => i.title).slice(0, 60);
    const d = await api('/api/initiatives/ideas', { getToken, signal, body: { request, options: cleanOpts(), exclude, count: 3 } });
    const fresh = (d.ideas || []).map((i) => normalizeInitiative(i, 'ai')).filter(Boolean).map((i) => ({ ...i, brief: true }));
    change((dd) => ({ aiIdeas: [...fresh, ...dd.aiIdeas].slice(0, 40) }));
    flash('ok', `ابتُكرت ${fresh.length === 1 ? 'فكرة جديدة' : `${fresh.length} أفكار جديدة`}. افتح أي فكرة لتطويرها.`);
  });
  const develop = (item, { tweaks, instruction }) => run('develop', async (signal) => {
    const d = await api('/api/initiatives/develop', { getToken, signal, body: { initiative: item, tweaks, instruction, options: cleanOpts() } });
    const p = projectFromInitiative({ ...normalizeInitiative(d.plan, 'mine'), id: item.id }, { origin: item.source === 'ai' ? 'ai' : 'mixed' });
    change((dd) => ({ projects: [{ ...p, aiSections: ['all'] }, ...dd.projects] }));
    flash('ok', 'طُوّرت المبادرة إلى خطة تنفيذية وأُضيفت إلى «مبادراتي». راجعها وعدّل ما تريد.');
    openProject(p.id);
  });
  const developProject = (tweaks, instruction) => run('develop', async (signal) => {
    const p = project;
    const d = await api('/api/initiatives/develop', { getToken, signal, body: { initiative: p.plan, tweaks, instruction } });
    const plan = normalizeInitiative(d.plan, 'mine');
    saveProject({ ...p, plan, tasks: syncTasks(p.tasks, plan.phases), origin: p.origin === 'library' ? 'mixed' : p.origin, status: p.status === 'idea' ? 'planning' : p.status, aiSections: ['all'] });
    flash('ok', 'طُوّرت الخطة. بقي سجل التوثيق وبيانات الملف كما هي.');
  });
  const regen = (section) => run(`section:${section}`, async (signal) => {
    const p = project;
    const d = await api('/api/initiatives/section', { getToken, signal, body: { initiative: p.plan, section } });
    const plan = normalizeInitiative(d.plan, 'mine');
    // نحافظ على أسماء الفريق وقيم المؤشرات التي أدخلها المعلم حين يتطابق الدور/المؤشر
    if (section === 'team') plan.team = plan.team.map((t) => ({ ...t, name: (p.plan.team.find((x) => x.r === t.r) || {}).name || '' }));
    saveProject({ ...p, plan, tasks: section === 'phases' || section === 'activities' ? syncTasks(p.tasks, plan.phases) : p.tasks, origin: p.origin === 'library' ? 'mixed' : p.origin, aiSections: [...new Set([...p.aiSections, section])] });
    flash('ok', 'أُعيدت صياغة هذا الجزء، وبقيت بقية المبادرة كما هي.');
  });

  // ---------- التصدير
  const doExport = async (kind) => {
    const p = project; if (!p || busy) return;
    setBusy(`export:${kind}`);
    try {
      const base = safeFileName(p.plan.title);
      if (kind === 'docx') {
        const { buildProjectDocx } = await import('@/lib/initiatives/export-docx');
        downloadBlob(await buildProjectDocx(p), `ملف مبادرة - ${base}.docx`, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        flash('ok', 'نُزّل ملف المبادرة بصيغة Word قابلة للتعديل.');
        if (p.status === 'planning') saveProject({ ...p, status: 'ready' });
      } else {
        const H = await import('@/lib/initiatives/export-html');
        if (kind === 'print') await printHTML(H.projectHTML(p));
        else if (kind === 'poster') await printHTML(H.posterHTML(p));
        else if (kind === 'survey') await printHTML(H.surveyHTML(p));
        else if (kind === 'copy') { const ok = await copyRich(H.projectToText(p)); flash(ok ? 'ok' : 'err', ok ? 'نُسخ محتوى المبادرة كاملًا.' : 'تعذر النسخ في هذا المتصفح.'); }
      }
    } catch (e) { console.error(e); flash('err', 'تعذر إنشاء الملف. أعد المحاولة.'); } finally { setBusy(''); }
  };

  const spaceColor = { explore: 'amber', create: 'violet', saved: 'rose', projects: 'teal' }[space];
  const activeCount = D.projects.filter((p) => p.status === 'active').length;

  // ======================================================================================
  return (
    <div className="in-root" dir="rtl" data-space={spaceColor}>
      <div className="in-shell">
        <div className="in-topbar"><Link href="/dashboard/tools" className="in-back"><Icon d="back" size={16} /> الأدوات</Link></div>
        <header className={`in-hero ${openId || projectId ? 'is-compact' : ''}`}>
          <div className="in-hero-text">
            <span className="in-kicker"><Icon d="spark" size={15} /> من الفكرة إلى التنفيذ والقياس</span>
            <h1>مبادرات تعليمية</h1>
            <p>مبادرات وأفكار إبداعية مقترحة جاهزة للتنفيذ في مدرستك — اكتشف فكرة، طوّرها إلى خطة، وأعدّ ملفها وتابع تنفيذها.</p>
          </div>
          <div className="in-hero-actions">
            <button type="button" className="in-hero-btn" onClick={() => { goSpace('explore'); setTimeout(surprise, 0); }}><Icon d="dice" size={19} /> فاجئني بمبادرة</button>
            <button type="button" className="in-hero-btn is-gold" onClick={() => goSpace('create')}><Icon d="wand" size={19} /> ابتكر لي مبادرة</button>
          </div>
        </header>

        <nav className="in-spaces" aria-label="مساحات الأداة">
          {SPACES.map((s) => (
            <button key={s.id} type="button" className={`in-space is-${s.id} ${space === s.id && !openId && !projectId ? 'is-on' : ''} ${space === s.id ? 'is-cur' : ''}`} onClick={() => goSpace(s.id)} aria-current={space === s.id ? 'page' : undefined}>
              <Icon d={s.icon} size={18} /> <span>{s.label}</span>
              {s.id === 'saved' && D.favs.length > 0 && <b>{D.favs.length}</b>}
              {s.id === 'projects' && D.projects.length > 0 && <b>{D.projects.length}{activeCount ? ` · ${activeCount} قيد التنفيذ` : ''}</b>}
            </button>
          ))}
        </nav>

        {notice && (
          <div className={`in-notice is-${notice.type}`} role={notice.type === 'err' ? 'alert' : 'status'}>
            <Icon d={notice.type === 'err' ? 'info' : 'check'} /> <span>{notice.text}</span>
            <button type="button" className="in-x" onClick={() => setNotice(null)} aria-label="إغلاق"><Icon d="x" size={16} /></button>
          </div>
        )}
        {busy && !busy.startsWith('export') && (
          <div className="in-working" role="status" aria-live="polite"><span className="in-spin" />
            <span>{busy === 'ideas' ? 'يبتكر الذكاء الاصطناعي مبادرات جديدة' : busy === 'develop' ? 'يطوّر الذكاء الاصطناعي المبادرة إلى خطة تنفيذية' : 'تُعاد صياغة الجزء المختار'}… {elapsed} ث</span>
            <button type="button" className="in-link" onClick={() => abortRef.current && abortRef.current.abort()}>إلغاء</button>
          </div>
        )}

        {!data ? <div className="in-empty">جارٍ التحميل…</div> : (
          <>
            {/* -------------------------------------------- مبادرة مفتوحة */}
            {opened && <InitiativeDetail item={opened} fav={isFav(opened.id)} onFav={toggleFav} onBack={() => setOpenId(null)} onAdopt={adopt} onDevelop={develop} aiReady={server.ai} busy={busy}
              list={opened.source === 'ai' ? D.aiIdeas : (space === 'saved' ? allIdeas.filter((i) => D.favs.includes(i.id)) : (filtered.length ? filtered : library))} onOpen={openIdea} />}

            {/* -------------------------------------------- مساحة العمل */}
            {!opened && project && <Workspace key={project.id} project={project} tab={wsTab} setTab={setWsTab} onChange={saveProject} onDelete={() => deleteProject(project.id)} onDuplicate={() => duplicate(project)}
              aiReady={server.ai} busy={busy} onRegen={regen} onDevelop={developProject} onExport={doExport} notify={flash} />}

            {/* -------------------------------------------- استكشاف */}
            {!opened && !project && space === 'explore' && (
              <>
                <section className="in-panel in-filters-panel">
                  <div className="in-search"><Icon d="search" /><input type="search" value={filters.q} onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))} placeholder="ابحث: القراءة، الطلبة، أولياء الأمور، بلا تكلفة…" aria-label="بحث في المبادرات" /></div>
                  <div className="in-domains" role="group" aria-label="المجالات">
                    <button type="button" className={`in-domain ${!filters.domain ? 'is-on' : ''}`} onClick={() => setFilters((f) => ({ ...f, domain: '' }))} aria-pressed={!filters.domain}><span className="in-dicon" style={{ '--c': '#78350F' }}><Icon d="layers" /></span><span>الكل</span><small>{library.length}</small></button>
                    {DOMAINS.map((d) => (
                      <button key={d.id} type="button" className={`in-domain ${filters.domain === d.id ? 'is-on' : ''}`} onClick={() => setFilters((f) => ({ ...f, domain: f.domain === d.id ? '' : d.id }))} aria-pressed={filters.domain === d.id}>
                        <DomainIcon id={d.id} /><span>{d.label}</span><small>{counts[d.id] || 0}</small>
                      </button>
                    ))}
                  </div>
                  <div className="in-filters">
                    <Select label="من يقودها" value={filters.lead} onChange={(v) => setFilters((f) => ({ ...f, lead: v }))} options={LEADS} />
                    <Select label="الموارد المطلوبة" value={filters.cost} onChange={(v) => setFilters((f) => ({ ...f, cost: v }))} options={COSTS} />
                    <Select label="الحجم" value={filters.size} onChange={(v) => setFilters((f) => ({ ...f, size: v }))} options={SIZES} />
                    <Select label="المرحلة" value={filters.stage} onChange={(v) => setFilters((f) => ({ ...f, stage: v }))} options={STAGES} />
                    <Select label="المدة" value={filters.duration} onChange={(v) => setFilters((f) => ({ ...f, duration: v }))} options={DURATIONS} />
                    {hasFilters && <button type="button" className="in-link" onClick={() => setFilters({ ...EMPTY_FILTERS })}>مسح الفلاتر</button>}
                  </div>
                </section>
                {!hasFilters && (
                  <section className="in-section"><div className="in-section-head"><h2><Icon d={EXTRA.star} /> مبادرات مميزة</h2></div>
                    <div className="in-grid is-featured">{library.filter((i) => i.featured).map((i) => <InitiativeCard key={i.id} item={i} onOpen={openIdea} fav={isFav(i.id)} onFav={toggleFav} big />)}</div></section>
                )}
                <section className="in-section">
                  <div className="in-section-head"><h2><Icon d="book" /> {hasFilters ? `نتائج التصفية (${filtered.length})` : `كل المبادرات (${library.length})`}</h2></div>
                  {filtered.length ? <div className="in-grid">{filtered.map((i) => <InitiativeCard key={i.id} item={i} onOpen={openIdea} fav={isFav(i.id)} onFav={toggleFav} />)}</div>
                    : <div className="in-empty">لا توجد مبادرات تطابق هذه الفلاتر. خففها، أو <button type="button" className="in-link" onClick={() => goSpace('create')}>ابتكر مبادرة جديدة</button>.</div>}
                </section>
              </>
            )}

            {/* -------------------------------------------- ابتكر */}
            {!opened && !project && space === 'create' && (
              <>
                <section className="in-panel in-create">
                  <h2><Icon d="wand" /> ابتكر لي مبادرة</h2>
                  {server.ai === false ? (
                    <div className="in-off"><Icon d="info" /> الابتكار بالذكاء الاصطناعي غير مفعّل على الخادم حاليًا. يمكنك استكشاف {library.length} مبادرة جاهزة، أو إنشاء مبادرتك يدويًا.
                      <div className="in-toolbar"><button type="button" className="in-secondary" onClick={() => goSpace('explore')}>استكشاف المكتبة</button>
                        <button type="button" className="in-secondary" onClick={() => adopt(normalizeInitiative({ title: 'مبادرتي الجديدة', summary: '', phases: [] }, 'mine'))}><Icon d="plus" /> إنشاء مبادرة يدويًا</button></div></div>
                  ) : (
                    <form onSubmit={(e) => { e.preventDefault(); if (req.trim() || Object.values(opts).some(Boolean)) generate(req.trim()); else flash('err', 'اكتب احتياجك أو اختر خيارًا واحدًا على الأقل.'); }}>
                      <textarea className="in-input in-ask" rows={2} maxLength={400} value={req} onChange={(e) => setReq(e.target.value)} placeholder="صف احتياجك… مثال: أريد مبادرة لتحسين القراءة لدى طلبة الصف الخامس" aria-label="وصف المبادرة المطلوبة" />
                      <div className="in-examples">{EXAMPLES.map((x) => <button key={x} type="button" className="in-chip is-soft" onClick={() => setReq(x)}>{x}</button>)}</div>
                      <details className="in-more">
                        <summary>خيارات إضافية (اختيارية)</summary>
                        <div className="in-filters">
                          <Select label="المجال" value={opts.domain} onChange={(v) => setOpts((o) => ({ ...o, domain: v }))} options={DOMAINS} all="أي مجال" />
                          <Select label="المرحلة الدراسية" value={opts.stage} onChange={(v) => setOpts((o) => ({ ...o, stage: v }))} options={STAGES} all="أي مرحلة" />
                          <Select label="الحجم" value={opts.size} onChange={(v) => setOpts((o) => ({ ...o, size: v }))} options={SIZES} all="أي حجم" />
                          <Select label="الإمكانات المتاحة" value={opts.cost} onChange={(v) => setOpts((o) => ({ ...o, cost: v }))} options={COSTS} all="غير محدد" />
                          <Select label="طبيعة المبادرة" value={opts.nature} onChange={(v) => setOpts((o) => ({ ...o, nature: v }))} options={NATURES} all="غير محدد" />
                          <label className="in-select"><span>مدة التنفيذ (أسابيع)</span><input type="number" min={0} max={40} value={opts.weeks || ''} onChange={(e) => setOpts((o) => ({ ...o, weeks: Math.max(0, Math.min(40, Number(e.target.value) || 0)) }))} placeholder="غير محدد" /></label>
                          <label className="in-select"><span>عدد المشاركين التقريبي</span><input type="number" min={0} max={5000} value={opts.participants || ''} onChange={(e) => setOpts((o) => ({ ...o, participants: Math.max(0, Number(e.target.value) || 0) }))} placeholder="غير محدد" /></label>
                          <label className="in-select"><span>الفئة المستهدفة</span><input value={opts.audience} maxLength={120} onChange={(e) => setOpts((o) => ({ ...o, audience: e.target.value }))} placeholder="مثل: طلبة الصف الخامس" /></label>
                        </div>
                      </details>
                      <button type="submit" className="in-primary is-big" disabled={!!busy || server.ai === null}>{busy === 'ideas' ? <span className="in-spin" /> : <Icon d="wand" />} ابتكر 3 مبادرات مختلفة</button>
                      <p className="in-fine">الأفكار المولّدة مختلفة في آلية تنفيذها، ولا تكرر مبادرات المكتبة أو ما وُلّد سابقًا. وتظهر دائمًا بشارة «ذكاء اصطناعي» لتراجعها قبل الاعتماد.</p>
                    </form>
                  )}
                </section>
                {D.aiIdeas.length > 0 && (
                  <section className="in-section">
                    <div className="in-section-head"><h2><Icon d="spark" /> الأفكار المبتكرة لك</h2><button type="button" className="in-link" onClick={() => change(() => ({ aiIdeas: [] }))}>مسح القائمة</button></div>
                    <div className="in-grid">{D.aiIdeas.map((i) => <InitiativeCard key={i.id} item={i} onOpen={openIdea} fav={isFav(i.id)} onFav={toggleFav} />)}</div>
                  </section>
                )}
              </>
            )}

            {/* -------------------------------------------- المحفوظة */}
            {!opened && !project && space === 'saved' && (
              <section className="in-section">
                <div className="in-section-head"><h2><Icon d="heart" /> المبادرات المحفوظة</h2></div>
                {allIdeas.filter((i) => D.favs.includes(i.id)).length
                  ? <div className="in-grid">{allIdeas.filter((i) => D.favs.includes(i.id)).map((i) => <InitiativeCard key={i.id} item={i} onOpen={openIdea} fav onFav={toggleFav} />)}</div>
                  : <div className="in-empty">اضغط ♡ على أي مبادرة لتحفظها هنا وتعود إليها لاحقًا.</div>}
              </section>
            )}

            {/* -------------------------------------------- مبادراتي */}
            {!opened && !project && space === 'projects' && (
              <section className="in-section">
                <div className="in-section-head">
                  <h2><Icon d={EXTRA.rocket} /> مبادراتي</h2>
                  {server.sync && (
                    <label className="in-sync">
                      <input type="checkbox" checked={!!D.sync} onChange={(e) => { const on = e.target.checked; change(() => ({ sync: on })); if (on) { pulled.current = true; setTimeout(() => doSync('both'), 0); } }} />
                      <span><Icon d={EXTRA.sync} size={15} /> مزامنة مع حسابي</span>
                      {D.sync && <small>{syncState === 'syncing' ? 'جارٍ المزامنة…' : syncState === 'err' ? 'تعذرت المزامنة' : D.syncedAt ? `آخر مزامنة ${new Date(D.syncedAt).toLocaleTimeString('ar-OM-u-nu-latn', { hour: '2-digit', minute: '2-digit' })}` : ''}</small>}
                    </label>
                  )}
                </div>
                <div className="in-status-tabs" role="group" aria-label="تصفية حسب الحالة">
                  <button type="button" className={!statusFilter ? 'is-on' : ''} onClick={() => setStatusFilter('')}>الكل <b>{D.projects.length}</b></button>
                  {STATUSES.map((s) => <button key={s.id} type="button" className={statusFilter === s.id ? 'is-on' : ''} style={{ '--s': s.color }} onClick={() => setStatusFilter(s.id)}>{s.label} <b>{D.projects.filter((p) => p.status === s.id).length}</b></button>)}
                </div>
                {D.projects.filter((p) => !statusFilter || p.status === statusFilter).length ? (
                  <div className="in-projects">{D.projects.filter((p) => !statusFilter || p.status === statusFilter).map((p) => {
                    const g = progressOf(p);
                    return (
                      <button key={p.id} type="button" className="in-project" style={{ '--c': (DOMAIN[p.plan.domain] || {}).color }} onClick={() => openProject(p.id, p.status === 'active' ? 'track' : 'plan')}>
                        <span className="in-project-top"><DomainIcon id={p.plan.domain} /><StatusPill status={p.status} /></span>
                        <strong>{p.plan.title}</strong>
                        <span className="in-project-meta">{p.meta.school || label(LEADS, p.plan.lead)} · آخر تعديل {new Date(p.updatedAt).toLocaleDateString('ar-OM-u-nu-latn', { day: 'numeric', month: 'short' })}</span>
                        {g.total > 0 && <span className="in-project-progress"><Progress pct={g.pct} /> {g.done}/{g.total}</span>}
                      </button>
                    );
                  })}</div>
                ) : <div className="in-empty">{statusFilter ? 'لا توجد مبادرات بهذه الحالة.' : 'لم تضف أي مبادرة بعد. افتح مبادرة من المكتبة واضغط «أضفها إلى مبادراتي»، أو ابتكر واحدة جديدة.'}</div>}
                <p className="in-fine">تُحفظ مبادراتك على هذا الجهاز تلقائيًا{server.sync ? '، ويمكنك تفعيل المزامنة لتجدها على أجهزتك الأخرى (بلا الصور والشعارات).' : '.'}</p>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
