// =====================================================================
//  رسم العلامات SVG (للواجهة والطباعة) من مخطط layout.js — مسارات Bravura الدقيقة.
// =====================================================================
import { layout, glyphPath } from './layout.js';
import { ENGRAVING } from './smufl.js';

/**
 * @param {string[]} ids
 * @param {object} o  k: حجم مسافة المدرج بالبكسل · color · line: رسم الخط الإيقاعي · hl: {fi,pi} لتظليل جزء
 *                    hlColor · padTop/padBottom بالمسافات · minTop/minBottom لتوحيد الارتفاع بين بطاقات متعددة
 */
export function figureSVG(ids, o = {}) {
  const k = o.k ?? 14, color = o.color || 'currentColor';
  const L = layout(ids, o);
  const top = Math.max(L.top, o.minTop ?? 0) + (o.padTop ?? 0.6), bottom = Math.min(L.bottom, o.minBottom ?? 0) - (o.padBottom ?? 0.6);
  const W = L.width * k, H = (top - bottom) * k, oy = top * k;
  let s = '';
  if (o.line !== false) s += `<rect x="0" y="${(oy - ENGRAVING.staffLineThickness * k / 2).toFixed(2)}" width="${W.toFixed(2)}" height="${Math.max(1, ENGRAVING.staffLineThickness * k).toFixed(2)}" fill="${o.lineColor || color}" opacity="${o.lineOpacity ?? 0.55}"/>`;
  for (const p of L.prims) {
    const lit = o.hl && p.fi === o.hl.fi && (p.pi === o.hl.pi || p.pi === -1 && o.hl.group);
    const fill = lit ? (o.hlColor || '#e9a23b') : (o.colors && o.colors[p.fi]) || color;
    if (p.t === 'glyph') s += `<path d="${glyphPath(p.n, p.x * k, oy - p.y * k, k)}" fill="${fill}"/>`;
    else s += `<rect x="${(p.x * k).toFixed(2)}" y="${(oy - (p.y + p.h) * k).toFixed(2)}" width="${(p.w * k).toFixed(2)}" height="${(p.h * k).toFixed(2)}" fill="${fill}"/>`;
  }
  const label = o.label ? ` aria-label="${o.label}"` : '';
  return { svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W.toFixed(1)} ${H.toFixed(1)}" width="${W.toFixed(1)}" height="${H.toFixed(1)}" role="img"${label} class="nt">${s}</svg>`, width: W, height: H, layout: L, k, oy };
}
