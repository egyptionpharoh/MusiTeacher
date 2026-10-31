// =====================================================================
//  اليد: قياس يد النموذج الحقيقية (أطوال السُّلاميات، مواضع المفاصل، سماكة الأصابع
//  من الشبكة نفسها)، ثم حلّ وضعيات الأصابع وتطبيقها على عظام النموذج.
//
//  إطار اليد المحلي (كما في المحرك الأصلي): الأصل عند الرسغ، y = نحو الأصابع،
//  z = ظهر اليد، x = y × z. في اليد اليسرى +x جهة الإبهام، وفي اليمنى -x.
//  الشبكة هنا سطح جلد واحد متصل مُشكَّل بالأوزان (Skinning)، فلا توجد أنابيب
//  أصابع منفصلة ولا فواصل بين الإصبع والكف.
// =====================================================================
import * as THREE from 'three';
import { V, Frame, F, ik2 } from '../engine/math.js';

export const FINGERS = ['index', 'middle', 'ring', 'little'];
const v3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);
const ar = (v) => [v.x, v.y, v.z];

// ---------- إطار اليد من مواضع المفاصل الحالية ----------
export function handFrameNow(rig, side) {
  const s = side === 'L' ? 1 : -1;
  const o = ar(rig.wp(side, 'hand')), m1 = ar(rig.wp(side, 'middle1'));
  const i1 = ar(rig.wp(side, 'index1')), l1 = ar(rig.wp(side, 'little1'));
  const y = V.norm(V.sub(m1, o));
  const thumbDir = V.norm(V.perp(V.sub(i1, l1), y));
  const x = V.mul(thumbDir, s);
  const z = V.cross(x, y);
  return Frame(o, x, y, z);
}

function tipPos(rig, side, f, j2, j3) {
  const t = rig.b(side, `${f}4`);
  if (t) return ar(t.getWorldPosition(new THREE.Vector3()));
  return V.madd(j3, V.sub(j3, j2), 0.85);                 // لا توجد عظمة طرف: استقراء
}

function medianRadius(rig, bone, a, b, fallback) {
  const verts = rig.verts([bone], 0.5), d = [], p = new THREE.Vector3();
  const ax = V.norm(V.sub(b, a)), L = V.dist(a, b);
  for (const e of verts) {
    rig.vertexWorld(e.m, e.i, p);
    const q = V.sub(ar(p), a), t = V.dot(q, ax);
    if (t < 0.15 * L || t > 0.85 * L) continue;
    d.push(V.len(V.perp(q, ax)));
  }
  if (d.length < 6) return fallback;
  d.sort((x, y) => x - y);
  return d[Math.floor(d.length * 0.5)];
}

// ---------- قياس اليد (مرة واحدة في وضعية الربط) ----------
export function measureHand(rig, side) {
  const s = side === 'L' ? 1 : -1;
  const fr = handFrameNow(rig, side);
  const toL = (p) => { const d = V.sub(p, fr.o); return [V.dot(d, fr.x), V.dot(d, fr.y), V.dot(d, fr.z)]; };
  const H = (v) => [v[0] * s, v[1], v[2]];                  // التخزين بصيغة اليد اليسرى كما في المحرك الأصلي
  const len = V.dist(ar(rig.wp(side, 'middle1')), fr.o);
  const scaleK = len / 0.095;                                // نسبة حجم اليد إلى يد المحرك الأصلي
  const fingers = FINGERS.map((f) => {
    const j = [1, 2, 3].map((i) => ar(rig.wp(side, `${f}${i}`)));
    j.push(tipPos(rig, side, f, j[1], j[2]));
    const L = [V.dist(j[0], j[1]), V.dist(j[1], j[2]), V.dist(j[2], j[3])];
    const fb = 0.0092 * scaleK;
    const r0 = medianRadius(rig, rig.b(side, `${f}1`), j[0], j[1], fb);
    const r1 = medianRadius(rig, rig.b(side, `${f}2`), j[1], j[2], fb * 0.9);
    const r2 = medianRadius(rig, rig.b(side, `${f}3`), j[2], j[3], fb * 0.8);
    return { name: f, k: H(toL(j[0])), L, r: [r0, r1, r2, r2 * 0.92], tipW: j[3] };
  });
  const t = [1, 2, 3].map((i) => ar(rig.wp(side, `thumb${i}`)));
  t.push(tipPos(rig, side, 'thumb', t[1], t[2]));
  const fbT = 0.0115 * scaleK;
  const thumb = {
    cmc: H(toL(t[0])), L: [V.dist(t[0], t[1]), V.dist(t[1], t[2]), V.dist(t[2], t[3])],
    r: [fbT * 1.4, medianRadius(rig, rig.b(side, 'thumb2'), t[1], t[2], fbT), medianRadius(rig, rig.b(side, 'thumb3'), t[2], t[3], fbT * 0.9), fbT * 0.8],
    restDir: H(V.norm(V.sub(toL(t[1]), toL(t[0])))),
  };
  thumb.r[3] = thumb.r[2] * 0.92;
  // محاور التوجيه لكل عظمة (من وضعية الراحة): المحور نحو المفصل التالي + ظهر اليد
  const restZ = v3(fr.z);
  for (const f of [...FINGERS, 'thumb']) {
    for (let i = 1; i <= 3; i++) {
      const b = rig.b(side, `${f}${i}`), a = rig.wp(side, `${f}${i}`);
      const nx = i < 3 ? rig.wp(side, `${f}${i + 1}`) : v3(f === 'thumb' ? t[3] : fingers[FINGERS.indexOf(f)].tipW);
      rig.setAimAxes(b, nx.clone().sub(a), restZ);
    }
  }
  return { side, s, fingers, thumb, restFrame: fr, restQ: rig.worldQ(rig.b(side, 'hand')), size: scaleK };
}

