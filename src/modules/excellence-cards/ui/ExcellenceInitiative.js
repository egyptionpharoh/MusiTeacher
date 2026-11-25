'use client';
// «كوبون التميز» — اقتراح تعليمي متكامل داخل «مبادرات تعليمية»: الفكرة وآلية التنفيذ + مصمم الكروت + الطباعة + المتابعة + تقرير التكريم.
// كل البيانات (بما فيها أسماء الطلبة) تُحفظ على جهاز المعلم وبمفتاح حسابه فقط.
import { useCallback, useEffect, useRef, useState } from 'react';
import { INITIATIVE, GOALS, AUDIENCE, STEPS, RULES, HONOR_PERIODS, HONOR_TYPES, DOCUMENTATION } from '../data/content.js';
import { load, save, newId, normalizeCard } from '../core/store.js';
import { layoutFor, CUT_GAP } from '../core/layout.js';
import Designer from './Designer.js';
import PrintStudio, { Sheet, buildCards } from './PrintStudio.js';
import Tracker from './Tracker.js';
import Report from './Report.js';
import Card from './Card.js';
import { PrintLayer, Fit } from './print.js';
import { Ico } from './parts.js';
import { paginate } from '../core/layout.js';
import './excellence.css';

const TABS = [
  { id: 'about', label: 'عن المبادرة', icon: 'idea' },
  { id: 'design', label: 'مصمم الكروت', icon: 'brush' },
  { id: 'print', label: 'الطباعة', icon: 'print' },
  { id: 'track', label: 'متابعة الكوبونات', icon: 'chart' },
  { id: 'report', label: 'تقرير التكريم', icon: 'report' },
];

function useAccountStore(getUserId) {
  const [uid, setUid] = useState(undefined);
  const [state, setState] = useState(null);
  const latest = useRef({ uid: undefined, state: null });
  useEffect(() => {
    let alive = true;
    (async () => {
      let id = null;
      try { id = getUserId ? await getUserId() : null; } catch { id = null; }
      if (!alive) return;
      setUid(id); setState(load(window.localStorage, id));
    })();
    return () => { alive = false; };
  }, [getUserId]);
  useEffect(() => {
    latest.current = { uid, state };
    if (!state || uid === undefined) return undefined;
    const t = setTimeout(() => save(window.localStorage, uid, state), 200);
    return () => clearTimeout(t);
  }, [state, uid]);
  useEffect(() => {
    const flush = () => { const l = latest.current; if (l.state && l.uid !== undefined) save(window.localStorage, l.uid, l.state); };
    window.addEventListener('pagehide', flush);
    return () => { flush(); window.removeEventListener('pagehide', flush); };
  }, []);
  return { uid, state, update: setState };
}

function About({ go, state }) {
  const sample = { ...state.card, student: '', template: 'notes', gift: true, phraseId: 'p02', custom: '' };
  return (
    <div className="ec-about">
      <section className="ec-box ec-idea">
        <div>
          <h2><Ico n="idea" /> فكرة المبادرة</h2>
          <p>{INITIATIVE.idea}</p>
          <p className="ec-own"><Ico n="user" size={17} /> <span><b>المبادرة مبادرتك:</b> اسم صاحب المبادرة والمدرسة والمادة والصفوف وفترة التكريم والعبارات كلها تحددها أنت، وتظهر باسمك في الكروت والتقرير. MusiTeacher يقدّم الفكرة والأدوات فقط.</span></p>
          <div className="ec-row"><button type="button" className="ec-btn is-primary" onClick={() => go('design')}><Ico n="brush" /> صمّم كارتك الأول</button><button type="button" className="ec-btn" onClick={() => go('track')}><Ico n="chart" /> نظام المتابعة (اختياري)</button></div>
        </div>
        <div className="ec-idea-card"><Fit w={95 - 2 * CUT_GAP} h={55.4 - 2 * CUT_GAP} max={1.25}><Card settings={state.settings} card={sample} w={95 - 2 * CUT_GAP} h={55.4 - 2 * CUT_GAP} /></Fit></div>
      </section>

      <div className="ec-grid2">
        <section className="ec-box"><h3><Ico n="star" /> أهداف المبادرة</h3><ul className="ec-bullets">{GOALS.map((g) => <li key={g}>{g}</li>)}</ul></section>
        <section className="ec-box"><h3><Ico n="users" /> الفئة المستهدفة</h3><p>{AUDIENCE}</p>
          <h3 className="ec-mt"><Ico n="gift" /> عن الهدية الرمزية</h3><p>اختيارية تمامًا. أرفقها فقط إن كان ذلك مسموحًا في مدرستك ووفق أنظمتها، مع مراعاة الحساسية الغذائية والتعليمات الصحية. قيمة الكوبون في التقدير نفسه، لا في الهدية.</p></section>
      </div>

      <section className="ec-box">
        <h3><Ico n="list" /> آلية التنفيذ</h3>
        <ol className="ec-steps">{STEPS.map((s, i) => <li key={s.t}><span className="ec-step-n">{i + 1}</span><div><b>{s.t}</b><p>{s.d}</p></div></li>)}</ol>
      </section>

      <section className="ec-box ec-rules">
        <h3><Ico n="lock" /> حتى لا يفقد الكوبون قيمته</h3>
        <ul className="ec-bullets">{RULES.map((r) => <li key={r}>{r}</li>)}</ul>
      </section>

      <div className="ec-grid2">
        <section className="ec-box"><h3><Ico n="cal" /> التكريم</h3>
          <p>تحدد أنت موعد التكريم: </p><div className="ec-tags">{HONOR_PERIODS.map((p) => <span key={p} className="ec-chip is-static">{p}</span>)}</div>
          <p>في الموعد تراجع عدد الكوبونات، وتكرّم أصحاب أعلى رصيد بإحدى الطرق:</p><div className="ec-tags">{HONOR_TYPES.map((p) => <span key={p} className="ec-chip is-static">{p}</span>)}</div>
        </section>
        <section className="ec-box"><h3><Ico n="report" /> التوثيق لإدارة المدرسة</h3>
          <p>يجهّز «تقرير التكريم» ملخصًا قابلًا للطباعة يتضمن:</p><ul className="ec-bullets">{DOCUMENTATION.map((d) => <li key={d}>{d}</li>)}</ul>
          <p className="ec-hint">لا أرقام جاهزة: الأرقام والنتائج تُكتب أو تُحسب بعد التطبيق الفعلي فقط.</p>
          <button type="button" className="ec-btn" onClick={() => go('report')}><Ico n="report" /> افتح التقرير</button>
        </section>
      </div>
    </div>
  );
}

