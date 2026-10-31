// =====================================================================
//  نموذج الأكورديون ثلاثي الأبعاد (إجرائي بالكامل — بلا ملفات نماذج خارجية، فلا حقوق نشر مرتبطة بالنموذج).
//  التصميم مبني على الصور المرجعية (أكورديون بيانو أحمر لؤلؤي: شبك فضي مشقوق، مفاتيح تسجيل، منفاخ بحواف بيضاء، أزرار باص، أحزمة).
//  إحداثيات الآلة المحلية: x = العرض (اليسار +x)، y = الأعلى، z = الأمام (الظهر z=0 على الصدر).
//    صندوق اليمنى (المفاتيح): x ∈ [-WR, 0] ثابت مع جسم العازفة.
//    المنفاخ: مروحي. مفصلته في الأسفل (على الفخذ): الطيّات تتقارب عند القاع وتتباعد في الأعلى كحرف V.
//    صندوق اليسرى (الباص): يدور حول زاويته السفلية الداخلية بزاوية الانفراج فيميل وجهه مع المنفاخ.
//  المنفاخ هندسة واحدة تُحدَّث رؤوسها: عدد الطيّات ثابت، وعمق كل طيّة من طول اللوح الحقيقي (فيثاغورس) فلا تمطّط ولا تداخل.
// =====================================================================
import * as THREE from 'three';
import { TREBLE, BASS, WHITE_COUNT } from './accordion-data.js';

export const DIM = {
  H: 0.37, D: 0.17, WR: 0.125, WL: 0.105,
  W_MIN: 0.09, W_MAX: 0.34,
  KEY_W: 0.0172,
  BASS_DY: 0.021, BASS_DZ: 0.0185,
  FOLDS: 15, PANEL: 0.040,
};
const { H, D, WR, WL } = DIM;

// ---------- أدوات هندسة ----------
function rbox(dx, dy, dz, r = 0.002, seg = 2) {          // صندوق بحواف مستديرة (الأبعاد النهائية = dx,dy,dz بالضبط)
  const a = dz / 2 - r, b = dy / 2 - r;
  const s = new THREE.Shape(); s.moveTo(-a, -b); s.lineTo(a, -b); s.lineTo(a, b); s.lineTo(-a, b); s.lineTo(-a, -b);
  const g = new THREE.ExtrudeGeometry(s, { depth: Math.max(1e-4, dx - 2 * r), bevelEnabled: true, bevelThickness: r, bevelSize: r, bevelSegments: seg, curveSegments: 1 });
  g.translate(0, 0, -(dx - 2 * r) / 2);
  g.rotateY(Math.PI / 2);
  return g;
}
function canvasTex(w, h, draw, repeat, srgb = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}
// بذرة ثابتة كي يبقى شكل السيلولويد نفسه في كل تشغيل
function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

