// =====================================================================
//  تفصيل ذيل الدشداشة للوقوف (خاص بهذه اللعبة؛ لا يغيّر الزي المشترك ولا لعبة الأكورديون).
//
//  السبب الجذري: الزي المشترك (_shared/3d/character/outfit.js) يفصّل النصف السفلي للدشداشة من بنطال MakeHuman الرياضي:
//  أنبوب قماش منفوخ حول كل ساق على حدة. فهو هندسيًا «رجلا بنطال»، ويضيف للعازف الجالس لوحًا مسطحًا بين الركبتين.
//  عند الوقوف يظهر ذلك بنطالًا أبيض (أو أحمر) بفتحتين.
//
//  المعالجة: نقصّ أنبوبي الساقين من شبكة الدشداشة تحت الحوض قصًّا هندسيًا، ونبني مكانهما ثوبًا واحدًا متصلًا:
//   • الحلقة العليا تطابق حافة القصّ نفسها (نقطة بنقطة) فلا درزة ولا فراغ.
//   • تحتها يُحسب مقطع كل ارتفاع من «الغلاف المحدّب» لكل ما تحته (أنبوبا الساقين والحذاء)، فيسقط القماش مستقيمًا
//     بين الساقين ولا يخترقه شيء، ولا يضيق إلى الأسفل (سقوط طبيعي)، مع اتساع خفيف وطيات هادئة قرب الذيل.
//   • العازفة: الذيل عند ارتفاع حافة الدشداشة الأصلية، وتحته كمّا السروال كما في الزي العماني. العازف: إلى الكعبين، ويُزال لوح الجلوس.
//  الأوزان: الحوض (الشخصية واقفة والساقان ثابتتان في هذه اللعبة)، والمادة نفسها (القوام والتطريز في مكانهما بإحداثيات الارتفاع).
//  فضاء الهندسة كما في الزي المشترك: z للأعلى (الأرض z=0)، −y للأمام.
// =====================================================================
import * as THREE from 'three';

const TAU = Math.PI * 2;
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
// ارتفاع حافة الدشداشة في الزي المشترك (outfit.js: HEM) — تبقى كما هي
export const HEM = { male: 0.045, female: 0.185 };
const HT = 1.2;                                             // ارتفاع إسقاط القوام الرأسي في الزي المشترك (v = z / HT)

// قصّ هندسي لشبكة غير مفهرسة: يُبقي ما كان f ≤ 0 ويعيد مقاطع الحافة الجديدة
function clipKeep(geo, f) {
  const A = geo.attributes, names = ['position', 'uv', 'normal', 'skinIndex', 'skinWeight'].filter((k) => A[k]);
  const src = Object.fromEntries(names.map((k) => [k, { a: A[k].array, s: A[k].itemSize }]));
  const out = Object.fromEntries(names.map((k) => [k, []]));
  const segs = [], n = A.position.count;
  const get = (k, i) => Array.from(src[k].a.subarray(i * src[k].s, (i + 1) * src[k].s));
  const vtx = (i) => Object.fromEntries(names.map((k) => [k, get(k, i)]));
  const mix = (a, b, t) => { const o = {}; for (const k of names) o[k] = k === 'skinIndex' ? a[k].slice() : a[k].map((v, j) => v + (b[k][j] - v) * t); return o; };
  const push = (v) => { for (const k of names) out[k].push(...v[k]); };
  let removed = 0;
  for (let t = 0; t < n; t += 3) {
    const V = [vtx(t), vtx(t + 1), vtx(t + 2)], F = V.map((v) => f(v.position));
    const ni = F.filter((x) => x <= 0).length;
    if (ni === 3) { V.forEach(push); continue; }
    removed++;
    if (ni === 0) continue;
    const poly = [], cut = [];
    for (let k = 0; k < 3; k++) {
      const a = V[k], b = V[(k + 1) % 3], fa = F[k], fb = F[(k + 1) % 3];
      if (fa <= 0) poly.push(a);
      if ((fa <= 0) !== (fb <= 0)) { const tt = fa / (fa - fb), m = mix(a, b, tt); poly.push(m); cut.push(m.position); }
    }
    if (cut.length === 2) segs.push(cut);
    for (let k = 1; k + 1 < poly.length; k++) { push(poly[0]); push(poly[k]); push(poly[k + 1]); }
  }
  for (const k of names) { const C = src[k].a.constructor; geo.setAttribute(k, new THREE.BufferAttribute(new C(out[k]), src[k].s)); }
  return { segs, removed };
}

