'use client';
// «تقرير التكريم»: ملخص للإدارة يملؤه المعلم بعد التطبيق — لا أرقام مسبقة. الأرقام تُحسب من المتابعة إن كانت مفعّلة، أو تُكتب يدويًا.
import { useMemo } from 'react';
import { totals, summary, honorees, fmtDate, todayISO } from '../core/tracker.js';
import { HONOR_TYPES, HONOR_PERIODS } from '../data/content.js';
import { Ico, Field } from './parts.js';
import { SettingsForm } from './Designer.js';

export function reportModel(state, now = new Date()) {
  const r = state.report;
  const range = { from: r.from, to: r.to };
  const auto = state.tracking && state.students.length > 0;
  const rows = auto ? totals(state, range) : [];
  const sum = auto ? summary(state, range) : null;
  const hon = auto ? honorees(rows, r.top) : [];
  const manual = !auto ? r.manualHonorees.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).slice(0, 60).map((l) => {
    const m = l.match(/^(.*?)[\s\-–:،,]+(\d{1,4})\s*$/); return m ? { name: m[1].trim(), grade: '', count: m[2] } : { name: l, grade: '', count: '' };
  }) : [];
  return {
    s: state.settings, r, auto,
    period: r.periodLabel || (r.from || r.to ? `${fmtDate(r.from) || '…'} – ${fmtDate(r.to) || '…'}` : ''),
    participants: auto ? String(sum.participants) : r.participants,
    coupons: auto ? String(sum.coupons) : r.coupons,
    honorees: auto ? hon.map((h) => ({ name: h.student.name, grade: h.student.grade, count: String(h.count), reasons: h.topReasons.join('، ') })) : manual,
    date: fmtDate(todayISO(now)),
  };
}

const Blank = ({ v, w = 30 }) => (v ? <b>{v}</b> : <span className="ec-rline" style={{ width: `${w}mm` }} />);

export function ReportDoc({ model }) {
  const { s, r } = model;
  return (
    <article className="ec-report" dir="rtl">
      <header className="ec-rep-head">
        <div><small>تقرير مبادرة</small><h1>«{s.initiativeName}»</h1><p>كروت تحفيزية لتقدير الجهد والإبداع والتميز</p></div>
        <div className="ec-rep-star" aria-hidden="true">★</div>
      </header>
      <table className="ec-rep-info"><tbody>
        <tr><th>المدرسة</th><td><Blank v={s.school} w={60} /></td><th>{s.teacherGender === 'f' ? 'المعلمة المنفذة' : 'المعلم المنفذ'}</th><td><Blank v={s.teacher} w={50} /></td></tr>
        <tr><th>المادة / النشاط</th><td><Blank v={s.subject} w={40} /></td><th>الصفوف المستهدفة</th><td><Blank v={s.grades} w={40} /></td></tr>
        <tr><th>فترة التطبيق</th><td><Blank v={model.period} w={50} /></td><th>طريقة التكريم</th><td><Blank v={r.honorType} w={45} /></td></tr>
      </tbody></table>
      <div className="ec-rep-nums">
        <div><b>{model.participants || '……'}</b><span>طالبًا حصلوا على كوبون تميز</span></div>
        <div><b>{model.coupons || '……'}</b><span>كوبون تميز ممنوح</span></div>
        <div><b>{model.honorees.length || '……'}</b><span>طالبًا مكرّمًا</span></div>
      </div>
      <h2>الطلبة المكرمون</h2>
      {!r.showNames ? <p className="ec-rep-note">لم تُدرج الأسماء في هذا التقرير وفق سياسة المدرسة.</p> : model.honorees.length ? (
        <table className="ec-rep-table">
          <thead><tr><th>م</th><th>اسم الطالب</th><th>الصف</th><th>عدد الكوبونات</th>{model.auto ? <th>أبرز المعايير</th> : null}</tr></thead>
          <tbody>{model.honorees.map((h, i) => <tr key={i}><td>{i + 1}</td><td>{h.name}</td><td>{h.grade || ''}</td><td>{h.count}</td>{model.auto ? <td>{h.reasons}</td> : null}</tr>)}</tbody>
        </table>
      ) : <p className="ec-rep-note">لم يُحدد المكرمون بعد.</p>}
      <h2>ملاحظات المعلم</h2><p className="ec-rep-text">{r.notes || '……………………………………………………………………………………'}</p>
      <h2>الأثر التربوي الملاحظ</h2><p className="ec-rep-text">{r.impact || '……………………………………………………………………………………'}</p>
      {r.recommendations ? (<><h2>التوصيات</h2><p className="ec-rep-text">{r.recommendations}</p></>) : null}
      <footer className="ec-rep-sign">
        <div><span>{s.teacherGender === 'f' ? 'المعلمة المنفذة' : 'المعلم المنفذ'}</span><Blank v={s.teacher} w={50} /><span>التوقيع: <span className="ec-rline" style={{ width: '35mm' }} /></span></div>
        <div><span>مدير/ة المدرسة</span><span className="ec-rline" style={{ width: '50mm' }} /><span>التوقيع: <span className="ec-rline" style={{ width: '35mm' }} /></span></div>
      </footer>
      <p className="ec-rep-foot">تاريخ التقرير: <bdi dir="ltr">{model.date}</bdi></p>
    </article>
  );
}