// ---------- حلّ الأصابع (منقول من المحرك الأصلي، يعمل على بيانات اليد المقاسة) ----------
// forward kinematics لإصبع واحد في إحداثيات اليد. ang = [spread, mcp, pip, dip]
export function fingerFK(fd, side, ang) {
  const H = (v) => [v[0] * side, v[1], v[2]];
  const mcp = H(fd.k);
  let d = V.norm(V.rot([0, 1, 0], [0, 0, 1], -ang[0] * side));
  let p = [0, 0, -1];
  const pts = [mcp];
  let cur = mcp;
  for (let s = 0; s < 3; s++) {
    const a = ang[1 + s], c = Math.cos(a), sn = Math.sin(a);
    const nd = V.add(V.mul(d, c), V.mul(p, sn)), np = V.sub(V.mul(p, c), V.mul(d, sn));
    d = nd; p = np;
    cur = V.madd(cur, d, fd.L[s]); pts.push(cur);
  }
  return { pts, dTip: d, pTip: p };
}

// IK لإصبع: المفصل الأول ثابت، والطرف يصل إلى الهدف بنسبة ثابتة بين انثناء DIP وPIP
export function fingerIK(fd, side, target, poleLocal, dipRatio = 0.7) {
  const H = (v) => [v[0] * side, v[1], v[2]];
  const mcp = H(fd.k), L = fd.L;
  let dipA = 0.6, pip;
  for (let it = 0; it < 4; it++) {
    const l2 = Math.sqrt(L[1] * L[1] + L[2] * L[2] + 2 * L[1] * L[2] * Math.cos(dipA));
    pip = ik2(mcp, target, L[0], l2, V.add(mcp, poleLocal));
    const a = V.norm(V.sub(pip, mcp)), b = V.norm(V.sub(target, pip));
    const pipA = Math.acos(Math.max(-1, Math.min(1, V.dot(a, b))));
    dipA = Math.min(1.2, pipA * dipRatio + 0.15);
  }
  const l2 = V.dist(pip, target), e = V.norm(V.sub(target, pip));
  const beta = Math.asin(Math.min(1, L[2] * Math.sin(dipA) / l2));
  const axis = V.norm(V.cross(V.sub(pip, mcp), e));
  const dip = V.madd(pip, V.rot(e, axis, beta), L[1]);
  return [mcp, pip, dip, target];
}

// إصبع مقوّس: سلسلة مستوية من المفصل الأول إلى الهدف؛ PIP ينثني بزاوية b وDIP بـ k·b،
// فيتشكّل قوس مستدير ("كمن يمسك كرة صغيرة") وينزل الطرف على الهدف تمامًا.
export function fingerArch(fd, side, target, poleLocal, k = 0.7) {
  const H = (v) => [v[0] * side, v[1], v[2]];
  const mcp = H(fd.k), L = fd.L, tot = L[0] + L[1] + L[2];
  const dv = V.sub(target, mcp), D = V.len(dv), e = V.mul(dv, 1 / D);
  const n = V.norm(V.perp(poleLocal, e));
  const bends = (b) => [0, b, k * b];
  const sum = (b) => { let x = 0, y = 0, ph = 0; const bs = bends(b); for (let i = 0; i < 3; i++) { ph -= bs[i]; x += L[i] * Math.cos(ph); y += L[i] * Math.sin(ph); } return [x, y]; };
  let b = 0;
  if (D < tot * 0.999) { let lo = 0, hi = 2.4; for (let it = 0; it < 40; it++) { const mid = (lo + hi) / 2; const s = sum(mid); if (Math.hypot(s[0], s[1]) > D) lo = mid; else hi = mid; } b = (lo + hi) / 2; }
  const s = sum(b), th0 = -Math.atan2(s[1], s[0]), bs = bends(b);
  const pts = [mcp]; let ph = th0, cur = mcp;
  for (let i = 0; i < 3; i++) {
    ph = i === 0 ? th0 : ph - bs[i];
    cur = V.add(cur, V.add(V.mul(e, Math.cos(ph) * L[i]), V.mul(n, Math.sin(ph) * L[i])));
    pts.push(cur);
  }
  pts.bend = b; pts.reach = D / tot;
  return pts;
}