// سيلولويد أحمر لؤلؤي (التواءات داكنة وفاتحة كما في الصور المرجعية)
function pearlTexture() {
  return canvasTex(1024, 1024, (x, w, h) => {
    const R = rng(7);
    x.fillStyle = '#7d0b17'; x.fillRect(0, 0, w, h);
    const blob = (col, a, n, rmin, rmax) => { for (let i = 0; i < n; i++) { const cx = R() * w, cy = R() * h, r = rmin + R() * (rmax - rmin); const g = x.createRadialGradient(cx, cy, 0, cx, cy, r); g.addColorStop(0, col.replace('A', a)); g.addColorStop(1, col.replace('A', 0)); x.fillStyle = g; x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fill(); } };
    blob('rgba(30,0,6,A)', 0.55, 40, 40, 150);
    blob('rgba(200,28,44,A)', 0.55, 50, 30, 120);
    blob('rgba(255,120,130,A)', 0.18, 40, 20, 80);
    x.lineCap = 'round';
    for (let i = 0; i < 160; i++) {                          // عروق ملتوية
      x.strokeStyle = R() < 0.5 ? `rgba(20,0,4,${0.12 + R() * 0.3})` : `rgba(255,${150 + R() * 70 | 0},${150 + R() * 60 | 0},${0.05 + R() * 0.14})`;
      x.lineWidth = 1 + R() * 5; x.beginPath(); let px = R() * w, py = R() * h; x.moveTo(px, py);
      for (let k = 0; k < 5; k++) { px += (R() - 0.5) * 180; py += (R() - 0.5) * 180; x.quadraticCurveTo(px + (R() - 0.5) * 90, py + (R() - 0.5) * 90, px, py); }
      x.stroke();
    }
    for (let i = 0; i < 2600; i++) { x.fillStyle = `rgba(255,220,220,${R() * 0.08})`; x.beginPath(); x.arc(R() * w, R() * h, R() * 2.4 + .3, 0, 7); x.fill(); }
  }, [1, 1]);
}
// شبك فضي من شرائح مدورة الأطراف (ألفا): بين الشرائح يظهر لون الصندوق
function slatTextures(nSlats = 22) {
  const W = 256, Ht = 1024;
  const draw = (metalMap) => (x, w, h) => {
    x.clearRect(0, 0, w, h); if (metalMap) { x.fillStyle = '#000'; x.fillRect(0, 0, w, h); }
    const gap = h / nSlats, sh = gap * 0.78;
    for (let i = 0; i < nSlats; i++) {
      const y = i * gap + (gap - sh) / 2, r = sh / 2;
      x.beginPath(); x.moveTo(r, y); x.lineTo(w - r, y); x.arc(w - r, y + r, r, -Math.PI / 2, Math.PI / 2); x.lineTo(r, y + sh); x.arc(r, y + r, r, Math.PI / 2, -Math.PI / 2); x.closePath();
      if (metalMap) { x.fillStyle = '#fff'; x.fill(); continue; }
      const g = x.createLinearGradient(0, y, 0, y + sh); g.addColorStop(0, '#f4f6f9'); g.addColorStop(0.35, '#b9bec6'); g.addColorStop(0.7, '#8d929b'); g.addColorStop(1, '#dfe3e8');
      x.fillStyle = g; x.fill();
      x.save(); x.clip(); x.strokeStyle = 'rgba(40,44,52,.38)'; x.lineWidth = 1;                // خطوط التخشين (knurling)
      for (let k = -sh; k < w + sh; k += 3.2) { x.beginPath(); x.moveTo(k, y); x.lineTo(k + sh, y + sh); x.stroke(); }
      x.restore();
    }
  };
  return { map: canvasTex(W, Ht, draw(false)), metal: canvasTex(W, Ht, draw(true), null, false) };
}
function strapTexture() {            // جلد أسود مع خياطة على الحافتين
  return canvasTex(64, 256, (x, w, h) => {
    x.fillStyle = '#1c1714'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 400; i++) { x.fillStyle = `rgba(255,255,255,${Math.random() * 0.035})`; x.fillRect(Math.random() * w, Math.random() * h, 1, 1.5); }
    x.strokeStyle = 'rgba(214,196,150,.85)'; x.lineWidth = 1.4; x.setLineDash([5, 4]);
    for (const xx of [6, w - 6]) { x.beginPath(); x.moveTo(xx, 0); x.lineTo(xx, h); x.stroke(); }
  }, [1, 1]);
}

// ---------- شريط جلدي ديناميكي (يُعاد حساب رؤوسه عند تغيّر نقاط التحكم) ----------
class Ribbon {
  constructor(N, width, thick, mat, up = [0, 0, 1]) {
    this.N = N; this.width = width; this.thick = thick; this.up = new THREE.Vector3(...up);
    const vc = (N + 1) * 4, uv = new Float32Array(vc * 2), idx = [];
    for (let i = 0; i <= N; i++) for (let k = 0; k < 4; k++) { const o = (i * 4 + k) * 2; uv[o] = k === 0 || k === 3 ? 0 : 1; uv[o + 1] = i / N; }
    for (let i = 0; i < N; i++) for (let k = 0; k < 4; k++) { const a = i * 4 + k, b = i * 4 + (k + 1) % 4, c = (i + 1) * 4 + k, d = (i + 1) * 4 + (k + 1) % 4; idx.push(a, c, b, b, c, d); }
    this.pos = new Float32Array(vc * 3);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(idx);
    this.mesh = new THREE.Mesh(g, mat); this.mesh.frustumCulled = false; this.mesh.castShadow = true;
    this.curve = new THREE.CatmullRomCurve3([new THREE.Vector3(), new THREE.Vector3(0, 0, 1)], false, 'catmullrom', 0.4);
  }
  set(points, up) {
    this.curve.points = points.map((p) => (p.isVector3 ? p : new THREE.Vector3(...p)));
    const N = this.N, P = this.curve.getPoints(N), pos = this.pos, U = up ? new THREE.Vector3(...up) : this.up;
    const t = new THREE.Vector3(), s = new THREE.Vector3(), n = new THREE.Vector3(), p = new THREE.Vector3();
    for (let i = 0; i <= N; i++) {
      this.curve.getTangentAt(i / N, t).normalize();
      s.crossVectors(t, U); if (s.lengthSq() < 1e-6) s.set(1, 0, 0); s.normalize(); n.crossVectors(s, t).normalize();
      let k = 0;
      for (const [a, b] of [[-1, 1], [1, 1], [1, -1], [-1, -1]]) { p.copy(P[i]).addScaledVector(s, a * this.width / 2).addScaledVector(n, b * this.thick / 2); const o = (i * 4 + k++) * 3; pos[o] = p.x; pos[o + 1] = p.y; pos[o + 2] = p.z; }
    }
    const g = this.mesh.geometry; g.attributes.position.needsUpdate = true; g.computeVertexNormals(); g.computeBoundingSphere();
  }
}