export default function Report({ state, update, onPrint, goTracker }) {
  const r = state.report;
  const set = (patch) => update((s) => ({ ...s, report: { ...s.report, ...patch } }));
  const model = useMemo(() => reportModel(state), [state]);
  const auto = model.auto;
  return (
    <div className="ec-reportview">
      <div className="ec-controls">
        <details className="ec-box">
          <summary><Ico n="user" /> بيانات المبادرة والمدرسة</summary>
          <SettingsForm settings={state.settings} onChange={(v) => update((s) => ({ ...s, settings: v }))} />
          <Field label="الصفوف المستهدفة" wide><input className="ec-input" id="ec-rep-grades" value={state.settings.grades} maxLength={80} onChange={(e) => update((s) => ({ ...s, settings: { ...s.settings, grades: e.target.value } }))} placeholder="مثال: من الخامس إلى الثامن" /></Field>
        </details>
        <section className="ec-box">
          <h3><Ico n="cal" /> الفترة والتكريم</h3>
          <div className="ec-form">
            <Field label="اسم الفترة"><input className="ec-input" id="ec-rep-period" list="ec-periods" value={r.periodLabel} maxLength={60} onChange={(e) => set({ periodLabel: e.target.value })} placeholder="مثال: شهر نوفمبر / الفصل الأول" />
              <datalist id="ec-periods">{HONOR_PERIODS.map((p) => <option key={p} value={p} />)}</datalist></Field>
            <Field label="من"><input type="date" className="ec-input" id="ec-rep-from" value={r.from} onChange={(e) => set({ from: e.target.value })} /></Field>
            <Field label="إلى"><input type="date" className="ec-input" id="ec-rep-to" value={r.to} onChange={(e) => set({ to: e.target.value })} /></Field>
            <Field label="طريقة التكريم"><input className="ec-input" list="ec-htypes" value={r.honorType} maxLength={80} onChange={(e) => set({ honorType: e.target.value })} placeholder="شهادة تقدير، هدية رمزية…" />
              <datalist id="ec-htypes">{HONOR_TYPES.map((p) => <option key={p} value={p} />)}</datalist></Field>
            {auto ? <Field label="عدد المكرمين (الأعلى رصيدًا)" hint="يُضم من يتعادل مع آخرهم حتى لا يُظلم أحد."><input type="number" className="ec-input is-num" id="ec-rep-top" min={1} max={50} value={r.top} onChange={(e) => set({ top: Math.min(50, Math.max(1, +e.target.value || 1)) })} /></Field> : null}
          </div>
          <label className="ec-switch"><input type="checkbox" id="ec-rep-names" checked={r.showNames} onChange={(e) => set({ showNames: e.target.checked })} /><span>إدراج أسماء الطلبة المكرمين (وفق سياسة المدرسة)</span></label>
        </section>
        <section className="ec-box">
          <h3><Ico n="chart" /> الأرقام</h3>
          {auto ? <p className="ec-hint ec-ok"><Ico n="check" size={15} /> تُحسب تلقائيًا من «متابعة الكوبونات» للفترة المحددة: {model.participants} طالبًا، {model.coupons} كوبونًا.</p> : (
            <>
              <p className="ec-hint">المتابعة غير مفعّلة — اكتب الأرقام بعد التطبيق، أو <button type="button" className="ec-link" onClick={goTracker}>فعّل المتابعة</button> لتُحسب تلقائيًا.</p>
              <div className="ec-form">
                <Field label="عدد الطلبة المشاركين"><input className="ec-input is-num" inputMode="numeric" value={r.participants} maxLength={6} onChange={(e) => set({ participants: e.target.value.replace(/[^\d٠-٩]/g, '') })} /></Field>
                <Field label="عدد الكوبونات الممنوحة"><input className="ec-input is-num" inputMode="numeric" value={r.coupons} maxLength={6} onChange={(e) => set({ coupons: e.target.value.replace(/[^\d٠-٩]/g, '') })} /></Field>
              </div>
              <Field label="الطلبة المكرمون" hint="سطر لكل طالب، ويمكن كتابة العدد بعد الاسم: «أحمد — 9»" wide><textarea className="ec-input" rows={4} value={r.manualHonorees} onChange={(e) => set({ manualHonorees: e.target.value })} /></Field>
            </>
          )}
        </section>
        <section className="ec-box">
          <h3><Ico n="edit" /> الملاحظات والأثر</h3>
          <Field label="أبرز ملاحظات المعلم" wide><textarea className="ec-input" id="ec-rep-notes" rows={3} maxLength={2000} value={r.notes} onChange={(e) => set({ notes: e.target.value })} /></Field>
          <Field label="الأثر التربوي الذي رصدته" wide><textarea className="ec-input" rows={3} maxLength={2000} value={r.impact} onChange={(e) => set({ impact: e.target.value })} placeholder="ما الذي تغيّر في دافعية الطلبة ومشاركتهم وسلوكهم؟" /></Field>
          <Field label="توصيات (اختياري)" wide><textarea className="ec-input" rows={2} maxLength={2000} value={r.recommendations} onChange={(e) => set({ recommendations: e.target.value })} /></Field>
        </section>
        <button type="button" className="ec-btn is-primary is-big" id="ec-rep-print" onClick={() => onPrint(<ReportDoc model={model} />)}><Ico n="print" /> طباعة التقرير / حفظه PDF</button>
      </div>
      <div className="ec-rep-preview" aria-label="معاينة التقرير"><div className="ec-rep-paper"><ReportDoc model={model} /></div></div>
    </div>
  );
}
