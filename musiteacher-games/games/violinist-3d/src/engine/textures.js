// خامات مرسومة على canvas (خشب، سجادة، سطح الكمان، القيقب)
// مستخرج حرفيًا من violin-player-3d.html الأصلي (MusiTeacher) مع إضافة export فقط.
import { crSample } from './geometry.js';

function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function cnv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

function texWoodGrain(base, dark, seed, lines = 90) {
  const W = 512, H = 512, c = cnv(W, H), x = c.getContext('2d'), r = rng(seed);
  x.fillStyle = base; x.fillRect(0, 0, W, H);
  for (let k = 0; k < lines; k++) {
    const yy = r() * H; x.strokeStyle = dark; x.globalAlpha = 0.08 + r() * 0.22; x.lineWidth = 0.8 + r() * 2.5;
    x.beginPath(); x.moveTo(0, yy); for (let xx = 0; xx <= W; xx += 32) x.lineTo(xx, yy + Math.sin(xx * 0.02 + k) * 3); x.stroke();
  }
  x.globalAlpha = 1; return c;
}

// circular Omani-style majlis rug
function texRug() {
  const W = 1024, c = cnv(W, W), x = c.getContext('2d'), C = W / 2;
  x.fillStyle = '#1b1410'; x.fillRect(0, 0, W, W);
  const ring = (r0, col) => { x.beginPath(); x.arc(C, C, r0, 0, Math.PI * 2); x.fillStyle = col; x.fill(); };
  ring(C, '#3f1512'); ring(C - 18, '#d9c9a3'); ring(C - 30, '#1d2436');
  // triangle border
  for (let k = 0; k < 96; k++) {
    const a = k / 96 * Math.PI * 2, a2 = (k + 0.5) / 96 * Math.PI * 2, a3 = (k + 1) / 96 * Math.PI * 2, r1 = C - 32, r2 = C - 78;
    x.fillStyle = k % 2 ? '#a67c35' : '#d9c9a3';
    x.beginPath(); x.moveTo(C + Math.cos(a) * r1, C + Math.sin(a) * r1); x.lineTo(C + Math.cos(a2) * r2, C + Math.sin(a2) * r2); x.lineTo(C + Math.cos(a3) * r1, C + Math.sin(a3) * r1); x.closePath(); x.fill();
  }
  ring(C - 82, '#d9c9a3'); ring(C - 90, '#5a1b17');
  // field lattice of diamonds
  x.save(); x.beginPath(); x.arc(C, C, C - 92, 0, Math.PI * 2); x.clip();
  const s = 56;
  for (let i = -10; i <= 10; i++) for (let j = -10; j <= 10; j++) {
    const px = C + i * s + (j % 2 ? s / 2 : 0), py = C + j * s * 0.75;
    x.fillStyle = (i + j) % 3 === 0 ? '#733026' : '#4e1915';
    x.beginPath(); x.moveTo(px, py - s * 0.38); x.lineTo(px + s * 0.3, py); x.lineTo(px, py + s * 0.38); x.lineTo(px - s * 0.3, py); x.closePath(); x.fill();
    x.fillStyle = '#b8955a'; x.fillRect(px - 2, py - 2, 4, 4);
  }
  x.restore();
  // eight-pointed star medallion
  const star = (R0, col) => { x.fillStyle = col; for (const rot of [0, Math.PI / 4]) { x.save(); x.translate(C, C); x.rotate(rot); x.fillRect(-R0 * 0.7, -R0 * 0.7, R0 * 1.4, R0 * 1.4); x.restore(); } };
  star(170, '#d9c9a3'); star(158, '#1d2436'); star(110, '#5a1b17'); star(98, '#a67c35'); star(60, '#3f1512');
  return c;
}

export { rng, cnv, texWoodGrain, texRug };
