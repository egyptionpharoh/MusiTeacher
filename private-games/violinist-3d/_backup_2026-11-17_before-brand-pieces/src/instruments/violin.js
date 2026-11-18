// الكمان كامل الحجم 4/4 — الهندسة كما في الأصل
// مستخرج حرفيًا من violin-player-3d.html الأصلي (MusiTeacher) مع إضافة export فقط.
import { V, Frame, F } from '../engine/math.js';
import { grid, merge, xform, crSample, sweep, loft, ellipsoid, roundBox, extrude, computeNormals } from '../engine/geometry.js';
import { rng, cnv } from '../engine/textures.js';

// =====================================================================
//  Violin and bow (full size 4/4). Violin-local frame:
//  y = along the instrument toward the scroll, z = out of the top plate,
//  x = y × z  (E-string side = +x, G-string side = -x).
//  Origin: centre line at the bridge position, on the plane of the top edge.
// =====================================================================
const VN = {
  yBot: -0.161, yTop: 0.195, yNut: 0.325, yFbEnd: 0.055, ribs: 0.031,
  archTop: 0.0155, archBack: 0.0145,
  // fingerboard surface height along y (neck is angled toward the bridge)
  zFb(y) { return 0.023 + (0.038 - 0.023) * (VN.yNut - y) / (VN.yNut - VN.yFbEnd); },
  fbHalfW(y) { return 0.012 + (0.0215 - 0.012) * (VN.yNut - y) / (VN.yNut - VN.yFbEnd); },
  // string layout: G, D, A, E
  names: ['G', 'D', 'A', 'E'],
  xBridge: [-0.0172, -0.0057, 0.0057, 0.0172], xNut: [-0.0083, -0.0028, 0.0028, 0.0083],
  zBridge(x) { return 0.046 + 0.0026 * (1 - (x / 0.0175) * (x / 0.0175)); },
  zNutStr: 0.0245,
  // a point on string s at height y (straight line bridge→nut)
  stringAt(s, y) {
    const t = y / VN.yNut, x = VN.xBridge[s] + (VN.xNut[s] - VN.xBridge[s]) * t;
    const z = VN.zBridge(VN.xBridge[s]) + (VN.zNutStr - VN.zBridge(VN.xBridge[s])) * t;
    return [x, y, z];
  },
  chinrestTop: [-0.033, -0.128, 0.031],
};

// classic outline with pointed corners (three Catmull-Rom runs per side)
function violinOutline() {
  const L = [[0, -0.161], [0.03, -0.158], [0.058, -0.149], [0.08, -0.134], [0.096, -0.112], [0.104, -0.085], [0.104, -0.058], [0.099, -0.037], [0.092, -0.023], [0.095, -0.009]];
  const C = [[0.095, -0.009], [0.079, -0.006], [0.065, 0.004], [0.057, 0.02], [0.055, 0.035], [0.057, 0.05], [0.064, 0.063], [0.076, 0.072], [0.091, 0.076]];
  const U = [[0.091, 0.076], [0.087, 0.088], [0.084, 0.105], [0.084, 0.125], [0.079, 0.146], [0.068, 0.165], [0.05, 0.181], [0.026, 0.192], [0, 0.195]];
  const run = (pts, sub) => crSample(pts, sub).slice(0, -1);
  const right = [...run(L, 5), ...run(C, 5), ...crSample(U, 5)];
  const left = right.slice(1, -1).reverse().map(p => [-p[0], p[1]]);
  return right.concat(left);   // starts at bottom centre, goes up the +x side, back down the -x side
}

