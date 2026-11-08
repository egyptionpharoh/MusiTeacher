'use client';
// ✍️ الخطوة 1: نوع العمل + الكلمات في أقسام مرنة (الكلمات لا تُعدَّل أبدًا إلا بيد المعلم)
import { useState } from 'react';
import { MODES, SECTION_TYPES, SECTION_BY_ID } from '../core/catalog.js';
import { newSection, sectionLabelAr, splitPastedLyrics, LIMITS } from '../core/project.js';
import { Notice } from './parts.js';

const QUICK_ADD = ['verse', 'chorus', 'pre_chorus', 'bridge', 'intro', 'interlude', 'outro'];

export default function LyricsStep({ project, update }) {
  const [paste, setPaste] = useState('');
  const [showPaste, setShowPaste] = useState(false);
  const [msg, setMsg] = useState(null);
  const { sections } = project;
  const song = project.mode === 'song';

  const setSections = (fn) => update((p) => ({ ...p, sections: fn(p.sections) }));
  const patch = (id, v) => setSections((ss) => ss.map((s) => (s.id === id ? { ...s, ...v } : s)));
  const move = (i, d) => setSections((ss) => { const a = [...ss]; const j = i + d; if (j < 0 || j >= a.length) return ss; [a[i], a[j]] = [a[j], a[i]]; return a; });
  const add = (type) => {
    if (sections.length >= LIMITS.sections) { setMsg({ kind: 'warn', text: `الحد الأقصى ${LIMITS.sections} قسمًا.` }); return; }
    setSections((ss) => [...ss, newSection(type)]);
  };
  const duplicate = (i) => setSections((ss) => (ss.length >= LIMITS.sections ? ss : [...ss.slice(0, i + 1), newSection(ss[i].type, ss[i].text, ss[i].label), ...ss.slice(i + 1)]));
  const remove = (i) => {
    const s = sections[i];
    if (s.text.trim() && !window.confirm('حذف هذا القسم وكلماته؟')) return;
    setSections((ss) => ss.filter((_, k) => k !== i));
  };

  function applyPaste() {
    const parts = splitPastedLyrics(paste);
    if (!parts.length) { setMsg({ kind: 'warn', text: 'لم أجد كلمات في النص الملصوق.' }); return; }
    const hasText = sections.some((s) => s.text.trim());
    if (hasText && !window.confirm('سيتم استبدال الأقسام الحالية بالأقسام المقسمة من النص الملصوق. متابعة؟')) return;
    update((p) => ({ ...p, sections: parts.slice(0, LIMITS.sections) }));
    setPaste(''); setShowPaste(false);
    setMsg({ kind: 'ok', text: `تم التقسيم إلى ${parts.length} أقسام. راجع نوع كل قسم وعدّله إن لزم — الكلمات نفسها لم تتغير.` });
  }

  return (
    <div className="mf-step">
      <div className="mf-field">
        <div className="mf-label">نوع العمل</div>
        <div className="mf-modes">
          {MODES.map((m) => (
            <button key={m.id} type="button" className={`mf-mode${project.mode === m.id ? ' is-on' : ''}`} aria-pressed={project.mode === m.id} onClick={() => update((p) => ({ ...p, mode: m.id }))}>
              <span className="mf-mode-icon">{m.icon}</span>
              <span className="mf-mode-name">{m.ar}</span>
              <span className="mf-mode-desc">{m.desc}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="mf-field">
        <label className="mf-label" htmlFor="mf-title">العنوان <span className="mf-hint">(اختياري)</span></label>
        <input id="mf-title" className="mf-input" dir="auto" maxLength={LIMITS.title} value={project.title} placeholder={song ? 'مثال: نشيد الصباح' : 'مثال: موسيقى افتتاح الحفل'} onChange={(e) => update((p) => ({ ...p, title: e.target.value }))} />
      </div>

      {!song ? (
        <div className="mf-field">
          <label className="mf-label" htmlFor="mf-idea">فكرة المقطوعة أو المشهد</label>
          <textarea id="mf-idea" className="mf-textarea" dir="auto" rows={4} maxLength={LIMITS.extra} value={project.choices.extra}
            placeholder="مثال: موسيقى هادئة تتصاعد تدريجيًا لفيديو تخرج الصف السادس، تبدأ بالعود وتنتهي بأوركسترا فخمة."
            onChange={(e) => update((p) => ({ ...p, choices: { ...p.choices, extra: e.target.value } }))} />
          <p className="mf-help">الوصف بالعربية يستخدمه «المايسترو» (الذكاء الاصطناعي) لكتابة البرومبت. البرومبت الفوري يعتمد على اختيارات الخطوة التالية.</p>
        </div>
      ) : (
        <>
          <div className="mf-row mf-row-between">
            <div className="mf-label">الكلمات مقسمة إلى أقسام <span className="mf-hint">— كلماتك تُرسل كما هي حرفيًا</span></div>
            <button type="button" className="mf-btn mf-btn-ghost mf-btn-sm" onClick={() => setShowPaste((v) => !v)}>{showPaste ? 'إخفاء اللصق' : '📥 لصق الأغنية كاملة'}</button>
          </div>

          {showPaste ? (
            <div className="mf-card mf-card-soft">
              <textarea className="mf-textarea" dir="auto" rows={8} value={paste} onChange={(e) => setPaste(e.target.value)}
                placeholder={'الصق الأغنية هنا. يمكن كتابة عناوين مثل:\nالمذهب\n...\nالكوبليه الأول\n...\nأو اترك سطرًا فارغًا بين المقاطع وسيُكتشف المذهب المكرر تلقائيًا.'} />
              <div className="mf-row"><button type="button" className="mf-btn" onClick={applyPaste} disabled={!paste.trim()}>✂️ تقسيم تلقائي إلى أقسام</button></div>
            </div>
          ) : null}

          <Notice kind={msg?.kind} onClose={() => setMsg(null)}>{msg?.text}</Notice>

          <ol className="mf-sections">
            {sections.map((s, i) => {
              const info = SECTION_BY_ID[s.type];
              const lines = s.text.split('\n').filter((l) => l.trim()).length;
              const noText = s.type === 'interlude';
              return (
                <li key={s.id} className={`mf-section mf-sec-${s.type}`}>
                  <div className="mf-section-head">
                    <span className="mf-section-num">{i + 1}</span>
                    <select className="mf-select" value={s.type} aria-label="نوع القسم" onChange={(e) => patch(s.id, { type: e.target.value })}>
                      {SECTION_TYPES.map((t) => <option key={t.id} value={t.id}>{t.ar} ({t.en})</option>)}
                    </select>
                    <span className="mf-section-name">{sectionLabelAr(s, sections)}</span>
                    <span className="mf-section-tools">
                      <button type="button" className="mf-icon" onClick={() => move(i, -1)} disabled={i === 0} title="تحريك لأعلى" aria-label="تحريك لأعلى">↑</button>
                      <button type="button" className="mf-icon" onClick={() => move(i, 1)} disabled={i === sections.length - 1} title="تحريك لأسفل" aria-label="تحريك لأسفل">↓</button>
                      <button type="button" className="mf-icon" onClick={() => duplicate(i)} title="تكرار القسم (مثل تكرار المذهب)" aria-label="تكرار">⧉</button>
                      <button type="button" className="mf-icon mf-icon-danger" onClick={() => remove(i)} title="حذف" aria-label="حذف">🗑</button>
                    </span>
                  </div>
                  {noText ? <p className="mf-help">فاصل موسيقي بدون غناء — اختر آلاته من الخطوة التالية.</p> : (
                    <>
                      <textarea className="mf-textarea mf-lyrics" dir="auto" rows={Math.min(10, Math.max(3, lines + 1))} maxLength={LIMITS.sectionText} value={s.text}
                        placeholder={info.hint} onChange={(e) => patch(s.id, { text: e.target.value })} />
                      <div className="mf-section-foot">{lines ? `${lines} سطر` : (s.type === 'intro' || s.type === 'outro' ? 'بدون كلمات = عزف فقط' : 'اكتب الكلمات')}</div>
                    </>
                  )}
                </li>
              );
            })}
          </ol>

          <div className="mf-chips mf-add">
            <span className="mf-chips-group">إضافة قسم:</span>
            {QUICK_ADD.map((t) => <button key={t} type="button" className="mf-chip mf-chip-add" onClick={() => add(t)}>＋ {SECTION_BY_ID[t].ar}</button>)}
          </div>
        </>
      )}
    </div>
  );
}
