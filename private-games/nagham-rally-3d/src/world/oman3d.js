// =====================================================================
//  معالم عُمانية ثلاثية الأبعاد (مبنية برمجيًا — لا صور مسطّحة ملصقة):
//   • جامع السلطان قابوس الأكبر: رواق بأقواس، قاعة صلاة متدرجة، قبة بزخرفة شبكية ذهبية، المئذنة الكبرى وأربع مآذن.
//   • بوابة سوق مطرح: برج مربع بقوس مدبّب كبير وشرفات مسننة وقبة زجاجية ولوحة «سوق مطرح».
//   • مبنى وزارة التربية والتعليم: واجهة حجرية بنوافذ مقوّسة وبوابة مركزية خشبية وعلم.
//   • منصة الصورة الرسمية: إطار ذهبي على قاعدة رخامية تتوسطها صورة رسمية، وعلمان على الجانبين (كما في الميادين).
//   • برج حصن دائري بشرفات مستديرة على تلّة صخرية (كحصون مطرح).
//   • بيوت مسقط البيضاء (شرفات مسننة، نوافذ صغيرة بأغطية مكيفات مشبّكة، أبواب خشبية)، وأعمدة إنارة كورنيش مطرح.
//  كل معلم: واجهته نحو ‎+X المحلي، وأصله في منتصف الواجهة على الأرض؛ يُدار π عند وضعه يمين الطريق.
// =====================================================================
import * as THREE from 'three';
import { FLAG_ASPECT, flagGeometry, clothMaterial } from './flag.js';

function ctex(w, h, draw, rep) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  if (rep) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
const std = (o) => new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0, ...o });
const box = (w, h, d, m) => { const g = new THREE.BoxGeometry(w, h, d); g.translate(0, h / 2, 0); return new THREE.Mesh(g, m); };
const at = (o, x, y, z) => { o.position.set(x, y, z); return o; };
/** يكرر قوام صندوق بحسب أبعاده الحقيقية (متر لكل تكرار) */
function boxUV(geo, w, h, d, tile) {
  const uv = geo.attributes.uv, n = geo.attributes.normal;
  for (let i = 0; i < uv.count; i++) {
    const nx = Math.abs(n.getX(i)), ny = Math.abs(n.getY(i));
    const su = nx > 0.5 ? d : w, sv = ny > 0.5 ? d : h;
    uv.setXY(i, uv.getX(i) * su / tile[0], uv.getY(i) * sv / tile[1]);
  }
  return geo;
}

// ---------------------------------------------------------------- قوام مشتركة
let T = null;
function textures() {
  if (T) return T;
  T = {};
  T.arcade = ctex(512, 256, (x, w, h) => {
    x.fillStyle = '#efe4cf'; x.fillRect(0, 0, w, h);
    x.fillStyle = '#e2d3b6'; x.fillRect(0, 0, w, h * 0.12);
    for (let i = 0; i < 16; i++) { x.fillStyle = '#f4ead7'; x.fillRect(i * 32 + 6, 0, 20, h * 0.07); }
    for (let i = 0; i < 4; i++) {
      const cx = i * 128 + 64, top = h * 0.24, bw = 70, bh = h * 0.74;
      const arch = (inset) => { x.beginPath(); x.moveTo(cx - bw / 2 + inset, h); x.lineTo(cx - bw / 2 + inset, top + 46); x.quadraticCurveTo(cx - bw / 2 + inset, top + inset * 0.6, cx, top + inset); x.quadraticCurveTo(cx + bw / 2 - inset, top + inset * 0.6, cx + bw / 2 - inset, top + 46); x.lineTo(cx + bw / 2 - inset, h); x.closePath(); };
      arch(-8); x.fillStyle = '#f8f1e3'; x.fill();
      arch(0); const g = x.createLinearGradient(0, top, 0, h); g.addColorStop(0, '#5d4b3a'); g.addColorStop(1, '#8a735a'); x.fillStyle = g; x.fill();
      x.strokeStyle = '#d6c29c'; x.lineWidth = 3; arch(-4); x.stroke();
    }
  }, true);
  T.lattice = ctex(512, 256, (x, w, h) => {
    const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#d9b45a'); g.addColorStop(1, '#efe0b3'); x.fillStyle = g; x.fillRect(0, 0, w, h);
    x.strokeStyle = 'rgba(120,86,30,.75)'; x.lineWidth = 2;
    const s = 16;
    for (let i = -h; i < w + h; i += s) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i + h, h); x.stroke(); x.beginPath(); x.moveTo(i, h); x.lineTo(i + h, 0); x.stroke(); }
    x.fillStyle = 'rgba(255,246,215,.9)';
    for (let yy = s / 2; yy < h; yy += s) for (let xx = (yy / s) % 2 ? s / 2 : 0; xx < w; xx += s) { x.beginPath(); x.arc(xx, yy, 2.2, 0, Math.PI * 2); x.fill(); }
  }, true);
  T.minaret = ctex(128, 256, (x, w, h) => {
    x.fillStyle = '#efe5d2'; x.fillRect(0, 0, w, h);
    x.fillStyle = '#e0d1b4'; x.fillRect(0, 0, w, 8); x.fillRect(0, h - 8, w, 8);
    for (const cx of [w * 0.3, w * 0.7]) {
      x.fillStyle = '#6e5c48'; x.beginPath(); x.moveTo(cx - 9, h * 0.85); x.lineTo(cx - 9, h * 0.32); x.quadraticCurveTo(cx, h * 0.2, cx + 9, h * 0.32); x.lineTo(cx + 9, h * 0.85); x.closePath(); x.fill();
      x.strokeStyle = '#fbf5ea'; x.lineWidth = 3; x.stroke();
    }
  }, true);
  T.stone = ctex(256, 256, (x, w, h) => {
    x.fillStyle = '#e9dcc3'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 2500; i++) { x.fillStyle = `rgba(120,96,64,${Math.random() * 0.06})`; x.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
    x.strokeStyle = 'rgba(150,125,90,.25)'; x.lineWidth = 1;
    for (let yy = 0; yy < h; yy += 32) { x.beginPath(); x.moveTo(0, yy); x.lineTo(w, yy); x.stroke(); for (let xx = (yy / 32) % 2 ? 0 : 32; xx < w; xx += 64) { x.beginPath(); x.moveTo(xx, yy); x.lineTo(xx, yy + 32); x.stroke(); } }
  }, true);
  T.ochre = ctex(256, 256, (x, w, h) => {
    x.fillStyle = '#c9966c'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) { x.fillStyle = `rgba(90,55,30,${Math.random() * 0.07})`; x.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
  }, true);
  T.whiteWall = ctex(256, 256, (x, w, h) => {
    x.fillStyle = '#f7f7f4'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 1800; i++) { x.fillStyle = `rgba(90,100,110,${Math.random() * 0.05})`; x.fillRect(Math.random() * w, Math.random() * h, 3, 3); }
  }, true);
  T.mud = ctex(256, 256, (x, w, h) => {
    x.fillStyle = '#c7a67a'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 3200; i++) { x.fillStyle = `rgba(${90 + Math.random() * 40},${65 + Math.random() * 30},40,${Math.random() * 0.12})`; x.fillRect(Math.random() * w, Math.random() * h, 3, 2); }
  }, true);
  return T;
}

