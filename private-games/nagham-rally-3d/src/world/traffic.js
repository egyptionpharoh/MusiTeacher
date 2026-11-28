// =====================================================================
//  حركة المرور العُمانية: نماذج منخفضة التكلفة (هندسة واحدة بألوان رؤوس لكل نوع ← InstancedMesh واحد لكل نوع)
//   • حافلة «مواصلات» الحمراء للمدن (هيكل أحمر بالكامل، نوافذ داكنة، باب أمامي)
//   • سيارة الأجرة العُمانية بلونيها البرتقالي والأبيض ولافتة «تاكسي» على السقف
//   • سيارات خاصة (بيضاء وفضية) ودفع رباعي أبيض
//  تتحرك في الشوارع الداخلية خلف صف المباني (اتجاهان)، وفي الشارع العرضي أسفل الجسور العلوية. لا تدخل أبدًا حارات السباق.
// =====================================================================
import * as THREE from 'three';
import { dipMaterial, RAMP } from './bend.js';

const C = (hex) => new THREE.Color(hex);
/** صندوق ملوّن (لون رؤوس) مضاف إلى قائمة أجزاء */
function part(list, w, h, d, x, y, z, color) {
  const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y + h / 2, z);
  const c = C(color), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3)); list.push(g.toNonIndexed());
}
function wheels(list, len, track, r, xs) { for (const z of xs) for (const s of [-1, 1]) { const g = new THREE.CylinderGeometry(r, r, 0.34, 10); g.rotateZ(Math.PI / 2); g.translate(s * track, r, z * len); const c = C('#1b1b1d'), n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); list.push(g.toNonIndexed()); } }
function merge(list) {
  const out = new THREE.BufferGeometry(), keys = ['position', 'normal', 'color'];
  for (const k of keys) { const arrs = list.map((g) => g.attributes[k].array); const tot = arrs.reduce((s, a) => s + a.length, 0); const A = new Float32Array(tot); let o = 0; for (const a of arrs) { A.set(a, o); o += a.length; } out.setAttribute(k, new THREE.BufferAttribute(A, 3)); }
  return out;
}
/** الطول على المحور z (المقدمة نحو −z) */
export function busGeometry() {
  const L = [], RED = '#c8102e', GL = '#1d2a35';
  part(L, 2.55, 2.75, 12, 0, 0.42, 0, RED);                    // الهيكل
  part(L, 2.6, 0.95, 10.4, 0, 1.75, 0.5, GL);                  // شريط النوافذ الجانبي
  part(L, 2.4, 1.5, 0.08, 0, 1.45, -6.02, GL);                 // الزجاج الأمامي
  part(L, 2.0, 0.32, 0.06, 0, 3.0, -6.03, '#111418');          // لوحة الوجهة
  part(L, 0.7, 2.05, 0.1, 1.29, 0.48, -4.6, GL);               // الباب الأمامي
  part(L, 2.58, 0.18, 12.02, 0, 0.62, 0, '#ffffff');           // خط أبيض سفلي
  part(L, 2.3, 0.3, 4.5, 0, 3.17, 1.5, '#d9d9d9');             // وحدة التكييف
  for (const s of [-1, 1]) part(L, 0.4, 0.22, 0.06, s * 0.9, 0.75, -6.03, '#fff6d8');   // المصابيح
  wheels(L, 12, 1.15, 0.5, [-0.33, 0.33]);
  return merge(L);
}
export function taxiGeometry() {
  const L = [], W = '#f7f7f4', O = '#f28c18', GL = '#22303a';
  part(L, 1.82, 0.72, 4.6, 0, 0.32, 0, W);                     // الجسم (أبيض)
  part(L, 1.84, 0.74, 1.15, 0, 0.31, -1.75, O);                // مقدمة وأجنحة أمامية برتقالية
  part(L, 1.84, 0.74, 1.0, 0, 0.31, 1.8, O);                   // المؤخرة برتقالية
  part(L, 1.6, 0.62, 2.3, 0, 1.04, 0.15, W);                   // المقصورة
  part(L, 1.62, 0.44, 2.32, 0, 1.12, 0.15, GL);                // الزجاج
  part(L, 0.7, 0.24, 0.32, 0, 1.66, 0.1, O);                   // لافتة تاكسي
  for (const s of [-1, 1]) part(L, 0.34, 0.14, 0.05, s * 0.62, 0.62, -2.31, '#fff6d8');
  wheels(L, 4.6, 0.82, 0.33, [-0.3, 0.31]);
  return merge(L);
}
export function carGeometry(color = '#f3f3f3', suv = false) {
  const L = [], GL = '#22303a', h = suv ? 0.95 : 0.72, len = suv ? 4.9 : 4.5;
  part(L, 1.86, h, len, 0, 0.32, 0, color);
  part(L, 1.66, suv ? 0.78 : 0.6, suv ? 3.0 : 2.2, 0, 0.32 + h, suv ? 0.35 : 0.15, color);
  part(L, 1.68, suv ? 0.5 : 0.42, suv ? 3.02 : 2.22, 0, 0.4 + h, suv ? 0.35 : 0.15, GL);
  for (const s of [-1, 1]) part(L, 0.34, 0.14, 0.05, s * 0.62, 0.62, -len / 2 - 0.01, '#fff6d8');
  wheels(L, len, 0.84, suv ? 0.4 : 0.33, [-0.3, 0.31]);
  return merge(L);
}
function mergePlain(list) {
  const out = new THREE.BufferGeometry(), P = [], N = [], I = []; let o = 0;
  for (const g of list) { const p = g.attributes.position, n = g.attributes.normal; for (let i = 0; i < p.count; i++) { P.push(p.getX(i), p.getY(i), p.getZ(i)); N.push(n.getX(i), n.getY(i), n.getZ(i)); } for (let i = 0; i < g.index.count; i++) I.push(g.index.getX(i) + o); o += p.count; }
  out.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); out.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); out.setIndex(I); return out;
}
const KINDS = () => [
  { geo: busGeometry(), len: 12, w: 1 },
  { geo: taxiGeometry(), len: 4.6, w: 3 },
  { geo: carGeometry('#f3f3f3', true), len: 4.9, w: 2 },
  { geo: carGeometry('#c9ccd1'), len: 4.5, w: 2 },
  { geo: carGeometry('#ffffff'), len: 4.5, w: 2 },
];
const pickKind = (r, kinds) => { const tot = kinds.reduce((s, k) => s + k.w, 0); let v = r * tot; for (let i = 0; i < kinds.length; i++) { v -= kinds[i].w; if (v <= 0) return i; } return 0; };

