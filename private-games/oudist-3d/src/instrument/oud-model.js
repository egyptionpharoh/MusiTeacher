// =====================================================================
//  مجسم العود العربي (إجرائي بالكامل — لا ملفات خارجية).
//  الأبعاد والشكل مبنية على قياسات العود العربي الشائع وعلى مجسم العود الموجود في المنصة (oud-maqamat):
//   • القصعة (الظهر): كمثرية بعمق ~18 سم من 21 ضلعًا بلونين وفواصل فاتحة.
//   • الوجه (الصدر): خشب فاتح، فيه شمسية كبيرة تحت الأوتار عند نهاية لوحة الأصابع وشمسيتان صغيرتان،
//     والرقمة (واقي الريشة) الداكنة بين الشمسية الكبيرة والفرس. الشمسيات مفرّغة فعلًا (يُرى عمق القصعة من خلالها).
//   • الفرس ملصق على الوجه قرب الطرف السفلي وتُربط فيه الأوتار.
//   • الزند قصير بلا دساتين، ولوحة أصابع أبنوس تمتد على الوجه حتى الشمسية الكبيرة.
//   • الأنف (العتبة) ثم البنجق منحنٍ إلى الخلف بزاوية حادة، وعلى جانبيه 12 ملوى.
//   • 11 وترًا: خمسة أزواج + وتر قرار مفرد (الأغلظ). طول الوتر المهتز 60.5 سم.
//  الإطار المحلي: y على امتداد العود نحو الزند، z خارج الوجه (نحو الجمهور)، x = y × z (نحو الأرض عند الحمل).
//  الوحدات: متر. الوتر 0 (القرار، الأغلظ) في جهة −x أي في الأعلى عند الحمل، والوتر 5 (الكردان، الأحدّ) في الأسفل.
// =====================================================================
import * as THREE from 'three';
import { COURSES } from './oud-data.js';

export const OUD = {
  yBot: -0.29, yJoint: 0.20, yNut: 0.40, yBridge: -0.205, yFbEnd: 0.09,
  wMax: 0.18,
  // نصف عرض الوجه عند y (شكل الكمثرى: أسفل مستدير ثم يضيق نحو الزند)
  w(y) {
    const t = (y - this.yBot) / (this.yJoint - this.yBot), tc = 0.38;
    if (t <= 0) return 0;
    if (t < tc) { const q = (tc - t) / tc; return this.wMax * Math.sqrt(Math.max(0, 1 - q * q)); }
    const u = Math.min(1, (t - tc) / (1 - tc));
    return 0.032 + (this.wMax - 0.032) * Math.pow(1 - Math.pow(u, 1.8), 1.2);
  },
  // عمق القصعة خلف الوجه
  d(y) { const t = (y - this.yBot) / (this.yJoint - this.yBot); return this.w(y) * 0.98 + 0.015 * Math.pow(Math.max(t, 0), 4); },
  // أوتار: مسافات المجموعات عند الفرس وعند الأنف، والمسافة داخل الزوج
  stringX(course, k, atNut) {
    const sp = atNut ? 0.0072 : 0.0128, pair = atNut ? 0.0021 : 0.0032;
    const cx = (course - 2.5) * sp;
    if (course === 0) return cx;
    return cx + (k ? pair / 2 : -pair / 2);
  },
  zB: 0.0102, zN: 0.0108,                 // ارتفاع الوتر فوق الوجه عند الفرس وعند الأنف
  get L() { return this.yNut - this.yBridge; },
  zStr(y) { return this.zB + (this.zN - this.zB) * (y - this.yBridge) / (this.yNut - this.yBridge); },
  // سطح لوحة الأصابع (أعلاها): يرتفع قليلًا نحو الأنف (ارتفاع الأوتار ~1.6 مم عند الأنف و~3.3 مم عند نهاية اللوحة)
  fbTop(y) { return 0.0072 + (0.0092 - 0.0072) * Math.max(0, Math.min(1, (y - this.yFbEnd) / (this.yNut - this.yFbEnd))); },
  fbHalfW(y) { return 0.0335 + (0.0215 - 0.0335) * Math.max(0, Math.min(1, (y - this.yFbEnd) / (this.yNut - this.yFbEnd))); },
  // الزند: نصف العرض والعمق (ظهر نصف دائري)
  neckW(y) { const t = Math.max(0, Math.min(1, (y - this.yJoint) / (this.yNut - this.yJoint))); return 0.031 + (0.0215 - 0.031) * t; },
  neckD(y) { const t = Math.max(0, Math.min(1, (y - this.yJoint) / (this.yNut - this.yJoint))); return 0.040 + (0.027 - 0.040) * t; },
  // موضع الضغط لنغمة على بعد s نصف تون من الوتر المطلق (عود بلا دساتين: الموضع يحدد الطبقة)
  stopY(semis) { return this.yNut - this.L * (1 - Math.pow(2, -semis / 12)); },
  xAt(course, k, y) { const t = (y - this.yBridge) / this.L; return this.stringX(course, k, false) * (1 - t) + this.stringX(course, k, true) * t; },
  courseX(course, y) { return course === 0 ? this.xAt(0, 0, y) : (this.xAt(course, 0, y) + this.xAt(course, 1, y)) / 2; },
  yPluck: -0.085,                          // منطقة الضرب بالريشة: بين الشمسية الكبيرة والفرس فوق الرقمة
};

