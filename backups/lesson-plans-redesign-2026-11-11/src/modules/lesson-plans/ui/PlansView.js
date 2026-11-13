'use client';
// 📚 «خططي»: رفع خطة (Excel/Word/CSV/PDF/صورة) → مراجعة إلزامية مقابل الملف الأصلي → اعتماد؛ تعديل، استبدال بنسخ سابقة، حذف، مزامنة.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon, Modal, Field, Seg, Toggle } from '../../class-alarm/ui/parts';
import { normalizePlan, planLabel, allLessons, SEMESTERS, GRADE_NAMES } from '../core/model.js';
import { officialDraft, draftToUnits } from '../core/importPlan.js';
import { matchUnits, replacePlanUnits, restoreVersion } from '../core/merge.js';
import { readPlanFile, downloadPlanTemplate, PLAN_ACCEPT } from './planFiles';
import { LessonTable } from './lpParts';

const fmtStamp = (t) => (t ? new Date(t).toLocaleString('ar-OM', { dateStyle: 'medium', timeStyle: 'short' }) : '—');

export default function PlansView({ ws, update, notify, ai, aiReady, plansData, pendingDraft, clearPendingDraft, sync, onWipe, onGoto }) {
  const [filter, setFilter] = useState({ year: '', semester: '', grade: '' });
  const [importing, setImporting] = useState(null);   // { drafts, via, note, preview, name, target }
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [editId, setEditId] = useState(null);
  const [replaceFor, setReplaceFor] = useState(null);
  const fileRef = useRef(null);

  useEffect(() => {
    if (!pendingDraft) return;
    const d = officialDraft(plansData, pendingDraft.semester, pendingDraft.grade);
    clearPendingDraft();
    if (d) setImporting({ drafts: [d], via: 'official', note: 'من الخطة المدمجة في المنصة.', preview: null, name: `${pendingDraft.grade} – ${pendingDraft.semester}` });
  }, [pendingDraft]); // eslint-disable-line react-hooks/exhaustive-deps

  const pickFile = async (file, target = null) => {
    if (!file) return;
    setErr(''); setBusy('نقرأ الملف...');
    try {
      const r = await readPlanFile(file, { ai, onStage: setBusy });
      if (!r.ok) { setErr(r.error); if (r.preview) URL.revokeObjectURL(r.preview.url); return; }
      setImporting({ ...r, name: file.name, target });
    } catch (e) { setErr(e.message || 'تعذرت قراءة الملف.'); } finally { setBusy(''); }
  };

  const years = [...new Set(ws.plans.map((p) => p.year).filter(Boolean))].sort().reverse();
  const shown = ws.plans.filter((p) => (!filter.year || p.year === filter.year) && (!filter.semester || p.semester === filter.semester) && (!filter.grade || p.grade === filter.grade))
    .sort((a, b) => (b.year || '').localeCompare(a.year || '') || (a.semester || '').localeCompare(b.semester || '') || (GRADE_NAMES.indexOf(a.grade) - GRADE_NAMES.indexOf(b.grade)));
  const edit = ws.plans.find((p) => p.id === editId);

  const removePlan = (p) => {
    const asg = ws.assignments.filter((a) => a.planId === p.id);
    const ids = new Set(asg.map((a) => a.id));
    const logs = ws.log.filter((g) => ids.has(g.assignmentId));
    const msg = asg.length || logs.length
      ? `حذف «${planLabel(p)}» نهائيًا؟\nسيُحذف معها ${asg.length} ربط بحصص و${logs.length} تسجيل تنفيذ. لا يمكن التراجع.`
      : `حذف «${planLabel(p)}» نهائيًا؟ لا يمكن التراجع.`;
    if (!window.confirm(msg)) return;
    update((w) => ({ ...w, plans: w.plans.filter((x) => x.id !== p.id), assignments: w.assignments.filter((a) => a.planId !== p.id), log: w.log.filter((g) => !ids.has(g.assignmentId)) }));
    notify('حُذفت الخطة.');
  };

  return (
    <div className="ca-stack">
      <section className="ca-card">
        <div className="ca-card-head">
          <div><h3>خططي الفصلية</h3><p className="ca-muted">خطة مستقلة لكل عام وفصل وصف. تبقى في حسابك فقط.</p></div>
          <div className="ca-row ca-wrap">
            <button type="button" className="ca-btn" onClick={() => fileRef.current && fileRef.current.click()} disabled={!!busy}><Icon n="upload" />{busy || 'رفع خطة'}</button>
            <button type="button" className="ca-btn is-ghost" onClick={() => downloadPlanTemplate().catch(() => notify('تعذر إنشاء القالب.', 'err'))}><Icon n="download" />قالب Excel</button>
            <button type="button" className="ca-btn is-ghost" onClick={() => setImporting({ drafts: [{ year: '', semester: '', grade: '', subject: 'المهارات الموسيقية', units: [{ id: `u${Date.now()}`, title: '', lessons: [] }], issues: [], stats: {} }], via: 'manual', note: '', preview: null, name: 'خطة جديدة' })}><Icon n="plus" />إدخال يدوي</button>
            <input ref={fileRef} type="file" accept={PLAN_ACCEPT} hidden onChange={(e) => { const f = e.target.files[0]; e.target.value = ''; pickFile(f, replaceFor); setReplaceFor(null); }} />
          </div>
        </div>
        {busy && <div className="ca-busy is-inline" role="status"><span className="ca-spin" /> {busy}</div>}
        {err && <div className="ca-notice is-err" role="alert"><Icon n="warn" /><span>{err}</span></div>}
        <ul className="ca-tips">
          <li><b>Excel وCSV وWord (جداول)</b> تُقرأ على جهازك مباشرة. <b>PDF والصور وملفات Word الممسوحة</b> {aiReady ? 'تُقرأ بالقراءة الذكية عبر خادم المنصة لحظيًا دون حفظ الملف.' : 'تحتاج «القراءة الذكية» غير المفعّلة حاليًا على المنصة؛ استخدم قالب Excel.'}</li>
          <li>لا تُعتمد أي خطة قبل مراجعتك. لا نخمّن اسم درس غير واضح، ولا نضع عدد حصص من عندنا، ولا نغيّر الترتيب.</li>
          <li>الملف الأصلي لا يُحفظ؛ تُحفظ البيانات التي اعتمدتها فقط. استخدام خطة الوزارة داخل حسابك لا يعني امتلاك حق إعادة نشرها، ولا تُنسب للمنصة.</li>
        </ul>
      </section>

      {ws.plans.length > 0 && (
        <section className="ca-card">
          <div className="ca-row ca-wrap lp-mb">
            <select className="ca-input ca-w8" value={filter.year} onChange={(e) => setFilter({ ...filter, year: e.target.value })} aria-label="العام"><option value="">كل الأعوام</option>{years.map((y) => <option key={y}>{y}</option>)}</select>
            <select className="ca-input ca-w8" value={filter.semester} onChange={(e) => setFilter({ ...filter, semester: e.target.value })} aria-label="الفصل"><option value="">كل الفصول</option>{SEMESTERS.map((s) => <option key={s}>{s}</option>)}</select>
            <select className="ca-input ca-w8" value={filter.grade} onChange={(e) => setFilter({ ...filter, grade: e.target.value })} aria-label="الصف"><option value="">كل الصفوف</option>{GRADE_NAMES.filter((g) => ws.plans.some((p) => p.grade === g)).map((g) => <option key={g}>{g}</option>)}</select>
          </div>
          <div className="lp-plan-grid">
            {shown.map((p) => {
              const ls = allLessons(p);
              const linked = ws.assignments.filter((a) => a.planId === p.id).length;
              const missing = ls.filter((l) => !l.sessions).length;
              return (
                <article key={p.id} className="lp-plan-card">
                  <div className="lp-plan-top"><span className="lp-chip">{p.grade || 'صف غير محدد'}</span><span className="lp-chip is-soft">{p.semester || 'فصل غير محدد'}</span><span className="lp-chip is-soft">{p.year || 'عام غير محدد'}</span></div>
                  <h4>{p.grade || 'صف غير محدد'}{p.subject ? ` — ${p.subject}` : ''}</h4>
                  <p className="ca-muted ca-small">{p.units.length} وحدة • {ls.length} درس • {ls.reduce((a, l) => a + (l.sessions || 0), 0)} حصة{missing ? ` • ${missing} بلا عدد حصص` : ''}</p>
                  <p className="ca-muted ca-small">المصدر: {p.source.official ? 'الخطة المدمجة في المنصة' : p.source.name || 'إدخال يدوي'} • رُفعت {fmtStamp(p.createdAt)} • آخر تحديث {fmtStamp(p.updatedAt)}{p.versions.length ? ` • ${p.versions.length} نسخة سابقة` : ''}</p>
                  <p className="ca-small">{linked ? `${linked} حصة مرتبطة بجدولك` : 'لم تُربط بجدولك بعد'}</p>
                  <div className="ca-row ca-wrap">
                    <button type="button" className="ca-btn is-sm" onClick={() => setEditId(p.id)}><Icon n="edit" size={15} />فتح وتعديل</button>
                    <button type="button" className="ca-btn is-ghost is-sm" onClick={() => onGoto('link')}><Icon n="grid" size={15} />ربط بجدولي</button>
                    <button type="button" className="ca-btn is-ghost is-sm" onClick={() => { setReplaceFor(p.id); fileRef.current && fileRef.current.click(); }}><Icon n="upload" size={15} />استبدال/تحديث بملف</button>
                    <button type="button" className="ca-icon-btn" onClick={() => removePlan(p)} aria-label="حذف الخطة"><Icon n="trash" size={15} /></button>
                  </div>
                </article>
              );
            })}
            {!shown.length && <p className="ca-muted">لا توجد خطط بهذه الاختيارات.</p>}
          </div>
        </section>
      )}

      <section className="ca-card">
        <div className="ca-card-head"><div><h3>الحفظ والمزامنة</h3><p className="ca-muted">الخطط والتوزيع وسجل التنفيذ محفوظة على هذا الجهاز لحسابك فقط</p></div></div>
        {sync.available ? (
          <>
            <Toggle checked={sync.on} onChange={sync.toggle} label="مزامنة خططي مع حسابي" hint="لاستخدامها من جهاز آخر بعد تسجيل الدخول؛ لا يصل إليها غيرك" />
            {sync.on && <p className={`ca-small ${sync.state === 'error' ? 'ca-error' : 'ca-muted'}`}>{sync.state === 'saving' ? 'جارٍ الحفظ...' : sync.state === 'error' ? sync.error : sync.at ? `آخر مزامنة: ${fmtStamp(sync.at)}` : 'ستتم المزامنة بعد أول تعديل'}</p>}
            <div className="ca-row ca-wrap"><button type="button" className="ca-btn is-ghost is-sm" onClick={sync.pull}><Icon n="cloud" size={15} />استرجاع من حسابي</button>{sync.on && <button type="button" className="ca-btn is-ghost is-sm" onClick={sync.push}><Icon n="upload" size={15} />{sync.conflict ? 'حفظ نسخة هذا الجهاز فوق نسخة الحساب' : 'حفظ الآن'}</button>}</div>
          </>
        ) : <p className="ca-muted ca-small">المزامنة مع الحساب غير متاحة حاليًا (تتطلب تسجيل الدخول وقاعدة البيانات على الخادم).</p>}
        <button type="button" className="ca-btn is-danger is-sm ca-mt" onClick={() => { if (window.confirm('حذف كل الخطط والتوزيع وسجل التنفيذ من هذا الجهاز نهائيًا؟')) onWipe(); }}><Icon n="trash" size={15} />حذف كل بيانات الخطط من هذا الجهاز</button>
      </section>

      {importing && <ReviewModal ws={ws} update={update} notify={notify} data={importing} onClose={() => { if (importing.preview && importing.preview.url.startsWith('blob:')) URL.revokeObjectURL(importing.preview.url); setImporting(null); }} onDone={(id) => { setImporting(null); setEditId(null); notify('اعتُمدت الخطة. الخطوة التالية: ربطها بجدولك.'); onGoto('link'); }} />}
      {edit && <PlanDetail plan={edit} ws={ws} update={update} notify={notify} onClose={() => setEditId(null)} />}
    </div>
  );
}

