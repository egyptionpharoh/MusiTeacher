// =====================================================================
//  معالم «رحلة عُمان» (مبنية برمجيًا استلهامًا من الصور المرجعية التي زوّدنا بها المعلم — لا نماذج خارجية):
//   • برج الصحوة وميدانه: أربع دعامات بنية، لوحات زرقاء بنجمة ذهبية وساعة، شرفات وأبراج ركنية، مبانٍ بيضاء بأقواس ولوحات فسيفساء.
//   • سارية العلم الكبرى (الخوير)، السفينة الشراعية «شباب عُمان» بأشرعتها البيضاء والشعار الأحمر،
//     السفن الخشبية التقليدية (صور)، جسر خور البطح المعلّق، قلعة بأبراج دائرية، ميناء برافعات وسفينة شحن (الدقم)،
//     الجامع ذو المئذنة والقبة الزرقاوين (مطرح)، وفنار صور.
//  كل معلم: واجهته نحو ‎+X المحلي وأصله عند منتصف الواجهة على الأرض، ويمتد نحو ‎−X (بعيدًا عن الطريق).
// =====================================================================
import * as THREE from 'three';
import { FLAG_ASPECT, flagGeometry, clothMaterial } from './flag.js';
import { bendMaterial, dipMaterial, RAMP } from './bend.js';

function ctex(w, h, draw, rep) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  if (rep) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
const std = (o) => new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0, ...o });
const box = (w, h, d, m) => { const g = new THREE.BoxGeometry(w, h, d); g.translate(0, h / 2, 0); return new THREE.Mesh(g, m); };
const cyl = (r1, r2, h, m, seg = 16) => { const g = new THREE.CylinderGeometry(r1, r2, h, seg); g.translate(0, h / 2, 0); return new THREE.Mesh(g, m); };
const at = (o, x, y, z) => { o.position.set(x, y, z); return o; };

/** علم قماشي يرفرف (مع انحناء العالم) — top: ارتفاع أعلى العلم */
function cloth(U, L, top, key) {
  const y0 = top - L / FLAG_ASPECT;
  const tmp = bendMaterial(new THREE.MeshStandardMaterial());
  const m = clothMaterial(U, { L, y0, bendWrap: tmp.onBeforeCompile, key }); m.userData.bent = true;
  const f = new THREE.Mesh(flagGeometry(L, y0, 26, 10), m); f.userData.keep = true; f.frustumCulled = false;
  return f;
}
/** حلقة شرفات (مسننات) حول برج دائري */
function crown(G, x, y, z, r, n, m, s = 0.5) { for (let k = 0; k < n; k++) { const a = (k / n) * Math.PI * 2; const b = box(s, s * 1.3, s, m); b.rotation.y = -a; at(b, x + Math.cos(a) * r, y, z + Math.sin(a) * r); G.add(b); } }
/** صف شرفات على امتداد جدار */
function merlons(G, x0, z0, x1, z1, y, n, m, s = 0.6) { for (let k = 0; k < n; k++) { const f = (k + 0.5) / n; G.add(at(box(s, s * 1.2, s, m), x0 + (x1 - x0) * f, y, z0 + (z1 - z0) * f)); } }

