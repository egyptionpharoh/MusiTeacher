// مولّد PowerPoint (PPTX) حقيقي بلا مكتبات: كل النصوص مربعات نص قابلة للتعديل، باتجاه من اليمين لليسار،
// مع ملاحظات المتحدث لكل شريحة (نص الميسّر). 16:9. القوالب الأساسية في pptx-template.js.
import { zip } from '../cover-studio/zip.js';
import { master, layout, theme, notesMaster, notesTheme } from './pptx-template.js';
import { agendaOf, totalMinutes, ordinal } from './schema.js';
import { DOMAIN } from './taxonomy.js';
import { BRAND, sourceNote, minutesLabel as mins, bidiNums } from './export-text.js';

const W = 960, H = 540, M = 48;                      // بالنقاط (pt)؛ الشريحة 13.333×7.5 بوصة
const EMU = 12700;
const e = (pt) => Math.round(pt * EMU);
const FONT = 'Segoe UI';
const C = { navy: '14365F', ink: '1F2433', sub: '4B5563', mute: '8A94A6', line: 'D5DEEA', paper: 'FFFFFF', soft: 'F3F6FB', white: 'FFFFFF' };

export const xmlEsc = (s) => String(s == null ? '' : s)
  // eslint-disable-next-line no-control-regex
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
  .replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ------------------------------------------------------------------ تقدير المساحة النصية
/** عدد الأسطر التقريبي لنص بعرض معين (تقدير متحفظ ≈ 0.55em للحرف حتى مع الخطوط البديلة الأعرض). */
export function linesFor(text, size, width) {
  const per = Math.max(1, Math.floor(width / (size * 0.55)));
  return String(text).split('\n').reduce((n, l) => n + Math.max(1, Math.ceil(l.length / per)), 0);
}
/** أكبر حجم خط (من max إلى min) تتسع به الفقرات في الصندوق. */
export function fitSize(paras, width, height, max, min = 12, lineGap = 1.28, paraGap = 0.45) {
  for (let s = max; s >= min; s -= 1) {
    const h = paras.reduce((acc, t) => acc + linesFor(t, s, width) * s * lineGap + s * paraGap, 0);
    if (h <= height) return s;
  }
  return min;
}

/** حجم موحد لعدة صناديق منفصلة: أصغر حجم يناسب كل نص في صندوقه. */
export const fitEach = (items, width, height, max, min, lineGap = 1.22) =>
  items.reduce((s, t) => Math.min(s, fitSize([t], width, height, max, min, lineGap, 0)), max);

// ------------------------------------------------------------------ عناصر XML
let shapeId = 2;
const hex = (c) => String(c || '').replace('#', '').toUpperCase();
const solid = (c, alpha) => `<a:solidFill><a:srgbClr val="${hex(c)}">${alpha != null ? `<a:alpha val="${Math.round(alpha * 1000)}"/>` : ''}</a:srgbClr></a:solidFill>`;

function run(r) {
  const sz = Math.round((r.size || 18) * 100);
  return `<a:r><a:rPr lang="${r.lang || 'ar-OM'}" altLang="en-US" sz="${sz}"${r.bold ? ' b="1"' : ''} dirty="0">${solid(r.color || C.ink)}<a:latin typeface="${FONT}"/><a:cs typeface="${FONT}"/></a:rPr><a:t>${xmlEsc(bidiNums(r.t))}</a:t></a:r>`;
}

