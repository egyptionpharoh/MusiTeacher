// 📅 قراءة الفترات الزمنية المكتوبة في الخطط بصيغها المختلفة → { start, end } بصيغة YYYY-MM-DD
// أمثلة مدعومة: «6 – 10 / 9/2026»، «27/ 9 - 1/ 10 / 2026»، «29/11-3/12/2026»، «٢٠٢٥/٩/٤ – ٨/٣١»، «2026-09-06»، تاريخ Excel
// إذا لم نتأكد من القراءة نعيد null (ولا نخمّن)، فتظهر الفترة للمعلم كبيانات تحتاج مراجعة.

const toLatin = (s) => String(s == null ? '' : s).replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x660)).replace(/[۰-۹]/g, (c) => String(c.charCodeAt(0) - 0x6f0));
const pad = (n) => String(n).padStart(2, '0');
const valid = (y, m, d) => { if (!(y >= 2000 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31)) return false; const t = new Date(Date.UTC(y, m - 1, d)); return t.getUTCMonth() === m - 1; };
export const ymd = (y, m, d) => (valid(y, m, d) ? `${y}-${pad(m)}-${pad(d)}` : null);

/** سنة تقديرية لتاريخ بلا سنة: العام الدراسي «2026/2027» → شهور 8-12 للسنة الأولى، 1-7 للثانية */
export function yearFor(month, schoolYear) {
  const m = String(schoolYear || '').match(/(\d{4})\D+(\d{2,4})/);
  if (!m) return null;
  const a = +m[1], b = m[2].length === 2 ? Math.floor(a / 100) * 100 + +m[2] : +m[2];
  return month >= 8 ? a : b;
}

/** قيمة مفردة → تاريخ (يدعم YYYY-MM-DD، d/m/yyyy، yyyy/m/d، رقم Excel التسلسلي) */
export function parseDate(v, schoolYear) {
  if (v == null || v === '') return null;
  if (typeof v === 'number' && v > 20000 && v < 80000) { const t = new Date(Math.round((v - 25569) * 86400000)); return ymd(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate()); }
  // خلايا التاريخ من Excel (SheetJS) تصل أحيانًا قبل منتصف الليل بثوانٍ (مثل 23:59:48 من اليوم السابق) أو بفارق المنطقة الزمنية،
  // فنقرّب لأقرب يوم بدل أخذ الجزء التاريخي حرفيًا (كان ذلك يُرجع التاريخ يومًا كاملًا للخلف)
  if (v instanceof Date && !Number.isNaN(+v)) { const t = new Date(+v + 12 * 3600 * 1000); return ymd(t.getFullYear(), t.getMonth() + 1, t.getDate()); }
  const s = toLatin(v).trim();
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return ymd(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (m) return ymd(+m[3], +m[2], +m[1]);
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})$/);
  if (m) { const y = yearFor(+m[2], schoolYear); return y ? ymd(y, +m[2], +m[1]) : null; }
  return null;
}

/** نص فترة → { start, end } أو null */
export function parseRange(text, schoolYear) {
  const raw = toLatin(text).replace(/[‎‏‪-‮]/g, '').replace(/[–—−ـ]/g, '-').replace(/\s+/g, '').replace(/م$/, '');
  if (!raw) return null;
  const y4 = raw.match(/(?:^|\D)(20\d{2})(?:\D|$)/);
  const year = y4 ? +y4[1] : null;
  let m;
  // d1-d2/m/y
  if ((m = raw.match(/^(\d{1,2})-(\d{1,2})\/(\d{1,2})\/(\d{4})$/))) return range(ymd(+m[4], +m[3], +m[1]), ymd(+m[4], +m[3], +m[2]));
  // d1/m1-d2/m2/y
  if ((m = raw.match(/^(\d{1,2})\/(\d{1,2})-(\d{1,2})\/(\d{1,2})\/(\d{4})$/))) return range(ymd(+m[5] - (+m[2] > +m[4] ? 1 : 0), +m[2], +m[1]), ymd(+m[5], +m[4], +m[3]));
  // d1/m1/y1-d2/m2/y2
  if ((m = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})-(\d{1,2})\/(\d{1,2})\/(\d{4})$/))) return range(ymd(+m[3], +m[2], +m[1]), ymd(+m[6], +m[5], +m[4]));
  // y/m/d-m/d  (صيغة كتب الوزارة: «٢٠٢٥/٩/٤ – ٨/٣١» = من 31/8 إلى 4/9/2025)
  if ((m = raw.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})-(\d{1,2})\/(\d{1,2})$/))) {
    const end = ymd(+m[1], +m[2], +m[3]);
    let sm = +m[4], sd = +m[5];
    if (sm > 12 && sd <= 12) [sm, sd] = [sd, sm];
    return range(ymd(+m[1] - (sm > +m[2] ? 1 : 0), sm, sd), end);
  }
  // y/m/d-d  أو  d-y/m/d (يوم البداية مع تاريخ النهاية الكامل)
  let parts = null;
  if ((m = raw.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})-(\d{1,2})$/))) parts = [+m[1], +m[2], +m[3], +m[4]];
  else if ((m = raw.match(/^(\d{1,2})-(\d{4})\/(\d{1,2})\/(\d{1,2})$/))) parts = [+m[2], +m[3], +m[4], +m[1]];
  if (parts) {
    const [y, mo, d2, d1] = parts;
    return d1 <= d2 ? range(ymd(y, mo, d1), ymd(y, mo, d2)) : range(ymd(mo === 1 ? y - 1 : y, mo === 1 ? 12 : mo - 1, d1), ymd(y, mo, d2));
  }
  // ISO من - إلى
  if ((m = raw.match(/^(\d{4}-\d{2}-\d{2})(?:-|إلى|الى|to)(\d{4}-\d{2}-\d{2})$/))) return range(m[1], m[2]);
  // تاريخ مفرد
  const single = parseDate(raw, schoolYear || (year ? `${year}/${year + 1}` : ''));
  if (single) return { start: single, end: single };
  // d1-d2/m (بدون سنة)
  if ((m = raw.match(/^(\d{1,2})-(\d{1,2})\/(\d{1,2})$/))) { const y = yearFor(+m[3], schoolYear); return y ? range(ymd(y, +m[3], +m[1]), ymd(y, +m[3], +m[2])) : null; }
  return null;
}
function range(a, b) { if (!a || !b) return null; return a <= b ? { start: a, end: b } : null; }

/** «الأول، الثاني» → [1,2] */
const WEEK_WORDS = ['الاول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس', 'السابع', 'الثامن', 'التاسع', 'العاشر', 'الحادي عشر', 'الثاني عشر', 'الثالث عشر', 'الرابع عشر', 'الخامس عشر', 'السادس عشر', 'السابع عشر', 'الثامن عشر', 'التاسع عشر', 'العشرون'];
export function weekNumbers(text) {
  const b = toLatin(text).replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي');
  const parts = b.split(/[،,؛;\-]+|\s+و/).map((x) => x.trim()).filter(Boolean);
  const out = [];
  for (const p of parts) {
    if (/^\d{1,2}$/.test(p)) { out.push(+p); continue; }
    const i = WEEK_WORDS.indexOf(p.replace(/^الاسبوع\s*/, ''));
    if (i >= 0) out.push(i + 1); else return [];
  }
  return out;
}
export function addDaysKey(key, n) {
  const [y, m, d] = key.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}
