'use client';
// 🧩 مكونات مشتركة: شارة الحالة، محرر الدروس، نافذة اختيار الموعد، نافذة تسجيل التنفيذ
import { useMemo, useState } from 'react';
import { Icon, Modal, Field } from '../../class-alarm/ui/parts';
import PlanEditor from '../../class-alarm/ui/PlanEditor';
import { TONES } from '../../class-alarm/ui/audio';
import { fmtTime, fmtDate, addDays } from '../../class-alarm/core/time.js';
import { STATUSES, STATUS_LABEL, findLesson, classLabelOf, uid } from '../core/model.js';
import { occurrences, validateSlot, makeAssignment, alternativeSlots, assignmentStatus, slotInfo, SLOT_REASON, lessonState, latestLog, dayNameOf } from '../core/track.js';

const TONE_OF = { scheduled: 'next', awaiting: 'info', done: 'ok', partial: 'warn', 'needs-completion': 'warn', postponed: 'warn', cancelled: 'bad', missed: 'bad', unassigned: 'muted', overdue: 'bad' };
export function StatusBadge({ status, label }) {
  return <span className={`lp-st is-${TONE_OF[status] || 'muted'}`}>{label || STATUS_LABEL[status] || (status === 'unassigned' ? 'غير موزعة' : status === 'overdue' ? 'متأخر' : status)}</span>;
}
export const fmtD = (k) => (k ? `${dayNameOf(k)} ${k.slice(8).replace(/^0/, '')}/${k.slice(5, 7).replace(/^0/, '')}/${k.slice(0, 4)}` : '—');
export const slotText = (o) => `${o.dayName || dayNameOf(o.dateKey)} ${o.dateKey.slice(8).replace(/^0/, '')}/${o.dateKey.slice(5, 7).replace(/^0/, '')} • ${o.label} • ${fmtTime(o.start)}`;

const FIELD_LABEL = { title: 'اسم الدرس', unit: 'الوحدة', sessions: 'عدد الحصص', dates: 'الفترة الزمنية', outcomes: 'المخرجات', assessment: 'التقويم' };

