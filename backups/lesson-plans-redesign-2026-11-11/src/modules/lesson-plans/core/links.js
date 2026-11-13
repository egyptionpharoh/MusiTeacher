// 🔗 ما يقرؤه «منبّه الحصص» من الخطط (قراءة فقط): الدرس المعتمد لكل حصة، ونص تذكير المساء.
// إذا لم توجد خطط أو روابط يعيد قيمًا فارغة، فيعمل المنبّه كما هو تمامًا.
import { findLesson, STATUS_LABEL } from './model.js';
import { assignmentStatus, lessonState, slotInfo } from './track.js';
import { resolveDay } from '../../class-alarm/core/schedule.js';

const SHOWN = new Set(['scheduled', 'awaiting', 'done', 'partial', 'needs-completion']);

/** خريطة: معرّف الحصة في ذلك اليوم → بيانات الدرس المرتبط (فقط الروابط المعتمدة وغير المؤجلة/الملغاة) */
export function linksForDay(ws, profile, dateKey, todayKey) {
  const map = new Map();
  if (!ws || !profile) return map;
  for (const a of ws.assignments) {
    if (a.profileId !== profile.id || a.dateKey !== dateKey) continue;
    const status = assignmentStatus(ws, a, todayKey);
    if (!SHOWN.has(status)) continue;
    const f = findLesson(ws, a.planId, a.lessonId);
    const title = f ? f.lesson.title : a.snapshot.lessonTitle;
    const sessions = f ? f.lesson.sessions : a.snapshot.sessions;
    let remaining = null;
    if (f && sessions) { const st = lessonState(ws, a.planId, f.lesson, a.classKey, todayKey); remaining = Math.max(0, sessions - st.doneParts); }
    map.set(a.slotKey, { assignmentId: a.id, planId: a.planId, lessonId: a.lessonId, lessonTitle: title, unitTitle: f ? f.unit.title : a.snapshot.unitTitle, part: a.part, kind: a.kind, sessions, remaining, status, statusLabel: STATUS_LABEL[status], alertPlan: a.alertPlan || null, orphan: !f });
  }
  return map;
}

/** نص «تذكير المساء» لليوم التالي (أو null إن لم يكن هناك ما يُذكَّر به) */
export function eveningDigest(ws, profile, tomorrowKey, todayKey, opts = { tomorrow: true, postponed: true, incomplete: true, unlinked: false }) {
  if (!ws || !profile) return null;
  const lines = [];
  const day = resolveDay(profile, tomorrowKey);
  const links = linksForDay(ws, profile, tomorrowKey, todayKey);
  const teaching = day.events.filter((e) => !e.cancelled && (e.type === 'lesson' || (e.type === 'extra' && e.kind === 'lesson')));
  if (opts.tomorrow) {
    const linked = teaching.filter((e) => links.has(e.key));
    for (const e of linked.slice(0, 6)) { const k = links.get(e.key); lines.push(`• ${e.start} ${e.cls ? `${e.cls}: ` : ''}${k.lessonTitle}${k.sessions ? ` (الحصة ${k.part} من ${k.sessions})` : ''}`); }
  }
  if (opts.unlinked) {
    const n = teaching.filter((e) => !links.has(e.key)).length;
    if (n) lines.push(`• ${n} حصة غدًا بلا درس مرتبط.`);
  }
  if (opts.postponed || opts.incomplete) {
    let post = 0, inc = 0;
    const seen = new Set();
    for (const a of ws.assignments) {
      const key = `${a.planId}|${a.lessonId}|${a.classKey}`;
      if (seen.has(key) || a.profileId !== profile.id) continue;
      seen.add(key);
      const f = findLesson(ws, a.planId, a.lessonId);
      if (!f) continue;
      const st = lessonState(ws, a.planId, f.lesson, a.classKey, todayKey);
      post += st.postponed.length; inc += st.pendingCompletion;
    }
    if (opts.postponed && post) lines.push(`• ${post} حصة مؤجلة بلا موعد جديد.`);
    if (opts.incomplete && inc) lines.push(`• ${inc} درس يحتاج إلى استكمال.`);
  }
  if (!lines.length) return null;
  return { title: day.isWorkday ? `تذكير بدروس الغد (${day.dayName})` : 'تذكير من الخطة الفصلية', body: lines.join('\n') };
}

export { slotInfo };