// ---------- textures ----------
const VP = (x, y, W, H) => [(x + 0.11) / 0.22 * W, (0.2 - y) / 0.365 * H]; // plate uv mapping
function texViolinTop(outline) {
  const W = 1024, H = 1700, c = cnv(W, H), x = c.getContext('2d'), r = rng(21);
  const g = x.createLinearGradient(0, 0, W, 0);
  g.addColorStop(0, '#7a3510'); g.addColorStop(0.5, '#b8621f'); g.addColorStop(1, '#7a3510');
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  for (let k = 0; k < 160; k++) {              // spruce grain along the length
    const xx = r() * W; x.strokeStyle = `rgba(60,22,4,${0.12 + r() * 0.2})`; x.lineWidth = 1 + r() * 2.2;
    x.beginPath(); x.moveTo(xx, 0); x.lineTo(xx + (r() - 0.5) * 8, H); x.stroke();
  }
  const P = (px, py) => VP(px, py, W, H);
  // purfling: black-white-black, 4 mm inside the edge
  const inset = outline.map(p => [p[0] * 0.955, 0.015 + (p[1] - 0.015) * 0.97]);
  x.beginPath(); inset.forEach((p, i) => { const q = P(p[0], p[1]); i ? x.lineTo(q[0], q[1]) : x.moveTo(q[0], q[1]); }); x.closePath();
  x.lineWidth = 9; x.strokeStyle = '#1a0c05'; x.stroke(); x.lineWidth = 3; x.strokeStyle = '#d8b07a'; x.stroke();
  // f-holes
  const fhole = (s) => {
    const up = P(s * 0.033, 0.036), lo = P(s * 0.047, -0.036), S = W / 0.22;
    x.fillStyle = '#120703'; x.strokeStyle = '#120703'; x.lineCap = 'round';
    x.beginPath(); x.arc(up[0], up[1], 0.0034 * S, 0, 7); x.fill();
    x.beginPath(); x.arc(lo[0], lo[1], 0.0044 * S, 0, 7); x.fill();
    x.lineWidth = 0.0026 * S;
    x.beginPath(); x.moveTo(up[0] + s * 0.002 * S, up[1] + 0.003 * S);
    const m1 = P(s * 0.047, 0.012), m2 = P(s * 0.033, -0.012);
    x.bezierCurveTo(m1[0], m1[1], m2[0], m2[1], lo[0] - s * 0.002 * S, lo[1] - 0.004 * S); x.stroke();
    const n = P(s * 0.040, 0.0), w = 0.0045 * S;   // bridge notches
    x.lineWidth = 0.0012 * S; x.beginPath(); x.moveTo(n[0] - w, n[1]); x.lineTo(n[0] + w, n[1]); x.stroke();
  };
  fhole(1); fhole(-1);
  return c;
}
function texMaple(seed) {
  const W = 1024, H = 1024, c = cnv(W, H), x = c.getContext('2d'), r = rng(seed);
  x.fillStyle = '#9a4a16'; x.fillRect(0, 0, W, H);
  for (let k = 0; k < 70; k++) {                // flame across the grain
    const y0 = k / 70 * H * 1.4 - H * 0.2, amp = 18 + r() * 14;
    x.strokeStyle = k % 2 ? 'rgba(235,160,80,0.32)' : 'rgba(60,20,4,0.28)'; x.lineWidth = 6 + r() * 8;
    x.beginPath(); for (let xx = 0; xx <= W; xx += 32) x.lineTo(xx, y0 + xx * 0.18 + Math.sin(xx * 0.012 + k) * amp); x.stroke();
  }
  for (let k = 0; k < 80; k++) { const xx = r() * W; x.strokeStyle = 'rgba(50,18,4,0.15)'; x.lineWidth = 1; x.beginPath(); x.moveTo(xx, 0); x.lineTo(xx, H); x.stroke(); }
  return c;
}