// ---------------------------------------------------------------- جامع السلطان قابوس الأكبر
// ---------------------------------------------------------------- دمج أجزاء المعلم لتقليل أوامر الرسم
/** يدمج كل الأجزاء الثابتة التي لها مادة متطابقة في شبكة واحدة (الأعلام المتحركة والأجزاء المتعددة المواد تبقى كما هي).
 *  الشكل النهائي مطابق تمامًا، لكن عدد أوامر الرسم ينخفض كثيرًا (الجامع مثلًا من عشرات الأجزاء إلى عدد قليل). */
export function compact(G) {
  G.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(G.matrixWorld).invert(), M = new THREE.Matrix4();
  const sig = (m) => [m.type, m.color && m.color.getHex(), m.map && m.map.uuid, m.roughness, m.metalness, m.emissive && m.emissive.getHex(), m.emissiveIntensity, m.flatShading, m.side, m.transparent, m.opacity, m.toneMapped, m.vertexColors, m.wireframe].join('|');
  const groups = new Map(), drop = [];
  G.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || o.userData.keep || Array.isArray(o.material) || o.material.isShaderMaterial || o.material.onBeforeCompile !== THREE.Material.prototype.onBeforeCompile) return;
    if (o.matrixWorld.determinant() < 0) return;                                  // تجنّب الأجزاء المعكوسة (اتجاه الوجوه)
    const k = sig(o.material); if (!groups.has(k)) groups.set(k, { mat: o.material, geos: [] });
    groups.get(k).geos.push(o.geometry.clone().applyMatrix4(M.multiplyMatrices(inv, o.matrixWorld))); drop.push(o);
  });
  for (const g of groups.values()) if (g.geos.length < 2) { g.skip = true; }
  for (const o of drop) { const k = sig(o.material); if (!groups.get(k).skip) o.parent.remove(o); }
  for (const g of groups.values()) {
    if (g.skip) continue;
    const m = new THREE.Mesh(mergeParts(g.geos), g.mat); m.castShadow = true; m.receiveShadow = true; G.add(m);
  }
  return G;
}
function mergeParts(list) {
  const out = new THREE.BufferGeometry(), P = [], N = [], U = [], I = [], hasC = !!list[0].attributes.color, C = [];
  let off = 0;
  for (const g of list) {
    const p = g.attributes.position, n = g.attributes.normal, u = g.attributes.uv, c = g.attributes.color;
    for (let i = 0; i < p.count; i++) {
      P.push(p.getX(i), p.getY(i), p.getZ(i)); N.push(n ? n.getX(i) : 0, n ? n.getY(i) : 1, n ? n.getZ(i) : 0); U.push(u ? u.getX(i) : 0, u ? u.getY(i) : 0);
      if (hasC) C.push(c ? c.getX(i) : 1, c ? c.getY(i) : 1, c ? c.getZ(i) : 1);
    }
    if (g.index) for (let i = 0; i < g.index.count; i++) I.push(g.index.getX(i) + off); else for (let i = 0; i < p.count; i++) I.push(i + off);
    off += p.count;
  }
  out.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); out.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); out.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
  if (hasC) out.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
  out.setIndex(I);
  return out;
}

