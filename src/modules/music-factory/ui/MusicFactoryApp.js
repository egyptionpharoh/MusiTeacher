'use client';
// =====================================================================
// 🎼 مصنع الألحان — الواجهة الكاملة (4 مراحل واضحة)
// مستقلة عن MusiTeacher: تستقبل getToken و apiBase و onBack فقط من الصفحة.
// =====================================================================
import { useCallback, useEffect, useMemo, useState } from 'react';
import { defaultProject, normalizeProject, hasLyrics } from '../core/project.js';
import { createApi } from './api.js';
import LyricsStep from './LyricsStep.js';
import StyleStep from './StyleStep.js';
import PromptStep from './PromptStep.js';
import GenerateStep from './GenerateStep.js';
import './music-factory.css';

const STORE = 'mf.musiteacher.v1';
const STEPS = [
  { id: 'lyrics', icon: '✍️', ar: 'الكلمات' },
  { id: 'style', icon: '🎨', ar: 'الطابع والتوزيع' },
  { id: 'prompt', icon: '📝', ar: 'البرومبت' },
  { id: 'generate', icon: '🎧', ar: 'التوليد' },
];

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE) || 'null');
    if (!raw) return null;
    return { project: normalizeProject(raw.project), output: raw.output && typeof raw.output === 'object' ? raw.output : null, step: Math.max(0, Math.min(3, raw.step | 0)) };
  } catch { return null; }
}

export default function MusicFactoryApp({ getToken, apiBase = '/api/music-factory', onBack }) {
  const api = useMemo(() => createApi({ base: apiBase, getToken }), [apiBase, getToken]);
  const [project, setProject] = useState(() => defaultProject('song'));
  const [output, setOutput] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [step, setStep] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState(null);
  const [statusError, setStatusError] = useState(null);
  const [generating, setGenerating] = useState(false);

  // استرجاع آخر عمل من هذا المتصفح (بعد التحميل لتجنب اختلاف الخادم/المتصفح)
  useEffect(() => {
    const s = load();
    if (s) { setProject(s.project); setOutput(s.output); setStep(s.step); }
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (!loaded) return;
    try { localStorage.setItem(STORE, JSON.stringify({ project, output, step })); } catch { /* مساحة ممتلئة */ }
  }, [project, output, step, loaded]);

  const reloadStatus = useCallback(async () => {
    setStatusError(null);
    for (let i = 0; i < 3; i++) {
      try { setStatus(await api.status()); return; } catch (e) {
        if (e.status === 401 && i < 2) { await new Promise((r) => setTimeout(r, 800)); continue; } // Firebase يجهز الجلسة
        setStatusError(e.message); return;
      }
    }
  }, [api]);
  useEffect(() => { reloadStatus(); }, [reloadStatus]);

  const update = useCallback((fn) => setProject((p) => normalizeProject(fn(p))), []);
  const projectKey = useMemo(() => JSON.stringify([project.mode, project.title, project.sections.map((s) => [s.type, s.label, s.text]), project.choices]), [project]);

  const canLeaveLyrics = project.mode === 'instrumental' || hasLyrics(project);
  const go = (i) => { if (!generating && (i === 0 || canLeaveLyrics)) { setStep(i); window.scrollTo({ top: 0, behavior: 'smooth' }); } };

  function next() {
    if (step === 0 && !canLeaveLyrics) return;
    go(Math.min(3, step + 1));
  }

  function restore(t) {
    if (!window.confirm('سيتم استبدال العمل الحالي بكلمات وإعدادات هذا العمل المحفوظ. متابعة؟')) return;
    setProject(normalizeProject(t.project));
    setOutput(t.prompt ? { ...t.prompt, source: 'library', basedOn: null } : null);
    setAnalysis(null);
    go(2);
  }

  function reset() {
    if (!window.confirm('بدء عمل جديد؟ سيتم مسح الكلمات والإعدادات الحالية (المكتبة لن تتأثر).')) return;
    setProject(defaultProject(project.mode)); setOutput(null); setAnalysis(null); setStep(0);
  }

  const ready = status?.audio?.ready;

  return (
    <div className="mf-page" dir="rtl">
      <div className="mf">
        <header className="mf-hero">
          {onBack ? <button type="button" className="mf-back" onClick={onBack}>→ العودة</button> : null}
          <span className="mf-badge">AI · Music Factory</span>
          <h1 className="mf-title">مصنع الألحان</h1>
          <p className="mf-sub">من كلماتك إلى أغنية أو موسيقى تصويرية: اكتب، اختر الطابع، راجع البرومبت، ثم ولّد واستمع.</p>
          {status ? (
            <div className="mf-status">
              <span className={`mf-pill ${ready?.song ? 'mf-pill-ok' : 'mf-pill-soft'}`}>{ready?.song ? '🎤 توليد الأغاني متاح' : '🎤 توليد الأغاني غير مُعد'}</span>
              <span className={`mf-pill ${ready?.instrumental ? 'mf-pill-ok' : 'mf-pill-soft'}`}>{ready?.instrumental ? '🎻 الموسيقى التصويرية متاحة' : '🎻 الموسيقى غير مُعدة'}</span>
              <span className={`mf-pill ${status.brain?.providers?.some((p) => p.configured) ? 'mf-pill-ok' : 'mf-pill-soft'}`}>{status.brain?.providers?.some((p) => p.configured) ? '🧠 المايسترو متاح' : '🧠 المايسترو: تحليل محلي فقط'}</span>
            </div>
          ) : null}
        </header>

        <nav className="mf-stepper" aria-label="مراحل العمل">
          {STEPS.map((s, i) => (
            <button key={s.id} type="button" className={`mf-stepbtn${i === step ? ' is-on' : ''}${i < step ? ' is-done' : ''}`} aria-current={i === step ? 'step' : undefined}
              onClick={() => go(i)} disabled={generating || (i > 0 && !canLeaveLyrics)}>
              <span className="mf-stepnum">{i < step ? '✓' : i + 1}</span>
              <span className="mf-stepname">{s.icon} {s.ar}</span>
            </button>
          ))}
        </nav>

        <main className="mf-card mf-main">
          <h2 className="mf-h2">{STEPS[step].icon} {STEPS[step].ar}</h2>
          {step === 0 ? <LyricsStep project={project} update={update} /> : null}
          {step === 1 ? <StyleStep project={project} update={update} api={api} analysis={analysis} setAnalysis={setAnalysis} /> : null}
          {step === 2 ? <PromptStep project={project} api={api} analysis={analysis} output={output} setOutput={setOutput} projectKey={projectKey} /> : null}
          {step === 3 ? (
            <GenerateStep project={project} output={output} api={api} status={status} statusError={statusError} reloadStatus={reloadStatus}
              onRestore={restore} onBusy={setGenerating} goPrompt={() => go(2)} />
          ) : null}
        </main>

        <div className="mf-nav">
          <button type="button" className="mf-btn mf-btn-ghost" onClick={() => go(step - 1)} disabled={step === 0 || generating}>→ السابق</button>
          <button type="button" className="mf-btn mf-btn-ghost mf-btn-sm" onClick={reset} disabled={generating}>عمل جديد</button>
          {step < 3 ? (
            <button type="button" className="mf-btn" onClick={next} disabled={!canLeaveLyrics}>
              {step === 0 && !canLeaveLyrics ? 'اكتب الكلمات أولًا' : 'التالي ←'}
            </button>
          ) : <span />}
        </div>
      </div>
    </div>
  );
}
