'use client';
// 🔗 «ربط الخطة بجدولي المدرسي»: الجدول من «منبّه الحصص» (قراءة فقط) + توزيع يدوي أو مقترح يعتمده المعلم + متابعة التعارضات.
import { useMemo, useState } from 'react';
import { Icon, Modal } from '../../class-alarm/ui/parts';
import { fmtTime, addDays, DAY_NAMES } from '../../class-alarm/core/time.js';
import { resolveDay } from '../../class-alarm/core/schedule.js';
import { planLabel, allLessons, gradeNum, classLabelOf, findLesson } from '../core/model.js';
import { classesFromProfile, lessonState, suggestDistribution, makeAssignment, validateSlot, latestLog, occurrences } from '../core/track.js';
import { linksForDay } from '../core/links.js';
import { StatusBadge, AssignModal, AlertPlanModal, fmtD, slotText } from './lpParts';

export default function LinkView({ ws, update, profile, today, notify, alarmHref, onRecord, hasSchedule, conflicts: cf }) {
  const [planId, setPlanId] = useState(() => (ws.plans[0] || {}).id || '');
  const plan = ws.plans.find((p) => p.id === planId) || ws.plans[0];
  const allClasses = useMemo(() => classesFromProfile(profile), [profile]);
  const [showAll, setShowAll] = useState(false);
  const classes = plan && !showAll ? allClasses.filter((c) => gradeNum(c.grade) === gradeNum(plan.grade)) : allClasses;
  const [classKey, setClassKey] = useState('');
  const cls = classes.find((c) => c.classKey === classKey) || classes[0];
  const [assign, setAssign] = useState(null);
  const [suggest, setSuggest] = useState(null);
  const [alertFor, setAlertFor] = useState(null);

  if (!ws.plans.length) return <section className="ca-card"><div className="ca-empty"><Icon n="note" size={34} /><strong>لا توجد خطة بعد</strong><p>ارفع خطتك من «خططي» أولًا، ثم اربط دروسها بحصصك.</p></div></section>;
  if (!hasSchedule) return (
    <section className="ca-card"><div className="ca-empty"><Icon n="bell" size={34} /><strong>جدولك المدرسي غير موجود في «منبّه الحصص»</strong>
      <p>الجدول يُدخل مرة واحدة فقط في المنبّه (الأيام والحصص والصفوف والشعب)، وتقرؤه الخطط من هناك مباشرة.</p>
      <a className="ca-btn" href={alarmHref}><Icon n="grid" />فتح الجدول الذكي</a></div></section>
  );

  const states = cls ? allLessons(plan).map((l) => ({ ...lessonState(ws, plan.id, l, cls.classKey, today), unitTitle: l.unitTitle })) : [];
  const unassigned = states.filter((s) => s.sessions && s.needsSlot.length);
  const overdue = states.filter((s) => s.lesson.end && s.lesson.end < today && !s.complete);
  const soon = states.filter((s) => s.lesson.start && s.lesson.start >= today && s.lesson.start <= addDays(today, 7) && s.needsSlot.length);
  const needsDone = states.filter((s) => s.pendingCompletion || s.postponed.length);
  const unlink = (a) => {
    if (latestLog(ws, a.id)) { notify('لهذه الحصة تسجيل تنفيذ؛ لا تُحذف للحفاظ على السجل. سجّل تأجيلها أو اختر موعدًا بديلًا بدلًا من ذلك.', 'err'); return; }
    if (!window.confirm('إلغاء ربط هذه الحصة بالدرس؟ (لا يؤثر على جدولك ولا على الخطة)')) return;
    update((w) => ({ ...w, assignments: w.assignments.filter((x) => x.id !== a.id) }));
  };

  return (
    <div className="ca-stack">
      <section className="ca-card">
        <div className="ca-card-head">
          <div><h3>ربط الخطة بجدولي المدرسي</h3><p className="ca-muted">فترة الدرس في الخطة ليست موعدًا فعليًا؛ الموعد يحدده المعلم من حصصه الحقيقية في المنبّه.</p></div>
          <a className="ca-btn is-ghost is-sm" href={alarmHref}><Icon n="bell" size={15} />فتح الجدول الذكي</a>
        </div>
        <div className="ca-row ca-wrap">
          <select className="ca-input lp-w14" value={plan.id} onChange={(e) => { setPlanId(e.target.value); setClassKey(''); }} aria-label="الخطة">{ws.plans.map((p) => <option key={p.id} value={p.id}>{planLabel(p)}</option>)}</select>
          <select className="ca-input lp-w14" value={cls ? cls.classKey : ''} onChange={(e) => setClassKey(e.target.value)} aria-label="الصف والشعبة">
            {classes.length ? classes.map((c) => <option key={c.classKey} value={c.classKey}>{c.label} ({c.weekly.length} حصص أسبوعيًا)</option>) : <option value="">لا توجد شعب لهذا الصف في جدولك</option>}
          </select>
          <label className="ca-row ca-small"><input type="checkbox" checked={showAll} onChange={(e) => { setShowAll(e.target.checked); setClassKey(''); }} />إظهار كل صفوفي</label>
          {cls && <button type="button" className="ca-btn" onClick={() => setSuggest(suggestDistribution(ws, plan, profile, cls, { fromKey: today }))}><Icon n="sparkle" />اقتراح توزيع</button>}
        </div>
        {!classes.length && <div className="ca-notice is-warn ca-mt"><Icon n="warn" /><span>لا توجد في جدولك بالمنبّه حصص لـ {plan.grade}. أضفها في المنبّه (الصف والشعبة في خانة الحصة)، أو فعّل «إظهار كل صفوفي».</span></div>}
        {cls && (
          <div className="lp-kpis">
            <span>لم تُوزع بالكامل: <b>{unassigned.length}</b></span>
            <span className={overdue.length ? 'is-bad' : ''}>متأخرة عن فترتها: <b>{overdue.length}</b></span>
            <span className={soon.length ? 'is-warn' : ''}>اقترب موعدها ولم تُوزع: <b>{soon.length}</b></span>
            <span className={needsDone.length ? 'is-warn' : ''}>تحتاج استكمالًا أو موعدًا بديلًا: <b>{needsDone.length}</b></span>
          </div>
        )}
      </section>

      {cf.length > 0 && (
        <section className="ca-card lp-conflicts">
          <div className="ca-card-head"><div><h3>تعارضات بعد تعديل الجدول</h3><p className="ca-muted">هذه الحصص لم تعد متاحة كما رُبطت. لم نغيّر شيئًا؛ اختر الحل المناسب.</p></div></div>
          <ul className="lp-list">
            {cf.map(({ a, reason }) => (
              <li key={a.id}><div><b>{a.snapshot.lessonTitle}</b> — {classLabelOf(a.grade, a.section)} • {fmtD(a.dateKey)}<br /><span className="ca-warn-text ca-small">{reason}</span></div>
                <div className="ca-row ca-wrap">
                  {!latestLog(ws, a.id) && <button type="button" className="ca-btn is-sm" onClick={() => { const f = findLesson(ws, a.planId, a.lessonId); if (f) setAssign({ plan: f.plan, lesson: f.lesson, unitTitle: f.unit.title, cls: { classKey: a.classKey, grade: a.grade, section: a.section, label: classLabelOf(a.grade, a.section) }, existing: a }); }}>اختيار موعد بديل</button>}
                  <button type="button" className="ca-btn is-ghost is-sm" onClick={() => onRecord(a.id)}>تسجيلها مؤجلة/ملغاة</button>
                </div></li>
            ))}
          </ul>
        </section>
      )}

      {cls && (
        <section className="ca-card">
          <div className="ca-card-head"><div><h3>دروس الخطة — {cls.label}</h3><p className="ca-muted">لكل درس عدد حصصه؛ اربط كل حصة بموعد فعلي</p></div></div>
          <ol className="lp-ltrack">
            {states.map((s) => {
              const st = s.complete ? 'done' : s.lesson.end && s.lesson.end < today ? 'overdue' : s.started ? 'partial' : null;
              return (
                <li key={s.lesson.id} className={`lp-lt${s.complete ? ' is-done' : ''}`}>
                  <div className="lp-lt-head">
                    <div><strong>{s.lesson.title || '(بلا اسم)'}</strong><span className="ca-muted ca-small">{s.unitTitle ? `${s.unitTitle} • ` : ''}{s.lesson.start ? `الفترة في الخطة: ${fmtD(s.lesson.start)} ← ${fmtD(s.lesson.end)}` : 'بلا فترة'} • {s.sessions ? `${s.sessions} حصة` : 'عدد الحصص غير محدد'}</span></div>
                    <div className="ca-row ca-wrap">
                      {st && <StatusBadge status={st} label={s.complete ? 'مكتمل' : st === 'overdue' ? 'متأخر' : 'بدأ التنفيذ'} />}
                      {s.sessions ? <button type="button" className="ca-btn is-sm" onClick={() => setAssign({ plan, lesson: s.lesson, unitTitle: s.unitTitle, cls })}><Icon n="plus" size={15} />ربط بموعد</button> : <span className="ca-warn-text ca-small">أدخل عدد الحصص في «خططي» أولًا</span>}
                    </div>
                  </div>
                  <ul className="lp-parts">
                    {s.parts.map((p) => (
                      <li key={p.part} className={p.done ? 'is-done' : p.active ? 'is-set' : 'is-empty'}>
                        <span className="lp-part-no">الحصة {p.part}{s.sessions ? ` من ${s.sessions}` : ''}{p.overAllocated ? ' (إضافية)' : ''}</span>
                        {p.items.length === 0 && <span className="ca-muted">لم تُربط بموعد</span>}
                        {p.items.map(({ a, status }) => (
                          <span key={a.id} className="lp-asg">
                            <StatusBadge status={status} /> {fmtD(a.dateKey)}
                            {(status === 'scheduled' || status === 'awaiting') && !latestLog(ws, a.id) && <button type="button" className="ca-link" onClick={() => setAssign({ plan, lesson: s.lesson, unitTitle: s.unitTitle, cls, existing: a })}>تغيير</button>}
                            {a.dateKey <= today && <button type="button" className="ca-link" onClick={() => onRecord(a.id)}>تسجيل التنفيذ</button>}
                            {a.dateKey >= today && (status === 'scheduled') && <button type="button" className="ca-link" onClick={() => setAlertFor(a)}>{a.alertPlan ? 'تنبيه خاص ✓' : 'تنبيه خاص'}</button>}
                            {!latestLog(ws, a.id) && <button type="button" className="ca-link is-muted" onClick={() => unlink(a)}>إلغاء الربط</button>}
                          </span>
                        ))}
                      </li>
                    ))}
                    {s.items.filter((x) => x.a.kind === 'completion').map(({ a, status }) => <li key={a.id} className="is-set"><span className="lp-part-no">استكمال</span><span className="lp-asg"><StatusBadge status={status} /> {fmtD(a.dateKey)}{a.dateKey <= today && <button type="button" className="ca-link" onClick={() => onRecord(a.id)}>تسجيل التنفيذ</button>}</span></li>)}
                  </ul>
                </li>
              );
            })}
          </ol>
          <Orphans ws={ws} plan={plan} classKey={cls.classKey} onRecord={onRecord} />
        </section>
      )}

      <WeekBoard ws={ws} profile={profile} today={today} />

      {assign && <AssignModal ws={ws} update={update} profile={profile} plan={assign.plan} lesson={assign.lesson} unitTitle={assign.unitTitle} classes={assign.existing ? [assign.cls] : classes.length ? classes : allClasses} cls={assign.cls} today={today} existing={assign.existing} notify={notify} onClose={() => setAssign(null)} />}
      {suggest && <SuggestModal today={today} data={suggest} ws={ws} update={update} profile={profile} plan={plan} cls={cls} notify={notify} onClose={() => setSuggest(null)} />}
      {alertFor && <AlertPlanModal assignment={alertFor} update={update} defaultPlan={profile.plan} onClose={() => setAlertFor(null)} />}
    </div>
  );
}

