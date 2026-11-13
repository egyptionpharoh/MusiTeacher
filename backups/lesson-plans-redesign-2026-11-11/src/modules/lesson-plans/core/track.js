// 🧭 الجسر بين الخطة وجدول المنبّه: حصص كل صف/شعبة الفعلية، التوزيع اليدوي والمقترح، حالة كل حصة، التقدم، والتعارضات.
// يقرأ جدول المنبّه كما هو (ملف الإعداد profile) ولا ينسخه: التوزيع يحفظ فقط (التاريخ + معرّف الحصة).
import { resolveDay } from '../../class-alarm/core/schedule.js';
import { zonedParts, addDays, weekdayOf } from '../../class-alarm/core/time.js';
import { classKeyOf, classLabelOf, allLessons, uid } from './model.js';

const ACTIVE = (s) => s === 'scheduled' || s === 'awaiting';

// ---------- الصفوف والحصص من جدول المنبّه ----------
export function classesFromProfile(profile) {
  const map = new Map();
  if (!profile) return [];
  for (const d of profile.days) {
    for (const p of profile.periods) {
      const l = (profile.lessons[d] || {})[p.id];
      if (p.kind !== 'lesson' || !l || (!l.grade && !l.section)) continue;
      const k = classKeyOf(l.grade, l.section);
      if (!map.has(k)) map.set(k, { classKey: k, grade: l.grade, section: l.section, label: classLabelOf(l.grade, l.section), weekly: [] });
      map.get(k).weekly.push({ day: d, periodId: p.id, label: p.label, start: p.start, subject: l.subject || profile.subject });
    }
  }
  return [...map.values()].sort((a, b) => a.label.localeCompare(b.label, 'ar'));
}

/** حصص صف/شعبة الفعلية بين تاريخين (بعد تطبيق الإجازات والإلغاء وتغيير الوقت والحصص الاستثنائية) */
export function occurrences(profile, classKey, fromKey, toKey, max = 400) {
  const out = [];
  if (!profile || !fromKey || !toKey) return out;
  for (let k = fromKey, i = 0; k <= toKey && i < 400; k = addDays(k, 1), i++) {
    const day = resolveDay(profile, k);
    for (const e of day.events) {
      if (e.cancelled || !(e.type === 'lesson' || (e.type === 'extra' && e.kind === 'lesson'))) continue;
      const l = e.lesson || {};
      if (classKeyOf(l.grade, l.section) !== classKey) continue;
      out.push({ dateKey: k, slotKey: e.key, dayName: day.dayName, label: e.type === 'lesson' ? `الحصة ${e.label}` : 'حصة استثنائية', start: e.start, end: e.end, startMs: e.startMs, endMs: e.endMs, changedToday: e.changedToday, extra: e.type === 'extra' });
      if (out.length >= max) return out;
    }
  }
  return out;
}

/** هل الحصة (تاريخ + معرّف) موجودة فعلًا الآن في جدول المنبّه؟ */
export function slotInfo(profile, dateKey, slotKey) {
  if (!profile) return { ok: false, reason: 'no-schedule' };
  const day = resolveDay(profile, dateKey);
  const e = day.events.find((x) => x.key === slotKey);
  if (!e) return { ok: false, reason: day.holiday ? 'holiday' : !day.isWorkday ? 'off' : 'missing', day };
  if (e.cancelled) return { ok: false, reason: 'cancelled', event: e, day };
  return { ok: true, event: e, day };
}
export const SLOT_REASON = { 'no-schedule': 'لا يوجد جدول في المنبّه', holiday: 'اليوم أصبح إجازة', off: 'لم يعد يوم دوام في جدولك', missing: 'الحصة لم تعد موجودة في الجدول', cancelled: 'الحصة ملغاة في هذا اليوم' };

// ---------- الحالات ----------
export function latestLog(ws, assignmentId) {
  let best = null;
  for (const e of ws.log) if (e.assignmentId === assignmentId && (!best || e.at >= best.at)) best = e;
  return best;
}
/** حالة الحصة: آخر تسجيل تنفيذ، أو «مجدولة» (مستقبلية) أو «بانتظار التسجيل» (مضى موعدها بلا تسجيل) */
export function assignmentStatus(ws, a, todayKey) {
  const g = latestLog(ws, a.id);
  if (g) return g.status;
  return a.dateKey < todayKey ? 'awaiting' : 'scheduled';
}

