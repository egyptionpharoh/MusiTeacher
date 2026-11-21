// =====================================================================
//  نماذج الآلات الخمس — كل آلة ببنيتها الخاصة (لا نموذج واحد بألوان مختلفة). الوحدات بالمتر والمقاسات قريبة من الحقيقية.
//  كل دالة تعيد { group, head, R, top, jingles[], height } حيث head هي الرقمة القابلة للعزف (تتموّج عند الضرب).
//  الأجزاء المسمّاة تحمل userData.part = { n: الاسم, d: الوصف } لوضع «اكتشف».
// =====================================================================
import * as THREE from 'three';
import { skinTexture, woodTexture, inlayTexture, ropeTexture } from './textures.js';

const part = (m, n, d) => { if (n) m.userData.part = { n, d }; m.castShadow = true; m.receiveShadow = true; return m; };
const mesh = (g, mat, n, d) => part(new THREE.Mesh(g, mat), n, d);
const std = (o) => new THREE.MeshStandardMaterial(o);
const brass = () => std({ color: 0xd2a23c, metalness: 1, roughness: 0.28 });

/** رقمة قابلة للتموّج: شبكة قطبية في المستوى الأفقي عند الارتفاع y */
function makeHead(R, y, map, n, d) {
  const NR = 18, NS = 72, pos = [], uv = [], idx = [];
  pos.push(0, y, 0); uv.push(0.5, 0.5);
  for (let i = 1; i <= NR; i++) for (let j = 0; j < NS; j++) { const r = R * i / NR, a = j / NS * Math.PI * 2, px = r * Math.sin(a), pz = r * Math.cos(a); pos.push(px, y, pz); uv.push(0.5 + px / (2 * R), 0.5 - pz / (2 * R)); }
  for (let j = 0; j < NS; j++) idx.push(0, 1 + j, 1 + (j + 1) % NS);
  for (let i = 1; i < NR; i++) for (let j = 0; j < NS; j++) { const a = 1 + (i - 1) * NS + j, b = 1 + (i - 1) * NS + (j + 1) % NS, c = a + NS, e = b + NS; idx.push(a, c, b, b, c, e); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  const m = mesh(g, new THREE.MeshPhysicalMaterial({ map, roughness: 0.62, sheen: 0.35, sheenRoughness: 0.6, side: THREE.DoubleSide }), n, d);
  m.castShadow = false; m.userData.head = { R, y, base: Float32Array.from(pos) };
  return m;
}
/** حلقة سميكة (أو قوس منها) بمقطع مستطيل */
function band(ri, ro, y0, y1, mat, phi0 = 0, phiLen = Math.PI * 2, n, d) {
  const pts = [new THREE.Vector2(ri, y0), new THREE.Vector2(ro, y0), new THREE.Vector2(ro, y1), new THREE.Vector2(ri, y1), new THREE.Vector2(ri, y0)];
  return mesh(new THREE.LatheGeometry(pts, Math.max(8, Math.round(96 * phiLen / (Math.PI * 2))), phi0, phiLen), mat, n, d);
}
const skinMat = (color) => std({ color, roughness: 0.75 });

// ---------------- الدف (الرق): إطار مطعّم بخمس فتحات مزدوجة فيها عشرة أزواج من الصنوج ----------------
export function buildRiq() {
  const g = new THREE.Group(), R = 0.115, H = 0.062, ri = R - 0.009, jingles = [];
  const fn = 'الإطار الخشبي المطعّم', fd = 'من الخشب المطعّم بالصدف والعاج، وفيه فتحات الصنوج.';
  const inl = (rep) => std({ map: inlayTexture([rep, 1]), roughness: 0.38, metalness: 0.05 });
  const inner = std({ map: woodTexture('#5a2f17', '#2c1408', 4, [3, 1]), roughness: 0.6 });
  // ثلاثة أطواق كاملة (أسفل، وسط، أعلى) وبينها أعمدة تفصل الفتحات
  for (const [y0, y1] of [[0, 0.008], [0.028, 0.034], [0.054, H]]) g.add(band(ri, R, y0, y1, std({ map: woodTexture('#4a2412', '#1f0d05', 6, [6, 1]), roughness: 0.4 }), 0, Math.PI * 2, fn, fd));
  const SL = 5, slotA = 0.56, postA = Math.PI * 2 / SL - slotA;
  for (let k = 0; k < SL; k++) {
    const a0 = k * Math.PI * 2 / SL + slotA / 2;
    g.add(band(ri, R, 0.008, 0.054, inl(Math.max(1, Math.round(postA * 3.2))), a0, postA, fn, fd));
    // زوجان من الصنوج في كل فتحة (علوي وسفلي) على مسمار رأسي
    const ac = k * Math.PI * 2 / SL, rc = (R + ri) / 2, cx = rc * Math.sin(ac), cz = rc * Math.cos(ac);
    const pin = mesh(new THREE.CylinderGeometry(0.0012, 0.0012, 0.05, 8), std({ color: 0x8a8a8a, metalness: 1, roughness: 0.4 }), 'محور الصنوج', 'مسمار رأسي يمرّ في فتحة الإطار، تُركَّب عليه أزواج الصنوج فتتحرك بحرية وترنّ.'); pin.position.set(cx, 0.031, cz); g.add(pin);
    for (const yc of [0.018, 0.044]) {
      const pair = new THREE.Group(); pair.position.set(cx, yc, cz);
      for (const s of [1, -1]) { const z = mesh(new THREE.SphereGeometry(0.03, 28, 6, 0, Math.PI * 2, 0, 0.5), brass(), 'الصنوج النحاسية', 'عشرة أزواج من الصنوج النحاسية تُثبَّت في فتحات الإطار، ويصدر منها صوت «التك» الرنّان.'); z.scale.set(1, 0.42, 1); z.rotation.x = s > 0 ? 0 : Math.PI; z.position.y = s * (0.0022 - 0.03 * 0.42 * (1 - 0.88)); z.material.side = THREE.DoubleSide; pair.add(z); }
      pair.userData.jingle = { y: yc, k: 0 }; jingles.push(pair); g.add(pair);
    }
  }
  g.add(band(ri - 0.0005, ri, 0, H, inner, 0, Math.PI * 2, fn, fd));   // الوجه الداخلي للإطار نفسه
  const head = makeHead(R - 0.001, H + 0.0006, skinTexture('fish', 11), 'الغشاء (جلد السمك)', 'غشاء من جلد السمك يُشدّ على الإطار؛ الدُم في وسطه والتك على حافته.');
  g.add(head);
  g.add(band(R, R + 0.0012, H - 0.011, H + 0.0006, skinMat(0xd9cfb8), 0, Math.PI * 2, 'الغشاء (جلد السمك)', 'الجلد ملصوق على حافة الإطار.'));
  return { group: g, head, R: R - 0.001, top: H, jingles, height: H };
}

// ---------------- المزهر: إطار أكبر وأعمق بلا صنوج، جلد ماعز مثبّت بمسامير ----------------
/** زاوية موضع إمساك المزهر باليسرى (يجب أن تطابق support.ang للمزهر في data/performance.js) */
const FRAME_HOLD_ANG = -0.7;
export function buildMizhar() {
  const g = new THREE.Group(), R = 0.2, H = 0.095, ri = R - 0.011;
  const wood = std({ map: woodTexture('#8a5630', '#4f2b12', 8, [5, 1]), roughness: 0.5 });
  g.add(band(ri, R, 0, H, wood, 0, Math.PI * 2, 'الإطار الخشبي', 'إطار خشبي أكبر وأعمق من إطار الدف، بلا صنوج نحاسية.'));
  const head = makeHead(R - 0.001, H + 0.0008, skinTexture('goat', 23), 'الغشاء (جلد الماعز)', 'غشاء من جلد الماعز يُشدّ على الإطار؛ الدُم على حافته والتك في وسطه.');
  g.add(head);
  g.add(band(R, R + 0.0016, H - 0.03, H + 0.0008, skinMat(0xc9b48c), 0, Math.PI * 2, 'الغشاء (جلد الماعز)', 'يُشدّ الجلد وينزل على جانب الإطار.'));
  for (let i = 0; i < 28; i++) { const a = i / 28 * Math.PI * 2, t = mesh(new THREE.SphereGeometry(0.0042, 12, 8), brass(), 'مسامير التثبيت', 'تثبّت الجلد على الإطار.'); t.scale.z = 0.5; t.position.set((R + 0.0018) * Math.sin(a), H - 0.022, (R + 0.0018) * Math.cos(a)); t.rotation.y = a; g.add(t); }
  const th = mesh(new THREE.TorusGeometry(0.013, 0.0035, 8, 20), std({ color: 0x2c1408, roughness: 0.7 }), 'فتحة الإبهام', 'فتحة في الإطار تُمسَك منها الآلة.'); th.position.set((R + 0.0005) * Math.sin(FRAME_HOLD_ANG), H - 0.038, (R + 0.0005) * Math.cos(FRAME_HOLD_ANG)); th.rotation.y = FRAME_HOLD_ANG; g.add(th);   // في موضع إمساك اليسرى
  return { group: g, head, R: R - 0.001, top: H, jingles: [], height: H };
}

// ---------------- الطبلة: جسم على شكل قمع مطعّم بالصدف، وفتحة صغرى مطلقة ----------------
export function buildTabla() {
  const g = new THREE.Group(), H = 0.44, R = 0.108;
  const prof = [[0.086, 0], [0.083, 0.012], [0.074, 0.05], [0.058, 0.13], [0.05, 0.2], [0.052, 0.25], [0.066, 0.3], [0.09, 0.345], [0.108, 0.385], [0.114, 0.415], [0.113, 0.43]];
  const curve = new THREE.SplineCurve(prof.map((p) => new THREE.Vector2(p[0], p[1])));
  const body = mesh(new THREE.LatheGeometry(curve.getPoints(60), 96), std({ map: inlayTexture([9, 2.4]), roughness: 0.36, metalness: 0.05, side: THREE.DoubleSide }), 'جسم الطبلة (القمع)', 'على شكل قمع كبير يُصنع من الفخار أو الخشب المطعّم بالصدف.');
  g.add(body);
  g.add(band(0.083, 0.09, -0.002, 0.012, std({ color: 0x24120a, roughness: 0.5 }), 0, Math.PI * 2, 'الفتحة الصغرى', 'تُترك مطلقة لإصدار الصوت.'));
  const rim = mesh(new THREE.TorusGeometry(R + 0.004, 0.0075, 14, 96), skinMat(0xd9cfb8), 'حافة الطبلة', 'التك يُنقر على حافة الطبلة.'); rim.rotation.x = Math.PI / 2; rim.position.y = 0.432; g.add(rim);
  g.add(band(R + 0.0095, R + 0.011, 0.395, 0.432, skinMat(0xd3c8ae), 0, Math.PI * 2, 'الغشاء (جلد السمك)', 'ينزل الجلد على جانب الفتحة الكبرى ويُثبَّت بطوق.'));
  const hoop = mesh(new THREE.TorusGeometry(R + 0.011, 0.004, 10, 96), std({ color: 0x1c1410, roughness: 0.45, metalness: 0.4 }), 'طوق التثبيت', 'يثبّت الغشاء على الفتحة الكبرى.'); hoop.rotation.x = Math.PI / 2; hoop.position.y = 0.397; g.add(hoop);
  const head = makeHead(R + 0.004, 0.4396, skinTexture('fish', 31), 'الغشاء (الفتحة الكبرى)', 'غشاء من جلد السمك يغطي الفتحة الكبرى؛ الدُم في وسطه والتك على حافته.');
  g.add(head);
  return { group: g, head, R: R + 0.004, top: 0.44, jingles: [], height: H };
}

// ---------------- الكاسر والرحماني: طبلان أسطوانيان بجلدين مشدودين بالحبال (بنية واحدة بمقاسات وجلود مختلفة) ----------------
function buildBarrel({ R, H, skin, seed, woodA, woodB, lace, skinName, skinDesc }) {
  const g = new THREE.Group();
  const prof = []; for (let i = 0; i <= 24; i++) { const t = i / 24; prof.push(new THREE.Vector2(R * (0.94 + 0.06 * Math.sin(Math.PI * t)), H * t)); }
  g.add(mesh(new THREE.LatheGeometry(prof, 80), std({ map: woodTexture(woodA, woodB, seed, [3, 1], true), roughness: 0.48, side: THREE.DoubleSide }), 'جسم الطبل', 'جسم خشبي أسطواني مفتوح الطرفين، تُكسى فتحتاه بالجلد.'));
  const rope = std({ map: ropeTexture('#cdbd98', [40, 1]), roughness: 0.85 }), Rh = R * 0.94 + 0.012, tube = Math.max(0.008, R * 0.045);
  const head = makeHead(R * 0.94 + 0.004, H + 0.003, skinTexture(skin, seed + 40), skinName, skinDesc); g.add(head);
  const bottom = mesh(new THREE.CircleGeometry(R * 0.94 + 0.004, 64), new THREE.MeshStandardMaterial({ map: skinTexture(skin, seed + 41, false), roughness: 0.65, side: THREE.DoubleSide }), skinName, skinDesc); bottom.rotation.x = Math.PI / 2; bottom.position.y = -0.003; g.add(bottom);
  for (const [y, s] of [[H, 1], [0, -1]]) {
    g.add(band(R * 0.94 + 0.004, R * 0.94 + 0.0055, Math.min(y, y - s * 0.03), Math.max(y, y - s * 0.03), skinMat(skin === 'goat' ? 0xb9a074 : 0xd8c7a2), 0, Math.PI * 2, skinName, 'ينزل الجلد على جانب الطبل ويلتف حول الطوق.'));
    const hp = mesh(new THREE.TorusGeometry(Rh, tube, 12, 96), rope, 'طوق الشدّ', 'طوق ملفوف بالحبل يثبّت الجلد على فتحة الطبل.'); hp.rotation.x = Math.PI / 2; hp.position.y = y - s * 0.022; g.add(hp);
  }
  // حبال الشدّ المتعرجة بين الطوقين + حزام في الوسط يضمّها
  const ropeV = std({ map: ropeTexture('#d6c7a4', [1, 18]), roughness: 0.85 }), y1 = H - 0.022, y0 = 0.022, Rr = Rh + tube * 0.6, up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < lace * 2; i++) {
    const a = i / (lace * 2) * Math.PI * 2, b = (i + 1) / (lace * 2) * Math.PI * 2, top = i % 2 === 0;
    const A = new THREE.Vector3(Rr * Math.sin(a), top ? y1 : y0, Rr * Math.cos(a)), B = new THREE.Vector3(Rr * Math.sin(b), top ? y0 : y1, Rr * Math.cos(b)), dv = B.clone().sub(A);
    const rd = mesh(new THREE.CylinderGeometry(0.0032, 0.0032, dv.length(), 6), ropeV, 'حبال الشدّ', 'حبال تشدّ الجلدين على جسم الطبل، وبشدّها يُضبط الصوت.');
    rd.position.copy(A).add(B).multiplyScalar(0.5); rd.quaternion.setFromUnitVectors(up, dv.normalize()); g.add(rd);
  }
  const belt = mesh(new THREE.TorusGeometry(R + 0.006, 0.004, 8, 96), rope, 'حبال الشدّ', 'حزام يضمّ حبال الشدّ في وسط الطبل.'); belt.rotation.x = Math.PI / 2; belt.position.y = H / 2; g.add(belt);
  return { group: g, head, R: R * 0.94 + 0.004, top: H + 0.003, jingles: [], height: H };
}
export const buildKasir = () => buildBarrel({ R: 0.125, H: 0.46, skin: 'sheep', seed: 51, woodA: '#5b2d1a', woodB: '#2a1208', lace: 11, skinName: 'الكسوة (جلد الغنم)', skinDesc: 'كسوة الفتحتين عادةً من جلد الغنم.' });
export const buildRahmani = () => buildBarrel({ R: 0.2, H: 0.5, skin: 'goat', seed: 61, woodA: '#4c2616', woodB: '#221008', lace: 14, skinName: 'الكسوة (جلد الماعز)', skinDesc: 'كسوة الفتحتين من جلد الماعز ليصدر صوتًا عميقًا مميزًا.' });

