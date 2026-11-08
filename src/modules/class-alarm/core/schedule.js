// 📅 حساب يوم المعلم: الجدول الأسبوعي + تعديلات اليوم + الإجازات → أحداث بمواعيد مطلقة، ثم التنبيهات المستحقة.
import { zonedParts, zonedToMs, parseHHMM, weekdayOf, addDays, MIN, DAY_NAMES } from './time.js';
import { lessonTitle, classLabel } from './model.js';

export function holidayOn(profile, dateKey) {
  return (profile.holidays || []).find((h) => h.from <= dateKey && dateKey <= h.to) || null;
}

/** أحداث يوم معيّن مرتبة بالوقت */
export function resolveDay(profile, dateKey) {
  const wd = weekdayOf(dateKey);
  const ov = (profile.overrides || {})[dateKey] || null;
  const holiday = holidayOn(profile, dateKey);
  const isWorkday = profile.days.includes(wd) && !holiday;
  const tz = profile.tz;
  const events = [];
  const at = (hhmm) => zonedToMs(dateKey, hhmm, tz);

  if (isWorkday) {
    const row = (profile.lessons || {})[wd] || {};
    const dayT = (profile.dayTimes || {})[wd] || {};
    for (const p of profile.periods) {
      if (!p.start || !p.end) continue;
      const base = dayT[p.id] || { start: p.start, end: p.end };
      const ch = ov && ov.changed[p.id];
      const t = ch || base;
      const lesson = p.kind === 'lesson' ? row[p.id] || null : null;
      const type = p.kind === 'break' ? 'break' : lesson ? 'lesson' : 'free';
      events.push({
        key: p.id, type, kind: type === 'lesson' ? 'lesson' : type, periodId: p.id, no: p.no, label: p.label,
        title: type === 'break' ? p.name || 'استراحة' : type === 'free' ? 'حصة فراغ' : lessonTitle(lesson, profile),
        lesson, cls: classLabel(lesson), room: lesson ? lesson.room : '',
        start: t.start, end: t.end, startMs: at(t.start), endMs: at(t.end),
        baseStart: base.start, baseEnd: base.end,
        cancelled: !!(ov && ov.cancelled[p.id]), changedToday: !!ch,
        note: [lesson && lesson.note, ov && ov.notes[p.id]].filter(Boolean).join(' • '),
        todayNote: (ov && ov.notes[p.id]) || '',
        muted: !!(lesson && lesson.muted),
        plan: (lesson && lesson.plan) || profile.plan,
      });
    }
  }
  for (const x of (ov && ov.extra) || []) {
    const kindLabel = x.kind === 'meeting' ? 'اجتماع' : x.kind === 'activity' ? 'نشاط مدرسي' : 'حصة استثنائية';
    const pseudo = { subject: x.title, grade: x.grade, section: x.section, room: x.room };
    events.push({
      key: x.id, type: 'extra', kind: x.kind, periodId: null, no: 0, label: kindLabel,
      title: x.title || (x.kind === 'lesson' ? lessonTitle(null, profile) : kindLabel),
      lesson: x.kind === 'lesson' ? pseudo : null, cls: classLabel(pseudo), room: x.room,
      start: x.start, end: x.end, startMs: at(x.start), endMs: at(x.end), baseStart: x.start, baseEnd: x.end,
      cancelled: false, changedToday: false, note: x.note, todayNote: '', muted: false, extra: x,
      plan: x.plan || profile.plan,
    });
  }
  events.sort((a, b) => a.startMs - b.startMs || (a.type === 'break') - (b.type === 'break'));
  return { dateKey, weekday: wd, dayName: DAY_NAMES[wd], isWorkday, holiday, muted: !!(ov && ov.muted), note: (ov && ov.note) || '', override: ov, events };
}

const teaching = (e) => (e.type === 'lesson' || e.type === 'extra') && !e.cancelled;

/** نص الإشعار حسب بيانات الحصة الفعلية */
export function alertText(profile, e, type, min) {
  const isMeeting = e.kind === 'meeting' || e.kind === 'activity';
  const head = type === 'end'
    ? (min ? `اقترب ختام ${isMeeting ? e.label : 'الحصة'}` : `انتهت ${isMeeting ? e.label : 'الحصة'}`)
    : type === 'start' ? (isMeeting ? `بدأ ${e.label} الآن` : 'بدأت الحصة الآن') : (isMeeting ? `تذكير: ${e.label} قريبًا` : 'حان وقت الاستعداد للحصة القادمة');
  const what = [e.title, e.cls].filter(Boolean).join(' – ');
  const when = type === 'end'
    ? `تنتهي ${min === 1 ? 'بعد دقيقة' : min === 2 ? 'بعد دقيقتين' : `بعد ${min} ${min <= 10 ? 'دقائق' : 'دقيقة'}`}.`
    : type === 'start' ? 'موعد البداية الآن.' : `تبدأ ${min === 1 ? 'بعد دقيقة' : min === 2 ? 'بعد دقيقتين' : `بعد ${min} ${min <= 10 ? 'دقائق' : 'دقيقة'}`}.`;
  const lines = [what, when];
  if (e.no && e.type === 'lesson') lines.push(`الحصة ${e.label}${e.room ? ` • ${e.room}` : ''}`);
  else if (e.room) lines.push(e.room);
  if (profile.school) lines.push(`مدرسة: ${profile.school.replace(/^مدرسة\s+/, '')}`);
  if (e.note && type !== 'end') lines.push(`📝 ${e.note}`);
  return { title: head, body: lines.filter(Boolean).join('\n'), what, when };
}

