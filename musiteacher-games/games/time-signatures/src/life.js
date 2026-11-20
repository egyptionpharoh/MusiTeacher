// =====================================================================
//  حياة المايسترو: رمش، نظر، تنفس، وإيماءة رأس خفيفة مع النبضة الأولى.
//  تعيد استعمال محرك العينين والجفون من Face المشترك (كما تفعل لعبة الأكورديون في ملفها الخاص)
//  وتستبدل منطق النظر: المايسترو تنظر غالبًا إلى «الطلاب» (الكاميرا) مع لمحات إلى يدها القائدة.
//  لا يحرّك هذا الملف الذراعين؛ التنفس يُطبَّق قبل IK فتتبعه الذراعان.
// =====================================================================
import * as THREE from 'three';
import { Face } from '../_shared/3d/character/face.js';

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const DEG = Math.PI / 180;
function damp1(cur, vel, target, omega, dt) {
  const x = omega * dt, e = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  const dx = cur - target, tmp = (vel.v + omega * dx) * dt;
  vel.v = (vel.v - omega * tmp) * e;
  return target + (dx + tmp) * e;
}
function damp3(cur, vel, target, omega, dt) {
  const x = omega * dt, e = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  const dx = cur.clone().sub(target), tmp = vel.clone().addScaledVector(dx, omega).multiplyScalar(dt);
  vel.sub(tmp.clone().multiplyScalar(omega)).multiplyScalar(e);
  return target.clone().add(dx.add(tmp).multiplyScalar(e));
}

export class ConductorLife extends Face {
  constructor(player, opts = {}) {
    player.head = player.head || { yaw: 0, pitch: 0.02, roll: 0 };
    player.jawRestW = player.jawRestW || [0, 0, 0];          // Face يتطلبها (منطق مسند الذقن للكمان) — غير مستعمل هنا
    super(player, { rand: opts.rand });
    this.opts = opts;
    if (!this.ok) return;
    this.focus = { kind: 'viewer', until: 0, off: [0, 0] };
    this.headOff.r = 0; this.headVel.r = { v: 0 };
    this.nod = 0; this.nodV = { v: 0 }; this.nodGoal = 0;
    this.br = { phase: this.rand(), rate: 0.24 };
    this._breath = null;
  }

  /** نبضة جديدة: إيماءة صغيرة جدًا للرأس (أوضح مع الأولى) */
  beat(strong) { if (this.ok) this.nodGoal = (strong ? 1.6 : 0.6) * DEG; }

  pre(dt) {
    if (!this.ok) return;
    const rig = this.rig, br = this.br;
    if (!this._breath) this._breath = ['spine', 'chest', 'upperChest'].map((k) => rig.b('C', k)).filter(Boolean).map((b) => ({ b, q: rig.worldQ(b) }));
    br.phase = (br.phase + clamp(dt, 0, 0.1) * br.rate) % 1;
    const x = br.phase, v = x < 0.4 ? sstep(0, 0.4, x) : 1 - sstep(0.4, 1, x);
    const A = 0.014 * v, X = new THREE.Vector3(1, 0, 0);
    this._breath.forEach((e, i) => rig.setWorldQuaternion(e.b, new THREE.Quaternion().setFromAxisAngle(X, -A * [0.35, 0.7, 1][i]).multiply(e.q)));
  }

  _applyHeadOffset(hy, hp, hr = 0) { const H = this.pl.head; this.pl.applyHead(H.yaw + hy, H.pitch + hp, H.roll + hr); }

