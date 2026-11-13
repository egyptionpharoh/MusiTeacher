// ⏰ أدوات الوقت والمنطقة الزمنية — دوال نقية بلا React ولا متصفح (تُختبر في Node).
// كل المواعيد تُحسب من «ساعة الحائط» في منطقة المدرسة (الافتراضي Asia/Muscat) ثم تُحوَّل إلى لحظة زمنية مطلقة (ms).

export const DEFAULT_TZ = 'Asia/Muscat';
export const MIN = 60 * 1000;
export const DAY_MS = 24 * 60 * MIN;

export const DAY_NAMES = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
export const DAY_SHORT = ['أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];
export const MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

export const TIMEZONES = [
  { id: 'Asia/Muscat', label: 'سلطنة عُمان (مسقط)' },
  { id: 'Asia/Dubai', label: 'الإمارات (دبي)' },
  { id: 'Asia/Riyadh', label: 'السعودية (الرياض)' },
  { id: 'Asia/Kuwait', label: 'الكويت' },
  { id: 'Asia/Qatar', label: 'قطر' },
  { id: 'Asia/Bahrain', label: 'البحرين' },
  { id: 'Africa/Cairo', label: 'مصر (القاهرة)' },
  { id: 'Asia/Amman', label: 'الأردن (عمّان)' },
];

const dtfCache = new Map();
function dtf(tz) {
  let f = dtfCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23', weekday: 'short' });
    dtfCache.set(tz, f);
  }
  return f;
}
const WD = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export function isValidTz(tz) {
  if (!tz || typeof tz !== 'string') return false;
  try { dtf(tz).format(0); return true; } catch { return false; }
}
export const safeTz = (tz) => (isValidTz(tz) ? tz : DEFAULT_TZ);

/** أجزاء الوقت في المنطقة: { y, m, d, hh, mm, ss, wd, dateKey, minutes } */
export function zonedParts(ms, tz = DEFAULT_TZ) {
  const o = {};
  for (const p of dtf(safeTz(tz)).formatToParts(new Date(ms))) o[p.type] = p.value;
  const y = +o.year, m = +o.month, d = +o.day, hh = +o.hour % 24, mm = +o.minute, ss = +o.second;
  return { y, m, d, hh, mm, ss, wd: WD[o.weekday], dateKey: `${y}-${pad(m)}-${pad(d)}`, minutes: hh * 60 + mm };
}

export const pad = (n) => String(n).padStart(2, '0');

/** فرق المنطقة عن UTC (بالدقائق) في لحظة معينة */
function offsetMin(ms, tz) {
  const p = zonedParts(ms, tz);
  const asUtc = Date.UTC(p.y, p.m - 1, p.d, p.hh, p.mm, p.ss);
  return Math.round((asUtc - Math.floor(ms / 1000) * 1000) / MIN);
}

/** تاريخ (YYYY-MM-DD) + وقت (HH:MM) في منطقة المدرسة → لحظة مطلقة ms. يتعامل مع التوقيت الصيفي إن وُجد. */
export function zonedToMs(dateKey, hhmm, tz = DEFAULT_TZ) {
  const [y, m, d] = dateKey.split('-').map(Number);
  const mins = parseHHMM(hhmm);
  if (mins == null || !y) return NaN;
  const guess = Date.UTC(y, m - 1, d, Math.floor(mins / 60), mins % 60);
  const z = safeTz(tz);
  let t = guess - offsetMin(guess, z) * MIN;
  const o2 = offsetMin(t, z);
  t = guess - o2 * MIN;
  return t;
}

/** "7:30" | "07:30" | "٧:٣٠" | "7.30" | "7:30 م" → دقائق منذ منتصف الليل (أو null) */
export function parseHHMM(s) {
  if (s == null) return null;
  let t = toLatinDigits(String(s)).trim().toLowerCase();
  if (!t) return null;
  let pm = null;
  if (/(م|مساء|pm|p\.m)/.test(t)) pm = true;
  else if (/(ص|صباح|am|a\.m)/.test(t)) pm = false;
  const m = t.match(/(\d{1,2})\s*[:.٫،,]\s*(\d{2})/) || t.match(/^(\d{1,2})$/);
  if (!m) return null;
  let h = +m[1]; const mi = m[2] != null ? +m[2] : 0;
  if (h > 23 || mi > 59) return null;
  if (pm === true && h < 12) h += 12;
  if (pm === false && h === 12) h = 0;
  return h * 60 + mi;
}
export const toHHMM = (mins) => (mins == null || Number.isNaN(mins) ? '' : `${pad(Math.floor(mins / 60) % 24)}:${pad(mins % 60)}`);
export const normHHMM = (s) => toHHMM(parseHHMM(s));

export function toLatinDigits(s) {
  return String(s).replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x660)).replace(/[۰-۹]/g, (c) => String(c.charCodeAt(0) - 0x6f0));
}

/** عرض الوقت بنظام 12 ساعة بالعربية: 7:30 ص */
export function fmtTime(hhmmOrMins, h24 = false) {
  const mins = typeof hhmmOrMins === 'number' ? hhmmOrMins : parseHHMM(hhmmOrMins);
  if (mins == null) return '—';
  const h = Math.floor(mins / 60) % 24, m = mins % 60;
  if (h24) return `${pad(h)}:${pad(m)}`;
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${pad(m)} ${h < 12 ? 'ص' : 'م'}`;
}

export function addDays(dateKey, n) {
  const [y, m, d] = dateKey.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}
export function weekdayOf(dateKey) {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}
export const isDateKey = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
export function fmtDate(dateKey) {
  const [y, m, d] = dateKey.split('-').map(Number);
  return `${DAY_NAMES[weekdayOf(dateKey)]} ${d} ${MONTHS[m - 1]} ${y}`;
}

/** مدة بالكلمات: «10 دقائق»، «ساعة و5 دقائق» */
export function durationWords(ms) {
  const total = Math.max(0, Math.round(ms / MIN));
  const h = Math.floor(total / 60), m = total % 60;
  const mw = (n) => (n === 1 ? 'دقيقة' : n === 2 ? 'دقيقتان' : n <= 10 ? `${n} دقائق` : `${n} دقيقة`);
  const hw = (n) => (n === 1 ? 'ساعة' : n === 2 ? 'ساعتان' : n <= 10 ? `${n} ساعات` : `${n} ساعة`);
  if (!h) return total === 0 ? 'أقل من دقيقة' : mw(m);
  return m ? `${hw(h)} و${mw(m)}` : hw(h);
}
/** «بعد 10 دقائق» بصيغة سليمة لـ 1 و2 */
export function afterWords(min) {
  if (min <= 0) return 'الآن';
  if (min === 1) return 'بعد دقيقة';
  if (min === 2) return 'بعد دقيقتين';
  return `بعد ${durationWords(min * MIN)}`;
}
/** عدّاد hh:mm:ss */
export function clock(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
  return h ? `${h}:${pad(m)}:${pad(ss)}` : `${pad(m)}:${pad(ss)}`;
}
