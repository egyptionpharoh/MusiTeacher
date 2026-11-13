// 📆 تصدير الجدول إلى ملف تقويم (.ics) بتنبيهات مدمجة (VALARM).
// هذا هو الحل الموثوق للتنبيه والمتصفح مغلق: تقويم الهاتف/Outlook/Google يرن بنفسه دون الحاجة لفتح MusiTeacher.
import { zonedToMs, addDays, weekdayOf, pad, parseHHMM, zonedParts } from './time.js';
import { resolveDay } from './schedule.js';
import { lessonTitle, classLabel } from './model.js';

const BYDAY = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
const esc = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const local = (dateKey, hhmm) => `${dateKey.replace(/-/g, '')}T${hhmm.replace(':', '')}00`;
const utcStamp = (ms) => { const d = new Date(ms); return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`; };

/** طي الأسطر الطويلة (75 بايت) كما يشترط RFC 5545 دون كسر حرف عربي */
function fold(line) {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  const out = []; let cur = '', size = 0, limit = 75;
  for (const ch of line) {
    const n = enc.encode(ch).length;
    if (size + n > limit) { out.push(cur); cur = ''; size = 0; limit = 74; }
    cur += ch; size += n;
  }
  out.push(cur);
  return out.join('\r\n ');
}

function vtimezone(tz, refMs) {
  const p = zonedParts(refMs, tz);
  const off = Math.round((Date.UTC(p.y, p.m - 1, p.d, p.hh, p.mm) - Math.floor(refMs / 60000) * 60000) / 60000);
  const sign = off >= 0 ? '+' : '-', a = Math.abs(off);
  const o = `${sign}${pad(Math.floor(a / 60))}${pad(a % 60)}`;
  return ['BEGIN:VTIMEZONE', `TZID:${tz}`, 'BEGIN:STANDARD', 'DTSTART:19700101T000000', `TZOFFSETFROM:${o}`, `TZOFFSETTO:${o}`, 'END:STANDARD', 'END:VTIMEZONE'];
}

function alarms(plan, title) {
  const out = [];
  const a = (trigger, desc, related) => out.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(desc)}`, related ? `TRIGGER;RELATED=END:${trigger}` : `TRIGGER:${trigger}`, 'END:VALARM');
  for (const b of (plan && plan.before) || []) a(`-PT${b.min}M`, `${title} بعد ${b.min} دقيقة`);
  if (plan && plan.start && plan.start.on) a('PT0M', `بدأت: ${title}`);
  if (plan && plan.end && plan.end.on) a(`-PT${plan.end.min}M`, `اقترب ختام: ${title}`, true);
  return out;
}

/**
 * profile: الجدول، from: تاريخ البداية (YYYY-MM-DD)، weeks: عدد الأسابيع
 * يعيد نص ملف .ics
 */
export function buildICS(profile, { from, weeks = 18, now = Date.now(), withAlarms = true } = {}) {
  const tz = profile.tz;
  const until = addDays(from, weeks * 7);
  const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//MusiTeacher//Class Alarm//AR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', `X-WR-CALNAME:${esc(profile.name || 'جدول الحصص')}`, `X-WR-TIMEZONE:${tz}`, ...vtimezone(tz, now)];
  const stamp = utcStamp(now);
  const untilUtc = utcStamp(zonedToMs(until, '23:59', tz));
  let count = 0;

  // استثناءات: أيام الإجازة + حصص ملغاة أو معدّلة في يوم بعينه (تُستبعد من التكرار)
  const exceptions = (d, pid) => {
    const out = [];
    for (let k = from; k <= until; k = addDays(k, 1)) {
      if (weekdayOf(k) !== d) continue;
      const day = resolveDay(profile, k);
      const ov = day.override;
      if (day.holiday || (ov && (ov.cancelled[pid] || ov.changed[pid]))) out.push(k);
    }
    return out;
  };

  for (const d of profile.days) {
    const row = profile.lessons[d] || {};
    const dayT = (profile.dayTimes || {})[d] || {};
    let first = from; while (weekdayOf(first) !== d) first = addDays(first, 1);
    if (first > until) continue;
    for (const p of profile.periods) {
      const l = row[p.id];
      if (p.kind !== 'lesson' || !l) continue;
      const t = dayT[p.id] || p;
      if (!t.start || !t.end) continue;
      const title = [lessonTitle(l, profile), classLabel(l)].filter(Boolean).join(' – ');
      const ex = exceptions(d, p.id);
      L.push('BEGIN:VEVENT', `UID:${profile.id}-${d}-${p.id}@musiteacher`, `DTSTAMP:${stamp}`,
        `DTSTART;TZID=${tz}:${local(first, t.start)}`, `DTEND;TZID=${tz}:${local(first, t.end)}`,
        `RRULE:FREQ=WEEKLY;BYDAY=${BYDAY[d]};UNTIL=${untilUtc}`,
        ...(ex.length ? [`EXDATE;TZID=${tz}:${ex.map((k) => local(k, t.start)).join(',')}`] : []),
        `SUMMARY:${esc(title)}`, `DESCRIPTION:${esc([`الحصة ${p.label}`, profile.school, l.note].filter(Boolean).join('\n'))}`,
        ...(l.room ? [`LOCATION:${esc(l.room)}`] : []),
        ...(withAlarms && !l.muted ? alarms(l.plan || profile.plan, title) : []), 'END:VEVENT');
      count++;
    }
  }
  // أحداث «لهذا اليوم فقط»: الحصص المعدلة وقتها + الاستثنائية + الاجتماعات
  for (const [k, ov] of Object.entries(profile.overrides || {})) {
    if (k < from || k > until) continue;
    const day = resolveDay(profile, k);
    for (const e of day.events) {
      if (e.cancelled || !(e.type === 'extra' || (e.type === 'lesson' && e.changedToday))) continue;
      const title = [e.title, e.cls].filter(Boolean).join(' – ');
      L.push('BEGIN:VEVENT', `UID:${profile.id}-${k}-${e.key}@musiteacher`, `DTSTAMP:${stamp}`,
        `DTSTART;TZID=${tz}:${local(k, e.start)}`, `DTEND;TZID=${tz}:${local(k, e.end)}`,
        `SUMMARY:${esc(title)}`, ...(e.note ? [`DESCRIPTION:${esc(e.note)}`] : []), ...(e.room ? [`LOCATION:${esc(e.room)}`] : []),
        ...(withAlarms && !day.muted ? alarms(e.plan, title) : []), 'END:VEVENT');
      count++;
    }
  }
  L.push('END:VCALENDAR');
  return { text: L.map(fold).join('\r\n') + '\r\n', count, until };
}

export const minutesOf = (hhmm) => parseHHMM(hhmm);
