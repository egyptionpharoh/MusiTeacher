// =====================================================================
//  مبنى وزارة التعليم (السيب) — معلم وطني ومؤسسي، مبني برمجيًا استلهامًا من الصور المرجعية التي زوّدنا بها المعلم:
//  كتلة وسطى مرتفعة ببوابة حجرية كبيرة وباب مقوّس بنّي وزجاج أزرق، شريط نوافذ مقوّسة أعلاها، لوحة «وزارة التعليم»،
//  شريطان زجاجيان طويلان على الجانبين، قبة بيضاء فوقها سارية العلم، وجناحان بخمسة طوابق (أقواس مروحية زرقاء،
//  صف نوافذ بعقود مدببة، نوافذ مجمّعة، وقاعدة بنية بأقواس)، ودرج عريض أمام المدخل.
//  الواجهة نحو ‎+X المحلي (جهة الطريق) والأصل عند منتصف مقدمة الدرج على الأرض.
// =====================================================================
import * as THREE from 'three';
import { FLAG_ASPECT, flagGeometry, clothMaterial } from './flag.js';
import { bendMaterial } from './bend.js';

const CREAM = '#e9dcc2', CREAM_L = '#f1e7d2', CREAM_D = '#d9c9aa', BROWN = '#a2533c', BLUE = '#2b62b0', GLASS = '#1d3f73';
function ctex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
const std = (o) => new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0, ...o });
const at = (o, x, y, z) => { o.position.set(x, y, z); return o; };
const box = (w, h, d, m) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0), m);

/** نافذة بعقد مدبب */
function archWin(x, cx, y, w, h, fill = GLASS, frame = CREAM_D) {
  x.fillStyle = frame; x.fillRect(cx - w / 2 - 3, y - 4, w + 6, h + 6);
  x.fillStyle = fill; x.beginPath(); x.moveTo(cx - w / 2, y + h); x.lineTo(cx - w / 2, y + h * 0.4); x.quadraticCurveTo(cx - w / 2, y + h * 0.08, cx, y); x.quadraticCurveTo(cx + w / 2, y + h * 0.08, cx + w / 2, y + h * 0.4); x.lineTo(cx + w / 2, y + h); x.closePath(); x.fill();
}
/** قوس مروحي أزرق بأضلاع بيضاء */
function fan(x, cx, y, w, h) {
  x.fillStyle = CREAM_D; x.fillRect(cx - w / 2 - 5, y - 6, w + 10, h + 10);
  x.fillStyle = BLUE; x.beginPath(); x.moveTo(cx - w / 2, y + h); x.quadraticCurveTo(cx - w / 2, y + h * 0.15, cx, y); x.quadraticCurveTo(cx + w / 2, y + h * 0.15, cx + w / 2, y + h); x.closePath(); x.fill();
  x.strokeStyle = 'rgba(255,255,255,.85)'; x.lineWidth = 2;
  for (let k = 1; k < 6; k++) { const a = Math.PI * (k / 6); x.beginPath(); x.moveTo(cx, y + h); x.lineTo(cx - Math.cos(a) * w * 0.47, y + h - Math.sin(a) * h * 0.92); x.stroke(); }
  x.beginPath(); x.arc(cx, y + h, w * 0.2, Math.PI, 0); x.stroke();
}
function speckle(x, w, h) { for (let i = 0; i < 900; i++) { x.fillStyle = `rgba(${Math.random() > 0.5 ? 255 : 110},${Math.random() > 0.5 ? 250 : 95},${Math.random() > 0.5 ? 235 : 70},0.05)`; x.fillRect(Math.random() * w, Math.random() * h, 3, 3); } }

