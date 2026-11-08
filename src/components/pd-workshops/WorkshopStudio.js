'use client';
// مشاغل الإنماء المهني — مساعد لصناعة برامج الإنماء المهني: من الفكرة التربوية إلى مادة تدريبية جاهزة.
// المكتبة والمؤلف المحلي يعملان دائمًا؛ الذكاء الاصطناعي (عبر الخادم فقط) يضيف أفكارًا جديدة وصياغة أغنى.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { auth } from '@/lib/firebase';
import { DOMAINS, DOMAIN, SPECS, AUDIENCES, DURATION_BANDS, FORMATS, LEVELS, DEPTHS, STYLES, STAGES, DURATIONS, label, bandOf } from '@/lib/pd-workshops/taxonomy';
import { libraryIdeas, filterIdeas, sortIdeas, randomIdea, facetCounts, EMPTY_FILTERS } from '@/lib/pd-workshops/library';
import { composeWorkshop, retime } from '@/lib/pd-workshops/compose';
import { normalizeIdea, normalizeWorkshop, normalizeSettings, agendaOf, totalMinutes, ordinal, DEFAULT_SETTINGS } from '@/lib/pd-workshops/schema';
import { ls, api, ApiError, downloadBlob, printHTML, copyRich, safeFileName } from '@/lib/pd-workshops/browser';
import { Icon } from './icons';
import WorkshopEditor from './WorkshopEditor';
import './pd-workshops.css';

const K = { favs: 'mt-pd:favorites', history: 'mt-pd:history', settings: 'mt-pd:settings', recent: 'mt-pd:recent', ai: 'mt-pd:ai-ideas' };
const HISTORY_MAX = 30;

const MSG = {
  unauthenticated: 'انتهت جلسة الدخول. سجّل الدخول من جديد ثم أعد المحاولة.',
  forbidden: 'التوليد بالذكاء الاصطناعي متاح للمشتركين فقط.',
  origin: 'تعذّر التحقق من مصدر الطلب. افتح الأداة من داخل المنصة.',
  'ai-not-configured': 'التوليد بالذكاء الاصطناعي غير مفعّل على الخادم بعد. المكتبة والإعداد السريع متاحان كاملين.',
  'rate-limited': 'طلبات كثيرة خلال وقت قصير. انتظر دقيقة ثم أعد المحاولة.',
  'ai-rate-limited': 'خدمة الذكاء الاصطناعي مشغولة الآن. أعد المحاولة بعد قليل، أو استخدم الإعداد السريع من المكتبة.',
  'ai-timeout': 'استغرق الذكاء الاصطناعي وقتًا أطول من المعتاد. أعد المحاولة.',
  'ai-bad-output': 'جاءت نتيجة الذكاء الاصطناعي غير مكتملة. أعد المحاولة.',
  'ai-empty': 'لم يأتِ الذكاء الاصطناعي بأفكار جديدة غير مكررة هذه المرة. أعد المحاولة أو غيّر الطلب.',
  'ai-blocked': 'رفض النموذج هذا الطلب. أعد صياغته.',
  'ai-auth': 'مفتاح خدمة الذكاء الاصطناعي على الخادم غير صالح. أبلغ مسؤول المنصة.',
  'server-not-configured': 'الخادم غير مهيأ بعد. أبلغ مسؤول المنصة.',
  network: 'تعذّر الاتصال بالخادم. تحقّق من الإنترنت ثم أعد المحاولة.',
  'too-large': 'المشغل أكبر من الحد المسموح لإعادة التوليد.',
};
const msgOf = (e) => MSG[e && e.code] || MSG[e && e.code && e.code.replace(/^ai-/, '')] || 'حدث خطأ غير متوقع. أعد المحاولة.';

const getToken = async () => { const u = auth && auth.currentUser; return u ? u.getIdToken() : null; };
const SURPRISE_PROMPTS = [
  'فكرة غير تقليدية يمكن تنفيذها في اجتماع المعلمين الأسبوعي خلال 20 دقيقة',
  'مشغل مبتكر يخرج منه المعلمون بمنتج يستخدمونه غدًا في صفوفهم',
  'برنامج قصير يجمع معلمي مواد مختلفة حول تحدٍّ مشترك يواجهونه مع الطلبة',
  'مشغل يقلب الأدوار: الطلبة مصدر لتعلم المعلمين',
  'تجربة تدريبية قائمة على اللعب للمعلمين أنفسهم',
];
const EXAMPLES = [
  'مشغل مبتكر عن الذكاء الاصطناعي في التعليم',
  'مشغل عملي لمعلمي الحلقة الأولى',
  'برنامج لتبادل الخبرات بين معلمي المواد المختلفة',
  'مشغل قصير 20 دقيقة عن التقويم التكويني',
  'مشغل يساعد المعلمين على إنتاج موارد تعليمية رقمية',
];

const fmtMin = (n) => (n === 1 ? 'دقيقة' : n === 2 ? 'دقيقتان' : n <= 10 ? `${n} دقائق` : `${n} دقيقة`);
const srcLabel = { library: 'من مكتبة MusiTeacher', ai: 'مقترح بالذكاء الاصطناعي', mixed: 'مكتبة + ذكاء اصطناعي' };

function useElapsed(active) {
  const [s, setS] = useState(0);
  useEffect(() => {
    if (!active) { setS(0); return undefined; }
    const t0 = Date.now(); const id = setInterval(() => setS(Math.floor((Date.now() - t0) / 1000)), 500);
    return () => clearInterval(id);
  }, [active]);
  return s;
}

