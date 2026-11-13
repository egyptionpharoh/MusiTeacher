'use client';
// 📥 استيراد جدول جاهز: رفع → قراءة (محلية أو ذكية) → مراجعة وتصحيح → اعتماد. لا شيء يُعتمد دون مراجعة المعلم.
import { useRef, useState } from 'react';
import { Icon, Modal, Field, Seg } from './parts';
import { WeekGrid } from './ScheduleView';
import { importFile, IMPORT_ACCEPT } from './files';
import { DAY_NAMES, fmtTime, parseHHMM } from '../core/time.js';
import { applyDraft } from '../core/parse.js';
import { emptyProfile, normalizeProfile } from '../core/model.js';

export default function ImportWizard({ onClose, onApply, ai, aiReady, activeProfile }) {
  const [stage, setStage] = useState('pick');   // pick | busy | review
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [res, setRes] = useState(null);
  const [draft, setDraft] = useState(null);
  const [dest, setDest] = useState('new');
  const [cell, setCell] = useState(null);
  const [drag, setDrag] = useState(false);
  const abortRef = useRef(null);

  const run = async (file) => {
    if (!file) return;
    setErr(''); setStage('busy'); setMsg('نقرأ الملف...');
    const ac = new AbortController(); abortRef.current = ac;
    try {
      const r = await importFile(file, { ai: aiReady ? (payload) => ai(payload, ac.signal) : null, onStage: setMsg });
      if (!r.ok) { setErr(r.error || 'تعذر قراءة الجدول.'); setStage('pick'); return; }
      setRes({ ...r, name: file.name });
      setDraft(r.draft);
      setStage('review');
    } catch (e) {
      if (e && e.code === 'aborted') { setStage('pick'); return; }
      setErr((e && e.message) || 'حدث خطأ أثناء القراءة.'); setStage('pick');
    }
  };

  const setPeriod = (id, k, v) => setDraft((d) => ({ ...d, periods: d.periods.map((p) => (p.id === id ? { ...p, [k]: v, uncertain: false } : p)) }));
  const missingTimes = draft ? draft.periods.filter((p) => !p.start || !p.end || parseHHMM(p.end) <= parseHHMM(p.start)).length : 0;
  const unsure = draft ? Object.values(draft.lessons).reduce((a, r) => a + Object.values(r).filter((l) => l.uncertain).length, 0) : 0;

  const approve = () => {
    const base = dest === 'replace' ? activeProfile : emptyProfile({ name: res.name.replace(/\.[^.]+$/, '').slice(0, 60) || 'جدول مستورد', teacher: activeProfile.teacher, school: activeProfile.school, subject: activeProfile.subject, tz: activeProfile.tz, plan: activeProfile.plan });
    onApply(normalizeProfile(applyDraft(base, draft)), dest);
  };

  return (
    <Modal title="استيراد جدول جاهز" onClose={onClose} wide
      footer={stage === 'review' ? <>
        <button type="button" className="ca-btn" onClick={approve} disabled={missingTimes > 0}><Icon n="check" />اعتماد الجدول</button>
        <button type="button" className="ca-btn is-ghost" onClick={() => { setStage('pick'); setRes(null); }}>ملف آخر</button>
      </> : null}>
      {stage === 'pick' && (
        <>
          <label className={`ca-drop${drag ? ' is-drag' : ''}`} onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={(e) => { e.preventDefault(); setDrag(false); run(e.dataTransfer.files[0]); }}>
            <Icon n="upload" size={36} />
            <strong>اسحب ملف الجدول هنا أو انقر للاختيار</strong>
            <span>Excel (xlsx, xls) • CSV • Word (docx) • PDF • صورة (JPG, PNG)</span>
            <input type="file" accept={IMPORT_ACCEPT} onChange={(e) => { const f = e.target.files[0]; e.target.value = ''; run(f); }} />
          </label>
          {err && <div className="ca-notice is-err" role="alert"><Icon n="warn" /><span>{err}</span></div>}
          <ul className="ca-tips">
            <li><b>Excel وWord وCSV</b> تُقرأ على جهازك مباشرة دون رفعها لأي خادم.</li>
            <li><b>الصور وPDF</b> {aiReady ? 'تُرسل مؤقتًا إلى خدمة القراءة الذكية عبر خادم المنصة لاستخراج الجدول، ولا تُحفظ هناك.' : 'تحتاج خدمة القراءة الذكية، وهي غير مفعّلة حاليًا على المنصة.'}</li>
            <li>بعد القراءة ستراجع الجدول وتصحح أي خانة قبل اعتماده. الخانات غير المؤكدة تظهر باللون البرتقالي.</li>
            <li>للحصول على أفضل نتيجة: صورة مستقيمة وواضحة للجدول فقط، تظهر فيها أسماء الأيام وأوقات الحصص.</li>
          </ul>
        </>
      )}
      {stage === 'busy' && (
        <div className="ca-busy" role="status"><span className="ca-spin" aria-hidden="true" /><strong>{msg}</strong><span className="ca-muted">قد تستغرق قراءة الصور بضع ثوانٍ.</span><button type="button" className="ca-btn is-ghost is-sm" onClick={() => abortRef.current && abortRef.current.abort()}>إلغاء</button></div>
      )}
      {stage === 'review' && draft && (
        <div className="ca-stack">
          <div className="ca-notice is-info"><Icon n="info" /><span>تعرّفنا على <b>{res.stats.lessons}</b> حصة في <b>{draft.days.length}</b> أيام و<b>{draft.periods.filter((p) => p.kind === 'lesson').length}</b> حصص يوميًا{res.via === 'ai' ? ' بالقراءة الذكية' : ' من الملف مباشرة'}. راجع كل شيء قبل الاعتماد.</span></div>
          {res.issues.map((t, i) => <div key={i} className="ca-notice is-warn"><Icon n="warn" /><span>{t}</span></div>)}

          <div className="ca-card is-flat">
            <div className="ca-label">أيام العمل</div>
            <div className="ca-row ca-wrap">{[0, 1, 2, 3, 4, 5, 6].map((d) => <button type="button" key={d} className={`ca-chip ca-chip-btn${draft.days.includes(d) ? ' is-on' : ''}`} onClick={() => setDraft({ ...draft, days: draft.days.includes(d) ? draft.days.filter((x) => x !== d) : [...draft.days, d].sort() })}>{DAY_NAMES[d]}</button>)}</div>
          </div>

          <div className="ca-card is-flat">
            <div className="ca-label">أوقات الحصص {missingTimes > 0 && <span className="ca-error">— أكمل {missingTimes} توقيت ناقص</span>}</div>
            <div className="ca-periods">
              {draft.periods.map((p) => (
                <div key={p.id} className={`ca-period${p.kind === 'break' ? ' is-break' : ''}${!p.start || !p.end || p.uncertain ? ' is-bad' : ''}`}>
                  <span className="ca-period-name"><b>{p.kind === 'break' ? p.name || 'استراحة' : `الحصة ${p.label}`}</b></span>
                  <label className="ca-time"><span>من</span><input className="ca-input" type="time" value={p.start} onChange={(e) => setPeriod(p.id, 'start', e.target.value)} /></label>
                  <label className="ca-time"><span>إلى</span><input className="ca-input" type="time" value={p.end} onChange={(e) => setPeriod(p.id, 'end', e.target.value)} /></label>
                  <span className="ca-muted ca-small">{p.uncertain && p.start ? 'غير مؤكد' : ''}</span>
                  <button type="button" className="ca-icon-btn" onClick={() => setDraft({ ...draft, periods: draft.periods.filter((x) => x.id !== p.id) })} aria-label="حذف"><Icon n="trash" size={16} /></button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="ca-label">الجدول المستخرج {unsure > 0 && <span className="ca-warn-text">— {unsure} خانة تحتاج مراجعة</span>}</div>
            <WeekGrid data={draft} subject={activeProfile.subject} onCell={(d, p) => setCell({ d, p })} />
          </div>

          <div className="ca-card is-flat">
            <div className="ca-label">أين نحفظ الجدول؟</div>
            <Seg label="الوجهة" value={dest} onChange={setDest} options={[{ id: 'new', label: 'جدول جديد (أحتفظ بالحالي)' }, { id: 'replace', label: `استبدال «${activeProfile.name}»` }]} />
            {dest === 'replace' && <p className="ca-muted ca-small">ستُستبدل الحصص والأوقات فقط؛ بيانات المعلم والمدرسة وخطة التنبيه والإجازات تبقى كما هي.</p>}
          </div>
        </div>
      )}
      {cell && <DraftCell draft={draft} d={cell.d} p={cell.p} onClose={() => setCell(null)} onSave={(l) => { setDraft((dr) => { const lessons = JSON.parse(JSON.stringify(dr.lessons)); if (l) (lessons[cell.d] ||= {})[cell.p.id] = l; else if (lessons[cell.d]) delete lessons[cell.d][cell.p.id]; return { ...dr, lessons }; }); setCell(null); }} />}
    </Modal>
  );
}

function DraftCell({ draft, d, p, onClose, onSave }) {
  const cur = (draft.lessons[d] || {})[p.id] || { subject: '', grade: '', section: '', room: '' };
  const [l, setL] = useState(cur);
  const set = (k) => (e) => setL({ ...l, [k]: e.target.value });
  return (
    <Modal title={`${DAY_NAMES[d]} – الحصة ${p.label}${p.start ? ` (${fmtTime(p.start)})` : ''}`} onClose={onClose}
      footer={<><button type="button" className="ca-btn" onClick={() => onSave({ subject: l.subject, grade: l.grade, section: l.section, room: l.room })}><Icon n="check" />تأكيد</button><button type="button" className="ca-btn is-danger" onClick={() => onSave(null)}><Icon n="trash" />خانة فارغة</button></>}>
      {cur.uncertain && <div className="ca-notice is-warn"><Icon n="warn" /><span>لم نتأكد من قراءة هذه الخانة؛ صححها حسب الجدول الأصلي.</span></div>}
      <div className="ca-grid2">
        <Field label="الصف"><input className="ca-input" value={l.grade} onChange={set('grade')} /></Field>
        <Field label="الشعبة"><input className="ca-input" value={l.section} onChange={set('section')} /></Field>
        <Field label="المادة"><input className="ca-input" value={l.subject} onChange={set('subject')} /></Field>
        <Field label="القاعة"><input className="ca-input" value={l.room} onChange={set('room')} /></Field>
      </div>
    </Modal>
  );
}