export function grandMosque() {
  const t = textures(), G = new THREE.Group(); G.name = 'grandMosque';
  const cream = std({ map: t.stone, color: 0xfffaf0 }), arc = std({ map: t.arcade });
  const plinth = box(150, 1.6, 110, std({ color: 0xe9dfcb })); at(plinth, -55, 0, 0); G.add(plinth);
  // حدائق الجامع: عشب أخضر وممر من الحصى وصف من الشجيرات المشذّبة أمام الرواق (كما في الصورة)
  const lawn = new THREE.Mesh(new THREE.PlaneGeometry(40, 160), std({ color: 0x4f9a3a, roughness: 1 })); lawn.rotation.x = -Math.PI / 2; at(lawn, 22, 0.03, 0); G.add(lawn);
  const gravel = new THREE.Mesh(new THREE.PlaneGeometry(10, 160), std({ color: 0xe8e2d2, roughness: 1 })); gravel.rotation.x = -Math.PI / 2; at(gravel, 10, 0.05, 0); G.add(gravel);
  const hedgeG = new THREE.SphereGeometry(1.6, 10, 8); hedgeG.scale(1, 1.25, 1); hedgeG.translate(0, 1.7, 0);
  const hedges = new THREE.InstancedMesh(hedgeG, std({ color: 0x3f7f32, roughness: 1, flatShading: true }), 30);
  const tmp = new THREE.Object3D(); for (let k = 0; k < 30; k++) { tmp.position.set(30, 0, -72 + k * 5); tmp.scale.setScalar(0.9 + ((k * 37) % 7) / 20); tmp.updateMatrix(); hedges.setMatrixAt(k, tmp.matrix); }
  G.add(hedges);
  // الرواق الأمامي الطويل بالأقواس
  const arcG = new THREE.BoxGeometry(5, 12, 140); arcG.translate(0, 6, 0);
  const ua = arcG.attributes.uv, na = arcG.attributes.normal;
  for (let i = 0; i < ua.count; i++) { if (Math.abs(na.getX(i)) > 0.5) ua.setXY(i, ua.getX(i) * 140 / 16, ua.getY(i)); else ua.setXY(i, ua.getX(i) * 0.3, ua.getY(i) * 0.3); }
  const arcade = new THREE.Mesh(arcG, [arc, arc, cream, cream, cream, cream]); at(arcade, -4, 1.6, 0); G.add(arcade);
  for (const z of [-70, 70]) { const wing = new THREE.Mesh(new THREE.BoxGeometry(60, 12, 5).translate(-30, 6, 0), [cream, cream, cream, cream, arc, arc]); at(wing, -6, 1.6, z); G.add(wing); }
  // قاعة الصلاة المتدرجة
  const hall1 = box(54, 15, 54, cream); at(hall1, -50, 1.6, 0); G.add(hall1);
  const hall2 = box(42, 6, 42, cream); at(hall2, -50, 16.6, 0); G.add(hall2);
  const hall3 = box(32, 4, 32, cream); at(hall3, -50, 22.6, 0); G.add(hall3);
  for (let k = 0; k < 4; k++) for (let i = -3; i <= 3; i++) {
    const m = box(1.8, 1.4, 0.8, cream); const a = (k * Math.PI) / 2;
    const off = 21, along = i * 5.4;
    m.position.set(-50 + Math.cos(a) * off - Math.sin(a) * along, 22.6, Math.sin(a) * off + Math.cos(a) * along); m.rotation.y = -a; G.add(m);
  }
  // الطبلة والقبة الذهبية الشبكية
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(11, 11.5, 6, 40), std({ map: t.minaret, color: 0xfff6e6 })); at(drum, -50, 29.6, 0); G.add(drum);
  t.lattice.repeat.set(6, 2);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(11.6, 48, 24, 0, Math.PI * 2, 0, Math.PI * 0.55), std({ map: t.lattice, roughness: 0.45, metalness: 0.35 }));
  dome.scale.set(1, 1.12, 1); at(dome, -50, 32.4, 0); G.add(dome);
  const gold = std({ color: 0xd4a640, roughness: 0.3, metalness: 0.8 });
  const fin = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.45, 5, 12), gold); at(fin, -50, 47.8, 0); G.add(fin);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.8, 14, 10), gold); at(ball, -50, 47.0, 0); G.add(ball);
  // المآذن: الكبرى أمام الرواق، وأربع أصغر على الأركان
  const minaret = (H, w) => {
    const g = new THREE.Group(), tiers = 5, mm = std({ map: t.minaret, color: 0xfffbf2 });
    let y = 0, cw = w;
    for (let i = 0; i < tiers; i++) {
      const th = (H * 0.78) / tiers;
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(cw * 0.5, cw * 0.52, th, 8), mm); shaft.rotation.y = Math.PI / 8; at(shaft, 0, y + th / 2, 0); g.add(shaft);
      const bal = new THREE.Mesh(new THREE.CylinderGeometry(cw * 0.66, cw * 0.56, th * 0.08, 8), cream); bal.rotation.y = Math.PI / 8; at(bal, 0, y + th, 0); g.add(bal);
      y += th; cw *= 0.9;
    }
    const lant = new THREE.Mesh(new THREE.CylinderGeometry(cw * 0.42, cw * 0.48, H * 0.1, 8), mm); at(lant, 0, y + H * 0.05, 0); g.add(lant);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(cw * 0.45, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), cream); cap.scale.y = 1.4; at(cap, 0, y + H * 0.1, 0); g.add(cap);
    const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.2, H * 0.07, 8), gold); at(sp, 0, y + H * 0.1 + cw * 0.6, 0); g.add(sp);
    return g;
  };
  G.add(at(minaret(78, 6.2), -8, 1.6, -58));
  for (const [dx, dz] of [[-2, 64], [-90, -64], [-90, 64], [-30, -66]]) G.add(at(minaret(36, 3.4), dx, 1.6, dz));
  G.userData.half = 80; G.userData.depth = 150;
  return G;
}