function inQuiet(settings, profile, ms) {
  if (!settings.quiet || !settings.quiet.on) return false;
  const m = zonedParts(ms, profile.tz).minutes;
  const a = parseHHMM(settings.quiet.from), b = parseHHMM(settings.quiet.to);
  if (a == null || b == null) return false;
  const inside = a <= b ? m >= a && m <= b : m >= a || m <= b;
  return !inside;
}

/** كل تنبيهات يوم معيّن (بعد تطبيق الكتم والإيقاف المؤقت وفترة السماح) */
export function alertsForDay(profile, settings, dateKey, day = resolveDay(profile, dateKey)) {
  if (!settings.enabled || day.muted) return [];
  const out = [];
  for (const e of day.events) {
    if (!teaching(e) || e.muted) continue;
    const plan = e.plan || profile.plan;
    const push = (type, min, due, tone) => {
      if (!Number.isFinite(due)) return;
      if (settings.pausedUntil && due < settings.pausedUntil) return;
      if (inQuiet(settings, profile, due)) return;
      const id = `${profile.id}|${dateKey}|${e.key}|${type}${min || 0}|${e.start}`;
      out.push({ id, due, type, min, tone, eventKey: e.key, dateKey, profileId: profile.id, startMs: e.startMs, endMs: e.endMs, ...alertText(profile, e, type, min) });
    };
    for (const b of plan.before || []) push('before', b.min, e.startMs - b.min * MIN, b.tone);
    if (plan.start && plan.start.on) push('start', 0, e.startMs, plan.start.tone);
    if (plan.end && plan.end.on) push('end', plan.end.min, e.endMs - plan.end.min * MIN, plan.end.tone);
  }
  return out.sort((a, b) => a.due - b.due);
}

/** حالة اللحظة الحالية للوحة اليوم */
export function dayStatus(profile, now) {
  const today = zonedParts(now, profile.tz).dateKey;
  const day = resolveDay(profile, today);
  const evs = day.events.filter((e) => !e.cancelled && e.type !== 'free');
  const lessons = evs.filter(teaching);
  const current = evs.find((e) => e.startMs <= now && now < e.endMs && e.type !== 'break') || null;
  const currentBreak = evs.find((e) => e.startMs <= now && now < e.endMs && e.type === 'break') || null;
  const next = lessons.find((e) => e.startMs > now) || null;
  const done = lessons.filter((e) => e.endMs <= now);
  const remaining = lessons.filter((e) => e.endMs > now);
  let phase;
  if (!lessons.length) phase = day.isWorkday ? 'empty' : 'off';
  else if (now < lessons[0].startMs) phase = 'before';
  else if (current) phase = 'lesson';
  else if (currentBreak) phase = 'break';
  else if (next) phase = 'gap';
  else phase = 'after';
  let upcoming = next ? { dateKey: today, event: next } : null;
  if (!upcoming) {
    for (let i = 1; i <= 21; i++) {
      const dk = addDays(today, i);
      const d = resolveDay(profile, dk);
      const n = d.events.find(teaching);
      if (n) { upcoming = { dateKey: dk, event: n, dayName: d.dayName, days: i }; break; }
    }
  }
  return { today, day, phase, current, currentBreak, next, upcoming, done, remaining, lessons, first: lessons[0] || null, last: lessons[lessons.length - 1] || null };
}

/** إحصاء أسبوعي من الجدول الأساسي */
export function weekStats(profile) {
  let lessons = 0, minutes = 0;
  const perDay = {}, perClass = {};
  for (const d of profile.days) {
    const row = profile.lessons[d] || {};
    const dayT = (profile.dayTimes || {})[d] || {};
    let c = 0;
    for (const p of profile.periods) {
      if (p.kind !== 'lesson' || !row[p.id]) continue;
      const t = dayT[p.id] || p;
      const len = (parseHHMM(t.end) ?? 0) - (parseHHMM(t.start) ?? 0);
      c++; lessons++; minutes += Math.max(0, len);
      const k = classLabel(row[p.id]) || row[p.id].subject || 'بدون صف';
      perClass[k] = (perClass[k] || 0) + 1;
    }
    perDay[d] = c;
  }
  const busiest = Object.entries(perDay).sort((a, b) => b[1] - a[1])[0];
  return { lessons, minutes, perDay, perClass, busiestDay: busiest && busiest[1] ? +busiest[0] : null, workdays: profile.days.length };
}

/** يومَا التنبيهات اللذان يراقبهما المحرك: اليوم وغدًا (لحصص بعد منتصف الليل أو تنبيهات قبله) */
export function upcomingAlerts(profile, settings, now) {
  const today = zonedParts(now, profile.tz).dateKey;
  return [...alertsForDay(profile, settings, addDays(today, -1)), ...alertsForDay(profile, settings, today), ...alertsForDay(profile, settings, addDays(today, 1))];
}
