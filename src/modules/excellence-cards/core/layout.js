// حسابات صفحة A4 للكروت (بالمليمتر) — منفصلة عن الواجهة لتُختبر وحدها.
export const A4 = { w: 210, h: 297, margin: 10 };
const W = A4.w - 2 * A4.margin;   // 190
const H = A4.h - 2 * A4.margin;   // 277

// عدد الكروت في الصفحة ← شبكة الأعمدة والصفوف. الكارت الواحد كبير في أعلى الصفحة.
export const LAYOUTS = [
  { n: 1, cols: 1, rows: 1, h: 120, label: 'كارت واحد كبير' },
  { n: 2, cols: 1, rows: 2, label: 'كارتان في الصفحة' },
  { n: 4, cols: 1, rows: 4, label: '4 كروت (عرضية)' },
  { n: 6, cols: 2, rows: 3, label: '6 كروت' },
  { n: 8, cols: 2, rows: 4, label: '8 كروت' },
  { n: 10, cols: 2, rows: 5, label: '10 كروت (موفّر)' },
].map((l) => {
  const w = +(W / l.cols).toFixed(2);
  const h = +(l.h || H / l.rows).toFixed(2);
  return { ...l, w, h, cm: `${(w / 10).toFixed(1)} × ${(h / 10).toFixed(1)} سم` };
});
export const PER_PAGE = LAYOUTS.map((l) => l.n);
export const layoutFor = (n) => LAYOUTS.find((l) => l.n === +n) || LAYOUTS[LAYOUTS.length - 1];

export const CUT_GAP = 2.4;   // هامش داخل الخلية حول الكارت (مم) حتى لا يقع القص على الإطار

/** شكل الكارت حسب نسبة عرضه إلى ارتفاعه: wide عرضي، mid متوسط، tall مربع تقريبًا */
export function shapeOf(w, h) {
  const r = w / h;
  if (r >= 1.55) return 'wide';
  if (r >= 1.18) return 'mid';
  return 'tall';
}

/** وحدة القياس الأساسية للكارت (مم) — كل الخطوط والمسافات مضاعفات لها، فيبقى التصميم متناسبًا في كل الأحجام */
export function unitOf(w, h) {
  const shape = shapeOf(w, h);
  const byW = w / (shape === 'wide' ? 100 : shape === 'mid' ? 88 : 80);
  const byH = h / (shape === 'wide' ? 55 : shape === 'mid' ? 64 : 78);
  return +Math.min(byW, byH).toFixed(3);
}

/** تقسيم قائمة الكروت إلى صفحات */
export function paginate(cards, n) {
  const per = layoutFor(n).n;
  const pages = [];
  for (let i = 0; i < cards.length; i += per) pages.push(cards.slice(i, i + per));
  return pages;
}

/** تصغير العنوان تلقائيًا مع طول العبارة حتى لا يخرج عن الكارت */
export function headlineScale(text) {
  const len = String(text || '').replace(/\s+/g, ' ').length;
  if (len <= 34) return 1;
  return Math.max(0.62, +(1 - (len - 34) * 0.0105).toFixed(3));
}
