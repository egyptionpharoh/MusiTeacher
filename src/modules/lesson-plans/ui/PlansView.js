'use client';
// 📚 ⚙️ «خططي حسب الصف»: رفع خطة لكل صف (Excel/Word/CSV/PDF/صورة) → مراجعة إلزامية → اعتماد؛ معاينة وتعديل، استبدال بنسخ سابقة، حذف، مزامنة.
import { useMemo, useRef, useState } from 'react';
import { Icon, Modal, Field, Seg, Toggle } from '../../class-alarm/ui/parts';
import { normalizePlan, planLabel, SEMESTERS, GRADE_NAMES, gradeNum } from '../core/model.js';
import { planWindows } from '../core/auto.js';
import { officialDraft, draftToUnits } from '../core/importPlan.js';
import { matchUnits, replacePlanUnits, restoreVersion } from '../core/merge.js';
import { readPlanFile, downloadPlanTemplate, PLAN_ACCEPT } from './planFiles';
import { LessonTable } from './lpParts';

const fmtStamp = (t) => (t ? new Date(t).toLocaleString('ar-OM', { dateStyle: 'medium', timeStyle: 'short' }) : '—');

const MAX_FILE = 15 * 1024 * 1024;

/** حالة تحليل الخطة: هل يمكن ربط دروسها تلقائيًا؟ (درس بلا أسابيع/تواريخ لا يُربط تلقائيًا) */
export function planHealth(p) {
  const ws = planWindows(p);
  const noTime = ws.filter((w) => !w.start).length;
  const noSessions = ws.filter((w) => !w.lesson.sessions).length;
  const unsure = ws.filter((w) => w.lesson.unsure && w.lesson.unsure.some((f) => f !== 'sessions')).length;
  return { lessons: ws.length, noTime, noSessions, unsure, ok: ws.length > 0 && noTime === 0 };
}