/** محرر الوحدات والدروس (للمراجعة بعد الاستيراد ولتعديل الخطة) — لا يعيد الترتيب إلا بزر صريح */
export function LessonTable({ units, onChange, showLines = false, altLabels = null, useAlt = false }) {
  const [open, setOpen] = useState(null);
  const set = (ui, li, patch) => onChange(units.map((u, i) => (i !== ui ? u : { ...u, lessons: u.lessons.map((l, j) => (j !== li ? l : { ...l, ...patch, unsure: (l.unsure || []).filter((f) => !Object.keys(patch).some((k) => (k === 'start' || k === 'end' ? f === 'dates' : k === 'sessionsAlt' ? f === 'sessions' : f === k))) })) })));
  const move = (ui, li, d) => onChange(units.map((u, i) => { if (i !== ui) return u; const ls = [...u.lessons]; const t = ls[li + d]; if (!t) return u; ls[li + d] = ls[li]; ls[li] = t; return { ...u, lessons: ls }; }));
  const del = (ui, li) => { if (window.confirm(`حذف الدرس «${units[ui].lessons[li].title || 'بلا اسم'}» من الخطة؟`)) onChange(units.map((u, i) => (i !== ui ? u : { ...u, lessons: u.lessons.filter((_, j) => j !== li) }))); };
  const add = (ui) => onChange(units.map((u, i) => (i !== ui ? u : { ...u, lessons: [...u.lessons, { id: uid('l'), title: '', weeks: '', start: '', end: '', sessions: null, outcomes: '', assessment: '', notes: '', unsure: ['title', 'sessions', 'dates'] }] })));
  const sKey = useAlt && altLabels ? 'sessionsAlt' : 'sessions';
  return (
    <div className="lp-units">
      {units.map((u, ui) => (
        <section key={u.id} className="lp-unit">
          <div className="lp-unit-head">
            <input className="ca-input lp-unit-title" value={u.title} placeholder="اسم الوحدة (اختياري)" onChange={(e) => onChange(units.map((x, i) => (i === ui ? { ...x, title: e.target.value } : x)))} aria-label="اسم الوحدة" />
            <span className="ca-muted ca-small">{u.lessons.length} درس</span>
          </div>
          <ol className="lp-lessons">
            {u.lessons.map((l, li) => {
              const uns = new Set(l.unsure || []);
              const isOpen = open === l.id;
              return (
                <li key={l.id} className={`lp-lesson${uns.size ? ' is-unsure' : ''}`}>
                  <div className="lp-lesson-main">
                    <span className="lp-no">{li + 1}</span>
                    <input className={`ca-input lp-title${uns.has('title') ? ' is-bad' : ''}`} value={l.title} placeholder="اسم الدرس كما في الملف الأصلي" onChange={(e) => set(ui, li, { title: e.target.value })} aria-label="اسم الدرس" />
                    <label className={`lp-mini${uns.has('dates') ? ' is-bad' : ''}`}><span>من</span><input className="ca-input" type="date" value={l.start || ''} onChange={(e) => set(ui, li, { start: e.target.value })} /></label>
                    <label className={`lp-mini${uns.has('dates') ? ' is-bad' : ''}`}><span>إلى</span><input className="ca-input" type="date" value={l.end || ''} onChange={(e) => set(ui, li, { end: e.target.value })} /></label>
                    <label className={`lp-mini lp-sess${uns.has('sessions') ? ' is-bad' : ''}`}><span>الحصص</span><input className="ca-input" type="number" min="1" max="40" value={l[sKey] ?? ''} placeholder="؟" onChange={(e) => set(ui, li, { [sKey]: e.target.value === '' ? null : Math.max(1, Math.min(40, +e.target.value)) })} /></label>
                    <span className="lp-row-tools">
                      <button type="button" className="ca-icon-btn" onClick={() => setOpen(isOpen ? null : l.id)} aria-label="التفاصيل" title="المخرجات والتقويم والملاحظات"><Icon n="note" size={15} /></button>
                      <button type="button" className="ca-icon-btn" onClick={() => move(ui, li, -1)} disabled={li === 0} aria-label="تحريك لأعلى">▲</button>
                      <button type="button" className="ca-icon-btn" onClick={() => move(ui, li, 1)} disabled={li === u.lessons.length - 1} aria-label="تحريك لأسفل">▼</button>
                      <button type="button" className="ca-icon-btn" onClick={() => del(ui, li)} aria-label="حذف الدرس"><Icon n="trash" size={15} /></button>
                    </span>
                  </div>
                  {(uns.size > 0 || l.weeks || (showLines && l.line)) && (
                    <div className="lp-lesson-meta">
                      {showLines && l.line ? <span>السطر {l.line} في الملف{l.rowsMerged > 1 ? ` (دُمج معه ${l.rowsMerged - 1} سطر لنفس الدرس)` : ''}</span> : null}
                      {l.weeks && <span>الأسابيع/النص الأصلي: {l.weeks}</span>}
                      {uns.size > 0 && <span className="lp-unsure">يحتاج مراجعة: {[...uns].map((f) => FIELD_LABEL[f] || f).join('، ')}</span>}
                    </div>
                  )}
                  {isOpen && (
                    <div className="lp-lesson-more">
                      <Field label="المخرجات التعليمية"><textarea className="ca-input" rows={3} value={l.outcomes} onChange={(e) => set(ui, li, { outcomes: e.target.value })} /></Field>
                      <div className="ca-grid2">
                        <Field label="أدوات التقويم"><textarea className="ca-input" rows={2} value={l.assessment} onChange={(e) => set(ui, li, { assessment: e.target.value })} /></Field>
                        <Field label="الملاحظات"><textarea className="ca-input" rows={2} value={l.notes} onChange={(e) => set(ui, li, { notes: e.target.value })} /></Field>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
          <button type="button" className="ca-btn is-ghost is-sm" onClick={() => add(ui)}><Icon n="plus" size={15} />إضافة درس</button>
        </section>
      ))}
      <button type="button" className="ca-btn is-ghost" onClick={() => onChange([...units, { id: uid('u'), title: '', lessons: [] }])}><Icon n="plus" />إضافة وحدة</button>
    </div>
  );
}

/** اختيار موعد فعلي من حصص الصف/الشعبة في جدول المنبّه (لا مواعيد افتراضية) */
export function AssignModal({ ws, update, profile, plan, lesson, unitTitle, classes, cls: initialCls, today, part: initialPart, existing, onClose, notify }) {
  const [classKey, setClassKey] = useState(initialCls ? initialCls.classKey : (classes[0] || {}).classKey);
  const cls = classes.find((c) => c.classKey === classKey);
  const st = cls ? lessonState(ws, plan.id, lesson, cls.classKey, today) : null;
  const firstFree = st && (st.needsSlot[0] || {}).part;
  const [part, setPart] = useState(existing ? existing.part : initialPart || firstFree || 1);
  const [kind, setKind] = useState(existing ? existing.kind : 'session');
  const [past, setPast] = useState(false);
  const [weeks, setWeeks] = useState(4);
  const from = past ? addDays(today, -21) : today;
  const occ = useMemo(() => (cls ? occurrences(profile, cls.classKey, from, addDays(today, weeks * 7)) : []), [profile, cls, from, today, weeks]);
  const n = lesson.sessions || 0;
  const choose = (o) => {
    const err = validateSlot(ws, profile, cls.classKey, o.dateKey, o.slotKey, existing && existing.id);
    if (err) { notify(err, 'err'); return; }
    if (!existing && kind === 'session' && n && part > n && !window.confirm(`الدرس مخصص له ${n} حصة. الربط سيضيف حصة رقم ${part} تتجاوز العدد المخصص. متابعة؟`)) return;
    if (existing) {
      update((w) => ({ ...w, assignments: w.assignments.map((a) => (a.id !== existing.id ? a : { ...a, dateKey: o.dateKey, slotKey: o.slotKey, history: [...a.history, { at: Date.now(), from: { dateKey: a.dateKey, slotKey: a.slotKey }, to: { dateKey: o.dateKey, slotKey: o.slotKey }, reason: 'تعديل الموعد من المعلم' }] })) }));
      notify(`عُدّل موعد الحصة إلى ${slotText(o)}.`);
    } else {
      update((w) => ({ ...w, assignments: [...w.assignments, makeAssignment({ plan, lesson, unitTitle, cls, profile, dateKey: o.dateKey, slotKey: o.slotKey, part, kind })] }));
      notify(`رُبط «${lesson.title}» (${kind === 'completion' ? 'حصة استكمال' : `الحصة ${part}${n ? ` من ${n}` : ''}`}) بـ ${slotText(o)}.`);
    }
    onClose();
  };
  const byWeek = useMemo(() => { const m = new Map(); for (const o of occ) { const wk = o.dateKey < today ? 'حصص سابقة' : `أسبوع ${fmtD(weekStart(o.dateKey))}`; if (!m.has(wk)) m.set(wk, []); m.get(wk).push(o); } return [...m.entries()]; }, [occ, today]);
  return (
    <Modal title={existing ? `تعديل موعد: ${lesson.title}` : `ربط «${lesson.title}» بموعد`} onClose={onClose} wide>
      <div className="lp-assign-head">
        <Field label="الصف والشعبة"><select className="ca-input" value={classKey || ''} onChange={(e) => setClassKey(e.target.value)} disabled={!!existing}>{classes.map((c) => <option key={c.classKey} value={c.classKey}>{c.label}</option>)}</select></Field>
        {!existing && (
          <Field label="أي حصة من الدرس؟">
            <select className="ca-input" value={`${kind}:${part}`} onChange={(e) => { const [k, p] = e.target.value.split(':'); setKind(k); setPart(+p); }}>
              {Array.from({ length: Math.max(n, 1) + 1 }, (_, i) => i + 1).map((p) => <option key={p} value={`session:${p}`}>الحصة {p}{n ? ` من ${n}` : ''}{n && p > n ? ' (إضافية)' : ''}{st && st.parts[p - 1] && (st.parts[p - 1].done ? ' — منفذة' : st.parts[p - 1].active ? ' — مجدولة' : '')}</option>)}
              <option value={`completion:${Math.max(1, (st && st.parts.find((x) => x.partial) || {}).part || 1)}`}>حصة استكمال (لجزء لم يكتمل)</option>
            </select>
          </Field>
        )}
      </div>
      {!cls ? <p className="ca-muted">لا توجد صفوف في جدولك بالمنبّه.</p> : (
        <>
          <p className="ca-muted ca-small">هذه حصص {cls.label} الفعلية من جدولك في «منبّه الحصص» (بعد الإجازات والإلغاء وتغيير الأوقات). فترة الدرس في الخطة: {lesson.start ? `${fmtD(lesson.start)} ← ${fmtD(lesson.end)}` : 'غير محددة'}.</p>
          {byWeek.length === 0 && <p className="ca-muted ca-pad">لا توجد حصص لهذا الصف في المدى المعروض.</p>}
          {byWeek.map(([wk, list]) => (
            <div key={wk} className="lp-week">
              <div className="ca-label">{wk}</div>
              <div className="lp-slots">
                {list.map((o) => {
                  const err = validateSlot(ws, profile, cls.classKey, o.dateKey, o.slotKey, existing && existing.id);
                  const inWin = lesson.start && lesson.end && o.dateKey >= lesson.start && o.dateKey <= lesson.end;
                  return (
                    <button key={o.dateKey + o.slotKey} type="button" className={`lp-slot${err ? ' is-taken' : ''}${inWin ? ' is-win' : ''}`} disabled={!!err} title={err || ''} onClick={() => choose(o)}>
                      <b>{o.dayName} {o.dateKey.slice(8).replace(/^0/, '')}/{o.dateKey.slice(5, 7).replace(/^0/, '')}</b><span>{o.label} • {fmtTime(o.start)}</span>{err ? <small>{err.replace('هذه الحصة مرتبطة بالفعل بدرس ', 'محجوزة: ')}</small> : inWin ? <small>داخل فترة الدرس</small> : null}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          <div className="ca-row ca-wrap ca-mt">
            <button type="button" className="ca-btn is-ghost is-sm" onClick={() => setWeeks(weeks + 4)}>عرض أسابيع أكثر</button>
            <label className="ca-row ca-small"><input type="checkbox" checked={past} onChange={(e) => setPast(e.target.checked)} />إظهار حصص الأسابيع الثلاثة الماضية (لتوثيق ما دُرّس سابقًا)</label>
          </div>
        </>
      )}
    </Modal>
  );
}
function weekStart(k) { const d = new Date(`${k}T00:00:00Z`).getUTCDay(); return addDays(k, -d); }

/** تسجيل تنفيذ حصة — ثم اقتراح موعد بديل عند التأجيل/الإلغاء/عدم التنفيذ، أو حصة استكمال عند التنفيذ الجزئي */
export function RecordModal({ ws, update, profile, today, assignmentId, onClose, notify }) {
  const a = ws.assignments.find((x) => x.id === assignmentId);
  const f = a ? findLesson(ws, a.planId, a.lessonId) : null;
  const cur = a ? assignmentStatus(ws, a, today) : null;
  const last = a ? latestLog(ws, a.id) : null;
  const [status, setStatus] = useState(last ? last.status : 'done');
  const [executedOn, setExecutedOn] = useState(a && a.dateKey <= today ? a.dateKey : today);
  const [note, setNote] = useState('');
  const [reason, setReason] = useState('');
  const [stage, setStage] = useState('record');
  if (!a) return <Modal title="تسجيل التنفيذ" onClose={onClose}><p className="ca-muted">لم نجد هذه الحصة (ربما حُذف الربط).</p></Modal>;
  const si = slotInfo(profile, a.dateKey, a.slotKey);
  const title = f ? f.lesson.title : a.snapshot.lessonTitle;
  const sessions = f ? f.lesson.sessions : a.snapshot.sessions;
  const needReason = ['postponed', 'cancelled', 'missed', 'partial', 'needs-completion'].includes(status);
  const save = () => {
    update((w) => ({ ...w, log: [...w.log, { id: uid('g'), assignmentId: a.id, status, executedOn: ['done', 'partial', 'needs-completion'].includes(status) ? executedOn : '', note: note.trim(), reason: reason.trim(), at: Date.now() }] }));
    notify(`سُجّلت الحالة: ${STATUS_LABEL[status]}.`);
    if (profile && ['postponed', 'cancelled', 'missed', 'partial', 'needs-completion'].includes(status)) setStage('next'); else onClose();
  };
  const alts = stage === 'next' && profile ? alternativeSlots(ws, profile, a.classKey, addDays(today > a.dateKey ? today : a.dateKey, 1), 6) : [];
  const completion = status === 'partial' || status === 'needs-completion';
  const pick = (o) => {
    const err = validateSlot(ws, profile, a.classKey, o.dateKey, o.slotKey);
    if (err) { notify(err, 'err'); return; }
    const plan = ws.plans.find((p) => p.id === a.planId);
    const lesson = f ? f.lesson : { id: a.lessonId, title, sessions };
    if (completion && sessions && !window.confirm(`حصة الاستكمال تُضاف فوق ${sessions} حصة مخصصة للدرس في الخطة. متابعة؟`)) return;
    const na = makeAssignment({ plan: plan || { id: a.planId }, lesson, unitTitle: f ? f.unit.title : a.snapshot.unitTitle, cls: { classKey: a.classKey, grade: a.grade, section: a.section }, profile, dateKey: o.dateKey, slotKey: o.slotKey, part: a.part, kind: completion ? 'completion' : 'session', replaces: a.id });
    na.history = [{ at: Date.now(), from: { dateKey: a.dateKey, slotKey: a.slotKey }, to: { dateKey: o.dateKey, slotKey: o.slotKey }, reason: reason.trim() || STATUS_LABEL[status] }];
    update((w) => ({ ...w, assignments: [...w.assignments, na] }));
    notify(`حُدد الموعد الجديد: ${slotText(o)} (بانتظار تنفيذك).`);
    onClose();
  };
  return (
    <Modal title={stage === 'record' ? 'تسجيل تنفيذ الحصة' : completion ? 'موعد حصة الاستكمال' : 'اختيار موعد بديل'} onClose={onClose}
      footer={stage === 'record' ? <><button type="button" className="ca-btn" onClick={save}><Icon n="check" />حفظ في سجل التنفيذ</button><button type="button" className="ca-btn is-ghost" onClick={onClose}>إلغاء</button></> : <button type="button" className="ca-btn is-ghost" onClick={onClose}>لاحقًا</button>}>
      <div className="lp-rec-card">
        <strong>{title}</strong>
        <span>{a.kind === 'completion' ? 'حصة استكمال' : `الحصة ${a.part}${sessions ? ` من ${sessions}` : ''}`} • {classLabelOf(a.grade, a.section)}{f && f.unit.title ? ` • ${f.unit.title}` : ''}</span>
        <span>الموعد المخطط: {fmtD(a.dateKey)}{si.ok ? ` • ${si.event.label ? `الحصة ${si.event.label}` : ''} ${fmtTime(si.event.start)}` : ` • ${SLOT_REASON[si.reason] || ''}`}</span>
        <span>الحالة الحالية: <StatusBadge status={cur} /></span>
        {a.history.length > 0 && <span className="ca-muted ca-small">سجل التغيير: {a.history.map((h) => `${h.from ? fmtD(h.from.dateKey) : '—'} ← ${h.to ? fmtD(h.to.dateKey) : '—'}${h.reason ? ` (${h.reason})` : ''}`).join(' • ')}</span>}
      </div>
      {stage === 'record' ? (
        <>
          <div className="lp-status-grid" role="radiogroup" aria-label="حالة التنفيذ">
            {STATUSES.map((s) => <button key={s.id} type="button" role="radio" aria-checked={status === s.id} className={`lp-status is-${s.tone}${status === s.id ? ' is-on' : ''}`} onClick={() => setStatus(s.id)}>{s.label}</button>)}
          </div>
          {['done', 'partial', 'needs-completion'].includes(status) && <Field label="تاريخ التنفيذ الفعلي"><input className="ca-input" type="date" value={executedOn} max={today} onChange={(e) => setExecutedOn(e.target.value || today)} /></Field>}
          {needReason && <Field label={status === 'partial' || status === 'needs-completion' ? 'ما الذي لم يُنفذ؟' : 'السبب'}><input className="ca-input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder={status === 'postponed' ? 'نشاط مدرسي، اختبار...' : ''} /></Field>}
          <Field label="ملاحظات المعلم (اختياري)"><textarea className="ca-input" rows={2} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
          <p className="ca-muted ca-small">التسجيل لا يغيّر الخطة الأصلية ولا جدولك. يمكنك تعديل الحالة لاحقًا بتسجيل جديد (يُحفظ السجل كاملًا).</p>
        </>
      ) : (
        <>
          <p className="ca-muted">{completion ? 'هذا الجزء يحتاج حصة استكمال. هذه أقرب حصص متاحة للصف نفسه في جدولك:' : 'أقرب الحصص المتاحة للصف نفسه في جدولك (لن يُعتمد أي موعد إلا باختيارك):'}</p>
          {alts.length === 0 ? <p className="ca-muted ca-pad">لا توجد حصص متاحة في الأسابيع القادمة. يمكنك تحديد الموعد لاحقًا من ⚙️ «الربط بجدولي».</p> : (
            <div className="lp-slots">{alts.map((o) => <button key={o.dateKey + o.slotKey} type="button" className="lp-slot" onClick={() => pick(o)}><b>{o.dayName} {o.dateKey.slice(8).replace(/^0/, '')}/{o.dateKey.slice(5, 7).replace(/^0/, '')}</b><span>{o.label} • {fmtTime(o.start)}</span></button>)}</div>
          )}
        </>
      )}
    </Modal>
  );
}

/** تنبيه خاص لحصة مرتبطة بدرس (يستخدمه «منبّه الحصص» بدل التنبيه العام لهذه الحصة فقط) */
export function AlertPlanModal({ assignment, update, onClose, defaultPlan }) {
  const [plan, setPlan] = useState(assignment.alertPlan || JSON.parse(JSON.stringify(defaultPlan || { before: [{ min: 60, tone: 'chime' }, { min: 15, tone: 'bell' }], start: { on: false, tone: 'start' }, end: { on: false, min: 5, tone: 'soft' } })));
  return (
    <Modal title={`تنبيه خاص: ${assignment.snapshot.lessonTitle}`} onClose={onClose} wide
      footer={<><button type="button" className="ca-btn" onClick={() => { update((w) => ({ ...w, assignments: w.assignments.map((a) => (a.id === assignment.id ? { ...a, alertPlan: plan } : a)) })); onClose(); }}><Icon n="check" />حفظ</button>{assignment.alertPlan && <button type="button" className="ca-btn is-ghost" onClick={() => { update((w) => ({ ...w, assignments: w.assignments.map((a) => (a.id === assignment.id ? { ...a, alertPlan: null } : a)) })); onClose(); }}>العودة لتنبيه المنبّه العام</button>}</>}>
      <p className="ca-muted ca-small">يُطبَّق على هذه الحصة فقط ({fmtD(assignment.dateKey)}) عبر نظام التنبيه نفسه في «منبّه الحصص» (الصوت والإشعار والنغمات وإعدادات الإيقاف هناك).</p>
      <PlanEditor plan={plan} onChange={setPlan} tones={{ builtin: TONES, custom: [] }} onPreview={() => {}} compact />
    </Modal>
  );
}
export { fmtDate };
