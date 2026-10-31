// الكرسي والسجادة والأرضية
// مستخرج حرفيًا من violin-player-3d.html الأصلي (MusiTeacher) مع إضافة export فقط.
import { Frame } from '../engine/math.js';
import { grid, merge, xform, sweep, roundBox } from '../engine/geometry.js';

// ---------- chair, rug, floor ----------
function buildVSetting(R, tex) {
  const wood = { color: [1, 1, 1], tex: tex.wood, rough: 0.45, spec: 0.35 };
  const parts = [];
  const sx = 0.22, zf = 0.16, zb = -0.26, seatY = 0.45;
  parts.push(xform(roundBox(0.46, 0.04, 0.44, 8), Frame([0, seatY - 0.02, (zf + zb) / 2], [1, 0, 0], [0, 1, 0], [0, 0, 1])));
  for (const x of [-sx + 0.02, sx - 0.02]) for (const z of [zf - 0.02, zb + 0.02]) {
    parts.push(sweep([[x, 0, z], [x, z < 0 ? 0.98 : seatY - 0.03, z]], [0.017, 0.017], { seg: 12, cap1: true }));
  }
  parts.push(sweep([[-sx + 0.02, 0.12, zf - 0.02], [sx - 0.02, 0.12, zf - 0.02]], [0.011, 0.011], { seg: 10 }));
  parts.push(sweep([[-sx + 0.02, 0.12, zb + 0.02], [sx - 0.02, 0.12, zb + 0.02]], [0.011, 0.011], { seg: 10 }));
  for (const x of [-sx + 0.02, sx - 0.02]) parts.push(sweep([[x, 0.12, zf - 0.02], [x, 0.12, zb + 0.02]], [0.011, 0.011], { seg: 10 }));
  parts.push(xform(roundBox(0.42, 0.07, 0.025, 6), Frame([0, 0.93, zb + 0.02], [1, 0, 0], [0, 1, 0], [0, 0, 1])));
  parts.push(xform(roundBox(0.42, 0.035, 0.02, 6), Frame([0, 0.72, zb + 0.02], [1, 0, 0], [0, 1, 0], [0, 0, 1])));
  const meshes = [R.mesh(merge(parts), wood, { name: 'chair' })];
  const rug = grid(24, 96, (i, j) => { const r = i / 24 * 1.15, a = j / 96 * Math.PI * 2; return [Math.cos(a) * r, 0.004, Math.sin(a) * r + 0.12]; });
  for (let v = 0; v < rug.p.length / 3; v++) { rug.t[v * 2] = 0.5 + rug.p[v * 3] / 2.3; rug.t[v * 2 + 1] = 0.5 + (rug.p[v * 3 + 2] - 0.12) / 2.3; }
  meshes.push(R.mesh(rug, { color: [1, 1, 1], tex: tex.rug, rough: 0.95, spec: 0.03, sheen: 0.25 }, { cast: false, name: 'rug' }));
  const floor = grid(4, 64, (i, j) => { const r = i / 4 * 4.2, a = j / 64 * Math.PI * 2; return [Math.cos(a) * r, 0, Math.sin(a) * r]; });
  meshes.push(R.mesh(floor, { color: [0.36, 0.32, 0.29], rough: 0.9, spec: 0.05, floorR: 4.0 }, { cast: false, floor: true, name: 'floor' }));
  return meshes;
}

export { buildVSetting };