// ---------------------------------------------------------------- أدوات
function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
function cnv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function tex(c, srgb = true) { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.needsUpdate = true; return t; }
function gridGeo(nu, nv, f, uvf, flip = false) {
  const pos = [], uv = [], idx = [];
  for (let i = 0; i <= nu; i++) for (let j = 0; j <= nv; j++) { const p = f(i, j); pos.push(p[0], p[1], p[2]); const t = uvf ? uvf(i, j) : [i / nu, j / nv]; uv.push(t[0], t[1]); }
  for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) { const a = i * (nv + 1) + j, b = a + nv + 1; if (flip) idx.push(a, a + 1, b, b, a + 1, b + 1); else idx.push(a, b, a + 1, b, b + 1, a + 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); return g;
}
// منشور من مضلّع (x,y) بين سطحين z0(x,y) و z1(x,y)
function slabGeo(poly, z0, z1) {
  const n = poly.length, pos = [], idx = [];
  const tri = THREE.ShapeUtils.triangulateShape(poly.map((p) => new THREE.Vector2(p[0], p[1])), []);
  for (const p of poly) pos.push(p[0], p[1], z1(p[0], p[1]));
  for (const p of poly) pos.push(p[0], p[1], z0(p[0], p[1]));
  const ccw = THREE.ShapeUtils.isClockWise(poly.map((p) => new THREE.Vector2(p[0], p[1]))) ? false : true;
  for (const t of tri) { if (ccw) { idx.push(t[0], t[1], t[2]); idx.push(n + t[0], n + t[2], n + t[1]); } else { idx.push(t[0], t[2], t[1]); idx.push(n + t[0], n + t[1], n + t[2]); } }
  const sideStart = pos.length / 3;
  for (let i = 0; i < n; i++) { const a = poly[i], b = poly[(i + 1) % n]; pos.push(a[0], a[1], z1(a[0], a[1]), b[0], b[1], z1(b[0], b[1]), b[0], b[1], z0(b[0], b[1]), a[0], a[1], z0(a[0], a[1])); const k = sideStart + i * 4; if (ccw) idx.push(k, k + 2, k + 1, k, k + 3, k + 2); else idx.push(k, k + 1, k + 2, k, k + 2, k + 3); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
}
function roundRectPoly(cx, cy, w, h, r, seg = 5) {
  const pts = [], q = [[cx + w / 2 - r, cy + h / 2 - r, 0], [cx - w / 2 + r, cy + h / 2 - r, Math.PI / 2], [cx - w / 2 + r, cy - h / 2 + r, Math.PI], [cx + w / 2 - r, cy - h / 2 + r, 1.5 * Math.PI]];
  for (const [x, y, a0] of q) for (let k = 0; k <= seg; k++) { const a = a0 + (Math.PI / 2) * k / seg; pts.push([x + r * Math.cos(a), y + r * Math.sin(a)]); }
  return pts;
}
// أنبوب ديناميكي رخيص (حلقات بعدد ثابت) — للأوتار التي تهتز وتُضغط
class Strand {
  constructor(n, radius, mat, sides = 6) {
    this.n = n; this.r = radius; this.sides = sides;
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array((n + 1) * sides * 3); this.nrm = new Float32Array((n + 1) * sides * 3);
    const idx = [];
    for (let i = 0; i < n; i++) for (let s = 0; s < sides; s++) { const a = i * sides + s, b = i * sides + (s + 1) % sides, c = a + sides, d = b + sides; idx.push(a, c, b, b, c, d); }
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(this.nrm, 3)); g.setIndex(idx);
    this.geo = g; this.mesh = new THREE.Mesh(g, mat); this.mesh.frustumCulled = false; this.mesh.castShadow = false;
  }
  set(pts) {               // pts: مصفوفة Vector3 بطول n+1
    const n = this.n, S = this.sides, P = this.pos, N = this.nrm, t = new THREE.Vector3(), a = new THREE.Vector3(), b = new THREE.Vector3(), ref = new THREE.Vector3(0, 0, 1);
    for (let i = 0; i <= n; i++) {
      const p = pts[i]; t.subVectors(pts[Math.min(n, i + 1)], pts[Math.max(0, i - 1)]).normalize();
      a.crossVectors(t, ref); if (a.lengthSq() < 1e-8) a.set(1, 0, 0); a.normalize(); b.crossVectors(t, a).normalize();
      for (let s = 0; s < S; s++) { const ang = s / S * Math.PI * 2, c = Math.cos(ang), sn = Math.sin(ang), k = (i * S + s) * 3; const nx = a.x * c + b.x * sn, ny = a.y * c + b.y * sn, nz = a.z * c + b.z * sn; N[k] = nx; N[k + 1] = ny; N[k + 2] = nz; P[k] = p.x + nx * this.r; P[k + 1] = p.y + ny * this.r; P[k + 2] = p.z + nz * this.r; }
    }
    this.geo.attributes.position.needsUpdate = true; this.geo.attributes.normal.needsUpdate = true; this.geo.computeBoundingSphere();
  }
}