// ---------- violin ----------
// opt.srK: معامل ارتفاع مسند الكتف (1 = الأصل). يُضبط حسب طول رقبة العازفة كما يفعل العازفون فعلًا.
function buildViolin(R, frame, opt = {}) {
  const model = F.mat(frame), meshes = [];
  const add = (g, mat, opt = {}) => { const m = R.mesh(g, mat, Object.assign({ model }, opt)); meshes.push(m); return m; };
  const outline = violinOutline(), n = outline.length, cen = [0, 0.015];
  const matTop = { color: [1, 1, 1], tex: R.texture(texViolinTop(outline)), rough: 0.28, spec: 0.7 };
  const maple = R.texture(texMaple(5), true);
  const matBack = { color: [1, 1, 1], tex: maple, rough: 0.28, spec: 0.7 };
  const matEbony = { color: [0.07, 0.05, 0.04], rough: 0.3, spec: 0.6 };
  const matNeck = { color: [0.62, 0.34, 0.15], rough: 0.35, spec: 0.5 };
  const arch = (t, h) => h * Math.pow(Math.max(0, 1 - t * t), 0.85);
  const uv = (px, py) => [(px + 0.11) / 0.22, (0.2 - py) / 0.365];

  // top plate (arched) and back plate
  const plate = (zEdge, h, sgn) => {
    const g = grid(14, n, (i, j) => {
      const t = i / 14, p = outline[j % n];
      const px = cen[0] + (p[0] - cen[0]) * t, py = cen[1] + (p[1] - cen[1]) * t;
      return [px, py, zEdge + sgn * arch(t, h)];
    });
    for (let v = 0; v < g.p.length / 3; v++) { const q = uv(g.p[v * 3], g.p[v * 3 + 1]); g.t[v * 2] = q[0]; g.t[v * 2 + 1] = q[1]; }
    return g;
  };
  add(plate(0, VN.archTop, 1), matTop, { name: 'vtop' });
  add(plate(-VN.ribs, VN.archBack, -1), matBack, { name: 'vback' });
  // ribs
  const ribs = grid(n, 2, (i, j) => { const p = outline[i % n]; return [p[0] * 0.988, 0.015 + (p[1] - 0.015) * 0.992, -VN.ribs * j / 2]; }, { us: 6, vs: 0.15 });
  add(ribs, matBack, { name: 'vribs' });
  // edge binding (thin rounded edge of the plates)
  const edge = outline.map(p => [p[0], p[1], 0.0]); edge.push(edge[0]);
  const edgeB = outline.map(p => [p[0], p[1], -VN.ribs]); edgeB.push(edgeB[0]);
  add(merge([sweep(edge, edge.map(() => 0.0022), { seg: 6, sub: 1 }), sweep(edgeB, edgeB.map(() => 0.0022), { seg: 6, sub: 1 })]), { color: [0.45, 0.19, 0.06], rough: 0.3, spec: 0.6 });

  // neck (under the fingerboard) and heel
  add(grid(20, 18, (i, j) => {
    const y = 0.188 + (VN.yNut + 0.004 - 0.188) * i / 20, th = j / 18 * Math.PI;
    const w = VN.fbHalfW(y) * 0.98, d = 0.019 + 0.004 * (VN.yNut - y) / (VN.yNut - 0.188);
    return [w * Math.cos(th), y, VN.zFb(y) - 0.006 - d * Math.sin(th)];
  }), matNeck, { name: 'vneck' });
  add(sweep([[0, 0.2, VN.zFb(0.2) - 0.01], [0, 0.198, -0.012], [0, 0.199, -VN.ribs - 0.002]], [0.012, 0.012, 0.009], { seg: 14, flat: 1.15, up: [1, 0, 0], cap1: true }), matNeck);

  // fingerboard (ebony) with a gentle crown
  const fbo = [];
  for (let k = 0; k <= 16; k++) { const y = VN.yFbEnd + (VN.yNut - VN.yFbEnd) * k / 16; fbo.push([VN.fbHalfW(y), y]); }
  for (let k = 16; k >= 0; k--) { const y = VN.yFbEnd + (VN.yNut - VN.yFbEnd) * k / 16; fbo.push([-VN.fbHalfW(y), y]); }
  const fb = extrude(fbo.reverse(), 0, 0.006);
  for (let v = 0; v < fb.p.length / 3; v++) {
    const px = fb.p[v * 3], py = fb.p[v * 3 + 1], top = fb.p[v * 3 + 2] > 0.003;
    const w = VN.fbHalfW(py);
    fb.p[v * 3 + 2] = VN.zFb(py) - 0.006 + (top ? 0.006 + 0.0016 * (1 - (px / w) * (px / w)) : 0);
  }
  computeNormals(fb);
  add(fb, matEbony, { name: 'fingerboard' });
  add(xform(roundBox(0.025, 0.004, 0.006, 6), Frame([0, VN.yNut + 0.002, VN.zNutStr - 0.0035], [1, 0, 0], [0, 1, 0], [0, 0, 1])), matEbony);

  // pegbox and scroll
  const pbA = 0.33, pbDir = [0, Math.cos(pbA), -Math.sin(pbA)];
  const pb0 = [0, VN.yNut + 0.004, VN.zNutStr - 0.015], pb1 = V.madd(pb0, pbDir, 0.07);
  add(sweep([V.madd(pb0, pbDir, -0.01), pb0, pb1], [0.0115, 0.0118, 0.0112], { seg: 16, flat: 0.95, up: [1, 0, 0] }), matNeck, { name: 'pegbox' });
  const pbN = V.norm(V.cross([1, 0, 0], pbDir));
  add(sweep([V.madd(V.lerp(pb0, pb1, 0.08), pbN, 0.009), V.madd(V.lerp(pb0, pb1, 0.88), pbN, 0.0085)], [0.0062, 0.0055], { seg: 10, flat: 0.5, up: [1, 0, 0], cap0: true, cap1: true }), { color: [0.12, 0.06, 0.03], rough: 0.6, spec: 0.2 });
  // scroll volute: starts at the back of the pegbox end, winds over the far end and curls inward
  const sc = [], sr = [], Cs = V.add(V.madd(pb1, pbDir, 0.012), V.mul(pbN, 0.002));
  const th0 = -0.88;
  for (let k = 0; k <= 30; k++) {
    const th = th0 + k / 30 * Math.PI * 2.3, rr = 0.0156 * Math.exp(-0.15 * (th - th0));
    sc.push(V.add(Cs, V.add(V.mul(pbDir, rr * Math.sin(th)), V.mul(pbN, -rr * Math.cos(th)))));
    sr.push(0.0105 * Math.exp(-0.07 * (th - th0)));
  }
  add(sweep(sc, sr, { seg: 14, sub: 2, flat: 0.5, up: [1, 0, 0], cap0: true, cap1: true }), matNeck, { name: 'scroll' });
  add(xform(ellipsoid(0.0045, 0.0045, 0.006, 8, 12), Frame(V.add(Cs, V.mul(pbN, 0.0)), [1, 0, 0], [0, 1, 0], [0, 0, 1])), matNeck);
  // pegs: G & D on the left (-x), A & E on the right (+x)
  const pegs = [];
  [[-1, 0.2], [1, 0.38], [-1, 0.56], [1, 0.74]].forEach(([s, t], k) => {
    const c = V.lerp(pb0, pb1, t);
    pegs.push(sweep([V.add(c, [-s * 0.012, 0, 0]), V.add(c, [s * 0.022, 0, 0])], [0.0028, 0.0034], { seg: 10, cap0: true }));
    pegs.push(xform(ellipsoid(0.004, 0.0105, 0.0085, 10, 14), Frame(V.add(c, [s * 0.03, 0, 0]), [0, 1, 0], [1, 0, 0], [0, 0, -1])));
    pegs.push(xform(ellipsoid(0.004, 0.0042, 0.0042, 8, 10), Frame(V.add(c, [s * 0.023, 0, 0]), [0, 1, 0], [1, 0, 0], [0, 0, -1])));
  });
  add(merge(pegs), matEbony, { name: 'pegs' });

  // bridge (maple), standing on the arched top at y = 0
  const zb = arch(0.03, VN.archTop) - 0.0005;
  const bo = [[-0.0205, zb], [-0.0075, zb], [-0.005, zb + 0.005], [0.005, zb + 0.005], [0.0075, zb], [0.0205, zb], [0.019, zb + 0.009], [0.0145, zb + 0.016], [0.0175, zb + 0.024]];
  for (let k = 0; k <= 10; k++) { const xx = 0.0172 - 0.0344 * k / 10; bo.push([xx, VN.zBridge(xx) - 0.0004]); }
  bo.push([-0.0175, zb + 0.024], [-0.0145, zb + 0.016], [-0.019, zb + 0.009]);
  const br = extrude(bo, -0.0016, 0.0016);
  add(xform(br, Frame([0, 0, 0], [1, 0, 0], [0, 0, 1], [0, -1, 0])), { color: [0.9, 0.78, 0.6], rough: 0.5, spec: 0.2 }, { name: 'bridge' });

  // tailpiece, saddle, endpin, tailgut
  const tp = [[-0.0115, -0.152], [0.0115, -0.152], [0.019, -0.09], [0.0205, -0.062], [0.016, -0.054], [-0.016, -0.054], [-0.0205, -0.062], [-0.019, -0.09]];
  const tpg = extrude(tp, 0, 0.004);
  for (let v = 0; v < tpg.p.length / 3; v++) { const py = tpg.p[v * 3 + 1]; tpg.p[v * 3 + 2] += 0.014 + (py + 0.152) * 0.12; }
  computeNormals(tpg);
  add(tpg, matEbony, { name: 'tailpiece' });
  add(xform(roundBox(0.03, 0.006, 0.006, 6), Frame([0, -0.159, 0.002], [1, 0, 0], [0, 1, 0], [0, 0, 1])), matEbony);
  add(merge([sweep([[0, -0.15, 0.015], [0, -0.16, 0.006], [0, -0.163, -0.015]], [0.0018, 0.0018, 0.0018], { seg: 8 }),
    sweep([[0, -0.161, -0.015], [0, -0.172, -0.015]], [0.004, 0.0035], { seg: 12, cap1: true })]), matEbony);
  // E-string fine tuner
  add(sweep([[0.012, -0.066, 0.025], [0.012, -0.066, 0.033]], [0.0022, 0.0022], { seg: 10, cap1: true }), { color: [0.75, 0.75, 0.78], rough: 0.2, spec: 1.2 });

  // chinrest (left of the tailpiece) with its bracket
  const cr = VN.chinrestTop;
  const cup = loft([
    { c: [cr[0], 0.008, -cr[1]], rx: 0.03, rzF: 0.024, rzB: 0.024 },
    { c: [cr[0], 0.022, -cr[1]], rx: 0.036, rzF: 0.028, rzB: 0.028 },
    { c: [cr[0], 0.03, -cr[1]], rx: 0.037, rzF: 0.029, rzB: 0.029 },
    { c: [cr[0], 0.0335, -cr[1]], rx: 0.033, rzF: 0.026, rzB: 0.026 },
    { c: [cr[0], 0.031, -cr[1]], rx: 0.024, rzF: 0.019, rzB: 0.019 },
    { c: [cr[0], 0.0285, -cr[1]], rx: 0.0, rzF: 0.0, rzB: 0.0 },
  ].map(r => Object.assign(r, { e: 2.4 })), 28, { sub: 2 });
  // loft builds rings in its xz plane with y up: remap (x, y, z) → violin (x, z, -y) so that loft y = violin z
  add(xform(cup, Frame([0, 0, 0], [1, 0, 0], [0, 0, 1], [0, -1, 0])), matEbony, { name: 'chinrest' });
  add(merge([[-0.034, -0.153], [-0.008, -0.159]].map(([xx, yy]) => sweep([[xx, yy, 0.008], [xx, yy, -VN.ribs - 0.004]], [0.0016, 0.0016], { seg: 8 }))), { color: [0.78, 0.78, 0.8], rough: 0.2, spec: 1.1 });

  // shoulder rest under the back (rests on the player's collarbone / shoulder)
  const srK = opt.srK ?? 1;
  const srP = [[-0.098, -0.078, -0.034], [-0.07, -0.09, -0.047], [0.0, -0.108, -0.053], [0.07, -0.122, -0.047], [0.098, -0.128, -0.034]]
    .map(([x, y, z]) => [x, y, -VN.ribs + (z + VN.ribs) * srK]);
  add(sweep(srP, srP.map((p, i) => i === 0 || i === 4 ? 0.006 : 0.011), { seg: 14, sub: 5, flat: 0.45, up: [0, 0, 1], cap0: true, cap1: true }), { color: [0.16, 0.16, 0.17], rough: 0.7, spec: 0.15 }, { name: 'shoulderrest' });
  add(merge(srP.filter((_, i) => i === 0 || i === 4).map(p => sweep([p, [p[0], p[1], -0.022]], [0.003, 0.003], { seg: 8 }))), { color: [0.1, 0.1, 0.1], rough: 0.6, spec: 0.2 });

  // strings (+ short afterlengths to the tailpiece and into the pegbox)
  const sCol = [[0.72, 0.7, 0.68], [0.78, 0.74, 0.68], [0.82, 0.82, 0.84], [0.92, 0.92, 0.95]];
  const sRad = [0.00048, 0.00042, 0.00036, 0.00026];
  for (let s = 0; s < 4; s++) {
    const xb = VN.xBridge[s], a = [xb * 1.05, -0.058, 0.03], b = [xb, 0, VN.zBridge(xb)], c = [VN.xNut[s], VN.yNut + 0.002, VN.zNutStr];
    const peg = V.lerp(pb0, pb1, [0.2, 0.56, 0.38, 0.74][s]);
    const d = [VN.xNut[s] * 0.6, peg[1], peg[2] + 0.004];
    add(merge([sweep([a, b], [sRad[s], sRad[s]], { seg: 6, sub: 1 }), sweep([b, c], [sRad[s], sRad[s]], { seg: 6, sub: 1 }), sweep([c, d], [sRad[s], sRad[s]], { seg: 6, sub: 1 })]),
      { color: sCol[s], rough: 0.25, spec: 1.3 }, { name: 'strings', cast: false });
  }
  return { frame, meshes };
}

export { VN, violinOutline, buildViolin };
