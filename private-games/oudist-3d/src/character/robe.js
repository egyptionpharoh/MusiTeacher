// =====================================================================
//  ثوب العازفة الساتر في وضعية الجلوس — خاص بهذه اللعبة (لا يمسّ الملفات المشتركة ولا الألعاب الأخرى).
//
//  المشكلة: زيّ العازفة المشترك مبنيّ بنفخ شبكة الجسم نفسها، فهو «جلد ثانٍ» ملتصق: يرسم الأرداف والفخذين وما بينهما،
//  وتظهر عند الخصر والإبط حواف ممزّقة، ولأن خامته وجه واحد تبدو من الخلف والأسفل ثقوب كأنها شفافية.
//
//  الحل: دشداشة حقيقية فضفاضة تُبنى هندسيًا حول الجسم الجالس: أنبوب واسع ينحني مع الجسم
//  (جذع ← حوض ← فخذان ← ركبتان ← طرف منسدل تحت الركبة)، ومقطعه في كل موضع هو «الغلاف المحدّب» لنقاط الجسم هناك
//  مع هامش اتساع. الغلاف المحدّب لا يدخل في أي تجويف: فلا فصّان ولا شقّ ولا خصر مرسوم ولا فراغ بين الفخذين،
//  بل قماش مشدود برخاوة فوق الحِجر كما في الثوب الحقيقي. يُربط بالهيكل العظمي نفسه (أوزان أقرب رأس من الزيّ الأصلي)
//  فيتحرك مع التنفس والعزف، وخامته معتمة بوجهين.
// =====================================================================
import * as THREE from 'three';

const hull2 = (pts) => {                      // الغلاف المحدّب (Andrew monotone chain)
  const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]); if (p.length < 3) return p;
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = []; for (const q of p) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  const up = []; for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  lo.pop(); up.pop(); return lo.concat(up);
};
const rayHull = (h, c, th) => {               // بُعد حدّ الغلاف عن المركز c في الاتجاه th
  const dx = Math.cos(th), dy = Math.sin(th); let best = 0;
  for (let i = 0; i < h.length; i++) {
    const a = h[i], b = h[(i + 1) % h.length], ex = b[0] - a[0], ey = b[1] - a[1], den = dx * ey - dy * ex; if (Math.abs(den) < 1e-12) continue;
    const t = ((a[0] - c[0]) * ey - (a[1] - c[1]) * ex) / den, u = ((a[0] - c[0]) * dy - (a[1] - c[1]) * dx) / den;
    if (t > 0 && u >= -1e-6 && u <= 1 + 1e-6 && t > best) best = t;
  }
  return best;
};

/**
 * @param rig   هيكل الشخصية في وضعية الجلوس الحالية
 * @param seat  { y, zFront, zBack, halfW }
 * @param opt   { color, gold, teal, margin, hemY }
 */