// ---------------------------------------------------------------- برج الصحوة
function sahwaFace(x, w, h) {
  x.fillStyle = '#7b4a3c'; x.fillRect(0, 0, w, h);
  for (let i = 0; i < 1500; i++) { x.fillStyle = `rgba(40,20,15,${Math.random() * 0.08})`; x.fillRect(Math.random() * w, Math.random() * h, 3, 3); }
  x.fillStyle = '#6d3f33'; x.fillRect(0, 0, w * 0.2, h); x.fillRect(w * 0.8, 0, w * 0.2, h);          // الدعامتان
  x.fillStyle = '#e9c45a'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = `800 ${h * 0.115}px Cairo, Tahoma, Arial`; x.fillText('برج الصحوة', w / 2, h * 0.1);
  const L = w * 0.21, R = w * 0.79, top = h * 0.2, sh = h * 0.52;
  const arch = () => { x.beginPath(); x.moveTo(L, h); x.lineTo(L, sh); x.quadraticCurveTo(L + 6, top + 60, w / 2, top); x.quadraticCurveTo(R - 6, top + 60, R, sh); x.lineTo(R, h); x.closePath(); };
  arch(); x.fillStyle = '#27489c'; x.fill();
  x.save(); arch(); x.clip(); x.strokeStyle = 'rgba(120,160,235,.35)'; x.lineWidth = 1.5;
  for (let i = -h; i < w + h; i += 18) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i + h, h); x.stroke(); x.beginPath(); x.moveTo(i, h); x.lineTo(i + h, 0); x.stroke(); }
  x.restore();
  arch(); x.strokeStyle = '#d7b24f'; x.lineWidth = 6; x.stroke();
  const cx = w / 2, cy = h * 0.66, r = w * 0.17;
  x.fillStyle = '#d9b44f'; for (const a of [0, Math.PI / 4]) { x.save(); x.translate(cx, cy); x.rotate(a); x.fillRect(-r, -r, r * 2, r * 2); x.restore(); }
  x.fillStyle = '#1f3c86'; for (const a of [0, Math.PI / 4]) { x.save(); x.translate(cx, cy); x.rotate(a); x.fillRect(-r * 0.86, -r * 0.86, r * 1.72, r * 1.72); x.restore(); }
  x.fillStyle = '#f7f4ea'; x.beginPath(); x.arc(cx, cy, r * 0.66, 0, Math.PI * 2); x.fill(); x.strokeStyle = '#d7b24f'; x.lineWidth = 5; x.stroke();
  x.strokeStyle = '#2a2a2a'; x.lineWidth = 3; for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; x.beginPath(); x.moveTo(cx + Math.cos(a) * r * 0.52, cy + Math.sin(a) * r * 0.52); x.lineTo(cx + Math.cos(a) * r * 0.6, cy + Math.sin(a) * r * 0.6); x.stroke(); }
  x.lineWidth = 5; x.lineCap = 'round'; x.beginPath(); x.moveTo(cx, cy); x.lineTo(cx + r * 0.3, cy - r * 0.25); x.moveTo(cx, cy); x.lineTo(cx - r * 0.12, cy - r * 0.45); x.stroke();
  x.fillStyle = '#e7c34f'; x.fillRect(L, h - 10, R - L, 10);
}
/** لوحة جدارية ملوّنة (تجريدية: بحر وسفينة ونخيل وقلعة) داخل إطار — ليست نسخة من جداريات الميدان الأصلية */
function muralTex(seed) {
  return ctex(256, 128, (x, w, h) => {
    x.fillStyle = '#efe6d3'; x.fillRect(0, 0, w, h);
    const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#7fc1e8'); g.addColorStop(0.55, '#e9d59a'); g.addColorStop(1, '#2f8f9f');
    x.beginPath(); x.moveTo(28, h - 14); x.lineTo(28, 40); x.quadraticCurveTo(w / 2, -6, w - 28, 40); x.lineTo(w - 28, h - 14); x.closePath(); x.save(); x.clip(); x.fillStyle = g; x.fillRect(0, 0, w, h);
    const cols = ['#b5552f', '#2e7d4f', '#d9a441', '#7b4a2a', '#f4efe2'];
    for (let i = 0; i < 9; i++) { const v = Math.sin(seed * 9.1 + i * 3.7) * 0.5 + 0.5, px = 40 + ((i * 53 + seed * 31) % 180), py = 50 + v * 40; x.fillStyle = cols[(i + seed) % cols.length]; if (i % 3 === 0) { x.fillRect(px, py, 26, 22); x.fillRect(px + 8, py - 8, 10, 8); } else if (i % 3 === 1) { x.beginPath(); x.moveTo(px, py + 20); x.lineTo(px + 34, py + 20); x.lineTo(px + 26, py + 30); x.lineTo(px + 6, py + 30); x.closePath(); x.fill(); x.fillStyle = '#f4efe2'; x.beginPath(); x.moveTo(px + 16, py - 8); x.lineTo(px + 16, py + 18); x.lineTo(px + 32, py + 18); x.closePath(); x.fill(); } else { x.fillRect(px + 5, py, 3, 30); x.beginPath(); x.arc(px + 6, py, 11, 0, Math.PI * 2); x.fill(); } }
    x.restore(); x.strokeStyle = '#c9a868'; x.lineWidth = 4; x.stroke();
  });
}
function archDoorTex() {
  return ctex(128, 128, (x, w, h) => {
    x.fillStyle = '#efe6d3'; x.fillRect(0, 0, w, h);
    x.fillStyle = '#5b4636'; x.beginPath(); x.moveTo(44, h); x.lineTo(44, 62); x.quadraticCurveTo(46, 34, 64, 26); x.quadraticCurveTo(82, 34, 84, 62); x.lineTo(84, h); x.closePath(); x.fill();
    x.strokeStyle = '#d8c9a8'; x.lineWidth = 3; x.stroke();
  });
}
export function sahwaTower(U, centered = false) {
  const G = new THREE.Group(); G.name = 'sahwa';
  const cx = centered ? 0 : -40, W = 15, P = 3.4, Ht = 42, top = 13.5;
  const brown = std({ color: 0x74453a, roughness: 0.8 }), cream = std({ color: 0xefe6d3 }), creamD = std({ color: 0xe0d3b8 });
  // الميدان: عشب، ساحة مبلّطة، حلقة زهور، أحزمة شجيرات
  const disc = (r, col, y) => { const m = new THREE.Mesh(new THREE.CircleGeometry(r, 48), std({ color: col, roughness: 1 })); m.rotation.x = -Math.PI / 2; return at(m, cx, y, 0); };
  G.add(disc(38, 0x5aa03f, 0.05), disc(25, 0xe4d9c2, 0.08));
  const ring = new THREE.Mesh(new THREE.RingGeometry(35.5, 37.6, 48), std({ color: 0xc23fa0, roughness: 1 })); ring.rotation.x = -Math.PI / 2; G.add(at(ring, cx, 0.1, 0));
  if (centered) {            // طريق الدوّار المحيط بالميدان (أسفلت + حافة صفراء/سوداء)
    const ringRoad = new THREE.Mesh(new THREE.RingGeometry(38.5, 44.6, 72), std({ color: 0x2b2d31, roughness: 0.95 })); ringRoad.rotation.x = -Math.PI / 2; G.add(at(ringRoad, cx, 0.14, 0));
    const kt = ctex(64, 8, (x) => { x.fillStyle = '#f2c21b'; x.fillRect(0, 0, 32, 8); x.fillStyle = '#1b1b1b'; x.fillRect(32, 0, 32, 8); }, true); kt.repeat.set(60, 1);
    const kerb = new THREE.Mesh(new THREE.CylinderGeometry(38.5, 38.5, 0.3, 72, 1, true), new THREE.MeshStandardMaterial({ map: kt, roughness: 0.8, side: THREE.DoubleSide })); G.add(at(kerb, cx, 0.16, 0));
  }
  const hedge = std({ color: 0x2f6a2c, roughness: 1 });
  for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2 + 0.26; const b = box(9, 0.5, 0.5, hedge); b.rotation.y = -a; G.add(at(b, cx + Math.cos(a) * 30.5, 0, Math.sin(a) * 30.5)); }
  // الدعامات الأربع والعمود الأوسط
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) G.add(at(box(P, Ht - top, P, brown), cx + sx * (W - P) / 2, 0, sz * (W - P) / 2));
  G.add(at(box(2.8, Ht - top, 2.8, cream), cx, 0, 0));
  for (let k = 0; k < 4; k++) G.add(at(box(0.9, 1.6, 0.05, std({ color: 0x3a2c22 })), cx + 1.42, 6 + k * 5, 0));
  // الجزء العلوي: اللوحات الأربع (القوس الأزرق والنجمة والساعة واسم البرج)
  const face = new THREE.MeshStandardMaterial({ map: ctex(512, 512, sahwaFace), roughness: 0.7 });
  const under = std({ color: 0xe3c24e });
  const head = new THREE.Mesh(new THREE.BoxGeometry(W, top, W), [face, face, brown, under, face, face]); G.add(at(head, cx, Ht - top / 2, 0));
  const band = box(W + 0.7, 1.5, W + 0.7, brown); G.add(at(band, cx, Ht, 0));
  for (const s of [-1, 1]) { merlons(G, cx - W / 2, s * (W / 2 + 0.1), cx + W / 2, s * (W / 2 + 0.1), Ht + 1.5, 9, brown, 0.75); merlons(G, cx + s * (W / 2 + 0.1), -W / 2, cx + s * (W / 2 + 0.1), W / 2, Ht + 1.5, 9, brown, 0.75); }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const x = cx + sx * W / 2, z = sz * W / 2; G.add(at(cyl(1.75, 1.75, 6.8, brown, 14), x, Ht - 3.4, z)); G.add(at(cyl(2.0, 1.75, 0.8, brown, 14), x, Ht - 4.2, z)); crown(G, x, Ht + 3.4, z, 1.5, 8, brown, 0.55); }
  // مباني الميدان البيضاء: أجنحة بأقواس مدببة، لوحات جدارية، وأبراج دائرية قصيرة بشرفات
  const door = new THREE.MeshStandardMaterial({ map: archDoorTex(), roughness: 0.9 });
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2, mural = k % 2 === 0;
    const sideM = mural ? new THREE.MeshStandardMaterial({ map: muralTex(k + 1), roughness: 0.8 }) : door;
    const b = new THREE.Mesh(new THREE.BoxGeometry(mural ? 5 : 6, mural ? 5.2 : 6.2, mural ? 11 : 7).translate(0, mural ? 2.6 : 3.1, 0), [sideM, cream, creamD, cream, cream, cream]);
    b.rotation.y = -a; G.add(at(b, cx + Math.cos(a) * 20, 0, Math.sin(a) * 20));
    const a2 = a + Math.PI / 8, tx = cx + Math.cos(a2) * 23.5, tz = Math.sin(a2) * 23.5;
    G.add(at(cyl(1.9, 2.1, 4.4, cream, 14), tx, 0, tz)); crown(G, tx, 4.4, tz, 1.65, 8, cream, 0.5);
  }
  G.add(at(box(8, 3.2, 8, cream), cx, 0, 0));
  // علمان على ساريتين
  const pm = std({ color: 0xd7dce2, metalness: 0.8, roughness: 0.3 });
  for (const s of [-1, 1]) { G.add(at(cyl(0.09, 0.13, 15, pm, 8), cx + 12, 0, s * 27)); if (U) G.add(at(cloth(U, 3.6, 14.8, 'bend1-cloth-36'), cx + 12, 0, s * 27)); }
  G.userData.half = centered ? 46 : 40; G.userData.depth = 80; G.userData.lookY = 22;
  return G;
}

