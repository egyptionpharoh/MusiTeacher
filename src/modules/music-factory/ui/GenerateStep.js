'use client';
// 🎧 الخطوة 4: التوليد الفعلي عبر محرك حقيقي + المشغل + التحميل + المكتبة.
// لا نعرض أي صوت تجريبي أو وهمي: إن لم يتوفر محرك نقول ذلك بوضوح ونترك البرومبت جاهزًا للنسخ.
import { useEffect, useRef, useState } from 'react';
import { listTracks, saveTrack, deleteTrack } from './library.js';
import { Notice, Spinner } from './parts.js';

const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
// اسم ملف التحميل: بعض المتصفحات تتجاهل الأسماء العربية في التحميل (فتسميه download)، لذلك نستخدم اسمًا لاتينيًا آمنًا
const safe = (t, when = Date.now()) => {
  const ascii = String(t || '').replace(/[^A-Za-z0-9 _-]+/g, ' ').trim().replace(/\s+/g, '-').slice(0, 50);
  const d = new Date(when), z = (n) => String(n).padStart(2, '0');
  return `MusiTeacher-${ascii || 'music'}-${d.getFullYear()}${z(d.getMonth() + 1)}${z(d.getDate())}-${z(d.getHours())}${z(d.getMinutes())}`;
};

