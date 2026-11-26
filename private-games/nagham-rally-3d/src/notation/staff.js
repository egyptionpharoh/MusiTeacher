// =====================================================================
//  رسم المدرج (مفتاح صول) والنغمات والسلالم والموازير كـ SVG — للوحات المسارات ولوحة القيادة.
//  الرموز: Bravura (رؤوس النغمات والعلامات الإيقاعية، smufl.js) وFreeSerif (المفتاح وعلامات التحويل، fsglyphs.js)،
//  بالتعيين نفسه المستخدم في لعبة «مسابقة التدوين والإملاء اللحني».
// =====================================================================
import { GLYPHS, ENGRAVING } from './smufl.js';
import { glyphPath, layout } from './layout.js';
import { FS } from './fsglyphs.js';

export const STEPS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
export const SOLFEGE = { C: 'دو', D: 'ري', E: 'مي', F: 'فا', G: 'صول', A: 'لا', B: 'سي' };
const SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
/** الموضع على المدرج: 0 = الخط الأول (مي E4)، كل درجة = نصف مسافة */
export const posOf = (step, oct) => oct * 7 + STEPS.indexOf(step) - 30;
/** midi مع التحويل: acc = 1 دييز، -1 بيمول، -0.5 نصف بيمول (ربع تون) */
export const midiOf = (step, oct, acc = 0) => (oct + 1) * 12 + SEMI[step] + acc;
export const ACC_AR = { '1': 'دييز', '-1': 'بيمول', '-0.5': 'نصف بيمول', '0': '' };
export const noteName = (n) => SOLFEGE[n.step] + (n.acc ? ' ' + ACC_AR[String(n.acc)] : '');

const fsPath = (g, x, y, k, ax, ay, fill) => `<path d="${FS[g].d}" transform="translate(${(x - ax * k).toFixed(2)} ${(y + ay * k).toFixed(2)}) scale(${k.toFixed(5)} ${(-k).toFixed(5)})" fill="${fill}"/>`;

function accSVG(acc, x, y, S, fill) {
  if (acc === 1) return fsPath('sharp', x, y, 2.9 * S / 954, 207, 198, fill);
  if (acc === -1) return fsPath('flat', x, y, 2.5 * S / 836, 190, 180, fill);
  if (acc === 0) return fsPath('natural', x, y, 2.85 * S / 965, 190, 192, fill);
  if (acc === -0.5) {             // نصف بيمول (ربع تون): بيمول تقطعه شرطة مائلة — كما في التدوين العربي
    return fsPath('flat', x, y, 2.5 * S / 836, 190, 180, fill) + `<line x1="${(x - S * 0.55).toFixed(1)}" y1="${(y - S * 0.35).toFixed(1)}" x2="${(x + S * 0.25).toFixed(1)}" y2="${(y - S * 1.05).toFixed(1)}" stroke="${fill}" stroke-width="${(S * 0.16).toFixed(2)}" stroke-linecap="round"/>`;
  }
  return '';
}

/**
 * مدرج بنغمات. notes: [{step, oct, acc, hl}] · o: { S, color, stems, clef, width, label }
 */