// الإبهام: اتجاه عظمة المشط (metacarpal) يميل من الاتجاه المريح نحو الهدف بالقدر اللازم فقط
// حتى يصل الطرف دون أن يُفرد الإبهام؛ ثم IK ثنائي للسُّلاميتين.
export function thumbChain(th, side, tip, prefDir, pole) {
  const H = (v) => [v[0] * side, v[1], v[2]];
  const cmc = H(th.cmc), L = th.L, l12 = L[1] + L[2];
  const dT = V.norm(V.sub(tip, cmc));
  let mcp = null;
  for (let w = 0; w <= 1.0001; w += 0.05) {
    const md = V.norm(V.add(V.mul(prefDir, 1 - w), V.mul(dT, w)));
    mcp = V.madd(cmc, md, L[0]);
    if (V.dist(mcp, tip) <= 0.95 * l12) break;
  }
  const ip = ik2(mcp, tip, L[1], L[2], V.add(mcp, pole));
  const pts = [cmc, mcp, ip, tip];
  pts.short = Math.max(0, V.dist(mcp, tip) - l12);
  return pts;
}

// إطار اليد عالميًا من إطار القوس وموضع القوس في إحداثيات اليد
export function handFromBow(bowF, o_l, x_l, y_l, z_l) {
  const inv = (q) => { const d = V.sub(q, o_l); return [V.dot(d, x_l), V.dot(d, y_l), V.dot(d, z_l)]; };
  const invD = (q) => [V.dot(q, x_l), V.dot(q, y_l), V.dot(q, z_l)];
  return Frame(F.pt(bowF, inv([0, 0, 0])), F.dir(bowF, invD([1, 0, 0])), F.dir(bowF, invD([0, 1, 0])), F.dir(bowF, invD([0, 0, 1])));
}

// ---------- تطبيق الوضعية على العظام ----------
// يدوّر عظمة الكف إلى إطار الهدف، ثم يوجّه كل سُلامية نحو المفصل المحسوب.
export function poseHandRotation(rig, hm, target) {
  const r = hm.restFrame;
  const Bt = new THREE.Matrix4().makeBasis(v3(target.x), v3(target.y), v3(target.z));
  const Br = new THREE.Matrix4().makeBasis(v3(r.x), v3(r.y), v3(r.z));
  const D = Bt.multiply(Br.transpose());
  const q = new THREE.Quaternion().setFromRotationMatrix(D).multiply(hm.restQ);
  rig.setWorldQuaternion(rig.b(hm.side, 'hand'), q);
}

export function poseFingers(rig, hm, frame, chains, thumbPts) {
  const side = hm.side;
  const o = ar(rig.wp(side, 'hand'));                         // موضع الرسغ الفعلي
  const fr = Frame(o, frame.x, frame.y, frame.z);
  const W = (p) => F.pt(fr, p);
  const kW = F.dir(fr, [-1, 0, 0]);
  const dors = (d) => V.norm(V.perp(V.cross(d, kW), d));
  const tmp = new THREE.Vector3();
  FINGERS.forEach((f, fi) => {
    const pts = chains[fi].map(W);
    for (let i = 1; i <= 3; i++) {
      const b = rig.b(side, `${f}${i}`);
      const from = ar(b.getWorldPosition(tmp));
      const d = V.norm(V.sub(pts[i], from));
      rig.aim(b, v3(d), v3(dors(d)));
    }
  });
  const tp = thumbPts.map(W);
  for (let i = 1; i <= 3; i++) {
    const b = rig.b(side, `thumb${i}`);
    const from = ar(b.getWorldPosition(tmp));
    const d = V.norm(V.sub(tp[i], from));
    rig.aim(b, v3(d), v3(frame.z));
  }
}