/** وضع درس لصف/شعبة: أجزاؤه وحصصه وما المنفذ والمتبقي */
export function lessonState(ws, planId, lesson, classKey, todayKey) {
  const list = ws.assignments.filter((a) => a.planId === planId && a.lessonId === lesson.id && a.classKey === classKey).sort((a, b) => (a.dateKey + a.slotKey < b.dateKey + b.slotKey ? -1 : 1));
  const items = list.map((a) => ({ a, status: assignmentStatus(ws, a, todayKey), log: latestLog(ws, a.id) }));
  const n = lesson.sessions || 0;
  const parts = [];
  for (let p = 1; p <= Math.max(n, ...items.filter((x) => x.a.kind === 'session').map((x) => x.a.part), 0); p++) {
    const its = items.filter((x) => x.a.kind === 'session' && x.a.part === p);
    const done = its.some((x) => x.status === 'done');
    const partial = !done && its.some((x) => x.status === 'partial' || x.status === 'needs-completion');
    const active = its.find((x) => ACTIVE(x.status));
    parts.push({ part: p, done, partial, active: active || null, items: its, overAllocated: n > 0 && p > n });
  }
  const completions = items.filter((x) => x.a.kind === 'completion');
  const completionDone = completions.filter((x) => x.status === 'done').length;
  const partialCount = parts.filter((p) => p.partial).length;
  const doneParts = parts.filter((p) => p.done).length;
  const pendingCompletion = Math.max(0, partialCount - completionDone);
  const needsSlot = parts.filter((p) => !p.done && !p.active && p.part <= n);   // أجزاء بلا موعد قائم (لم تُوزع أو أُجّلت/ألغيت/لم تُنفذ)
  const postponed = parts.filter((p) => !p.done && !p.active && p.items.some((x) => ['postponed', 'cancelled', 'missed'].includes(x.status)));
  const complete = n > 0 && doneParts + partialCount >= n && pendingCompletion === 0 && parts.slice(0, n).every((p) => p.done || p.partial);
  const started = items.some((x) => ['done', 'partial', 'needs-completion'].includes(x.status));
  return { lesson, items, parts, sessions: n, doneParts, partialCount, pendingCompletion, needsSlot, postponed, complete, started, awaiting: items.filter((x) => x.status === 'awaiting'), scheduled: items.filter((x) => x.status === 'scheduled') };
}

/** لوحة التقدم: من سجلات التنفيذ الحقيقية فقط (لا من مرور التاريخ) */
export function planProgress(ws, plan, classKey, todayKey) {
  const lessons = allLessons(plan).map((l) => ({ ...lessonState(ws, plan.id, l, classKey, todayKey), unitTitle: l.unitTitle }));
  const withSessions = lessons.filter((s) => s.sessions > 0);
  const totalSessions = withSessions.reduce((a, s) => a + s.sessions, 0);
  const doneSessions = withSessions.reduce((a, s) => a + Math.min(s.sessions, s.doneParts + Math.min(s.partialCount, s.items.filter((x) => x.a.kind === 'completion' && x.status === 'done').length)), 0);
  const overdue = lessons.filter((s) => s.lesson.end && s.lesson.end < todayKey && !s.complete);
  const soon = lessons.filter((s) => s.lesson.start && s.lesson.start >= todayKey && s.lesson.start <= addDays(todayKey, 7) && s.needsSlot.length > 0);
  return {
    lessons, total: lessons.length, started: lessons.filter((s) => s.started).length, completed: lessons.filter((s) => s.complete).length,
    totalSessions, doneSessions, remainingSessions: Math.max(0, totalSessions - doneSessions),
    pct: totalSessions ? Math.round((doneSessions / totalSessions) * 100) : 0,
    overdue, soon, needsCompletion: lessons.filter((s) => s.pendingCompletion > 0 || s.postponed.length > 0),
    missingSessions: lessons.filter((s) => !s.sessions).length,
    unassigned: lessons.filter((s) => s.sessions > 0 && s.needsSlot.length > 0),
    awaiting: lessons.flatMap((s) => s.awaiting),
  };
}

// ---------- التوزيع ----------
/** الحصة محجوزة إذا ارتبط بها درس لم يُسجَّل تأجيله/إلغاؤه/عدم تنفيذه */
const FREEING = new Set(['postponed', 'cancelled', 'missed']);
export function slotTaken(ws, profileId, dateKey, slotKey, exceptId) {
  return ws.assignments.find((a) => a.id !== exceptId && a.profileId === profileId && a.dateKey === dateKey && a.slotKey === slotKey && !FREEING.has(assignmentStatus(ws, a, '0000-00-00')));
}

/** فحص قبل اعتماد موعد: الحصة موجودة لهذا الصف/الشعبة، غير ملغاة، غير محجوزة لدرس آخر */
export function validateSlot(ws, profile, classKey, dateKey, slotKey, exceptId) {
  const s = slotInfo(profile, dateKey, slotKey);
  if (!s.ok) return SLOT_REASON[s.reason] || 'الحصة غير متاحة';
  const l = s.event.lesson || {};
  if (classKeyOf(l.grade, l.section) !== classKey) return 'هذه الحصة ليست لهذا الصف/الشعبة في جدولك';
  const t = slotTaken(ws, profile.id, dateKey, slotKey, exceptId);
  if (t) return `هذه الحصة مرتبطة بالفعل بدرس «${t.snapshot.lessonTitle}»`;
  return null;
}

