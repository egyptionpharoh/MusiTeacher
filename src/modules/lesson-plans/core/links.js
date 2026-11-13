// 🔗 ما يقرؤه «منبّه الحصص» من الخطط (قراءة فقط): الدرس المتوقع لكل حصة، ونص تذكير المساء.
// المصدران: (1) الربط اليدوي الذي اعتمده المعلم (له الأولوية) (2) الربط التلقائي المحسوب لحظيًا من خطة الصف (core/auto.js).
// إذا لم توجد خطط يعيد قيمًا فارغة، فيعمل المنبّه كما هو تمامًا.
import { findLesson, STATUS_LABEL } from './model.js';
import { autoLinkEvent } from './auto.js';
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
    map.set(a.slotKey, { source: 'manual', assignmentId: a.id, planId: a.planId, lessonId: a.lessonId, lessonTitle: title, unitTitle: f ? f.unit.title : a.snapshot.unitTitle, part: a.part, kind: a.kind, sessions, remaining, status, statusLabel: STATUS_LABEL[status], alertPlan: a.alertPlan || null, orphan: !f });
  }
  // الربط التلقائي لبقية الحصص (إن لم يوقفه المعلم من ⚙️)
  if (ws.settings && ws.settings.autoLink !== false && ws.plans.length) {
    const day = resolveDay(profile, dateKey);
    const memo = new Map();
    // حصة لها ربط يدوي بأي حالة (حتى المؤجلة/الملغاة) قرار من المعلم: لا يملؤها الربط التلقائي
    const manual = new Set(ws.assignments.filter((a) => a.profileId === profile.id && a.dateKey === dateKey).map((a) => a.slotKey));
    for (const e of day.events) {
      if (map.has(e.key) || manual.has(e.key) || e.cancelled || !(e.type === 'lesson' || (e.type === 'extra' && e.kind === 'lesson'))) continue;
      const r = autoLinkEvent(ws, profile, dateKey, e, memo);
      if (!['sure', 'review', 'none'].includes(r.state)) continue;
      map.set(e.key, {
        source: 'auto', state: r.state, review: r.state === 'review', overridden: !!r.overridden, reason: r.reason || '',
        planId: r.planId || '', lessonId: r.lessonId || '', lessonTitle: r.state === 'sure' ? r.lessonTitle : '', unitTitle: r.unitTitle || '',
        part: r.part || null, sessions: r.state === 'sure' ? r.sessions || null : null, inWindow: r.inWindow || null, candidates: r.candidates || [],
        classKey: '', status: 'auto', statusLabel: r.state === 'review' ? 'يحتاج مراجعة' : '', alertPlan: null, remaining: null,
      });
    }
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
    const linked = teaching.filter((e) => links.has(e.key) && links.get(e.key).lessonTitle);
    for (const e of linked.slice(0, 6)) { const k = links.get(e.key); lines.push(`• ${e.start} ${e.cls ? `${e.cls}: ` : ''}${k.lessonTitle}${k.sessions ? ` (الحصة ${k.part} من ${k.sessions})` : ''}`); }
  }
  if (opts.unlinked) {
    const n = teaching.filter((e) => !links.has(e.key) || (!links.get(e.key).lessonTitle && !links.get(e.key).review)).length;
    const rv = teaching.filter((e) => links.has(e.key) && links.get(e.key).review).length;
    if (n) lines.push(`• ${n} حصة غدًا بلا درس مرتبط.`);
    if (rv) lines.push(`• ${rv} حصة غدًا تحتاج مراجعة الدرس المتوقع.`);
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
