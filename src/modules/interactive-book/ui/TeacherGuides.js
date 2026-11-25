'use client';
// «أدلة المعلم الرقمية»: مساحتان منفصلتان بوضوح —
//  (1) الوصول إلى دليل الصف على موقعه الخارجي (رابط فقط، لا نخزّن الكتاب)
//  (2) «أضف دليلك إلى مكتبتك التفاعلية»: ملف PDF يملكه المعلم يتحول إلى كتاب تفاعلي بمحرك العرض نفسه.
import React, { useMemo, useRef, useState } from 'react';
import Icon from './icons.js';
import { GRADE_OPTIONS, gradeLabel, guideFor, GUIDES_CHECKED_ON } from '../data/teacherGuides.js';
import { validateFile } from '../core/process.js';
import { LIMITS } from '../core/pdf.js';

const fmtSize = (b) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} م.ب` : `${Math.max(1, Math.round(b / 1024))} ك.ب`);

function GradeSelect({ id, value, onChange, placeholder }) {
  return (
    <select id={id} className="ib-select" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{placeholder}</option>
      {GRADE_OPTIONS.map((g) => <option key={g.grade} value={String(g.grade)}>{g.label}</option>)}
    </select>
  );
}

/** (1) الوصول السريع إلى دليل الصف على الموقع الذي يستضيفه */
function GuideLinks() {
  const [grade, setGrade] = useState('');
  const guide = grade ? guideFor(grade) : null;
  return (
    <section className="ib-gpanel" aria-labelledby="ib-g1-h">
      <div className="ib-gpanel__icon is-link"><Icon name="external" size={26} /></div>
      <h3 id="ib-g1-h">دليل المعلم حسب الصف</h3>
      <p className="ib-gpanel__lead">اختر صفّك، ونفتح لك صفحة دليل المعلم على الموقع الذي يستضيفه في تبويب جديد.</p>
      <label className="ib-field" htmlFor="ib-g1-grade">
        <span>الصف الدراسي</span>
        <GradeSelect id="ib-g1-grade" value={grade} onChange={setGrade} placeholder="اختر الصف الدراسي…" />
      </label>
      {grade && guide ? (
        <div className="ib-glink" aria-live="polite">
          <a className="ib-btn ib-btn--hero" href={guide.href} target="_blank" rel="noopener noreferrer"
            aria-label={`افتح دليل المعلم — ${guide.label} (يفتح في تبويب جديد)`}>
            <Icon name="book" size={20} /> افتح دليل المعلم — {guide.label} <Icon name="external" size={16} />
          </a>
          <p className="ib-glink__site"><Icon name="globe" size={14} /> {guide.site}</p>
          {guide.hint ? <p className="ib-glink__hint">{guide.hint}</p> : null}
          {guide.check === 'unverified' ? <p className="ib-glink__warn">لم نتمكن من فحص هذه الصفحة آليًا. إن لم تفتح معك، أخبرنا عبر «صندوق الاقتراحات السرية» لنحدّث الرابط.</p> : null}
        </div>
      ) : null}
      {grade && !guide ? <p className="ib-glink__warn" role="status">لا يتوفر حاليًا رابط صالح لدليل {gradeLabel(grade)}. نعمل على تحديثه.</p> : null}
      <p className="ib-gpanel__fine">الأدلة مستضافة على مواقع خارجية، وMusiTeacher لا يخزّنها ولا يتحكم في محتواها. بعض الصفحات وسيطة (صفحة تحميل أو تحويل إلى Google Drive). آخر فحص للروابط: {GUIDES_CHECKED_ON}.</p>
    </section>
  );
}

/** (2) إضافة دليل يملكه المعلم إلى مكتبته التفاعلية */
function AddGuide({ job, onAdd, guides, onOpen, onReplace, onRemove, onRegrade }) {
  const [file, setFile] = useState(null);
  const [grade, setGrade] = useState('');
  const [agree, setAgree] = useState(false);
  const [err, setErr] = useState('');
  const [checking, setChecking] = useState(false);
  const inputRef = useRef(null);
  const replaceRef = useRef(null);
  const [replacing, setReplacing] = useState(null);

  const busy = !!job;
  const pick = async (f) => {
    setErr(''); setFile(null);
    if (!f) return;
    setChecking(true);
    try { await validateFile(f); setFile(f); } catch (e) { setErr(e.message || 'تعذّر قراءة الملف.'); } finally { setChecking(false); }
  };
  const submit = async (e) => {
    e.preventDefault();
    if (!file) { setErr('اختر ملف PDF أولًا.'); return; }
    if (!grade) { setErr('حدّد الصف الذي ينتمي إليه الدليل.'); return; }
    if (!agree) { setErr('أكّد أن لديك حق استخدام هذا الملف.'); return; }
    setErr('');
    const ok = await onAdd(file, { grade: Number(grade) });
    if (ok) { setFile(null); setAgree(false); setGrade(''); }
  };
  const sorted = useMemo(() => [...guides].sort((a, b) => (a.grade || 99) - (b.grade || 99) || a.name.localeCompare(b.name, 'ar')), [guides]);
  const jobHere = job && job.meta && job.meta.kind === 'guide';
  const pct = jobHere && job.total ? Math.round((job.done / job.total) * 100) : 0;

  return (
    <section className="ib-gpanel" aria-labelledby="ib-g2-h">
      <div className="ib-gpanel__icon is-upload"><Icon name="upload" size={26} /></div>
      <h3 id="ib-g2-h">أضف دليلك إلى مكتبتك التفاعلية</h3>
      <p className="ib-gpanel__lead">لديك نسخة PDF من دليل المعلم على جهازك؟ أضفها لتتحول إلى كتاب تفاعلي تقلّب صفحاته وتشرح عليه.</p>

      <form className="ib-gform" onSubmit={submit}>
        <input ref={inputRef} type="file" accept="application/pdf,.pdf" hidden
          onChange={(e) => { const f = e.target.files && e.target.files[0]; e.target.value = ''; pick(f); }} />
        <button type="button" className="ib-btn ib-btn--ghost ib-gform__pick" disabled={busy || checking} onClick={() => inputRef.current && inputRef.current.click()}>
          <Icon name="upload" size={18} /> {file ? 'اختيار ملف آخر' : 'رفع دليل المعلم'}
        </button>
        {checking ? <p className="ib-muted" role="status">جارٍ فحص الملف…</p> : null}
        {file ? (
          <div className="ib-gfile" role="status">
            <Icon name="single" size={22} />
            <div><b title={file.name}>{file.name}</b><small>{fmtSize(file.size)}</small></div>
            <button type="button" className="ib-tb" aria-label="إزالة الملف المختار" onClick={() => setFile(null)} disabled={busy}><Icon name="close" size={16} /></button>
          </div>
        ) : <p className="ib-gform__limit">PDF فقط · حتى {LIMITS.maxBytes / 1048576} ميغابايت و{LIMITS.maxPages} صفحة</p>}

        <label className="ib-field" htmlFor="ib-g2-grade">
          <span>الصف الذي ينتمي إليه الدليل</span>
          <GradeSelect id="ib-g2-grade" value={grade} onChange={setGrade} placeholder="اختر الصف…" />
        </label>
        <label className="ib-check">
          <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
          <span>أؤكد أن لديّ حق استخدام هذا الملف، وأنه لاستخدامي الشخصي في التدريس.</span>
        </label>

        {jobHere ? (
          <div className="ib-job ib-job--inline" role="status" aria-live="polite">
            <span>{job.stage === 'pages' ? `جارٍ تجهيز الصفحات: ${job.done} من ${job.total}` : job.stage === 'save' ? 'جارٍ الحفظ في مكتبتك…' : 'جارٍ فحص الملف…'}</span>
            <div className="ib-job__bar"><i style={{ width: `${job.stage === 'save' ? 100 : pct}%` }} /></div>
            <span className="ib-job__pct">{job.stage === 'pages' ? `${pct}٪` : ''}</span>
          </div>
        ) : (
          <button type="submit" className="ib-btn ib-btn--wide" disabled={busy || checking || !file}>
            <Icon name="library" size={18} /> إضافة إلى مكتبتي
          </button>
        )}
        {err ? <p className="ib-gform__err" role="alert">{err}</p> : null}
      </form>

      <div className="ib-myguides">
        <h4>أدلتي في المكتبة {guides.length ? <span className="ib-count">{guides.length}</span> : null}</h4>
        {!sorted.length ? <p className="ib-muted ib-myguides__empty">لم تُضف أي دليل بعد.</p> : (
          <ul>
            {sorted.map((b) => (
              <li key={b.id}>
                <span className="ib-gbadge">{b.grade ? gradeLabel(b.grade) : 'بلا صف'}</span>
                <button type="button" className="ib-myguides__name" onClick={() => onOpen(b.id)} title={b.name}>{b.name}</button>
                <span className="ib-myguides__acts">
                  <select className="ib-select ib-select--sm" aria-label={`تغيير صف «${b.name}»`} value={b.grade ? String(b.grade) : ''} onChange={(e) => onRegrade(b, e.target.value)} disabled={busy}>
                    <option value="">بلا صف</option>
                    {GRADE_OPTIONS.map((g) => <option key={g.grade} value={String(g.grade)}>{g.label}</option>)}
                  </select>
                  <button type="button" className="ib-tb" data-tip="فتح" aria-label={`فتح ${b.name}`} onClick={() => onOpen(b.id)}><Icon name="book" size={17} /></button>
                  <button type="button" className="ib-tb" data-tip="استبدال الملف" aria-label={`استبدال ملف ${b.name}`} disabled={busy}
                    onClick={() => { setReplacing(b); if (replaceRef.current) replaceRef.current.click(); }}><Icon name="swap" size={17} /></button>
                  <button type="button" className="ib-tb ib-tb--danger" data-tip="حذف" aria-label={`حذف ${b.name}`} disabled={busy} onClick={() => onRemove(b)}><Icon name="trash" size={17} /></button>
                </span>
              </li>
            ))}
          </ul>
        )}
        <input ref={replaceRef} type="file" accept="application/pdf,.pdf" hidden
          onChange={(e) => { const f = e.target.files && e.target.files[0]; e.target.value = ''; const r = replacing; setReplacing(null); if (f && r) onReplace(r, f); }} />
      </div>
      <p className="ib-gpanel__fine">يُحفظ الدليل في مكتبتك على هذا المتصفح ومرتبطًا بحسابك فقط: لا يُرفع إلى خوادم MusiTeacher، ولا يظهر لأي معلم آخر، ولا يُنشر في أي مكتبة عامة.</p>
    </section>
  );
}

export default function TeacherGuides(props) {
  return (
    <div className="ib-guides">
      <div className="ib-guides__intro">
        <h2><Icon name="book" size={22} /> أدلة المعلم الرقمية</h2>
        <p>طريقتان منفصلتان: افتح دليل صفّك من مصدره على الإنترنت، أو أضف نسختك الخاصة لتعمل عليها ككتاب تفاعلي.</p>
      </div>
      <div className="ib-guides__grid">
        <GuideLinks />
        <AddGuide {...props} />
      </div>
    </div>
  );
}