/** p: {runs|t, size, bold, color, align:'r'|'ctr'|'l', bullet:'dot'|'num', after(pt), before(pt), line(%)} */
function para(p) {
  const runs = p.runs || [{ t: p.t, size: p.size, bold: p.bold, color: p.color }];
  const algn = p.align || 'r';
  const sz = runs[0].size || 18;
  let bu = '<a:buNone/>', mar = '';
  if (p.bullet === 'dot') { mar = ` marL="${e(sz * 1.15)}" indent="-${e(sz * 1.15)}"`; bu = `<a:buClr><a:srgbClr val="${hex(p.buColor || C.navy)}"/></a:buClr><a:buFont typeface="Arial"/><a:buChar char="•"/>`; }
  if (p.bullet === 'num') { mar = ` marL="${e(sz * 1.5)}" indent="-${e(sz * 1.5)}"`; bu = `<a:buClr><a:srgbClr val="${hex(p.buColor || C.navy)}"/></a:buClr><a:buFont typeface="${FONT}"/><a:buAutoNum type="arabicPeriod"/>`; }
  const spc = `<a:lnSpc><a:spcPct val="${(p.line || 110) * 1000}"/></a:lnSpc><a:spcBef><a:spcPts val="${Math.round((p.before || 0) * 100)}"/></a:spcBef><a:spcAft><a:spcPts val="${Math.round((p.after != null ? p.after : sz * 0.45) * 100)}"/></a:spcAft>`;
  return `<a:p><a:pPr algn="${algn}" rtl="1"${mar}>${spc}${bu}</a:pPr>${runs.map(run).join('')}<a:endParaRPr lang="ar-OM" sz="${Math.round(sz * 100)}" dirty="0"/></a:p>`;
}