// ---------------------------------------------------------------- بوابة سوق مطرح
function souqFront(w, h) {
  return ctex(512, 512, (x, W, H) => {
    x.fillStyle = '#c9966c'; x.fillRect(0, 0, W, H);
    for (let i = 0; i < 3500; i++) { x.fillStyle = `rgba(90,55,30,${Math.random() * 0.07})`; x.fillRect(Math.random() * W, Math.random() * H, 2, 2); }
    // القوس المدبّب (Ogee) بإطار حجري أبيض
    const cx = W / 2, top = H * 0.27, bw = W * 0.62, base = H * 0.98;
    const ogee = (k) => { const hw = bw / 2 + k; x.beginPath(); x.moveTo(cx - hw, base); x.lineTo(cx - hw, H * 0.6); x.bezierCurveTo(cx - hw, top + H * 0.12, cx - 8, top + H * 0.08, cx, top - k); x.bezierCurveTo(cx + 8, top + H * 0.08, cx + hw, top + H * 0.12, cx + hw, H * 0.6); x.lineTo(cx + hw, base); x.closePath(); };
    ogee(22); x.fillStyle = '#efe7d6'; x.fill();
    for (let a = 0; a < 18; a++) { x.strokeStyle = 'rgba(150,120,80,.35)'; x.lineWidth = 1.5; }
    ogee(0); const g = x.createLinearGradient(0, top, 0, base); g.addColorStop(0, '#3c2e22'); g.addColorStop(1, '#7a6048'); x.fillStyle = g; x.fill();
    // درابزين مشبّك أبيض
    x.fillStyle = '#f2eee6'; x.fillRect(cx - bw / 2, H * 0.74, bw, H * 0.12);
    x.fillStyle = '#8a7660';
    for (let i = 0; i < 18; i++) for (let j = 0; j < 3; j++) { x.beginPath(); x.arc(cx - bw / 2 + 12 + i * (bw - 24) / 17, H * 0.76 + j * 18 + 6, 4, 0, Math.PI * 2); x.fill(); }
    // اللوحة
    x.fillStyle = '#4b3b2a'; x.font = `900 ${H * 0.11}px Cairo, Tahoma, Arial`; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText('سوق مطرح', cx, H * 0.15);
    x.fillStyle = '#f4efe5'; for (const sx of [-1, 1]) for (let k = 0; k < 3; k++) x.fillRect(cx + sx * W * 0.38 + k * 12 - 18, H * 0.11, 7, H * 0.08);
    void w; void h;
  });
}
export function souqGate() {
  const t = textures(), G = new THREE.Group(); G.name = 'souqGate';
  const W = 15, H = 17, D = 14;
  const front = std({ map: souqFront(W, H) }), side = std({ map: t.ochre });
  const body = new THREE.Mesh(new THREE.BoxGeometry(D, H, W).translate(-D / 2, H / 2, 0), [front, side, side, side, side, side]);
  // الوجه ‎+X هو الأمامي (المادة الأولى)
  G.add(body);
  for (const sz of [-1, 1]) for (const sx of [0, -D]) {
    const m = new THREE.Mesh(new THREE.ConeGeometry(0.9, 2.4, 4), side); m.rotation.y = Math.PI / 4; at(m, sx + (sx ? 0.9 : -0.9), H + 1.2, sz * (W / 2 - 0.9)); G.add(m);
  }
  const glass = new THREE.MeshStandardMaterial({ color: 0x24524a, roughness: 0.15, metalness: 0.6, transparent: true, opacity: 0.85 });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(5.2, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), glass); at(dome, -D / 2, H, 0); G.add(dome);
  const ribs = new THREE.Mesh(new THREE.SphereGeometry(5.25, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x1a2a26, wireframe: true })); at(ribs, -D / 2, H, 0); G.add(ribs);
  // جناحان أبيضان بنوافذ مقوّسة
  for (const sz of [-1, 1]) { const wing = box(10, 11, 16, std({ map: t.whiteWall })); at(wing, -6, 0, sz * (W / 2 + 8)); G.add(wing); }
  G.userData.half = 18; G.userData.depth = 16;
  return G;
}