export default function GenerateStep({ project, output, api, status, statusError, reloadStatus, onRestore, onBusy, goPrompt }) {
  const song = project.mode === 'song';
  const modeKey = song ? 'song' : 'instrumental';
  const [engine, setEngine] = useState('auto');
  const [quality, setQuality] = useState('preview');
  const [allowFallback, setAllowFallback] = useState(true);
  const [ack, setAck] = useState(false);
  const [busy, setBusy] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [library, setLibrary] = useState([]);
  const abortRef = useRef(null);
  const urlsRef = useRef([]);

  useEffect(() => { listTracks().then(setLibrary); }, []);
  useEffect(() => () => { urlsRef.current.forEach((u) => URL.revokeObjectURL(u)); }, []);
  useEffect(() => {
    if (!busy) return undefined;
    const t0 = Date.now();
    const iv = setInterval(() => setElapsed(Math.round((Date.now() - t0) / 1000)), 1000);
    const warn = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => { clearInterval(iv); window.removeEventListener('beforeunload', warn); };
  }, [busy]);

  const objectUrl = (blob) => { const u = URL.createObjectURL(blob); urlsRef.current.push(u); return u; };

  const engines = status?.audio?.engines || [];
  const capable = (e) => e.configured && (song ? e.vocals : e.instrumental);
  const autoList = (status?.audio?.auto?.[modeKey] || []).map((id) => engines.find((e) => e.id === id)).filter(Boolean)
    .filter((e) => quality !== 'preview' || e.preview);
  const chosen = engine === 'auto' ? null : engines.find((e) => e.id === engine);
  const ready = !!status && (engine === 'auto' ? autoList.length > 0 : !!chosen && capable(chosen) && (quality !== 'preview' || chosen.preview));
  const needAck = chosen && !chosen.official;
  const hasPrompt = !!(output && output.style && output.style.trim().length >= 10);
  const receivers = engine === 'auto' ? (allowFallback ? autoList : autoList.slice(0, 1)) : chosen ? [chosen] : [];

  useEffect(() => { if (chosen && !capable(chosen)) setEngine('auto'); }, [modeKey]); // eslint-disable-line react-hooks/exhaustive-deps

  async function generate() {
    setBusy(true); setError(null); setResult(null); setElapsed(0); onBusy?.(true);
    const ac = new AbortController(); abortRef.current = ac;
    const payload = { project, mode: project.mode, engine, quality, allowFallback, durationSec: project.choices.durationSec, output: { style: output.style, lyrics: output.lyrics, title: output.title, exclude: output.exclude } };
    try {
      const r = await api.generate(payload, ac.signal);
      const meta = r.meta || {};
      const base = { title: output.title || project.title || 'بدون عنوان', mode: project.mode, quality, engine: meta.engine, label: meta.label, model: meta.model, official: meta.official, attempts: meta.attempts || [], prompt: payload.output, project };
      if (r.kind === 'audio') {
        const ext = /wav/.test(r.blob.type) ? 'wav' : 'mp3';
        const saved = await saveTrack({ ...base, mime: r.blob.type, ext, blob: r.blob });
        setResult({ ...base, tracks: [{ src: objectUrl(r.blob), ext, blob: r.blob }], saved });
      } else {
        // محركات تعيد روابط (Replicate / Suno): نحاول نسخ الملف للمكتبة، وإلا نحفظ الرابط مع تنبيه
        const tracks = [];
        let linkOnly = false;
        for (const t of r.tracks) {
          let blob = null;
          try { const g = await fetch(t.url); if (g.ok) blob = await g.blob(); } catch { /* CORS */ }
          if (!blob) linkOnly = true;
          tracks.push({ src: blob ? objectUrl(blob) : t.url, ext: t.ext || 'mp3', blob, url: t.url });
        }
        const saved = await saveTrack({ ...base, mime: 'audio/mpeg', ext: 'mp3', blob: tracks[0].blob || null, url: tracks[0].blob ? null : tracks[0].url, extra: tracks.slice(1).map((t) => ({ url: t.url })) });
        setResult({ ...base, tracks, saved, linkOnly });
      }
      setLibrary(await listTracks());
    } catch (e) {
      setError({ message: e.message, attempts: e.attempts || [], aborted: !!e.aborted, notConfigured: !!e.notConfigured });
      if (e.notConfigured) reloadStatus?.();
    } finally { setBusy(false); onBusy?.(false); abortRef.current = null; }
  }

  async function remove(id) {
    if (!window.confirm('حذف هذا العمل من مكتبتك على هذا الجهاز؟')) return;
    await deleteTrack(id); setLibrary(await listTracks());
  }

  const failedFirst = result && result.attempts.filter((a) => !a.ok);

  return (
    <div className="mf-step">
      {!hasPrompt ? (
        <Notice kind="warn">لا يوجد برومبت بعد. <button type="button" className="mf-link" onClick={goPrompt}>ارجع لخطوة البرومبت</button> وأنشئه أولًا.</Notice>
      ) : null}

      {statusError ? <Notice kind="error">{statusError} <button type="button" className="mf-link" onClick={reloadStatus}>إعادة المحاولة</button></Notice> : null}
      {status && !status.audio.ready[modeKey] ? (
        <Notice kind="warn">
          <b>لم يُضبط على الخادم أي محرك {song ? 'لتوليد الأغاني' : 'لتوليد الموسيقى'} بعد.</b> يحتاج مدير المنصة لإضافة مفتاح محرك (مثل <code>ELEVENLABS_API_KEY</code>) في إعدادات Vercel.
          {' '}حتى ذلك الحين يمكنك نسخ البرومبت من الخطوة السابقة واستخدامه في Suno أو غيره.
        </Notice>
      ) : null}

      <div className="mf-field">
        <div className="mf-label">محرك التوليد</div>
        <div className="mf-engines">
          <label className={`mf-engine${engine === 'auto' ? ' is-on' : ''}`}>
            <input type="radio" name="mf-engine" checked={engine === 'auto'} onChange={() => setEngine('auto')} />
            <span className="mf-engine-name">✨ تلقائي</span>
            <span className="mf-engine-note">أفضل محرك رسمي متاح{autoList.length ? `: ${autoList.map((e) => e.label).join(' ← ')}` : ''}</span>
          </label>
          {engines.map((e) => {
            const ok = capable(e);
            const why = !e.configured ? 'غير مُعد على الخادم' : !ok ? (song ? 'لا يغني' : 'لا يدعم هذا النوع') : '';
            return (
              <label key={e.id} className={`mf-engine${engine === e.id ? ' is-on' : ''}${ok ? '' : ' is-off'}`}>
                <input type="radio" name="mf-engine" checked={engine === e.id} disabled={!ok} onChange={() => { setEngine(e.id); setAck(false); }} />
                <span className="mf-engine-name">{e.label}</span>
                <span className="mf-badges">
                  <span className={`mf-pill ${e.official ? 'mf-pill-ok' : 'mf-pill-bad'}`}>{e.official ? 'رسمي' : 'غير رسمي'}</span>
                  <span className="mf-pill mf-pill-soft">{e.vocals ? 'غناء + موسيقى' : 'موسيقى فقط'}</span>
                  {why ? <span className="mf-pill mf-pill-soft">{why}</span> : null}
                </span>
                <span className="mf-engine-note">{e.note_ar}</span>
              </label>
            );
          })}
        </div>
        {status?.audio?.suno ? <p className="mf-help">🎵 Suno: {status.audio.suno.note_ar}</p> : null}
      </div>

      {needAck ? (
        <label className="mf-ack">
          <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} />
          أفهم أن هذا المحرك غير رسمي، وقد يخالف شروط الخدمة ويعرّض الحساب المرتبط به للإيقاف، وأن كلماتي ستُرسل إليه.
        </label>
      ) : null}

      <div className="mf-grid-2">
        <div className="mf-field">
          <div className="mf-label">الجودة والمدة</div>
          <div className="mf-chips">
            <button type="button" className={`mf-chip${quality === 'preview' ? ' is-on' : ''}`} onClick={() => setQuality('preview')}>⚡ معاينة ~30 ثانية (أسرع وأرخص)</button>
            <button type="button" className={`mf-chip${quality === 'full' ? ' is-on' : ''}`} onClick={() => setQuality('full')}>🎼 نسخة كاملة (حتى {fmt(status?.audio?.maxSeconds || 240)})</button>
          </div>
        </div>
        {engine === 'auto' ? (
          <div className="mf-field">
            <div className="mf-label">عند فشل المحرك الأول</div>
            <label className="mf-ack mf-ack-soft">
              <input type="checkbox" checked={allowFallback} onChange={(e) => setAllowFallback(e.target.checked)} />
              جرّب المحرك الرسمي التالي تلقائيًا
            </label>
          </div>
        ) : null}
      </div>

      <p className="mf-privacy">🔒 عند الضغط على «توليد» تُرسل الكلمات والبرومبت إلى: <b>{receivers.length ? receivers.map((e) => e.label).join(' ثم ') : '—'}</b> فقط. المفاتيح محفوظة على الخادم ولا تصل للمتصفح. كل توليد يستهلك من رصيد المنصة لدى المزوّد.</p>

      <div className="mf-generate">
        {!busy ? (
          <button type="button" className="mf-btn mf-btn-hero" onClick={generate} disabled={!hasPrompt || !ready || (needAck && !ack)}>
            🎧 {song ? 'توليد الأغنية' : 'توليد الموسيقى'}
          </button>
        ) : (
          <div className="mf-progress" role="status" aria-live="polite">
            <Spinner /> جاري التوليد… {fmt(elapsed)}
            <span className="mf-help">قد يستغرق من 30 ثانية إلى 4 دقائق. لا تغلق الصفحة.</span>
            <button type="button" className="mf-btn mf-btn-ghost mf-btn-sm" onClick={() => abortRef.current?.abort()}>إلغاء</button>
          </div>
        )}
      </div>

      {error ? (
        <Notice kind={error.aborted ? 'warn' : 'error'} onClose={() => setError(null)}>
          <b>{error.aborted ? 'تم إلغاء التوليد.' : 'لم يكتمل التوليد.'}</b> {error.aborted || error.attempts?.length ? '' : error.message}
          {error.attempts?.length ? <ul className="mf-attempts">{error.attempts.map((a, i) => <li key={i}>{a.label || a.engine}: {a.ok ? 'نجح' : a.error}</li>)}</ul> : null}
          <div className="mf-help">كلماتك وإعداداتك والبرومبت محفوظة كما هي. يمكنك المحاولة مرة أخرى أو اختيار محرك آخر.</div>
        </Notice>
      ) : null}

      {result ? (
        <div className="mf-card mf-result">
          <div className="mf-row mf-row-between mf-wrap">
            <div>
              <div className="mf-result-title" dir="auto">{result.title}</div>
              <div className="mf-meta">
                المحرك: <b>{result.label}</b> {result.model ? `(${result.model})` : ''} · <span className={`mf-pill ${result.official ? 'mf-pill-ok' : 'mf-pill-bad'}`}>{result.official ? 'رسمي' : 'غير رسمي'}</span> · {result.quality === 'preview' ? 'معاينة' : 'نسخة كاملة'}
              </div>
            </div>
            <span className="mf-pill mf-pill-ok">✔ تم التوليد</span>
          </div>
          {failedFirst?.length ? <Notice kind="info">لم ينجح {failedFirst.map((a) => `${a.label} (${a.error})`).join('، ')} فاستُخدم {result.label}.</Notice> : null}
          {result.tracks.map((t, i) => (
            <div key={i} className="mf-track">
              {result.tracks.length > 1 ? <b>النسخة {i + 1}</b> : null}
              <audio controls preload="metadata" src={t.src} className="mf-audio" />
              <a className="mf-btn mf-btn-sm" href={t.src} download={`${safe(result.title)}${result.tracks.length > 1 ? '-' + (i + 1) : ''}.${t.ext}`} target={t.blob ? undefined : '_blank'} rel="noopener noreferrer">⬇ تحميل</a>
            </div>
          ))}
          <p className="mf-help">
            {result.saved?.persistent ? '📚 حُفظ في مكتبتك على هذا المتصفح.' : '⚠️ لم يُحفظ في مكتبة المتصفح (مساحة ممتلئة أو تصفح خاص) — حمّل الملف الآن.'}
            {result.linkOnly ? ' تنبيه: هذا المحرك أعاد رابطًا مؤقتًا قد تنتهي صلاحيته؛ حمّل الملف الآن.' : ''}
            {result.engine === 'lyria' ? ' ملفات Google Lyria تحمل علامة SynthID غير مسموعة.' : ''}
          </p>
        </div>
      ) : null}

      <div className="mf-field mf-library">
        <div className="mf-label">📚 مكتبتي <span className="mf-hint">(على هذا الجهاز)</span></div>
        {!library.length ? <p className="mf-help">لا توجد أعمال مولدة بعد.</p> : (
          <ul className="mf-lib">
            {library.map((t) => <LibItem key={t.id} t={t} onDelete={() => remove(t.id)} onRestore={() => onRestore(t)} />)}
          </ul>
        )}
      </div>
    </div>
  );
}

