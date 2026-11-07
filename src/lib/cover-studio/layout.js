// محرك التكوين: يحوّل (تصميم + ألوان + بيانات المعلم) إلى نموذج صفحة واحد بمواضع دقيقة بالمليمتر.
// النموذج نفسه تستعمله المعاينة في المتصفح ومولّد ملف Word، فيتطابق الناتجان.
import { coverTexts } from './records.js';
import { getDesign, fontScale } from './designs.js';

export const PT = 0.3528; // ملم لكل نقطة طباعية

/** قياس تقريبي لعرض النص (يُستبدل في المتصفح بقياس حقيقي عبر canvas) */
export function roughMeasure(text, font, sizePt, bold) {
  let w = 0;
  for (const ch of String(text)) w += /[A-Za-z0-9]/.test(ch) ? 0.56 : ch === ' ' ? 0.26 : /[ً-ْ]/.test(ch) ? 0 : 0.5;
  return w * sizePt * PT * (bold ? 1.06 : 1);
}

function fit(texts, font, size, bold, maxW, measure, min) {
  let s = size;
  for (const t of texts) { if (!t) continue; const w = measure(t, font, s, bold); if (w > maxW) s = s * (maxW / w); }
  return Math.max(min, Math.floor(s * 2) / 2);
}

const contain = (img, boxW, boxH) => {
  if (!img || !img.w || !img.h) return { w: boxW, h: boxH };
  const r = Math.min(boxW / img.w, boxH / img.h);
  return { w: img.w * r, h: img.h * r };
};

/**
 * يبني نموذج الغلاف.
 * images: { emblem: {src,w,h}|null, school: {src,w,h}|null, brand: {src,w,h}|null }
 */
