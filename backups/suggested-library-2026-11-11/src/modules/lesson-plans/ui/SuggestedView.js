'use client';
// 📚 «الخطط الدراسية المقترحة»: ملفات Excel يرفعها الأدمن فقط. المعلم يتصفحها (لصفوفه) ويعاينها وينزّلها،
// ويمكنه نسخها إلى خططه بعد مراجعتها — ولا يُضاف شيء تلقائيًا إلى خطته، ولا يستطيع تعديل الخطة المقترحة نفسها.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon, Modal, Field } from '../../class-alarm/ui/parts';
import { GRADE_NAMES, SEMESTERS, gradeNum } from '../core/model.js';
import { OFFICIAL_YEAR } from '../core/importPlan.js';
import { lessonTiming, maxWeekOf, formatRangeAr, formatDateAr } from '../core/calendar.js';
import { readPlanFile } from './planFiles';
import { ReviewModal, filterDraftsForGrade } from './PlansView';

export const EMPTY_TEXT = 'لا توجد خطط دراسية مقترحة متاحة حاليًا. يمكنك إعداد خطتك الخاصة من خلال تحويل ملف PDF إلى Excel أو Word باستخدام إحدى وسائل التحويل المناسبة، ثم رفع الملف إلى الأداة لتحليله.';
const SHEET_ACCEPT = '.xlsx,.xls,.csv';
const kb = (n) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} م.ب` : `${Math.max(1, Math.round(n / 1024))} ك.ب`);
const stamp = (t) => (t ? formatDateAr(new Date(t).toISOString().slice(0, 10)) : '');

function toB64(buf) {
  const u = new Uint8Array(buf); let s = '';
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
  return btoa(s);
}
function fromB64(b64) { const s = atob(b64); const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; }

export default function SuggestedView({ api, svc, grades, ws, update, notify, onOpenSettings }) {
  const [state, setState] = useState({ loading: true, items: [], error: '' });
  const [filter, setFilter] = useState({ grade: '', semester: '' });
  const [preview, setPreview] = useState(null);     // { item, drafts }
  const [busyId, setBusyId] = useState('');
  const [importing, setImporting] = useState(null);

  const load = useCallback(async () => {
    if (!api || !svc.suggested) { setState({ loading: false, items: [], error: '' }); return; }
    setState((s) => ({ ...s, loading: true, error: '' }));
    try { const r = await api.suggestedList(); setState({ loading: false, items: r.items || [], error: '' }); } catch (e) { setState({ loading: false, items: [], error: e.message }); }
  }, [api, svc.suggested]);
  useEffect(() => { load(); }, [load]);

  const fetchFile = async (item) => {
    const r = await api.suggestedFile(item.id);
    const bytes = fromB64(r.b64);
    return new File([bytes], r.fileName || item.fileName || 'plan.xlsx', { type: r.mime || 'application/octet-stream' });
  };
  const openPreview = async (item) => {
    setBusyId(`p:${item.id}`);
    try {
      const f = await fetchFile(item);
      const r = await readPlanFile(f, {});
      if (!r.ok) { notify(r.error || 'تعذرت قراءة الملف.', 'err'); return; }
      setPreview({ item, drafts: r.drafts, file: f });
    } catch (e) { notify(e.message, 'err'); } finally { setBusyId(''); }
  };
  const download = async (item) => {
    setBusyId(`d:${item.id}`);
    try {
      const f = await fetchFile(item);
      const url = URL.createObjectURL(f);
      const a = document.createElement('a'); a.href = url; a.download = f.name; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch (e) { notify(e.message, 'err'); } finally { setBusyId(''); }
  };
  const copyToMine = (item, drafts) => {
    if (!grades.includes(item.grade)) { notify(`اختر «${GRADE_NAMES[item.grade - 1]}» في صفوفك أولًا (⚙️).`, 'err'); return; }
    const f = filterDraftsForGrade(drafts.map((d) => ({ ...d, year: d.year || item.year, semester: d.semester || item.semester })), item.grade);
    if (!f.drafts.length) { notify(f.error, 'err'); return; }
    setPreview(null);
    setImporting({ drafts: f.drafts, via: 'suggested', note: `نسخة من خطة مقترحة («${item.title || item.fileName}») — راجعها وعدّلها كما يناسب مدرستك قبل الاعتماد.${f.note ? ` ${f.note}` : ''}`, preview: null, name: item.fileName, grade: GRADE_NAMES[item.grade - 1] });
  };

  const visible = state.items.filter((x) => (!grades.length || grades.includes(x.grade)) && (!filter.grade || x.grade === +filter.grade) && (!filter.semester || x.semester === filter.semester));
  const gradeOpts = GRADE_NAMES.map((g, i) => ({ n: i + 1, g })).filter((o) => !grades.length || grades.includes(o.n));

  return (
    <div className="ca-stack">
      <section className="ca-card">
        <div className="ca-card-head"><div><h3>📚 الخطط الدراسية المقترحة</h3><p className="ca-muted">خطط جاهزة بصيغة Excel يمكنك معاينتها وتنزيلها وتعديلها، ثم رفعها كخطتك الخاصة.</p></div></div>
        <div className="ca-notice is-info"><Icon n="shield" /><span>هذه الخطط مقترحة للاسترشاد فقط، وليست خططًا رسمية أو معتمدة من وزارة التربية والتعليم. تأكد من مطابقتها لخطة مدرستك المعتمدة، واحترم حقوق الملكية الفكرية لمصادرها؛ استخدمها لعملك داخل مدرستك ولا تُعِد نشرها.</span></div>
        {!grades.length && <p className="ca-small ca-muted">تظهر خطط كل الصفوف لأنك لم تحدد صفوفك. <button type="button" className="ca-link" onClick={onOpenSettings}>⚙️ اختر صفوفك</button></p>}
        {state.items.length > 0 && (
          <div className="ca-row ca-wrap">
            <select className="ca-input ca-w8" value={filter.grade} onChange={(e) => setFilter({ ...filter, grade: e.target.value })} aria-label="الصف"><option value="">كل صفوفي</option>{gradeOpts.map((o) => <option key={o.n} value={o.n}>{o.g}</option>)}</select>
            <select className="ca-input ca-w8" value={filter.semester} onChange={(e) => setFilter({ ...filter, semester: e.target.value })} aria-label="الفصل"><option value="">كل الفصول</option>{SEMESTERS.map((s) => <option key={s}>{s}</option>)}</select>
          </div>
        )}
      </section>

      <section className="ca-card" aria-busy={state.loading}>
        {state.loading ? <div className="ca-busy is-inline" role="status"><span className="ca-spin" /> جارٍ تحميل الخطط المقترحة...</div>
          : state.error ? <div className="ca-notice is-err" role="alert"><Icon n="warn" /><span>{state.error}</span><button type="button" className="ca-btn is-sm" onClick={load}>إعادة المحاولة</button></div>
            : !visible.length ? <div className="ca-empty lp-suggest-empty"><Icon n="note" size={34} /><p>{EMPTY_TEXT}</p></div>
              : (
                <div className="lp-plan-grid">
                  {visible.map((x) => (
                    <article key={x.id} className="lp-plan-card">
                      <div className="lp-plan-top"><span className="lp-chip">{GRADE_NAMES[x.grade - 1]}</span><span className="lp-chip is-soft">{x.semester}</span><span className="lp-chip is-soft"><bdi>{x.year}</bdi></span></div>
                      <h4>{x.title || x.subject}</h4>
                      <p className="ca-muted ca-small">{x.subject} • {x.lessons} درس • {x.fileName} ({kb(x.size)}) • حُدّثت {stamp(x.updatedAt)}</p>
                      {x.note && <p className="ca-small">{x.note}</p>}
                      <div className="ca-row ca-wrap">
                        <button type="button" className="ca-btn is-sm" disabled={!!busyId} onClick={() => openPreview(x)}><Icon n="sparkle" size={15} />{busyId === `p:${x.id}` ? 'جارٍ الفتح...' : 'معاينة'}</button>
                        <button type="button" className="ca-btn is-ghost is-sm" disabled={!!busyId} onClick={() => download(x)}><Icon n="download" size={15} />{busyId === `d:${x.id}` ? 'جارٍ التنزيل...' : 'تنزيل Excel'}</button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
      </section>

      {svc.admin && svc.suggested && <AdminPanel api={api} items={state.items} reload={load} notify={notify} />}

      {preview && (
        <Modal title={`معاينة: ${preview.item.title || preview.item.fileName}`} onClose={() => setPreview(null)} wide
          footer={<>
            <button type="button" className="ca-btn" onClick={() => copyToMine(preview.item, preview.drafts)}><Icon n="copy" />نسخها إلى خططي (بعد المراجعة)</button>
            <button type="button" className="ca-btn is-ghost" onClick={() => download(preview.item)}><Icon n="download" />تنزيل للتعديل ثم الرفع</button>
            <button type="button" className="ca-btn is-ghost" onClick={() => setPreview(null)}>إغلاق</button>
          </>}>
          <PlanPreview drafts={preview.drafts} />
          <p className="ca-small ca-muted ca-mt">النسخ لا يغيّر الخطة المقترحة، ولا يُضاف إلى خطتك إلا بعد مراجعتك واعتمادك.</p>
        </Modal>
      )}
      {importing && <ReviewModal ws={ws} update={update} notify={notify} data={importing} fixedGrade={importing.grade} onClose={() => setImporting(null)} onDone={() => { setImporting(null); notify('أُضيفت نسختك إلى خططك، وستُربط تلقائيًا بحصص هذا الصف.'); }} />}
    </div>
  );
}

/** عرض للقراءة فقط: الوحدات والدروس والأسابيع وتواريخها */
export function PlanPreview({ drafts }) {
  return drafts.map((d, i) => {
    const ls = d.units.flatMap((u) => u.lessons);
    const mx = maxWeekOf(ls.map((l) => l.weeks));
    return (
      <div key={i} className="lp-prev">
        <p className="ca-small"><b>{d.grade || 'صف غير محدد'}</b> • {d.semester || 'فصل غير محدد'} • <bdi>{d.year || 'عام غير محدد'}</bdi> • {ls.length} درس</p>
        <div className="lp-prev-table" role="table" aria-label="دروس الخطة">
          <div className="lp-prev-row is-head" role="row"><span role="columnheader">الوحدة</span><span role="columnheader">الدرس</span><span role="columnheader">الأسابيع / الفترة</span><span role="columnheader">الحصص</span></div>
          {d.units.flatMap((u) => u.lessons.map((l) => {
            const t = lessonTiming({ weeks: l.weeks, start: l.start, end: l.end, year: d.year, semester: d.semester, maxWeek: mx });
            return (
              <div key={l.id} className="lp-prev-row" role="row">
                <span role="cell">{u.title || '—'}</span><span role="cell">{l.title || <i className="ca-warn-text">بلا اسم</i>}</span>
                <span role="cell">{t.state === 'ok' ? <bdi>{formatRangeAr(t.start, t.end, { days: false })}</bdi> : t.state === 'by-plan' ? 'حسب الخطة' : <i className="ca-muted">غير محدد</i>}</span>
                <span role="cell">{l.sessions || '—'}</span>
              </div>
            );
          }))}
        </div>
      </div>
    );
  });
}

/** إدارة الخطط المقترحة — تظهر للأدمن فقط، والخادم يرفض أي طلب تعديل من غير الأدمن */
function AdminPanel({ api, items, reload, notify }) {
  const blank = { grade: '', semester: '', year: OFFICIAL_YEAR, subject: 'المهارات الموسيقية', title: '', note: '' };
  const [form, setForm] = useState(blank);
  const [file, setFile] = useState(null);         // { name, b64, drafts, lessons, error }
  const [editing, setEditing] = useState(null);   // id عند الاستبدال/التعديل
  const [busy, setBusy] = useState('');
  const ref = useRef(null);

  const pick = async (f) => {
    if (!f) return;
    if (!/\.(xlsx|xls|csv)$/i.test(f.name)) { setFile({ name: f.name, error: 'ارفع ملف Excel فقط (xlsx أو xls أو csv).' }); return; }
    if (f.size > 2 * 1024 * 1024) { setFile({ name: f.name, error: 'الحد الأقصى 2 ميجابايت.' }); return; }
    setBusy('نحلل الملف...');
    try {
      const r = await readPlanFile(f, {});
      if (!r.ok) { setFile({ name: f.name, error: r.error }); return; }
      const lessons = r.drafts.reduce((a, d) => a + d.units.reduce((b, u) => b + u.lessons.length, 0), 0);
      const d0 = r.drafts[0];
      setForm((x) => ({ ...x, grade: x.grade || String(gradeNum(d0.grade) || ''), semester: x.semester || d0.semester || '', year: d0.year || x.year }));
      setFile({ name: f.name, b64: toB64(await f.arrayBuffer()), drafts: r.drafts, lessons });
    } catch (e) { setFile({ name: f.name, error: e.message || 'تعذرت قراءة الملف.' }); } finally { setBusy(''); }
  };
  const submit = async () => {
    setBusy('جارٍ الحفظ...');
    try {
      const meta = { ...form, grade: +form.grade, lessons: file && file.lessons ? file.lessons : (items.find((x) => x.id === editing) || {}).lessons };
      const body = { meta, ...(file && file.b64 ? { file: { name: file.name, b64: file.b64 } } : {}) };
      if (editing) await api.suggestedPatch(editing, body); else await api.suggestedCreate(body);
      notify(editing ? 'حُدّثت الخطة المقترحة.' : 'نُشرت الخطة المقترحة للمعلمين.');
      setForm(blank); setFile(null); setEditing(null); reload();
    } catch (e) { notify(e.message, 'err'); } finally { setBusy(''); }
  };
  const remove = async (x) => {
    if (!window.confirm(`حذف الخطة المقترحة «${x.title || x.fileName}»؟ لن يؤثر ذلك على النسخ التي نسخها المعلمون إلى خططهم.`)) return;
    try { await api.suggestedRemove(x.id); notify('حُذفت الخطة المقترحة.'); reload(); } catch (e) { notify(e.message, 'err'); }
  };
  const startEdit = (x) => { setEditing(x.id); setFile(null); setForm({ grade: String(x.grade), semester: x.semester, year: x.year, subject: x.subject, title: x.title, note: x.note }); };
  const ready = form.grade && form.semester && /^\d{4}\/\d{4}$/.test(form.year) && (editing ? !(file && file.error) : file && file.b64 && file.lessons > 0);

  return (
    <section className="ca-card lp-admin" aria-label="إدارة الخطط المقترحة">
      <div className="ca-card-head"><div><h3>🛠️ إدارة الخطط المقترحة (للأدمن)</h3><p className="ca-muted">يرى المعلمون هذه الخطط ويعاينونها وينزّلونها، ولا يستطيعون تعديلها.</p></div></div>
      <div className="ca-form-grid">
        <Field label="الصف"><select className="ca-input" value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value })}><option value="">— اختر —</option>{GRADE_NAMES.map((g, i) => <option key={g} value={i + 1}>{g}</option>)}</select></Field>
        <Field label="الفصل الدراسي"><select className="ca-input" value={form.semester} onChange={(e) => setForm({ ...form, semester: e.target.value })}><option value="">— اختر —</option>{SEMESTERS.map((s) => <option key={s}>{s}</option>)}</select></Field>
        <Field label="العام الدراسي"><input className="ca-input" value={form.year} placeholder="2026/2027" onChange={(e) => setForm({ ...form, year: e.target.value.trim() })} /></Field>
        <Field label="المادة"><input className="ca-input" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} /></Field>
        <Field label="عنوان مختصر"><input className="ca-input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="مثال: خطة مقترحة للصف الخامس" /></Field>
        <Field label="ملاحظة للمعلمين (اختياري)"><input className="ca-input" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></Field>
      </div>
      <div className="ca-row ca-wrap ca-mt">
        <input ref={ref} type="file" accept={SHEET_ACCEPT} hidden onChange={(e) => { const f = e.target.files[0]; e.target.value = ''; pick(f); }} />
        <button type="button" className="ca-btn is-ghost" onClick={() => ref.current && ref.current.click()} disabled={!!busy}><Icon n="upload" />{editing ? 'استبدال الملف (اختياري)' : 'اختيار ملف Excel'}</button>
        <button type="button" className="ca-btn" onClick={submit} disabled={!ready || !!busy}><Icon n="check" />{busy || (editing ? 'حفظ التعديلات' : 'نشر الخطة المقترحة')}</button>
        {editing && <button type="button" className="ca-btn is-ghost" onClick={() => { setEditing(null); setFile(null); setForm(blank); }}>إلغاء التعديل</button>}
      </div>
      {file && (file.error ? <div className="ca-notice is-err" role="alert"><Icon n="warn" /><span>{file.name}: {file.error}</span></div>
        : <div className="ca-notice is-ok"><Icon n="check" /><span>حُلل «{file.name}» بنجاح: {file.lessons} درس في {file.drafts.length} خطة. راجع المعاينة قبل النشر.</span></div>)}
      {file && file.drafts && <details className="ca-mt"><summary>معاينة محتوى الملف</summary><PlanPreview drafts={file.drafts} /></details>}
      {items.length > 0 && (
        <ul className="lp-admin-list">
          {items.map((x) => (
            <li key={x.id}><span><b>{GRADE_NAMES[x.grade - 1]}</b> • {x.semester} • <bdi>{x.year}</bdi> • {x.title || x.fileName} ({x.lessons} درس)</span>
              <span className="ca-row"><button type="button" className="ca-btn is-ghost is-sm" onClick={() => startEdit(x)}><Icon n="edit" size={15} />تعديل</button><button type="button" className="ca-icon-btn" onClick={() => remove(x)} aria-label={`حذف ${x.title || x.fileName}`}><Icon n="trash" size={15} /></button></span></li>
          ))}
        </ul>
      )}
    </section>
  );
}
