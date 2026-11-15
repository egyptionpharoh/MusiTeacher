// 🔗 ما يقرؤه «منبّه الحصص» من الخطط (قراءة فقط): الدرس المتوقع لكل حصة، ونص تذكير المساء.
// المصدران: (1) الربط اليدوي الذي اعتمده المعلم (له الأولوية) (2) الربط التلقائي المحسوب لحظيًا من خطة الصف (core/auto.js).
// إذا لم توجد خطط يعيد قيمًا فارغة، فيعمل المنبّه كما هو تمامًا.
import { findLesson, STATUS_LABEL, classKeyOf, classLabelOf, gradeNum, GRADE_NAMES } from './model.js';
import { autoLinkEvent, planWindows, plansOfGrade } from './auto.js';
import { assignmentStatus, lessonState, slotInfo, classesFromProfile } from './track.js';
import { schoolWeekOf } from './weekly.js';
import { resolveDay } from '../../class-alarm/core/schedule.js';
import { addDays, weekdayOf } from '../../class-alarm/core/time.js';

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
    const wk = schoolWeekOf(ws, dateKey, f ? f.plan.grade : a.grade);
    map.set(a.slotKey, { source: 'manual', assignmentId: a.id, planId: a.planId, lessonId: a.lessonId, lessonTitle: title, lessons: [{ planId: a.planId, lessonId: a.lessonId, title }], unitTitle: f ? f.unit.title : a.snapshot.unitTitle, part: a.part, kind: a.kind, sessions, remaining, status, statusLabel: STATUS_LABEL[status], alertPlan: a.alertPlan || null, orphan: !f, week: wk ? wk.week : 0, weekText: wk ? wk.text : '', semester: wk ? wk.semester : '' });
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
        lessons: r.state === 'sure' ? r.lessons || [] : [],
        part: r.part || null, sessions: r.state === 'sure' ? r.sessions || null : null, inWindow: r.inWindow || null, candidates: r.candidates || [],
        extra: !!r.extra, combined: !!r.combined, compressed: !!r.compressed, short: !!r.short, note: r.note || '', staleOverride: !!r.staleOverride,
        week: r.week || 0, weekText: r.weekText || '', semester: r.semester || '',
        classKey: classKeyOf((e.lesson || {}).grade, (e.lesson || {}).section), status: 'auto', statusLabel: r.state === 'review' ? 'يحتاج مراجعة' : '', alertPlan: null, remaining: null,
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
    for (const e of linked.slice(0, 6)) { const k = links.get(e.key); lines.push(`• ${e.start} ${e.cls ? `${e.cls}: ` : ''}${k.lessonTitle}${partText(k) ? ` (${partText(k)})` : ''}`); }
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

/** وصف موقع الحصة من الدرس: «الحصة 2 من 3» / «استكمال» / «الحصة 2» */
export function partText(k) {
  if (!k || !k.lessonTitle) return '';
  if (k.extra) return 'استكمال وتثبيت';
  if (k.combined) return 'درسان في حصة واحدة';
  if (!k.part) return '';
  return k.sessions ? `الحصة ${k.part} من ${k.sessions}` : `الحصة ${k.part}`;
}

/**
 * 🗓️ خطة الأسبوع لصفوف المعلم (للعرض في المنبّه): أسبوع الأحد–الخميس الذي يقع فيه التاريخ،
 * حصص كل صف/شعبة ودرس كل حصة، ودروس الخطة المقررة هذا الأسبوع التي لم تجد حصة (إجازة/إلغاء/جدول) حتى لا تُتجاوز بصمت.
 */
