// خامات مرسومة برمجيًا (بلا ملفات صور): جلود، خشب، تطعيم صدف، حبال، نحاس — وعلامة MusiTeacher على الرقمة.
import * as THREE from 'three';

export const rng = (seed) => { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };
const cnv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const tex = (c, rep) => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); } return t; };

/** علامة MusiTeacher: نوتتان + Musi رفيعة + Teacher عريضة (نفس علامة العود والكمان والأورج)، على قوس */
function brandArc(x, cx, cy, r, size, ink) {
  const fam = '"Segoe UI","Helvetica Neue",Helvetica,Arial,sans-serif';
  const parts = [['♫', `700 ${size * 1.05}px ${fam}`], [' ', `400 ${size * 0.5}px ${fam}`], ...'Musi'.split('').map((ch) => [ch, `400 ${size}px ${fam}`]), ...'Teacher'.split('').map((ch) => [ch, `700 ${size}px ${fam}`])];
  let total = 0; const ws = parts.map(([ch, f]) => { x.font = f; const w = x.measureText(ch).width + size * 0.04; total += w; return w; });
  let a = -total / 2 / r; x.fillStyle = ink; x.textAlign = 'center'; x.textBaseline = 'alphabetic';
  parts.forEach(([ch, f], i) => { const phi = a + ws[i] / 2 / r; a += ws[i] / r; x.save(); x.translate(cx + r * Math.sin(phi), cy + r * Math.cos(phi)); x.rotate(-phi); x.font = f; x.fillText(ch, 0, 0); x.restore(); });
}

/**
 * رقمة جلدية. kind: fish (جلد سمك شفاف بنقش الحراشف) | goat (جلد ماعز) | sheep (جلد غنم)
 * العلامة تُطبع قرب الحافة السفلى (جهة العازف) كما تُطبع علامات الصانعين على رقمات الطبول.
 */
export function skinTexture(kind, seed = 1, brand = true) {
  const S = 1024, c = cnv(S, S), x = c.getContext('2d'), r = rng(seed);
  const P = { fish: ['#efe9da', '#d9cfb8', '#b9ab8e'], goat: ['#e2d3b3', '#c4ae86', '#8d744e'], sheep: ['#eee3c9', '#d8c7a2', '#a8926a'], hair: ['#8a6a4a', '#5e4430', '#33241a'] }[kind];
  const g = x.createRadialGradient(S / 2, S / 2, S * 0.05, S / 2, S / 2, S * 0.52); g.addColorStop(0, P[0]); g.addColorStop(0.75, P[1]); g.addColorStop(1, P[2]); x.fillStyle = g; x.fillRect(0, 0, S, S);
  // بقع وتفاوت طبيعي في سماكة الجلد
  for (let i = 0; i < 90; i++) { const px = r() * S, py = r() * S, rad = 30 + r() * 150; const gg = x.createRadialGradient(px, py, 0, px, py, rad); const dark = r() < 0.55; gg.addColorStop(0, dark ? 'rgba(120,90,50,0.07)' : 'rgba(255,250,235,0.08)'); gg.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = gg; x.fillRect(px - rad, py - rad, rad * 2, rad * 2); }
  if (kind === 'fish') {            // جيوب الحراشف: شبكة معيّنات باهتة
    x.strokeStyle = 'rgba(150,130,95,0.13)'; x.lineWidth = 1.2;
    for (let k = -S; k < S * 2; k += 26) { x.beginPath(); x.moveTo(k, 0); x.lineTo(k + S * 0.6, S); x.stroke(); x.beginPath(); x.moveTo(k, 0); x.lineTo(k - S * 0.6, S); x.stroke(); }
  } else {                          // عروق وخطوط شعر باقية نحو الحافة
    x.strokeStyle = kind === 'goat' ? 'rgba(90,60,30,0.16)' : 'rgba(120,95,60,0.10)';
    for (let i = 0; i < 420; i++) { const a = r() * 6.283, rr = S * (0.33 + r() * 0.2), px = S / 2 + Math.cos(a) * rr, py = S / 2 + Math.sin(a) * rr, l = 8 + r() * 26, d = a + (r() - 0.5) * 1.2; x.lineWidth = 0.6 + r(); x.beginPath(); x.moveTo(px, py); x.lineTo(px + Math.cos(d) * l, py + Math.sin(d) * l); x.stroke(); }
    if (kind === 'goat') for (let i = 0; i < 26; i++) { const a = r() * 6.283, rr = S * (0.4 + r() * 0.1), px = S / 2 + Math.cos(a) * rr, py = S / 2 + Math.sin(a) * rr, rad = 40 + r() * 70; const gg = x.createRadialGradient(px, py, 0, px, py, rad); gg.addColorStop(0, 'rgba(70,45,20,0.22)'); gg.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = gg; x.fillRect(px - rad, py - rad, rad * 2, rad * 2); }
  }
  if (kind === 'hair') {           // جلد بشعره (الكاسر المفلطح): شعر قصير كثيف في كل الاتجاهات
    for (let i = 0; i < 5200; i++) { const px = r() * S, py = r() * S, l = 6 + r() * 14, d = r() * 6.283; x.strokeStyle = r() < 0.5 ? 'rgba(30,18,10,0.22)' : 'rgba(200,170,130,0.16)'; x.lineWidth = 1 + r() * 1.4; x.beginPath(); x.moveTo(px, py); x.lineTo(px + Math.cos(d) * l, py + Math.sin(d) * l); x.stroke(); }
  }
  // أثر العزف: منطقة أفتح قليلًا مصقولة في الوسط
  const w = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S * 0.22); w.addColorStop(0, 'rgba(255,252,240,0.16)'); w.addColorStop(1, 'rgba(255,252,240,0)'); x.fillStyle = w; x.fillRect(0, 0, S, S);
  if (brand) { x.globalAlpha = 0.78; brandArc(x, S / 2, S / 2, S * 0.365, S * 0.047, kind === 'goat' ? '#3a2412' : '#4a3320'); x.globalAlpha = 1; }
  return tex(c);
}