export function buildAccordion(opts = {}) {
  const root = new THREE.Group(); root.name = 'accordion';
  const slat = slatTextures();
  const M = {
    body: new THREE.MeshPhysicalMaterial({ color: 0xffffff, map: pearlTexture(), roughness: 0.2, clearcoat: 1.0, clearcoatRoughness: 0.08, metalness: 0.0 }),
    chrome: new THREE.MeshStandardMaterial({ color: 0xd9dde3, roughness: 0.18, metalness: 1.0 }),
    gold: new THREE.MeshStandardMaterial({ color: 0xc9a14a, roughness: 0.3, metalness: 0.95 }),
    plate: new THREE.MeshStandardMaterial({ color: 0x15151a, roughness: 0.55, metalness: 0.2 }),
    binding: new THREE.MeshPhysicalMaterial({ color: 0xf1ead8, roughness: 0.3, clearcoat: 0.7, clearcoatRoughness: 0.2 }),
    ivory: new THREE.MeshPhysicalMaterial({ color: 0xf3ecda, roughness: 0.35, clearcoat: 0.5, clearcoatRoughness: 0.3 }),
    ebony: new THREE.MeshPhysicalMaterial({ color: 0x15151a, roughness: 0.25, clearcoat: 0.8, clearcoatRoughness: 0.15 }),
    btn: new THREE.MeshPhysicalMaterial({ color: 0x131316, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.08 }),
    slat: new THREE.MeshStandardMaterial({ map: slat.map, metalnessMap: slat.metal, metalness: 1.0, roughness: 0.28, alphaTest: 0.5, transparent: false, side: THREE.DoubleSide }),
    bellows: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.0, side: THREE.DoubleSide }),
    strap: new THREE.MeshStandardMaterial({ color: 0xffffff, map: strapTexture(), roughness: 0.62, metalness: 0 }),
    leather: new THREE.MeshStandardMaterial({ color: 0x2a211b, roughness: 0.6, metalness: 0 }),
    glow: new THREE.MeshStandardMaterial({ color: 0xffd35a, emissive: 0xffb300, emissiveIntensity: 1.0, roughness: 0.4 }),
  };
  const pickables = [];
  const tag = (mesh, part, extra) => { mesh.userData.part = part; if (extra) Object.assign(mesh.userData, extra); pickables.push(mesh); return mesh; };
  const add = (parent, mesh, x, y, z, part, shadow = true) => { mesh.position.set(x, y, z); if (part) tag(mesh, part); mesh.castShadow = shadow; mesh.receiveShadow = true; parent.add(mesh); return mesh; };

  // ---------- الصندوقان ----------
  const rightBox = new THREE.Group(), leftBox = new THREE.Group();
  root.add(rightBox, leftBox);
  add(rightBox, new THREE.Mesh(rbox(WR, H, D, 0.007, 3), M.body), -WR / 2, H / 2, D / 2, 'rightbox');
  add(leftBox, new THREE.Mesh(rbox(WL, H, D, 0.007, 3), M.body), WL / 2, H / 2, D / 2, 'leftbox');
  // شريط تجميل أبيض عند طرف كل صندوق ناحية المنفاخ (كما في المرجع)
  for (const [box, x] of [[rightBox, -0.0035], [leftBox, 0.0035]]) add(box, new THREE.Mesh(rbox(0.007, H + 0.003, D + 0.003, 0.0018, 1), M.binding), x, H / 2, D / 2, 'baseplate');

  // ---------- الواجهة الأمامية: شرائح فضية + مفاتيح التسجيل + شعار ----------
  const grW = WR - 0.026, grH = H - 0.04;
  const gr = add(rightBox, new THREE.Mesh(new THREE.PlaneGeometry(grW, grH), M.slat), -WR / 2 + 0.006, H / 2 + 0.002, D + 0.0012, 'grille', false);
  // مفاتيح التسجيل (Register): خمس كتل سوداء بينها بيضاء، بجانب لوحة المفاتيح عند الواجهة
  for (let i = 0; i < 5; i++) {
    const bl = new THREE.Mesh(rbox(0.014, 0.0105, 0.016, 0.0016, 1), i === 2 ? M.binding : M.ebony); bl.rotation.y = 0;
    add(rightBox, bl, -WR + 0.0135, H * 0.58 + (i - 2) * 0.0128, D + 0.004, 'register');
    const dot = new THREE.Mesh(new THREE.CylinderGeometry(0.0021, 0.0021, 0.0008, 12), M.chrome); dot.rotation.x = Math.PI / 2; dot.position.set(-WR + 0.0135, H * 0.58 + (i - 2) * 0.0128, D + 0.0123); rightBox.add(dot);
  }
  // شعار المنصة (لوحة سوداء بحروف ذهبية؛ لا علامة تجارية حقيقية)
  const logo = new THREE.Mesh(new THREE.PlaneGeometry(0.058, 0.0185), new THREE.MeshStandardMaterial({
    map: canvasTex(256, 80, (x, w, h) => { x.fillStyle = '#101013'; x.fillRect(0, 0, w, h); x.strokeStyle = '#c9a14a'; x.lineWidth = 3; x.strokeRect(3, 3, w - 6, h - 6); x.fillStyle = '#e8c26a'; x.font = '700 38px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('MusiTeacher', w / 2, h / 2 + 2); }),
    roughness: 0.4, metalness: 0.3,
  }));
  logo.position.set(-WR / 2 + 0.006, H * 0.905, D + 0.0028); rightBox.add(logo);
  // علاّقة الحزام العلوية وزر الحزام السفلي (معدن)
  for (const [box, xs, zs] of [[rightBox, -WR * 0.5, D * 0.42], [leftBox, WL * 0.5, D * 0.42]]) {
    const top = add(box, new THREE.Mesh(new THREE.TorusGeometry(0.0125, 0.0026, 8, 20), M.chrome), xs, H + 0.0105, zs, 'strapHook'); top.rotation.y = Math.PI / 2;
    const base = add(box, new THREE.Mesh(new THREE.CylinderGeometry(0.0075, 0.0075, 0.007, 16), M.chrome), xs, -0.0015, zs, 'strapHook');
  }
  // نافذة بيضاء لؤلؤية على واجهة صندوق الباص (كما في المرجع) + حافة
  add(leftBox, new THREE.Mesh(rbox(0.0012, 0.12, 0.034, 0.0006, 1), M.binding), WL * 0.5, H * 0.58, D + 0.0007, 'inlay', false).rotation.y = 0;
  // مشابك حزام المعصم على صندوق الباص (حلقتان معدنيتان على الطرف الخارجي)
  const wA = add(leftBox, new THREE.Mesh(new THREE.TorusGeometry(0.0085, 0.0021, 8, 18), M.chrome), WL + 0.003, 0.05, 0.012, 'wristAnchor'); wA.rotation.y = Math.PI / 2;
  const wB = add(leftBox, new THREE.Mesh(new THREE.TorusGeometry(0.0085, 0.0021, 8, 18), M.chrome), WL + 0.003, 0.012, D * 0.4, 'wristAnchor'); wB.rotation.x = Math.PI / 2;

  // ---------- لوحة المفاتيح ----------
  const keys = {};
  const kb = new THREE.Group(); kb.position.set(-WR, 0, 0); rightBox.add(kb);
  const plateH = WHITE_COUNT * DIM.KEY_W + 0.026;
  add(kb, new THREE.Mesh(rbox(0.010, plateH, 0.128, 0.003, 1), M.plate), -0.005, H / 2, 0.088, 'keyboard');
  add(kb, new THREE.Mesh(rbox(0.004, plateH + 0.008, 0.136, 0.0015, 1), M.body), -0.002, H / 2, 0.088, 'keyboard');
  const y0 = (H - WHITE_COUNT * DIM.KEY_W) / 2;
  const keyY = (slot) => y0 + (WHITE_COUNT - slot - 0.5) * DIM.KEY_W;      // الصوت الأخفض في الأعلى (عند الإبهام) — تقدير غير مؤكد
  for (const k of TREBLE) {
    const black = k.black, len = black ? 0.060 : 0.108, thick = black ? 0.022 : 0.012, wid = black ? 0.0108 : DIM.KEY_W - 0.0011;
    const zc = black ? 0.058 : 0.088;
    const m = tag(new THREE.Mesh(rbox(thick, wid, len, 0.0016, 1), black ? M.ebony : M.ivory), black ? 'blackkey' : 'whitekey', { keyId: k.id, midi: k.midi });
    const pivot = new THREE.Group(); pivot.position.set(-thick / 2 - 0.009, keyY(k.slot), zc);
    m.castShadow = true; pivot.add(m); kb.add(pivot);
    keys[k.id] = { id: k.id, midi: k.midi, black, mesh: m, pivot, rest: pivot.position.x, travel: 0.0062, base: black ? M.ebony : M.ivory, press: 0, zc, len, thick, y: keyY(k.slot) };
  }

  // ---------- أزرار الباص (على الطرف الأيسر للصندوق الأيسر، وجهها نحو +x) ----------
  const buttons = {};
  const bp = new THREE.Group(); bp.name = 'bassPanel'; leftBox.add(bp); bp.position.set(WL, 0, 0);
  const rowsN = 6, colsN = 8, py0 = (H - rowsN * DIM.BASS_DY) / 2, pz0 = (D - colsN * DIM.BASS_DZ) / 2;
  add(bp, new THREE.Mesh(rbox(0.008, rowsN * DIM.BASS_DY + 0.022, colsN * DIM.BASS_DZ + 0.022, 0.003, 1), M.binding), 0.004, H / 2, D / 2, 'bass');
  add(bp, new THREE.Mesh(rbox(0.003, rowsN * DIM.BASS_DY + 0.030, colsN * DIM.BASS_DZ + 0.030, 0.0015, 1), M.chrome), 0.0015, H / 2, D / 2, 'bass');
  const cylG = new THREE.CylinderGeometry(0.0078, 0.0085, 0.0125, 20); cylG.rotateZ(-Math.PI / 2);
  for (const b of BASS) {
    const y = py0 + (b.row + 0.5) * DIM.BASS_DY, z = pz0 + (b.col + 0.5) * DIM.BASS_DZ, yy = H - y;
    const m = tag(new THREE.Mesh(cylG, M.btn), 'bassbutton', { bassId: b.id });
    m.castShadow = true;
    const piv = new THREE.Group(); piv.position.set(0.008 + 0.0063, yy, z); piv.add(m); bp.add(piv);
    const dot = (b.kind === 'bass' && b.pc === 0) || (b.kind === 'counter' && b.pc === 8) ? 1 : 0;
    if (dot) { const d = new THREE.Mesh(new THREE.SphereGeometry(0.0022, 8, 6), M.chrome); d.position.set(0.0065, 0, 0); piv.add(d); }
    buttons[b.id] = { id: b.id, mesh: m, pivot: piv, rest: piv.position.x, travel: 0.0045, base: M.btn, press: 0, y: yy, z, data: b };
  }

  // ---------- المنفاخ المروحي ----------
  const FOLDS = DIM.FOLDS, R = FOLDS * 2 + 1, SEGS = 36, ROWS = [0, 0.07, 0.09, 1];   // R حلقة؛ كل لوح (بين حلقتين) 4 صفوف: حافة بيضاء ثم لون المنفاخ
  const NPAN = R - 1, vcount = NPAN * ROWS.length * SEGS;
  const bellGeo = new THREE.BufferGeometry();
  const pos = new Float32Array(vcount * 3), col = new Float32Array(vcount * 3), idx = [];
  for (let k = 0; k < NPAN; k++) for (let r = 0; r < ROWS.length - 1; r++) for (let j = 0; j < SEGS; j++) {
    const a = (k * ROWS.length + r) * SEGS + j, b = (k * ROWS.length + r) * SEGS + (j + 1) % SEGS, c = (k * ROWS.length + r + 1) * SEGS + j, d = (k * ROWS.length + r + 1) * SEGS + (j + 1) % SEGS;
    idx.push(a, c, b, b, c, d);
  }
  bellGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); bellGeo.setAttribute('color', new THREE.BufferAttribute(col, 3)); bellGeo.setIndex(idx);
  const sect = [];                                         // مقطع عرضي: مستطيل بحواف مستديرة (سوبر-إهليلج)
  for (let j = 0; j < SEGS; j++) { const t = (j / SEGS) * Math.PI * 2, c = Math.cos(t), s = Math.sin(t), e = 7; sect.push([Math.sign(c) * Math.pow(Math.abs(c), 2 / e), Math.sign(s) * Math.pow(Math.abs(s), 2 / e)]); }
  const bellows = tag(new THREE.Mesh(bellGeo, M.bellows), 'bellows'); bellows.frustumCulled = false; bellows.castShadow = bellows.receiveShadow = true; root.add(bellows);
  const cBody = new THREE.Color(0x4a1119), cValley = new THREE.Color(0x14050a), cBind = new THREE.Color(0xeee6d2);
  const state = { w: 0.2, tan: 0, gb: 0.15, gt: 0.25, theta: 0, lift: 0 };

  // مفصلة المروحة: المنفاخ مفتوح كحرف V (أضيق عند القاع)؛ وعند الإغلاق يكاد يتوازى (بميل عكسي صغير: الأعلى يُغلق أولًا)
  function fanFor(w) {
    const f = Math.min(1.05, Math.max(0, (w - 0.09) / 0.2));
    const tan = Math.max(-0.045, 0.82 * (f - 0.1) / 0.9);
    const gb = Math.max(0.07, w - (H / 2) * tan), gt = w + (H / 2) * tan;
    return { f, tan, gb, gt };
  }
  // كل حلقة (R) × SEGS نقطة تُحسب مرة واحدة لكل اتساع، ثم تُستنتج رؤوس الألواح بالاستيفاء الخطي بين الحلقتين.
  const RP = new Float32Array(R * SEGS * 3), sA = new Float32Array(R), cA = new Float32Array(R);
  // الألوان لا تتغير مع الاتساع فتُحسب مرة واحدة
  for (let k = 0; k < NPAN; k++) {
    const aRidge = k % 2 === 0;
    for (let r = 0; r < ROWS.length; r++) {
      const s = aRidge ? ROWS[r] : 1 - ROWS[ROWS.length - 1 - r], sRid = aRidge ? s : 1 - s;
      const c = sRid < 0.08 ? cBind : cBody.clone().lerp(cValley, (sRid - 0.09) / 0.91 * 0.9);
      for (let j = 0; j < SEGS; j++) { const o = ((k * ROWS.length + r) * SEGS + j) * 3; col[o] = c.r; col[o + 1] = c.g; col[o + 2] = c.b; }
    }
  }
  bellGeo.attributes.color.needsUpdate = true;
  let lastW = -1;
  function setWidth(w) {
    w = Math.min(DIM.W_MAX, Math.max(DIM.W_MIN, w)); state.w = w;
    const { tan, gb, gt } = fanFor(w); state.tan = tan; state.gb = gb; state.gt = gt; state.theta = Math.atan(tan);
    const lift = Math.max(0, 0.55 * WL * Math.sin(state.theta)); state.lift = lift;       // يرتفع طرف صندوق الباص الداخلي قليلًا فلا يغوص طرفه الخارجي في الفخذ
    leftBox.position.set(gb, lift, 0); leftBox.rotation.set(0, 0, -state.theta); leftBox.updateMatrix();
    if (Math.abs(w - lastW) < 1e-6) return;
    lastW = w;
    const stepB = gb / (R - 1);
    for (let i = 0; i < R; i++) { const alpha = Math.atan(tan * i / (R - 1)); sA[i] = Math.sin(alpha); cA[i] = Math.cos(alpha); }
    for (let i = 0; i < R; i++) {
      const frac = i / (R - 1);
      const xb = gb * frac, valley = i % 2 === 1, lf = lift * frac;
      for (let j = 0; j < SEGS; j++) {
        const sp = sect[j], u0 = H / 2 + sp[1] * H / 2;
        // عمق الطيّة من طول اللوح الحقيقي: sqrt(PANEL² − (المسافة بين الحلقتين عند هذا الارتفاع)²)
        const dxStep = Math.max(0.0005, valley ? stepB + u0 * (sA[Math.min(R - 1, i + 1)] - sA[Math.max(0, i - 1)]) / 2 : 0);      // المسافة الفعلية بين حلقتين متجاورتين عند هذا الارتفاع
        const dep = valley ? Math.min(0.042, Math.sqrt(Math.max(1e-6, DIM.PANEL * DIM.PANEL - dxStep * dxStep))) : 0;
        const u = H / 2 + sp[1] * (H / 2 - dep / Math.max(0.55, cA[i])), hw = D / 2 - dep;       // القسمة على cos تعوّض ميل الحلقة فيبقى طول اللوح ثابتًا على الأوجه الأربعة
        const o = (i * SEGS + j) * 3;
        RP[o] = xb + u0 * sA[i];                                  // x من الارتفاع الاسمي: الحلقات تتتابع في x دائمًا فلا تتداخل الطيّات
        RP[o + 1] = u * cA[i] + lf; RP[o + 2] = D / 2 + sp[0] * hw;
      }
    }
    for (let k = 0; k < NPAN; k++) {
      const aRidge = k % 2 === 0;
      for (let r = 0; r < ROWS.length; r++) {
        const s = aRidge ? ROWS[r] : 1 - ROWS[ROWS.length - 1 - r];
        for (let j = 0; j < SEGS; j++) {
          const a = (k * SEGS + j) * 3, b = ((k + 1) * SEGS + j) * 3, o = ((k * ROWS.length + r) * SEGS + j) * 3;
          pos[o] = RP[a] + (RP[b] - RP[a]) * s; pos[o + 1] = RP[a + 1] + (RP[b + 1] - RP[a + 1]) * s; pos[o + 2] = RP[a + 2] + (RP[b + 2] - RP[a + 2]) * s;
        }
      }
    }
    bellGeo.attributes.position.needsUpdate = true;
    bellGeo.computeVertexNormals(); bellGeo.computeBoundingSphere();
  }
  setWidth(state.w);

  // ---------- إضاءة المفتاح/الزر وضغطه ----------
  const lit = new Map();
  function setKeyPress(id, v) { const k = keys[id]; if (!k) return; k.press = v; k.pivot.position.x = k.rest + k.travel * v; }
  function setBassPress(id, v) { const b = buttons[id]; if (!b) return; b.press = v; b.pivot.position.x = b.rest - b.travel * v; }
  function setLit(id, on, color = 0xffc83a) {
    const obj = keys[id] || buttons[id]; if (!obj) return;
    if (on) {
      if (!obj.litMat) { obj.litMat = obj.base.clone(); obj.litMat.emissive = new THREE.Color(color); obj.litMat.emissiveIntensity = 0.7; }
      obj.litMat.emissive.set(color); obj.mesh.material = obj.litMat; lit.set(id, obj);
    } else { obj.mesh.material = obj.base; lit.delete(id); }
  }
  function clearLit() { for (const id of [...lit.keys()]) setLit(id, false); }

  // ---------- الأحزمة ----------
  // حزامان للكتفين: كل منهما من علاّقة أعلى صندوقه فوق الكتف ثم خلف الظهر وتحت الإبط ثم يعود إلى زر أسفل الصندوق نفسه.
  // وحزام للمعصم: من حلقتين على صندوق الباص إلى سوار جلدي على معصم اليد اليسرى.
  const straps = new THREE.Group(); straps.name = 'straps'; root.add(straps);
  const shoulder = {};      // { R:{ribbon, body:[pts], top:()=>Vector3, bot:()=>Vector3}, L:... }
  const tmpV = new THREE.Vector3();
  const anchors = {
    R: { top: () => rightBox.localToWorld(new THREE.Vector3(-WR * 0.5, H + 0.0105, D * 0.42)), bot: () => rightBox.localToWorld(new THREE.Vector3(-WR * 0.5, -0.004, D * 0.42)) },
    L: { top: () => leftBox.localToWorld(new THREE.Vector3(WL * 0.5, H + 0.0105, D * 0.42)), bot: () => leftBox.localToWorld(new THREE.Vector3(WL * 0.5, -0.004, D * 0.42)) },
  };
  /** مسار الجسم لكل جهة: نقاط بإحداثيات العالم (فوق الكتف، الظهر، تحت الإبط) تحسبها العازفة بعد الجلوس. */
  function setShoulderPath(side, worldPts, width = 0.05) {
    let s = shoulder[side];
    if (!s) { const rb = new Ribbon(56, width, 0.006, M.strap, [0, 1, 0]); rb.mesh.userData.part = 'strap'; straps.add(rb.mesh); pickables.push(rb.mesh); s = shoulder[side] = { rb }; }
    s.path = worldPts.map((p) => p.clone()); s.rb.width = width;
  }
  const wrist = { loopA: new Ribbon(20, 0.022, 0.004, M.strap, [1, 0, 0]), loopB: new Ribbon(20, 0.022, 0.004, M.strap, [1, 0, 0]), cuff: null };
  for (const r of [wrist.loopA, wrist.loopB]) { r.mesh.userData.part = 'strap'; straps.add(r.mesh); pickables.push(r.mesh); }
  wrist.cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.03, 32, 1, true), new THREE.MeshStandardMaterial({ color: 0x241b16, roughness: 0.55, side: THREE.DoubleSide }));
  wrist.cuff.userData.part = 'strap'; wrist.cuff.castShadow = true; pickables.push(wrist.cuff); straps.add(wrist.cuff);
  const cuffBuckle = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.016, 0.004), M.chrome); cuffBuckle.position.set(0, 0, 0.0425); wrist.cuff.add(cuffBuckle);

  /** تُستدعى كل إطار بعد ضبط المنفاخ: تعيد بناء الأحزمة من نقاط تثبيتها الحالية على الصندوقين. wristInfo: {pos, dir, up} للمعصم (عالمي) */
  function updateStraps(wristInfo) {
    root.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
    const L = (v) => v.clone().applyMatrix4(inv);
    for (const side of ['R', 'L']) {
      const s = shoulder[side]; if (!s || !s.path) continue;
      const top = anchors[side].top(), bot = anchors[side].bot();
      const pts = [top, top.clone().lerp(s.path[0], 0.5).add(new THREE.Vector3(0, 0.03, 0)), ...s.path, bot.clone().lerp(s.path[s.path.length - 1], 0.4).add(new THREE.Vector3(0, 0.02, 0)), bot];
      s.rb.set(pts.map(L), [0, 0, 1]);
    }
    if (wristInfo) {
      const { pos, dir, up } = wristInfo;
      wrist.cuff.position.copy(L(pos));
      const dl = L(pos.clone().add(dir)).sub(L(pos)).normalize();
      wrist.cuff.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dl);
      const upl = L(pos.clone().add(up)).sub(L(pos)); wrist.cuff.rotateOnAxis(new THREE.Vector3(0, 1, 0), 0);       // الإبزيم على الظهر الخارجي
      const aA = leftBox.localToWorld(new THREE.Vector3(WL + 0.003, 0.05, 0.012)), aB = leftBox.localToWorld(new THREE.Vector3(WL + 0.003, 0.012, D * 0.4));
      const c = L(pos), mid = (a) => L(a);
      const cuffA = c.clone().addScaledVector(L(pos.clone().add(up.clone().multiplyScalar(-1))).sub(c).normalize(), 0.028);
      wrist.loopA.set([cuffA, cuffA.clone().lerp(mid(aA), 0.5).add(new THREE.Vector3(0, -0.012, 0)), mid(aA)], [1, 0, 0]);
      wrist.loopB.set([cuffA, cuffA.clone().lerp(mid(aB), 0.5).add(new THREE.Vector3(0, -0.01, 0)), mid(aB)], [1, 0, 0]);
    }
  }

  return {
    root, rightBox, leftBox, keys, buttons, bellows, pickables, setWidth, getWidth: () => state.w, getFan: () => ({ tan: state.tan, theta: state.theta, bottom: state.gb, top: state.gt }),
    setKeyPress, setBassPress, setLit, clearLit, setShoulderPath, updateStraps, DIM, M,
    keyTop(id) { const k = keys[id]; return new THREE.Vector3(-WR - 0.009 - k.thick, k.y, k.zc + (k.black ? 0.0 : 0.02)); },
    bassTop(id) { const b = buttons[id]; return new THREE.Vector3(DIM.WL + 0.008 + 0.0125 + 0.0063 - 0.004, b.y, b.z); },
  };
}
