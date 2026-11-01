// =====================================================================
//  تصحيح منطقة الأرداف في وضعية الجلوس (ثوب العازف) — للأورج فقط: لا يمسّ الملفات المشتركة ولا الألعاب الأخرى،
//  ويُطبَّق على نسخة الشبكة المحمّلة في هذه اللعبة وحدها.
//
//  التشخيص (مقاطع جانبية مقيسة من الشبكة في وضعية الجلوس):
//   1) رؤوس الأرداف خلف مفصل الورك مربوطة جزئيًا بعظمتي الفخذ (upperleg01/02). عند الجلوس يدور الفخذ ~90° للأمام
//      فتُسحب معه تلك الرؤوس بالجلد الخطي (Linear Blend Skinning): ينطبق السطح إلى الداخل ويتكوّن شقّ حادّ على شكل V
//      و«ذيل» من القماش يتدلى إلى المقعد — وهو التشوه الظاهر من الخلف.
//   2) جسم الذكر (أهداف MakeHuman الذكرية) مسطّح الأرداف أصلًا؛ ومع الانطباق صار السطح الخلفي عند المقعد
//      أمام مفصل الورك بدل أن يكون خلفه (عند العازفة ~10 سم خلفه).
//  العلاج:
//   أ) نقل أوزان الفخذ إلى عظمة الحوض في الجهة نفسها لرؤوس المؤخرة فقط (خلف مفصل الورك، بين أعلى الحوض وثنية الأرداف)،
//      بتدرّج ناعم — فتتبع الأرداف الحوضَ لا الفخذ، كما في الجسم الحقيقي. هذا يزيل الانطباق والشق والذيل.
//   ب) استعادة حجم معتدل خلف الحوض بإزاحة ناعمة (فصّان، شق خفيف، تسطّح على المقعد) تُحوَّل إلى فضاء الربط بمعكوس
//      مصفوفة الجلد لكل رأس، فتبقى ملتصقة بالهيكل أثناء التنفس والعزف. لا تكبير مبالغ فيه: البروز ≈ 3–4 سم.
// =====================================================================
import * as THREE from 'three';

const sstep = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** أ) نقل أوزان الفخذ إلى الحوض لرؤوس المؤخرة (في فضاء الربط) */
function reweight(mesh) {
  const g = mesh.geometry, pos = g.attributes.position, si = g.attributes.skinIndex, sw = g.attributes.skinWeight, bones = mesh.skeleton.bones;
  const names = bones.map((b) => b.name), ix = (n) => names.indexOf(n);
  const P = { L: ix('pelvisL'), R: ix('pelvisR') }, U = [ix('upperleg01L'), ix('upperleg01R'), ix('upperleg02L'), ix('upperleg02R')];
  if (P.L < 0 || P.R < 0 || U.some((u) => u < 0)) return 0;
  const bindPos = (j) => new THREE.Vector3().setFromMatrixPosition(mesh.skeleton.boneInverses[j].clone().invert());
  const hip = { L: bindPos(U[0]), R: bindPos(U[1]) };
  const u = Math.abs(hip.L.y) > 5 ? 100 : 1;                 // وحدات فضاء الربط (سم في هذا النموذج)
  const lo = 0.15 * u, hi = 0.05 * u, v = new THREE.Vector3(); let n = 0;
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).applyMatrix4(mesh.bindMatrix);
    const side = v.x > 0 ? 'L' : 'R', hp = hip[side], back = hp.z - v.z;           // موجب = خلف مفصل الورك
    if (back <= 0) continue;
    const below = hp.y - v.y;
    const f = (1 - sstep(hi, lo, below)) * sstep(0, 0.03 * u, back);
    if (f <= 0) continue;
    let moved = 0;
    for (let j = 0; j < 4; j++) if (U.includes(si.getComponent(i, j))) { const w = sw.getComponent(i, j); moved += w * f; sw.setComponent(i, j, w * (1 - f)); }
    if (!moved) continue;
    const t = P[side]; let put = false;
    for (let j = 0; j < 4; j++) if (si.getComponent(i, j) === t) { sw.setComponent(i, j, sw.getComponent(i, j) + moved); put = true; break; }
    if (!put) { let mj = 0, mw = 9; for (let j = 0; j < 4; j++) { const w = sw.getComponent(i, j); if (w < mw) { mw = w; mj = j; } } si.setComponent(i, mj, t); sw.setComponent(i, mj, mw + moved); }
    n++;
  }
  sw.needsUpdate = true; si.needsUpdate = true;
  return n;
}

/** مصفوفة الجلد الكاملة لرأس (من فضاء الهندسة إلى العالم) */
function skinMatrix(mesh, i, BM, pre, out) {
  const si = mesh.geometry.attributes.skinIndex, sw = mesh.geometry.attributes.skinWeight, S = out.S;
  S.elements.fill(0);
  for (let j = 0; j < 4; j++) { const w = sw.getComponent(i, j); if (!w) continue; const e = BM[si.getComponent(i, j)].elements; for (let q = 0; q < 16; q++) S.elements[q] += w * e[q]; }
  return out.K.multiplyMatrices(pre, S).multiply(mesh.bindMatrix);
}

/**
 * @param rig   هيكل الشخصية (Rig المشترك) في وضعية الجلوس الحالية
 * @param seat  { y, zFront, zBack, halfW }
 * @param opt   { depth: أقصى إزاحة للخلف (م)، reweight: true }
 */