export function woodTexture(base = '#7a4526', dark = '#4a2512', seed = 3, rep = [2, 1], vertical = false) {
  const W = 512, H = 512, c = cnv(W, H), x = c.getContext('2d'), r = rng(seed);
  x.fillStyle = base; x.fillRect(0, 0, W, H);
  if (vertical) { x.translate(W, 0); x.rotate(Math.PI / 2); }
  for (let i = 0; i < 300; i++) { const y = r() * H; x.strokeStyle = r() < 0.75 ? dark : '#e8c9a0'; x.globalAlpha = 0.03 + r() * 0.09; x.lineWidth = 0.6 + r() * 2.4; x.beginPath(); x.moveTo(0, y); for (let px = 0; px <= W; px += 64) x.lineTo(px, y + Math.sin(px * 0.02 + i) * 3 + (r() - 0.5) * 2); x.stroke(); }
  if (vertical) { x.globalAlpha = 0.5; x.strokeStyle = dark; x.lineWidth = 2; for (let k = 0; k < 4; k++) { x.beginPath(); x.moveTo(0, k * H / 4 + 1); x.lineTo(W, k * H / 4 + 1); x.stroke(); } }   // فواصل ألواح الطبل
  x.globalAlpha = 1; return tex(c, rep);
}

/** تطعيم صدف وعاج: صفوف معيّنات ومثلثات لؤلؤية على خشب داكن مع خيوط فاصلة */
export function inlayTexture(rep = [12, 1], seed = 5) {
  const W = 256, H = 256, c = cnv(W, H), x = c.getContext('2d'), r = rng(seed);
  x.fillStyle = '#3a1d0e'; x.fillRect(0, 0, W, H);
  const pearl = () => { const k = r(); return k < 0.33 ? '#f4f0e4' : k < 0.66 ? '#e6efe9' : '#f3e6e4'; };
  const dia = (cx, cy, w, h, col) => { x.fillStyle = col; x.beginPath(); x.moveTo(cx, cy - h); x.lineTo(cx + w, cy); x.lineTo(cx, cy + h); x.lineTo(cx - w, cy); x.closePath(); x.fill(); };
  for (const [y, h] of [[0, 14], [H - 14, 14]]) for (let i = 0; i < 16; i++) { x.fillStyle = i % 2 ? '#f1ece0' : '#16100c'; x.fillRect(i * 16, y, 16, h / 2); x.fillStyle = i % 2 ? '#16100c' : '#f1ece0'; x.fillRect(i * 16, y + h / 2, 16, h / 2); }
  x.fillStyle = '#b3261e'; x.fillRect(0, 18, W, 5); x.fillRect(0, H - 23, W, 5);
  for (let row = 0; row < 3; row++) for (let i = 0; i < 4; i++) { const cx = i * 64 + (row % 2 ? 32 : 0) + 32, cy = 62 + row * 66; dia(cx, cy, 26, 30, pearl()); dia(cx, cy, 13, 15, row % 2 ? '#1f4a8a' : '#7a2a1a'); dia(cx, cy, 6, 7, pearl()); }
  for (let row = 0; row < 2; row++) for (let i = 0; i < 4; i++) dia(i * 64 + (row % 2 ? 32 : 0), 95 + row * 66, 9, 11, pearl());
  return tex(c, rep);
}

export function ropeTexture(col = '#e9e0c8', rep = [1, 24]) {
  const c = cnv(32, 32), x = c.getContext('2d'); x.fillStyle = col; x.fillRect(0, 0, 32, 32);
  x.strokeStyle = 'rgba(90,70,40,0.55)'; x.lineWidth = 3; for (let k = -32; k < 64; k += 10) { x.beginPath(); x.moveTo(k, 0); x.lineTo(k + 16, 32); x.stroke(); }
  return tex(c, rep);
}