// ---------------------------------------------------------------- مبنى وزارة التربية والتعليم
function ministryFacade(cols, floors, withSign) {
  return ctex(1024, 768, (x, W, H) => {
    x.fillStyle = '#e8dcc6'; x.fillRect(0, 0, W, H);
    for (let i = 0; i < 6000; i++) { x.fillStyle = `rgba(120,96,64,${Math.random() * 0.05})`; x.fillRect(Math.random() * W, Math.random() * H, 2, 2); }
    x.fillStyle = '#b9614c'; x.fillRect(0, H * 0.86, W, H * 0.14);                       // الشريط الأرضي المائل للحمرة
    x.fillStyle = '#d7c7aa'; x.fillRect(0, 0, W, H * 0.05);
    const cw = W / cols, fh = (H * 0.8) / floors;
    for (let f = 0; f < floors; f++) for (let c = 0; c < cols; c++) {
      const wx = c * cw + cw * 0.22, wy = H * 0.07 + f * fh + fh * 0.18, ww = cw * 0.56, wh = fh * 0.66;
      x.fillStyle = '#f6efe2'; x.fillRect(wx - 4, wy - 4, ww + 8, wh + 8);
      x.beginPath(); x.moveTo(wx, wy + wh); x.lineTo(wx, wy + ww / 2); x.arc(wx + ww / 2, wy + ww / 2, ww / 2, Math.PI, 0); x.lineTo(wx + ww, wy + wh); x.closePath();
      const g = x.createLinearGradient(0, wy, 0, wy + wh); g.addColorStop(0, '#5f86a8'); g.addColorStop(1, '#2f4f6e'); x.fillStyle = g; x.fill();
      x.strokeStyle = '#e9e2d4'; x.lineWidth = 2; x.beginPath(); x.moveTo(wx + ww / 2, wy + 4); x.lineTo(wx + ww / 2, wy + wh); x.stroke();
    }
    for (let i = 0; i < W; i += 22) { x.fillStyle = '#f0e6d4'; x.fillRect(i, 0, 12, H * 0.025); }
    if (withSign) {
      x.fillStyle = 'rgba(245,238,226,.95)'; x.fillRect(W * 0.18, H * 0.02, W * 0.64, H * 0.1);
      x.fillStyle = '#3d3226'; x.font = `800 ${H * 0.07}px Cairo, Tahoma, Arial`; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText('وزارة التربية والتعليم', W / 2, H * 0.072);
    }
  });
}
function portalFace() {
  return ctex(512, 1024, (x, W, H) => {
    x.fillStyle = '#ece2cf'; x.fillRect(0, 0, W, H);
    for (let i = 0; i < 4000; i++) { x.fillStyle = `rgba(120,96,64,${Math.random() * 0.05})`; x.fillRect(Math.random() * W, Math.random() * H, 2, 2); }
    // لوحة الوزارة فوق البوابة
    x.fillStyle = '#3d3226'; x.font = `800 ${W * 0.075}px Cairo, Tahoma, Arial`; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText('وزارة التربية والتعليم', W / 2, H * 0.36);
    // نوافذ مقوّسة صغيرة أعلى البوابة
    for (let i = 0; i < 4; i++) { const wx = W * 0.2 + i * W * 0.16, wy = H * 0.12; x.fillStyle = '#3f6688'; x.beginPath(); x.moveTo(wx, wy + 70); x.lineTo(wx, wy + 22); x.arc(wx + 22, wy + 22, 22, Math.PI, 0); x.lineTo(wx + 44, wy + 70); x.closePath(); x.fill(); }
    // البوابة الكبرى المقوّسة بإطار حجري وباب خشبي
    const dx = W * 0.22, dw = W * 0.56, dy = H * 0.44, dh = H * 0.5;
    x.fillStyle = '#b25e48'; x.beginPath(); x.moveTo(dx - 20, dy + dh); x.lineTo(dx - 20, dy + dw / 2); x.arc(dx + dw / 2, dy + dw / 2, dw / 2 + 20, Math.PI, 0); x.lineTo(dx + dw + 20, dy + dh); x.closePath(); x.fill();
    x.fillStyle = '#6d3f22'; x.beginPath(); x.moveTo(dx, dy + dh); x.lineTo(dx, dy + dw / 2); x.arc(dx + dw / 2, dy + dw / 2, dw / 2, Math.PI, 0); x.lineTo(dx + dw, dy + dh); x.closePath(); x.fill();
    x.fillStyle = '#2f5a86'; x.beginPath(); x.arc(dx + dw / 2, dy + dw / 2, dw / 2 - 18, Math.PI, 0); x.fill();
    x.strokeStyle = '#a8794a'; x.lineWidth = 4; for (let k = 1; k < 4; k++) { x.beginPath(); x.moveTo(dx + (dw * k) / 4, dy + dw / 2); x.lineTo(dx + (dw * k) / 4, dy + dh); x.stroke(); }
  });
}
export function ministryBuilding(U) {
  const t = textures(), G = new THREE.Group(); G.name = 'ministry';
  const side = std({ map: t.stone });
  const wing = (w, h, d, cols, floors) => new THREE.Mesh(new THREE.BoxGeometry(d, h, w).translate(-d / 2, h / 2, 0), [std({ map: ministryFacade(cols, floors, false) }), side, side, side, side, side]);
  for (const sz of [-1, 1]) G.add(at(wing(26, 19, 20, 6, 5), -3, 0, sz * 22));
  const center = new THREE.Mesh(new THREE.BoxGeometry(22, 25, 18).translate(-11, 12.5, 0), [std({ map: portalFace() }), side, side, side, side, side]); G.add(center);
  const cap = box(23, 1.2, 19, std({ color: 0xe0d2b6 })); at(cap, -11, 25, 0); G.add(cap);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(4, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), std({ color: 0xf3ede2 })); at(dome, -11, 26.2, 0); G.add(dome);
  // درجات ومنصة
  for (let k = 0; k < 4; k++) G.add(at(box(4 - k * 0.8 + 2, 0.3, 14, std({ color: 0xa8584a })), 2 - k * 0.8, k * 0.3, 0));
  // سارية وعلم
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 9, 8), std({ color: 0xd7dce2, metalness: 0.8, roughness: 0.3 })); at(pole, -11, 30.5, 0); G.add(pole);
  if (U) { const L = 3.6, y0 = 34.6 - L / FLAG_ASPECT; const f = new THREE.Mesh(flagGeometry(L, y0, 16, 5), clothMaterial(U, { L, y0, key: 'cloth-lm' })); f.userData.keep = true; f.rotation.y = Math.PI / 2; at(f, -11, 0, 0); G.add(f); }
  G.userData.half = 37; G.userData.depth = 24;
  return G;
}