/** شكل: مستطيل/مستدير/دائرة مع نص اختياري. الإحداثيات بالنقاط. */
function shape(o) {
  const id = shapeId++;
  const geom = o.geom || 'rect';
  const adj = o.radius != null && geom === 'roundRect' ? `<a:avLst><a:gd name="adj" fmla="val ${o.radius}"/></a:avLst>` : '<a:avLst/>';
  const fill = o.fill ? solid(o.fill, o.alpha) : '<a:noFill/>';
  const ln = o.line ? `<a:ln w="${e(o.lineW || 1)}">${solid(o.line)}</a:ln>` : '<a:ln><a:noFill/></a:ln>';
  const ins = o.inset != null ? o.inset : 6;
  const body = o.paras && o.paras.length
    ? `<p:txBody><a:bodyPr wrap="square" lIns="${e(ins)}" tIns="${e(o.insetY != null ? o.insetY : ins * 0.6)}" rIns="${e(ins)}" bIns="${e(o.insetY != null ? o.insetY : ins * 0.6)}" rtlCol="1" anchor="${o.anchor || 't'}"><a:noAutofit/></a:bodyPr><a:lstStyle/>${o.paras.map(para).join('')}</p:txBody>`
    : `<p:txBody><a:bodyPr rtlCol="1" anchor="ctr"/><a:lstStyle/><a:p><a:pPr rtl="1"/><a:endParaRPr lang="ar-OM" dirty="0"/></a:p></p:txBody>`;
  const isText = !o.fill && !o.line;
  return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${xmlEsc(o.name || `${isText ? 'TextBox' : 'Shape'} ${id}`)}"/><p:cNvSpPr${isText ? ' txBox="1"' : ''}/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${e(o.x)}" y="${e(o.y)}"/><a:ext cx="${e(o.w)}" cy="${e(o.h)}"/></a:xfrm><a:prstGeom prst="${geom}">${adj}</a:prstGeom>${fill}${ln}</p:spPr>${body}</p:sp>`;
}
const text = (x, y, w, h, paras, o = {}) => shape({ x, y, w, h, paras, inset: 0, insetY: 0, ...o });

// ------------------------------------------------------------------ مكونات الشريحة
function header(title, accent, { label: lab, minutes } = {}) {
  const out = [];
  const tw = minutes ? W - 2 * M - 140 : W - 2 * M;
  if (lab) out.push(text(W - M - tw, 30, tw, 22, [{ t: lab, size: 13, bold: true, color: accent, after: 0 }], { name: 'Section label' }));
  const size = fitSize([title], tw, 58, 30, 20, 1.2, 0);
  out.push(text(W - M - tw, lab ? 52 : 40, tw, lab ? 60 : 66, [{ t: title, size, bold: true, color: C.navy, after: 0, line: 100 }], { anchor: 't', name: 'Title' }));
  out.push(shape({ x: W - M - 70, y: lab ? 116 : 112, w: 70, h: 5, geom: 'roundRect', radius: 50000, fill: accent, name: 'Accent' }));
  if (minutes) out.push(pill(M, 42, `${mins(minutes)}`, accent));
  return out;
}
function pill(x, y, t, accent, w = 118) {
  return shape({ x, y, w, h: 30, geom: 'roundRect', radius: 50000, fill: accent, alpha: 14, inset: 6, insetY: 2, anchor: 'ctr', name: 'Time',
    paras: [{ t, size: 13, bold: true, color: accent, align: 'ctr', after: 0 }] });
}
function badge(x, y, t, accent, w = 130) {
  return shape({ x, y, w, h: 28, geom: 'roundRect', radius: 50000, fill: accent, inset: 6, insetY: 2, anchor: 'ctr', name: 'Badge',
    paras: [{ t, size: 13, bold: true, color: C.white, align: 'ctr', after: 0 }] });
}
function footer(n, total) {
  return [
    text(M, H - 34, 300, 18, [{ t: BRAND, size: 10, color: C.mute, align: 'l', after: 0, lang: 'en-US' }], { name: 'Footer' }),
    text(W - M - 120, H - 34, 120, 18, [{ t: `${n} / ${total}`, size: 10, color: C.mute, align: 'r', after: 0 }], { name: 'Slide number' }),
  ];
}
function bullets(x, y, w, h, items, { numbered = false, max = 26, min = 14, color = C.ink, accent = C.navy } = {}) {
  const size = fitSize(items, w - max * 1.5, h, max, min, 1.25, 0.55);
  return text(x, y, w, h, items.map((t) => ({ t, size, color, bullet: numbered ? 'num' : 'dot', buColor: accent, after: size * 0.55, line: 105 })), { name: 'Content' });
}
/** صندوق مُميّز بعنوان صغير (مثال، المنتج، ملاحظة). */
function callout(x, y, w, h, lab, body, accent) {
  const size = fitSize([body], w - 28, h - 36, 18, 12, 1.25, 0);
  return [
    shape({ x, y, w, h, geom: 'roundRect', radius: 9000, fill: accent, alpha: 8, line: accent, lineW: 0.75, name: 'Callout' }),
    shape({ x: x + 14, y: y + 10, w: w - 28, h: h - 18, inset: 0, insetY: 0, name: 'Callout text',
      paras: [{ t: lab, size: 12.5, bold: true, color: accent, after: 4 }, { t: body, size, color: C.ink, after: 0, line: 108 }] }),
  ];
}

// ------------------------------------------------------------------ تقسيم المحتوى على الشرائح
export function chunk(items, n) {
  const out = []; for (let i = 0; i < items.length; i += n) out.push(items.slice(i, i + n)); return out.length ? out : [[]];
}

/** يبني قائمة الشرائح (كائنات {shapes, notes, dark}) من المشغل. */
export function buildSlides(w) {
  const accent = (DOMAIN[w.domain] || {}).color || '#1D4ED8';
  const s = w.settings;
  const slides = [];
  const add = (shapes, notes, dark = false) => slides.push({ shapes, notes, dark });

  // 1) الغلاف
  {
    const sh = [
      shape({ x: 0, y: 0, w: W, h: H, fill: C.navy, name: 'Background' }),
      shape({ x: -120, y: 250, w: 420, h: 420, geom: 'ellipse', fill: accent, alpha: 38, name: 'Decor 1' }),
      shape({ x: 150, y: -140, w: 300, h: 300, geom: 'ellipse', fill: 'FFFFFF', alpha: 6, name: 'Decor 2' }),
      shape({ x: 60, y: 120, w: 150, h: 150, geom: 'ellipse', line: 'FFFFFF', lineW: 1.5, name: 'Decor 3' }),
      shape({ x: W - M - 90, y: 96, w: 90, h: 6, geom: 'roundRect', radius: 50000, fill: accent, name: 'Accent' }),
      text(W - M - 600, 112, 600, 26, [{ t: 'مشغل إنماء مهني', size: 15, bold: true, color: 'A9C7E8', after: 0 }]),
    ];
    const tsize = fitSize([w.title], 600, 170, 42, 26, 1.18, 0);
    sh.push(text(W - M - 600, 146, 600, 180, [{ t: w.title, size: tsize, bold: true, color: C.white, after: 0, line: 100 }], { name: 'Title' }));
    if (w.tagline) sh.push(text(W - M - 600, 334, 600, 56, [{ t: w.tagline, size: fitSize([w.tagline], 600, 56, 18, 13), color: 'D6E4F5', after: 0 }]));
    const meta = [s.presenter, s.school, s.date].filter(Boolean).join('   •   ');
    if (meta) sh.push(text(W - M - 600, 408, 600, 26, [{ t: meta, size: 14, color: C.white, after: 0 }]));
    sh.push(shape({ x: W - M - 150, y: 446, w: 150, h: 30, geom: 'roundRect', radius: 50000, fill: 'FFFFFF', alpha: 14, anchor: 'ctr', inset: 6, insetY: 2,
      paras: [{ t: mins(totalMinutes(w) || s.duration), size: 13, bold: true, color: C.white, align: 'ctr', after: 0 }] }));
    sh.push(text(M, H - 36, 320, 18, [{ t: BRAND, size: 10, color: '8FB0D6', align: 'l', after: 0, lang: 'en-US' }]));
    add(sh, [w.opening.welcome, w.summary].filter(Boolean).join('\n\n'), true);
  }

  // 2) لماذا هذا المشغل؟
  if (w.importance || w.summary) {
    const body = w.importance || w.summary;
    const size = fitSize([body], W - 2 * M - 40, 190, 26, 16);
    const sh = [...header('لماذا هذا المشغل؟', accent),
      shape({ x: W - M - 8, y: 150, w: 8, h: 190, fill: accent, name: 'Quote bar' }),
      text(M, 150, W - 2 * M - 30, 190, [{ t: body, size, color: C.ink, after: 0, line: 115 }], { anchor: 'ctr' })];
    if (w.goal) sh.push(...callout(M, 368, W - 2 * M, 104, 'الهدف العام', w.goal, accent));
    add(sh, w.summary !== body ? w.summary : '');
  }

  // 3) جدول المشغل
  {
    const rows = agendaOf(w);
    const top = 140, avail = H - top - 50, rh = Math.min(42, Math.floor(avail / Math.max(rows.length, 1)));
    const sh = [...header('مسار المشغل', accent, { minutes: totalMinutes(w) })];
    rows.forEach((r, i) => {
      const y = top + i * rh, size = Math.min(17, Math.max(12, rh * 0.42));
      sh.push(shape({ x: W - M - rh + 6, y: y + 3, w: rh - 8, h: rh - 8, geom: 'ellipse', fill: accent, anchor: 'ctr', inset: 0, insetY: 0,
        paras: [{ t: String(i + 1), size: size - 1, bold: true, color: C.white, align: 'ctr', after: 0 }] }));
      sh.push(text(M + 120, y, W - 2 * M - 120 - rh - 6, rh - 2, [{ t: r.title, size, color: C.ink, after: 0 }], { anchor: 'ctr' }));
      sh.push(text(M, y, 110, rh - 2, [{ t: mins(r.minutes), size: size - 1, bold: true, color: accent, align: 'l', after: 0 }], { anchor: 'ctr' }));
      if (i < rows.length - 1) sh.push(shape({ x: M, y: y + rh - 1, w: W - 2 * M, h: 0.75, fill: C.line, name: 'Rule' }));
    });
    add(sh, 'استعرض مسار المشغل بسرعة حتى يعرف المشاركون ما ينتظرهم وكم يستغرق كل جزء.');
  }

  // 4) الأهداف — بطاقات
  if (w.objectives.length) {
    const obj = w.objectives.slice(0, 6);
    const cols = obj.length <= 3 ? 1 : 2, rowsN = Math.ceil(obj.length / cols);
    const gx = 18, gy = 14, top = 146, cw = (W - 2 * M - gx * (cols - 1)) / cols, ch = Math.min(96, (H - top - 52 - gy * (rowsN - 1)) / rowsN);
    const size = fitEach(obj, cw - 80, ch - 16, 20, 12);
    const sh = [...header('الأهداف التدريبية', accent, { label: 'يُتوقع في نهاية المشغل أن' })];
    obj.forEach((o, i) => {
      const c = i % cols, r = Math.floor(i / cols);
      const x = W - M - cw - c * (cw + gx), y = top + r * (ch + gy);
      sh.push(shape({ x, y, w: cw, h: ch, geom: 'roundRect', radius: 12000, fill: C.soft, line: C.line, lineW: 0.75, name: 'Objective card' }));
      sh.push(shape({ x: x + cw - 50, y: y + (ch - 36) / 2, w: 36, h: 36, geom: 'ellipse', fill: accent, anchor: 'ctr', inset: 0, insetY: 0,
        paras: [{ t: String(i + 1), size: 15, bold: true, color: C.white, align: 'ctr', after: 0 }] }));
      sh.push(text(x + 14, y + 8, cw - 76, ch - 16, [{ t: o, size, color: C.ink, after: 0, line: 105 }], { anchor: 'ctr' }));
    });
    add(sh, 'اقرأ الأهداف مع المشاركين واربطها بما سيُنتجونه في النشاط التطبيقي.');
  }

  // 5) الافتتاح والاتفاقيات
  if (w.opening.agreements.length) {
    const sh = [...header('اتفاقياتنا خلال المشغل', accent, { label: 'الافتتاح', minutes: w.opening.minutes }),
      bullets(M, 150, W - 2 * M, 300, w.opening.agreements, { max: 24, accent })];
    add(sh, w.opening.welcome);
  }

  // 6) النشاط التمهيدي
  if (w.hook.steps.length || w.hook.title) {
    const sh = [...header(w.hook.title || 'نشاط تمهيدي', accent, { label: 'نشاط تمهيدي', minutes: w.hook.minutes }),
      bullets(M, 150, W - 2 * M, 320, w.hook.steps, { numbered: true, max: 24, accent })];
    add(sh, [w.hook.purpose, ...w.hook.steps.map((x, i) => `${i + 1}. ${x}`)].filter(Boolean).join('\n'));
  }

  // 7) المحاور (شريحة لكل محور، وتقسم إن طالت النقاط)
  w.axes.forEach((a, i) => {
    const parts = chunk(a.points.length ? a.points : [a.explain].filter(Boolean), 4);
    parts.forEach((pts, k) => {
      const lab = `المحور ${ordinal(i + 1)}${parts.length > 1 ? ` (${k + 1}/${parts.length})` : ''}`;
      const withEx = a.example && k === parts.length - 1;
      const sh = [...header(a.title, accent, { label: lab, minutes: k === 0 ? a.minutes : 0 })];
      if (pts.length) sh.push(bullets(M, 148, W - 2 * M, withEx ? 210 : 320, pts, { max: 26, accent }));
      if (withEx) sh.push(...callout(M, 372, W - 2 * M, 112, 'مثال من الواقع المدرسي', a.example, accent));
      add(sh, k === 0 ? [a.explain, a.example ? `مثال: ${a.example}` : ''].filter(Boolean).join('\n\n') : 'تابع النقاط واطلب من المشاركين مثالًا من صفوفهم.');
    });
  });

  // 8) النشاط التطبيقي
  if (w.activity.steps.length || w.activity.title) {
    const parts = chunk(w.activity.steps, 6);
    parts.forEach((steps, k) => {
      const sh = [...header(w.activity.title || 'النشاط التطبيقي', accent, { label: `نشاط تطبيقي${parts.length > 1 ? ` (${k + 1}/${parts.length})` : ''}`, minutes: k === 0 ? w.activity.minutes : 0 })];
      const panel = 300, gap = 22, sw = W - 2 * M - panel - gap;
      sh.push(text(W - M - sw, 148, sw, 330, steps.map((t, j) => ({ t, size: fitSize(steps, sw - 30, 330, 21, 13, 1.25, 0.55), color: C.ink, bullet: 'num', buColor: accent, after: 8, line: 105, _n: j })), { name: 'Steps' }));
      let y = 148;
      if (w.activity.grouping) { sh.push(...callout(M, y, panel, 122, 'التنظيم', w.activity.grouping, accent)); y += 136; }
      if (w.activity.output) sh.push(...callout(M, y, panel, Math.min(160, 478 - y), 'المنتج المتوقع', w.activity.output, accent));
      add(sh, [...w.activity.tips, w.activity.output ? `المنتج: ${w.activity.output}` : ''].filter(Boolean).join('\n'));
    });
  }

  // 9) أسئلة النقاش
  if (w.discussion.questions.length) {
    const qs = w.discussion.questions.slice(0, 4);
    const top = 150, gap = 14, bh = Math.min(90, (H - top - 52 - gap * (qs.length - 1)) / qs.length);
    const size = fitEach(qs, W - 2 * M - 100, bh - 16, 22, 13);
    const sh = [...header('لنتحاور', accent, { label: 'نقاش وتبادل خبرات', minutes: w.discussion.minutes })];
    qs.forEach((q, i) => {
      const y = top + i * (bh + gap);
      sh.push(shape({ x: M, y, w: W - 2 * M, h: bh, geom: 'roundRect', radius: 14000, fill: C.soft, line: C.line, lineW: 0.75 }));
      sh.push(shape({ x: W - M - 58, y: y + (bh - 40) / 2, w: 40, h: 40, geom: 'ellipse', fill: accent, anchor: 'ctr', inset: 0, insetY: 0,
        paras: [{ t: '؟', size: 20, bold: true, color: C.white, align: 'ctr', after: 0 }] }));
      sh.push(text(M + 18, y + 8, W - 2 * M - 92, bh - 16, [{ t: q, size, color: C.ink, after: 0 }], { anchor: 'ctr' }));
    });
    add(sh, 'اطلب من مشاركَين أو ثلاثة من تخصصات مختلفة أن يشاركوا، ودوّن الأفكار المشتركة.');
  }

  // 10) الخاتمة والتوصيات
  if (w.closing.recs.length || w.closing.takeaway) {
    const sh = [...header('خلاصة وتوصيات', accent, { minutes: w.closing.minutes })];
    let y = 148;
    if (w.closing.takeaway) {
      const size = fitSize([w.closing.takeaway], W - 2 * M - 40, 70, 24, 15);
      sh.push(shape({ x: M, y, w: W - 2 * M, h: 88, geom: 'roundRect', radius: 12000, fill: accent, inset: 20, anchor: 'ctr',
        paras: [{ t: w.closing.takeaway, size, bold: true, color: C.white, after: 0 }] }));
      y += 108;
    }
    if (w.closing.recs.length) sh.push(bullets(M, y, W - 2 * M, H - y - 52, w.closing.recs, { max: 22, accent }));
    add(sh, 'اختم بالتأكيد على خطوة واحدة صغيرة يطبقها كل مشارك خلال الأسبوع القادم.');
  }

  // 11) التقويم والتغذية الراجعة
  if (w.evaluation.items.length || w.evaluation.feedback.length) {
    const sh = [...header('قياس أثر المشغل', accent, { label: w.evaluation.method || 'التقويم', minutes: w.evaluation.minutes })];
    const half = (W - 2 * M - 24) / 2;
    if (w.evaluation.items.length) {
      sh.push(text(W - M - half, 146, half, 24, [{ t: 'بنود التقويم', size: 15, bold: true, color: accent, after: 0 }]));
      sh.push(bullets(W - M - half, 176, half, 300, w.evaluation.items, { max: 18, min: 11, accent }));
    }
    if (w.evaluation.feedback.length) {
      const x = w.evaluation.items.length ? M : W - M - half;
      const fh = Math.min(344, 70 + w.evaluation.feedback.length * 46);
      sh.push(shape({ x, y: 140, w: half, h: fh, geom: 'roundRect', radius: 6000, fill: C.soft, line: C.line, lineW: 0.75 }));
      sh.push(text(x + 16, 152, half - 32, 24, [{ t: 'بطاقة التغذية الراجعة', size: 15, bold: true, color: accent, after: 0 }]));
      sh.push(bullets(x + 16, 184, half - 32, fh - 54, w.evaluation.feedback, { numbered: true, max: 17, min: 11, accent }));
    }
    add(sh, 'وزّع بطاقة التغذية الراجعة (موجودة في الحقيبة التدريبية) واجمعها قبل خروج المشاركين.');
  }

  // 12) الشكر
  {
    const sh = [shape({ x: 0, y: 0, w: W, h: H, fill: C.navy, name: 'Background' }),
      shape({ x: W - 300, y: -160, w: 460, h: 460, geom: 'ellipse', fill: accent, alpha: 30 }),
      text(M, 190, W - 2 * M, 70, [{ t: 'شكرًا لحضوركم', size: 44, bold: true, color: C.white, align: 'ctr', after: 0 }]),
      text(M, 270, W - 2 * M, 34, [{ t: w.title, size: fitSize([w.title], W - 2 * M, 34, 18, 12), color: 'D6E4F5', align: 'ctr', after: 0 }])];
    if (s.presenter) sh.push(text(M, 316, W - 2 * M, 28, [{ t: s.presenter, size: 16, color: C.white, align: 'ctr', after: 0 }]));
    sh.push(text(M, H - 36, W - 2 * M, 18, [{ t: BRAND, size: 10, color: '8FB0D6', align: 'ctr', after: 0, lang: 'en-US' }]));
    add(sh, sourceNote(w), true);
  }

  // الترقيم والتذييل (إلا الغلاف والشكر)
  const total = slides.length;
  slides.forEach((sl, i) => { if (!sl.dark) sl.shapes.push(...footer(i + 1, total)); });
  return slides;
}

// ------------------------------------------------------------------ تجميع الحزمة
const NS = 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';
const HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const rels = (list) => `${HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${list.map(([id, type, target]) => `<Relationship Id="${id}" Type="${REL}/${type}" Target="${target}"/>`).join('')}</Relationships>`;
const spTree = (inner) => `<p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>${inner}</p:spTree>`;

function slideXML(sl) {
  return `${HEAD}<p:sld ${NS}><p:cSld><p:bg><p:bgPr>${solid(sl.dark ? C.navy : C.paper)}<a:effectLst/></p:bgPr></p:bg>${spTree(sl.shapes.join(''))}</p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`;
}
function notesXML(textBody) {
  const paras = String(textBody || '').split('\n').map((t) => `<a:p><a:pPr algn="r" rtl="1"/>${t ? `<a:r><a:rPr lang="ar-OM" sz="1400" dirty="0"><a:latin typeface="${FONT}"/><a:cs typeface="${FONT}"/></a:rPr><a:t>${xmlEsc(t)}</a:t></a:r>` : ''}</a:p>`).join('') || '<a:p/>';
  return `${HEAD}<p:notes ${NS}><p:cSld>${spTree(
    '<p:sp><p:nvSpPr><p:cNvPr id="2" name="Slide Image Placeholder 1"/><p:cNvSpPr><a:spLocks noGrp="1" noRot="1" noChangeAspect="1"/></p:cNvSpPr><p:nvPr><p:ph type="sldImg"/></p:nvPr></p:nvSpPr><p:spPr/></p:sp>'
    + `<p:sp><p:nvSpPr><p:cNvPr id="3" name="Notes Placeholder 2"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="body" idx="1"/></p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/>${paras}</p:txBody></p:sp>`,
  )}</p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:notes>`;
}

/** @returns {Promise<Uint8Array>} ملف PPTX */
export async function buildPptx(workshop) {
  shapeId = 2;
  const slides = buildSlides(workshop);
  const n = slides.length;
  const files = [];
  const ct = [
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>',
    '<Default Extension="xml" ContentType="application/xml"/>',
    '<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>',
    '<Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>',
    '<Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>',
    '<Override PartName="/ppt/notesMasters/notesMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.notesMaster+xml"/>',
    '<Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>',
    '<Override PartName="/ppt/theme/theme2.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>',
    '<Override PartName="/ppt/presProps.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presProps+xml"/>',
    '<Override PartName="/ppt/viewProps.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.viewProps+xml"/>',
    '<Override PartName="/ppt/tableStyles.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.tableStyles+xml"/>',
    '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>',
    '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>',
  ];
  for (let i = 1; i <= n; i++) {
    ct.push(`<Override PartName="/ppt/slides/slide${i}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`);
    ct.push(`<Override PartName="/ppt/notesSlides/notesSlide${i}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.notesSlide+xml"/>`);
  }
  files.push({ name: '[Content_Types].xml', data: `${HEAD}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">${ct.join('')}</Types>` });
  files.push({ name: '_rels/.rels', data: rels([['rId1', 'officeDocument', 'ppt/presentation.xml'], ['rId2', 'metadata/core-properties', 'docProps/core.xml'], ['rId3', 'extended-properties', 'docProps/app.xml']]).replace(`${REL}/metadata/core-properties`, 'http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties') });
  const now = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  files.push({ name: 'docProps/core.xml', data: `${HEAD}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${xmlEsc(workshop.title)}</dc:title><dc:creator>${xmlEsc(workshop.settings.presenter || 'MusiTeacher')}</dc:creator><dc:language>ar-OM</dc:language><dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified></cp:coreProperties>` });
  files.push({ name: 'docProps/app.xml', data: `${HEAD}<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>MusiTeacher</Application><Slides>${n}</Slides><Notes>${n}</Notes><PresentationFormat>Widescreen</PresentationFormat></Properties>` });

  const pr = [['rId1', 'slideMaster', 'slideMasters/slideMaster1.xml'], ['rId2', 'notesMaster', 'notesMasters/notesMaster1.xml'], ['rId3', 'theme', 'theme/theme1.xml'],
    ['rId4', 'presProps', 'presProps.xml'], ['rId5', 'viewProps', 'viewProps.xml'], ['rId6', 'tableStyles', 'tableStyles.xml']];
  const sldIds = [];
  for (let i = 1; i <= n; i++) { pr.push([`rId${100 + i}`, 'slide', `slides/slide${i}.xml`]); sldIds.push(`<p:sldId id="${255 + i}" r:id="rId${100 + i}"/>`); }
  files.push({ name: 'ppt/_rels/presentation.xml.rels', data: rels(pr) });
  files.push({ name: 'ppt/presentation.xml', data: `${HEAD}<p:presentation ${NS} saveSubsetFonts="1" rtl="1"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst><p:notesMasterIdLst><p:notesMasterId r:id="rId2"/></p:notesMasterIdLst><p:sldIdLst>${sldIds.join('')}</p:sldIdLst><p:sldSz cx="12192000" cy="6858000"/><p:notesSz cx="6858000" cy="9144000"/><p:defaultTextStyle><a:defPPr><a:defRPr lang="ar-OM"/></a:defPPr></p:defaultTextStyle></p:presentation>` });
  files.push({ name: 'ppt/presProps.xml', data: `${HEAD}<p:presentationPr ${NS}/>` });
  files.push({ name: 'ppt/viewProps.xml', data: `${HEAD}<p:viewPr ${NS}><p:normalViewPr><p:restoredLeft sz="15620"/><p:restoredTop sz="80000"/></p:normalViewPr><p:gridSpacing cx="76200" cy="76200"/></p:viewPr>` });
  files.push({ name: 'ppt/tableStyles.xml', data: `${HEAD}<a:tblStyleLst xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" def="{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}"/>` });
  files.push({ name: 'ppt/slideMasters/slideMaster1.xml', data: master });
  files.push({ name: 'ppt/slideMasters/_rels/slideMaster1.xml.rels', data: rels([['rId1', 'slideLayout', '../slideLayouts/slideLayout1.xml'], ['rId2', 'theme', '../theme/theme1.xml']]) });
  files.push({ name: 'ppt/slideLayouts/slideLayout1.xml', data: layout });
  files.push({ name: 'ppt/slideLayouts/_rels/slideLayout1.xml.rels', data: rels([['rId1', 'slideMaster', '../slideMasters/slideMaster1.xml']]) });
  files.push({ name: 'ppt/notesMasters/notesMaster1.xml', data: notesMaster });
  files.push({ name: 'ppt/notesMasters/_rels/notesMaster1.xml.rels', data: rels([['rId1', 'theme', '../theme/theme2.xml']]) });
  files.push({ name: 'ppt/theme/theme1.xml', data: theme });
  files.push({ name: 'ppt/theme/theme2.xml', data: notesTheme });
  slides.forEach((sl, i) => {
    const k = i + 1;
    files.push({ name: `ppt/slides/slide${k}.xml`, data: slideXML(sl) });
    files.push({ name: `ppt/slides/_rels/slide${k}.xml.rels`, data: rels([['rId1', 'slideLayout', '../slideLayouts/slideLayout1.xml'], ['rId2', 'notesSlide', `../notesSlides/notesSlide${k}.xml`]]) });
    files.push({ name: `ppt/notesSlides/notesSlide${k}.xml`, data: notesXML(sl.notes) });
    files.push({ name: `ppt/notesSlides/_rels/notesSlide${k}.xml.rels`, data: rels([['rId1', 'notesMaster', '../notesMasters/notesMaster1.xml'], ['rId2', 'slide', `../slides/slide${k}.xml`]]) });
  });
  return zip(files);
}