// ---------------------------------------------------------------- سارية العلم الكبرى (الخوير)
export function giantFlagpole(U) {
  const G = new THREE.Group(); G.name = 'flagpole';
  const Hp = 54, L = 27;
  const steel = std({ color: 0xe9ecef, metalness: 0.7, roughness: 0.3 }), stone = std({ color: 0xe6dcc6 });
  G.add(at(cyl(15, 15, 0.5, stone, 40), -16, 0, 0)); G.add(at(cyl(9, 10, 1.2, std({ color: 0xd9ccb0 }), 32), -16, 0.5, 0)); G.add(at(cyl(3, 3.6, 1.6, stone, 24), -16, 1.7, 0));
  const lawn = new THREE.Mesh(new THREE.RingGeometry(10.2, 14.2, 40), std({ color: 0x5aa03f, roughness: 1 })); lawn.rotation.x = -Math.PI / 2; G.add(at(lawn, -16, 0.53, 0));
  G.add(at(cyl(0.55, 1.25, Hp, steel, 20), -16, 3.3, 0)); G.add(at(new THREE.Mesh(new THREE.SphereGeometry(1.1, 16, 12), std({ color: 0xd9b44f, metalness: 0.85, roughness: 0.3 })), -16, Hp + 3.9, 0));
  // ريح أقوى قليلًا للعلم الكبير حتى تظهر رفرفته بوضوح من بعيد
  if (U) G.add(at(cloth({ uT: U.uT, uWind: { value: 1 } }, L, Hp + 2.6, 'bend1-cloth-giant'), -15.6, 0, 0));
  G.userData.half = 17; G.userData.depth = 32; G.userData.lookY = Hp - 8;
  return G;
}

