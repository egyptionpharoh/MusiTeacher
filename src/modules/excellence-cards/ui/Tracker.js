'use client';
// «متابعة الكوبونات» (اختيارية): أسماء الطلبة على جهاز المعلم فقط، تسجيل كل كوبون بتاريخه ومعياره، ورصيد كل طالب في الفترة.
import { useMemo, useRef, useState } from 'react';
import { newId, exportBackup, importBackup } from '../core/store.js';
import { totals, summary, PERIODS, periodRange, todayISO, fmtDate, toCSV, parseNames } from '../core/tracker.js';
import { downloadText } from './print.js';
import { Ico, Seg, Field } from './parts.js';

export default function Tracker({ state, update, notify, uidKnown, onPrintStudents }) {
  const [periodId, setPeriodId] = useState('all');
  const [custom, setCustom] = useState({ from: '', to: '' });
  const [q, setQ] = useState('');
  const [grade, setGrade] = useState('');
  const [sel, setSel] = useState([]);
  const [award, setAward] = useState({ date: todayISO(), criterion: state.criteria[0] || '', note: '' });
  const [adding, setAdding] = useState({ name: '', grade: '', gender: 'm', bulk: '' });
  const [openHist, setOpenHist] = useState(null);
  const [editing, setEditing] = useState(null);
  const fileRef = useRef(null);

  const range = periodRange(periodId, new Date(), custom);
  const rows = useMemo(() => totals(state, range), [state, range.from, range.to]); // eslint-disable-line react-hooks/exhaustive-deps
  const sum = useMemo(() => summary(state, range), [state, range.from, range.to]); // eslint-disable-line react-hooks/exhaustive-deps
  const grades = [...new Set(state.students.map((s) => s.grade).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ar'));
  const shown = rows.filter((r) => (!grade || r.student.grade === grade) && (!q.trim() || r.student.name.includes(q.trim())));

  if (!state.tracking) {
    return (
      <section className="ec-box ec-optin">
        <div className="ec-optin-ico"><Ico n="chart" size={30} /></div>
        <h3>متابعة كوبونات التميز — اختيارية</h3>
        <p>يمكنك استخدام المبادرة بالكروت والطباعة فقط. وإن أردت، فعّل المتابعة لتسجيل كل كوبون تمنحه، ويُحسب رصيد كل طالب تلقائيًا ويُجهَّز تقرير التكريم.</p>
        <ul className="ec-privacy">
          <li><Ico n="lock" size={16} /> الأسماء تُحفظ على <b>هذا الجهاز وهذا المتصفح فقط</b>، ومنفصلة لكل حساب في المنصة.</li>
          <li><Ico n="lock" size={16} /> لا تُرفع إلى خوادم MusiTeacher ولا إلى أي جهة خارجية، ولا تظهر في أي صفحة عامة.</li>
          <li><Ico n="lock" size={16} /> الترتيب يراه المعلم وحده — للتكريم، لا للإعلان أمام الطلبة.</li>
        </ul>
        <button type="button" className="ec-btn is-primary" id="ec-enable-tracking" onClick={() => update((s) => ({ ...s, tracking: true }))}><Ico n="check" /> فعّل المتابعة</button>
      </section>
    );
  }

  const addOne = (e) => {
    e.preventDefault();
    const name = adding.name.replace(/\s+/g, ' ').trim();
    if (name.length < 2) { notify('err', 'اكتب اسم الطالب.'); return; }
    if (state.students.some((s) => s.name === name && (s.grade || '') === adding.grade.trim())) { notify('err', 'هذا الاسم موجود في نفس الصف.'); return; }
    update((s) => ({ ...s, students: [...s.students, { id: newId(), name, grade: adding.grade.trim(), gender: adding.gender, archived: false }] }));
    setAdding((a) => ({ ...a, name: '' }));
  };
  const addBulk = () => {
    const names = parseNames(adding.bulk, state.students, adding.grade);
    if (!names.length) { notify('err', 'لم أجد أسماء جديدة. اكتب كل اسم في سطر.'); return; }
    update((s) => ({ ...s, students: [...s.students, ...names.map((name) => ({ id: newId(), name, grade: adding.grade.trim(), gender: adding.gender, archived: false }))] }));
    setAdding((a) => ({ ...a, bulk: '' }));
    notify('ok', `أُضيف ${names.length} طالبًا.`);
  };
  const give = (ids) => {
    if (!ids.length) return;
    if (!award.date) { notify('err', 'اختر تاريخ الكوبون.'); return; }
    update((s) => ({ ...s, awards: [...s.awards, ...ids.map((studentId) => ({ id: newId(), studentId, date: award.date, criterion: award.criterion, note: award.note.trim().slice(0, 160) }))] }));
    notify('ok', ids.length === 1 ? 'سُجّل الكوبون.' : `سُجّل كوبون لـ ${ids.length} طلبة.`);
    setSel([]);
  };
  const removeAward = (id) => update((s) => ({ ...s, awards: s.awards.filter((a) => a.id !== id) }));
  const removeStudent = (st) => {
    const n = state.awards.filter((a) => a.studentId === st.id).length;
    if (!window.confirm(`حذف «${st.name}»${n ? ` مع ${n} كوبون مسجل له` : ''}؟ لا يمكن التراجع.`)) return;
    update((s) => ({ ...s, students: s.students.filter((x) => x.id !== st.id), awards: s.awards.filter((a) => a.studentId !== st.id) }));
    setSel((p) => p.filter((x) => x !== st.id));
  };
  const saveEdit = () => {
    const name = editing.name.replace(/\s+/g, ' ').trim(); if (name.length < 2) return;
    update((s) => ({ ...s, students: s.students.map((x) => (x.id === editing.id ? { ...x, name, grade: editing.grade.trim(), gender: editing.gender } : x)) }));
    setEditing(null);
  };
  const doImport = async (f) => {
    if (!f) return;
    try {
      const next = importBackup(await f.text());
      if (!window.confirm(`استعادة نسخة فيها ${next.students.length} طالبًا و${next.awards.length} كوبونًا؟ ستحل محل البيانات الحالية على هذا الجهاز.`)) return;
      update(() => ({ ...next, tracking: true })); notify('ok', 'تمت الاستعادة.');
    } catch (e) { notify('err', e.message); }
  };
  const wipe = () => {
    if (!window.confirm('حذف كل الطلبة والكوبونات المسجلة على هذا الجهاز؟ لا يمكن التراجع. (لن تتأثر إعدادات الكروت)')) return;
    update((s) => ({ ...s, students: [], awards: [], tracking: false })); setSel([]); notify('ok', 'حُذفت بيانات المتابعة.');
  };
  const allShownSel = shown.length > 0 && shown.every((r) => sel.includes(r.student.id));

  return (
    <div className="ec-tracker">
      <div className="ec-stats">
        <div><b id="ec-stat-students">{sum.students}</b><span>طالبًا في القائمة</span></div>
        <div><b id="ec-stat-part">{sum.participants}</b><span>حصلوا على كوبون</span></div>
        <div><b id="ec-stat-coupons">{sum.coupons}</b><span>كوبونًا ممنوحًا</span></div>
      </div>

      <section className="ec-box">
        <div className="ec-toolbar">
          <label className="ec-inline">الفترة
            <select className="ec-input" id="ec-period" value={periodId} onChange={(e) => setPeriodId(e.target.value)}>{PERIODS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</select>
          </label>
          {periodId === 'custom' && (<>
            <label className="ec-inline">من<input type="date" className="ec-input" value={custom.from} onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} /></label>
            <label className="ec-inline">إلى<input type="date" className="ec-input" value={custom.to} onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))} /></label>
          </>)}
          {grades.length > 1 && (
            <label className="ec-inline">الصف<select className="ec-input" value={grade} onChange={(e) => setGrade(e.target.value)}><option value="">كل الصفوف</option>{grades.map((g) => <option key={g} value={g}>{g}</option>)}</select></label>
          )}
          <input className="ec-input ec-search" type="search" placeholder="بحث باسم الطالب" value={q} onChange={(e) => setQ(e.target.value)} aria-label="بحث باسم الطالب" />
        </div>

        <div className={`ec-awardbar ${sel.length ? 'is-active' : ''}`}>
          <b>{sel.length ? `محدد: ${sel.length}` : 'منح كوبون'}</b>
          <label className="ec-inline">التاريخ<input type="date" className="ec-input" id="ec-award-date" value={award.date} onChange={(e) => setAward((a) => ({ ...a, date: e.target.value }))} /></label>
          <label className="ec-inline">المعيار<select className="ec-input" id="ec-award-crit" value={award.criterion} onChange={(e) => setAward((a) => ({ ...a, criterion: e.target.value }))}>{state.criteria.map((c) => <option key={c} value={c}>{c}</option>)}<option value="">بدون معيار</option></select></label>
          <input className="ec-input" placeholder="سبب مختصر (اختياري)" value={award.note} maxLength={160} onChange={(e) => setAward((a) => ({ ...a, note: e.target.value }))} aria-label="سبب منح الكوبون" />
          <button type="button" className="ec-btn is-primary" id="ec-give-selected" disabled={!sel.length} onClick={() => give(sel)}><Ico n="star" /> منح للمحددين</button>
        </div>

        {state.students.length ? (
          <div className="ec-table-wrap">
            <table className="ec-table">
              <thead><tr>
                <th><input type="checkbox" aria-label="تحديد الكل" checked={allShownSel} onChange={(e) => setSel(e.target.checked ? shown.map((r) => r.student.id) : [])} /></th>
                <th>الطالب</th><th>الصف</th><th>الكوبونات</th><th>آخر كوبون</th><th><span className="ec-sr">إجراءات</span></th>
              </tr></thead>
              <tbody>
                {shown.map((r) => {
                  const st = r.student; const hist = openHist === st.id ? state.awards.filter((a) => a.studentId === st.id).sort((a, b) => (a.date < b.date ? 1 : -1)) : null;
                  return [
                    <tr key={st.id} className={sel.includes(st.id) ? 'is-sel' : ''} data-student={st.name}>
                      <td><input type="checkbox" aria-label={`تحديد ${st.name}`} checked={sel.includes(st.id)} onChange={(e) => setSel((p) => (e.target.checked ? [...p, st.id] : p.filter((x) => x !== st.id)))} /></td>
                      <td>{editing && editing.id === st.id ? (
                        <span className="ec-editrow">
                          <input className="ec-input" value={editing.name} maxLength={60} onChange={(e) => setEditing((x) => ({ ...x, name: e.target.value }))} aria-label="الاسم" />
                          <input className="ec-input is-sm" value={editing.grade} maxLength={30} onChange={(e) => setEditing((x) => ({ ...x, grade: e.target.value }))} aria-label="الصف" />
                          <Seg label="النوع" value={editing.gender} onChange={(v) => setEditing((x) => ({ ...x, gender: v }))} options={[{ id: 'm', label: 'طالب' }, { id: 'f', label: 'طالبة' }]} />
                          <button type="button" className="ec-icon-btn" aria-label="حفظ" onClick={saveEdit}><Ico n="check" size={16} /></button>
                          <button type="button" className="ec-icon-btn" aria-label="إلغاء" onClick={() => setEditing(null)}><Ico n="x" size={16} /></button>
                        </span>) : <b>{st.name}</b>}</td>
                      <td>{st.grade || '—'}</td>
                      <td><span className={`ec-score ${r.count ? '' : 'is-zero'}`} data-count={r.count}>{r.count}</span>{r.topReasons.length ? <small className="ec-reasons">{r.topReasons.join('، ')}</small> : null}</td>
                      <td>{r.last ? <bdi dir="ltr">{fmtDate(r.last)}</bdi> : '—'}</td>
                      <td className="ec-rowact">
                        <button type="button" className="ec-btn is-sm is-primary" onClick={() => give([st.id])} aria-label={`منح كوبون لـ ${st.name}`}><Ico n="plus" size={15} /> كوبون</button>
                        <button type="button" className="ec-icon-btn" aria-label={`سجل ${st.name}`} aria-expanded={openHist === st.id} onClick={() => setOpenHist(openHist === st.id ? null : st.id)}><Ico n="list" size={16} /></button>
                        <button type="button" className="ec-icon-btn" aria-label={`تعديل ${st.name}`} onClick={() => setEditing({ id: st.id, name: st.name, grade: st.grade, gender: st.gender })}><Ico n="edit" size={16} /></button>
                        <button type="button" className="ec-icon-btn is-danger" aria-label={`حذف ${st.name}`} onClick={() => removeStudent(st)}><Ico n="trash" size={16} /></button>
                      </td>
                    </tr>,
                    hist ? (
                      <tr key={`${st.id}-h`} className="ec-hist"><td colSpan={6}>
                        {hist.length ? <ul>{hist.map((a) => (
                          <li key={a.id}><bdi dir="ltr">{fmtDate(a.date)}</bdi><span>{a.criterion || 'بدون معيار'}</span>{a.note ? <small>{a.note}</small> : null}
                            <button type="button" className="ec-icon-btn is-danger" aria-label="حذف هذا الكوبون" onClick={() => removeAward(a.id)}><Ico n="x" size={14} /></button></li>
                        ))}</ul> : <span className="ec-hint">لا توجد كوبونات مسجلة بعد.</span>}
                      </td></tr>
                    ) : null,
                  ];
                })}
              </tbody>
            </table>
            {!shown.length ? <div className="ec-empty">لا يوجد طلبة يطابقون البحث.</div> : null}
          </div>
        ) : <div className="ec-empty">أضف أسماء طلبتك أولًا من النموذج التالي.</div>}
        {state.students.length ? <div className="ec-row"><button type="button" className="ec-link" onClick={() => onPrintStudents(sel.length ? sel : shown.map((r) => r.student.id))}><Ico n="print" size={15} /> اطبع كروتًا بأسماء {sel.length ? 'المحددين' : 'الطلبة المعروضين'}</button></div> : null}
      </section>

      <div className="ec-grid2">
        <section className="ec-box">
          <h3><Ico n="users" /> إضافة طلبة</h3>
          <form className="ec-form" onSubmit={addOne}>
            <Field label="اسم الطالب"><input className="ec-input" id="ec-add-name" value={adding.name} maxLength={60} onChange={(e) => setAdding((a) => ({ ...a, name: e.target.value }))} /></Field>
            <Field label="الصف"><input className="ec-input" id="ec-add-grade" value={adding.grade} maxLength={30} onChange={(e) => setAdding((a) => ({ ...a, grade: e.target.value }))} placeholder="مثال: 5-1" /></Field>
            <Field label="صيغة العبارات" group><Seg label="صيغة العبارات" value={adding.gender} onChange={(v) => setAdding((a) => ({ ...a, gender: v }))} options={[{ id: 'm', label: 'طالب' }, { id: 'f', label: 'طالبة' }]} /></Field>
            <button type="submit" className="ec-btn is-primary" id="ec-add-one"><Ico n="plus" /> إضافة</button>
          </form>
          <details className="ec-more"><summary>إضافة قائمة أسماء دفعة واحدة</summary>
            <textarea className="ec-input" id="ec-bulk" rows={5} value={adding.bulk} onChange={(e) => setAdding((a) => ({ ...a, bulk: e.target.value }))} placeholder={'اسم في كل سطر — يمكنك اللصق من Excel\nيُطبق الصف وصيغة العبارات المختاران أعلاه على الجميع'} />
            <button type="button" className="ec-btn" id="ec-add-bulk" onClick={addBulk}><Ico n="users" /> إضافة القائمة</button>
          </details>
        </section>

        <section className="ec-box">
          <h3><Ico n="star" /> معايير التميز</h3>
          <p className="ec-hint">أعلنها لطلبتك من البداية — الكوبون يُكسب بمعيار واضح.</p>
          <ul className="ec-crit">
            {state.criteria.map((c) => (
              <li key={c}><span>{c}</span><button type="button" className="ec-icon-btn" aria-label={`حذف معيار ${c}`} onClick={() => update((s) => ({ ...s, criteria: s.criteria.filter((x) => x !== c) }))}><Ico n="x" size={14} /></button></li>
            ))}
          </ul>
          <form className="ec-row" onSubmit={(e) => { e.preventDefault(); const v = e.currentTarget.elements.crit.value.trim().slice(0, 60); if (!v || state.criteria.includes(v)) return; update((s) => ({ ...s, criteria: [...s.criteria, v].slice(0, 20) })); e.currentTarget.reset(); }}>
            <input name="crit" className="ec-input" placeholder="معيار جديد" maxLength={60} aria-label="معيار جديد" /><button type="submit" className="ec-btn"><Ico n="plus" /> إضافة</button>
          </form>
        </section>
      </div>

      <section className="ec-box ec-data">
        <h3><Ico n="lock" /> بياناتك وخصوصية طلبتك</h3>
        <p className="ec-hint">محفوظة على هذا الجهاز وفي هذا المتصفح فقط{uidKnown ? '، ومنفصلة لحسابك' : ''}. لا تُرفع إلى أي خادم. لنقلها إلى جهاز آخر استخدم «نسخة احتياطية» ثم «استعادة». تنبيه: من يستخدم هذا الجهاز بحسابك يستطيع رؤيتها، ومسح بيانات المتصفح يحذفها.</p>
        <div className="ec-row">
          <button type="button" className="ec-btn" id="ec-csv" onClick={() => downloadText(`كوبونات-التميز-${todayISO()}.csv`, toCSV(state, range), 'text/csv;charset=utf-8')}><Ico n="download" /> جدول Excel (CSV)</button>
          <button type="button" className="ec-btn" id="ec-backup" onClick={() => downloadText(`نسخة-كوبون-التميز-${todayISO()}.json`, exportBackup(state), 'application/json')}><Ico n="download" /> نسخة احتياطية</button>
          <button type="button" className="ec-btn" onClick={() => fileRef.current && fileRef.current.click()}><Ico n="upload" /> استعادة نسخة</button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden id="ec-restore" onChange={(e) => { doImport(e.target.files && e.target.files[0]); e.target.value = ''; }} />
          <button type="button" className="ec-btn is-danger" id="ec-wipe" onClick={wipe}><Ico n="trash" /> حذف بيانات المتابعة</button>
        </div>
      </section>
    </div>
  );
}