// ---------------------------------------------------------------- القوام
function texBowl() {
  const W = 1024, H = 1024, c = cnv(W, H), x = c.getContext('2d'), r = rng(7);
  const ribs = 21, cols = ['#4e2712', '#a8703c'];
  for (let k = 0; k < ribs; k++) {
    const y0 = k / ribs * H, y1 = (k + 1) / ribs * H;
    x.fillStyle = cols[k % 2]; x.fillRect(0, y0, W, y1 - y0 + 1);
    for (let g = 0; g < 30; g++) {
      const yy = y0 + r() * (y1 - y0);
      x.strokeStyle = k % 2 ? `rgba(90,50,20,${0.10 + r() * 0.14})` : `rgba(15,6,2,${0.15 + r() * 0.18})`;
      x.lineWidth = 0.6 + r() * 1.4; x.beginPath(); x.moveTo(0, yy);
      for (let xx = 0; xx <= W; xx += 48) x.lineTo(xx, yy + Math.sin(xx * 0.012 + g) * 1.4);
      x.stroke();
    }
    x.fillStyle = '#ead6a6'; x.fillRect(0, y1 - 2.5, W, 3.5);            // فاصل فاتح بين الأضلاع
  }
  return c;
}
// خريطة نتوء خفيفة للأضلاع (تقعر بسيط بين الفواصل)
function texBowlBump() {
  const W = 64, H = 1024, c = cnv(W, H), x = c.getContext('2d'), ribs = 21;
  for (let yy = 0; yy < H; yy++) { const f = (yy / H * ribs) % 1, v = Math.round(255 * (0.55 + 0.45 * Math.sin(Math.PI * f))); x.fillStyle = `rgb(${v},${v},${v})`; x.fillRect(0, yy, W, 1); }
  return c;
}
// تعيين قوام الوجه: u=(x+0.2)/0.4 ، v=(y+0.30)/0.51 (أعلى اللوحة = y أكبر)
const FACE_UV = { x0: -0.2, sx: 0.4, y0: -0.30, sy: 0.51 };
export const ROSES = [{ x: 0, y: 0.045, r: 0.046, rings: 5 }, { x: -0.098, y: -0.078, r: 0.024, rings: 3 }, { x: 0.098, y: -0.078, r: 0.024, rings: 3 }];
function rosetteLattice(x, R, rings, lw) {
  // نقش هندسي: نجوم ثمانية متداخلة داخل دائرة (مفرّغ: الأبيض = خشب، الأسود = فراغ في قناع الشفافية)
  const step = R / rings;
  for (let i = -rings * 2; i <= rings * 2; i++) for (let j = -rings * 2; j <= rings * 2; j++) {
    const cx = i * step * 1.15, cy = j * step * 1.15; if (Math.hypot(cx, cy) > R + step) continue;
    x.lineWidth = Math.max(lw, step * 0.13);
    for (let rot = 0; rot < 2; rot++) { x.beginPath(); for (let k = 0; k <= 4; k++) { const a = rot * Math.PI / 4 + k * Math.PI / 2, rr = step * 0.52; const qx = cx + Math.cos(a) * rr, qy = cy + Math.sin(a) * rr; k ? x.lineTo(qx, qy) : x.moveTo(qx, qy); } x.stroke(); }
  }
  x.lineWidth = Math.max(lw + 1, step * 0.2); x.beginPath(); x.arc(0, 0, R * 0.55, 0, Math.PI * 2); x.stroke();
  x.beginPath(); x.arc(0, 0, R * 0.28, 0, Math.PI * 2); x.stroke();
}
function texFace(outline) {
  const W = 1024, H = Math.round(1024 * 0.51 / 0.4), c = cnv(W, H), x = c.getContext('2d'), r = rng(11);
  const a = cnv(W, H), xa = a.getContext('2d');                     // قناع الشفافية (أبيض = مصمت)
  const P = (px, py) => [(px - FACE_UV.x0) / FACE_UV.sx * W, (1 - (py - FACE_UV.y0) / FACE_UV.sy) * H], S = W / FACE_UV.sx;
  x.fillStyle = '#e2c08a'; x.fillRect(0, 0, W, H);
  for (let k = 0; k < 260; k++) { const xx = r() * W; x.strokeStyle = `rgba(150,100,45,${0.06 + r() * 0.16})`; x.lineWidth = 0.5 + r() * 1.6; x.beginPath(); x.moveTo(xx, 0); x.lineTo(xx + (r() - 0.5) * 5, H); x.stroke(); }
  const grd = x.createRadialGradient(W / 2, H * 0.62, W * 0.1, W / 2, H * 0.62, W * 0.62); grd.addColorStop(0, 'rgba(255,240,200,0.0)'); grd.addColorStop(1, 'rgba(120,70,25,0.32)'); x.fillStyle = grd; x.fillRect(0, 0, W, H);
  // تطعيم الحافة
  x.save(); x.beginPath(); outline.forEach((p, i) => { const q = P(p[0], p[1]); i ? x.lineTo(q[0], q[1]) : x.moveTo(q[0], q[1]); }); x.closePath();
  x.lineWidth = 15; x.strokeStyle = '#2b1709'; x.stroke(); x.lineWidth = 5; x.strokeStyle = '#eedcae'; x.stroke(); x.restore();
  // الرقمة: لوح داكن على شكل هلال بين الفرس والشمسية الكبيرة
  const pg = (ctx) => {
    ctx.beginPath();
    const p = (u, v) => P(u, v);
    let q = p(-0.060, -0.020); ctx.moveTo(q[0], q[1]);
    const curve = (a, b, c2) => { const A = p(...a), B = p(...b), C = p(...c2); ctx.bezierCurveTo(A[0], A[1], B[0], B[1], C[0], C[1]); };
    curve([-0.02, -0.006], [0.02, -0.006], [0.060, -0.020]);
    curve([0.072, -0.07], [0.07, -0.15], [0.036, -0.172]);
    curve([0.012, -0.18], [-0.012, -0.18], [-0.036, -0.172]);
    curve([-0.07, -0.15], [-0.072, -0.07], [-0.060, -0.020]);
    ctx.closePath();
  };
  pg(x); const gp = x.createLinearGradient(...P(0, -0.02), ...P(0, -0.18)); gp.addColorStop(0, '#3b2214'); gp.addColorStop(1, '#22120a'); x.fillStyle = gp; x.fill(); x.lineWidth = 4; x.strokeStyle = '#d9bd86'; x.stroke();
  x.save(); pg(x); x.clip(); for (let k = 0; k < 70; k++) { const yy = r() * H; x.strokeStyle = `rgba(0,0,0,${0.12 + r() * 0.22})`; x.lineWidth = 1 + r() * 2; x.beginPath(); x.moveTo(0, yy); x.lineTo(W, yy + (r() - 0.5) * 8); x.stroke(); }
  for (let k = 0; k < 40; k++) { x.fillStyle = `rgba(200,140,70,${0.05 + r() * 0.08})`; const [px, py] = P((r() - 0.5) * 0.12, -0.02 - r() * 0.15); x.beginPath(); x.ellipse(px, py, 8 + r() * 20, 3 + r() * 6, r() * 3, 0, 7); x.fill(); }
  x.restore();
  // قناع الشفافية: مصمت كله ما عدا فراغات الشمسيات
  xa.fillStyle = '#fff'; xa.fillRect(0, 0, W, H);
  for (const rs of ROSES) {
    const [px, py] = P(rs.x, rs.y), R = rs.r * S;
    // الحلقة الزخرفية حول الشمسية (على قوام اللون)
    x.save(); x.translate(px, py);
    x.beginPath(); x.arc(0, 0, R + 12, 0, Math.PI * 2); x.fillStyle = '#2a160a'; x.fill();
    x.beginPath(); x.arc(0, 0, R + 8, 0, Math.PI * 2); x.fillStyle = '#efdcaa'; x.fill();
    for (let k = 0; k < 36; k++) { const an = k / 36 * Math.PI * 2; x.fillStyle = k % 2 ? '#2a160a' : '#b78a4a'; x.beginPath(); x.arc(Math.cos(an) * (R + 4), Math.sin(an) * (R + 4), 2.3, 0, 7); x.fill(); }
    x.beginPath(); x.arc(0, 0, R + 1, 0, Math.PI * 2); x.fillStyle = '#d7b47a'; x.fill();
    x.strokeStyle = '#c9a466'; x.lineCap = 'round'; x.save(); x.beginPath(); x.arc(0, 0, R, 0, 7); x.clip(); rosetteLattice(x, R, rs.rings, 2); x.restore();
    x.restore();
    // القناع: الدائرة فراغ (أسود) ثم يُرسم النقش أبيض (خشب)
    xa.save(); xa.translate(px, py); xa.beginPath(); xa.arc(0, 0, R, 0, Math.PI * 2); xa.fillStyle = '#000'; xa.fill();
    xa.strokeStyle = '#fff'; xa.lineCap = 'round'; xa.save(); xa.beginPath(); xa.arc(0, 0, R, 0, 7); xa.clip(); rosetteLattice(xa, R, rs.rings, 2); xa.restore();
    xa.lineWidth = 4; xa.beginPath(); xa.arc(0, 0, R - 1.5, 0, Math.PI * 2); xa.stroke(); xa.restore();
  }
  return { color: c, alpha: a };
}
function texEbony(w = 256, h = 1024, seed = 3) {
  const c = cnv(w, h), x = c.getContext('2d'), r = rng(seed); x.fillStyle = '#17100b'; x.fillRect(0, 0, w, h);
  for (let k = 0; k < 120; k++) { const xx = r() * w; x.strokeStyle = `rgba(70,45,30,${0.08 + r() * 0.18})`; x.lineWidth = 0.6 + r() * 2; x.beginPath(); x.moveTo(xx, 0); x.lineTo(xx + (r() - 0.5) * 10, h); x.stroke(); }
  return c;
}
function texWood(base, dark, w = 512, h = 512, seed = 5) {
  const c = cnv(w, h), x = c.getContext('2d'), r = rng(seed); x.fillStyle = base; x.fillRect(0, 0, w, h);
  for (let k = 0; k < 90; k++) { const yy = r() * h; x.strokeStyle = dark.replace('A', (0.08 + r() * 0.2).toFixed(2)); x.lineWidth = 0.7 + r() * 2.2; x.beginPath(); x.moveTo(0, yy); for (let xx = 0; xx <= w; xx += 32) x.lineTo(xx, yy + Math.sin(xx * 0.02 + k) * 2.5); x.stroke(); }
  return c;
}