// ---------------------------------------------------------------- منصة الصورة الرسمية (ميدان)
export function portraitStand(imgTex, aspect, U) {
  const G = new THREE.Group(); G.name = 'portrait';
  const marble = std({ color: 0xf4f1ea, roughness: 0.35 }), gold = std({ color: 0xc9a043, roughness: 0.3, metalness: 0.85 });
  const H = 7.4, W = H * aspect, base = 2.2;
  G.add(at(box(2.4, base, W + 3.4, marble), -1.2, 0, 0));
  G.add(at(box(3.2, 0.35, W + 4.4, std({ color: 0xd9d2c4 })), -1.2, 0, 0));
  // الإطار الذهبي (أربعة أضلاع بارزة) واللوحة
  const fr = 0.45;
  const bar = (w, h) => new THREE.Mesh(new THREE.BoxGeometry(0.5, h, w), gold);
  G.add(at(bar(W + fr * 2, fr), -1.1, base + H + fr / 2, 0)); G.add(at(bar(W + fr * 2, fr), -1.1, base - fr / 2 + 0.2, 0));
  for (const s of [-1, 1]) G.add(at(bar(fr, H + fr), -1.1, base + H / 2 + 0.1, s * (W / 2 + fr / 2)));
  const crest = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.9, 1.1, 3), gold); crest.rotation.x = Math.PI / 2; crest.rotation.z = Math.PI / 2; at(crest, -1.1, base + H + 1.0, 0); G.add(crest);
  const back = box(0.3, H + 0.2, W + 0.2, std({ color: 0x2a2017 })); at(back, -1.45, base + 0.1, 0); G.add(back);
  const pic = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshBasicMaterial({ map: imgTex, toneMapped: false }));
  pic.rotation.y = Math.PI / 2; at(pic, -1.05, base + H / 2 + 0.2, 0); G.add(pic);
  // علمان على الجانبين وأحواض زهور
  const pm = std({ color: 0xd7dce2, metalness: 0.8, roughness: 0.3 });
  for (const s of [-1, 1]) {
    const z = s * (W / 2 + 4.2);
    G.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 11, 8).translate(0, 5.5, 0), pm), -1, 0, z));
    if (U) { const L = 3, y0 = 10.8 - L / FLAG_ASPECT; const f = new THREE.Mesh(flagGeometry(L, y0, 16, 5), clothMaterial(U, { L, y0, key: 'cloth-lm' })); f.userData.keep = true; f.rotation.y = s > 0 ? -Math.PI / 2 + 0.5 : Math.PI / 2 - 0.5; at(f, -1, 0, z); G.add(f); }
    const bed = box(2.6, 0.5, 3.4, std({ color: 0x6a4a32 })); at(bed, 0.6, 0, s * (W / 2 + 1.6)); G.add(bed);
    for (let k = 0; k < 14; k++) { const fl = new THREE.Mesh(new THREE.SphereGeometry(0.22, 6, 5), std({ color: [0xe63958, 0xffffff, 0xf28aa6][k % 3] })); at(fl, 0.6 + (Math.random() - 0.5) * 2.2, 0.62, s * (W / 2 + 1.6) + (Math.random() - 0.5) * 3); G.add(fl); }
  }
  G.userData.half = W / 2 + 6; G.userData.depth = 4;
  return G;
}