// ---------------------------------------------------------------- السفن
/** هيكل سفينة من مسقط أفقي: المقدمة نحو ‎−Z */
function hullGeo(len, beam, height, bow = 0.34, stern = 0.12) {
  const s = new THREE.Shape(), h = len / 2, b = beam / 2;
  s.moveTo(0, h); s.quadraticCurveTo(b * 1.02, h - len * bow * 0.55, b, h - len * bow); s.lineTo(b, -h + len * stern); s.quadraticCurveTo(b * 0.95, -h, 0, -h);
  s.quadraticCurveTo(-b * 0.95, -h, -b, -h + len * stern); s.lineTo(-b, h - len * bow); s.quadraticCurveTo(-b * 1.02, h - len * bow * 0.55, 0, h);
  const g = new THREE.ExtrudeGeometry(s, { depth: height, bevelEnabled: false, curveSegments: 10 }); g.rotateX(-Math.PI / 2);
  return g;
}
let EMB = null;
/** شعار السلطنة بالأحمر كما على أشرعة السفينة: ظلّ ملوّن من الصورة الرسمية نفسها (الشكل بلا أي تغيير) */
function emblemRed() {
  if (EMB) return EMB;
  const c = document.createElement('canvas'); c.width = 512; c.height = 512; const x = c.getContext('2d');
  EMB = new THREE.CanvasTexture(c); EMB.colorSpace = THREE.SRGBColorSpace;
  const img = new Image();
  img.onload = () => { const k = Math.min(480 / img.width, 480 / img.height), w = img.width * k, h = img.height * k; x.drawImage(img, (512 - w) / 2, (512 - h) / 2, w, h); x.globalCompositeOperation = 'source-in'; x.fillStyle = '#cf1f2c'; x.fillRect(0, 0, 512, 512); EMB.needsUpdate = true; };
  img.src = './assets/img/landmarks/oman-emblem.png';
  return EMB;
}
function sailGeo(w, h, belly) {
  const g = new THREE.PlaneGeometry(w, h, 8, 4), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const u = p.getX(i) / w + 0.5, v = p.getY(i) / h + 0.5; p.setZ(i, -Math.sin(Math.PI * u) * (0.35 + 0.65 * Math.sin(Math.PI * v)) * belly); }
  g.computeVertexNormals(); return g;
}
/** السفينة الشراعية «شباب عُمان»: ثلاث صوارٍ بأشرعة مربعة بيضاء عليها الشعار بالأحمر، هيكل أبيض بخط أخضر */
export function tallShip() {
  const G = new THREE.Group(); G.name = 'ship';
  const white = std({ color: 0xf6f4ee, roughness: 0.6 }), sail = std({ color: 0xfbfaf5, roughness: 0.9, side: THREE.DoubleSide }), wood = std({ color: 0x8a6a45 }), spar = std({ color: 0xcdb48a, roughness: 0.6 });
  const X = -6, LEN = 62;
  G.add(at(new THREE.Mesh(hullGeo(LEN, 9.4, 5.6), white), X, -1.2, 0));
  G.add(at(new THREE.Mesh(hullGeo(LEN + 0.15, 9.55, 0.9), std({ color: 0x9c2222 })), X, -0.5, 0));
  G.add(at(new THREE.Mesh(hullGeo(LEN + 0.15, 9.55, 0.22), std({ color: 0x1f7a4d })), X, 3.5, 0));
  G.add(at(new THREE.Mesh(hullGeo(LEN - 2.5, 8.2, 0.25), wood), X, 4.3, 0));
  G.add(at(box(4.4, 2.3, 9, white), X, 4.5, 17)); G.add(at(box(3.6, 1.9, 5, white), X, 4.5, -2));
  const bs = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.34, 17, 8), spar); bs.rotation.x = Math.PI / 2 - 0.22; G.add(at(bs, X, 6.6, -LEN / 2 - 4.5));
  const emb = new THREE.MeshBasicMaterial({ map: emblemRed(), alphaTest: 0.4, side: THREE.DoubleSide, toneMapped: false });
  const masts = [[-15, 41], [1.5, 45], [17, 39]], Ws = [15.5, 14, 12.5, 10.5, 8.5], Hs = [8.4, 7.6, 6.8, 5.6, 4.6];
  masts.forEach(([z, hm], mi) => {
    G.add(at(cyl(0.22, 0.42, hm, spar, 10), X, 4.4, z));
    let y = 10.5;
    for (let k = 0; k < 5; k++) {
      const w = Ws[k] * (mi === 2 ? 0.92 : 1), h = Hs[k], S = new THREE.Group();
      S.add(new THREE.Mesh(sailGeo(w, h, 1.5), sail));
      const yard = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, w + 1.2, 6), spar); yard.rotation.z = Math.PI / 2; yard.position.y = h / 2 + 0.1; S.add(yard);
      if (k === 1 || (k === 3 && mi < 2)) { const e = Math.min(w, h) * 0.78; const d = new THREE.Mesh(sailGeo(e, e, 1.5 * e / w), emb); d.position.z = 0.0; d.scale.z = 1; d.position.set(0, 0, 0); const p = d.geometry.attributes.position; for (let i = 0; i < p.count; i++) { const u = (p.getX(i) / w) + 0.5, v = p.getY(i) / h + 0.5; p.setZ(i, -Math.sin(Math.PI * u) * (0.35 + 0.65 * Math.sin(Math.PI * v)) * 1.5 - 0.12); } S.add(d); const d2 = d.clone(); d2.position.z = 0.24; S.add(d2); }
      S.rotation.y = 0.5; at(S, X, y + h / 2, z); G.add(S); y += h + 0.5;
    }
  });
  // الأشرعة المثلثة الأمامية وشراع المؤخرة (على امتداد السفينة فتُرى من الجانب)
  const tri = (pts) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts.flat(), 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1], 2)); g.computeVertexNormals(); return new THREE.Mesh(g, sail); };
  for (let k = 0; k < 3; k++) G.add(tri([[X, 8.2 + k * 0.6, -LEN / 2 - 10 + k * 4.5], [X, 7.5, -17 + k * 0.3], [X, 36 - k * 7, -15.2]]));
  G.add(tri([[X, 8, 19], [X, 8, 30], [X, 26, 18]]));
  G.userData.half = 36; G.userData.depth = 12;
  return G;
}
/** سفينة خشبية تقليدية (صور). onLand: على الشاطئ فوق دعامات خشبية (ورشة صناعة السفن) بلا شراع */
export function dhow(onLand = false) {
  const G = new THREE.Group(); G.name = 'dhow';
  const wood = std({ color: 0x6b4226, roughness: 0.9 }), woodL = std({ color: 0x9a6a3c }), sail = std({ color: 0xf3ead2, roughness: 0.95, side: THREE.DoubleSide });
  const X = onLand ? -5 : -4, Y = onLand ? 1.3 : -1.0, LEN = 24;
  G.add(at(new THREE.Mesh(hullGeo(LEN, 6, 3.6, 0.42, 0.1), wood), X, Y, 0));
  G.add(at(new THREE.Mesh(hullGeo(LEN + 0.1, 6.1, 0.3, 0.42, 0.1), woodL), X, Y + 3.0, 0));
  G.add(at(new THREE.Mesh(hullGeo(LEN - 1.4, 5.2, 0.15, 0.42, 0.1), woodL), X, Y + 3.5, 0));
  G.add(at(box(5.4, 1.7, 5.6, wood), X, Y + 3.6, LEN / 2 - 3.4)); G.add(at(box(5.6, 0.18, 5.9, woodL), X, Y + 5.3, LEN / 2 - 3.4));
  const stem = new THREE.Mesh(new THREE.BoxGeometry(0.4, 5.5, 0.5), wood); stem.rotation.x = 0.75; G.add(at(stem, X, Y + 3.8, -LEN / 2 - 0.6));
  if (onLand) {
    for (const s of [-1, 1]) for (let k = 0; k < 5; k++) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 4.2, 6), woodL); p.rotation.z = s * 0.55; G.add(at(p, X + s * 3.6, 1.7, -8 + k * 4)); }
    for (let k = 0; k < 4; k++) G.add(at(box(6.4, 0.5, 0.5, woodL), X, 0.8, -7 + k * 4.6));
    for (let k = 0; k < 3; k++) G.add(at(box(0.5, 0.25, 4.5, woodL), 1.5 + k * 0.7, 0.25 * k, 8));
  } else {
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, 14, 8), woodL); mast.rotation.x = -0.12; G.add(at(mast, X, Y + 10.2, -2));
    const yard = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 22, 6), woodL); yard.rotation.x = Math.PI / 2 - 0.62; G.add(at(yard, X + 0.25, Y + 13.6, -1));
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([X + 0.3, Y + 7.3, -9.9, X + 0.3, Y + 19.9, 7.9, X + 0.9, Y + 5.2, 8.5], 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 1, 1, 0], 2)); g.computeVertexNormals(); G.add(new THREE.Mesh(g, sail));
  }
  G.userData.half = 15; G.userData.depth = 10;
  return G;
}