/** ⚙️ «خططي حسب الصف»: بطاقة لكل صف مختار — رفع/استبدال/معاينة/حالة التحليل؛ خطة كل صف منفصلة تمامًا عن غيره */
export default function GradePlansView({ ws, update, notify, ai, aiReady, plansData, grades, onOpenGrades }) {
  const [importing, setImporting] = useState(null);   // { drafts, via, note, preview, name, target, grade }
  const [busy, setBusy] = useState(null);             // { grade, text }
  const [err, setErr] = useState(null);               // { grade, text }
  const [editId, setEditId] = useState(null);
  const [pickFor, setPickFor] = useState(null);       // { grade, target }
  const [refSem, setRefSem] = useState({});
  const fileRef = useRef(null);
  const edit = ws.plans.find((p) => p.id === editId);

  const openPicker = (grade, target = null) => { setPickFor({ grade, target }); setTimeout(() => fileRef.current && fileRef.current.click(), 0); };
  const pickFile = async (file, { grade, target }) => {
    if (!file) return;
    const name = GRADE_NAMES[grade - 1];
    setErr(null);
    if (file.size > MAX_FILE) { setErr({ grade, text: 'حجم الملف كبير جدًا (الحد 15 ميجابايت).' }); return; }
    if (!file.size) { setErr({ grade, text: 'الملف فارغ.' }); return; }
    setBusy({ grade, text: 'نقرأ الملف...' });
    try {
      const r = await readPlanFile(file, { ai, onStage: (text) => setBusy({ grade, text }) });
      if (!r.ok) { setErr({ grade, text: r.error }); if (r.preview) URL.revokeObjectURL(r.preview.url); return; }
      const f = filterDraftsForGrade(r.drafts, grade);
      if (!f.drafts.length) { setErr({ grade, text: f.error }); if (r.preview) URL.revokeObjectURL(r.preview.url); return; }
      setImporting({ ...r, drafts: f.drafts, note: [r.note, f.note].filter(Boolean).join(' '), name: file.name, target, grade: name });
    } catch (e) { setErr({ grade, text: e.message || 'تعذرت قراءة الملف.' }); } finally { setBusy(null); }
  };

  const removePlan = (p) => {
    const asg = ws.assignments.filter((a) => a.planId === p.id);
    const ids = new Set(asg.map((a) => a.id));
    const logs = ws.log.filter((g) => ids.has(g.assignmentId));
    const msg = asg.length || logs.length
      ? `حذف «${planLabel(p)}» نهائيًا؟\nسيُحذف معها ${asg.length} ربط يدوي بحصص و${logs.length} تسجيل تنفيذ. لا يمكن التراجع.`
      : `حذف «${planLabel(p)}» نهائيًا؟ لا يمكن التراجع.`;
    if (!window.confirm(msg)) return;
    update((w) => ({ ...w, plans: w.plans.filter((x) => x.id !== p.id), assignments: w.assignments.filter((a) => a.planId !== p.id), log: w.log.filter((g) => !ids.has(g.assignmentId)), overrides: w.overrides.filter((o) => o.planId !== p.id) }));
    notify('حُذفت الخطة.');
  };

  if (!grades.length) return (
    <section className="ca-card"><div className="ca-empty"><Icon n="note" size={34} /><strong>اختر صفوفك أولًا</strong><p>بعد اختيار الصفوف التي تدرّسها تظهر هنا بطاقة لكل صف لرفع خطته.</p><button type="button" className="ca-btn" onClick={onOpenGrades}>اختيار صفوفي</button></div></section>
  );
  const hidden = ws.plans.filter((p) => !grades.includes(gradeNum(p.grade)));
  return (
    <div className="ca-stack">
      <input ref={fileRef} type="file" accept={PLAN_ACCEPT} hidden onChange={(e) => { const f = e.target.files[0]; e.target.value = ''; if (pickFor) pickFile(f, pickFor); }} />
      <div className="ca-notice is-info"><Icon n="info" /><span>لكل صف خطة مستقلة. ارفع ملف Excel أو Word أو CSV (أو PDF/صورة إن كانت القراءة الذكية متاحة)، ثم راجع الدروس قبل الاعتماد. <button type="button" className="ca-link" onClick={() => downloadPlanTemplate().catch(() => notify('تعذر إنشاء القالب.', 'err'))}>تنزيل قالب Excel</button></span></div>
      {grades.map((g) => {
        const name = GRADE_NAMES[g - 1];
        const plans = ws.plans.filter((p) => gradeNum(p.grade) === g).sort((a, b) => (b.year || '').localeCompare(a.year || '') || SEMESTERS.indexOf(a.semester) - SEMESTERS.indexOf(b.semester));
        const isBusy = busy && busy.grade === g;
        return (
          <section key={g} className="ca-card lp-grade-card" aria-label={name}>
            <div className="ca-card-head">
              <div><h3>{name}</h3><p className="ca-muted">{plans.length ? `${plans.length} ${plans.length === 1 ? 'خطة' : 'خطط'} لهذا الصف` : 'لم تُرفع خطة لهذا الصف بعد'}</p></div>
              <div className="ca-row ca-wrap">
                <button type="button" className="ca-btn is-sm" disabled={!!busy} onClick={() => openPicker(g)}><Icon n="upload" size={15} />{isBusy ? busy.text : 'رفع خطة لهذا الصف'}</button>
              </div>
            </div>
            {isBusy && <div className="ca-busy is-inline" role="status"><span className="ca-spin" /> {busy.text}</div>}
            {err && err.grade === g && <div className="ca-notice is-err" role="alert"><Icon n="warn" /><span>{err.text}</span></div>}
            {plans.map((p) => {
              const h = planHealth(p);
              return (
                <div key={p.id} className="lp-gp-row">
                  <div className="lp-gp-main">
                    <div className="lp-plan-top"><span className="lp-chip">{p.semester || 'فصل غير محدد'}</span><span className="lp-chip is-soft"><bdi>{p.year || 'عام غير محدد'}</bdi></span></div>
                    <p className="ca-small">{h.lessons} درس • المصدر: {p.source.official ? 'الخطة المرجعية المدمجة' : p.source.name || 'إدخال يدوي'} • آخر تحديث {fmtStamp(p.updatedAt)}</p>
                    {h.ok
                      ? <p className="ca-small lp-ok-text">✓ حُللت الخطة بنجاح ويمكن ربطها تلقائيًا بجدولك{h.noSessions ? ` (${h.noSessions} درس بلا عدد حصص؛ يُرقَّم حسب حصصك الفعلية)` : ''}.</p>
                      : <p className="ca-small ca-warn-text">⚠ {h.lessons ? `${h.noTime} درس بلا أسابيع أو تواريخ، فلن يُربط تلقائيًا. افتح الخطة وأكمل الفترة أو الأسابيع.` : 'الخطة بلا دروس.'}</p>}
                  </div>
                  <div className="ca-row ca-wrap">
                    <button type="button" className="ca-btn is-ghost is-sm" onClick={() => setEditId(p.id)}><Icon n="edit" size={15} />معاينة وتعديل</button>
                    <button type="button" className="ca-btn is-ghost is-sm" disabled={!!busy} onClick={() => openPicker(g, p.id)}><Icon n="upload" size={15} />استبدال بملف</button>
                    <button type="button" className="ca-icon-btn" onClick={() => removePlan(p)} aria-label={`حذف خطة ${name} ${p.semester}`}><Icon n="trash" size={15} /></button>
                  </div>
                </div>
              );
            })}
            {plansData && (
              <details className="lp-ref">
                <summary>لا تملك ملفًا؟ ابدأ من الخطة المرجعية المدمجة في المنصة</summary>
                <div className="ca-row ca-wrap ca-mt">
                  <select className="ca-input ca-w8" value={refSem[g] || ''} onChange={(e) => setRefSem({ ...refSem, [g]: e.target.value })} aria-label="الفصل"><option value="">— الفصل —</option>{SEMESTERS.filter((s) => plansData[s] && plansData[s][name]).map((s) => <option key={s}>{s}</option>)}</select>
                  <button type="button" className="ca-btn is-ghost is-sm" disabled={!refSem[g]} onClick={() => { const d = officialDraft(plansData, refSem[g], name); if (d) setImporting({ drafts: [d], via: 'official', note: 'من الخطة المرجعية المدمجة (الدروس والأسابيع فقط).', preview: null, name: `${name} – ${refSem[g]}`, grade: name }); }}>إنشاء مسودة للمراجعة</button>
                </div>
              </details>
            )}
          </section>
        );
      })}
      {hidden.length > 0 && <p className="ca-small ca-muted">لديك {hidden.length} {hidden.length === 1 ? 'خطة' : 'خطط'} لصفوف غير مختارة حاليًا ({[...new Set(hidden.map((p) => p.grade || 'بدون صف'))].join('، ')}). هي محفوظة كما هي وتظهر عند اختيار صفوفها من جديد.</p>}
      <ul className="ca-tips">
        <li><b>Excel وCSV وWord (جداول)</b> تُقرأ على جهازك مباشرة. <b>PDF والصور</b> {aiReady ? 'تُقرأ بالقراءة الذكية عبر خادم المنصة لحظيًا دون حفظ الملف.' : 'تحتاج «القراءة الذكية» غير المفعّلة حاليًا؛ استخدم قالب Excel.'}</li>
        <li>لا تُعتمد أي خطة قبل مراجعتك. لا نخمّن اسم درس غير واضح، ولا نضع عدد حصص من عندنا.</li>
        <li>الملف الأصلي لا يُحفظ؛ تُحفظ البيانات التي اعتمدتها فقط في حسابك. رفع خطة لا يجعلها رسمية أو معتمدة من الوزارة.</li>
      </ul>
      {importing && <ReviewModal ws={ws} update={update} notify={notify} data={importing} fixedGrade={importing.grade} onClose={() => { if (importing.preview && importing.preview.url.startsWith('blob:')) URL.revokeObjectURL(importing.preview.url); setImporting(null); }} onDone={() => { setImporting(null); notify('اعتُمدت الخطة، وستُربط دروسها تلقائيًا بحصص هذا الصف في جدولك.'); }} />}
      {edit && <PlanDetail plan={edit} ws={ws} update={update} notify={notify} onClose={() => setEditId(null)} fixedGrade />}
    </div>
  );
}