  /** ctx: { viewer: Vector3 (الكاميرا)، hand: [x,y,z] اليد القائدة، playing } */
  update(dt, ctx = {}) {
    if (!this.ok) return;
    dt = clamp(dt, 0.001, 0.1); this.time += dt;
    const f = this.focus, R = this.rand;
    if (this.time >= f.until) {
      const w = ctx.playing ? { viewer: 0.62, hand: 0.26, glance: 0.12 } : { viewer: 0.5, glance: 0.3, hand: 0.2 };
      if (w[f.kind]) w[f.kind] *= 0.35;
      let r = R() * Object.values(w).reduce((a, b) => a + b, 0), kind = 'viewer';
      for (const k in w) { r -= w[k]; if (r <= 0) { kind = k; break; } }
      f.kind = kind; f.until = this.time + ({ viewer: [2.2, 5], hand: [0.8, 1.8], glance: [1, 2.6] }[kind].reduce((a, b) => a + R() * (b - a)));
      f.off = [(R() - 0.5) * (kind === 'glance' ? 1.6 : 0.25), (R() - 0.5) * (kind === 'glance' ? 0.5 : 0.12)];
      this.stats.gazeShifts++;
      if (R() < 0.3 && this.blink.t < 0) this.blink.next = Math.min(this.blink.next, 0.05);
    }
    const eye = this.eyeMid0, fwd = this.bodyFwd, left = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), fwd);
    let target;
    if (f.kind === 'hand' && ctx.hand) target = new THREE.Vector3(...ctx.hand);
    else if (f.kind === 'viewer' && ctx.viewer) {
      const d = ctx.viewer.clone().sub(eye), ang = Math.atan2(d.dot(left), d.dot(fwd));
      target = Math.abs(ang) < 70 * DEG ? ctx.viewer.clone().add(new THREE.Vector3(f.off[0] * 0.3, f.off[1] * 0.3, 0)) : eye.clone().addScaledVector(fwd, 2).add(new THREE.Vector3(0, -0.05, 0));
    } else target = eye.clone().addScaledVector(fwd, 2).addScaledVector(left, f.off[0]).add(new THREE.Vector3(0, f.off[1] - 0.05, 0));
    const g = this.gaze;
    g.pos = damp3(g.pos, g.vel, target, 24, dt);
    // الرأس: جزء من زاوية النظر + إيماءة النبضة
    const dir = g.pos.clone().sub(eye).normalize();
    const [gy, gp] = this._ang(dir);
    const wantY = clamp(0.5 * gy, -30 * DEG, 30 * DEG), wantP = clamp(0.45 * gp, -16 * DEG, 10 * DEG);
    const cy = this.Jinv[0][0] * wantY + this.Jinv[0][1] * wantP, cp = this.Jinv[1][0] * wantY + this.Jinv[1][1] * wantP;
    this.nod = damp1(this.nod, this.nodV, this.nodGoal, 14, dt); this.nodGoal *= Math.exp(-dt * 9);
    this.headOff.y = damp1(this.headOff.y, this.headVel.y, clamp(cy, -32 * DEG, 32 * DEG), 4, dt);
    this.headOff.p = damp1(this.headOff.p, this.headVel.p, clamp(cp, -18 * DEG, 12 * DEG), 4, dt);
    this.headOff.r = damp1(this.headOff.r, this.headVel.r, clamp(-0.25 * wantY, -4 * DEG, 4 * DEG), 4, dt);
    this._applyHeadOffset(this.headOff.y, this.headOff.p + this.nod, this.headOff.r);
    // العينان
    this._resetEyes();
    const q = new THREE.Quaternion();
    for (const k of ['L', 'R']) {
      const e = this.eyeInfo[k], c0 = this._eyeCenterW(k), f0 = this._eyeFwdW(k);
      let want = g.pos.clone().sub(c0).normalize();
      const a = f0.angleTo(want), maxA = 30 * DEG;
      if (a > maxA) want = f0.clone().lerp(want, maxA / a).normalize();
      q.setFromUnitVectors(f0, want);
      this.rig.setWorldQuaternion(e.bone, q.multiply(e.bone.getWorldQuaternion(new THREE.Quaternion())));
      const shift = c0.sub(this._eyeCenterW(k));
      e.bone.position.copy(e.bone.parent.worldToLocal(e.bone.getWorldPosition(new THREE.Vector3()).add(shift)));
      e.bone.updateWorldMatrix(false, true);
    }
    // الجفون
    const down = clamp(-gp, 0, 0.6), base = 0.1 + 0.2 * clamp(down / 0.5, 0, 1);
    this.lidBase += (base - this.lidBase) * (1 - Math.exp(-dt * 6));
    const bl = this._blinkValue(dt);
    const c = this.lidBase + (1 - this.lidBase) * bl;
    if (Math.abs(c - this.lidNow) > 0.002) { this._applyLids(c); this.lidNow = c; }
  }
}
