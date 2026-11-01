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