// ---------------------------------------------------------------- جسر خور البطح المعلّق (صور)
//  للطريق مقطع ارتفاع حقيقي (انظر bend.js): صعود تدريجي ٧٠ م حتى ارتفاع ٧٫٥ م، ثم سطح مستوٍ ١٢٠ م فوق الماء على ركائز،
//  ثم هبوط تدريجي ٧٠ م إلى مستوى الطريق. أجزاء الجسر هنا مبنية عند مستوى الطريق والمظلِّل يرفعها مع المقطع.
export function suspBridge(roadW, waterColor = 0x1f9fb4) {
  const G = new THREE.Group(); G.name = 'bridge';
  const conc = std({ color: 0xa7abae, roughness: 0.7 }), steel = std({ color: 0x8e959b, metalness: 0.5, roughness: 0.4 }), cream = std({ color: 0xe6dcc4, roughness: 0.8 });
  const xw = roadW / 2 + 6.6, zt = 40, Ht = 25, end = 78, HALF = 60, LEN = (HALF + RAMP) * 2 + 4;
  // بلاطة الجسر وركائزه وحاجزاه الجانبيان
  G.add(at(box(xw * 2 + 1.8, 1.4, LEN, conc), 0, -1.52, 0));
  for (let k = -4; k <= 4; k++) G.add(at(box(xw * 2 - 2, 12, 2.2, conc), 0, -13.5, k * 28));
  for (const sx of [-1, 1]) {
    G.add(at(box(0.42, 0.95, LEN, cream), sx * (xw - 0.45), -0.12, 0));
    G.add(at(box(0.1, 0.1, LEN, steel), sx * (xw - 0.85), 1.05, 0));
  }
  // الأبراج والكابلات
  for (const sz of [-1, 1]) {
    for (const sx of [-1, 1]) G.add(at(box(1.7, Ht + 10, 2.4, conc), sx * xw, -10, sz * zt));
    G.add(at(box(xw * 2 + 1.7, 1.5, 1.8, conc), 0, Ht - 1.5, sz * zt)); G.add(at(box(xw * 2, 1.1, 1.4, conc), 0, Ht - 7.5, sz * zt));
  }
  for (const sx of [-1, 1]) {
    const pts = []; for (let k = 0; k <= 16; k++) { const z = -zt + (k / 16) * zt * 2, f = z / zt; pts.push(new THREE.Vector3(sx * xw, 5.5 + (Ht - 5.5) * f * f, z)); }
    G.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 32, 0.2, 6), steel));
    for (const sz of [-1, 1]) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, Math.hypot(end - zt, Ht - 2.2), 6), steel); c.rotation.x = sz * Math.atan2(end - zt, Ht - 2.2); G.add(at(c, sx * xw, (Ht + 2.2) / 2, sz * (zt + end) / 2)); }
    for (let k = -6; k <= 6; k++) { const z = k * 5.6, f = z / zt, y = 5.5 + (Ht - 5.5) * f * f; G.add(at(cyl(0.06, 0.06, y - 0.9, steel, 5), sx * xw, 0.9, z)); }
  }
  // سطح الماء تحت الجسر (يظهر حيث تنخفض الأرض عنه)
  const w = new THREE.Mesh(new THREE.PlaneGeometry(1300, (HALF + 36) * 2, 30, 8), dipMaterial(new THREE.MeshPhysicalMaterial({ color: waterColor, roughness: 0.14, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.1 })));
  w.rotation.x = -Math.PI / 2; w.userData.keep = true; G.add(at(w, 0, -0.75, 0));
  G.userData.half = HALF + RAMP; G.userData.depth = 200; G.userData.dip = { half: HALF, depth: 7.5 }; G.userData.lookY = 4;
  return G;
}