export default function ExcellenceInitiative({ getUserId, onBack }) {
  const { uid, state, update } = useAccountStore(getUserId);
  const [tab, setTab] = useState('about');
  const [picked, setPicked] = useState([]);
  const [job, setJob] = useState(null);
  const [notice, setNotice] = useState(null);
  const notify = useCallback((type, text) => { setNotice({ type, text, t: Date.now() }); if (type !== 'err') setTimeout(() => setNotice((n) => (n && n.text === text ? null : n)), 3200); }, []);
  const go = (t) => { setTab(t); try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch { /* */ } };

  if (!state) return <div className="ec-app"><div className="ec-loading">جارٍ التحميل…</div></div>;

  const printCards = (cards) => {
    const pages = paginate(cards, state.print.perPage);
    setJob({ kind: 'cards', node: pages.map((p, i) => <Sheet key={i} cards={p} perPage={state.print.perPage} settings={state.settings} bw={!state.print.color} cut={state.print.cut} />) });
  };
  const printOne = () => { update((s) => ({ ...s, print: { ...s.print, source: 'copies', copies: 1 } })); printCards([{ ...state.card, qid: 'one' }]); };
  const fillPage = () => { update((s) => ({ ...s, print: { ...s.print, source: 'copies', copies: layoutFor(s.print.perPage).n } })); go('print'); };
  const queue = () => { update((s) => ({ ...s, queue: [...s.queue, { ...normalizeCard(s.card), qid: newId() }].slice(0, 200) })); notify('ok', `أُضيف الكارت إلى قائمة الطباعة (${state.queue.length + 1}).`); };
  const printStudents = (ids) => { setPicked(ids); update((s) => ({ ...s, print: { ...s.print, source: 'students' } })); go('print'); };

  return (
    <div className="ec-app" dir="rtl">
      <div className="ec-top">
        <button type="button" className="ec-back" onClick={onBack} id="ec-back"><Ico n="back" size={16} /> كل المبادرات</button>
      </div>
      <header className="ec-hero">
        <div className="ec-hero-text">
          <span className="ec-badge"><Ico n="star" size={14} fill /> {INITIATIVE.badge} · قابل للتطبيق والتطوير</span>
          <h1 id="ec-title">{state.settings.initiativeName}</h1>
          <p className="ec-slogan">{INITIATIVE.slogan}</p>
          <p>{INITIATIVE.summary}</p>
        </div>
        <div className="ec-hero-art" aria-hidden="true"><span className="ec-hs ec-hs1">★</span><span className="ec-hs ec-hs2">★</span><span className="ec-hs ec-hs3">✦</span><Ico n="gift" size={64} /></div>
      </header>

      <nav className="ec-tabs" role="tablist" aria-label="أقسام المبادرة">
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" id={`ec-tab-${t.id}`} aria-selected={tab === t.id} className={tab === t.id ? 'is-on' : ''} onClick={() => setTab(t.id)}>
            <Ico n={t.icon} size={18} /><span>{t.label}</span>
            {t.id === 'track' && state.tracking ? <b className="ec-count">{state.awards.length}</b> : null}
            {t.id === 'print' && state.queue.length ? <b className="ec-count">{state.queue.length}</b> : null}
          </button>
        ))}
      </nav>

      {notice ? (
        <div className={`ec-notice is-${notice.type}`} role={notice.type === 'err' ? 'alert' : 'status'}>
          <Ico n={notice.type === 'err' ? 'info' : 'check'} size={17} /><span>{notice.text}</span>
          <button type="button" className="ec-icon-btn" aria-label="إغلاق" onClick={() => setNotice(null)}><Ico n="x" size={15} /></button>
        </div>
      ) : null}

      <div role="tabpanel" aria-labelledby={`ec-tab-${tab}`} className="ec-panel">
        {tab === 'about' && <About go={go} state={state} />}
        {tab === 'design' && <Designer state={state} update={update} onPrintOne={printOne} onFillPage={fillPage} onQueue={queue} />}
        {tab === 'print' && <PrintStudio state={state} update={update} picked={picked} setPicked={setPicked} onPrint={printCards} goDesigner={() => go('design')} goTracker={() => go('track')} />}
        {tab === 'track' && <Tracker state={state} update={update} notify={notify} uidKnown={!!uid} onPrintStudents={printStudents} />}
        {tab === 'report' && <Report state={state} update={update} onPrint={(node) => setJob({ kind: 'report', node })} goTracker={() => go('track')} />}
      </div>

      <PrintLayer job={job} onDone={() => setJob(null)} />
    </div>
  );
}

// للاختبار: بناء قائمة الكروت متاح من هنا أيضًا
export { buildCards };