function wingFace(x, w, h) {
  x.fillStyle = CREAM; x.fillRect(0, 0, w, h); speckle(x, w, h);
  x.fillStyle = CREAM_D; x.fillRect(0, 0, w, 10); for (let k = 0; k < 26; k++) { x.fillStyle = '#b9a98a'; x.fillRect(14 + k * 19, 22, 9, 6); }
  x.strokeStyle = BROWN; x.lineWidth = 3; x.strokeRect(22, 44, w - 44, 96);
  for (let k = 0; k < 5; k++) fan(x, 70 + k * 93, 62, 66, 60);
  for (let k = 0; k < 10; k++) { archWin(x, 46 + k * 46.6, 158, 24, 26, CREAM_D, CREAM_D); x.fillStyle = GLASS; x.fillRect(35 + k * 46.6, 186, 22, 30); x.fillStyle = '#f4f0e6'; x.fillRect(45 + k * 46.6, 186, 2, 30); }
  x.fillStyle = CREAM_D; x.fillRect(18, 226, w - 36, 5);
  for (let k = 0; k < 10; k++) { x.fillStyle = GLASS; x.fillRect(35 + k * 46.6, 250, 22, 28); x.fillStyle = '#f4f0e6'; x.fillRect(45 + k * 46.6, 250, 2, 28); }
  x.fillStyle = CREAM_D; x.fillRect(18, 296, w - 36, 5);
  for (const yy of [322, 388]) for (let g = 0; g < 4; g++) for (let k = 0; k < 4; k++) { x.fillStyle = BLUE; x.fillRect(70 + g * 96 + k * 19, yy, 14, 36); }
  x.fillStyle = BROWN; x.fillRect(0, 448, w, h - 448); x.fillStyle = '#8c4532'; x.fillRect(0, 448, w, 5);
  for (let k = 0; k < 4; k++) { x.fillStyle = k === 1 || k === 2 ? CREAM_L : '#c9d6ea'; const cx = 90 + k * 110; x.beginPath(); x.moveTo(cx - 30, h); x.lineTo(cx - 30, 478); x.quadraticCurveTo(cx, 458, cx + 30, 478); x.lineTo(cx + 30, h); x.closePath(); x.fill(); }
}
function centerFace(x, w, h) {
  x.fillStyle = CREAM; x.fillRect(0, 0, w, h); speckle(x, w, h);
  for (let k = 0; k < 30; k++) { x.fillStyle = BROWN; x.beginPath(); x.moveTo(8 + k * 17, 0); x.lineTo(16 + k * 17, 12); x.lineTo(0 + k * 17, 12); x.closePath(); x.fill(); }
  // الشريط العلوي: نوافذ مقوّسة صغيرة وقوس مروحي في الوسط
  x.fillStyle = CREAM_L; x.fillRect(96, 44, w - 192, 96); x.strokeStyle = BROWN; x.lineWidth = 4; x.strokeRect(96, 44, w - 192, 96);
  for (let k = 0; k < 6; k++) { archWin(x, 124 + k * 21, 70, 12, 44, BLUE); archWin(x, w - 124 - k * 21, 70, 12, 44, BLUE); }
  fan(x, w / 2, 62, 62, 58);
  // الشريطان الزجاجيان الطويلان داخل إطار بنّي
  for (const cx of [48, w - 48]) { x.fillStyle = BROWN; x.fillRect(cx - 30, 150, 60, 300); archWin(x, cx, 162, 46, 280, BLUE, BROWN); x.strokeStyle = 'rgba(255,255,255,.75)'; x.lineWidth = 2; for (let yy = 200; yy < 440; yy += 26) { x.beginPath(); x.moveTo(cx - 23, yy); x.lineTo(cx + 23, yy); x.stroke(); } x.beginPath(); x.moveTo(cx, 170); x.lineTo(cx, 442); x.stroke(); x.fillStyle = CREAM_D; x.fillRect(cx - 28, 470, 56, 150); }
  // البوابة الحجرية الكبيرة
  x.fillStyle = CREAM_L; x.beginPath(); x.moveTo(104, h); x.lineTo(118, 158); x.lineTo(w - 118, 158); x.lineTo(w - 104, h); x.closePath(); x.fill(); x.strokeStyle = CREAM_D; x.lineWidth = 3; x.stroke();
  // اللوحة: «وزارة التعليم»
  x.fillStyle = '#e7c66d'; x.fillRect(w / 2 - 92, 168, 184, 46); x.strokeStyle = '#b8923a'; x.lineWidth = 2; x.strokeRect(w / 2 - 92, 168, 184, 46);
  x.fillStyle = '#3a2a16'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = '800 24px Cairo, Tahoma, Arial'; x.fillText('وزارة التعليم', w / 2, 184); x.font = '700 11px Arial'; x.fillText('Ministry of Education', w / 2, 204);
  // التجويف الداخلي: دوائر زخرفية، شرفة بأربع نوافذ، ثم الباب المقوّس
  x.fillStyle = CREAM; x.fillRect(150, 228, w - 300, h - 228); x.strokeStyle = CREAM_D; x.strokeRect(150, 228, w - 300, h - 228);
  for (let k = 0; k < 5; k++) { x.fillStyle = '#b08a4a'; x.beginPath(); x.arc(w / 2 - 56 + k * 28, 246, 6, 0, Math.PI * 2); x.fill(); x.fillStyle = CREAM; x.beginPath(); x.arc(w / 2 - 56 + k * 28, 246, 3, 0, Math.PI * 2); x.fill(); }
  for (let k = 0; k < 4; k++) archWin(x, w / 2 - 39 + k * 26, 268, 16, 40, BLUE);
  x.fillStyle = CREAM_D; x.fillRect(w / 2 - 62, 312, 124, 14);
  x.fillStyle = BROWN; x.beginPath(); x.moveTo(w / 2 - 62, h); x.lineTo(w / 2 - 62, 420); x.quadraticCurveTo(w / 2 - 60, 372, w / 2, 366); x.quadraticCurveTo(w / 2 + 60, 372, w / 2 + 62, 420); x.lineTo(w / 2 + 62, h); x.closePath(); x.fill();
  x.fillStyle = '#5a2c20'; x.fillRect(w / 2 - 50, 392, 100, h - 392);
  x.fillStyle = BLUE; x.fillRect(w / 2 - 24, 404, 48, 120); x.strokeStyle = '#d9b44f'; x.lineWidth = 2; x.strokeRect(w / 2 - 24, 404, 48, 120);
  x.fillStyle = '#7a3d2b'; x.fillRect(w / 2 - 34, 548, 68, h - 548);
  for (const [dx, dy] of [[-92, 404], [92, 404], [-92, 512], [92, 512]]) { x.save(); x.translate(w / 2 + dx, dy); x.rotate(Math.PI / 4); x.fillStyle = BROWN; x.fillRect(-9, -9, 18, 18); x.fillStyle = CREAM_L; x.fillRect(-4, -4, 8, 8); x.restore(); }
}