export function staffSVG(notes, o = {}) {
  const S = o.S ?? 16, col = o.color || '#111', hlc = o.hl || '#d62839';
  const gap = o.gap ?? S * 2.6, clefW = o.clef === false ? S * 0.8 : S * 3.4;
  const W = o.width || (clefW + S * 1.2 + notes.length * gap + S * 0.6);
  const top = S * 3.2, H = top + S * 4 + S * 3.4;
  const y = (pos) => top + (8 - pos) * S / 2;
  let s = '';
  for (let l = 0; l < 5; l++) s += `<rect x="0" y="${(y(l * 2) - S * 0.05).toFixed(1)}" width="${W.toFixed(1)}" height="${(S * 0.1).toFixed(2)}" fill="${col}" opacity="0.85"/>`;
  if (o.clef !== false) s += fsPath('gclef', S * 0.5, y(2), S / 165, 100, 160, col);
  let x = clefW + S * 0.9;
  if (notes.length === 1 && !o.width) x = clefW + S * 1.4;
  for (const n of notes) {
    const pos = posOf(n.step, n.oct), fill = n.hl ? hlc : col;
    const accW = n.acc != null && n.acc !== 0 ? S * 1.3 : 0;
    if (accW) s += accSVG(n.acc, x + S * 0.2, y(pos), S, fill);
    const nx = x + accW;
    // خطوط إضافية
    for (let p = -2; p >= pos; p -= 2) s += `<rect x="${(nx - S * 0.4).toFixed(1)}" y="${(y(p) - S * 0.07).toFixed(1)}" width="${(S * 1.98).toFixed(1)}" height="${(S * 0.14).toFixed(2)}" fill="${col}"/>`;
    for (let p = 10; p <= pos; p += 2) s += `<rect x="${(nx - S * 0.4).toFixed(1)}" y="${(y(p) - S * 0.07).toFixed(1)}" width="${(S * 1.98).toFixed(1)}" height="${(S * 0.14).toFixed(2)}" fill="${col}"/>`;
    s += `<path d="${glyphPath('noteheadBlack', nx, y(pos), S)}" fill="${fill}"/>`;
    if (o.stems !== false) {
      const up = pos < 4, a = up ? GLYPHS.noteheadBlack.anchors.stemUpSE : GLYPHS.noteheadBlack.anchors.stemDownNW, st = ENGRAVING.stemThickness * S;
      const sx = nx + a[0] * S - (up ? st : 0), sy = y(pos) - a[1] * S, L = S * 3.5;
      s += `<rect x="${sx.toFixed(1)}" y="${(up ? sy - L : sy).toFixed(1)}" width="${st.toFixed(2)}" height="${L.toFixed(1)}" fill="${fill}"/>`;
    }
    x += gap + accW * 0.4;
  }
  const label = o.label ? ` aria-label="${o.label}"` : '';
  return { svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${Math.max(W, x).toFixed(1)} ${H.toFixed(1)}" width="${Math.max(W, x).toFixed(1)}" height="${H.toFixed(1)}"${label}>${s}</svg>`, width: Math.max(W, x), height: H };
}

/**
 * موازير إيقاعية على خط واحد مع خطوط الموازير وعلامة الميزان (اختيارية).
 * bars: [[figureIds…], …] · o: { k, color, meter:[n,d], hlBar, missing: عدد الأزمنة الفارغة في آخر مازورة (مربع «؟») }
 */
export function barsSVG(bars, o = {}) {
  const k = o.k ?? 14, col = o.color || '#111';
  let s = '', x = k * 0.6;
  const parts = bars.map((ids) => layout(ids, { padX: 0.5 }));
  const top = Math.max(4.6, ...parts.map((L) => L.top)) + 0.5, bot = Math.min(-2.2, ...parts.map((L) => L.bottom)) - 0.4;
  const oy = top * k, H = (top - bot) * k;
  const line = (x1, x2) => `<rect x="${x1.toFixed(1)}" y="${(oy - ENGRAVING.staffLineThickness * k / 2).toFixed(1)}" width="${(x2 - x1).toFixed(1)}" height="${Math.max(1, ENGRAVING.staffLineThickness * k).toFixed(2)}" fill="${col}" opacity="0.6"/>`;
  const x0 = x;
  if (o.meter) {
    const tsG = (n) => GLYPHS['timeSig' + n] ? 'timeSig' + n : null;
    const [a, b] = o.meter, ga = tsG(a), gb = tsG(b);
    if (ga && gb) {
      s += `<path d="${glyphPath(ga, x, oy - 1.0 * k, k)}" fill="${col}"/><path d="${glyphPath(gb, x, oy + 1.0 * k, k)}" fill="${col}"/>`;
    } else {
      s += `<text x="${x + k * 0.9}" y="${oy - k * 0.15}" font-size="${k * 2}" font-weight="800" text-anchor="middle" font-family="Cairo, Arial" fill="${col}">${a}</text><text x="${x + k * 0.9}" y="${oy + k * 1.85}" font-size="${k * 2}" font-weight="800" text-anchor="middle" font-family="Cairo, Arial" fill="${col}">${b}</text>`;
    }
    x += k * 2.6;
  }
  const barX = [x];
  parts.forEach((L, bi) => {
    const fill = o.hlBar === bi ? (o.hl || '#d62839') : col;
    for (const p of L.prims) {
      if (p.t === 'glyph') s += `<path d="${glyphPath(p.n, x + p.x * k, oy - p.y * k, k)}" fill="${fill}"/>`;
      else s += `<rect x="${(x + p.x * k).toFixed(2)}" y="${(oy - (p.y + p.h) * k).toFixed(2)}" width="${(p.w * k).toFixed(2)}" height="${(p.h * k).toFixed(2)}" fill="${fill}"/>`;
    }
    x += L.width * k;
    if (bi === parts.length - 1 && o.missing) {
      const w = k * 2.4 * o.missing;
      s += `<rect x="${(x + k * 0.2).toFixed(1)}" y="${(oy - k * 2.6).toFixed(1)}" width="${w.toFixed(1)}" height="${(k * 3.6).toFixed(1)}" rx="${k * 0.5}" fill="none" stroke="${o.hl || '#d62839'}" stroke-width="${k * 0.22}" stroke-dasharray="${k * 0.6} ${k * 0.4}"/><text x="${(x + k * 0.2 + w / 2).toFixed(1)}" y="${(oy + k * 0.2).toFixed(1)}" font-size="${k * 2.4}" font-weight="900" text-anchor="middle" font-family="Cairo, Arial" fill="${o.hl || '#d62839'}">؟</text>`;
      x += w + k * 0.4;
    }
    // خط المازورة (مزدوج في النهاية)
    const bt = oy - 2.0 * k, bh = 4.0 * k;
    if (bi === parts.length - 1 && o.final !== false) s += `<rect x="${x.toFixed(1)}" y="${bt.toFixed(1)}" width="${(k * 0.16).toFixed(2)}" height="${bh}" fill="${col}"/><rect x="${(x + k * 0.4).toFixed(1)}" y="${bt.toFixed(1)}" width="${(k * 0.5).toFixed(2)}" height="${bh}" fill="${col}"/>`;
    else s += `<rect x="${x.toFixed(1)}" y="${bt.toFixed(1)}" width="${(k * 0.16).toFixed(2)}" height="${bh}" fill="${col}"/>`;
    x += k * 0.9; barX.push(x);
  });
  s = line(x0 - k * 0.3, x) + s;
  return { svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${(x + k * 0.6).toFixed(1)} ${H.toFixed(1)}" width="${(x + k * 0.6).toFixed(1)}" height="${H.toFixed(1)}">${s}</svg>`, width: x + k * 0.6, height: H };
}