// ---------------------------------------------------------------- بوابة مسقط (بين مسقط القديمة ومطرح): الطريق يمر من تحت قوسيها
export function muscatGate(roadW) {
  const G = new THREE.Group(); G.name = 'gate';
  const stoneT = ctex(256, 256, (x, w, h) => {
    x.fillStyle = '#d8c3a5'; x.fillRect(0, 0, w, h);
    const cols = ['#d9c4a6', '#cdb596', '#e0cdb2', '#c9ad92', '#d4b9a4'];
    for (let r = 0; r < 8; r++) for (let c = -1; c < 5; c++) { const bw = 64, bx = c * bw + (r % 2 ? 32 : 0); x.fillStyle = cols[(r * 3 + c * 5 + 7) % cols.length]; x.fillRect(bx + 1, r * 32 + 1, bw - 2, 30); }
  }, true);
  const rep = (u, v) => { const t = stoneT.clone(); t.needsUpdate = true; t.repeat.set(u, v); return new THREE.MeshStandardMaterial({ map: t, roughness: 0.9 }); };
  const stone = rep(3, 2), cream = std({ color: 0xece0c6, roughness: 0.85 }), dark = std({ color: 0x3a2c22 });
  const half = roadW / 2 + 0.7, D = 7, HA = 9.2, HT = 16;
  // لوح القوسين (فتحتان مدببتان فوق نصفي الطريق)
  const sh = new THREE.Shape(); sh.moveTo(-half, 0); sh.lineTo(half, 0); sh.lineTo(half, HA); sh.lineTo(-half, HA); sh.closePath();
  for (const [x0, x1] of [[-half + 0.5, -0.55], [0.55, half - 0.5]]) {
    const m = (x0 + x1) / 2, hole = new THREE.Path();
    hole.moveTo(x0, 0); hole.lineTo(x0, 5.4); hole.quadraticCurveTo(x0 + 0.15, 7.5, m, 8.5); hole.quadraticCurveTo(x1 - 0.15, 7.5, x1, 5.4); hole.lineTo(x1, 0); hole.closePath(); sh.holes.push(hole);
  }
  const panel = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: D, bevelEnabled: false, curveSegments: 10 }), cream); G.add(at(panel, 0, 0, -D / 2));
  // الجزء العلوي: صف النوافذ المقوّسة والشرفات
  const faceT = ctex(1024, 256, (x, w, h) => {
    x.fillStyle = '#d8c3a5'; x.fillRect(0, 0, w, h);
    const cols = ['#d9c4a6', '#cdb596', '#e0cdb2', '#c9ad92'];
    for (let r = 0; r < 8; r++) for (let c = -1; c < 17; c++) { x.fillStyle = cols[(r * 3 + c * 5 + 9) % cols.length]; x.fillRect(c * 64 + (r % 2 ? 32 : 0) + 1, r * 32 + 1, 62, 30); }
    for (let k = 0; k < 8; k++) { const cx = 96 + k * 119; x.fillStyle = '#c4a98a'; x.fillRect(cx - 34, 40, 68, 120); x.fillStyle = '#2f2823'; x.beginPath(); x.moveTo(cx - 20, 150); x.lineTo(cx - 20, 92); x.quadraticCurveTo(cx - 19, 66, cx, 58); x.quadraticCurveTo(cx + 19, 66, cx + 20, 92); x.lineTo(cx + 20, 150); x.closePath(); x.fill(); x.fillStyle = '#efe7d6'; x.fillRect(cx - 20, 112, 40, 38); x.strokeStyle = '#8f8676'; x.lineWidth = 2; for (let g = 1; g < 4; g++) { x.beginPath(); x.moveTo(cx - 20 + g * 10, 112); x.lineTo(cx - 20 + g * 10, 150); x.stroke(); } x.fillStyle = '#2f2823'; x.fillRect(cx - 7, 196, 14, 18); }
  });
  const faceM = new THREE.MeshStandardMaterial({ map: faceT, roughness: 0.9 });
  const top = new THREE.Mesh(new THREE.BoxGeometry(half * 2, HT - HA, D).translate(0, (HT - HA) / 2, 0), [stone, stone, stone, stone, faceM, faceM]); G.add(at(top, 0, HA, 0));
  for (const s of [-1, 1]) merlons(G, -half, s * (D / 2 - 0.3), half, s * (D / 2 - 0.3), HT, 15, cream, 0.7);
  // البرجان الدائريان وفوق كل منهما برج صغير وسارية
  for (const sx of [-1, 1]) {
    const x = sx * (half + 4.2);
    const tw = cyl(4.4, 4.9, 20, rep(4, 3), 22); G.add(at(tw, x, 0, 0)); crown(G, x, 20, 0, 4.1, 16, cream, 0.75);
    G.add(at(cyl(2.3, 2.3, 3.4, rep(2, 1), 16), x, 20, 0)); crown(G, x, 23.4, 0, 2.05, 10, cream, 0.5);
    G.add(at(cyl(0.07, 0.1, 11, std({ color: 0xe9ecef, metalness: 0.6, roughness: 0.3 }), 6), x, 23.4, 0));
    for (let k = 0; k < 3; k++) G.add(at(box(0.4, 1.5, 0.08, dark), x + (k - 1) * 1.5, 14.5, 4.2 + (k === 1 ? 0.25 : -0.2)));
    // الجدار الجانبي المنخفض وبابه
    G.add(at(box(8, 9.5, 3.4, rep(2, 2)), sx * (half + 12), 0, 0)); merlons(G, sx * (half + 8.2), 1.5, sx * (half + 15.8), 1.5, 9.5, 6, cream, 0.65);
    const door = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 3.4), dark); G.add(at(door, sx * (half + 12.5), 1.7, 1.72));
  }
  G.userData.half = 10; G.userData.depth = 60;
  return G;
}

// ---------------------------------------------------------------- لوحة طريق وطنية: صورة رسمية داخل إطار على قائمين، مائلة نحو القادم على الطريق
export function billboard(imgTex, aspect, side = -1) {
  const G = new THREE.Group(); G.name = 'billboard';
  const H = aspect > 1.9 ? 4.6 : 5.4, W = H * aspect, y0 = 4.4;
  const steel = std({ color: 0x7d858d, metalness: 0.5, roughness: 0.5 }), white = std({ color: 0xf6f3ea, roughness: 0.6 }), gold = std({ color: 0xc9a23f, metalness: 0.75, roughness: 0.35 });
  const P = new THREE.Group();
  for (const s of [-1, 1]) P.add(at(box(0.34, y0 + H, 0.34, steel), -0.3, 0, s * (W / 2 - 0.9)));
  P.add(at(box(0.3, H + 0.7, W + 0.7, white), 0, y0 - 0.35, 0));
  for (const s of [-1, 1]) { P.add(at(box(0.36, 0.12, W + 0.76, gold), 0, s > 0 ? y0 + H + 0.26 : y0 - 0.35, 0)); P.add(at(box(0.36, H + 0.7, 0.12, gold), 0, y0 - 0.35, s * (W / 2 + 0.32))); }
  const pic = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshBasicMaterial({ map: imgTex, toneMapped: false })); pic.rotation.y = Math.PI / 2; P.add(at(pic, 0.16, y0 + H / 2, 0));
  // شريط بألوان العلم أسفل اللوحة
  [0xdb161b, 0xffffff, 0x008000].forEach((c, k) => P.add(at(box(0.32, 0.16, (W + 0.7) / 3, std({ color: c })), 0, y0 - 0.62, ((k - 1) * (W + 0.7)) / 3)));
  P.rotation.y = side > 0 ? 0.95 : -0.95; P.position.x = -W * 0.42;
  G.add(P);
  G.userData.half = W * 0.5 + 1; G.userData.depth = W;
  return G;
}