export function fixSeatedGlutes(rig, seat, opt = {}) {
  const mesh = rig.meshes.find((m) => /dishdasha/i.test(m.name)) || null;
  if (!mesh) return { moved: 0, reason: 'no-cloth' };
  const A = opt.depth ?? 0.035;
  const rew = opt.reweight === false ? 0 : reweight(mesh);
  mesh.updateMatrixWorld(true); mesh.skeleton.bones.forEach((b) => b.updateMatrixWorld(true));
  const g = mesh.geometry, pos = g.attributes.position, nrm = g.attributes.normal, n = pos.count;
  const hips = rig.wp('C', 'hips');
  const BM = mesh.skeleton.bones.map((b, j) => new THREE.Matrix4().multiplyMatrices(b.matrixWorld, mesh.skeleton.boneInverses[j]));
  const pre = new THREE.Matrix4().multiplyMatrices(mesh.matrixWorld, mesh.bindMatrixInverse);
  const tmp = { S: new THREE.Matrix4(), K: new THREE.Matrix4() }, L3 = new THREE.Matrix3(), p = new THREE.Vector3(), nw = new THREE.Vector3(), d = new THREE.Vector3();

  // ب) البروز المطلوب: دالة ناعمة في (x, y) العالميين، تُضرب في «اتجاه السطح للخلف» (من العمودي) فلا تتحرك الجوانب ولا الأمام
  const yPk = seat.y + 0.075, yTop = Math.max(yPk + 0.05, hips.y + 0.075);
  const bumpY = (y) => (y >= yPk ? 1 - sstep(yPk, yTop, y) : 0.55 + 0.45 * sstep(seat.y - 0.005, yPk, y));
  const lobe = (x) => { const a = Math.abs(x); return Math.exp(-Math.pow((a - 0.065) / 0.075, 2)) * (1 - 0.22 * Math.exp(-Math.pow(a / 0.02, 2))); };
  const lobeN = lobe(0.065);
  let moved = 0, maxShift = 0; const changed = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    rig.vertexWorld(mesh, i, p);
    if (Math.abs(p.x) > 0.22 || p.y < seat.y - 0.01 || p.y > yTop || p.z > hips.z + 0.07) continue;
    const K = skinMatrix(mesh, i, BM, pre, tmp);
    const backness = 1 - sstep(hips.z - 0.015, hips.z + 0.06, p.z);           // معيار مكاني ناعم (لا يتأثر بتجعّد الثوب)
    const amt = A * bumpY(p.y) * (lobe(p.x) / lobeN) * backness;
    if (amt < 2e-4) continue;
    let dy = 0;
    // لا يدخل الثوب في المقعد
    if (p.y < seat.y + 0.004 && Math.abs(p.x) < seat.halfW) dy = seat.y + 0.004 - p.y;
    d.set(0, dy, -amt).applyMatrix3(L3.setFromMatrix4(K).invert());
    pos.setXYZ(i, pos.getX(i) + d.x, pos.getY(i) + d.y, pos.getZ(i) + d.z);
    changed[i] = 1; moved++; maxShift = Math.max(maxShift, amt);
  }
  pos.needsUpdate = true;
  if (moved && nrm) smoothNormals(g, changed);

  g.computeBoundingSphere();
  return { reweighted: rew, moved, maxShiftMm: +(maxShift * 1000).toFixed(1) };
}

// عموديات ناعمة للرؤوس المعدّلة: متوسط عموديات الوجوه حول كل موضع (مع دمج الرؤوس المتطابقة الموضع عند خطوط القصّ)،
// فلا يظهر السطح مضلّعًا؛ وتبقى عموديات بقية الثوب كما هي.
function smoothNormals(g, changed) {
  const pos = g.attributes.position, nrm = g.attributes.normal, n = pos.count, idx = g.index ? g.index.array : null;
  const key = (i) => `${Math.round(pos.getX(i) * 1e3)},${Math.round(pos.getY(i) * 1e3)},${Math.round(pos.getZ(i) * 1e3)}`;
  const acc = new Map(), a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), fn = new THREE.Vector3();
  const nt = idx ? idx.length / 3 : n / 3;
  for (let t = 0; t < nt; t++) {
    const i0 = idx ? idx[t * 3] : t * 3, i1 = idx ? idx[t * 3 + 1] : t * 3 + 1, i2 = idx ? idx[t * 3 + 2] : t * 3 + 2;
    if (!changed[i0] && !changed[i1] && !changed[i2]) continue;
    a.fromBufferAttribute(pos, i0); b.fromBufferAttribute(pos, i1); c.fromBufferAttribute(pos, i2);
    fn.subVectors(c, b).cross(a.clone().sub(b));                       // مساحة × عمودي (وزن بالمساحة)
    for (const i of [i0, i1, i2]) { const k = key(i); const v = acc.get(k) || [0, 0, 0]; v[0] += fn.x; v[1] += fn.y; v[2] += fn.z; acc.set(k, v); }
  }
  for (let i = 0; i < n; i++) {
    if (!changed[i]) continue; const v = acc.get(key(i)); if (!v) continue;
    const L = Math.hypot(v[0], v[1], v[2]) || 1; const nx = v[0] / L, ny = v[1] / L, nz = v[2] / L;
    // نحافظ على اتجاه العمودي الأصلي (الوجه الخارجي) إن كانت الأوجه معكوسة الترتيب
    const s = nx * nrm.getX(i) + ny * nrm.getY(i) + nz * nrm.getZ(i) < 0 ? -1 : 1;
    nrm.setXYZ(i, nx * s, ny * s, nz * s);
  }
  nrm.needsUpdate = true;
}
