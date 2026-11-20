// رياضيات المتجهات والإطارات المرجعية
// مستخرج حرفيًا من violin-player-3d.html الأصلي (MusiTeacher) مع إضافة export فقط.

const V = {
  add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  mul: (a, s) => [a[0] * s, a[1] * s, a[2] * s],
  madd: (a, b, s) => [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s],
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  len: (a) => Math.hypot(a[0], a[1], a[2]),
  dist: (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]),
  norm: (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
  lerp: (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t],
  // weighted sum of vectors: sum(vs[i]*ws[i])
  comb: (...pairs) => { const o = [0, 0, 0]; for (let i = 0; i < pairs.length; i += 2) { o[0] += pairs[i][0] * pairs[i + 1]; o[1] += pairs[i][1] * pairs[i + 1]; o[2] += pairs[i][2] * pairs[i + 1]; } return o; },
  // rotate vector v about unit axis k by angle a (Rodrigues)
  rot: (v, k, a) => {
    const c = Math.cos(a), s = Math.sin(a), d = V.dot(k, v) * (1 - c), x = V.cross(k, v);
    return [v[0] * c + x[0] * s + k[0] * d, v[1] * c + x[1] * s + k[1] * d, v[2] * c + x[2] * s + k[2] * d];
  },
  // remove the component of v along unit n
  perp: (v, n) => V.madd(v, n, -V.dot(v, n)),
};

// A frame = origin + orthonormal axes (x, y, z). Converts local <-> world.
function Frame(o, x, y, z) { return { o, x, y, z }; }
const F = {
  // build a right-handed frame from a primary direction (y) and a hint for z
  fromYZ(o, y, zHint) {
    y = V.norm(y); let z = V.norm(V.perp(zHint, y)); const x = V.cross(y, z);
    return Frame(o, x, y, z);
  },
  pt: (f, p) => [f.o[0] + f.x[0] * p[0] + f.y[0] * p[1] + f.z[0] * p[2],
                 f.o[1] + f.x[1] * p[0] + f.y[1] * p[1] + f.z[1] * p[2],
                 f.o[2] + f.x[2] * p[0] + f.y[2] * p[1] + f.z[2] * p[2]],
  dir: (f, d) => [f.x[0] * d[0] + f.y[0] * d[1] + f.z[0] * d[2],
                  f.x[1] * d[0] + f.y[1] * d[1] + f.z[1] * d[2],
                  f.x[2] * d[0] + f.y[2] * d[1] + f.z[2] * d[2]],
  rot(f, k, a, pivot) {
    pivot = pivot || f.o;
    return Frame(V.add(pivot, V.rot(V.sub(f.o, pivot), k, a)), V.rot(f.x, k, a), V.rot(f.y, k, a), V.rot(f.z, k, a));
  },
  mat: (f) => M.basis(f.x, f.y, f.z, f.o),
};

// ---------- 4x4 matrices (column-major) ----------
const M = {
  ident() { const o = new Float32Array(16); o[0] = o[5] = o[10] = o[15] = 1; return o; },
  mul(a, b) {
    const o = new Float32Array(16);
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
      let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]; o[c * 4 + r] = s;
    }
    return o;
  },
  persp(fovy, asp, n, f) {
    const t = 1 / Math.tan(fovy / 2), o = new Float32Array(16);
    o[0] = t / asp; o[5] = t; o[10] = (f + n) / (n - f); o[11] = -1; o[14] = 2 * f * n / (n - f); return o;
  },
  ortho(l, r, b, t, n, f) {
    const o = new Float32Array(16);
    o[0] = 2 / (r - l); o[5] = 2 / (t - b); o[10] = -2 / (f - n);
    o[12] = -(r + l) / (r - l); o[13] = -(t + b) / (t - b); o[14] = -(f + n) / (f - n); o[15] = 1; return o;
  },
  lookAt(e, t, up) {
    const z = V.norm(V.sub(e, t)), x = V.norm(V.cross(up, z)), y = V.cross(z, x), o = new Float32Array(16);
    o[0] = x[0]; o[4] = x[1]; o[8] = x[2];
    o[1] = y[0]; o[5] = y[1]; o[9] = y[2];
    o[2] = z[0]; o[6] = z[1]; o[10] = z[2];
    o[12] = -V.dot(x, e); o[13] = -V.dot(y, e); o[14] = -V.dot(z, e); o[15] = 1; return o;
  },
  basis(x, y, z, p) {
    const o = new Float32Array(16);
    o[0] = x[0]; o[1] = x[1]; o[2] = x[2];
    o[4] = y[0]; o[5] = y[1]; o[6] = y[2];
    o[8] = z[0]; o[9] = z[1]; o[10] = z[2];
    o[12] = p[0]; o[13] = p[1]; o[14] = p[2]; o[15] = 1; return o;
  },
  apply(m, p) { return [m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]]; },
  applyDir(m, p) { return [m[0] * p[0] + m[4] * p[1] + m[8] * p[2], m[1] * p[0] + m[5] * p[1] + m[9] * p[2], m[2] * p[0] + m[6] * p[1] + m[10] * p[2]]; },
};

// two-bone IK: returns middle joint position
function ik2(a, c, l1, l2, pole) {
  let d = V.sub(c, a), dl = V.len(d);
  dl = Math.min(Math.max(dl, Math.abs(l1 - l2) + 1e-4), l1 + l2 - 1e-4);
  const dir = V.norm(d);
  const x = (l1 * l1 - l2 * l2 + dl * dl) / (2 * dl);
  const h = Math.sqrt(Math.max(l1 * l1 - x * x, 0));
  const pd = V.norm(V.perp(V.sub(pole, a), dir));
  return V.add(V.madd(a, dir, x), V.mul(pd, h));
}

function smooth(x) { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); }

// rotation that maps local vectors (a, b) to world vectors (A, B) (b, B only as hints), returns Frame at origin
function orientByPair(a, b, A, B) {
  const e1 = V.norm(a), e2 = V.norm(V.perp(b, e1)), e3 = V.cross(e1, e2);
  const E1 = V.norm(A), E2 = V.norm(V.perp(B, E1)), E3 = V.cross(E1, E2);
  const map = (v) => V.comb(E1, V.dot(v, e1), E2, V.dot(v, e2), E3, V.dot(v, e3));
  return Frame([0, 0, 0], map([1, 0, 0]), map([0, 1, 0]), map([0, 0, 1]));
}

export { V, Frame, F, M, ik2, smooth, orientByPair };
