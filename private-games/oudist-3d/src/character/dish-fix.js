// =====================================================================
//  تصحيح ثوب العازف في وضعية الجلوس — للأكورديون فقط: لا يمسّ الملفات المشتركة ولا الألعاب الأخرى،
//  ويُطبَّق على نسخة الشبكة المحمّلة في هذه اللعبة وحدها.
//  (أ) الأرداف: نسخة من معالجة لعبة الأورج (seat-fix.js)، (ب) الحِجر والفجوة بين الفخذين: fixSeatedLap في آخر الملف.
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
//   ب) (تحديث) الثوب ينسدل في الخلف لوحًا واحدًا محتشمًا من أسفل الظهر إلى المقعد — لا يُظهر فصّي الأرداف ولا الشق
//      ولا تجويف الخصر. الإزاحة تُحوَّل إلى فضاء الربط بمعكوس مصفوفة الجلد لكل رأس، فتبقى مع الهيكل أثناء التنفس والعزف.
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
 * @param opt   { out: ميل القماش للخارج عند المقعد (م)، curv: التقوّس الجانبي، reweight: true }
 */
export function fixSeatedGlutes(rig, seat, opt = {}) {
  const mesh = rig.meshes.find((m) => /dishdasha/i.test(m.name)) || null;
  if (!mesh) return { moved: 0, reason: 'no-cloth' };
  const rew = opt.reweight === false ? 0 : reweight(mesh);
  mesh.updateMatrixWorld(true); mesh.skeleton.bones.forEach((b) => b.updateMatrixWorld(true));
  const g = mesh.geometry, pos = g.attributes.position, nrm = g.attributes.normal, n = pos.count;
  const hips = rig.wp('C', 'hips');
  const BM = mesh.skeleton.bones.map((b, j) => new THREE.Matrix4().multiplyMatrices(b.matrixWorld, mesh.skeleton.boneInverses[j]));
  const pre = new THREE.Matrix4().multiplyMatrices(mesh.matrixWorld, mesh.bindMatrixInverse);
  const tmp = { S: new THREE.Matrix4(), K: new THREE.Matrix4() }, L3 = new THREE.Matrix3(), p = new THREE.Vector3(), nw = new THREE.Vector3(), d = new THREE.Vector3();

  let moved = 0, maxShift = 0, zLB = null; const changed = new Uint8Array(n);
  if (opt.mode === 'lobes') {
    // العازفة: التصحيح السابق كما هو (حجم معتدل بفصّين) — لم يُطلب تغييره
    const A = opt.depth ?? 0.035;
    // ب) البروز المطلوب: دالة ناعمة في (x, y) العالميين، تُضرب في «اتجاه السطح للخلف» (من العمودي) فلا تتحرك الجوانب ولا الأمام
    const yPk = seat.y + 0.075, yTop = Math.max(yPk + 0.05, hips.y + 0.075);
    const bumpY = (y) => (y >= yPk ? 1 - sstep(yPk, yTop, y) : 0.55 + 0.45 * sstep(seat.y - 0.005, yPk, y));
    const lobe = (x) => { const a = Math.abs(x); return Math.exp(-Math.pow((a - 0.065) / 0.075, 2)) * (1 - 0.22 * Math.exp(-Math.pow(a / 0.02, 2))); };
    const lobeN = lobe(0.065);
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

  } else {
    // ب) «سقوط القماش»: الثوب في الخلف لا يتبع شكل الجسم، بل ينسدل لوحًا واحدًا من أسفل الظهر إلى المقعد.
    //    السطح الهدف z(x,y) = عمق أسفل الظهر (مقاسًا من الثوب نفسه) + تقوّس جانبي خفيف (كالأسطوانة)،
    //    بلا تجويف عند الخصر ولا فصّين ولا شقّ. يُدمج تدريجيًا عند الجانبين وأعلى الظهر فلا تظهر حواف.
    //    (تحت هذه المنطقة لا يوجد سطح للجسم — أُزيل عند إلباس الثوب — فلا خطر لظهور الجسم من خلاله.)
    const yTopD = hips.y + 0.085, yFull = hips.y + 0.05;          // أعلى منطقة الانسدال، وبداية الانسدال الكامل
    // عمق أسفل الظهر عند منتصفه (أبعد نقطة خلفية للثوب في شريط ضيق تحت yFull)
    zLB = Infinity;
    for (let i = 0; i < n; i++) { rig.vertexWorld(mesh, i, p); if (Math.abs(p.x) < 0.04 && p.y > yFull - 0.01 && p.y < yFull + 0.025 && p.z < hips.z) zLB = Math.min(zLB, p.z); }
    if (!isFinite(zLB)) zLB = hips.z - 0.033;
    // المقطع العرضي لأسفل الظهر (أبعد نقطة خلفية لكل شريحة عرضية بعرض 1 سم) — يمتد اللوح منه للأسفل فيلتحم بالظهر بلا حافة
    const NB = 33, XB = 0.01, row = new Array(NB).fill(Infinity);
    for (let i = 0; i < n; i++) { rig.vertexWorld(mesh, i, p); if (p.y < yFull - 0.012 || p.y > yFull + 0.018 || p.z > hips.z + 0.03) continue; const b = Math.round(p.x / XB) + 16; if (b >= 0 && b < NB) row[b] = Math.min(row[b], p.z); }
    for (let b = 0; b < NB; b++) if (!isFinite(row[b])) { let l = b - 1, r = b + 1; while (l >= 0 && !isFinite(row[l])) l--; while (r < NB && !isFinite(row[r])) r++; row[b] = l >= 0 && r < NB ? row[l] + (row[r] - row[l]) * (b - l) / (r - l) : (l >= 0 ? row[l] : r < NB ? row[r] : zLB); }
    const rowS = row.map((_, b) => { let s2 = 0, w2 = 0; for (let k = -2; k <= 2; k++) { const j = b + k; if (j < 0 || j >= NB) continue; const w = 3 - Math.abs(k); s2 += row[j] * w; w2 += w; } return s2 / w2; });   // تنعيم
    const prof = (x) => { const f = x / XB + 16, b0 = Math.max(0, Math.min(NB - 2, Math.floor(f))), t = Math.max(0, Math.min(1, f - b0)); return rowS[b0] + (rowS[b0 + 1] - rowS[b0]) * t; };
    const OUT = opt.out ?? 0.006;                                // ميل خفيف للخارج نحو المقعد (القماش يرتخي قليلًا)
    const zTarget = (x, y) => prof(x) - OUT * (1 - sstep(seat.y, yFull, y));
    const wY = (y) => (y < seat.y - 0.02 ? 0 : 1 - sstep(yFull, yTopD, y));
    const wX = (x) => 1 - sstep(0.11, 0.16, Math.abs(x));
    for (let i = 0; i < n; i++) {
      rig.vertexWorld(mesh, i, p);
      // العموديات تُعاد حسابها لكل المنطقة وهامش فوقها (حتى الرؤوس التي لم تتحرك) فلا يبقى ظلّ من التجويف القديم
      if (Math.abs(p.x) < 0.2 && p.y > seat.y - 0.03 && p.y < yTopD + 0.04 && p.z < hips.z + 0.06) changed[i] = 1;
      if (Math.abs(p.x) > 0.165 || p.y < seat.y - 0.02 || p.y > yTopD || p.z > hips.z + 0.05) continue;
      // الجهة الخلفية فقط (لا يمس الحضن ولا جانبي الفخذين)
      const wB = 1 - sstep(hips.z + 0.02, hips.z + 0.05, p.z);      // كل ما خلف منتصف الجسم (البطن والحضن أمامه بكثير)
      const zT = zTarget(p.x, p.y);
      // منطقة الالتحام أعلى اللوح: ما كان داخل اللوح (تجويف الخصر) يُسحب للخارج كاملًا فلا يبقى انبعاج
      let w = (p.y > yFull && p.z > zT ? 1 : wY(p.y)) * wX(p.x) * wB; if (w < 1e-3) continue;
      // أسفل الثوب الملامس للمقعد (أمام اللوح، تحت الجسم) لا يُسحب للخلف: يبقى مفروشًا على المقعد
      if (p.y < seat.y + 0.016 && p.z > zT + 0.004) w = 0;
      let dz = (zT - p.z) * w, dy = 0;
      if (p.y < seat.y + 0.004 && Math.abs(p.x) < seat.halfW && p.z > seat.zBack) dy = seat.y + 0.004 - p.y;   // لا يدخل الثوب في المقعد
      if (Math.abs(dz) < 1e-4 && !dy) continue;
      const K = skinMatrix(mesh, i, BM, pre, tmp);
      d.set(0, dy, dz).applyMatrix3(L3.setFromMatrix4(K).invert());
      pos.setXYZ(i, pos.getX(i) + d.x, pos.getY(i) + d.y, pos.getZ(i) + d.z);
      moved++; maxShift = Math.max(maxShift, Math.abs(dz));
    }

  }
  pos.needsUpdate = true;
  if (nrm && (moved || opt.mode !== 'lobes')) smoothNormals(g, changed);

  g.computeBoundingSphere();
  return { reweighted: rew, moved, maxShiftMm: +(maxShift * 1000).toFixed(1), zLowerBackCm: zLB == null ? null : +(zLB * 100).toFixed(1), mode: opt.mode || 'drape' };
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

/**
 * تهدئة بقع «تنوّع القماش» في خامة الثوب الأبيض (للأورج فقط): البقع العشوائية الفاتحة والداكنة على الظهر تُقرأ
 * كأشكال تحت القماش. تُقرَّب البكسلات غير الملوّنة من متوسطها، وتبقى التطريزات الملوّنة (الذهبي والأخضر) كما هي.
 */
export function calmFabric(rig, k = 0.3) {
  const mesh = rig.meshes.find((m) => /dishdasha/i.test(m.name)); const map = mesh && mesh.material && mesh.material.map;
  const c = map && map.image; if (!c || !c.getContext) return { calmed: 0 };
  const x = c.getContext('2d'), d = x.getImageData(0, 0, c.width, c.height), a = d.data;
  let sr = 0, sg = 0, sb = 0, cnt = 0;
  const plain = (i) => { const r = a[i], g = a[i + 1], b = a[i + 2]; return Math.max(r, g, b) - Math.min(r, g, b) < 22 && r + g + b > 450; };
  for (let i = 0; i < a.length; i += 4) if (plain(i)) { sr += a[i]; sg += a[i + 1]; sb += a[i + 2]; cnt++; }
  if (!cnt) return { calmed: 0 };
  sr /= cnt; sg /= cnt; sb /= cnt;
  for (let i = 0; i < a.length; i += 4) if (plain(i)) { a[i] = sr + (a[i] - sr) * k; a[i + 1] = sg + (a[i + 1] - sg) * k; a[i + 2] = sb + (a[i + 2] - sb) * k; }
  x.putImageData(d, 0, 0); map.needsUpdate = true;
  return { calmed: cnt, mean: [sr, sg, sb].map(Math.round) };
}

// =====================================================================
//  (ب) لوح الحِجر بين الفخذين (Outfit_robe_drape).
//  التشخيص: اللوح الذي يسدّ ما بين الساقين مبني في وضعية الوقوف على الجهة الأمامية الداخلية لكل ساق. عند الجلوس يبقى غائرًا
//  أسفل قمّتي الفخذين بنحو 3 سم ثم يتدلّى خلف واجهة الساقين بنحو 4 سم، فيظهر بين الفخذين مجرى مظلّل وفتحة طولية حتى الأرض
//  «كأن الثوب مفتوح». العلاج: نلزق اللوح بغلاف الفخذين الخارجي (قمة الفخذين فوق الحِجر، وواجهة الساقين أسفل الركبة) بإزاحة
//  الرؤوس في فضاء الربط (بمعكوس مصفوفة الجلد) فتبقى ثابتة مع الهيكل، ثم تُعاد العموديات ناعمة ليبدو القماش سطحًا واحدًا متصلًا.
// =====================================================================
export function fixSeatedLap(rig, opt = {}) {
  const drape = rig.meshes.find((m) => /robe_drape/i.test(m.name)), dish = rig.meshes.find((m) => /dishdasha/i.test(m.name));
  if (!drape || !dish) return { moved: 0, reason: 'no-drape' };
  const lift = opt.lift ?? 0.004, zMin = opt.zMin ?? 0.17;
  dish.updateMatrixWorld(true); drape.updateMatrixWorld(true); drape.skeleton.bones.forEach((b) => b.updateMatrixWorld(true));
  const p = new THREE.Vector3();
  // مقطعا الغلاف الخارجي لساقي الثوب (الجانب بعد الإسقاط): قمة الفخذين حسب z، وواجهة الساقين حسب y
  const hips = rig.wp('C', 'hips');
  const bin = 0.02, Z0 = 0.10, Y0 = 0.02, NZ = 36, NY = 36;
  const top = new Array(NZ).fill(-Infinity), front = new Array(NY).fill(-Infinity);
  const gp = dish.geometry.attributes.position, nd = gp.count;
  for (let i = 0; i < nd; i++) {
    rig.vertexWorld(dish, i, p);
    if (Math.abs(p.x) > 0.21) continue;
    if (p.y > 0.42 && p.y < 0.72 && p.z > zMin + 0.05) { const b = Math.round((p.z - Z0) / bin); if (b >= 0 && b < NZ && p.y > top[b]) top[b] = p.y; }
    if (p.y > 0.04 && p.y < 0.56 && p.z > hips.z + 0.30) { const b = Math.round((p.y - Y0) / bin); if (b >= 0 && b < NY && p.z > front[b]) front[b] = p.z; }
  }
  const fill = (a) => { for (let b = 0; b < a.length; b++) if (!isFinite(a[b])) { let l = b - 1, r = b + 1; while (l >= 0 && !isFinite(a[l])) l--; while (r < a.length && !isFinite(a[r])) r++; a[b] = l >= 0 && r < a.length ? a[l] + (a[r] - a[l]) * (b - l) / (r - l) : (l >= 0 ? a[l] : r < a.length ? a[r] : 0); } return a; };
  const smooth = (a) => a.map((_, b) => { let s2 = 0, w2 = 0; for (let k = -1; k <= 1; k++) { const j = b + k; if (j < 0 || j >= a.length) continue; const w = 2 - Math.abs(k) + 0.0; s2 += a[j] * w; w2 += w; } return s2 / w2; });
  const topP = smooth(fill(top)), frontP = smooth(fill(front));
  const lerpA = (a, x0, x) => { const f = (x - x0) / bin, b0 = Math.max(0, Math.min(a.length - 2, Math.floor(f))), t = Math.max(0, Math.min(1, f - b0)); return a[b0] + (a[b0 + 1] - a[b0]) * t; };
  const topAt = (z) => lerpA(topP, Z0, z), frontAt = (y) => lerpA(frontP, Y0, y);

  // خامة اللوح: UV الأفقي له ضيّق جدًا (عرض ~0.05 من النسيج)، فتُعطي خريطة الأنماط (normalMap) ميلًا ثابتًا للعمودي على السطح كله
  // فيبدو رماديًا داكنًا مختلفًا عن لون الثوب. نفصل خامته عن خامة الثوب ونُلغي خريطة الأنماط له فقط.
  if (drape.material && drape.material.normalMap && !opt.keepNormalMap) { drape.material = drape.material.clone(); drape.material.normalMap = null; drape.material.needsUpdate = true; }
  // ترتيب رؤوس مثلثات اللوح معكوس بالنسبة لعموديه الخارجية، فيعدّه three وجهًا خلفيًا ويقلب عموديه إلى الداخل (إضاءة رمادية داكنة).
  // نعكس ترتيب كل مثلث (نبدّل الرأسين الثاني والثالث في كل السمات) فيصير وجهه الأمامي هو الخارجي.
  if (!drape.geometry.userData.windingFixed && !drape.geometry.index) {
    const ga = drape.geometry.attributes;
    for (const k of Object.keys(ga)) { const a = ga[k], sz = a.itemSize, arr = a.array; for (let t = 0; t + 2 < a.count; t += 3) for (let c = 0; c < sz; c++) { const i1 = (t + 1) * sz + c, i2 = (t + 2) * sz + c, tmpv = arr[i1]; arr[i1] = arr[i2]; arr[i2] = tmpv; } a.needsUpdate = true; }
    drape.geometry.userData.windingFixed = true;
  }
  const g = drape.geometry, pos = g.attributes.position, nrm = g.attributes.normal, n = pos.count;
  const BM = drape.skeleton.bones.map((b, j) => new THREE.Matrix4().multiplyMatrices(b.matrixWorld, drape.skeleton.boneInverses[j]));
  const pre = new THREE.Matrix4().multiplyMatrices(drape.matrixWorld, drape.bindMatrixInverse);
  const tmp = { S: new THREE.Matrix4(), K: new THREE.Matrix4() }, L3 = new THREE.Matrix3(), d = new THREE.Vector3();
  const changed = new Uint8Array(n); let moved = 0, maxShift = 0, maxUp = 0, maxFwd = 0;
  for (let i = 0; i < n; i++) {
    rig.vertexWorld(drape, i, p);
    if (p.z < zMin) continue;                               // الرؤوس قرب الحوض داخل الجسم: لا تُمسّ
    const lapW = sstep(0.47, 0.56, p.y);                    // أعلى الركبة: لوح أفقي فوق الفخذين، وأسفلها: لوح رأسي أمام الساقين
    // حافتا اللوح تنغرزان قليلًا تحت سطح أنبوبي الساقين (القمة المقيسة هي قمة الأنبوب، وجانبه أدنى منها) فلا تظهر حافة مرتفعة
    const sink = (opt.edgeSink ?? 0.007) * sstep(0.068, 0.102, Math.abs(p.x));
    const ny = topAt(p.z) + lift - sink, nz = frontAt(p.y) + lift - sink;
    const dy = (ny - p.y) * lapW, dz = (nz - p.z) * (1 - lapW);
    changed[i] = 1;
    if (Math.abs(dy) < 1e-5 && Math.abs(dz) < 1e-5) continue;
    const K = skinMatrix(drape, i, BM, pre, tmp);
    d.set(0, dy, dz).applyMatrix3(L3.setFromMatrix4(K).invert());
    pos.setXYZ(i, pos.getX(i) + d.x, pos.getY(i) + d.y, pos.getZ(i) + d.z);
    moved++; maxShift = Math.max(maxShift, Math.hypot(dy, dz)); maxUp = Math.max(maxUp, dy); maxFwd = Math.max(maxFwd, dz);
  }
  pos.needsUpdate = true;
  if (nrm && moved) smoothNormals(g, changed);
  g.computeBoundingSphere();
  return { moved, maxShiftMm: +(maxShift * 1000).toFixed(1), maxUpMm: +(maxUp * 1000).toFixed(1), maxFwdMm: +(maxFwd * 1000).toFixed(1) };
}

// =====================================================================
//  (ج) طرف الثوب السفلي عند الكعبين.
//  التشخيص: الثوب يُقصّ عند الطرف في وضعية الوقوف بمثلثات غير منتظمة، ومع الجلوس وتباعد الساقين صار الطرف «مسنّنًا»
//  (أسنان تتدلى بأطوال مختلفة)، وبقيت بضع مثلثات شاردة ممدودة نحو مقدمة الحذاء على الأرض.
//  العلاج (في فضاء الربط عبر معكوس مصفوفة الجلد كما سبق):
//   1) المثلثات الشاردة (رأس بعيد عن محور الساق أكثر من 14 سم، أو ملاصق للأرض) تُطوى إلى نقطة فلا تُرسم.
//   2) لكل ساق: نقسم محيطها إلى قطاعات ونأخذ أدنى نقطة في كل قطاع؛ أعلى هذه الأدنيات هو خط الطرف المستوي.
//      كل رأس تحته يُرفع إليه، فيصير الطرف خطًا أفقيًا ناعمًا حول الساق. ولوح الحِجر بين الساقين يُقصّ عند الخط نفسه.
// =====================================================================
export function fixSeatedHem(rig, opt = {}) {
  const meshes = rig.meshes.filter((m) => /dishdasha|robe_drape/i.test(m.name)); if (!meshes.length) return { moved: 0 };
  const K = { L: rig.wp('L', 'lowerLeg'), R: rig.wp('R', 'lowerLeg') }, Fo = { L: rig.wp('L', 'foot'), R: rig.wp('R', 'foot') };
  const axis = (s, y) => { const a = K[s], b = Fo[s], t = (y - a.y) / ((b.y - a.y) || 1e-6); return [a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t]; };
  const near = (p) => { let best = null; for (const s of ['L', 'R']) { const [ax, az] = axis(s, p.y), d = Math.hypot(p.x - ax, p.z - az); if (!best || d < best.d) best = { s, d, ax, az }; } return best; };
  const yTop = opt.yTop ?? 0.32, far = opt.far ?? 0.14, floor = opt.floor ?? 0.045, NSEC = 24;
  const p = new THREE.Vector3();
  // 1) خط الطرف لكل ساق من الثوب الرئيسي
  const dish = meshes.find((m) => /dishdasha/i.test(m.name));
  const secMin = { L: new Array(NSEC).fill(Infinity), R: new Array(NSEC).fill(Infinity) };
  if (dish) {
    const n = dish.geometry.attributes.position.count;
    for (let i = 0; i < n; i++) {
      rig.vertexWorld(dish, i, p); if (p.y > yTop) continue;
      const q = near(p); if (q.d > far || p.y < floor) continue;
      const k = Math.floor(((Math.atan2(p.z - q.az, p.x - q.ax) + Math.PI) / (2 * Math.PI)) * NSEC) % NSEC;
      if (p.y < secMin[q.s][k]) secMin[q.s][k] = p.y;
    }
  }
  // خط الطرف: قريب من أدنى القطاعات (عند الكعب، لا أعلى منه فيظهر الساق)، وكل ما تحت أعلى قطاع يُثبَّت عليه —
  // فتنغلق الشقوق بين الأسنان بنزول حوافها إلى الخط، وتُرفع الأسنان المتدلية إليه.
  const cut = {}, hi = {};
  for (const s of ['L', 'R']) { const v = secMin[s].filter(isFinite).sort((a, b) => a - b); cut[s] = v.length ? v[Math.floor(v.length * 0.3)] : null; hi[s] = v.length ? v[v.length - 1] + 0.004 : null; }
  const cutBoth = cut.L != null && cut.R != null ? (cut.L + cut.R) / 2 : (cut.L ?? cut.R);
  if (cutBoth == null) return { moved: 0, reason: 'no-hem' };
  let moved = 0, collapsed = 0, maxUp = 0;
  for (const mesh of meshes) {
    const g = mesh.geometry; if (g.index) continue;            // الثوب هنا غير مفهرس (كل مثلث برؤوسه)
    mesh.updateMatrixWorld(true); mesh.skeleton.bones.forEach((b) => b.updateMatrixWorld(true));
    const pos = g.attributes.position, nrm = g.attributes.normal, n = pos.count;
    const BM = mesh.skeleton.bones.map((b, j) => new THREE.Matrix4().multiplyMatrices(b.matrixWorld, mesh.skeleton.boneInverses[j]));
    const pre = new THREE.Matrix4().multiplyMatrices(mesh.matrixWorld, mesh.bindMatrixInverse);
    const tmp = { S: new THREE.Matrix4(), K: new THREE.Matrix4() }, L3 = new THREE.Matrix3(), d = new THREE.Vector3();
    const W = new Array(n), changed = new Uint8Array(n);
    for (let i = 0; i < n; i++) { rig.vertexWorld(mesh, i, p); W[i] = p.clone(); }
    const drape = /robe_drape/i.test(mesh.name);
    for (let t = 0; t + 2 < n; t += 3) {
      const tri = [t, t + 1, t + 2];
      if (tri.every((i) => W[i].y > yTop)) continue;
      // مثلث شارد: يُطوى على أعلى رؤوسه (مساحة صفرية)
      const stray = tri.some((i) => W[i].y < yTop && (W[i].y < floor || (!drape && near(W[i]).d > far)));
      if (stray) {
        const top = tri.reduce((a, i) => (W[i].y > W[a].y ? i : a), t);
        // نطوي الموضع والأوزان معًا (لو بقيت أوزان كل رأس مختلفة لانفتح المثلث من جديد بعد تحريك الهيكل)
        const si = g.attributes.skinIndex, sw = g.attributes.skinWeight;
        for (const i of tri) { if (i === top) continue; for (let c = 0; c < 3; c++) pos.setComponent(i, c, pos.getComponent(top, c)); for (let c = 0; c < 4; c++) { si.setComponent(i, c, si.getComponent(top, c)); sw.setComponent(i, c, sw.getComponent(top, c)); } changed[i] = 1; }
        si.needsUpdate = true; sw.needsUpdate = true;
        collapsed++; continue;
      }
      for (const i of tri) {
        if (changed[i]) continue;
        const sd = drape ? null : near(W[i]).s, yc = drape ? cutBoth : (cut[sd] ?? cutBoth), yh = drape ? Math.max(hi.L ?? cutBoth, hi.R ?? cutBoth) : (hi[sd] ?? yc);
        if (W[i].y >= yh || Math.abs(W[i].y - yc) < 1e-5) continue;
        const dy = yc - W[i].y;
        const Km = skinMatrix(mesh, i, BM, pre, tmp);
        d.set(0, dy, 0).applyMatrix3(L3.setFromMatrix4(Km).invert());
        pos.setXYZ(i, pos.getX(i) + d.x, pos.getY(i) + d.y, pos.getZ(i) + d.z);
        changed[i] = 1; moved++; maxUp = Math.max(maxUp, Math.abs(dy));
      }
    }
    pos.needsUpdate = true; if (nrm) smoothNormals(g, changed); g.computeBoundingSphere();
  }
  return { moved, collapsed, hemCm: { L: cut.L && +(cut.L * 100).toFixed(1), R: cut.R && +(cut.R * 100).toFixed(1) }, pinnedBelowCm: { L: hi.L && +(hi.L * 100).toFixed(1), R: hi.R && +(hi.R * 100).toFixed(1) }, maxMoveMm: +(maxUp * 1000).toFixed(1) };
}