export const BUILDERS = { riq: buildRiq, tabla: buildTabla, mizhar: buildMizhar, kasir: buildKasir, rahmani: buildRahmani };

/** تموّج الرقمة: ضربات نشطة [{x, z, amp, t}] تُحدَّث كل إطار */
export function animateHead(head, hits, dt) {
  const H = head.userData.head, pos = head.geometry.attributes.position, base = H.base;
  for (const h of hits) h.t += dt;
  const live = hits.filter((h) => h.t < 0.5);
  if (!live.length) { if (H.dirty) { pos.array.set(base); pos.needsUpdate = true; head.geometry.computeVertexNormals(); H.dirty = false; } return live; }
  const R = H.R;
  for (let i = 0; i < pos.count; i++) {
    const x = base[i * 3], z = base[i * 3 + 2], rr = Math.hypot(x, z) / R, edge = Math.max(0, 1 - rr * rr); let dy = 0;
    for (const h of live) { const d2 = ((x - h.x) ** 2 + (z - h.z) ** 2) / (R * R); dy -= h.amp * R * edge * (0.75 * Math.exp(-d2 / 0.05) * Math.exp(-h.t / 0.05) + 0.35 * Math.exp(-h.t / 0.14) * Math.cos(h.t * 95) * (1 - 0.6 * rr)); }
    pos.array[i * 3 + 1] = base[i * 3 + 1] + dy;
  }
  pos.needsUpdate = true; head.geometry.computeVertexNormals(); H.dirty = true; return live;
}