// ======================================================================================
export default function WorkshopStudio() {
  const library = useMemo(() => libraryIdeas(), []);
  const counts = useMemo(() => facetCounts(library), [library]);
  const [view, setView] = useState('explore');           // explore | idea | workshop | mine
  const [filters, setFilters] = useState({ ...EMPTY_FILTERS });
  const [ideaId, setIdeaId] = useState(null);
  const [aiIdeas, setAiIdeas] = useState([]);
  const [settings, setSettings] = useState({ ...DEFAULT_SETTINGS });
  const [workshop, setWorkshop] = useState(null);
  const [editing, setEditing] = useState(false);
  const [favs, setFavs] = useState([]);
  const [history, setHistory] = useState([]);
  const [aiReady, setAiReady] = useState(null);           // null = جارٍ التحقق
  const [busy, setBusy] = useState('');                   // ideas | surprise | build | section:<key> | export:<kind>
  const [notice, setNotice] = useState(null);             // {type:'ok'|'err'|'info', text}
  const [askText, setAskText] = useState('');
  const abortRef = useRef(null);
  const elapsed = useElapsed(!!busy && !busy.startsWith('export'));

  // ---------- التحميل الأول
  useEffect(() => {
    setFavs(ls.get(K.favs, []));
    setHistory(ls.get(K.history, []).map(normalizeWorkshop));
    setAiIdeas(ls.get(K.ai, []).map((i) => normalizeIdea(i, 'ai')).filter(Boolean));
    const s = ls.get(K.settings, null);
    if (s) setSettings((d) => ({ ...d, ...normalizeSettings({ ...d, ...s }) }));
    let alive = true;
    api('/api/pd-workshops/status').then((d) => { if (alive) setAiReady(!!d.ai); }).catch(() => { if (alive) setAiReady(false); });
    return () => { alive = false; };
  }, []);

  // كل انتقال بين الشاشات يبدأ من أعلى الصفحة
  const wsId = workshop && workshop.id;
  useEffect(() => { try { window.scrollTo({ top: 0, behavior: 'auto' }); } catch { /* */ } }, [view, ideaId, wsId, editing]);

  const allIdeas = useMemo(() => [...aiIdeas, ...library], [aiIdeas, library]);
  const idea = useMemo(() => allIdeas.find((i) => i.id === ideaId) || null, [allIdeas, ideaId]);
  const filtered = useMemo(() => sortIdeas(filterIdeas(library, filters), filters), [library, filters]);
  const hasFilters = Object.values(filters).some(Boolean);

  const flash = useCallback((type, text) => { setNotice({ type, text }); if (type !== 'err') setTimeout(() => setNotice((n) => (n && n.text === text ? null : n)), 3500); }, []);

  // ---------- التنقل
  const openIdea = useCallback((id) => {
    setIdeaId(id); setView('idea'); setNotice(null);
    const i = allIdeas.find((x) => x.id === id);
    if (i) setSettings((s) => ({ ...s, duration: i.duration }));
  }, [allIdeas]);
  const pickRandom = () => {
    const pool = filtered.length ? filtered : library;
    const recent = ls.get(K.recent, []);
    const i = randomIdea(pool, recent);
    if (!i) return;
    ls.set(K.recent, [i.id, ...recent.filter((x) => x !== i.id)].slice(0, Math.min(15, pool.length - 1)));
    openIdea(i.id);
  };

  // ---------- المفضلة والسجل
  const isFav = (id) => favs.includes(id);
  const toggleFav = (id) => {
    setFavs((f) => { const n = f.includes(id) ? f.filter((x) => x !== id) : [id, ...f]; ls.set(K.favs, n); return n; });
  };
  const saveHistory = useCallback((w) => {
    setHistory((h) => {
      const n = [normalizeWorkshop({ ...w, updatedAt: new Date().toISOString() }), ...h.filter((x) => x.id !== w.id)].slice(0, HISTORY_MAX);
      if (!ls.set(K.history, n)) ls.set(K.history, n.slice(0, 10));
      return n;
    });
  }, []);
  const removeHistory = (id) => setHistory((h) => { const n = h.filter((x) => x.id !== id); ls.set(K.history, n); return n; });
  const persistAiIdeas = (list) => { setAiIdeas(list); ls.set(K.ai, list.slice(0, 24)); };

  // ---------- الذكاء الاصطناعي
  const cancel = () => { if (abortRef.current) abortRef.current.abort(); };
  const run = async (kind, fn) => {
    if (busy) return;
    const ctrl = new AbortController(); abortRef.current = ctrl;
    setBusy(kind); setNotice(null);
    try { await fn(ctrl.signal); }
    catch (e) {
      if (e instanceof ApiError && e.code === 'aborted') flash('info', 'أُلغي الطلب.');
      else { if (e && e.code === 'ai-not-configured') setAiReady(false); flash('err', msgOf(e)); }
    } finally { setBusy(''); abortRef.current = null; }
  };

  const generateIdeas = (topic, { surprise = false } = {}) => run(surprise ? 'surprise' : 'ideas', async (signal) => {
    const exclude = [...aiIdeas.map((i) => i.title)];
    const d = await api('/api/pd-workshops/ideas', {
      getToken, signal,
      body: { topic: topic || '', surprise, count: surprise ? 1 : 3, exclude, filters: { domain: filters.domain, spec: filters.spec, audience: filters.audience, format: filters.format, level: filters.level } },
    });
    const fresh = (d.ideas || []).map((i) => normalizeIdea(i, 'ai')).filter(Boolean);
    persistAiIdeas([...fresh, ...aiIdeas]);
    if (surprise && fresh[0]) openIdea(fresh[0].id);
    else flash('ok', `أُضيفت ${fresh.length === 1 ? 'فكرة جديدة' : `${fresh.length} أفكار جديدة`} في أعلى المكتبة.`);
  });

  const surprise = () => {
    if (aiReady) return generateIdeas(SURPRISE_PROMPTS[Math.floor(Math.random() * SURPRISE_PROMPTS.length)], { surprise: true });
    // بلا ذكاء اصطناعي: فكرة غير مألوفة من المكتبة (مجال لم يُفتح مؤخرًا)
    const recent = ls.get(K.recent, []);
    const seenDomains = new Set(recent.map((id) => (library.find((i) => i.id === id) || {}).domain));
    const pool = library.filter((i) => !seenDomains.has(i.domain));
    const i = randomIdea(pool.length ? pool : library, recent);
    if (i) { ls.set(K.recent, [i.id, ...recent].slice(0, 15)); openIdea(i.id); flash('info', 'فكرة مختارة من مجال لم تستكشفه بعد.'); }
    return undefined;
  };

  // ---------- إعداد المشغل
  const startWorkshop = (w) => { setWorkshop(w); setEditing(false); setView('workshop'); saveHistory(w); };
  const buildQuick = () => {
    if (!idea) return;
    ls.set(K.settings, settings);
    startWorkshop(composeWorkshop(idea, settings));
  };
  const buildAI = () => run('build', async (signal) => {
    ls.set(K.settings, settings);
    const d = await api('/api/pd-workshops/build', { getToken, signal, body: { idea, settings } });
    startWorkshop(normalizeWorkshop(d.workshop));
    flash('ok', 'المشغل جاهز. راجعه وعدّل ما تريد قبل التصدير.');
  });
  const regenerate = (section, instruction) => run(`section:${section}`, async (signal) => {
    const d = await api('/api/pd-workshops/section', { getToken, signal, body: { workshop, section, instruction } });
    const w = normalizeWorkshop(d.workshop);
    setWorkshop(w); saveHistory(w);
    flash('ok', 'تمت إعادة صياغة هذا الجزء.');
  });
  const updateWorkshop = (w) => { const n = normalizeWorkshop(w); setWorkshop(n); saveHistory(n); };

  // ---------- التصدير
  const doExport = async (kind) => {
    if (!workshop || busy) return;
    setBusy(`export:${kind}`);
    try {
      const w = workshop;
      const base = safeFileName(w.title);
      if (kind === 'pptx') {
        const { buildPptx } = await import('@/lib/pd-workshops/export-pptx');
        downloadBlob(await buildPptx(w), `مشغل - ${base}.pptx`, 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
        flash('ok', 'نُزّل العرض التقديمي. ملاحظات الميسّر موجودة أسفل كل شريحة.');
      } else if (kind === 'docx') {
        const { buildKitDocx } = await import('@/lib/pd-workshops/export-docx');
        downloadBlob(await buildKitDocx(w), `حقيبة تدريبية - ${base}.docx`, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        flash('ok', 'نُزّلت الحقيبة التدريبية بصيغة Word قابلة للتعديل.');
      } else {
        const T = await import('@/lib/pd-workshops/export-text');
        if (kind === 'copy') {
          const ok = await copyRich(T.workshopToText(w), T.workshopToHTMLFragment(w));
          flash(ok ? 'ok' : 'err', ok ? 'نُسخ المشغل كاملًا. الصقه في Word أو البريد أو واتساب.' : 'تعذّر النسخ تلقائيًا في هذا المتصفح.');
        } else if (kind === 'print') await printHTML(T.printableHTML(w));
        else if (kind === 'kit') await printHTML(T.kitHTML(w));
        else if (kind === 'invite') await printHTML(T.inviteHTML(w));
        else if (kind === 'txt') downloadBlob(T.workshopToText(w), `${base}.txt`, 'text/plain;charset=utf-8');
      }
    } catch (e) {
      console.error(e);
      flash('err', 'تعذّر إنشاء الملف. أعد المحاولة.');
    } finally { setBusy(''); }
  };

  // ======================================================================================
  return (
    <div className="pd-root" dir="rtl">
      <div className="pd-shell">
        <div className="pd-topbar">
          <Link href="/dashboard/tools" className="pd-back"><Icon d="back" size={16} /> الأدوات</Link>
          {view !== 'explore' && <button type="button" className="pd-back" onClick={() => { setView('explore'); setEditing(false); }}><Icon d="grid" size={16} /> مكتبة الأفكار</button>}
          <button type="button" className={`pd-back ${view === 'mine' ? 'is-on' : ''}`} onClick={() => { setView('mine'); setEditing(false); }}>
            <Icon d="history" size={16} /> مشاغلي{history.length ? <span className="pd-count">{history.length}</span> : null}
          </button>
        </div>

        <header className={`pd-hero ${view === 'explore' ? '' : 'is-compact'}`}>
          <div className="pd-hero-text">
            <span className="pd-kicker"><Icon d="spark" size={15} /> مساعد ذكي لصناعة برامج الإنماء المهني</span>
            <h1>مشاغل الإنماء المهني</h1>
            <p>عروض تقديمية وحقائب تدريبية جاهزة لبرامج الإنماء المهني — ابدأ من فكرة تربوية ملهمة، وانتهِ بمادة تدريبية تقدّمها لزملائك.</p>
          </div>
          <div className="pd-hero-actions">
            <button type="button" className="pd-hero-btn" onClick={pickRandom}><Icon d="dice" size={20} /> اقترح لي فكرة عشوائية</button>
            <button type="button" className="pd-hero-btn is-gold" onClick={surprise} disabled={!!busy}>
              {busy === 'surprise' ? <span className="pd-spin" /> : <Icon d="wand" size={20} />} فاجئني بفكرة تدريبية
            </button>
          </div>
        </header>

        {notice && (
          <div className={`pd-notice is-${notice.type}`} role={notice.type === 'err' ? 'alert' : 'status'}>
            <Icon d={notice.type === 'err' ? 'info' : 'check'} /> <span>{notice.text}</span>
            <button type="button" className="pd-x" onClick={() => setNotice(null)} aria-label="إغلاق"><Icon d="x" size={16} /></button>
          </div>
        )}
        {busy && !busy.startsWith('export') && (
          <div className="pd-working" role="status" aria-live="polite">
            <span className="pd-spin" />
            <span>{busy === 'build' ? 'يعدّ الذكاء الاصطناعي المشغل كاملًا' : busy.startsWith('section') ? 'تُعاد صياغة الجزء المختار' : 'يبتكر الذكاء الاصطناعي أفكارًا جديدة'}… {elapsed} ث</span>
            <button type="button" className="pd-link" onClick={cancel}>إلغاء</button>
          </div>
        )}

        {view === 'explore' && (
          <Explore {...{ library, filtered, counts, filters, setFilters, hasFilters, aiIdeas, aiReady, askText, setAskText, busy, generateIdeas, openIdea, isFav, toggleFav,
            clearAi: () => persistAiIdeas([]) }} />
        )}
        {view === 'idea' && idea && (
          <IdeaView {...{ idea, settings, setSettings, aiReady, busy, buildQuick, buildAI, isFav, toggleFav, openIdea, list: idea.source === 'ai' ? aiIdeas : (filtered.length ? filtered : library) }} />
        )}
        {view === 'workshop' && workshop && (
          editing
            ? <WorkshopEditor workshop={workshop} onCancel={() => setEditing(false)} onSave={(w) => { updateWorkshop(w); setEditing(false); flash('ok', 'حُفظت التعديلات.'); }} />
            : <WorkshopView {...{ workshop, aiReady, busy, regenerate, doExport, setEditing, updateWorkshop }} />
        )}
        {view === 'mine' && (
          <Mine {...{ history, favs, allIdeas, openIdea, removeHistory, toggleFav,
            openWorkshop: (w) => { setWorkshop(normalizeWorkshop(w)); setEditing(false); setView('workshop'); } }} />
        )}
      </div>
    </div>
  );
}

// ====================================================================================== الاستكشاف
function Explore({ library, filtered, counts, filters, setFilters, hasFilters, aiIdeas, aiReady, askText, setAskText, busy, generateIdeas, openIdea, isFav, toggleFav, clearAi }) {
  const set = (k, v) => setFilters((f) => ({ ...f, [k]: f[k] === v ? '' : v }));
  const featured = library.filter((i) => i.featured);
  const showAi = aiIdeas.length > 0 && !hasFilters;
  return (
    <>
      <section className={`pd-panel pd-ask ${aiReady === false ? 'is-off' : ''}`} aria-labelledby="pd-ask-h">
        <div className="pd-ask-head">
          <h2 id="pd-ask-h"><Icon d="spark" /> اطلب فكرة جديدة</h2>
          {aiReady === false && <span className="pd-tag is-muted">التوليد الذكي غير مفعّل على الخادم — المكتبة متاحة كاملة</span>}
        </div>
        {aiReady !== false && <>
        <form className="pd-ask-row" onSubmit={(e) => { e.preventDefault(); if (aiReady) generateIdeas(askText.trim()); }}>
          <input className="pd-input" value={askText} onChange={(e) => setAskText(e.target.value)} maxLength={300}
            placeholder="مثال: أريد مشغلًا قصيرًا مدته 20 دقيقة عن التقويم التكويني" aria-label="وصف الفكرة المطلوبة" disabled={!aiReady} />
          <button type="submit" className="pd-primary" disabled={!aiReady || !!busy}>{busy === 'ideas' ? <span className="pd-spin" /> : <Icon d="wand" />} ابتكر أفكارًا</button>
        </form>
        <div className="pd-examples">
          {EXAMPLES.map((x) => <button key={x} type="button" className="pd-chip is-soft" disabled={!aiReady || !!busy} onClick={() => { setAskText(x); generateIdeas(x); }}>{x}</button>)}
        </div>
        <p className="pd-fine">تُبنى الأفكار المولّدة على المجال والتخصص والفئة المختارة في الفلاتر أدناه، ولا تكرر أفكار المكتبة. تُعلَّم دائمًا بعبارة «مقترح بالذكاء الاصطناعي» لتراجعها قبل الاستخدام.</p>
        </>}
      </section>

      <section className="pd-panel">
        <div className="pd-search">
          <Icon d="search" />
          <input type="search" value={filters.q} onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))} placeholder="ابحث عن موضوع أو استراتيجية… (مثل: التقويم، الألعاب، الإيقاع)" aria-label="بحث في الأفكار" />
        </div>
        <div className="pd-domains" role="group" aria-label="المجالات">
          <button type="button" className={`pd-domain ${!filters.domain ? 'is-on' : ''}`} onClick={() => setFilters((f) => ({ ...f, domain: '' }))}>
            <span className="pd-dicon" style={{ '--c': '#334155' }}><Icon d="layers" /></span><span>كل المجالات</span><small>{library.length}</small>
          </button>
          {DOMAINS.map((d) => (
            <button key={d.id} type="button" className={`pd-domain ${filters.domain === d.id ? 'is-on' : ''}`} onClick={() => set('domain', d.id)} aria-pressed={filters.domain === d.id}>
              <span className="pd-dicon" style={{ '--c': d.color }}><Icon d={d.icon} /></span><span>{d.label}</span><small>{counts[d.id] || 0}</small>
            </button>
          ))}
        </div>
        <div className="pd-filters">
          <Select label="التخصص" value={filters.spec} onChange={(v) => setFilters((f) => ({ ...f, spec: v }))} options={SPECS.filter((s) => s.id !== 'all')} />
          <Select label="الفئة المستهدفة" value={filters.audience} onChange={(v) => setFilters((f) => ({ ...f, audience: v }))} options={AUDIENCES.filter((s) => s.id !== 'all')} />
          <Select label="المدة" value={filters.band} onChange={(v) => setFilters((f) => ({ ...f, band: v }))} options={DURATION_BANDS} />
          <Select label="طبيعة المشغل" value={filters.format} onChange={(v) => setFilters((f) => ({ ...f, format: v }))} options={FORMATS} />
          <Select label="المستوى" value={filters.level} onChange={(v) => setFilters((f) => ({ ...f, level: v }))} options={LEVELS} />
          {hasFilters && <button type="button" className="pd-link" onClick={() => setFilters({ ...EMPTY_FILTERS })}>مسح الفلاتر</button>}
        </div>
      </section>

      {showAi && (
        <section className="pd-section">
          <div className="pd-section-head"><h2><Icon d="wand" /> أفكار مبتكرة لك</h2><button type="button" className="pd-link" onClick={clearAi}>مسح الأفكار المولّدة</button></div>
          <div className="pd-grid">{aiIdeas.map((i) => <IdeaCard key={i.id} idea={i} onOpen={openIdea} fav={isFav(i.id)} onFav={toggleFav} />)}</div>
        </section>
      )}

      {!hasFilters && (
        <section className="pd-section">
          <div className="pd-section-head"><h2><Icon d="flag" /> مشاغل مميزة</h2></div>
          <div className="pd-grid is-featured">{featured.map((i) => <IdeaCard key={i.id} idea={i} onOpen={openIdea} fav={isFav(i.id)} onFav={toggleFav} big />)}</div>
        </section>
      )}

      <section className="pd-section">
        <div className="pd-section-head"><h2><Icon d="book" /> {hasFilters ? `نتائج التصفية (${filtered.length})` : `كل الأفكار (${library.length})`}</h2></div>
        {filtered.length
          ? <div className="pd-grid">{filtered.map((i) => <IdeaCard key={i.id} idea={i} onOpen={openIdea} fav={isFav(i.id)} onFav={toggleFav} />)}</div>
          : <div className="pd-empty">لا توجد أفكار تطابق هذه الفلاتر. خفف التصفية{aiReady ? '، أو اطلب فكرة جديدة من الذكاء الاصطناعي بالأعلى' : ''}.</div>}
      </section>
    </>
  );
}