/** شارع داخلي موازٍ للطريق (خلف صف المباني) بحركة في الاتجاهين. lanes: [{x, dir}] — dir −1 مع اتجاه السائق، +1 معاكس */
export class StreetTraffic {
  constructor(root, lanes, perLane = 5, seed = 7, terrain = false) {
    this.kinds = KINDS(); this.lanes = lanes; this.cars = []; this.tmp = new THREE.Object3D();
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.15 });
    if (terrain) dipMaterial(mat);
    let s = seed; const r = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
    // المسافات بين المركبات في الحارة الواحدة ثابتة والسرعة واحدة لكل حارة ← لا تصادم ولا تداخل أبدًا
    lanes.forEach((ln, li) => { const v = (ln.dir < 0 ? 9 : 12) + r() * 4, gap = 470 / perLane; for (let k = 0; k < perLane; k++) this.cars.push({ li, kind: pickKind(r(), this.kinds), z: -k * gap - r() * gap * 0.4 - li * 11, v }); });
    this.meshes = this.kinds.map((K, ki) => { const n = Math.max(1, this.cars.filter((c) => c.kind === ki).length); const im = new THREE.InstancedMesh(K.geo, mat, n); im.frustumCulled = false; im.castShadow = false; im.receiveShadow = true; root.add(im); return im; });
  }
  update(zCar, dt) {
    const cnt = this.kinds.map(() => 0), t = this.tmp;
    for (const c of this.cars) {
      const ln = this.lanes[c.li];
      c.z += ln.dir * c.v * dt;
      if (c.z > zCar + 60) c.z -= 470; else if (c.z < zCar - 430) c.z += 470;       // يعاد تدويرها حول السائق
      if (this.hide && this.hide(c.z, ln)) continue;                                // لا تمر عبر معلم أو خارج حدود محطتها
      t.position.set(ln.x, 0, c.z); t.rotation.set(0, ln.dir > 0 ? Math.PI : 0, 0); t.scale.set(1, 1, 1); t.updateMatrix();
      this.meshes[c.kind].setMatrixAt(cnt[c.kind]++, t.matrix);
    }
    this.meshes.forEach((m, i) => { m.count = cnt[i]; m.instanceMatrix.needsUpdate = true; });
  }
}