// ---------------------------------------------------------------- قلعة بأبراج دائرية وشرفات وعلم
export function fortCastle(U) {
  const G = new THREE.Group(); G.name = 'castle';
  const mud = std({ color: 0xd59c63, roughness: 0.95 }), mudD = std({ color: 0xc48a52, roughness: 0.95 });
  const S = 26, cx = -S / 2 - 5, Hw = 8;
  for (const s of [-1, 1]) { G.add(at(box(1.6, Hw, S, mud), cx + s * S / 2, 0, 0)); G.add(at(box(S, Hw, 1.6, mud), cx, 0, s * S / 2)); merlons(G, cx + s * S / 2, -S / 2 + 5, cx + s * S / 2, S / 2 - 5, Hw, 9, mud, 0.8); merlons(G, cx - S / 2 + 5, s * S / 2, cx + S / 2 - 5, s * S / 2, Hw, 9, mud, 0.8); }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const x = cx + sx * S / 2, z = sz * S / 2, big = sx < 0 && sz < 0, h = big ? 14.5 : 11.5; G.add(at(cyl(4.3, 5.0, h, mudD, 20), x, 0, z)); crown(G, x, h, z, 3.9, 14, mudD, 0.8); G.add(at(box(0.1, 1.2, 0.6, std({ color: 0x3a2618 })), x + sx * 0 + 4.5 * (sx > 0 ? 1 : 0), h - 4, z)); }
  G.add(at(box(0.12, 4.2, 2.6, std({ color: 0x4a2f1b })), cx + S / 2 + 0.82, 0, 4));
  G.add(at(cyl(0.1, 0.14, 19, std({ color: 0xe6e9ec, metalness: 0.7, roughness: 0.3 }), 8), cx + 4, 0, -2)); if (U) G.add(at(cloth(U, 4.2, 18.8, 'bend1-cloth-42'), cx + 4, 0, -2));
  G.userData.half = S / 2 + 7; G.userData.depth = S + 10;
  return G;
}

// ---------------------------------------------------------------- ميناء: رصيف ورافعات جسرية وسفينة حاويات (الدقم / صحار)
export function portCranes() {
  const G = new THREE.Group(); G.name = 'port';
  const conc = std({ color: 0xbfbcb2 }), blue = std({ color: 0x1f5fae, roughness: 0.6 }), yel = std({ color: 0xf2b21b, roughness: 0.6 }), white = std({ color: 0xf2f2ee });
  G.add(at(box(34, 2.6, 190, conc), -17, -1.6, 0));
  for (let k = -1; k <= 1; k++) {
    const z = k * 52, C = new THREE.Group();
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) C.add(at(box(1.3, 30, 1.3, blue), sx * 7, 0, sz * 8));
    for (const sz of [-1, 1]) { C.add(at(box(15.3, 1.3, 1.3, blue), 0, 14, sz * 8)); C.add(at(box(15.3, 1.3, 1.3, blue), 0, 29, sz * 8)); }
    for (const sx of [-1, 1]) C.add(at(box(1.3, 1.3, 17.3, blue), sx * 7, 29, 0));
    C.add(at(box(58, 2, 2.4, yel), -14, 30.3, 0)); C.add(at(box(1.2, 11, 1.2, blue), 2, 31, 0));
    const stay = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 38, 5), blue); stay.rotation.z = -1.29; C.add(at(stay, -16, 36.6, 0));
    C.add(at(box(4, 3, 4, white), 0, 26, 0));
    at(C, -14, 1, z); G.add(C);
  }
  const X = -47;
  G.add(at(new THREE.Mesh(hullGeo(150, 22, 9, 0.2, 0.06), std({ color: 0x1d3557, roughness: 0.6 })), X, -1.4, 0));
  G.add(at(new THREE.Mesh(hullGeo(150.2, 22.2, 1.4, 0.2, 0.06), std({ color: 0x9c2222 })), X, -0.8, 0));
  G.add(at(box(18, 16, 12, white), X, 7.6, 58)); G.add(at(box(22, 2, 6, white), X, 23.6, 56)); G.add(at(cyl(1.6, 1.9, 6, std({ color: 0xf2b21b }), 12), X, 25.6, 62));
  const cols = [0xc0392b, 0x2e86c1, 0x27ae60, 0xe67e22, 0x7f8c8d].map((c) => std({ color: c, roughness: 0.7 }));
  let n = 0; for (let iz = 0; iz < 9; iz++) for (let ix = 0; ix < 3; ix++) { const hN = 1 + ((iz * 7 + ix * 3) % 3); for (let iy = 0; iy < hN; iy++) G.add(at(box(6, 2.6, 11.4, cols[(n++ * 3 + iz) % cols.length]), X + (ix - 1) * 6.4, 7.6 + iy * 2.7, -58 + iz * 12)); }
  G.userData.half = 100; G.userData.depth = 70;
  return G;
}