export function educationMinistry(U) {
  const G = new THREE.Group(); G.name = 'ministry';
  const cream = std({ color: 0xe9dcc2 }), creamD = std({ color: 0xd9c9aa }), brown = std({ color: 0xa2533c, roughness: 0.9 });
  const wingM = new THREE.MeshStandardMaterial({ map: ctex(512, 512, wingFace), roughness: 0.85 });
  const centerM = new THREE.MeshStandardMaterial({ map: ctex(512, 640, centerFace), roughness: 0.85 });
  const WW = 30, WH = 24, WD = 18, CW = 31, CH = 35, CD = 24, XC = -9;       // الجناح / الكتلة الوسطى / موضع واجهتها
  // الدرج العريض والمنصة
  for (let k = 0; k < 5; k++) G.add(at(box(9 - k * 1.7, 0.42, CW + 8 - k * 1.2, brown), XC + 4.5 - k * 0.85 + 0.1, k * 0.42, 0));
  // الكتلة الوسطى
  const mid = new THREE.Mesh(new THREE.BoxGeometry(CD, CH, CW).translate(0, CH / 2, 0), [centerM, cream, creamD, cream, cream, cream]); G.add(at(mid, XC - CD / 2, 0, 0));
  G.add(at(box(CD + 0.8, 1.1, CW + 0.8, creamD), XC - CD / 2, CH, 0));
  const balc = box(2.2, 2.4, 9, creamD); G.add(at(balc, XC - 0.4, CH + 0.4, 0));
  // الجناحان (متراجعان قليلًا)
  for (const s of [-1, 1]) {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(WD, WH, WW).translate(0, WH / 2, 0), [wingM, wingM, creamD, cream, wingM, wingM]); G.add(at(wing, XC - 4 - WD / 2, 0, s * (CW / 2 + WW / 2)));
    G.add(at(box(WD + 0.6, 0.8, WW + 0.6, creamD), XC - 4 - WD / 2, WH, s * (CW / 2 + WW / 2)));
  }
  // القبة البيضاء وسارية العلم
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(8.6, 8.6, 2.2, 28).translate(0, 1.1, 0), creamD); G.add(at(drum, XC - CD / 2, CH + 1.1, 0));
  const dome = new THREE.Mesh(new THREE.SphereGeometry(8.2, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), std({ color: 0xf4f1e8, roughness: 0.55 })); dome.scale.y = 0.62; G.add(at(dome, XC - CD / 2, CH + 3.3, 0));
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 11, 8).translate(0, 5.5, 0), std({ color: 0xe6e9ec, metalness: 0.7, roughness: 0.3 })); G.add(at(pole, XC - CD / 2, CH + 8.2, 0));
  if (U) {
    const L = 5.4, y0 = 10.6 - L / FLAG_ASPECT, tmp = bendMaterial(new THREE.MeshStandardMaterial());
    const m = clothMaterial(U, { L, y0, bendWrap: tmp.onBeforeCompile, key: 'bend2-cloth-54' }); m.userData.bent = true;
    const f = new THREE.Mesh(flagGeometry(L, y0, 22, 8), m); f.userData.keep = true; f.frustumCulled = false; G.add(at(f, XC - CD / 2, CH + 8.2, 0));
  }
  // ساحة مبلّطة وحديقتان أمام الجناحين
  const plaza = new THREE.Mesh(new THREE.PlaneGeometry(13, CW + WW * 2 + 6), std({ color: 0xcf8f78, roughness: 1 })); plaza.rotation.x = -Math.PI / 2; G.add(at(plaza, XC + 2.2, 0.04, 0));
  for (const s of [-1, 1]) { const lawn = new THREE.Mesh(new THREE.PlaneGeometry(8, WW - 4), std({ color: 0x5aa03f, roughness: 1 })); lawn.rotation.x = -Math.PI / 2; G.add(at(lawn, XC - 0.2, 0.07, s * (CW / 2 + WW / 2 + 1))); }
  G.userData.half = CW / 2 + WW + 3; G.userData.depth = 40; G.userData.lookY = 20;
  return G;
}