/** جسر علوي (تقاطع): الطريق يصعد فوق شارع عرضي تمر تحته الحافلات وسيارات الأجرة (مثل تقاطعات طريق السلطان قابوس) */
export function flyover(ROAD_W) {
  const G = new THREE.Group(); G.name = 'flyover';
  const HALF = 16, DEPTH = 7.2, W = ROAD_W / 2 + 6.1;        // نصف عرض الهيكل: الطريق + الرصيفان
  const conc = new THREE.MeshStandardMaterial({ color: 0xd8d2c6, roughness: 0.85 }), wall = new THREE.MeshStandardMaterial({ color: 0xcfc5b3, roughness: 0.9 }), rail = new THREE.MeshStandardMaterial({ color: 0xeeeae2, roughness: 0.6 });
  const seg = (w, h, d, x, y, z, m, nz = 40) => { const g = new THREE.BoxGeometry(w, h, d, 1, 1, nz); g.translate(x, y + h / 2, z); G.add(new THREE.Mesh(g, m)); };
  for (const s of [-1, 1]) {
    seg(0.5, 1.1, 2 * HALF + 2, s * W, 0, 0, rail, 12);                                        // حاجز السطح
    for (const e of [-1, 1]) seg(0.7, 13.2, RAMP + 2, s * W, -12, e * (HALF + RAMP / 2), wall, 40);   // جدارا المنحدر الساندان (يمتدان تحت الأرض)
  }
  seg(2 * W, 1.3, 2 * HALF + 3, 0, -1.9, 0, conc, 12);                                         // بلاطة السطح
  for (const e of [-1, 1]) seg(2 * W + 1.4, 14, 2.2, 0, -15.6, e * (HALF + 0.4), conc, 1);      // الدعامتان عند طرفي الفتحة
  // الشارع العرضي على مستوى الأرض (مادة أرض: ينخفض مع صعود السائق فيبقى تحت الجسر)
  const asph = dipMaterial(new THREE.MeshStandardMaterial({ color: 0x3a3d42, roughness: 0.95 }));
  { const g = new THREE.PlaneGeometry(520, 13); g.rotateX(-Math.PI / 2); g.translate(0, 0.04, 0); G.add(new THREE.Mesh(g, asph)); }
  const lineM = dipMaterial(new THREE.MeshBasicMaterial({ color: 0xf4f1e6 }));
  { const L = []; for (let x = -250; x < 250; x += 9) { const g = new THREE.PlaneGeometry(4, 0.22); g.rotateX(-Math.PI / 2); g.translate(x, 0.06, 0); L.push(g); } const m = new THREE.Mesh(mergePlain(L), lineM); G.add(m); }
  // حركة المرور أسفل الجسر (عبر الشاشة يمينًا ويسارًا)
  const kinds = KINDS(), mat = dipMaterial(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.15 }));
  const cars = []; let s = 11; const r = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (const dir of [-1, 1]) { const v = 10 + r() * 5; for (let k = 0; k < 6; k++) cars.push({ dir, kind: pickKind(r(), kinds), x: -240 + k * 80 + r() * 30, v }); }   // سرعة واحدة لكل اتجاه ← لا تصادم
  const ims = kinds.map((K, ki) => { const n = Math.max(1, cars.filter((c) => c.kind === ki).length); const im = new THREE.InstancedMesh(K.geo, mat, n); im.frustumCulled = false; im.userData.keep = true; G.add(im); return im; });
  const t = new THREE.Object3D();
  G.userData.tick = (dt) => {
    const cnt = kinds.map(() => 0);
    for (const c of cars) {
      c.x += c.dir * c.v * dt; if (c.x > 250) c.x -= 500; if (c.x < -250) c.x += 500;
      t.position.set(c.x, 0, c.dir * 3.2); t.rotation.set(0, c.dir > 0 ? -Math.PI / 2 : Math.PI / 2, 0); t.updateMatrix();
      ims[c.kind].setMatrixAt(cnt[c.kind]++, t.matrix);
    }
    ims.forEach((m, i) => { m.count = cnt[i]; m.instanceMatrix.needsUpdate = true; });
  };
  G.userData.tick(0);
  G.userData.half = HALF + RAMP; G.userData.depth = 60; G.userData.dip = { half: HALF, depth: DEPTH }; G.userData.lookY = 3; G.userData.orbitR = 70;
  return G;
}
