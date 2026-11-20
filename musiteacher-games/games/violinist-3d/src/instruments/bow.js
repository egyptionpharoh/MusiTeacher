// القوس — الهندسة كما في الأصل
// مستخرج حرفيًا من violin-player-3d.html الأصلي (MusiTeacher) مع إضافة export فقط.
import { V, Frame, F } from '../engine/math.js';
import { grid, merge, xform, sweep, ellipsoid, extrude } from '../engine/geometry.js';

// ---------- bow ----------
// Bow-local: origin at the end of the screw button, y = toward the tip, z = from hair toward stick.
const BOW = {
  len: 0.75, frogFront: 0.058,
  stickZ(y) { return -0.0045 * Math.sin(Math.PI * Math.min(1, Math.max(0, y / 0.74))); },
  hairZ(y) { return -0.0182 + (0.0182 - 0.0118) * (y - BOW.frogFront) / (0.728 - BOW.frogFront); },
};
function buildBowGeo() {
  const stickPts = [], stickR = [];
  for (let k = 0; k <= 24; k++) { const y = -0.006 + (0.742 + 0.006) * k / 24; stickPts.push([0, y, BOW.stickZ(y)]); stickR.push(0.0043 - 0.0016 * Math.min(1, Math.max(0, (y - 0.1) / 0.64))); }
  const stick = sweep(stickPts, stickR, { seg: 10, sub: 2 });
  // head (tip)
  const head = [[0.722, 0.0035], [0.738, 0.004], [0.75, 0.002], [0.7535, -0.004], [0.748, -0.01], [0.738, -0.0145], [0.726, -0.014], [0.722, -0.008]];
  const headG = xform(extrude(head, -0.0038, 0.0038), Frame([0, 0, 0], [0, 1, 0], [0, 0, 1], [1, 0, 0]));
  const tipPlate = xform(extrude([[0.7535, -0.004], [0.748, -0.01], [0.738, -0.0145], [0.739, -0.0152], [0.7495, -0.0105], [0.7548, -0.0042]], -0.0039, 0.0039), Frame([0, 0, 0], [0, 1, 0], [0, 0, 1], [1, 0, 0]));
  // frog (ebony) with pearl eye and silver ferrule
  const frogP = [[0.006, -0.003], [BOW.frogFront, -0.003], [BOW.frogFront, -0.0185], [0.049, -0.0215], [0.02, -0.022], [0.009, -0.016], [0.006, -0.008]];
  const frog = xform(extrude(frogP, -0.0058, 0.0058), Frame([0, 0, 0], [0, 1, 0], [0, 0, 1], [1, 0, 0]));
  const eyes = [-1, 1].map(s => xform(ellipsoid(0.0026, 0.0026, 0.0008, 8, 12), Frame([s * 0.0059, 0.03, -0.012], [0, 1, 0], [0, 0, 1], [s, 0, 0])));
  const ferrule = sweep([[0, BOW.frogFront - 0.004, -0.0165], [0, BOW.frogFront + 0.0005, -0.0175]], [0.0062, 0.0062], { seg: 14, flat: 0.45, up: [1, 0, 0] });
  const button = sweep([[0, -0.016, 0], [0, -0.004, 0], [0, 0.002, 0]], [0.0042, 0.0045, 0.0045], { seg: 12, cap0: true });
  const silverRings = [-0.01, -0.003].map(y => sweep([[0, y - 0.0012, 0], [0, y + 0.0012, 0]], [0.0048, 0.0048], { seg: 12 }));
  const winding = sweep([[0, BOW.frogFront + 0.012, BOW.stickZ(0.07)], [0, 0.112, BOW.stickZ(0.112)]], [0.0049, 0.0048], { seg: 12 });
  const leather = sweep([[0, BOW.frogFront, BOW.stickZ(0.058)], [0, BOW.frogFront + 0.012, BOW.stickZ(0.07)]], [0.0052, 0.0052], { seg: 12 });
  // hair ribbon
  const hair = grid(30, 3, (i, j) => { const y = BOW.frogFront + (0.727 - BOW.frogFront) * i / 30; return [(j / 3 - 0.5) * 0.0105, y, BOW.hairZ(y)]; });
  return {
    stick: merge([stick, headG]), ebony: merge([frog, button]), silver: merge([ferrule, ...silverRings, winding]),
    pearl: merge([...eyes, tipPlate]), leather, hair,
  };
}
function buildBow(R) {
  const g = buildBowGeo(), m = {};
  m.stick = R.mesh(g.stick, { color: [0.33, 0.13, 0.05], rough: 0.25, spec: 0.8 }, { name: 'bow' });
  m.ebony = R.mesh(g.ebony, { color: [0.07, 0.05, 0.04], rough: 0.3, spec: 0.6 }, { name: 'bow' });
  m.silver = R.mesh(g.silver, { color: [0.78, 0.78, 0.8], rough: 0.2, spec: 1.2 }, { name: 'bow' });
  m.pearl = R.mesh(g.pearl, { color: [0.95, 0.94, 0.9], rough: 0.2, spec: 0.8 }, { name: 'bow' });
  m.leather = R.mesh(g.leather, { color: [0.2, 0.12, 0.07], rough: 0.7, spec: 0.15 }, { name: 'bow' });
  m.hair = R.mesh(g.hair, { color: [0.95, 0.92, 0.84], rough: 0.7, spec: 0.2, sheen: 0.3 }, { name: 'bowhair', cast: false });
  return m;
}

export { BOW, buildBow };