/** خطط ملفٍّ مقابل الصف المطلوب: نقبل خطط نفس الصف، ونُسند الخطة بلا صف إليه، ونرفض/نستبعد خطط الصفوف الأخرى بوضوح */
export function filterDraftsForGrade(drafts, g) {
  const name = GRADE_NAMES[g - 1];
  const same = [], other = [];
  for (const d of drafts) {
    const n = gradeNum(d.grade);
    if (!n) same.push({ ...d, grade: name, issues: [...(d.issues || []), `لم يُذكر الصف داخل الملف؛ ستُحفظ كخطة ${name}. تأكد أنها له.`] });
    else if (n === g) same.push({ ...d, grade: name });
    else other.push(d);
  }
  if (!same.length) return { drafts: [], error: `محتوى الملف يخص «${[...new Set(other.map((d) => d.grade))].join('، ')}» وليس «${name}». ارفعه من بطاقة ذلك الصف (بعد اختياره في صفوفي)، أو تأكد من الملف.` };
  return { drafts: same, note: other.length ? `تجاهلنا خطط صفوف أخرى موجودة في نفس الملف (${[...new Set(other.map((d) => d.grade))].join('، ')}).` : '' };
}

/** ⚙️ «الحفظ والمزامنة» */
export function SyncPanel({ sync, onWipe }) {
  return (
    <section className="ca-card">
      <div className="ca-card-head"><div><h3>الحفظ والمزامنة</h3><p className="ca-muted">الخطط والإعدادات وسجل التنفيذ محفوظة على هذا الجهاز لحسابك فقط</p></div></div>
      {sync.available ? (
        <>
          <Toggle checked={sync.on} onChange={sync.toggle} label="مزامنة خططي مع حسابي" hint="لاستخدامها من جهاز آخر بعد تسجيل الدخول؛ لا يصل إليها غيرك" />
          {sync.on && <p className={`ca-small ${sync.state === 'error' ? 'ca-error' : 'ca-muted'}`}>{sync.state === 'saving' ? 'جارٍ الحفظ...' : sync.state === 'error' ? sync.error : sync.at ? `آخر مزامنة: ${fmtStamp(sync.at)}` : 'ستتم المزامنة بعد أول تعديل'}</p>}
          <div className="ca-row ca-wrap"><button type="button" className="ca-btn is-ghost is-sm" onClick={sync.pull}><Icon n="cloud" size={15} />استرجاع من حسابي</button>{sync.on && <button type="button" className="ca-btn is-ghost is-sm" onClick={sync.push}><Icon n="upload" size={15} />{sync.conflict ? 'حفظ نسخة هذا الجهاز فوق نسخة الحساب' : 'حفظ الآن'}</button>}</div>
        </>
      ) : <p className="ca-muted ca-small">المزامنة مع الحساب غير متاحة حاليًا (تتطلب تسجيل الدخول وقاعدة البيانات على الخادم).</p>}
      <button type="button" className="ca-btn is-danger is-sm ca-mt" onClick={() => { if (window.confirm('حذف كل الخطط والتوزيع وسجل التنفيذ من هذا الجهاز نهائيًا؟')) onWipe(); }}><Icon n="trash" size={15} />حذف كل بيانات الخطط من هذا الجهاز</button>
    </section>
  );
}