export function makeAssignment({ plan, lesson, unitTitle, cls, profile, dateKey, slotKey, part, kind = 'session', replaces = null }) {
  return {
    id: uid('a'), planId: plan.id, lessonId: lesson.id, part, kind, classKey: cls.classKey, grade: cls.grade, section: cls.section, profileId: profile.id,
    dateKey, slotKey, replaces, alertPlan: null, snapshot: { lessonTitle: lesson.title, unitTitle: unitTitle || '', sessions: lesson.sessions }, history: [], createdAt: Date.now(),
  };
}

/**
 * اقتراح توزيع (لا يُعتمد إلا بموافقة المعلم): يملأ أجزاء الدروس غير الموزعة بالترتيب على حصص الصف الفعلية القادمة،
 * محترمًا بداية فترة كل درس، دون تجاوز عدد حصصه، ودون استخدام حصة محجوزة. ما يقع بعد نهاية الفترة يُعلَّم «خارج الفترة».
 */
export function suggestDistribution(ws, plan, profile, cls, { fromKey, toKey, lessonIds = null, includeOverdue = false } = {}) {
  const lessons = allLessons(plan).filter((l) => !lessonIds || lessonIds.includes(l.id));
  const lastEnd = lessons.reduce((m, l) => (l.end && l.end > m ? l.end : m), fromKey);
  const until = toKey || addDays(lastEnd > fromKey ? lastEnd : fromKey, 35);
  const free = occurrences(profile, cls.classKey, fromKey, until).filter((o) => !slotTaken(ws, profile.id, o.dateKey, o.slotKey));
  const used = new Set();
  const out = [], skipped = [];
  let cursor = fromKey;
  for (const l of lessons) {
    if (!l.sessions) { skipped.push({ lesson: l, reason: 'عدد الحصص غير محدد' }); continue; }
    const st = lessonState(ws, plan.id, l, cls.classKey, fromKey);
    // درس انتهت فترته في الخطة: غالبًا دُرّس ولم يُوثَّق، فلا نقترح له مواعيد جديدة إلا إذا طلب المعلم ذلك
    if (!includeOverdue && l.end && l.end < fromKey && st.needsSlot.length) { skipped.push({ lesson: l, reason: 'انتهت فترته في الخطة', overdue: true }); continue; }
    for (const p of st.needsSlot) {
      const minKey = [cursor, l.start || cursor].sort().pop();
      const slot = free.find((o) => !used.has(o.dateKey + o.slotKey) && o.dateKey >= minKey);
      if (!slot) { skipped.push({ lesson: l, part: p.part, reason: 'لا توجد حصص متاحة لهذا الصف في المدى المحدد' }); continue; }
      used.add(slot.dateKey + slot.slotKey);
      cursor = slot.dateKey;
      out.push({ lesson: l, unitTitle: l.unitTitle, part: p.part, sessions: l.sessions, slot, outside: !!(l.end && slot.dateKey > l.end), reschedule: p.items.length > 0, replaces: p.items.length ? p.items[p.items.length - 1].a.id : null });
    }
  }
  return { suggestions: out, skipped, range: { from: fromKey, to: until } };
}

/** مواعيد بديلة لحصة مؤجلة: أول حصص متاحة لنفس الصف/الشعبة */
export function alternativeSlots(ws, profile, classKey, fromKey, count = 5) {
  return occurrences(profile, classKey, fromKey, addDays(fromKey, 42)).filter((o) => !slotTaken(ws, profile.id, o.dateKey, o.slotKey)).slice(0, count);
}

/** تعارضات: توزيعات قائمة لم تعد حصتها موجودة/صحيحة في جدول المنبّه (لا نغيّر شيئًا تلقائيًا) */
export function conflicts(ws, profile, todayKey) {
  const out = [];
  for (const a of ws.assignments) {
    const st = assignmentStatus(ws, a, todayKey);
    if (!ACTIVE(st) || a.dateKey < todayKey) continue;
    if (!profile || a.profileId !== profile.id) { out.push({ a, reason: profile ? 'التوزيع مرتبط بجدول آخر غير الجدول النشط في المنبّه' : SLOT_REASON['no-schedule'] }); continue; }
    const s = slotInfo(profile, a.dateKey, a.slotKey);
    if (!s.ok) { out.push({ a, reason: SLOT_REASON[s.reason] }); continue; }
    const l = s.event.lesson || {};
    if (classKeyOf(l.grade, l.section) !== a.classKey) out.push({ a, reason: `الحصة أصبحت لصف آخر (${classLabelOf(l.grade, l.section)})` });
  }
  return out;
}

export const todayKeyOf = (tz = 'Asia/Muscat', now = Date.now()) => zonedParts(now, tz).dateKey;
export const dayNameOf = (k) => ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'][weekdayOf(k)];