// ---------------------------------------------------------------- جامع بمئذنة وقبة مكسوّتين بالفسيفساء الزرقاء (كورنيش مطرح)
export function blueMosque() {
  const G = new THREE.Group(); G.name = 'blueMosque';
  const white = std({ color: 0xf7f4ec }), tile = new THREE.MeshStandardMaterial({ roughness: 0.5, map: ctex(256, 256, (x, w, h) => {
    x.fillStyle = '#2f8fc4'; x.fillRect(0, 0, w, h); x.strokeStyle = '#bfe6f5'; x.lineWidth = 3;
    for (let i = -h; i < w + h; i += 32) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i + h, h); x.stroke(); x.beginPath(); x.moveTo(i, h); x.lineTo(i + h, 0); x.stroke(); }
    x.fillStyle = '#1b5fa0'; for (let yy = 16; yy < h; yy += 32) for (let xx = 16; xx < w; xx += 32) { x.beginPath(); x.arc(xx, yy, 5, 0, Math.PI * 2); x.fill(); }
  }, true) });
  tile.map.repeat.set(3, 2);
  G.add(at(box(11, 8, 16, white), -6, 0, 0)); merlons(G, -0.6, -8, -0.6, 8, 8, 12, white, 0.6);
  for (let k = -2; k <= 2; k++) G.add(at(box(0.1, 3.4, 1.5, std({ color: 0x2f6f9f })), -0.45, 2.6, k * 3));
  G.add(at(cyl(4.6, 4.6, 1.6, white, 24), -6.5, 8, -2));
  const dome = new THREE.Mesh(new THREE.SphereGeometry(4.5, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2), tile); dome.scale.y = 1.2; G.add(at(dome, -6.5, 9.6, -2));
  G.add(at(cyl(0.12, 0.12, 2, std({ color: 0xd9b44f, metalness: 0.8, roughness: 0.3 }), 6), -6.5, 14.8, -2));
  const mx = -3, mz = 10.5;
  G.add(at(box(3.4, 5, 3.4, white), mx, 0, mz)); G.add(at(cyl(1.25, 1.45, 17, tile, 16), mx, 5, mz)); G.add(at(cyl(2.0, 1.4, 0.7, white, 16), mx, 22, mz)); crown(G, mx, 22.7, mz, 1.8, 10, white, 0.35);
  G.add(at(cyl(1.0, 1.0, 3.6, tile, 14), mx, 22.7, mz)); const cap = new THREE.Mesh(new THREE.SphereGeometry(1.15, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), tile); cap.scale.y = 1.4; G.add(at(cap, mx, 26.3, mz));
  G.userData.half = 13; G.userData.depth = 14;
  return G;
}
/** فنار أبيض مستدير بشرفة (فنار العيجة في صور) على قاعدة صخرية */
export function lighthouse() {
  const G = new THREE.Group(); G.name = 'lighthouse';
  const white = std({ color: 0xf6f3ea }), rock = new THREE.MeshStandardMaterial({ color: 0x8c7a66, roughness: 1, flatShading: true });
  const r = new THREE.Mesh(new THREE.DodecahedronGeometry(6, 1), rock); r.scale.set(1.3, 0.45, 1.6); G.add(at(r, -6, 0.4, 0));
  G.add(at(cyl(2.0, 2.8, 13, white, 18), -6, 2.2, 0)); G.add(at(cyl(2.6, 2.0, 0.6, white, 18), -6, 15.2, 0)); crown(G, -6, 15.8, 0, 2.3, 12, white, 0.4);
  G.add(at(cyl(1.0, 1.0, 2.2, std({ color: 0xbfe3f0, roughness: 0.2, metalness: 0.3 }), 12), -6, 15.8, 0)); const cap = new THREE.Mesh(new THREE.ConeGeometry(1.3, 1.4, 12), std({ color: 0xb23a2e })); G.add(at(cap, -6, 18.7, 0));
  G.userData.half = 9; G.userData.depth = 12;
  return G;
}

// ---------------------------------------------------------------- سفينة سياحية راسية على رصيف ميناء السلطان قابوس (مطرح) — بلا أي اسم أو علامة تجارية
export function cruiseShip() {
  const G = new THREE.Group(); G.name = 'cruise';
  const white = std({ color: 0xf7f7f3, roughness: 0.55 }), conc = std({ color: 0xbfbcb2 }), navy = std({ color: 0x1d3557, roughness: 0.6 });
  const winT = (rep) => { const t = ctex(256, 64, (x, w, h) => { x.fillStyle = '#f7f7f3'; x.fillRect(0, 0, w, h); x.fillStyle = '#24476f'; for (let k = 0; k < 8; k++) x.fillRect(6 + k * 32, 18, 22, 26); }, true); t.repeat.set(rep, 1); return new THREE.MeshStandardMaterial({ map: t, roughness: 0.5 }); };
  G.add(at(box(24, 2.8, 210, conc), -12, -1.8, 0));
  const X = -38, LEN = 172;
  G.add(at(new THREE.Mesh(hullGeo(LEN, 24, 12.5, 0.17, 0.05), white), X, -1.5, 0));
  G.add(at(new THREE.Mesh(hullGeo(LEN + 0.2, 24.2, 1.3, 0.17, 0.05), navy), X, -0.9, 0));
  const decks = [[150, 21.5, 3.2, 6], [142, 20.5, 3.2, 8], [132, 19.5, 3.2, 12], [116, 18, 3.2, 18], [92, 15, 3, 26]];
  let y = 11;
  decks.forEach(([L, B, Hd, back]) => { const m = winT(Math.round(L / 9)); const d = new THREE.Mesh(new THREE.BoxGeometry(B, Hd, L).translate(0, Hd / 2, 0), [m, m, white, white, white, white]); G.add(at(d, X, y, back - 6)); y += Hd; });
  G.add(at(box(17, 2.6, 9, std({ color: 0x24476f, roughness: 0.3, metalness: 0.4 })), X, y - 5.6, -LEN / 2 + 36));
  const fun = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 4.2, 8.5, 14), navy); fun.scale.z = 1.7; G.add(at(fun, X, y + 4.2, 40));
  G.add(at(cyl(0.3, 0.4, 9, white, 8), X, y, -20));
  const boat = std({ color: 0xf08a24, roughness: 0.6 });
  for (let k = -5; k <= 5; k++) G.add(at(box(2.6, 1.7, 8.4, boat), X + 12.2, 8.2, k * 12));
  G.userData.half = 110; G.userData.depth = 60;
  return G;
}