/** مراجعة المستخرج قبل الاعتماد — مع معاينة الملف الأصلي للمقارنة */
export function ReviewModal({ ws, update, notify, data, onClose, onDone, fixedGrade = '' }) {
  const [drafts, setDrafts] = useState(() => data.drafts.map((d) => ({ ...d, units: d.units.map((u) => ({ ...u, lessons: u.lessons.map((l) => ({ ...l, unsure: [...(l.unsure || [])] })) })) })));
  const [i, setI] = useState(0);
  const [useAlt, setUseAlt] = useState(false);
  // افتراضيًا: إن وُجدت خطة لنفس الصف والفصل والعام نستبدلها (بحفظ نسختها السابقة) بدل إنشاء خطة مكررة
  const sameAs = (x) => ws.plans.find((p) => gradeNum(p.grade) === gradeNum(x.grade) && p.semester === x.semester && p.year === x.year);
  const [dest, setDest] = useState(() => { const f = data.drafts[0]; const t = data.target || (f && f.grade && f.semester && f.year && (sameAs(f) || {}).id); return t ? `replace:${t}` : 'new'; });
  const [done, setDone] = useState([]);
  const d = drafts[i];
  const setD = (patch) => setDrafts((all) => all.map((x, k) => (k === i ? { ...x, ...patch } : x)));
  const lessons = d.units.flatMap((u) => u.lessons);
  const noTitle = lessons.filter((l) => !l.title.trim()).length;
  const metaMissing = !d.year || !d.semester || !d.grade;
  const candidates = ws.plans.filter((p) => (!d.grade || gradeNum(p.grade) === gradeNum(d.grade)));
  const targetId = dest.startsWith('replace:') ? dest.slice(8) : null;
  const target = ws.plans.find((p) => p.id === targetId);
  const report = useMemo(() => (target ? matchUnits(target.units, draftToUnits(d, { useAlt })).report : null), [target, d, useAlt]);
  const affected = report ? ws.assignments.filter((a) => a.planId === target.id && report.removed.some((r) => r.id === a.lessonId)) : [];
  const approve = () => {
    const units = draftToUnits(d, { useAlt });
    const now = Date.now();
    if (target) {
      const { plan } = replacePlanUnits(target, units, `استبدال بملف «${data.name}»`, now);
      update((w) => ({ ...w, plans: w.plans.map((p) => (p.id === target.id ? normalizePlan({ ...plan, year: d.year, semester: d.semester, grade: d.grade, subject: d.subject, source: { name: data.name, kind: data.via, official: data.via === 'official', importedAt: now } }) : p)) }));
    } else {
      update((w) => ({ ...w, plans: [...w.plans, normalizePlan({ year: d.year, semester: d.semester, grade: d.grade, subject: d.subject, units, source: { name: data.via === 'manual' ? '' : data.name, kind: data.via, official: data.via === 'official', importedAt: now }, createdAt: now, updatedAt: now })] }));
    }
    const nd = [...done, i];
    setDone(nd);
    const next = drafts.findIndex((_, k) => !nd.includes(k));
    if (next >= 0) { setI(next); setDest('new'); notify(`اعتُمدت خطة ${d.grade}. راجع التالية.`); } else onDone();
  };
  return (
    <Modal title={`مراجعة الخطة قبل الاعتماد — ${data.name}`} onClose={onClose} wide
      footer={<>
        <button type="button" className="ca-btn" onClick={approve} disabled={noTitle > 0 || metaMissing || done.includes(i) || !lessons.length}><Icon n="check" />{target ? 'اعتماد الاستبدال' : 'اعتماد الخطة'}</button>
        {(noTitle > 0 || metaMissing) && <span className="ca-error ca-small">{metaMissing ? 'حدد العام والفصل والصف. ' : ''}{noTitle ? `${noTitle} درس بلا اسم.` : ''}</span>}
        <button type="button" className="ca-btn is-ghost" onClick={onClose}>إغلاق دون حفظ</button>
      </>}>
      <div className={`lp-review${data.preview ? ' has-preview' : ''}`}>
        {data.preview && (
          <aside className="lp-preview" aria-label="الملف الأصلي للمقارنة">
            <div className="ca-label">الملف الأصلي (على جهازك فقط)</div>
            {data.preview.kind === 'pdf' ? <iframe title="الملف الأصلي" src={data.preview.url} /> : <img src={data.preview.url} alt="الملف الأصلي" />}
          </aside>
        )}
        <div className="lp-review-main">
          {drafts.length > 1 && <Seg label="الخطط في الملف" value={String(i)} onChange={(v) => setI(+v)} options={drafts.map((x, k) => ({ id: String(k), label: `${done.includes(k) ? '✓ ' : ''}${x.grade || 'صف؟'} – ${x.semester ? x.semester.replace('الفصل الدراسي ', 'الفصل ') : 'فصل؟'}` }))} />}
          {data.note && <div className="ca-notice is-info"><Icon n="info" /><span>{data.note} الوحدات: {d.units.length} • الدروس: {lessons.length}{drafts.length > 1 ? ` • في هذا الملف ${drafts.length} خطط مستقلة` : ''}.</span></div>}
          {d.issues.map((t, k) => <div key={k} className="ca-notice is-warn"><Icon n="warn" /><span>{t}</span></div>)}
          <div className="ca-form-grid">
            <Field label="العام الدراسي"><input className="ca-input" value={d.year} placeholder="2026/2027" onChange={(e) => setD({ year: e.target.value })} /></Field>
            <Field label="الفصل الدراسي"><select className="ca-input" value={d.semester} onChange={(e) => setD({ semester: e.target.value })}><option value="">— اختر —</option>{SEMESTERS.map((s) => <option key={s}>{s}</option>)}</select></Field>
            <Field label="الصف"><select className="ca-input" value={d.grade} disabled={!!fixedGrade} onChange={(e) => setD({ grade: e.target.value })}><option value="">— اختر —</option>{GRADE_NAMES.map((g) => <option key={g}>{g}</option>)}</select></Field>
            <Field label="المادة"><input className="ca-input" value={d.subject} onChange={(e) => setD({ subject: e.target.value })} /></Field>
          </div>
          {d.altLabels && <div className="ca-row ca-wrap lp-mb"><span className="ca-label">عدد الحصص حسب:</span><Seg label="عمود الحصص" value={useAlt ? 'alt' : 'main'} onChange={(v) => setUseAlt(v === 'alt')} options={[{ id: 'main', label: d.altLabels[0] }, { id: 'alt', label: d.altLabels[1] }]} /></div>}
          <LessonTable units={d.units} onChange={(units) => setD({ units })} showLines={data.via !== 'manual'} altLabels={d.altLabels} useAlt={useAlt} />
          <div className="ca-card is-flat ca-mt">
            <div className="ca-label">أين نحفظها؟</div>
            <select className="ca-input" value={dest} onChange={(e) => setDest(e.target.value)}>
              <option value="new">خطة جديدة مستقلة</option>
              {candidates.map((p) => <option key={p.id} value={`replace:${p.id}`}>استبدال/تحديث: {planLabel(p)} (تُحفظ النسخة الحالية في السجل)</option>)}
            </select>
            {dest === 'new' && d.grade && d.semester && d.year && sameAs(d) && <p className="ca-warn-text ca-small">توجد خطة لنفس الصف والفصل والعام. اختر «استبدال/تحديث» لتجنب خطتين متكررتين (تحتاج الحصص حينها إلى مراجعة).</p>}
            {report && (
              <div className="lp-report">
                <p>سيبقى مرتبطًا كما هو: <b>{report.kept.length}</b> درس{report.kept.some((k) => k.changes.length) ? ` (تغيّرت بيانات ${report.kept.filter((k) => k.changes.length).length})` : ''} • دروس جديدة: <b>{report.added.length}</b> • دروس لن تبقى في الخطة: <b>{report.removed.length}</b></p>
                {report.removed.length > 0 && <p className="ca-warn-text">لن تبقى في الخطة: {report.removed.map((r) => r.title).join('، ')}{affected.length ? ` — ولها ${affected.length} ربط/سجل تنفيذ سيبقى محفوظًا ويظهر كدرس «لم يعد في الخطة».` : ''}</p>}
              </div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}

export function PlanDetail({ plan, ws, update, notify, onClose, fixedGrade = false }) {
  const [units, setUnits] = useState(plan.units);
  const [meta, setMeta] = useState({ year: plan.year, semester: plan.semester, grade: plan.grade, subject: plan.subject });
  const dirty = JSON.stringify(units) !== JSON.stringify(plan.units) || JSON.stringify(meta) !== JSON.stringify({ year: plan.year, semester: plan.semester, grade: plan.grade, subject: plan.subject });
  const save = () => {
    const removed = plan.units.flatMap((u) => u.lessons).filter((l) => !units.some((u) => u.lessons.some((x) => x.id === l.id)));
    const linked = ws.assignments.filter((a) => a.planId === plan.id && removed.some((r) => r.id === a.lessonId));
    if (linked.length && !window.confirm(`حذفت ${removed.length} درسًا لها ${linked.length} ربط/سجل. ستبقى السجلات محفوظة لكنها لن تتبع الخطة. متابعة؟`)) return;
    update((w) => ({ ...w, plans: w.plans.map((p) => (p.id === plan.id ? normalizePlan({ ...p, ...meta, units, updatedAt: Date.now() }) : p)) }));
    notify('حُفظت التعديلات على الخطة.');
    onClose();
  };
  return (
    <Modal title={planLabel(plan)} onClose={() => { if (!dirty || window.confirm('إغلاق دون حفظ التعديلات؟')) onClose(); }} wide
      footer={<><button type="button" className="ca-btn" onClick={save} disabled={!dirty}><Icon n="check" />حفظ التعديلات</button><button type="button" className="ca-btn is-ghost" onClick={onClose}>إغلاق</button></>}>
      <div className="ca-form-grid">
        <Field label="العام الدراسي"><input className="ca-input" value={meta.year} onChange={(e) => setMeta({ ...meta, year: e.target.value })} /></Field>
        <Field label="الفصل الدراسي"><select className="ca-input" value={meta.semester} onChange={(e) => setMeta({ ...meta, semester: e.target.value })}>{SEMESTERS.map((s) => <option key={s}>{s}</option>)}</select></Field>
        <Field label="الصف"><select className="ca-input" value={meta.grade} disabled={fixedGrade} onChange={(e) => setMeta({ ...meta, grade: e.target.value })}>{GRADE_NAMES.map((g) => <option key={g}>{g}</option>)}</select></Field>
        <Field label="المادة"><input className="ca-input" value={meta.subject} onChange={(e) => setMeta({ ...meta, subject: e.target.value })} /></Field>
      </div>
      <LessonTable units={units} onChange={setUnits} />
      {plan.versions.length > 0 && (
        <div className="ca-card is-flat ca-mt">
          <div className="ca-label">النسخ السابقة (تُحفظ تلقائيًا عند كل استبدال)</div>
          <ul className="lp-versions">
            {[...plan.versions].reverse().map((v) => (
              <li key={v.id}><span>{fmtStamp(v.at)} — {v.reason} • {v.units.reduce((a, u) => a + u.lessons.length, 0)} درس</span>
                <button type="button" className="ca-btn is-ghost is-sm" onClick={() => { if (!window.confirm('استرجاع هذه النسخة؟ (النسخة الحالية تُحفظ أولًا في السجل)')) return; update((w) => ({ ...w, plans: w.plans.map((p) => (p.id === plan.id ? restoreVersion(p, v.id) : p)) })); notify('استُرجعت النسخة السابقة.'); onClose(); }}>استرجاع</button></li>
            ))}
          </ul>
        </div>
      )}
    </Modal>
  );
}