/** مراجعة المستخرج قبل الاعتماد — مع معاينة الملف الأصلي للمقارنة */
function ReviewModal({ ws, update, notify, data, onClose, onDone }) {
  const [drafts, setDrafts] = useState(() => data.drafts.map((d) => ({ ...d, units: d.units.map((u) => ({ ...u, lessons: u.lessons.map((l) => ({ ...l, unsure: [...(l.unsure || [])] })) })) })));
  const [i, setI] = useState(0);
  const [useAlt, setUseAlt] = useState(false);
  const [dest, setDest] = useState(data.target ? `replace:${data.target}` : 'new');
  const [done, setDone] = useState([]);
  const d = drafts[i];
  const setD = (patch) => setDrafts((all) => all.map((x, k) => (k === i ? { ...x, ...patch } : x)));
  const lessons = d.units.flatMap((u) => u.lessons);
  const noTitle = lessons.filter((l) => !l.title.trim()).length;
  const metaMissing = !d.year || !d.semester || !d.grade;
  const candidates = ws.plans.filter((p) => (!d.grade || p.grade === d.grade));
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
            <Field label="الصف"><select className="ca-input" value={d.grade} onChange={(e) => setD({ grade: e.target.value })}><option value="">— اختر —</option>{GRADE_NAMES.map((g) => <option key={g}>{g}</option>)}</select></Field>
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

function PlanDetail({ plan, ws, update, notify, onClose }) {
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
        <Field label="الصف"><select className="ca-input" value={meta.grade} onChange={(e) => setMeta({ ...meta, grade: e.target.value })}>{GRADE_NAMES.map((g) => <option key={g}>{g}</option>)}</select></Field>
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