// ---------------------------------------------------------------- برج حصن على تلّة
export function fortHill(scale = 1) {
  const t = textures(), G = new THREE.Group(); G.name = 'fort';
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x7a6250, roughness: 1, flatShading: true });
  const hill = new THREE.IcosahedronGeometry(16, 2); const p = hill.attributes.position;
  for (let i = 0; i < p.count; i++) { const y = p.getY(i); const k = 1 + Math.sin(p.getX(i) * 0.7 + p.getZ(i) * 0.5) * 0.12 + Math.cos(p.getZ(i) * 1.3) * 0.08; p.setXYZ(i, p.getX(i) * k * 1.3, Math.max(-4, y) * (y > 0 ? 0.75 : 1), p.getZ(i) * k); }
  hill.computeVertexNormals();
  G.add(at(new THREE.Mesh(hill, rockMat), -14, 0, 0));
  const mud = std({ map: t.mud });
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 4.2, 10, 24), mud); at(tower, -14, 16, 0); G.add(tower);
  for (let k = 0; k < 16; k++) { const a = (k / 16) * Math.PI * 2; const m = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 0.7, 3, 8), mud); at(m, -14 + Math.cos(a) * 3.5, 21.5, Math.sin(a) * 3.5); G.add(m); }
  const wall = new THREE.Mesh(new THREE.BoxGeometry(10, 3.5, 1).translate(0, 1.75, 0), mud); wall.rotation.y = 0.6; at(wall, -9, 11, 4); G.add(wall);
  for (let k = 0; k < 6; k++) { const m = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 0.4, 3, 6), mud); m.position.set(-9 + Math.cos(0.6) * (k - 2.5) * 1.6, 14.9, 4 - Math.sin(0.6) * (k - 2.5) * 1.6); G.add(m); }
  G.scale.setScalar(scale);
  G.userData.half = 26 * scale; G.userData.depth = 34 * scale;
  return G;
}

// ---------------------------------------------------------------- كشك/دكان بمذياع (مصدر المقاطع الوطنية عند المرور)
export function radioKiosk() {
  const t = textures(), G = new THREE.Group(); G.name = 'kiosk';
  const wall = std({ map: t.whiteWall });
  G.add(at(box(3.2, 3.4, 4.4, wall), -1.6, 0, 0));
  const door = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 2.3), std({ color: 0x7a4a26 })); door.rotation.y = Math.PI / 2; at(door, 0.01, 1.15, 0.6); G.add(door);
  const win = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.0), std({ color: 0x35506a, roughness: 0.2 })); win.rotation.y = Math.PI / 2; at(win, 0.01, 1.8, -1.2); G.add(win);
  const awn = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.08, 4.6), std({ map: ctex(64, 256, (x, w, h) => { for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? '#1f7a4b' : '#ffffff'; x.fillRect(0, i * h / 8, w, h / 8); } }) }));
  awn.rotation.z = -0.25; at(awn, 0.6, 3.0, 0); G.add(awn);
  // مذياع صغير على رفّ عند الباب
  const radio = box(0.55, 0.32, 0.22, std({ color: 0x6b3d22, roughness: 0.5 })); at(radio, 0.35, 1.05, -0.55); G.add(radio);
  const grill = new THREE.Mesh(new THREE.CircleGeometry(0.1, 14), std({ color: 0xd4c4a0 })); grill.rotation.y = Math.PI / 2; at(grill, 0.63, 1.21, -0.55); G.add(grill);
  G.add(at(box(0.8, 0.06, 0.4, std({ color: 0x8b6a4a })), 0.35, 0.98, -0.55));
  G.userData.half = 3; G.userData.depth = 4; G.userData.radio = true;
  return G;
}