export function weekPlan(ws, profile, dateKey, todayKey) {
  if (!ws || !profile) return null;
  const from = addDays(dateKey, -weekdayOf(dateKey)), to = addDays(from, 6);
  const wk = schoolWeekOf(ws, dateKey) || schoolWeekOf(ws, addDays(from, 1));
  const grades = ws.settings ? ws.settings.grades : [];
  const classes = classesFromProfile(profile).filter((c) => !grades.length || grades.includes(gradeNum(c.grade)));
  const byClass = new Map(classes.map((c) => [c.classKey, { ...c, items: [], missing: [], hasPlan: plansOfGrade(ws, gradeNum(c.grade)).length > 0 }]));
  const linkCache = new Map();
  const linksOn = (k) => { if (!linkCache.has(k)) linkCache.set(k, linksForDay(ws, profile, k, todayKey)); return linkCache.get(k); };
  for (let k = from; k <= to; k = addDays(k, 1)) {
    const day = resolveDay(profile, k);
    const links = linksOn(k);
    for (const e of day.events) {
      if (e.cancelled || !(e.type === 'lesson' || (e.type === 'extra' && e.kind === 'lesson'))) continue;
      const l = e.lesson || {};
      const ck = classKeyOf(l.grade, l.section);
      if (!byClass.has(ck)) { if (grades.length && !grades.includes(gradeNum(l.grade))) continue; byClass.set(ck, { classKey: ck, grade: l.grade, section: l.section, label: classLabelOf(l.grade, l.section), weekly: [], items: [], missing: [], hasPlan: plansOfGrade(ws, gradeNum(l.grade)).length > 0 }); }
      byClass.get(ck).items.push({ dateKey: k, dayName: day.dayName, e, link: links.get(e.key) || null });
    }
  }
  // دروس فترتها تتقاطع مع هذا الأسبوع ولم تأخذ أي حصة لهذه الشعبة طوال فترتها
  if (ws.settings && ws.settings.autoLink !== false) {
    for (const c of byClass.values()) {
      for (const p of plansOfGrade(ws, gradeNum(c.grade))) {
        for (const w of planWindows(p)) {
          if (!w.start || w.end < from || w.start > to) continue;
          let found = false, slots = 0;
          for (let k = w.start; k <= w.end && !found; k = addDays(k, 1)) {
            const day = resolveDay(profile, k);
            for (const e of day.events) {
              const l = e.lesson || {};
              if (e.cancelled || !l || classKeyOf(l.grade, l.section) !== c.classKey || !(e.type === 'lesson' || (e.type === 'extra' && e.kind === 'lesson'))) continue;
              slots++;
              const x = linksOn(k).get(e.key);
              if (x && (x.lessonId === w.lesson.id || (x.lessons || []).some((y) => y.lessonId === w.lesson.id && y.planId === p.id))) { found = true; break; }
            }
          }
          if (!found) c.missing.push({ planId: p.id, lessonId: w.lesson.id, title: w.lesson.title, start: w.start, end: w.end, reason: slots ? 'لم يُخصَّص له حصة (صحّح إحدى الحصص لتضمينه)' : 'لا توجد حصة لهذه الشعبة في فترة الدرس (إجازة أو إلغاء أو الجدول)' });
        }
      }
    }
  }
  return { from, to, week: wk ? wk.week : 0, weekText: wk ? wk.text : '', semester: wk ? wk.semester : '', classes: [...byClass.values()].filter((c) => c.items.length || c.missing.length).sort((a, b) => a.label.localeCompare(b.label, 'ar')) };
}

/** رابط «فتح الدرس في الخطة» (تبويب «موعد الدرس» على هذا الدرس) — '' إن لم يُعرف الدرس */
export function lessonHref(ws, link, base) {
  if (!ws || !link || !link.planId || !link.lessonId || !base) return '';
  const p = ws.plans.find((x) => x.id === link.planId);
  const g = p ? gradeNum(p.grade) : 0;
  if (!p || !g || !p.semester) return '';
  const q = new URLSearchParams({ tab: 'time', semester: p.semester, grade: GRADE_NAMES[g - 1], lesson: `m:${link.lessonId}` });
  return `${base}${base.includes('?') ? '&' : '?'}${q.toString()}`;
}

export { slotInfo };
