'use client';
// 📝 الخطوة 3: البرومبت الاحترافي (فوري محليًا، أو أعمق بالذكاء الاصطناعي) — قابل للتعديل والنسخ والتحسين.
import { useEffect, useState } from 'react';
import { SUNO_LIMITS } from '../core/catalog.js';
import { buildLocalPrompt, buildLyrics, fullPromptText, lyricsPreserved } from '../core/promptBuilder.js';
import { CopyButton, Counter, Notice, Spinner } from './parts.js';

export default function PromptStep({ project, api, analysis, output, setOutput, projectKey }) {
  const [busy, setBusy] = useState(null);
  const [msg, setMsg] = useState(null);
  const [instruction, setInstruction] = useState('');
  const song = project.mode === 'song';
  const stale = output && output.basedOn !== projectKey;
  const edit = (k, v) => setOutput((o) => ({ ...o, [k]: v, edited: true }));

  function local() {
    if (output?.edited && !window.confirm('سيُستبدل البرومبت الحالي (وفيه تعديلاتك) ببرومبت فوري جديد. متابعة؟')) return;
    setOutput({ ...buildLocalPrompt(project), source: 'local', basedOn: projectKey });
    setMsg({ kind: 'ok', text: 'تم إنشاء برومبت فوري من اختياراتك (بدون ذكاء اصطناعي ولا تكلفة).' });
  }

  async function ai() {
    if (output?.edited && !window.confirm('سيُستبدل البرومبت الحالي (وفيه تعديلاتك) ببرومبت جديد. متابعة؟')) return;
    setBusy('ai'); setMsg(null);
    try {
      const r = await api.prompt(project, analysis || null, 3);
      if (r.ok === false && r.fallback) {
        setOutput({ ...r.fallback, source: 'local', basedOn: projectKey });
        setMsg({ kind: 'warn', text: r.error });
      } else {
        setOutput({ style: r.styles[0], variants: r.styles, variant: 0, lyrics: r.lyrics, title: r.title, exclude: r.exclude, cues: r.cues, notes_ar: r.notes_ar, source: 'ai', provider: r.provider, model: r.model, basedOn: projectKey });
        setMsg({ kind: 'ok', text: `جاهز: ${r.styles.length} بدائل للأسلوب. اختر الأنسب أو عدّل بحرية.` });
      }
    } catch (e) { setMsg({ kind: 'error', text: e.message }); } finally { setBusy(null); }
  }

  async function doRefine() {
    if (!instruction.trim()) return;
    setBusy('refine'); setMsg(null);
    try {
      const r = await api.refine(project, output, instruction.trim());
      setOutput((o) => ({ ...o, style: r.styles[0], variants: undefined, lyrics: r.lyrics, title: r.title || o.title, exclude: r.exclude, cues: r.cues, notes_ar: r.notes_ar, source: 'ai', provider: r.provider, model: r.model, edited: false }));
      setInstruction('');
      setMsg({ kind: 'ok', text: r.notes_ar || 'تم التعديل.' });
    } catch (e) { setMsg({ kind: 'error', text: e.message }); } finally { setBusy(null); }
  }

  // أول دخول بلا برومبت: نجهز البرومبت الفوري فورًا حتى لا تبدأ الخطوة فارغة
  useEffect(() => {
    if (!output) setOutput({ ...buildLocalPrompt(project), source: 'local', basedOn: projectKey });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const restoreLyrics =() => setOutput((o) => ({ ...o, lyrics: buildLyrics(project, o.cues || {}), edited: true }));
  const preserved = !output || lyricsPreserved(project, output.lyrics);

  return (
    <div className="mf-step">
      <div className="mf-row mf-wrap">
        <button type="button" className="mf-btn mf-btn-ghost" onClick={local} disabled={!!busy}>⚡ برومبت فوري</button>
        <button type="button" className="mf-btn" onClick={ai} disabled={!!busy}>{busy === 'ai' ? <><Spinner /> يكتب المايسترو…</> : '✨ برومبت احترافي بالذكاء الاصطناعي'}</button>
        {output ? <CopyButton text={fullPromptText(output)} label="نسخ البرومبت كاملًا" /> : null}
      </div>
      <Notice kind={msg?.kind} onClose={() => setMsg(null)}>{msg?.text}</Notice>
      {stale ? <Notice kind="warn">عدّلت الكلمات أو الإعدادات بعد إنشاء هذا البرومبت. أعد إنشاءه (فوري أو بالذكاء الاصطناعي) حتى يعكس اختياراتك الحالية.</Notice> : null}

      {!output ? (
        <div className="mf-empty">
          <p>اختر طريقة إنشاء البرومبت:</p>
          <ul>
            <li><b>⚡ فوري:</b> يُبنى من اختياراتك مباشرة، مجاني ولا يحتاج إنترنت إضافي.</li>
            <li><b>✨ احترافي:</b> المايسترو يكتب وصفًا أغنى وإشارات أداء لكل قسم (3 بدائل)، مع الحفاظ على كلماتك حرفيًا.</li>
          </ul>
        </div>
      ) : (
        <>
          {output.variants?.length > 1 ? (
            <div className="mf-field">
              <div className="mf-label">بدائل الأسلوب</div>
              <div className="mf-variants">
                {output.variants.map((v, i) => (
                  <button key={i} type="button" className={`mf-variant${output.style === v ? ' is-on' : ''}`} onClick={() => setOutput((o) => ({ ...o, style: v, variant: i }))}>
                    <b>البديل {i + 1}</b><span dir="ltr">{v.slice(0, 160)}…</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <PromptField label="Style of Music (الأسلوب)" value={output.style} max={SUNO_LIMITS.style} rows={5} onChange={(v) => edit('style', v)} ltr
            help="بالإنجليزية لأن محركات التوليد تفهمها بدقة أعلى." />
          {song || output.lyrics ? (
            <PromptField label={song ? 'Lyrics (الكلمات بوسوم الأقسام)' : 'Structure (هيكل المقطوعة)'} value={output.lyrics} max={SUNO_LIMITS.lyrics} rows={12} onChange={(v) => edit('lyrics', v)}
              help={song ? 'الوسوم بين [ ] توجّه المحرك؛ كلماتك بينها كما كتبتها.' : 'الوسوم تحدد مراحل المقطوعة وآلات كل مرحلة.'} />
          ) : null}
          {!preserved ? (
            <Notice kind="warn">
              الكلمات داخل البرومبت لم تعد مطابقة لكلماتك الأصلية (ربما بسبب تعديل يدوي). <button type="button" className="mf-link" onClick={restoreLyrics}>استرجاع كلماتي الأصلية</button>
            </Notice>
          ) : null}
          <div className="mf-grid-2">
            <PromptField label="Title (العنوان)" value={output.title} max={SUNO_LIMITS.title} onChange={(v) => edit('title', v)} single />
            <PromptField label="Exclude Styles (ما نتجنبه)" value={output.exclude} max={SUNO_LIMITS.exclude} onChange={(v) => edit('exclude', v)} single ltr />
          </div>

          {output.notes_ar ? <Notice kind="info">💡 {output.notes_ar}</Notice> : null}
          <p className="mf-meta">المصدر: {output.source === 'ai' ? `المايسترو — ${output.provider} (${output.model || ''})` : 'البرومبت الفوري المحلي'}{output.edited ? ' · عدّلته يدويًا' : ''}</p>

          <div className="mf-card mf-card-soft">
            <label className="mf-label" htmlFor="mf-refine">✏️ تحسين محدد</label>
            <div className="mf-row">
              <input id="mf-refine" className="mf-input" dir="auto" value={instruction} maxLength={500} onChange={(e) => setInstruction(e.target.value)}
                placeholder="مثال: خلي المذهب أقوى بكورال أطفال، وقلل الإلكتروني" onKeyDown={(e) => { if (e.key === 'Enter') doRefine(); }} />
              <button type="button" className="mf-btn" onClick={doRefine} disabled={!!busy || !instruction.trim()}>{busy === 'refine' ? <Spinner /> : 'عدّل'}</button>
            </div>
            <p className="mf-help">يغيّر الأسلوب والإشارات فقط — الكلمات لا تتغير.</p>
          </div>

          <details className="mf-details mf-suno">
            <summary>🎵 استخدام البرومبت في Suno</summary>
            <ol>
              <li>افتح Suno واختر <b>Create</b> ثم وضع <b>Custom</b>.</li>
              <li>انسخ كل خانة إلى مكانها: Style of Music، Lyrics، Title، و Exclude Styles (في الإعدادات المتقدمة).</li>
              <li>{song ? 'اترك Instrumental مغلقًا.' : 'فعّل Instrumental.'} ثم اضغط Create.</li>
            </ol>
            <div className="mf-row mf-wrap">
              <CopyButton text={output.style} label="Style" small />
              <CopyButton text={output.lyrics} label="Lyrics" small />
              <CopyButton text={output.title} label="Title" small />
              <CopyButton text={output.exclude} label="Exclude" small />
              <a className="mf-btn mf-btn-ghost mf-btn-sm" href="https://suno.com/create" target="_blank" rel="noopener noreferrer">فتح Suno ↗</a>
            </div>
            <p className="mf-help">Suno لا يوفر حتى الآن واجهة برمجية عامة؛ لذلك نوصلك إليه بنسخ البرومبت. إن كنت تستخدم Claude أو ChatGPT فهناك أيضًا موصّل Suno الرسمي (تجريبي) يعمل بحسابك أنت.</p>
          </details>
        </>
      )}
    </div>
  );
}

function PromptField({ label, value, onChange, max, rows = 3, help, single, ltr }) {
  return (
    <div className="mf-field">
      <div className="mf-row mf-row-between">
        <span className="mf-label">{label}</span>
        <span className="mf-row"><Counter value={value} max={max} /><CopyButton text={value} small /></span>
      </div>
      {single
        ? <input className="mf-input" dir={ltr ? 'ltr' : 'auto'} value={value || ''} onChange={(e) => onChange(e.target.value)} />
        : <textarea className="mf-textarea mf-mono" dir={ltr ? 'ltr' : 'auto'} rows={rows} value={value || ''} onChange={(e) => onChange(e.target.value)} />}
      {help ? <p className="mf-help">{help}</p> : null}
    </div>
  );
}