// ---------------------------------------------------------------- عناصر الشارع العُماني
/** واجهة بيت مسقطي أبيض: شرفات مسننة، نوافذ صغيرة بأغطية مكيفات مشبّكة، باب خشبي مقوّس */
export function muscatHouseTex() {
  return ctex(512, 512, (x, w, h) => {
    x.fillStyle = '#f8f8f5'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 2500; i++) { x.fillStyle = `rgba(80,90,100,${Math.random() * 0.045})`; x.fillRect(Math.random() * w, Math.random() * h, 3, 3); }
    x.fillStyle = '#eceeee'; x.fillRect(0, h * 0.08, w, h * 0.03);
    const win = (cx, cy) => {
      x.fillStyle = '#20384f'; x.fillRect(cx - 22, cy - 34, 44, 64);
      x.strokeStyle = '#ffffff'; x.lineWidth = 6; x.beginPath(); x.arc(cx, cy - 34, 26, Math.PI, 0); x.stroke();
      x.fillStyle = '#ffffff'; x.fillRect(cx - 34, cy + 34, 68, 30);
      x.fillStyle = '#b9c2c8'; for (let k = 0; k < 5; k++) { x.beginPath(); x.ellipse(cx - 24 + k * 12, cy + 49, 3.5, 8, 0, 0, Math.PI * 2); x.fill(); }
    };
    win(w * 0.2, h * 0.38); win(w * 0.8, h * 0.38); win(w * 0.8, h * 0.72);
    x.fillStyle = '#8a5a32'; x.fillRect(w * 0.38, h * 0.6, w * 0.18, h * 0.4);
    x.strokeStyle = '#6a4224'; x.lineWidth = 3; x.strokeRect(w * 0.4, h * 0.63, w * 0.14, h * 0.35);
    x.strokeStyle = '#ffffff'; x.lineWidth = 8; x.beginPath(); x.arc(w * 0.47, h * 0.6, w * 0.1, Math.PI, 0); x.stroke();
    x.fillStyle = '#5f6468'; x.fillRect(0, h * 0.94, w, h * 0.06);
  });
}
/** عمود إنارة كورنيش مطرح: أسود بحلقات ذهبية وذراعان ملتفان بفانوسين */
export function ornateLampGeo() {
  const parts = [];
  const pole = new THREE.CylinderGeometry(0.09, 0.14, 6.4, 10); pole.translate(0, 3.2, 0); parts.push(pole);
  const base = new THREE.CylinderGeometry(0.28, 0.34, 0.9, 10); base.translate(0, 0.45, 0); parts.push(base);
  for (const y of [1.0, 4.2, 6.3]) { const r = new THREE.TorusGeometry(0.15, 0.035, 6, 14); r.rotateX(Math.PI / 2); r.translate(0, y, 0); parts.push(r); }
  for (const s of [-1, 1]) {
    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 6.0, 0), new THREE.Vector3(s * 0.5, 6.5, 0), new THREE.Vector3(s * 0.95, 6.35, 0), new THREE.Vector3(s * 1.05, 6.0, 0), new THREE.Vector3(s * 0.85, 5.85, 0)]);
    parts.push(new THREE.TubeGeometry(curve, 16, 0.04, 6, false));
    const lan = new THREE.CylinderGeometry(0.16, 0.12, 0.42, 8); lan.translate(s * 1.0, 6.25, 0); parts.push(lan);
    const top = new THREE.ConeGeometry(0.2, 0.22, 8); top.translate(s * 1.0, 6.56, 0); parts.push(top);
  }
  const finial = new THREE.ConeGeometry(0.07, 0.5, 8); finial.translate(0, 6.85, 0); parts.push(finial);
  return parts;
}
/** تلال صخرية قريبة (شريط بطول L وعمق D): ارتفاعات متعرجة بخطوط طبقات، تتضاءل عند الطرفين ليلتحم الشريط بجاره */
export function ridgeGeometry(L, D, hMin, hMax, seed) {
  const nz = 40, nx = 12;
  const g = new THREE.PlaneGeometry(D, L, nx, nz); g.rotateX(-Math.PI / 2);
  const p = g.attributes.position, col = [];
  const rnd = (a) => { const v = Math.sin(a * 12.9898 + seed * 78.233) * 43758.5453; return v - Math.floor(v); };
  const peaks = Array.from({ length: 6 }, (_, i) => ({ z: (rnd(i) - 0.5) * L * 0.9, x: (rnd(i + 9) - 0.2) * D * 0.6, h: hMin + rnd(i + 3) * (hMax - hMin), r: L * (0.12 + rnd(i + 5) * 0.12) }));
  const c = new THREE.Color(), lo = new THREE.Color('#6a5242'), hi = new THREE.Color('#a48a70'), dark = new THREE.Color('#4b3a2f');
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    const edgeX = Math.min(1, (D / 2 - x) / (D * 0.25)) * Math.min(1, (x + D / 2) / (D * 0.12));
    const edgeZ = Math.min(1, (L / 2 - Math.abs(z)) / (L * 0.18));
    let h = 0; for (const pk of peaks) { const d = Math.hypot((z - pk.z) / pk.r, (x - pk.x) / (pk.r * 0.8)); h = Math.max(h, pk.h * Math.max(0, 1 - d * d * 0.7)); }
    h += (Math.sin(z * 0.37 + x * 0.21 + seed) + Math.sin(z * 0.91 - x * 0.53) * 0.5) * 2.4;
    h = Math.max(-2, h * Math.max(0, edgeX) * Math.max(0.15, edgeZ));
    p.setY(i, h);
    const f = Math.min(1, Math.max(0, h / hMax));
    c.copy(lo).lerp(hi, f).lerp(dark, Math.max(0, Math.sin(h * 0.9 + z * 0.05)) * 0.35);
    col.push(c.r, c.g, c.b);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}