function LibItem({ t, onDelete, onRestore }) {
  const [src, setSrc] = useState(null);
  useEffect(() => {
    if (t.blob) { const u = URL.createObjectURL(t.blob); setSrc(u); return () => URL.revokeObjectURL(u); }
    setSrc(t.url || null); return undefined;
  }, [t]);
  return (
    <li className="mf-lib-item">
      <div className="mf-lib-head">
        <b dir="auto">{t.title}</b>
        <span className="mf-meta">{new Date(t.createdAt).toLocaleString('ar')} · {t.mode === 'song' ? 'أغنية' : 'موسيقى'} · {t.label}</span>
      </div>
      {src ? <audio controls preload="none" src={src} className="mf-audio" /> : <span className="mf-help">الملف غير متاح.</span>}
      <div className="mf-row mf-wrap">
        {src ? <a className="mf-btn mf-btn-ghost mf-btn-sm" href={src} download={`${safe(t.title, t.createdAt)}.${t.ext || 'mp3'}`}>⬇ تحميل</a> : null}
        {t.project ? <button type="button" className="mf-btn mf-btn-ghost mf-btn-sm" onClick={onRestore}>↺ استرجاع الكلمات والإعدادات</button> : null}
        <button type="button" className="mf-btn mf-btn-ghost mf-btn-sm mf-danger" onClick={onDelete}>حذف</button>
      </div>
    </li>
  );
}
