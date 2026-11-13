// 🗓️ التقويم المدرسي: تحويل «أسابيع الدرس» إلى فترات تواريخ واضحة ومرتبة، وتنسيقها بالعربية دون خلط اتجاه النص.
//
// لماذا هذا الملف؟ حقل «التواريخ المقررة» في الخطة المرجعية المدمجة (semester-plans.json) منسوخ من PDF
// واختلط فيه اتجاه الأرقام (RTL/LTR) فصار مثل «٢٩-٢٠٢٦/١٢/٣١١/». أما حقل «الأسابيع» فسليم («الخامس عشر، السادس عشر»).
// لذلك نحسب التواريخ من رقم الأسبوع + بداية الفصل (الأسبوع المدرسي من الأحد إلى الخميس)، ولا نعرض النص التالف.
import { weekNumbers, addDaysKey, parseRange } from './dates.js';

// بداية الأسبوع الأول ونهاية الفصل لكل عام دراسي معروف (تحقّقنا منها مقابل كل دروس الخطة المرجعية للعام 2026/2027)
// lastDay = آخر يوم دراسي في الأسبوع الأخير «المعتاد» للفصل؛ lastWeek = رقم ذلك الأسبوع.
// إن احتوت خطة صفٍّ ما أسابيع بعد lastWeek (مثل الصفوف 1–4 في الفصل الثاني حتى الأسبوع 19) نعدّها أسابيع كاملة.
export const SCHOOL_CALENDARS = {
  '2026/2027': {
    'الفصل الدراسي الأول': { week1: '2026-09-06', lastWeek: 17, lastDay: '2026-12-30' },
    'الفصل الدراسي الثاني': { week1: '2027-01-31', lastWeek: 18, lastDay: '2027-05-31' },
  },
};

export const AR_MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
export const AR_DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const ORDINALS = ['الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس', 'السابع', 'الثامن', 'التاسع', 'العاشر', 'الحادي عشر', 'الثاني عشر', 'الثالث عشر', 'الرابع عشر', 'الخامس عشر', 'السادس عشر', 'السابع عشر', 'الثامن عشر', 'التاسع عشر', 'العشرون'];
export const weekOrdinal = (n) => ORDINALS[n - 1] || String(n);

/** أرقام عربية-هندية (٠-٩) وفارسية (۰-۹) → أرقام لاتينية؛ وحذف علامات الاتجاه الخفية */
export const toLatinDigits = (s) => String(s == null ? '' : s)
  .replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x660))
  .replace(/[۰-۹]/g, (c) => String(c.charCodeAt(0) - 0x6f0))
  .replace(/[‎‏‪-‮⁦-⁩]/g, '');

const parts = (key) => key.split('-').map(Number);
const weekday = (key) => { const [y, m, d] = parts(key); return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); };

/** «2026-12-31» → «31 ديسمبر 2026» (أرقام لاتينية واضحة، والشهر بالعربية) */
export function formatDateAr(key, { day = false, year = true } = {}) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(key || ''))) return '';
  const [y, m, d] = parts(key);
  return `${day ? `${AR_DAYS[weekday(key)]} ` : ''}${d} ${AR_MONTHS[m - 1]}${year ? ` ${y}` : ''}`;
}

/** فترة: «الأحد 13 – الخميس 17 ديسمبر 2026» أو «الأحد 29 نوفمبر – الخميس 3 ديسمبر 2026» */
export function formatRangeAr(start, end, { days = true } = {}) {
  if (!start) return '';
  if (!end || end === start) return formatDateAr(start, { day: days });
  const [ys, ms] = parts(start), [ye, me] = parts(end);
  const sameMonth = ys === ye && ms === me, sameYear = ys === ye;
  const a = formatDateAr(start, { day: days, year: !sameYear });
  const b = formatDateAr(end, { day: days });
  if (sameMonth) return `${days ? `${AR_DAYS[weekday(start)]} ` : ''}${parts(start)[2]} – ${b}`;
  return `${a} – ${b}`;
}

export const calendarFor = (year, semester) => (SCHOOL_CALENDARS[year] && SCHOOL_CALENDARS[year][semester]) || null;

/**
 * فترة أسبوع دراسي: من الأحد إلى الخميس، مع قصّ الأسبوع الأخير المعتاد للفصل على آخر يوم دراسي.
 * maxWeek: أكبر أسبوع في خطة الصف (إن تجاوز lastWeek فالأسبوع lastWeek يصبح أسبوعًا كاملًا).
 */
export function weekRange(cal, n, maxWeek = 0) {
  if (!cal || !(n >= 1 && n <= 30)) return null;
  const start = addDaysKey(cal.week1, (n - 1) * 7);
  let end = addDaysKey(start, 4);
  if (n === cal.lastWeek && maxWeek <= cal.lastWeek && cal.lastDay < end && cal.lastDay >= start) end = cal.lastDay;
  if (n > cal.lastWeek && maxWeek < n) return null;
  return { week: n, start, end };
}

/**
 * توقيت درس من «الأسابيع» (+ فترة صريحة إن وُجدت): يعيد الأسابيع مرتبة ومع تاريخ كل أسبوع.
 * { state: 'ok'|'by-plan'|'unknown', weeks:[{week, label, start, end, text}], start, end, weeksText }
 */
export function lessonTiming({ weeks = '', start = '', end = '', year = '', semester = '', maxWeek = 0 } = {}) {
  const raw = String(weeks || '').trim();
  const cal = calendarFor(year, semester);
  const nums = [...new Set(weekNumbers(raw))].sort((a, b) => a - b);
  if (nums.length && cal) {
    const list = nums.map((n) => weekRange(cal, n, maxWeek || Math.max(...nums))).filter(Boolean)
      .map((w) => ({ ...w, label: `الأسبوع ${weekOrdinal(w.week)}`, text: formatRangeAr(w.start, w.end) }));
    if (list.length) return { state: 'ok', weeks: list, start: list[0].start, end: list[list.length - 1].end, weeksText: nums.map(weekOrdinal).join('، ') };
  }
  // خطة المعلم: قد تحتوي فترة صريحة (من/إلى) بدل أرقام الأسابيع
  if (start) {
    const e = end && end >= start ? end : start;
    return { state: 'ok', weeks: [{ week: 0, label: nums.length ? `الأسابيع ${nums.map(weekOrdinal).join('، ')}` : 'فترة الدرس', start, end: e, text: formatRangeAr(start, e) }], start, end: e, weeksText: nums.map(weekOrdinal).join('، ') };
  }
  if (/حسب\s*الخط/.test(raw)) return { state: 'by-plan', weeks: [], start: '', end: '', weeksText: '' };
  // آخر محاولة: فترة مكتوبة كنص صريح في الأسابيع نفسها (مثل «6-10/9/2026»)
  const r = raw ? parseRange(raw, year) : null;
  if (r) return { state: 'ok', weeks: [{ week: 0, label: 'فترة الدرس', start: r.start, end: r.end, text: formatRangeAr(r.start, r.end) }], start: r.start, end: r.end, weeksText: '' };
  return { state: 'unknown', weeks: [], start: '', end: '', weeksText: nums.map(weekOrdinal).join('، ') };
}

/** أكبر أسبوع مذكور في دروس صفٍّ ما (لمعرفة إن كان الفصل يمتد بعد أسبوعه الأخير المعتاد) */
export function maxWeekOf(lessonsWeeks) {
  let m = 0;
  for (const w of lessonsWeeks) for (const n of weekNumbers(w || '')) if (n > m) m = n;
  return m;
}