// ---------------------------------------------------------------- الحدود
export function oudOutline(n = 120) {
  const pts = [];
  for (let k = 0; k <= n; k++) { const u = k / n, y = OUD.yBot + (OUD.yJoint - OUD.yBot) * Math.pow(u, 1.35); pts.push([OUD.w(y), y]); }
  for (let k = n - 1; k >= 1; k--) { const u = k / n, y = OUD.yBot + (OUD.yJoint - OUD.yBot) * Math.pow(u, 1.35); pts.push([-OUD.w(y), y]); }
  return pts.reverse();
}

// ---------------------------------------------------------------- البناء
export function buildOud() {
  const root = new THREE.Group(); root.name = 'oud';
  const parts = {};                                        // part -> [meshes]
  const add = (mesh, part, name) => { mesh.name = name || part; mesh.userData.part = part; mesh.castShadow = true; mesh.receiveShadow = true; root.add(mesh); (parts[part] = parts[part] || []).push(mesh); return mesh; };
  const outline = oudOutline();
  const T = texFace(outline);
  const M = {
    bowl: new THREE.MeshPhysicalMaterial({ map: tex(texBowl()), bumpMap: tex(texBowlBump(), false), bumpScale: 1.2, roughness: 0.34, clearcoat: 0.7, clearcoatRoughness: 0.22 }),
    bowlIn: new THREE.MeshStandardMaterial({ color: 0x1c1108, roughness: 0.95 }),
    face: new THREE.MeshPhysicalMaterial({ map: tex(T.color), alphaMap: tex(T.alpha, false), alphaTest: 0.5, roughness: 0.48, clearcoat: 0.35, clearcoatRoughness: 0.35, side: THREE.DoubleSide }),
    binding: new THREE.MeshStandardMaterial({ color: 0xe8d5a6, roughness: 0.45 }),
    bindDark: new THREE.MeshStandardMaterial({ color: 0x2b170a, roughness: 0.5 }),
    ebony: new THREE.MeshPhysicalMaterial({ map: tex(texEbony()), roughness: 0.32, clearcoat: 0.4, clearcoatRoughness: 0.3 }),
    neck: new THREE.MeshPhysicalMaterial({ map: tex(texWood('#5a2f17', 'rgba(25,10,3,A)')), roughness: 0.33, clearcoat: 0.6, clearcoatRoughness: 0.25 }),
    bridge: new THREE.MeshPhysicalMaterial({ map: tex(texEbony(256, 256, 9)), color: 0xb08a70, roughness: 0.35, clearcoat: 0.4 }),
    bone: new THREE.MeshStandardMaterial({ color: 0xefe6d2, roughness: 0.38 }),
    peg: new THREE.MeshPhysicalMaterial({ map: tex(texEbony(128, 256, 13)), color: 0xc8a888, roughness: 0.3, clearcoat: 0.5 }),
    wound: new THREE.MeshStandardMaterial({ color: 0xcfd0d3, roughness: 0.3, metalness: 0.85 }),
    nylon: new THREE.MeshStandardMaterial({ color: 0xece5d2, roughness: 0.35, metalness: 0.0 }),
    hole: new THREE.MeshStandardMaterial({ color: 0x0d0805, roughness: 1 }),
  };
  for (const m of Object.values(M)) if (m.map) m.map.wrapS = m.map.wrapT = THREE.ClampToEdgeWrapping;

  // ---------- القصعة ----------
  const NU = 80, NV = 63;                                   // 63 = 21 ضلعًا × 3
  const yAt = (i) => OUD.yBot + (OUD.yJoint + 0.004 - OUD.yBot) * Math.pow(i / NU, 1.35);
  const bowlF = (i, j) => { const y = yAt(i), th = j / NV * Math.PI, w = OUD.w(y), d = OUD.d(y); return [w * Math.cos(th), y, -d * Math.sin(th) - 0.0012]; };
  add(new THREE.Mesh(gridGeo(NU, NV, bowlF, (i, j) => [i / NU, j / NV], true), M.bowl), 'bowl', 'bowl');
  const inner = new THREE.Mesh(gridGeo(NU, 24, (i, j) => { const y = yAt(i), th = j / 24 * Math.PI, w = OUD.w(y) * 0.985, d = OUD.d(y) * 0.985; return [w * Math.cos(th), y, -d * Math.sin(th) - 0.0035]; }), M.bowlIn);
  inner.userData.part = 'bowl'; root.add(inner);
  // ---------- الوجه ----------
  {
    const shape = new THREE.Shape(outline.map((p) => new THREE.Vector2(p[0], p[1])));
    const g = new THREE.ShapeGeometry(shape, 1);
    const pa = g.attributes.position, uv = new Float32Array(pa.count * 2);
    for (let i = 0; i < pa.count; i++) { uv[i * 2] = (pa.getX(i) - FACE_UV.x0) / FACE_UV.sx; uv[i * 2 + 1] = (pa.getY(i) - FACE_UV.y0) / FACE_UV.sy; }
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    add(new THREE.Mesh(g, M.face), 'face', 'face');
    // حافة الوجه (سُمك + شريط تطعيم)
    const band = gridGeo(outline.length, 1, (i, j) => { const p = outline[i % outline.length]; return [p[0] * (1 + 0.004), p[1], j ? -0.0030 : 0.0004]; });
    add(new THREE.Mesh(band, M.bindDark), 'face', 'face-edge');
    // حلقات الشمسيات البارزة قليلًا
    for (const rs of ROSES) { const t = new THREE.Mesh(new THREE.TorusGeometry(rs.r + 0.0006, 0.0009, 6, 64), M.binding); t.position.set(rs.x, rs.y, 0.0003); add(t, 'rose', 'rose-ring'); }
    // أقراص شفافة للتعرّف على الشمسيات (لا تُرى)
    for (const rs of ROSES) { const d = new THREE.Mesh(new THREE.CircleGeometry(rs.r, 32), new THREE.MeshBasicMaterial({ visible: false })); d.position.set(rs.x, rs.y, 0.0005); d.userData.pickOnly = true; add(d, 'rose', 'rose-pick'); }
    const pgPick = new THREE.Mesh(new THREE.ShapeGeometry(new THREE.Shape([[-0.06, -0.02], [0.06, -0.02], [0.07, -0.1], [0.036, -0.172], [-0.036, -0.172], [-0.07, -0.1]].map((p) => new THREE.Vector2(p[0], p[1])))), new THREE.MeshBasicMaterial({ visible: false }));
    pgPick.position.z = 0.0004; pgPick.userData.pickOnly = true; add(pgPick, 'raqma', 'raqma-pick');
  }
  // ---------- الزند (ظهر نصف دائري) ----------
  add(new THREE.Mesh(gridGeo(30, 24, (i, j) => { const y = OUD.yJoint - 0.035 + (OUD.yNut + 0.003 - OUD.yJoint + 0.035) * i / 30, th = j / 24 * Math.PI; return [OUD.neckW(y) * Math.cos(th), y, -0.0005 - OUD.neckD(y) * Math.sin(th)]; }, null, true), M.neck), 'neck', 'neck');
  // سطح الزند العلوي تحت لوحة الأصابع (يُغلق الفراغ بين حافتي نصف الدائرة)
  add(new THREE.Mesh(slabGeo([[OUD.neckW(OUD.yJoint), OUD.yJoint - 0.01], [OUD.neckW(OUD.yNut), OUD.yNut + 0.003], [-OUD.neckW(OUD.yNut), OUD.yNut + 0.003], [-OUD.neckW(OUD.yJoint), OUD.yJoint - 0.01]], () => -0.002, () => -0.0004), M.neck), 'neck', 'neck-top');
  // ---------- لوحة الأصابع ----------
  {
    const poly = [];
    for (let k = 0; k <= 24; k++) { const y = OUD.yFbEnd + (OUD.yNut - OUD.yFbEnd) * k / 24; poly.push([OUD.fbHalfW(y), y]); }
    for (let k = 24; k >= 0; k--) { const y = OUD.yFbEnd + (OUD.yNut - OUD.yFbEnd) * k / 24; poly.push([-OUD.fbHalfW(y), y]); }
    for (let k = 1; k < 12; k++) { const a = Math.PI * k / 12; poly.push([-OUD.fbHalfW(OUD.yFbEnd) * Math.cos(a), OUD.yFbEnd - 0.012 * Math.sin(a)]); }
    add(new THREE.Mesh(slabGeo(poly, () => 0.0002, (x, y) => OUD.fbTop(Math.max(y, OUD.yFbEnd)) - 0.00015 * (x / 0.03) ** 2), M.ebony), 'fingerboard', 'fingerboard');
  }
  // ---------- الأنف (العتبة) ----------
  {
    const g = new THREE.BoxGeometry(2 * OUD.fbHalfW(OUD.yNut) + 0.002, 0.005, OUD.zN - 0.0006 + 0.002);
    const m = new THREE.Mesh(g, M.bone); m.position.set(0, OUD.yNut + 0.0025, (OUD.zN - 0.0006 + 0.002) / 2 - 0.002); add(m, 'nut', 'nut');
  }
  // ---------- البنجق: منحنٍ إلى الخلف، جداران جانبيان وظهر ونهاية، و12 ملوى ----------
  const PB = { a: 55 * Math.PI / 180, len: 0.20, w0: 0.0225, w1: 0.016 };
  const pbO = new THREE.Vector3(0, OUD.yNut + 0.005, -0.004), pbDir = new THREE.Vector3(0, Math.cos(PB.a), -Math.sin(PB.a)).normalize();
  const pbN = new THREE.Vector3(1, 0, 0).cross(pbDir).normalize();          // عمودي على البنجق نحو جهته الأمامية (المفتوحة)
  const pbAt = (t, side, h) => pbO.clone().addScaledVector(pbDir, t * PB.len).add(new THREE.Vector3(side * (PB.w0 + (PB.w1 - PB.w0) * t), 0, 0)).addScaledVector(pbN, h);
  {
    const pb = new THREE.Group(); pb.name = 'pegbox';
    const wallT = 0.0045, H0 = 0.030, H1 = 0.022;
    const wall = (side) => gridGeo(20, 3, (i, j) => { const t = i / 20, h = H0 + (H1 - H0) * t; const hh = [-h * 0.55, -h * 0.55, h * 0.45, h * 0.45][j]; const s = [side * (PB.w0 + (PB.w1 - PB.w0) * t), side * (PB.w0 + (PB.w1 - PB.w0) * t - wallT), side * (PB.w0 + (PB.w1 - PB.w0) * t - wallT), side * (PB.w0 + (PB.w1 - PB.w0) * t)][j]; return pbO.clone().addScaledVector(pbDir, t * PB.len).add(new THREE.Vector3(s, 0, 0)).addScaledVector(pbN, hh).toArray(); });
    const wallM = new THREE.MeshPhysicalMaterial({ map: M.neck.map, roughness: 0.33, clearcoat: 0.6, side: THREE.DoubleSide });
    for (const s of [-1, 1]) add(new THREE.Mesh(wall(s), wallM), 'pegbox', 'pegbox-wall');
    // الجدار الخارجي الأملس لكل جانب (السطح الذي تمر منه الملاوي)
    for (const s of [-1, 1]) add(new THREE.Mesh(gridGeo(20, 1, (i, j) => { const t = i / 20, h = H0 + (H1 - H0) * t; return pbO.clone().addScaledVector(pbDir, t * PB.len).add(new THREE.Vector3(s * (PB.w0 + (PB.w1 - PB.w0) * t), 0, 0)).addScaledVector(pbN, j ? h * 0.45 : -h * 0.55).toArray(); }), new THREE.MeshPhysicalMaterial({ map: M.neck.map, roughness: 0.33, clearcoat: 0.6, side: THREE.DoubleSide })), 'pegbox', 'pegbox-side');
    // الظهر (قاعدة مستديرة) والنهاية المغلقة
    add(new THREE.Mesh(gridGeo(20, 12, (i, j) => { const t = i / 20, h = H0 + (H1 - H0) * t, w = PB.w0 + (PB.w1 - PB.w0) * t, th = Math.PI * j / 12; return pbO.clone().addScaledVector(pbDir, t * PB.len).add(new THREE.Vector3(w * Math.cos(th), 0, 0)).addScaledVector(pbN, -h * 0.55 - 0.006 * Math.sin(th)).toArray(); }, null, true), M.neck), 'pegbox', 'pegbox-back');
    const endC = pbO.clone().addScaledVector(pbDir, PB.len);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), M.neck); cap.scale.set(PB.w1 + 0.001, 0.012, H1 * 0.55); cap.position.copy(endC); cap.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), pbDir); add(cap, 'pegbox', 'pegbox-end');
    // قاعدة البنجق عند الأنف (وصلة بالزند)
    add(new THREE.Mesh(gridGeo(8, 16, (i, j) => { const t = i / 8, y = OUD.yNut - 0.004 + 0.012 * t, th = Math.PI * j / 16, w = OUD.neckW(OUD.yNut) * (1 - 0.1 * t), d = OUD.neckD(OUD.yNut) * (1 - 0.2 * t); return [w * Math.cos(th), y, -0.0005 - d * Math.sin(th) - 0.004 * t]; }, null, true), M.neck), 'pegbox', 'pegbox-heel');
    void pb;
  }
  const pegs = [];
  {
    for (let row = 0; row < 6; row++) for (const s of [-1, 1]) {
      const t = 0.17 + row * 0.13 + (s > 0 ? 0.035 : 0);
      const c = pbAt(t, 0, 0.002), wOut = PB.w0 + (PB.w1 - PB.w0) * t;
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.0028, 0.0035, 2 * wOut + 0.016, 10), M.peg); shaft.rotation.z = Math.PI / 2; shaft.position.copy(c).add(new THREE.Vector3(s * 0.004, 0, 0)); add(shaft, 'pegs', 'peg-shaft');
      const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.0052, 0.0045, 0.006, 12), M.peg); collar.rotation.z = Math.PI / 2; collar.position.copy(c).add(new THREE.Vector3(s * (wOut + 0.005), 0, 0)); add(collar, 'pegs', 'peg-collar');
      const head = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), M.peg); head.scale.set(0.011, 0.0058, 0.0135); head.position.copy(c).add(new THREE.Vector3(s * (wOut + 0.0175), 0, 0));
      head.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), pbN); add(head, 'pegs', 'peg-head');
      pegs.push({ row, side: s, c: c.clone(), t });
    }
  }
  // ---------- الفرس ----------
  {
    const bw = 0.15, bd = 0.017, bh = OUD.zB + 0.0004;
    const poly = [];
    // جسم مستطيل بطرفين زخرفيين منحنيين (شكل الفرس العربي)
    for (let k = 0; k <= 16; k++) { const u = k / 16, x = -bw / 2 + bw * u, wing = Math.pow(Math.abs(u - 0.5) * 2, 3); poly.push([x, OUD.yBridge - bd / 2 - 0.003 * wing]); }
    for (let k = 16; k >= 0; k--) { const u = k / 16, x = -bw / 2 + bw * u, wing = Math.pow(Math.abs(u - 0.5) * 2, 3); poly.push([x, OUD.yBridge + bd / 2 - 0.006 * wing]); }
    add(new THREE.Mesh(slabGeo(poly, () => 0.0001, (x) => bh * (1 - 0.55 * Math.pow(Math.min(1, Math.abs(x) / (bw / 2)), 4))), M.bridge), 'bridge', 'bridge');
    // ثقوب ربط الأوتار (نقاط داكنة على الوجه الأمامي للفرس)
    for (const c of COURSES) for (let k = 0; k < (c.index === 0 ? 1 : 2); k++) { const h = new THREE.Mesh(new THREE.CylinderGeometry(0.0009, 0.0009, 0.0012, 8), M.hole); h.rotation.x = Math.PI / 2; h.position.set(OUD.stringX(c.index, k, false), OUD.yBridge + bd / 2 - 0.0003, OUD.zB - 0.0028); h.rotation.set(0, 0, 0); h.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 1, 0)); add(h, 'bridge', 'bridge-hole'); }
  }

  // ---------- الأوتار ----------
  // كل وتر: [عُقدة على الفرس → (نقطة الضغط إن وُجدت) → الأنف] جزء مهتز، ثم [الأنف → الملوى] ثابت
  const strings = [];
  {
    const pegFor = (c, k) => {                    // الأزواج الأحدّ أقرب إلى الأنف؛ الزوج على جانبين متقابلين
      const row = 5 - c;                         // الكردان (5) في الصف الأول، القرار (0) في الأخير
      const side = c === 0 ? -1 : (k ? 1 : -1);
      return pegs.find((p) => p.row === row && p.side === side) || pegs[0];
    };
    for (const c of COURSES) for (let k = 0; k < (c.index === 0 ? 1 : 2); k++) {
      const radius = c.index < 3 ? 0.00058 - c.index * 0.00005 : 0.00042 - (c.index - 3) * 0.00003;
      const mat = c.index < 3 ? M.wound : M.nylon;
      const vib = new Strand(40, radius, mat), fix = new Strand(6, radius, mat);
      vib.mesh.userData.part = 'strings'; vib.mesh.userData.course = c.index; fix.mesh.userData.part = 'strings';
      root.add(vib.mesh); root.add(fix.mesh); (parts.strings = parts.strings || []).push(vib.mesh, fix.mesh);
      const pg = pegFor(c.index, k);
      const a = new THREE.Vector3(OUD.stringX(c.index, k, false), OUD.yBridge + 0.0075, OUD.zB);
      const b = new THREE.Vector3(OUD.stringX(c.index, k, true), OUD.yNut + 0.0015, OUD.zN);
      const shaftX = pg.side * 0.0035 + (c.index - 2.5) * 0.0008;
      const end = new THREE.Vector3(shaftX, pg.c.y, pg.c.z).addScaledVector(pbN, 0.0035);
      const fixPts = []; for (let i = 0; i <= 6; i++) { const t = i / 6; fixPts.push(new THREE.Vector3().lerpVectors(b, end, t).addScaledVector(pbN, 0.004 * Math.sin(Math.PI * t) * 0)); }
      fix.set(fixPts);
      const s = { course: c.index, k, vib, fix, a, b, radius, press: null, amp: 0, t: 0, phase: Math.random() * 6, f: 31 + c.index * 4 + k * 1.7, dirty: true };
      strings.push(s);
    }
  }
  const tmp = []; for (let i = 0; i <= 40; i++) tmp.push(new THREE.Vector3());
  function layoutString(s) {
    // نقطة الضغط: الوتر يلامس سطح لوحة الأصابع عند موضع الإصبع (نصف قطر الوتر فوقه)
    const a = s.a, b = s.b, n = 40;
    let p = null;
    if (s.press != null) { const y = s.press, x = OUD.xAt(s.course, s.k, y); p = new THREE.Vector3(x, y, OUD.fbTop(y) + s.radius + 0.00005); }
    const yp = p ? p.y : b.y, vlen = yp - a.y;
    for (let i = 0; i <= n; i++) {
      const u = i / n, y = a.y + (b.y - a.y) * u, pt = tmp[i];
      if (p && y > p.y) { const w = (y - p.y) / (b.y - p.y); pt.lerpVectors(p, b, w); }
      else if (p) { const w = (y - a.y) / (p.y - a.y); pt.lerpVectors(a, p, w); }
      else pt.lerpVectors(a, b, u);
      if (s.amp > 1e-6 && y <= yp) {                    // اهتزاز الجزء الحر فقط (من الفرس إلى نقطة الضغط)
        const m = Math.sin(Math.PI * Math.max(0, Math.min(1, (y - a.y) / vlen)));
        pt.x += s.amp * m * Math.sin(s.phase); pt.z += s.amp * 0.35 * m * Math.cos(s.phase * 1.07);
      }
    }
    s.vib.set(tmp); s.dirty = false;
  }
  strings.forEach(layoutString);

  // ---------- علامات موضع الضغط (وسيلة تعليمية) ----------
  // حلقة ذهبية رفيعة على لوحة الأصابع حول موضع الإصبع الضاغط (أو عند الأنف للوتر المطلق) ما دامت النغمة ترنّ،
  // ليرى الطالب أين يقع الموضع بالضبط حتى حين يحجبه الإصبع أو تكون الكاميرا بعيدة. تُعطَّل بإضافة ?nomark إلى الرابط.
  const marks = [];
  if (!(typeof location !== 'undefined' && new URLSearchParams(location.search).has('nomark'))) {
    for (const c of COURSES) {
      const g = new THREE.Group(); g.visible = false; g.userData.pickOnly = true;
      const mat = new THREE.MeshBasicMaterial({ color: 0xffcf4a, transparent: true, opacity: 0, depthWrite: false, toneMapped: false });
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.0074, 0.00065, 6, 40), mat); ring.userData.pickOnly = true; ring.raycast = () => {};
      const dot = new THREE.Mesh(new THREE.CircleGeometry(0.0074, 32), new THREE.MeshBasicMaterial({ color: 0xffcf4a, transparent: true, opacity: 0, depthWrite: false, toneMapped: false })); dot.raycast = () => {};
      g.add(ring, dot); root.add(g);
      marks.push({ g, ring, dot, on: false, a: 0, y: null });
    }
  }
  function setMark(course, y) {                   // y محلي لموضع النغمة، أو 'open' للوتر المطلق، أو null للإطفاء
    const m = marks[course]; if (!m) return;
    if (y == null) { m.on = false; return; }
    const open = y === 'open', yy = open ? OUD.yNut - 0.0045 : y;
    m.on = true; m.g.position.set(OUD.courseX(course, yy), yy, OUD.fbTop(yy) + 0.0005); m.g.scale.setScalar(open ? 0.62 : 1); m.g.visible = true;
  }
  function updateMarks(dt) {
    for (const m of marks) { if (!m.g.visible) continue; m.a += ((m.on ? 1 : 0) - m.a) * (1 - Math.exp(-dt / (m.on ? 0.03 : 0.12))); m.ring.material.opacity = 0.95 * m.a; m.dot.material.opacity = 0.16 * m.a; if (!m.on && m.a < 0.01) { m.g.visible = false; m.a = 0; } }
  }

  // ---------- واجهة الاستعمال ----------
  const api = {
    root, parts, strings, OUD, M, pbAt, pegs,
    /** ضغط مجموعة (وتر أو زوج) عند موضع y محلي، أو null للإطلاق */
    setPress(course, y) { for (const s of strings) if (s.course === course && s.press !== y) { s.press = y; s.dirty = true; } },
    pressOf(course) { const s = strings.find((q) => q.course === course); return s ? s.press : null; },
    /** نقر مجموعة: يبدأ اهتزازها (السعة تتبع قوة الريشة) */
    pluck(course, vel = 0.7) { for (const s of strings) if (s.course === course) { s.amp = 0.0007 + 0.0009 * vel; s.t = 0; s.dirty = true; } },
    damp(course) { for (const s of strings) if (s.course === course) s.decay = 0.05; },
    setMark, marks,
    update(dt) {
      updateMarks(dt);
      for (const s of strings) {
        if (s.amp > 1e-6) { s.t += dt; s.phase += dt * s.f * Math.PI * 2; const tau = s.decay || (0.35 + (5 - s.course) * 0.08); s.amp *= Math.exp(-dt / tau); if (s.amp < 2e-6) { s.amp = 0; s.decay = 0; } s.dirty = true; }
        if (s.dirty) layoutString(s);
      }
    },
    // نقاط مرجعية محلية
    stopPoint(course, semis) { const y = semis > 0 ? OUD.stopY(semis) : OUD.yNut; return new THREE.Vector3(OUD.courseX(course, y), y, semis > 0 ? OUD.fbTop(y) : OUD.zN); },
    stringPoint(course, y) { return new THREE.Vector3(OUD.courseX(course, y), y, OUD.zStr(y)); },
    toWorld(p) { return root.localToWorld(p.clone()); },
    dirWorld(d) { return d.clone().applyQuaternion(root.getWorldQuaternion(new THREE.Quaternion())).normalize(); },
  };
  root.traverse((o) => { if (o.isMesh && !o.userData.pickOnly) { o.frustumCulled = false; } });
  return api;
}