function Select({ label: lab, value, onChange, options }) {
  return (
    <label className="pd-select">
      <span>{lab}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">الكل</option>
        {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
      </select>
    </label>
  );
}

function IdeaCard({ idea, onOpen, fav, onFav, big }) {
  const d = DOMAIN[idea.domain] || {};
  return (
    <article className={`pd-card ${big ? 'is-big' : ''}`} style={{ '--c': d.color }}>
      <button type="button" className="pd-card-main" onClick={() => onOpen(idea.id)}>
        <span className="pd-card-top">
          <span className="pd-dicon" style={{ '--c': d.color }}><Icon d={d.icon} /></span>
          <span className="pd-card-domain">{d.label}</span>
        </span>
        <span className="pd-card-title">{idea.title}</span>
        {idea.tag && <span className="pd-card-tag">{idea.tag}</span>}
        <span className="pd-meta">
          <span><Icon d="clock" size={14} /> {fmtMin(idea.duration)}</span>
          <span>{label(FORMATS, idea.format)}</span>
          <span>{label(LEVELS, idea.level)}</span>
          {idea.source === 'ai' && <span className="pd-ai-badge"><Icon d="spark" size={13} /> ذكاء اصطناعي</span>}
        </span>
      </button>
      <button type="button" className={`pd-fav ${fav ? 'is-on' : ''}`} onClick={() => onFav(idea.id)} aria-pressed={fav} aria-label={fav ? 'إزالة من المفضلة' : 'إضافة إلى المفضلة'}>
        <Icon d="heart" fill={fav ? 'currentColor' : 'none'} />
      </button>
    </article>
  );
}

// ====================================================================================== بطاقة الفكرة
function IdeaView({ idea, settings, setSettings, aiReady, busy, buildQuick, buildAI, isFav, toggleFav, openIdea, list }) {
  const d = DOMAIN[idea.domain] || {};
  const idx = list.findIndex((i) => i.id === idea.id);
  const step = (n) => { if (list.length < 2) return; const j = ((idx < 0 ? 0 : idx) + n + list.length) % list.length; openIdea(list[j].id); };
  const aud = idea.audience.map((a) => label(AUDIENCES, a)).join('، ');
  const specs = idea.specs.map((a) => label(SPECS, a)).join('، ');
  return (
    <div className="pd-idea" style={{ '--c': d.color }}>
      <article className="pd-panel pd-idea-card" aria-labelledby="pd-idea-title">
        <div className="pd-idea-nav">
          <button type="button" className="pd-icon" onClick={() => step(-1)} aria-label="الفكرة السابقة"><Icon d="next" /></button>
          <span className="pd-idea-domain"><span className="pd-dicon" style={{ '--c': d.color }}><Icon d={d.icon} /></span>{d.label}</span>
          <button type="button" className="pd-icon" onClick={() => step(1)} aria-label="الفكرة التالية"><Icon d="prev" /></button>
          <button type="button" className={`pd-fav is-inline ${isFav(idea.id) ? 'is-on' : ''}`} onClick={() => toggleFav(idea.id)} aria-pressed={isFav(idea.id)} aria-label="المفضلة"><Icon d="heart" fill={isFav(idea.id) ? 'currentColor' : 'none'} /></button>
        </div>
        <a href="#pd-setup" className="pd-jump"><Icon d="tools" size={16} /> إعداد المشغل التدريبي</a>
        <span className={`pd-source is-${idea.source}`}>{idea.source === 'ai' ? <><Icon d="spark" size={14} /> مقترح بالذكاء الاصطناعي — راجعه قبل الاستخدام</> : <><Icon d="book" size={14} /> من مكتبة MusiTeacher المنتقاة</>}</span>
        <h2 id="pd-idea-title" className="pd-idea-title">{idea.title}</h2>
        {idea.tag && <p className="pd-idea-tag">{idea.tag}</p>}

        <div className="pd-facts">
          <Fact icon="users" k="الفئة المستهدفة" v={aud} />
          <Fact icon="layers" k="التخصصات" v={specs} />
          <Fact icon="clock" k="الزمن المقترح" v={`${fmtMin(idea.duration)} — ${bandOf(idea.duration).label}`} />
          <Fact icon="tools" k="طبيعة المشغل / المستوى" v={`${label(FORMATS, idea.format)} · ${label(LEVELS, idea.level)}`} />
        </div>

        <Block title="وصف الفكرة وأهميتها"><p>{idea.summary}</p>{idea.importance && <p className="pd-muted">{idea.importance}</p>}</Block>
        <Block title="الهدف العام" icon="target"><p className="pd-goal">{idea.goal}</p></Block>
        <Block title="الأهداف التفصيلية القابلة للقياس"><ol>{idea.objectives.map((o) => <li key={o}>{o}</li>)}</ol></Block>
        <Block title="المحاور الرئيسة">
          <ol className="pd-axes">{idea.axes.map((a, i) => (
            <li key={a.t}><strong>{a.t}</strong>{a.p.length > 0 && <ul>{a.p.map((p) => <li key={p}>{p}</li>)}</ul>}{a.ex && <span className="pd-ex">مثال: {a.ex}</span>}<span className="pd-sr">المحور {ordinal(i + 1)}</span></li>
          ))}</ol>
        </Block>
        <div className="pd-two">
          <Block title="الأدوات والمتطلبات"><ul>{idea.materials.map((o) => <li key={o}>{o}</li>)}</ul></Block>
          <Block title="أساليب التدريب"><div className="pd-tags">{idea.strategies.map((o) => <span key={o} className="pd-tag">{o}</span>)}</div></Block>
        </div>
        {idea.warmup.t && <Block title={`نشاط افتتاحي: ${idea.warmup.t}`}><ol>{idea.warmup.s.map((o) => <li key={o}>{o}</li>)}</ol></Block>}
        <Block title={`النشاط التطبيقي: ${idea.activity.t}`} accent>
          {idea.activity.g && <p className="pd-muted">التنظيم: {idea.activity.g}</p>}
          <ol>{idea.activity.s.map((o) => <li key={o}>{o}</li>)}</ol>
          {idea.activity.out && <p><strong>يخرج المشارك بـ:</strong> {idea.activity.out}</p>}
        </Block>
        <div className="pd-two">
          <Block title={`تقويم الأثر: ${idea.evaluation.m}`}><ul>{idea.evaluation.items.map((o) => <li key={o}>{o}</li>)}</ul></Block>
          <Block title="النتائج المتوقعة"><ul>{idea.outcomes.map((o) => <li key={o}>{o}</li>)}</ul></Block>
        </div>
        {idea.refs.length > 0 && <Block title="مراجع للاستزادة"><ul className="pd-refs">{idea.refs.map((o) => <li key={o} dir="ltr">{o}</li>)}</ul></Block>}
      </article>

      <aside className="pd-panel pd-setup" id="pd-setup" aria-labelledby="pd-setup-h">
        <h2 id="pd-setup-h"><Icon d="tools" /> إعداد المشغل التدريبي</h2>
        <p className="pd-fine">اختر ما يناسب لقاءك، ثم أعدّ المشغل. يمكنك تعديل كل شيء بعد ذلك.</p>
        <Field label="مدة المشغل" group>
          <div className="pd-seg is-wrap">{DURATIONS.map((m) => <button key={m} type="button" className={settings.duration === m ? 'is-on' : ''} onClick={() => setSettings((s) => ({ ...s, duration: m }))} aria-pressed={settings.duration === m}>{m} د</button>)}</div>
        </Field>
        <Field label="عدد المشاركين التقريبي">
          <input className="pd-input" type="number" min={2} max={300} value={settings.participants} onChange={(e) => setSettings((s) => ({ ...s, participants: Math.max(2, Math.min(300, Number(e.target.value) || 2)) }))} />
        </Field>
        <div className="pd-two is-tight">
          <Field label="التخصص"><select className="pd-input" value={settings.spec} onChange={(e) => setSettings((s) => ({ ...s, spec: e.target.value }))}>{SPECS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</select></Field>
          <Field label="المرحلة"><select className="pd-input" value={settings.stage} onChange={(e) => setSettings((s) => ({ ...s, stage: e.target.value }))}>{STAGES.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</select></Field>
        </div>
        <Field label="مستوى التفصيل" group><Seg options={DEPTHS} value={settings.depth} onChange={(v) => setSettings((s) => ({ ...s, depth: v }))} /></Field>
        <Field label="الطابع التدريبي" group><Seg options={STYLES} value={settings.style} onChange={(v) => setSettings((s) => ({ ...s, style: v }))} /></Field>
        <details className="pd-more">
          <summary>بيانات الغلاف والدعوة (اختياري)</summary>
          <Field label="مقدّم المشغل"><input className="pd-input" value={settings.presenter} maxLength={120} onChange={(e) => setSettings((s) => ({ ...s, presenter: e.target.value }))} placeholder="أ. ..." /></Field>
          <Field label="المدرسة"><input className="pd-input" value={settings.school} maxLength={160} onChange={(e) => setSettings((s) => ({ ...s, school: e.target.value }))} /></Field>
          <div className="pd-two is-tight">
            <Field label="التاريخ"><input className="pd-input" value={settings.date} maxLength={60} onChange={(e) => setSettings((s) => ({ ...s, date: e.target.value }))} placeholder="الأحد 15 نوفمبر" /></Field>
            <Field label="المكان"><input className="pd-input" value={settings.venue} maxLength={120} onChange={(e) => setSettings((s) => ({ ...s, venue: e.target.value }))} placeholder="قاعة مصادر التعلم" /></Field>
          </div>
        </details>

        <div className="pd-build">
          {aiReady && (
            <button type="button" className="pd-primary is-big" onClick={buildAI} disabled={!!busy}>
              {busy === 'build' ? <span className="pd-spin" /> : <Icon d="wand" />} إعداد المشغل التدريبي بالذكاء الاصطناعي
            </button>
          )}
          <button type="button" className={aiReady ? 'pd-secondary' : 'pd-primary is-big'} onClick={buildQuick} disabled={!!busy}>
            <Icon d="layers" /> {aiReady ? 'إعداد سريع من محتوى المكتبة' : 'إعداد المشغل التدريبي'}
          </button>
          <p className="pd-fine">
            {aiReady
              ? 'الإعداد بالذكاء الاصطناعي يكتب شرحًا وأمثلة مخصصة لإعداداتك (يستغرق عادة أقل من دقيقة). الإعداد السريع فوري ويستخدم محتوى المكتبة كما هو.'
              : aiReady === false ? 'يُبنى المشغل فورًا من محتوى المكتبة ويوزَّع الزمن حسب إعداداتك. (التوليد بالذكاء الاصطناعي غير مفعّل على الخادم حاليًا.)' : 'جارٍ التحقق من توفر الذكاء الاصطناعي…'}
          </p>
        </div>
      </aside>
    </div>
  );
}

const Fact = ({ icon, k, v }) => (
  <div className="pd-fact"><Icon d={icon} /><div><span>{k}</span><strong>{v}</strong></div></div>
);
const Block = ({ title, icon, children, accent }) => (
  <section className={`pd-block ${accent ? 'is-accent' : ''}`}><h3>{icon && <Icon d={icon} size={16} />}{title}</h3>{children}</section>
);
const Field = ({ label: lab, children, group }) => (group
  ? <div className="pd-field" role="group" aria-label={lab}><span>{lab}</span>{children}</div>
  : <label className="pd-field"><span>{lab}</span>{children}</label>);
function Seg({ options, value, onChange }) {
  return <div className="pd-seg" role="radiogroup">{options.map((o) => <button key={o.id} type="button" role="radio" aria-checked={value === o.id} className={value === o.id ? 'is-on' : ''} onClick={() => onChange(o.id)}>{o.label}</button>)}</div>;
}

// ====================================================================================== المشغل
const REGEN = [
  ['objectives', 'الأهداف'], ['hook', 'النشاط التمهيدي'], ['axes', 'المحاور'], ['activity', 'النشاط التطبيقي'],
  ['discussion', 'أسئلة النقاش'], ['closing', 'الخاتمة'], ['evaluation', 'التقويم'],
];

function WorkshopView({ workshop: w, aiReady, busy, regenerate, doExport, setEditing, updateWorkshop }) {
  const d = DOMAIN[w.domain] || {};
  const agenda = agendaOf(w);
  const total = totalMinutes(w);
  const [regenOpen, setRegenOpen] = useState(null);
  const [instr, setInstr] = useState('');
  // دوال عرض (وليست مكونات) حتى لا يُعاد تركيب حقل الإدخال مع كل حرف
  const regenBtn = (k) => (aiReady ? (
    <button type="button" className="pd-mini" onClick={() => { setRegenOpen(regenOpen === k ? null : k); setInstr(''); }} disabled={!!busy} aria-expanded={regenOpen === k}>
      {busy === `section:${k}` ? <span className="pd-spin is-sm" /> : <Icon d="refresh" size={14} />} أعد الصياغة
    </button>
  ) : null);
  const regenBox = (k) => (regenOpen === k ? (
    <form className="pd-regen" onSubmit={(e) => { e.preventDefault(); regenerate(k, instr.trim()); setRegenOpen(null); }}>
      <input className="pd-input" value={instr} onChange={(e) => setInstr(e.target.value)} maxLength={300} placeholder="توجيه اختياري: مثل «أنشطة أقصر» أو «أمثلة من حصص الموسيقى»" autoFocus />
      <button type="submit" className="pd-primary">أعد صياغة {REGEN.find((r) => r[0] === k)[1]}</button>
    </form>
  ) : null);
  const H = ({ k, title, minutes }) => (
    <div className="pd-wsec-head"><h3>{title}</h3>{minutes ? <span className="pd-min">{fmtMin(minutes)}</span> : null}{k && regenBtn(k)}</div>
  );
  const mismatch = total !== w.settings.duration;

  return (
    <div className="pd-ws" style={{ '--c': d.color }}>
      <article className="pd-panel pd-ws-main">
        <div className="pd-ws-top">
          <span className="pd-idea-domain"><span className="pd-dicon" style={{ '--c': d.color }}><Icon d={d.icon} /></span>{d.label}</span>
          <span className={`pd-source is-${w.source}`}>{w.source === 'library' ? <Icon d="book" size={14} /> : <Icon d="spark" size={14} />} {srcLabel[w.source]}</span>
        </div>
        <h2 className="pd-ws-title">{w.title}</h2>
        {w.tagline && <p className="pd-idea-tag">{w.tagline}</p>}
        <div className="pd-facts">
          <Fact icon="users" k="الفئة المستهدفة" v={w.audienceText} />
          <Fact icon="clock" k="المدة" v={fmtMin(total)} />
          <Fact icon="people" k="المشاركون" v={`${w.settings.participants} تقريبًا`} />
          <Fact icon="chart" k="الطابع / التفصيل" v={`${label(STYLES, w.settings.style)} · ${label(DEPTHS, w.settings.depth)}`} />
        </div>
        {w.source !== 'library' && <p className="pd-ai-note"><Icon d="info" size={16} /> أُعدّ هذا المحتوى بمساعدة الذكاء الاصطناعي؛ راجع الأمثلة والمصطلحات وتأكد من ملاءمتها لمدرستك قبل التقديم. المراجع المعروضة من المكتبة الموثقة فقط.</p>}

        <section className="pd-wsec">
          <H title="مسار المشغل" />
          <ol className="pd-agenda">{agenda.map((r) => (
            <li key={r.key}><span className="pd-agenda-t">{r.title}</span><span className="pd-agenda-bar"><span style={{ width: `${Math.max(4, (r.minutes / Math.max(total, 1)) * 100)}%` }} /></span><span className="pd-agenda-m">{fmtMin(r.minutes)}</span></li>
          ))}</ol>
          {mismatch && (
            <p className="pd-warn">مجموع الفقرات {fmtMin(total)} والمدة المطلوبة {fmtMin(w.settings.duration)}.
              <button type="button" className="pd-link" onClick={() => updateWorkshop(retime(w, w.settings.duration))}>إعادة توزيع الوقت</button></p>
          )}
        </section>

        <section className="pd-wsec"><H title="التعريف بالمشغل" /><p>{w.summary}</p>{w.importance && <p className="pd-muted">{w.importance}</p>}<p className="pd-goal"><strong>الهدف العام:</strong> {w.goal}</p></section>
        <section className="pd-wsec"><H k="objectives" title="الأهداف التدريبية" />{regenBox('objectives')}<ol>{w.objectives.map((o, i) => <li key={i}>{o}</li>)}</ol></section>
        <section className="pd-wsec"><H title="الافتتاح" minutes={w.opening.minutes} /><p>{w.opening.welcome}</p>{w.opening.agreements.length > 0 && <ul>{w.opening.agreements.map((o, i) => <li key={i}>{o}</li>)}</ul>}</section>
        <section className="pd-wsec"><H k="hook" title={`نشاط تمهيدي${w.hook.title ? `: ${w.hook.title}` : ''}`} minutes={w.hook.minutes} />{regenBox('hook')}{w.hook.purpose && <p className="pd-muted">{w.hook.purpose}</p>}<ol>{w.hook.steps.map((o, i) => <li key={i}>{o}</li>)}</ol></section>
        <section className="pd-wsec">
          <H k="axes" title="المحاور" />{regenBox('axes')}
          {w.axes.map((a, i) => (
            <div key={i} className="pd-axis">
              <div className="pd-axis-head"><span className="pd-axis-n">{i + 1}</span><h4>{a.title}</h4>{a.minutes ? <span className="pd-min">{fmtMin(a.minutes)}</span> : null}</div>
              {a.explain && <p>{a.explain}</p>}
              {a.points.length > 0 && <ul>{a.points.map((o, j) => <li key={j}>{o}</li>)}</ul>}
              {a.example && <p className="pd-ex"><strong>مثال من الواقع المدرسي:</strong> {a.example}</p>}
            </div>
          ))}
        </section>
        <section className="pd-wsec is-accent">
          <H k="activity" title={`النشاط التطبيقي${w.activity.title ? `: ${w.activity.title}` : ''}`} minutes={w.activity.minutes} />{regenBox('activity')}
          {w.activity.grouping && <p className="pd-muted">التنظيم: {w.activity.grouping}</p>}
          <ol>{w.activity.steps.map((o, i) => <li key={i}>{o}</li>)}</ol>
          {w.activity.output && <p><strong>المنتج المتوقع:</strong> {w.activity.output}</p>}
          {w.activity.tips.length > 0 && <ul className="pd-tips">{w.activity.tips.map((o, i) => <li key={i}>{o}</li>)}</ul>}
        </section>
        {(w.discussion.questions.length > 0 || aiReady) && (
          <section className="pd-wsec"><H k="discussion" title="أسئلة النقاش وتبادل الخبرات" minutes={w.discussion.minutes} />{regenBox('discussion')}<ul>{w.discussion.questions.map((o, i) => <li key={i}>{o}</li>)}</ul></section>
        )}
        <section className="pd-wsec"><H k="closing" title="الخاتمة والتوصيات" minutes={w.closing.minutes} />{regenBox('closing')}{w.closing.takeaway && <p className="pd-goal">{w.closing.takeaway}</p>}<ul>{w.closing.recs.map((o, i) => <li key={i}>{o}</li>)}</ul></section>
        <section className="pd-wsec"><H k="evaluation" title="التقويم والتغذية الراجعة" minutes={w.evaluation.minutes} />{regenBox('evaluation')}
          {w.evaluation.method && <p className="pd-muted">الطريقة: {w.evaluation.method}</p>}
          <div className="pd-two"><div><h4>بنود قياس الأثر</h4><ul>{w.evaluation.items.map((o, i) => <li key={i}>{o}</li>)}</ul></div><div><h4>بطاقة التغذية الراجعة</h4><ol>{w.evaluation.feedback.map((o, i) => <li key={i}>{o}</li>)}</ol></div></div>
        </section>
        <div className="pd-two">
          <section className="pd-wsec"><H title="المواد والأدوات" /><ul>{w.materials.map((o, i) => <li key={i}>{o}</li>)}</ul></section>
          <section className="pd-wsec"><H title="النتائج المتوقعة" /><ul>{w.outcomes.map((o, i) => <li key={i}>{o}</li>)}</ul></section>
        </div>
        {w.notes && <section className="pd-wsec"><H title="ملاحظات للميسّر" /><p>{w.notes}</p></section>}
        {w.refs.length > 0 && <section className="pd-wsec"><H title="مراجع للاستزادة" /><ul className="pd-refs">{w.refs.map((o, i) => <li key={i} dir="ltr">{o}</li>)}</ul></section>}
      </article>

      <aside className="pd-panel pd-export" aria-labelledby="pd-exp-h">
        <h2 id="pd-exp-h">المشغل جاهز</h2>
        <button type="button" className="pd-secondary is-full" onClick={() => setEditing(true)} disabled={!!busy}><Icon d="edit" /> تعديل المحتوى</button>
        <p className="pd-fine">التعديلات تُحفظ تلقائيًا في «مشاغلي» على هذا الجهاز.</p>
        <div className="pd-exp-list">
          <ExportBtn icon="slides" title="عرض PowerPoint" sub="شرائح 16:9 قابلة للتعديل مع ملاحظات الميسّر" onClick={() => doExport('pptx')} busy={busy === 'export:pptx'} disabled={!!busy} />
          <ExportBtn icon="word" title="حقيبة تدريبية (Word)" sub="غلاف، جدول زمني، محتوى، أوراق عمل، أدوات تقويم" onClick={() => doExport('docx')} busy={busy === 'export:docx'} disabled={!!busy} />
          <ExportBtn icon="print" title="حقيبة تدريبية للطباعة / PDF" sub="اختر «حفظ كـ PDF» من نافذة الطباعة" onClick={() => doExport('kit')} busy={busy === 'export:kit'} disabled={!!busy} />
          <ExportBtn icon="copy" title="نسخ المحتوى" sub="بالعناوين والقوائم — للصق في Word أو البريد" onClick={() => doExport('copy')} busy={busy === 'export:copy'} disabled={!!busy} />
          <ExportBtn icon="book" title="وثيقة المشغل للطباعة" sub="المحتوى كاملًا في صفحات منظمة" onClick={() => doExport('print')} busy={busy === 'export:print'} disabled={!!busy} />
          <ExportBtn icon="mail" title="بطاقة دعوة للحضور" sub="تستخدم الموعد والمكان من بيانات الغلاف" onClick={() => doExport('invite')} busy={busy === 'export:invite'} disabled={!!busy} />
        </div>
      </aside>
    </div>
  );
}

const ExportBtn = ({ icon, title, sub, onClick, busy, disabled }) => (
  <button type="button" className="pd-exp" onClick={onClick} disabled={disabled}>
    <span className="pd-exp-icon">{busy ? <span className="pd-spin is-sm" /> : <Icon d={icon} size={20} />}</span>
    <span><strong>{title}</strong><small>{sub}</small></span>
  </button>
);

// ====================================================================================== مشاغلي
function Mine({ history, favs, allIdeas, openIdea, removeHistory, toggleFav, openWorkshop }) {
  const favIdeas = favs.map((id) => allIdeas.find((i) => i.id === id)).filter(Boolean);
  return (
    <>
      <section className="pd-section">
        <div className="pd-section-head"><h2><Icon d="history" /> المشاغل التي أعددتها</h2></div>
        {history.length ? (
          <div className="pd-list">{history.map((w) => (
            <div key={w.id} className="pd-row" style={{ '--c': (DOMAIN[w.domain] || {}).color }}>
              <button type="button" className="pd-row-main" onClick={() => openWorkshop(w)}>
                <span className="pd-dicon" style={{ '--c': (DOMAIN[w.domain] || {}).color }}><Icon d={(DOMAIN[w.domain] || {}).icon} /></span>
                <span><strong>{w.title}</strong><small>{fmtMin(totalMinutes(w))} · {srcLabel[w.source]} · {new Date(w.updatedAt || w.createdAt).toLocaleDateString('ar-OM', { day: 'numeric', month: 'long' })}</small></span>
              </button>
              <button type="button" className="pd-icon" onClick={() => removeHistory(w.id)} aria-label={`حذف ${w.title}`}><Icon d="trash" /></button>
            </div>
          ))}</div>
        ) : <div className="pd-empty">لم تُعدّ أي مشغل بعد. اختر فكرة من المكتبة واضغط «إعداد المشغل التدريبي».</div>}
      </section>
      <section className="pd-section">
        <div className="pd-section-head"><h2><Icon d="heart" /> الأفكار المفضلة</h2></div>
        {favIdeas.length
          ? <div className="pd-grid">{favIdeas.map((i) => <IdeaCard key={i.id} idea={i} onOpen={openIdea} fav onFav={toggleFav} />)}</div>
          : <div className="pd-empty">اضغط ♡ على أي فكرة لتجدها هنا.</div>}
      </section>
    </>
  );
}
