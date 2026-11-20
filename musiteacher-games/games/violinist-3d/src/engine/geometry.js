// مولّدات الهندسة الإجرائية (sweep / loft / grid ...)
// مستخرج حرفيًا من violin-player-3d.html الأصلي (MusiTeacher) مع إضافة export فقط.
import { V, Frame, F } from './math.js';

function Geo() { return { p: [], n: [], t: [], i: [] }; }

function computeNormals(g) {
  const n = new Float32Array(g.p.length), p = g.p, I = g.i;
  for (let k = 0; k < I.length; k += 3) {
    const a = I[k] * 3, b = I[k + 1] * 3, c = I[k + 2] * 3;
    const ux = p[b] - p[a], uy = p[b + 1] - p[a + 1], uz = p[b + 2] - p[a + 2];
    const vx = p[c] - p[a], vy = p[c + 1] - p[a + 1], vz = p[c + 2] - p[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    for (const q of [a, b, c]) { n[q] += nx; n[q + 1] += ny; n[q + 2] += nz; }
  }
  g.n = Array.from(n);
}

// average normals of vertices that share a position (smooth seams and poles)
function weldNormals(g) {
  const map = new Map(), p = g.p, n = g.n, cnt = p.length / 3;
  for (let v = 0; v < cnt; v++) {
    const key = Math.round(p[v * 3] * 2e4) + ',' + Math.round(p[v * 3 + 1] * 2e4) + ',' + Math.round(p[v * 3 + 2] * 2e4);
    let e = map.get(key); if (!e) { e = []; map.set(key, e); } e.push(v);
  }
  for (const list of map.values()) {
    if (list.length < 2) continue;
    let x = 0, y = 0, z = 0;
    for (const v of list) { x += n[v * 3]; y += n[v * 3 + 1]; z += n[v * 3 + 2]; }
    for (const v of list) { n[v * 3] = x; n[v * 3 + 1] = y; n[v * 3 + 2] = z; }
  }
  for (let v = 0; v < cnt; v++) {
    const l = Math.hypot(n[v * 3], n[v * 3 + 1], n[v * 3 + 2]) || 1;
    n[v * 3] /= l; n[v * 3 + 1] /= l; n[v * 3 + 2] /= l;
  }
}

// generic (nu+1) x (nv+1) grid. fn(i, j) -> [x,y,z]
function grid(nu, nv, fn, opt = {}) {
  const g = Geo(), us = opt.us || 1, vs = opt.vs || 1;
  for (let i = 0; i <= nu; i++) for (let j = 0; j <= nv; j++) {
    const q = fn(i, j); g.p.push(q[0], q[1], q[2]); g.t.push(i / nu * us, j / nv * vs);
  }
  for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
    const a = i * (nv + 1) + j, b = a + nv + 1;
    g.i.push(a, b, a + 1, a + 1, b, b + 1);
  }
  computeNormals(g);
  if (opt.weld !== false) weldNormals(g);
  return g;
}

function merge(list) {
  const g = Geo();
  for (const s of list) {
    if (!s) continue;
    const off = g.p.length / 3;
    for (let k = 0; k < s.p.length; k++) g.p.push(s.p[k]);
    for (let k = 0; k < s.n.length; k++) g.n.push(s.n[k]);
    for (let k = 0; k < s.t.length; k++) g.t.push(s.t[k]);
    for (let k = 0; k < s.i.length; k++) g.i.push(s.i[k] + off);
  }
  return g;
}

// transform a geometry by a Frame (rigid)
function xform(g, f) {
  const o = Geo(); o.t = g.t.slice(); o.i = g.i.slice();
  for (let k = 0; k < g.p.length; k += 3) {
    const q = F.pt(f, [g.p[k], g.p[k + 1], g.p[k + 2]]); o.p.push(q[0], q[1], q[2]);
    const d = F.dir(f, [g.n[k], g.n[k + 1], g.n[k + 2]]); o.n.push(d[0], d[1], d[2]);
  }
  return o;
}