// ---------------------------------------------------------------- الريشة
// شريط رفيع مستدق من مادة كريمية (كما ريشة النسر التقليدية/البلاستيكية الحديثة)، طوله 12 سم.
// الإطار المحلي: y على امتداد الريشة من الطرف الضارب (y=0) نحو مؤخرتها، x عرضها، z سُمكها.
export const RISHA = { len: 0.12, w0: 0.0045, w1: 0.0078, t: 0.0012 };
// يبني هندسة الشريط على مسار (نقاط من الطرف الضارب إلى المؤخرة) بمحور عرض ثابت: الريشة مرنة تنثني داخل القبضة حول عرضها
export function shapeRisha(mesh, pts, wAx) {
  const S = [0]; for (let i = 1; i < pts.length; i++) S.push(S[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1], pts[i][2] - pts[i - 1][2]));
  const total = S[S.length - 1], n = 56, pos = [], idx = [];
  const half = (u) => (RISHA.w0 + (RISHA.w1 - RISHA.w0) * Math.min(1, u * 1.8)) / 2 * (u > 0.94 ? Math.sqrt(Math.max(0, 1 - ((u - 0.94) / 0.06) ** 2)) : 1);
  const at = (s) => { let k = 1; while (k < S.length - 1 && S[k] < s) k++; const t = (s - S[k - 1]) / Math.max(1e-9, S[k] - S[k - 1]), a = pts[k - 1], b = pts[k]; return [[a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t], [b[0] - a[0], b[1] - a[1], b[2] - a[2]]]; };
  for (let i = 0; i <= n; i++) {
    const u = i / n, [c, tg] = at(u * total), w = Math.max(0.0012, half(u)), tip = u < 0.04 ? 0.6 + 10 * u : 1, th = RISHA.t / 2 * tip;
    let nx = wAx[1] * tg[2] - wAx[2] * tg[1], ny = wAx[2] * tg[0] - wAx[0] * tg[2], nz = wAx[0] * tg[1] - wAx[1] * tg[0]; const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
    for (const [sw, sn] of [[-1, 1], [1, 1], [1, -1], [-1, -1]]) pos.push(c[0] + wAx[0] * w * sw + nx * th * sn, c[1] + wAx[1] * w * sw + ny * th * sn, c[2] + wAx[2] * w * sw + nz * th * sn);
  }
  for (let i = 0; i < n; i++) for (let s = 0; s < 4; s++) { const a = i * 4 + s, b = i * 4 + (s + 1) % 4, c = a + 4, d = b + 4; idx.push(a, b, c, b, d, c); }
  idx.push(0, 2, 1, 0, 3, 2); const e = n * 4; idx.push(e, e + 1, e + 2, e, e + 2, e + 3);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  if (mesh.geometry) mesh.geometry.dispose(); mesh.geometry = g;
}
export function buildRisha() {
  const m = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshPhysicalMaterial({ color: 0xeadfc4, roughness: 0.35, clearcoat: 0.5, side: THREE.DoubleSide }));
  shapeRisha(m, [[0, 0, 0], [0, RISHA.len, 0]], [1, 0, 0]);
  m.name = 'risha'; m.userData.part = 'risha'; m.castShadow = true; m.frustumCulled = false;
  return m;
}
