// =====================================================================
//  رسم اللافتات: كل خيار/تلميح (نص، رمز SVG للنوتة، أيقونة آلة، علامة ميزان) يُرسم على Canvas،
//  فيُستعمل قوامًا للوحات البوابات ثلاثية الأبعاد، وصورةً في لوحة القيادة (HUD).
// =====================================================================
import * as THREE from 'three';
import { GLYPHS } from '../notation/smufl.js';
import { glyphPath } from '../notation/layout.js';

const imgCache = new Map();
function svgImage(svg) {
  if (imgCache.has(svg)) return imgCache.get(svg);
  const p = new Promise((res) => {
    const im = new Image();
    im.onload = () => res(im); im.onerror = () => res(null);
    im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  });
  imgCache.set(svg, p); return p;
}

const rasterCache = new Map();
/** صورة نقطية (صورة سؤال أو صورة آلة) — تُحمَّل مرة واحدة وتُخزَّن */
export function rasterImage(src) {
  if (rasterCache.has(src)) return rasterCache.get(src);
  const p = new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });
  rasterCache.set(src, p); return p;
}

function meterSVG(n, d, k = 40, col = '#111') {
  const has = (x) => GLYPHS['timeSig' + x];
  if (has(n) && has(d)) {
    const w = 2 * k;
    return { svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${4.4 * k}" width="${w}" height="${4.4 * k}"><path d="${glyphPath('timeSig' + n, 0.1 * k, 1.2 * k, k)}" fill="${col}"/><path d="${glyphPath('timeSig' + d, 0.1 * k, 3.25 * k, k)}" fill="${col}"/></svg>`, w, h: 4.4 * k };
  }
  return null;
}

/** يرسم مواصفة لافتة داخل مستطيل (x,y,w,h) من سياق Canvas */
export async function drawSign(ctx, spec, x, y, w, h, o = {}) {
  const ink = o.ink || '#121417', subc = o.sub || 'rgba(20,24,30,0.62)';
  ctx.save();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.direction = 'rtl';
  const hasSub = !!spec.sub;
  const mainH = hasSub ? h * 0.74 : h;
  if (spec.t === 'text') {
    let size = mainH * (spec.text.length > 14 ? 0.3 : spec.text.length > 8 ? 0.38 : 0.5);
    ctx.font = `800 ${size}px Cairo, Tahoma, Arial, sans-serif`;
    while (ctx.measureText(spec.text).width > w * 0.92 && size > 10) { size *= 0.92; ctx.font = `800 ${size}px Cairo, Tahoma, Arial, sans-serif`; }
    ctx.fillStyle = ink; ctx.fillText(spec.text, x + w / 2, y + mainH / 2 + size * 0.06);
  } else if (spec.t === 'icon') {
    const iconS = mainH * 0.5;
    ctx.font = `${iconS}px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif`;
    ctx.fillText(spec.icon || '', x + w / 2, y + mainH * 0.36);
    let size = mainH * 0.24; ctx.font = `800 ${size}px Cairo, Tahoma, Arial, sans-serif`;
    while (ctx.measureText(spec.text).width > w * 0.92 && size > 10) { size *= 0.92; ctx.font = `800 ${size}px Cairo, Tahoma, Arial, sans-serif`; }
    ctx.fillStyle = ink; ctx.fillText(spec.text, x + w / 2, y + mainH * 0.8);
  } else if (spec.t === 'img') {
    const im = await rasterImage(spec.src);
    const capH = spec.text ? mainH * 0.2 : 0, boxH = mainH - capH;
    if (im) {
      const s = Math.min((w * 0.94) / im.width, (boxH * 0.94) / im.height);
      const dw = im.width * s, dh = im.height * s;
      ctx.save(); ctx.beginPath(); ctx.roundRect(x + (w - dw) / 2, y + (boxH - dh) / 2, dw, dh, Math.min(dw, dh) * 0.06); ctx.clip();
      ctx.drawImage(im, x + (w - dw) / 2, y + (boxH - dh) / 2, dw, dh); ctx.restore();
    } else { ctx.font = `${boxH * 0.4}px sans-serif`; ctx.fillText('🖼️', x + w / 2, y + boxH / 2); }
    if (spec.text) {
      let size = capH * 0.8; ctx.font = `800 ${size}px Cairo, Tahoma, Arial, sans-serif`;
      while (ctx.measureText(spec.text).width > w * 0.92 && size > 9) { size *= 0.92; ctx.font = `800 ${size}px Cairo, Tahoma, Arial, sans-serif`; }
      ctx.fillStyle = ink; ctx.fillText(spec.text, x + w / 2, y + boxH + capH / 2);
    }
  } else if (spec.t === 'svg' || spec.t === 'meter') {
    let svg = spec.svg, sw = spec.w, sh = spec.h;
    if (spec.t === 'meter') { const m = meterSVG(spec.n, spec.d, 40, ink); if (m) { svg = m.svg; sw = m.w; sh = m.h; } else { svg = null; } }
    if (svg) {
      if (o.ink && o.ink !== '#121417' && o.ink !== '#111') svg = svg.replaceAll('#111', o.ink);
      const im = await svgImage(svg);
      if (im) {
        const pad = 0.08, s = Math.min((w * (1 - 2 * pad)) / sw, (mainH * (1 - 2 * pad)) / sh, spec.t === 'meter' ? 10 : 14);
        const dw = sw * s, dh = sh * s;
        ctx.drawImage(im, x + (w - dw) / 2, y + (mainH - dh) / 2, dw, dh);
      }
    } else {
      const size = mainH * 0.34; ctx.font = `900 ${size}px Cairo, Arial`; ctx.fillStyle = ink;
      ctx.fillText(String(spec.n), x + w / 2, y + mainH * 0.3); ctx.fillText(String(spec.d), x + w / 2, y + mainH * 0.72);
      ctx.fillRect(x + w / 2 - size * 0.5, y + mainH * 0.5 - 2, size, 4);
    }
  }
  if (hasSub) {
    let size = h * 0.11; ctx.font = `700 ${size}px Cairo, Tahoma, Arial, sans-serif`;
    while (ctx.measureText(spec.sub).width > w * 0.94 && size > 9) { size *= 0.92; ctx.font = `700 ${size}px Cairo, Tahoma, Arial, sans-serif`; }
    ctx.fillStyle = subc; ctx.fillText(spec.sub, x + w / 2, y + h * 0.87);
  }
  ctx.restore();
}

export const LANE_COLORS = ['#ff6b6b', '#4dabf7', '#ffd43b', '#69db7c', '#b197fc'];
export const LANE_LETTERS = ['أ', 'ب', 'ج', 'د', 'هـ'];

/** قوام لافتة بوابة: إطار ملوّن + رقم المسار + المحتوى */
export async function signTexture(spec, color, letter, o = {}) {
  const W = 640, H = 400;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  x.fillStyle = color; x.beginPath(); x.roundRect(0, 0, W, H, 34); x.fill();
  x.fillStyle = '#fbfaf6'; x.beginPath(); x.roundRect(18, 18, W - 36, H - 36, 24); x.fill();
  // شارة الحرف
  x.fillStyle = color; x.beginPath(); x.arc(W - 62, 62, 40, 0, Math.PI * 2); x.fill();
  x.fillStyle = '#fff'; x.font = '900 46px Cairo, Arial'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(letter, W - 62, 66);
  await drawSign(x, spec, 36, 40, W - 72, H - 70);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

/** صورة (dataURL) لعرض مواصفة في الواجهة */
export async function signImage(spec, w = 520, h = 300, o = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d');
  if (o.bg) { x.fillStyle = o.bg; x.beginPath(); x.roundRect(0, 0, w, h, 22); x.fill(); }
  await drawSign(x, spec, 10, 10, w - 20, h - 20, o);
  return c.toDataURL();
}