// الغلاف المحدّب (سلسلة رتيبة) لنقاط ثنائية الأبعاد
function hull2(pts) {
  const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const q of p) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}
// أبعد تقاطع لشعاع من المركز c باتجاه d مع مجموعة مقاطع [[x,y],[x,y]]
function rayFar(c, d, segs) {
  let best = -1;
  for (const [a, b] of segs) {
    const ex = b[0] - a[0], ey = b[1] - a[1], den = d[0] * ey - d[1] * ex;
    if (Math.abs(den) < 1e-12) continue;
    const ax = a[0] - c[0], ay = a[1] - c[1];
    const t = (ax * ey - ay * ex) / den, s = (ax * d[1] - ay * d[0]) / den;
    if (t > 0 && s >= -1e-6 && s <= 1 + 1e-6) best = Math.max(best, t);
  }
  return best;
}
// كل تقاطعات الشعاع مع المقاطع (مرتبة)
function rayAll(c, d, segs) {
  const out = [];
  for (const [a, b] of segs) {
    const ex = b[0] - a[0], ey = b[1] - a[1], den = d[0] * ey - d[1] * ex;
    if (Math.abs(den) < 1e-12) continue;
    const ax = a[0] - c[0], ay = a[1] - c[1], t = (ax * ey - ay * ex) / den, s = (ax * d[1] - ay * d[0]) / den;
    if (t > 0 && s >= -1e-6 && s <= 1 + 1e-6) out.push(t);
  }
  return out.sort((x, y) => x - y);
}
const polySegs = (poly) => poly.map((q, i) => [q, poly[(i + 1) % poly.length]]);

/**
 * يفصّل ذيلًا متصلًا لدشداشة الشخصية الواقفة. root: جذر نموذج FBX بعد applyOutfit. يعيد تقرير القياس (للاختبار).
 */
