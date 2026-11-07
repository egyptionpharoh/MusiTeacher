// أدوات المتصفح: قياس النص بالخط الحقيقي، تحويل الخلفية إلى PNG عالي الدقة، تجهيز الصور، والتنزيل.
import { renderArt } from './art.js';
import { fontCss } from './designs.js';
import { buildDocx } from './docx.js';

let ctx = null;
const mcache = new Map();
/** عرض النص بالمليمتر بالخط المثبت فعلًا على الجهاز */
export function measure(text, font, sizePt, bold) {
  const key = `${font}|${sizePt}|${bold ? 1 : 0}|${text}`;
  if (mcache.has(key)) return mcache.get(key);
  if (!ctx) ctx = document.createElement('canvas').getContext('2d');
  ctx.font = `${bold ? 700 : 400} ${sizePt}pt ${fontCss(font)}`;
  const mm = (ctx.measureText(String(text)).width * 25.4) / 96;
  if (mcache.size > 5000) mcache.clear();
  mcache.set(key, mm);
  return mm;
}
export const clearMeasureCache = () => mcache.clear();

export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = () => reject(new Error('image-load'));
    im.src = src;
  });
}

const DPI = 200;
const bgCache = new Map();
/** يرسم خلفية التصميم على canvas بدقة 200 نقطة/بوصة ويعيد بايتات PNG */
export async function rasterizeArt(artId, palette) {
  const key = artId + JSON.stringify(palette);
  if (bgCache.has(key)) return bgCache.get(key);
  const svg = renderArt(artId, palette);
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const im = await loadImage(url);
    const W = Math.round((210 / 25.4) * DPI), H = Math.round((297 / 25.4) * DPI);
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d');
    g.fillStyle = palette.paper; g.fillRect(0, 0, W, H);
    g.drawImage(im, 0, 0, W, H);
    const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
    const bytes = new Uint8Array(await blob.arrayBuffer());
    if (bgCache.size > 8) bgCache.clear();
    bgCache.set(key, bytes);
    return bytes;
  } finally { URL.revokeObjectURL(url); }
}

/** يحوّل صورة مرفوعة (PNG/JPG/WebP/SVG) إلى PNG نظيف بحد أقصى للأبعاد */
export async function normalizeImage(file, max = 700) {
  const url = URL.createObjectURL(file);
  try {
    const im = await loadImage(url);
    let w = im.naturalWidth || im.width || max, h = im.naturalHeight || im.height || max;
    const r = Math.min(1, max / Math.max(w, h)); w = Math.max(1, Math.round(w * r)); h = Math.max(1, Math.round(h * r));
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    c.getContext('2d').drawImage(im, 0, 0, w, h);
    return { src: c.toDataURL('image/png'), w, h };
  } finally { URL.revokeObjectURL(url); }
}

export function dataUrlBytes(src) {
  const b64 = src.split(',')[1] || '';
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
async function srcBytes(src) {
  if (!src) return null;
  if (src.startsWith('data:')) return dataUrlBytes(src);
  const r = await fetch(src, { cache: 'force-cache' });
  if (!r.ok) throw new Error('asset-' + r.status);
  return new Uint8Array(await r.arrayBuffer());
}
/** صورة الشعار كما ستدخل ملف Word: PNG دائمًا */
async function pngOf(img) {
  if (!img || !img.src) return null;
  const bytes = await srcBytes(img.src);
  if (bytes && bytes[0] === 0x89 && bytes[1] === 0x50) return bytes;
  const im = await loadImage(img.src);
  const c = document.createElement('canvas'); c.width = im.naturalWidth || img.w; c.height = im.naturalHeight || img.h;
  c.getContext('2d').drawImage(im, 0, 0);
  return dataUrlBytes(c.toDataURL('image/png'));
}

/** ينشئ ملف Word من نموذج غلاف واحد أو أكثر (صفحة لكل غلاف) */
export async function exportDocx(models, images, title) {
  const pages = [];
  for (const m of models) pages.push({ model: m, background: { key: 'bg:' + m.art + JSON.stringify(m.palette), bytes: await rasterizeArt(m.art, m.palette) } });
  const assets = {};
  for (const k of ['emblem', 'school', 'brand']) {
    if (images[k] && images[k].src) { const bytes = await pngOf(images[k]); if (bytes) assets[k] = { key: k, bytes }; }
  }
  const bytes = await buildDocx({ pages, assets, title });
  return new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}

export function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; a.rel = 'noopener';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export const safeFileName = (s) => String(s).replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 90) || 'غلاف';