// Catmull-Rom interpolation of scalar or vector arrays
function crSample(pts, sub) {
  const out = [], n = pts.length;
  if (n < 2) return pts.slice();
  const get = (i) => pts[Math.max(0, Math.min(n - 1, i))];
  for (let i = 0; i < n - 1; i++) {
    const p0 = get(i - 1), p1 = get(i), p2 = get(i + 1), p3 = get(i + 2);
    for (let s = 0; s < sub; s++) {
      const t = s / sub, t2 = t * t, t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      if (Array.isArray(p1)) out.push(p1.map((_, k) => f(p0[k], p1[k], p2[k], p3[k])));
      else out.push(f(p0, p1, p2, p3));
    }
  }
  out.push(pts[n - 1]);
  return out;
}

// Tube swept along a smooth path through control points with varying radius.
// opt: seg, sub, cap0, cap1, flat (ellipse ratio), up (reference for frame), capK (cap length factor)
function sweep(ctrl, radii, opt = {}) {
  const seg = opt.seg || 14, sub = opt.sub || 6;
  let P = crSample(ctrl, sub), R = crSample(radii, sub).map(r => Math.max(r, 0));
  const T = P.map((p, i) => V.norm(V.sub(P[Math.min(i + 1, P.length - 1)], P[Math.max(i - 1, 0)])));
  // parallel-transport frames
  let up = opt.up || (Math.abs(T[0][1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]);
  let N0 = V.norm(V.perp(up, T[0]));
  const Nn = [N0];
  for (let i = 1; i < P.length; i++) {
    const prev = Nn[i - 1]; let n = V.norm(V.perp(prev, T[i]));
    Nn.push(n);
  }
  const rings = P.map((p, i) => ({ c: p, t: T[i], n: Nn[i], b: V.cross(T[i], Nn[i]), r: R[i] }));
  const capN = opt.capN || 5, ck = opt.capK == null ? 1 : opt.capK;
  if (opt.cap0) {
    const f = rings[0], pre = [];
    for (let k = capN; k >= 1; k--) {
      const a = k / capN * Math.PI / 2;
      pre.push({ c: V.madd(f.c, f.t, -f.r * Math.sin(a) * ck), t: f.t, n: f.n, b: f.b, r: f.r * Math.cos(a) });
    }
    rings.unshift(...pre);
  }
  if (opt.cap1) {
    const f = rings[rings.length - 1];
    for (let k = 1; k <= capN; k++) {
      const a = k / capN * Math.PI / 2;
      rings.push({ c: V.madd(f.c, f.t, f.r * Math.sin(a) * ck), t: f.t, n: f.n, b: f.b, r: f.r * Math.cos(a) });
    }
  }
  const flat = opt.flat || 1;
  return grid(rings.length - 1, seg, (i, j) => {
    const R0 = rings[i], a = j / seg * Math.PI * 2;
    return V.add(R0.c, V.add(V.mul(R0.n, Math.cos(a) * R0.r), V.mul(R0.b, Math.sin(a) * R0.r * flat)));
  }, { us: opt.us || 1, vs: opt.vs || 1 });
}

// Loft of horizontal-ish rings. ring: {c:[x,y,z], rx, rzF, rzB, e}
// optional frame f to orient (rings live in frame's xz plane, y = frame up)
function loft(rings, seg, opt = {}) {
  const R = opt.sub ? crSample(rings.map(r => [r.c[0], r.c[1], r.c[2], r.rx, r.rzF, r.rzB == null ? r.rzF : r.rzB, r.e || 2]), opt.sub)
    .map(a => ({ c: [a[0], a[1], a[2]], rx: Math.max(a[3], 0), rzF: Math.max(a[4], 0), rzB: Math.max(a[5], 0), e: a[6] })) : rings;
  const a0 = opt.a0 == null ? 0 : opt.a0, a1 = opt.a1 == null ? Math.PI * 2 : opt.a1;
  const g = grid(R.length - 1, seg, (i, j) => {
    const r = R[i], a = a0 + (a1 - a0) * j / seg, c = Math.cos(a), s = Math.sin(a), e = r.e || 2;
    const px = Math.sign(c) * Math.pow(Math.abs(c), 2 / e) * r.rx;
    const pz = Math.sign(s) * Math.pow(Math.abs(s), 2 / e) * (s > 0 ? r.rzF : (r.rzB == null ? r.rzF : r.rzB));
    return [r.c[0] + px, r.c[1], r.c[2] + pz];
  }, { us: opt.us || 1, vs: opt.vs || 1 });
  return opt.frame ? xform(g, opt.frame) : g;
}

function ellipsoid(rx, ry, rz, nu = 18, nv = 24) {
  return grid(nu, nv, (i, j) => {
    const th = i / nu * Math.PI, ph = j / nv * Math.PI * 2;
    return [Math.sin(th) * Math.cos(ph) * rx, -Math.cos(th) * ry, Math.sin(th) * Math.sin(ph) * rz];
  });
}

// flat-shaded box centered at origin
function box(w, h, d) {
  const g = Geo(), x = w / 2, y = h / 2, z = d / 2;
  const faces = [
    [[1, 0, 0], [[x, -y, -z], [x, y, -z], [x, y, z], [x, -y, z]]],
    [[-1, 0, 0], [[-x, -y, z], [-x, y, z], [-x, y, -z], [-x, -y, -z]]],
    [[0, 1, 0], [[-x, y, -z], [-x, y, z], [x, y, z], [x, y, -z]]],
    [[0, -1, 0], [[-x, -y, z], [-x, -y, -z], [x, -y, -z], [x, -y, z]]],
    [[0, 0, 1], [[-x, -y, z], [x, -y, z], [x, y, z], [-x, y, z]]],
    [[0, 0, -1], [[x, -y, -z], [-x, -y, -z], [-x, y, -z], [x, y, -z]]],
  ];
  for (const [nrm, q] of faces) {
    const off = g.p.length / 3;
    q.forEach((v, k) => { g.p.push(...v); g.n.push(...nrm); g.t.push(k === 1 || k === 2 ? 1 : 0, k >= 2 ? 1 : 0); });
    g.i.push(off, off + 1, off + 2, off, off + 2, off + 3);
  }
  return g;
}

// rounded box via superellipsoid-ish loft (soft furniture parts)
function roundBox(w, h, d, e = 6) {
  const rings = [];
  const n = 8;
  for (let k = 0; k <= n; k++) {
    const a = -Math.PI / 2 + Math.PI * k / n, s = Math.sin(a), c = Math.cos(a);
    const y = Math.sign(s) * Math.pow(Math.abs(s), 2 / e) * h / 2, f = Math.pow(Math.abs(c), 2 / e);
    rings.push({ c: [0, y, 0], rx: w / 2 * f, rzF: d / 2 * f, e });
  }
  return loft(rings, 24);
}

// flat polygon (fan from centroid) + optional thickness
function extrude(outline, z0, z1, uvf) {
  const n = outline.length;
  let cx = 0, cy = 0; outline.forEach(p => { cx += p[0]; cy += p[1]; }); cx /= n; cy /= n;
  const cap = (z, up) => {
    const g = Geo();
    g.p.push(cx, cy, z); g.n.push(0, 0, up ? 1 : -1); g.t.push(...(uvf ? uvf(cx, cy) : [0, 0]));
    outline.forEach(p => { g.p.push(p[0], p[1], z); g.n.push(0, 0, up ? 1 : -1); g.t.push(...(uvf ? uvf(p[0], p[1]) : [0, 0])); });
    for (let k = 0; k < n; k++) { const a = 1 + k, b = 1 + (k + 1) % n; if (up) g.i.push(0, a, b); else g.i.push(0, b, a); }
    return g;
  };
  const parts = [cap(z1, true)];
  if (z0 !== z1) {
    parts.push(cap(z0, false));
    parts.push(grid(n, 1, (i, j) => { const p = outline[i % n]; return [p[0], p[1], j ? z1 : z0]; }));
  }
  return merge(parts);
}

export { Geo, computeNormals, weldNormals, grid, merge, xform, crSample, sweep, loft, ellipsoid, box, roundBox, extrude };