export function tailorStandingRobe(root, cfg = {}) {
  const male = !!(cfg.outfit && cfg.outfit.style === 'male');
  const meshes = []; root.traverse((o) => { if (o.isSkinnedMesh) meshes.push(o); });
  const dish = meshes.find((m) => m.name === 'Outfit_dishdasha');
  if (!dish) return { applied: false, reason: 'no-dishdasha' };
  root.updateMatrixWorld(true);
  const bm = cfg.boneMap || {}, bones = dish.skeleton.bones;
  const boneL = (n) => { const b = bones.find((x) => x.name === n); return b ? dish.worldToLocal(b.getWorldPosition(new THREE.Vector3())) : null; };
  const hipL = boneL(bm['L.upperLeg'] || 'upperleg01L'), hipR = boneL(bm['R.upperLeg'] || 'upperleg01R');
  const rootIdx = Math.max(0, bones.findIndex((b) => b.name === (bm.hips || 'root')));
  const hem = male ? HEM.male : HEM.female;
  // خط الوصل عند الخصر (أضيق مقطع فوق الوركين): هناك الثوب طبقة واحدة محدّبة بلا حواف مفتوحة، أما تحته فطبقتان
  // (حافة القميص فوق أعلى البنطال عند 0.72–0.80) وغمّازة ما بين الفخذين. مقيس: tests/time-signatures/e2e.cjs
  const zJ = (hipL.z + hipR.z) / 2 + 0.14;
  const zKeepLow = male ? -1 : hem + 0.02;                 // العازفة: كمّا السروال تحت الذيل يبقيان من الشبكة الأصلية

  // 1) نقاط ما تحت خط الوصل (للغلاف): أنبوبا الساقين من الشبكة الأصلية + الحذاء فوق ارتفاع الذيل
  const pos0 = dish.geometry.attributes.position, below = [];
  for (let i = 0; i < pos0.count; i++) { const z = pos0.getZ(i); if (z < zJ + 0.004) below.push([pos0.getX(i), pos0.getY(i), z]); }
  const shoes = meshes.find((m) => /shoes/i.test(m.name));
  if (shoes) {
    const sp = shoes.geometry.attributes.position, w = new THREE.Vector3();
    for (let i = 0; i < sp.count; i += 2) { w.fromBufferAttribute(sp, i); shoes.localToWorld(w); dish.worldToLocal(w); if (w.z > hem + 0.004 && w.z < zJ) below.push([w.x, w.y + (w.y < 0 ? -0.004 : 0.004), w.z]); }
  }

  // 2) القصّ الهندسي للدشداشة الأصلية (حذف «رجلي البنطال» بين خط الوصل والذيل)
  const f = (p) => Math.min(p[2] - zKeepLow, zJ - p[2]);    // موجب = يُحذف
  const { segs, removed } = clipKeep(dish.geometry, f);
  dish.geometry.computeBoundingSphere();
  const top = segs.filter((s) => Math.abs(s[0][2] - zJ) < 1e-4 && Math.abs(s[1][2] - zJ) < 1e-4).map((s) => [[s[0][0], s[0][1]], [s[1][0], s[1][1]]]);
  if (top.length < 8) return { applied: false, reason: 'cut-edge' };
  let ymin = 9, ymax = -9, xmin = 9, xmax = -9;
  for (const s of top) for (const q of s) { ymin = Math.min(ymin, q[1]); ymax = Math.max(ymax, q[1]); xmin = Math.min(xmin, q[0]); xmax = Math.max(xmax, q[0]); }
  const c = [(xmin + xmax) / 2, (ymin + ymax) / 2];

  // 3) الحلقات
  const M = 192, dirs = [];
  for (let m = 0; m <= M; m++) { const ph = -Math.PI + TAU * m / M; dirs.push([Math.sin(ph), -Math.cos(ph)]); }   // ph = 0 للأمام (−y)، ودرزة القوام في الخلف
  const topHull = polySegs(hull2(top.flat()));
  const r0 = dirs.map((d) => { const r = rayFar(c, d, top); return (r > 0 ? r : rayFar(c, d, topHull)) + 0.0008; });   // تراكب أقل من 1 مم فوق حافة القصّ: لا شقوق بين عيّنات الحلقة
  // درزة متراكبة: الحافة العليا للذيل تدخل 1.5 سم تحت القماش الأصلي (أضيق منه بـ 3 مم)، فلا يُرى شقّ بين الحافتين من أي زاوية
  const rings = [{ z: zJ + 0.015, r: r0.map((v) => v - 0.003), tuck: true }, { z: zJ, r: r0 }];
  const step = 0.02, NZ = Math.max(4, Math.ceil((zJ - hem) / step));
  let prev = r0.slice(), maxPen = 0; const base = r0.slice();
  for (let j = 1; j <= NZ; j++) {
    const z = zJ - (zJ - hem) * j / NZ;
    // غلاف ما يقع عند هذا الارتفاع (الساقان معًا والحذاء)؛ والسقوط الرتيب أدناه يمنع الثوب من الالتفاف حول كل ساق
    const pts = below.filter((q) => Math.abs(q[2] - z) <= 0.025).map((q) => [q[0], q[1]]);
    const H = pts.length >= 3 ? polySegs(hull2(pts)) : null;
    const t = smooth(0, 0.2, zJ - z);                       // انتقال ناعم من مقطع الحوض إلى سقوط الثوب (بلا حافة عند الوركين)
    const flare = 1 + 0.05 * clamp((zJ - z) / 0.6);         // اتساع خفيف نحو الذيل
    const amp = 0.0045 * smooth(0.05, 0.4, zJ - z);          // طيّات هادئة تزداد قرب الذيل
    const r = dirs.map((d, m) => {
      const ph = -Math.PI + TAU * m / M;
      const env = H ? rayFar(c, d, H) + 0.009 : prev[m];
      const fold = amp * (0.5 + 0.5 * Math.sin(9 * ph + 3.1 * z)) * (0.6 + 0.4 * Math.sin(5 * ph - 1.3));
      base[m] = Math.max(base[m], env);                     // سقوط رتيب: لا يضيق الثوب إلى الأسفل
      return base[m] * (1 + (flare - 1) * t) + fold * t;
    });
    // تنعيم أفقي خفيف (القماش لا يتبع زوايا الغلاف الحادة) مع بقاء الغلاف داخله
    const rs = r.map((v, m) => { const a = r[(m - 1 + M) % M], b = r[(m + 1) % M]; return Math.max(v, (a + 2 * v + b) / 4); });
    rs[M] = rs[0];
    // قياس الاختراق: أقرب نقطة من الغلاف إلى خارج الثوب
    if (H) for (const q of pts) { const dx = q[0] - c[0], dy = q[1] - c[1], rr = Math.hypot(dx, dy); let ph = Math.atan2(dx, -dy), m = Math.round((ph + Math.PI) / TAU * M); m = ((m % M) + M) % M; maxPen = Math.max(maxPen, rr - rs[m]); }
    rings.push({ z, r: rs }); prev = rs;
  }

  // 4) الهندسة. أوزان الحلقات العليا من رؤوس حافة القصّ نفسها (فيتحرك الوصل مع الخصر عند التنفس بلا فراغ)، ثم الحوض تدريجيًا
  const ga = dish.geometry.attributes, cutV = [];
  for (let i = 0; i < ga.position.count; i++) if (Math.abs(ga.position.getZ(i) - zJ) < 2e-4) cutV.push(i);
  const edgeW = dirs.map((d, m) => {
    const q = [c[0] + d[0] * r0[m], c[1] + d[1] * r0[m]]; let bi = -1, bd = 1e9;
    for (const i of cutV) { const dd = (ga.position.getX(i) - q[0]) ** 2 + (ga.position.getY(i) - q[1]) ** 2; if (dd < bd) { bd = dd; bi = i; } }
    if (bi < 0) return [[rootIdx, 0, 0, 0], [1, 0, 0, 0], null];
    let nx = ga.normal.getX(bi), ny = ga.normal.getY(bi), nz = ga.normal.getZ(bi);
    if (nx * d[0] + ny * d[1] < 0) { nx = -nx; ny = -ny; nz = -nz; }        // نمط الوجه الخارجي
    return [[0, 1, 2, 3].map((k) => ga.skinIndex.array[bi * 4 + k]), [0, 1, 2, 3].map((k) => ga.skinWeight.array[bi * 4 + k]), [nx, ny, nz]];
  });
  const P = [], UV = [], SI = [], SW = [], idx = [];
  rings.forEach((ring, j) => {
    for (let m = 0; m <= M; m++) {
      const d = dirs[m], r = ring.r[m];
      P.push(c[0] + d[0] * r, c[1] + d[1] * r, ring.z);
      UV.push(m / M, clamp(ring.z / HT));
      const wt = smooth(0, 0.12, zJ - ring.z), ew = edgeW[m], acc = new Map([[rootIdx, wt]]);
      for (let k = 0; k < 4; k++) if (ew[1][k] > 0) acc.set(ew[0][k], (acc.get(ew[0][k]) || 0) + ew[1][k] * (1 - wt));
      const tw = [...acc.entries()].sort((x, y) => y[1] - x[1]).slice(0, 4), tt = tw.reduce((x, y) => x + y[1], 0) || 1;
      for (let k = 0; k < 4; k++) { SI.push(tw[k] ? tw[k][0] : 0); SW.push(tw[k] ? tw[k][1] / tt : 0); }
    }
  });
  for (let j = 0; j < rings.length - 1; j++) for (let m = 0; m < M; m++) {
    const a = j * (M + 1) + m, b = a + 1, d = a + M + 1, e = d + 1;
    idx.push(a, b, d, b, e, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2));
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(SI, 4));
  g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(SW, 4));
  g.setIndex(idx);
  g.computeVertexNormals();
  // اتجاه الأوجه إلى الخارج، ودمج أنماط درزة الخلف (العمود الأول = الأخير)
  const N = g.attributes.normal;
  { const k = Math.floor(rings.length / 2) * (M + 1); const nx = N.getX(k), ny = N.getY(k); if (nx * dirs[0][0] + ny * dirs[0][1] < 0) { idx.reverse(); g.setIndex(idx); g.computeVertexNormals(); } }
  for (let j = 0; j < rings.length; j++) {
    const a = j * (M + 1), b = a + M;
    const x = N.getX(a) + N.getX(b), y = N.getY(a) + N.getY(b), z = N.getZ(a) + N.getZ(b), l = Math.hypot(x, y, z) || 1;
    N.setXYZ(a, x / l, y / l, z / l); N.setXYZ(b, x / l, y / l, z / l);
  }
  // أنماط الحلقات العليا تبدأ من أنماط حافة الخصر نفسها ثم تتحول تدريجيًا (لا خط ظل عند الوصل)
  rings.forEach((ring, j) => {
    const w = 1 - smooth(0, 0.1, zJ - ring.z); if (w <= 0) return;
    for (let m = 0; m <= M; m++) {
      const en = edgeW[m % M][2]; if (!en) continue;
      const i = j * (M + 1) + m, x = N.getX(i) * (1 - w) + en[0] * w, y = N.getY(i) * (1 - w) + en[1] * w, z = N.getZ(i) * (1 - w) + en[2] * w, l = Math.hypot(x, y, z) || 1;
      N.setXYZ(i, x / l, y / l, z / l);
    }
  });
  N.needsUpdate = true;

  const mat = (Array.isArray(dish.material) ? dish.material[0] : dish.material).clone();
  mat.side = THREE.DoubleSide;                            // يُرى باطن الذيل من الأسفل كقماش لا كفراغ
  const skirt = new THREE.SkinnedMesh(g, mat);
  skirt.name = 'Outfit_dishdasha_skirt';
  skirt.position.copy(dish.position); skirt.quaternion.copy(dish.quaternion); skirt.scale.copy(dish.scale);
  dish.parent.add(skirt); skirt.updateMatrixWorld(true);
  skirt.bind(dish.skeleton, dish.bindMatrix.clone());
  skirt.castShadow = skirt.receiveShadow = true; skirt.frustumCulled = false;

  // 5) العازف: لوح ما بين الركبتين (حل خاص بالجلوس) لم يعد له مكان
  let drape = 0;
  for (const m of meshes) if (m.name === 'Outfit_robe_drape') { m.parent.remove(m); m.geometry.dispose(); drape++; }

  // مطابقة الحلقة العليا لحافة القصّ: أبعد مسافة بين نقطة من الحلقة وأقرب نقطة على الحافة
  let seam = 0;
  for (let m = 0; m < M; m += 4) {
    const q = [c[0] + dirs[m][0] * r0[m], c[1] + dirs[m][1] * r0[m]]; let best = 9;
    for (const [a, b] of top) { const ex = b[0] - a[0], ey = b[1] - a[1], l2 = ex * ex + ey * ey || 1; const t = clamp(((q[0] - a[0]) * ex + (q[1] - a[1]) * ey) / l2); best = Math.min(best, Math.hypot(a[0] + ex * t - q[0], a[1] + ey * t - q[1])); }
    seam = Math.max(seam, best);
  }
  return { applied: true, male, zJ: +zJ.toFixed(3), hem, rings: rings.length, removedTris: removed, seamMm: +(seam * 1000).toFixed(2), penetrationMm: +(Math.max(0, maxPen) * 1000).toFixed(1), drapeRemoved: drape,
    hemHalfWidth: +((rings[rings.length - 1].r[M / 4] + rings[rings.length - 1].r[3 * M / 4]) / 2).toFixed(3) };
}