export function buildSeatedRobe(rig, seat, opt = {}) {
  const dish = rig.meshes.find((m) => /dishdasha/i.test(m.name)); if (!dish) return { built: false, reason: 'no-cloth' };
  const old = rig.meshes.find((m) => m.name === 'Outfit_robe_seated'); if (old) return { built: false, reason: 'exists' };
  dish.updateMatrixWorld(true); dish.skeleton.bones.forEach((b) => b.updateMatrixWorld(true));
  const bones = dish.skeleton.bones, si = dish.geometry.attributes.skinIndex, sw = dish.geometry.attributes.skinWeight, n = dish.geometry.attributes.position.count;
  // --- نقاط الجسم (من الزيّ الأصلي في وضعية الجلوس): الجذع والحوض والساقان فقط (بلا ذراعين ولا كتفين) ---
  const p = new THREE.Vector3(), P = [], kind = new Uint8Array(n), keep = [];
  for (let i = 0; i < n; i++) {
    let bw = 0, bj = 0; for (let j = 0; j < 4; j++) { const w = sw.getComponent(i, j); if (w > bw) { bw = w; bj = si.getComponent(i, j); } }
    const nm = bones[bj].name; let k = 0;
    if (/^(upperleg|lowerleg)/i.test(nm)) k = /^lowerleg/i.test(nm) ? 3 : 2; else if (/^(root|pelvis|spine0[2-5]|breast|hips)/i.test(nm)) k = 1;
    kind[i] = k; if (!k) continue;
    rig.vertexWorld(dish, i, p); P.push([p.x, p.y, p.z, k, i]); keep.push(i);
  }
  if (P.length < 200) return { built: false, reason: 'few-points' };
  const hL = rig.wp('L', 'upperLeg'), hR = rig.wp('R', 'upperLeg'), kL = rig.wp('L', 'lowerLeg'), kR = rig.wp('R', 'lowerLeg');
  const hipY = (hL.y + hR.y) / 2, hipZ = (hL.z + hR.z) / 2, kneeZ = (kL.z + kR.z) / 2, kneeYmin = Math.min(kL.y, kR.y);
  let yTop = -Infinity; for (const q of P) if (q[3] === 1 && q[1] > yTop) yTop = q[1];
  yTop = Math.min(yTop - 0.01, hipY + (opt.top ?? 0.36));
  const A1 = [hipY + 0.085, hipZ + 0.10];                 // ثنية الحِجر (محور انحناء الثوب عند الحوض): y, z
  const A2 = [kneeYmin - 0.075, kneeZ - 0.065];           // خلف الركبة (محور الانحناء الثاني)
  const hemY = opt.hemY ?? 0.18, M = 56, SL = 0.013, step = 0.018, mg = opt.margin ?? 0.015;
  // --- المقاطع: كل مقطع = نقطة أصل + محور e2 (المحور الأول دائمًا x العالمي) + العمودي n + قاعدة اختيار النقاط ---
  const secs = [];
  for (let y = yTop; y > A1[0] + 1e-6; y -= step) secs.push({ grp: 'T', min: 150, o: [0, y, 0], e2: [0, 0, 1], n: [0, -1, 0], pick: (q) => q[3] === 1, m: mg });
  for (let a = 9; a < 90; a += 9) { const f = a * Math.PI / 180, e2 = [0, Math.sin(f), Math.cos(f)]; secs.push({ grp: 'B1', o: [0, A1[0], A1[1]], e2, n: [0, -Math.cos(f), Math.sin(f)], pick: (q, v) => v < 0.012, m: mg + 0.002 }); }
  for (let z = A1[1]; z < A2[1] - 1e-6; z += step) secs.push({ grp: 'Th', leg: true, o: [0, 0, z], e2: [0, 1, 0], n: [0, 0, 1], pick: (q) => q[3] >= 2 || q[1] < A1[0], m: mg + 0.002 });
  for (let a = 9; a < 90; a += 9) { const f = a * Math.PI / 180, e2 = [0, Math.cos(f), Math.sin(f)]; secs.push({ grp: 'B2', leg: true, o: [0, A2[0], A2[1]], e2, n: [0, -Math.sin(f), Math.cos(f)], pick: (q, v) => q[3] >= 2 && v > -0.012, m: mg + 0.003 }); }
  { const y0 = A2[0], cnt = Math.max(2, Math.ceil((y0 - hemY) / step)); for (let i = 0; i <= cnt; i++) { const y = y0 + (hemY - y0) * i / cnt; secs.push({ grp: 'S', leg: true, o: [0, y, 0], e2: [0, 0, 1], n: [0, -1, 0], pick: (q) => q[3] === 3 || (q[3] === 2 && q[2] > A2[1] - 0.02), m: mg + 0.003 + 0.016 * i / cnt, hem: i / cnt }); } }
  // --- لكل مقطع: إسقاط النقاط القريبة على مستواه ثم غلاف محدّب. المركز = مركز صندوق الغلاف (ثابت ومتصل)، يُنعَّم في فضاء العالم ---
  const K = secs.length, H = [], Cw = [];
  for (let k = 0; k < K; k++) {
    const s = secs[k], pts = [], sl = s.leg ? 0.03 : SL;
    for (const q of P) { const dx = q[0] - s.o[0], dy = q[1] - s.o[1], dz = q[2] - s.o[2]; if (Math.abs(dy * s.n[1] + dz * s.n[2]) > sl) continue; const v = dy * s.e2[1] + dz * s.e2[2]; if (!s.pick(q, v)) continue; pts.push([dx, v]); }
    if (pts.length < (s.min || 40)) { H.push(null); Cw.push(null); continue; }
    const h = hull2(pts); let x0 = Infinity, x1 = -Infinity, v0 = Infinity, v1 = -Infinity; for (const q of h) { x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); v0 = Math.min(v0, q[1]); v1 = Math.max(v1, q[1]); }
    if (x1 - x0 < 0.2 && s.leg) { H.push(null); Cw.push(null); continue; }            // مقطع التقط ساقًا واحدة فقط: يُستعار من جاره
    const cu = (x0 + x1) / 2, cv = (v0 + v1) / 2; H.push(h); Cw.push([s.o[0] + cu, s.o[1] + s.e2[1] * cv, s.o[2] + s.e2[2] * cv]);
  }
  // المقاطع الناقصة (نقاط قليلة) تستعير غلاف أقرب مقطع سليم من النوع نفسه منقولًا إلى موضعها
  for (let k = 0; k < K; k++) if (!H[k]) { let src = -1; for (let d = 1; d < K && src < 0; d++) for (const j of [k + d, k - d]) if (j >= 0 && j < K && H[j] && secs[j].grp === secs[k].grp) { src = j; break; } if (src < 0) return { built: false, reason: 'empty-sections' };
    H[k] = H[src]; const so = secs[src], sk = secs[k], dw = [Cw[src][0] - so.o[0], Cw[src][1] - so.o[1], Cw[src][2] - so.o[2]]; Cw[k] = [sk.o[0] + dw[0], sk.o[1] + dw[1], sk.o[2] + dw[2]]; secs[k].borrow = [dw[0] - (Cw[src][0] - so.o[0]), 0]; }
  const C = Cw.map((c, k) => { const s = secs[k]; return [c[0] - s.o[0], (c[1] - s.o[1]) * s.e2[1] + (c[2] - s.o[2]) * s.e2[2]]; });
  const C0 = C.map((c) => c.slice());
  for (let it = 0; it < 4; it++) { const w = Cw.map((c) => c.slice()); for (let k = 1; k < K - 1; k++) for (let d = 0; d < 3; d++) Cw[k][d] = (w[k - 1][d] + 2 * w[k][d] + w[k + 1][d]) / 4; }
  const R = [];
  for (let k = 0; k < K; k++) {
    const s = secs[k], c = [Cw[k][0] - s.o[0], (Cw[k][1] - s.o[1]) * s.e2[1] + (Cw[k][2] - s.o[2]) * s.e2[2]];
    // الغلاف المستعار معرَّف حول مركزه الأصلي: يُزاح مع المركز
    const sh = [c[0] - C0[k][0], c[1] - C0[k][1]], hk = secs[k].borrow ? H[k].map((q) => [q[0] + sh[0], q[1] + sh[1]]) : H[k];
    const r = new Float32Array(M); for (let j = 0; j < M; j++) r[j] = Math.max(0.03, rayHull(hk, c, j / M * Math.PI * 2));
    R.push(r); C[k] = c;
  }
  const R0 = R.map((r) => Float32Array.from(r));
  // تنعيم الأنصاف حول المحيط وعلى طول الثوب — قماش واحد متصل بلا تموّج — مع بقائه خارج الجسم دائمًا (الهامش يُضاف بعد ذلك)
  for (let it = 0; it < 6; it++) {
    for (let k = 0; k < K; k++) { const a = Float32Array.from(R[k]); for (let j = 0; j < M; j++) R[k][j] = (a[(j + M - 1) % M] + 2 * a[j] + a[(j + 1) % M]) / 4; }
    const cp = R.map((r) => Float32Array.from(r)); for (let k = 1; k < K - 1; k++) for (let j = 0; j < M; j++) R[k][j] = (cp[k - 1][j] + 2 * cp[k][j] + cp[k + 1][j]) / 4;
  }
  for (let k = 0; k < K; k++) for (let j = 0; j < M; j++) R[k][j] = Math.max(R[k][j], R0[k][j] - 0.008);
  // قَصّة مستقيمة منسدلة: على امتداد الجذع والحوض لا ينثني القماش إلى الداخل عند الخصر (أعلى غلاف محدّب على طول الثوب لكل اتجاه)،
  // فلا يُرسم الخصر ولا استدارة الورك؛ ينسدل الثوب من الصدر والظهر إلى الحوض خطًّا واحدًا.
  { const kEnd = secs.findIndex((x) => x.grp === 'Th'), n = kEnd > 2 ? kEnd : 0;
    for (let j = 0; j < M; j++) { const col = new Float32Array(n); for (let k = 0; k < n; k++) col[k] = R[k][j];
      for (let k = 1; k < n - 1; k++) { let best = col[k]; for (let a = 0; a < k; a++) for (let b = k + 1; b < n; b++) { const v = col[a] + (col[b] - col[a]) * (k - a) / (b - a); if (v > best) best = v; } R[k][j] = best; } }
    // أعلى الثوب يختفي تحت اللحاف: يضيق تدريجيًا إلى سطح الزيّ الأصلي (بلا هامش) فلا يبرز من قماش اللحاف
    for (let k = 0; k < n; k++) { const t = Math.min(1, Math.max(0, (yTop - secs[k].o[1]) / 0.11)), w = t * t * (3 - 2 * t); secs[k].m = secs[k].m * w - 0.003 * (1 - w); for (let j = 0; j < M; j++) R[k][j] = R0[k][j] + (R[k][j] - R0[k][j]) * w; } }
  // --- الرؤوس ---
  const pos = [], uv = [], W = []; let len = 0; const cen = [];
  for (let k = 0; k < K; k++) { const s = secs[k]; cen.push([s.o[0] + C[k][0], s.o[1] + s.e2[1] * C[k][1], s.o[2] + s.e2[2] * C[k][1]]); }
  for (let k = 0; k < K; k++) {
    const s = secs[k]; if (k) len += Math.hypot(cen[k][0] - cen[k - 1][0], cen[k][1] - cen[k - 1][1], cen[k][2] - cen[k - 1][2]);
    for (let j = 0; j <= M; j++) {
      const th = (j % M) / M * Math.PI * 2, r = R[k][j % M] + s.m, u = C[k][0] + r * Math.cos(th), v = C[k][1] + r * Math.sin(th);
      let x = s.o[0] + u, y = s.o[1] + s.e2[1] * v, z = s.o[2] + s.e2[2] * v;
      if (y < seat.y + 0.005 && Math.abs(x) < seat.halfW + 0.01 && z < seat.zFront + 0.01 && z > seat.zBack - 0.03) y = seat.y + 0.005;     // لا يدخل الثوب في المقعد
      if (z < seat.zBack + 0.004 && y > seat.y) z = seat.zBack + 0.004;                                                                       // ولا في ظهر الكرسي
      // القماش ينضغط تحت العود ولا يخترقه: الرؤوس الواقعة داخل جسم العود تُزاح إلى سطحه (opt.press)
      if (opt.press) { const q = opt.press(x, y, z); x = q[0]; y = q[1]; z = q[2]; }
      pos.push(x, y, z); uv.push(j / M, len); W.push(s.leg ? 1 : 0);
    }
  }
  for (let i = 1; i < uv.length; i += 2) uv[i] = 1 - uv[i] / len;
  const idx = []; for (let k = 0; k < K - 1; k++) for (let j = 0; j < M; j++) { const a = k * (M + 1) + j, b = a + 1, c = a + M + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
  // --- الربط بالهيكل: أوزان أقرب رأس من الزيّ الأصلي، والموضع يُحوَّل إلى فضاء الربط بمعكوس مصفوفة الجلد ---
  const NV = pos.length / 3, skI = new Uint16Array(NV * 4), skW = new Float32Array(NV * 4), bindPos = new Float32Array(NV * 3);
  const BM = bones.map((b, j) => new THREE.Matrix4().multiplyMatrices(b.matrixWorld, dish.skeleton.boneInverses[j]));
  const pre = new THREE.Matrix4().multiplyMatrices(dish.matrixWorld, dish.bindMatrixInverse), S = new THREE.Matrix4(), Km = new THREE.Matrix4();
  const grid = new Map(), cell = 0.03, key = (x, y, z) => Math.floor(x / cell) + ',' + Math.floor(y / cell) + ',' + Math.floor(z / cell);
  for (let a = 0; a < P.length; a++) { const q = P[a], kk = key(q[0], q[1], q[2]); let g = grid.get(kk); if (!g) grid.set(kk, g = []); g.push(a); }
  for (let v = 0; v < NV; v++) {
    const x = pos[v * 3], y = pos[v * 3 + 1], z = pos[v * 3 + 2]; let best = -1, bd = Infinity;
    for (let rad = 1; rad <= 4 && best < 0; rad++) { const cx = Math.floor(x / cell), cy = Math.floor(y / cell), cz = Math.floor(z / cell);
      for (let a = -rad; a <= rad; a++) for (let b = -rad; b <= rad; b++) for (let c = -rad; c <= rad; c++) { const g = grid.get((cx + a) + ',' + (cy + b) + ',' + (cz + c)); if (!g) continue; for (const id of g) { const q = P[id], d = (q[0] - x) ** 2 + (q[1] - y) ** 2 + (q[2] - z) ** 2; if (d < bd) { bd = d; best = id; } } } }
    if (best < 0) { for (let id = 0; id < P.length; id++) { const q = P[id], d = (q[0] - x) ** 2 + (q[1] - y) ** 2 + (q[2] - z) ** 2; if (d < bd) { bd = d; best = id; } } }
    const src = P[best][4]; S.elements.fill(0);
    for (let j = 0; j < 4; j++) { const w = sw.getComponent(src, j), bi = si.getComponent(src, j); skI[v * 4 + j] = bi; skW[v * 4 + j] = w; if (!w) continue; const e = BM[bi].elements; for (let q = 0; q < 16; q++) S.elements[q] += w * e[q]; }
    Km.multiplyMatrices(pre, S).multiply(dish.bindMatrix).invert(); p.set(x, y, z).applyMatrix4(Km);
    bindPos[v * 3] = p.x; bindPos[v * 3 + 1] = p.y; bindPos[v * 3 + 2] = p.z;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(bindPos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute('skinIndex', new THREE.BufferAttribute(skI, 4)); geo.setAttribute('skinWeight', new THREE.BufferAttribute(skW, 4)); geo.setIndex(idx);
  // العموديات تُحسب في فضاء العالم (الشكل الحقيقي) ثم تُحوَّل تقريبًا إلى فضاء الربط عبر هندسة مؤقتة
  { const tmp = new THREE.BufferGeometry(); tmp.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); tmp.setIndex(idx); tmp.computeVertexNormals(); const nw = tmp.attributes.normal;
    for (let k = 0; k < K; k++) { const a = k * (M + 1), b = a + M; const nx = nw.getX(a) + nw.getX(b), ny = nw.getY(a) + nw.getY(b), nz = nw.getZ(a) + nw.getZ(b), l = Math.hypot(nx, ny, nz) || 1; nw.setXYZ(a, nx / l, ny / l, nz / l); nw.setXYZ(b, nx / l, ny / l, nz / l); }
    const nb = new Float32Array(NV * 3), L3 = new THREE.Matrix3(), q = new THREE.Vector3();
    for (let v = 0; v < NV; v++) { S.elements.fill(0); for (let j = 0; j < 4; j++) { const w = skW[v * 4 + j]; if (!w) continue; const e = BM[skI[v * 4 + j]].elements; for (let t = 0; t < 16; t++) S.elements[t] += w * e[t]; }
      Km.multiplyMatrices(pre, S).multiply(dish.bindMatrix); L3.setFromMatrix4(Km).invert(); q.set(nw.getX(v), nw.getY(v), nw.getZ(v)).applyMatrix3(L3).normalize(); nb[v * 3] = q.x; nb[v * 3 + 1] = q.y; nb[v * 3 + 2] = q.z; }
    geo.setAttribute('normal', new THREE.BufferAttribute(nb, 3)); tmp.dispose(); }
  // --- الخامة: قماش معتم بوجهين بلون الدشداشة نفسه، وشريط تطريز عند الطرف (هوية الزيّ كما هي) ---
  const col = opt.color || '#7a1f2e', gold = opt.gold || '#d8b25a', teal = opt.teal || '#2f6b5a';
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 1024; const x = cv.getContext('2d');
  x.fillStyle = col; x.fillRect(0, 0, 512, 1024);
  { const im = x.getImageData(0, 0, 512, 1024), a = im.data; let sd = 7; const rnd = () => ((sd = (sd * 1664525 + 1013904223) >>> 0) / 4294967296); for (let i = 0; i < a.length; i += 4) { const k = 1 + (rnd() - 0.5) * 0.07; a[i] *= k; a[i + 1] *= k; a[i + 2] *= k; } x.putImageData(im, 0, 0); }
  { const y0 = 1024 * 0.955, h = 1024 * 0.03; x.fillStyle = gold; x.fillRect(0, y0, 512, h); x.fillStyle = teal; x.fillRect(0, y0 + h * 0.36, 512, h * 0.28);
    x.strokeStyle = '#f4e2a8'; x.lineWidth = 2; x.beginPath(); for (let i = 0; i <= 24; i++) { const xx = i * 512 / 24, yy = y0 + (i % 2 ? h * 0.12 : h * 0.88); if (i) x.lineTo(xx, yy); else x.moveTo(xx, yy); } x.stroke(); }
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = THREE.RepeatWrapping; tex.anisotropy = 4;
  const base = dish.material, mat = new THREE.MeshPhysicalMaterial({ map: tex, color: 0xffffff, roughness: 0.8, metalness: 0, side: THREE.DoubleSide, transparent: false, opacity: 1,
    normalMap: base.normalMap || null, sheen: 0.1, sheenRoughness: 0.7, sheenColor: new THREE.Color(0x805048) });
  if (base.normalMap) mat.normalScale = new THREE.Vector2(0.28, 0.28);
  const mesh = new THREE.SkinnedMesh(geo, mat);
  mesh.name = 'Outfit_robe_seated'; mesh.position.copy(dish.position); mesh.quaternion.copy(dish.quaternion); mesh.scale.copy(dish.scale);
  dish.parent.add(mesh); mesh.updateMatrixWorld(true); mesh.bind(dish.skeleton, dish.bindMatrix.clone());
  mesh.castShadow = mesh.receiveShadow = true; mesh.frustumCulled = false;
  rig.meshes.push(mesh); if (rig.buildDominance) rig.buildDominance();
  // مواضع الرؤوس في العالم لحظة البناء + علامة «جزء الحِجر/الساقين»: يستعملها وضع العود على الحِجر (الثوب ثابت بالنسبة إلى الجسم الجالس)
  mesh.userData.worldPos = Float32Array.from(pos); mesh.userData.lapMask = Uint8Array.from(W);
  // الزيّ الأصلي تحته: معتم بوجهين أيضًا (ما يظهر منه: أعلى الصدر تحت اللحاف وكمّا السروال)
  for (const m of rig.meshes) if (/^Outfit_(dishdasha|sleeves)/.test(m.name) && m.material) { m.material.side = THREE.DoubleSide; m.material.transparent = false; m.material.opacity = 1; m.material.needsUpdate = true; }
  return { built: true, sections: K, verts: NV, yTop: +yTop.toFixed(3), hemY };
}