export function buildCover({ designId, paletteIdx = 0, data, images = {}, measure = roughMeasure }) {
  const d = getDesign(designId);
  const pal = d.palettes[Math.min(paletteIdx, d.palettes.length - 1)];
  const lay = d.layout;
  const tx = coverTexts(data);
  const titleFont = data.titleFont || d.fonts.title;
  const bodyFont = d.fonts.body;
  const [x0, x1] = lay.bounds;
  const cw = x1 - x0, cx = (x0 + x1) / 2;
  const items = [];
  const missing = [];
  const onColor = !!lay.headerOnColor;
  const headInk = onColor ? '#FFFFFF' : pal.ink;
  const run = (t, size, o = {}) => ({ t, font: o.font || bodyFont, size, bold: o.bold !== false, color: o.color || pal.ink, effect: o.effect || null });
  const box = (id, x, y, w, h, paras, o = {}) => items.push({ type: 'box', id, x, y, w, h, paras, valign: 'middle', ...o });
  const para = (runs, o = {}) => ({ align: o.align || 'center', runs: Array.isArray(runs) ? runs : [runs], lineH: o.lineH || 1.2 });

  for (const [id, pl] of [['plate', lay.plate], ['headerPlate', lay.headerPlate]]) {
    if (pl) items.push({ type: 'box', id, ...pl, paras: [], fill: pal.paper, stroke: pal.accent, strokeW: 0.45, radius: pl.radius || 4, decorative: true });
  }

  // -------------------------------------------------- الترويسة
  const logoPos = data.logoPos || lay.logoDefault || 'right';
  const S = 24;
  const top = lay.headerTop;
  const headSizes = [15, 14, 13.5, 13.5];
  const headLines = [tx.country, tx.ministry, tx.directorate, tx.school];
  const placeSchool = (x, y) => {
    if (!images.school) return;
    const c = contain(images.school, S, S);
    items.push({ type: 'image', key: 'school', x: x + (S - c.w) / 2, y: y + (S - c.h) / 2, w: c.w, h: c.h });
  };
  let headerBottom;
  if (lay.header === 'split') {
    // ثلاث مناطق: نص الترويسة في جهة، والشعار الرسمي في الوسط، وشعار المدرسة في الجهة الأخرى
    const E = 25;
    const zw = (cw - E - 10) / 2;
    const textRight = logoPos === 'left';
    const bx = textRight ? x1 - zw : x0;
    const lx = textRight ? x0 + (zw - S) / 2 : x1 - zw + (zw - S) / 2;
    let lines = [[tx.country, 14.5], [tx.ministry, 13.5], [tx.directorateA, 12.5], [tx.directorateB, 12.5]];
    const schoolSize = fit([tx.school], bodyFont, 12.5, true, zw - 2, measure, 9);
    if (schoolSize < 11) {
      const words = tx.school.split(' '); let best = 1, bd = 1e9;
      for (let i = 1; i < words.length; i++) { const a = words.slice(0, i).join(' ').length, b = words.slice(i).join(' ').length; if (Math.abs(a - b) < bd) { bd = Math.abs(a - b); best = i; } }
      lines.push([words.slice(0, best).join(' '), 12.5], [words.slice(best).join(' '), 12.5]);
    } else lines.push([tx.school, 12.5]);
    const sizes = lines.map(([t, sz]) => fit([t], bodyFont, sz, true, zw - 2, measure, 9));
    const hh = sizes.reduce((a, sz) => a + sz * PT * 1.5, 0);
    box('header', bx, top, zw, Math.max(hh + 1, E), lines.map(([t], i) => para(run(t, sizes[i], { color: headInk }), { lineH: 1.5 })));
    const ey = top + Math.max(0, (hh - E) / 2);
    if (images.emblem) { const c = contain(images.emblem, E, E); items.push({ type: 'image', key: 'emblem', x: cx - c.w / 2, y: ey + (E - c.h) / 2, w: c.w, h: c.h }); }
    else missing.push({ key: 'emblem', x: cx - E / 2, y: ey, w: E, h: E });
    placeSchool(lx, top + Math.max(0, (hh - S) / 2));
    headerBottom = top + Math.max(hh + 1, E);
  } else {
    const E = 22;
    if (images.emblem) { const c = contain(images.emblem, E, E); items.push({ type: 'image', key: 'emblem', x: cx - c.w / 2, y: top + (E - c.h) / 2, w: c.w, h: c.h }); }
    else missing.push({ key: 'emblem', x: cx - E / 2, y: top, w: E, h: E });
    placeSchool(logoPos === 'left' ? x0 + 1 : x1 - S - 1, top + 1);
    const w = cw - (images.school ? 8 : 0);
    const sizes = headSizes.map((s, i) => fit([headLines[i]], bodyFont, s, true, w - 4, measure, 10));
    const hh = sizes.reduce((a, s) => a + s * PT * 1.55, 0);
    box('header', cx - w / 2, top + E + 1.5, w, hh + 1, headLines.map((t, i) => para(run(t, sizes[i], { color: headInk }), { lineH: 1.55 })));
    headerBottom = top + E + 2.5 + hh;
  }

  // -------------------------------------------------- العنوان والمادة والحقول
  const safeBottom = lay.safeBottom || lay.brandTop - 4;
  const titleEffect = { type: d.effect, color: pal.title, dark: pal.titleDark, grad: pal.titleGrad };
  const build = (k) => {
    const out = [];
    const scale = fontScale(titleFont);
    const maxW = (cw - 8) * 0.95; // هامش أمان لاختلاف عرض الخط بين الأجهزة
    let T = fit(tx.title, titleFont, lay.titleSize * scale * k, true, maxW, measure, 24 * scale);
    const C = Math.max(15, Math.round(T / scale * 0.42 * 2) / 2);
    const Ssub = tx.subject ? fit([tx.subject], titleFont, T * lay.subjectScale, true, maxW, measure, 20 * scale) : 0;
    let y = Math.max(lay.titleTop - (1 - k) * 14, headerBottom + 6);
    const tH = T * PT * 1.32;
    out.push(['title', x0, y, cw, tH * tx.title.length + 1, tx.title.map((t) => para(run(t, T, { font: titleFont, effect: titleEffect, color: pal.title }), { lineH: 1.32 }))]);
    y += tH * tx.title.length + 1;
    if (tx.connector) { const h = C * PT * 1.55; out.push(['connector', x0, y, cw, h, [para(run(tx.connector, C, { color: pal.ink2 }), { lineH: 1.55 })]]); y += h; }
    if (tx.subject) { const h = Ssub * PT * 1.36; out.push(['subject', x0, y, cw, h, [para(run(tx.subject, Ssub, { font: titleFont, effect: titleEffect, color: pal.title }), { lineH: 1.36 })]]); y += h; }
    y += (lay.fieldsGap ?? 10) * k;
    const fl = [[tx.year, 17], [tx.semester, 16]];
    if (tx.grade) fl.push([tx.grade, 15]);
    const fs = fl.map(([t, s]) => fit([t], bodyFont, s, true, cw - 24, measure, 11));
    const fh = fs.reduce((a, s) => a + s * PT * 1.7, 0);
    const panel = lay.fields === 'panel';
    const pw = Math.min(cw - 16, 128);
    out.push(['fields', panel ? cx - pw / 2 : x0, y, panel ? pw : cw, fh + (panel ? 7 : 0), fl.map(([t], i) => para(run(t, fs[i], { color: pal.ink }), { lineH: 1.7 })),
      panel ? { fill: pal.soft, stroke: pal.gold, strokeW: 0.4, radius: 4 } : {}]);
    y += fh + (panel ? 7 : 0);
    const P = fit([tx.preparer], bodyFont, 16, true, cw - 10, measure, 11);
    const ph = P * PT * 1.7;
    const py = Math.max(lay.preparerTop, y + 5 * k);
    out.push(['preparer', x0, py, cw, ph, [para(run(tx.preparer, P, { color: pal.ink }), { lineH: 1.7 })]]);
    return { out, end: py + ph };
  };
  let res = build(1);
  for (let k = 0.94; res.end > safeBottom && k > 0.6; k -= 0.06) res = build(k);
  for (const [id, x, y, w, h, paras, extra] of res.out) box(id, x, y, w, h, paras, extra || {});

  // -------------------------------------------------- توقيع المنصة (هادئ)
  const B = lay.brandSize || 10;
  const bx = lay.brandX || cx;
  if (images.brand) { const c = contain(images.brand, B, B); items.push({ type: 'image', key: 'brand', x: bx - c.w / 2, y: lay.brandTop, w: c.w, h: c.h, opacity: 0.92 }); }
  box('brand', bx - 30, lay.brandTop + B + 0.6, 60, 4.2, [para(run(tx.brand, 7.5, { color: pal.ink2, bold: true, font: 'Segoe UI' }), { lineH: 1.3 })]);

  return { designId: d.id, design: d, palette: pal, paletteIdx, art: d.art, items, missing, texts: tx, fonts: { title: titleFont, body: bodyFont } };
}