/** دروس حُذفت من الخطة عند تحديثها لكن لها سجلات — لا تُفقد */
function Orphans({ ws, plan, classKey, onRecord }) {
  const ids = new Set(allLessons(plan).map((l) => l.id));
  const list = ws.assignments.filter((a) => a.planId === plan.id && a.classKey === classKey && !ids.has(a.lessonId));
  if (!list.length) return null;
  return (
    <div className="ca-card is-flat ca-mt">
      <div className="ca-label">حصص مسجلة لدروس لم تعد في الخطة الحالية (محفوظة)</div>
      <ul className="lp-list">{list.map((a) => <li key={a.id}><span>{a.snapshot.lessonTitle} — {fmtD(a.dateKey)}</span><button type="button" className="ca-link" onClick={() => onRecord(a.id)}>السجل</button></li>)}</ul>
    </div>
  );
}

function SuggestModal({ data: initial, ws, update, profile, plan, cls, notify, onClose, today }) {
  const [data, setData] = useState(initial);
  const [withOverdue, setWithOverdue] = useState(false);
  const [sel, setSel] = useState(() => new Set(initial.suggestions.map((_, i) => i)));
  const [items, setItems] = useState(initial.suggestions);
  const rerun = (inc) => { const d = suggestDistribution(ws, plan, profile, cls, { fromKey: today, includeOverdue: inc }); setWithOverdue(inc); setData(d); setItems(d.suggestions); setSel(new Set(d.suggestions.map((_, i) => i))); };
  const overdueSkipped = data.skipped.filter((k) => k.overdue);
  const free = useMemo(() => occurrences(profile, cls.classKey, data.range.from, data.range.to), [profile, cls, data]);
  const approve = () => {
    const chosen = items.filter((_, i) => sel.has(i));
    const keys = new Set();
    const out = [], bad = [];
    for (const s of chosen) {
      const k = s.slot.dateKey + s.slot.slotKey;
      const err = keys.has(k) ? 'مكررة في الاقتراح' : validateSlot({ ...ws, assignments: [...ws.assignments, ...out] }, profile, cls.classKey, s.slot.dateKey, s.slot.slotKey);
      if (err) { bad.push(`${s.lesson.title} (${err})`); continue; }
      keys.add(k);
      const a = makeAssignment({ plan, lesson: s.lesson, unitTitle: s.unitTitle, cls, profile, dateKey: s.slot.dateKey, slotKey: s.slot.slotKey, part: s.part, replaces: s.replaces });
      out.push(a);
    }
    if (out.length) update((w) => ({ ...w, assignments: [...w.assignments, ...out] }));
    notify(`اعتُمدت المواعيد المحددة (${out.length})${bad.length ? `، وتُرك ${bad.length} لتعارض: ${bad.join('، ')}` : ''}.`, bad.length ? 'err' : 'ok');
    onClose();
  };
  return (
    <Modal title={`توزيع مقترح — ${cls.label}`} onClose={onClose} wide
      footer={<><button type="button" className="ca-btn" onClick={approve} disabled={!sel.size}><Icon n="check" />اعتماد المحدد ({sel.size})</button><button type="button" className="ca-btn is-ghost" onClick={onClose}>إلغاء</button></>}>
      <div className="ca-notice is-info"><Icon n="info" /><span>اقتراح فقط: رتّبنا حصص الدروس غير الموزعة بالترتيب على حصص {cls.label} الفعلية القادمة في جدولك، بدءًا من بداية فترة كل درس، دون تجاوز عدد حصصه ودون حصص محجوزة. راجع وعدّل ثم اعتمد.</span></div>
      {!items.length && <p className="ca-muted ca-pad">لا توجد حصص تحتاج توزيعًا (أو لا توجد حصص متاحة).</p>}
      <table className="lp-table">
        <thead><tr><th /><th>الدرس</th><th>الحصة</th><th>الموعد المقترح</th><th>ملاحظة</th></tr></thead>
        <tbody>
          {items.map((s, i) => (
            <tr key={i} className={s.outside ? 'is-warn' : ''}>
              <td><input type="checkbox" checked={sel.has(i)} onChange={(e) => { const n = new Set(sel); if (e.target.checked) n.add(i); else n.delete(i); setSel(n); }} aria-label="اعتماد" /></td>
              <td>{s.lesson.title}</td>
              <td>{s.part} من {s.sessions}</td>
              <td><select className="ca-input" value={s.slot.dateKey + '|' + s.slot.slotKey} onChange={(e) => { const o = free.find((x) => x.dateKey + '|' + x.slotKey === e.target.value); if (o) setItems(items.map((x, j) => (j === i ? { ...x, slot: o, outside: !!(x.lesson.end && o.dateKey > x.lesson.end) } : x))); }}>{free.map((o) => <option key={o.dateKey + o.slotKey} value={o.dateKey + '|' + o.slotKey}>{slotText(o)}</option>)}</select></td>
              <td className="ca-small">{s.outside ? 'بعد نهاية فترة الدرس في الخطة' : s.reschedule ? 'موعد بديل لحصة سابقة' : ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {data.skipped.filter((k) => !k.overdue).length > 0 && <div className="ca-notice is-warn ca-mt"><Icon n="warn" /><span>لم يُقترح موعد لـ: {[...new Set(data.skipped.filter((k) => !k.overdue).map((k) => `${k.lesson.title || 'درس'} (${k.reason})`))].join('، ')}</span></div>}
      {(overdueSkipped.length > 0 || withOverdue) && (
        <div className="ca-notice is-info ca-mt"><Icon n="info" /><span>{withOverdue ? 'تشمل الاقتراحات الآن الدروس التي انتهت فترتها في الخطة.' : `دروس انتهت فترتها في الخطة ولم يُسجَّل تنفيذها (${overdueSkipped.length}) — ${overdueSkipped.map((k) => k.lesson.title).join('، ')}. إن كنت درّسته فوثّقه من «ربط بموعد» ← إظهار الحصص الماضية؛ وإن لم تدرّسه بعد يمكنك إدراجه في الاقتراح.`}</span>
          <button type="button" className="ca-btn is-ghost is-sm" onClick={() => rerun(!withOverdue)}>{withOverdue ? 'استبعاد الدروس المتأخرة' : 'إدراجها في الاقتراح'}</button></div>
      )}
    </Modal>
  );
}

/** جدولي هذا الأسبوع من المنبّه مع الدروس المرتبطة (قراءة فقط) */
function WeekBoard({ ws, profile, today }) {
  const [start, setStart] = useState(() => addDays(today, -new Date(`${today}T00:00:00Z`).getUTCDay()));
  const days = profile.days.map((d) => addDays(start, d));
  return (
    <section className="ca-card">
      <div className="ca-card-head">
        <div><h3>جدولي من المنبّه مع الدروس</h3><p className="ca-muted">عرض فقط — لتعديل الحصص والأوقات استخدم «منبّه الحصص»</p></div>
        <div className="ca-row"><button type="button" className="ca-icon-btn" onClick={() => setStart(addDays(start, -7))} aria-label="الأسبوع السابق"><Icon n="back" /></button><span className="ca-small">{fmtD(start)}</span><button type="button" className="ca-icon-btn" style={{ transform: 'scaleX(-1)' }} onClick={() => setStart(addDays(start, 7))} aria-label="الأسبوع التالي"><Icon n="back" /></button></div>
      </div>
      <div className="lp-week-board">
        {days.map((k) => {
          const day = resolveDay(profile, k);
          const links = linksForDay(ws, profile, k, today);
          const ev = day.events.filter((e) => e.type === 'lesson' || (e.type === 'extra' && e.kind === 'lesson'));
          return (
            <div key={k} className={`lp-wday${k === today ? ' is-today' : ''}`}>
              <div className="lp-wday-h">{DAY_NAMES[day.weekday]} <small>{k.slice(8)}/{k.slice(5, 7)}</small></div>
              {day.holiday ? <p className="ca-muted ca-small">إجازة: {day.holiday.name}</p> : ev.length === 0 ? <p className="ca-muted ca-small">لا حصص</p> : ev.map((e) => {
                const l = links.get(e.key);
                return <div key={e.key} className={`lp-wev${e.cancelled ? ' is-cancel' : ''}${l ? ' is-linked' : ''}`}><b>{fmtTime(e.start)}</b> {e.cls || e.title}<span>{e.cancelled ? 'ملغاة' : l ? `${l.lessonTitle}${l.sessions ? ` (${l.part}/${l.sessions})` : ''}` : 'بلا درس'}</span></div>;
              })}
            </div>
          );
        })}
      </div>
    </section>
  );
}
