// =====================================================================
//  وجه العازفة الحي: رمش، نظر العينين، وحركة رأس دقيقة متناسقة مع سياق العزف.
//
//  قيود النموذج (MakeHuman Default): لا عظام جفون ولا Morph targets، وعظمتا العينين (eyeL/eyeR) موجودتان
//  لكن محورهما يبعد ~1 سم خلف مركز المقلة. لذلك:
//   • العينان: ندوّر عظمة العين ثم نُرجع مركز المقلة إلى مكانه (تدوير حول مركز المقلة الفعلي).
//   • الجفون: ندوّر رؤوس الجلد (وأهداب العين) المحيطة بالعين حول مركز المقلة بوزن يتدرّج، فتنزل الجفون العليا وتصعد السفلى
//     على سطح المقلة بلا اختراق (المسافة عن المركز تبقى ثابتة). نعدّل الوضعية المرجعية للشبكة فقط عند تغيّر الرمش.
//   • الرأس: انحراف صغير (≤ 5° التفات، ≤ 3.5° ميل) ثم نُزيح عظمة الرقبة لإبقاء الفك الأيسر على مسند الذقن.
//  لا شيء هنا يحرّك الكمان أو اليدين، فلا يتأثر ضبط النغمات.
// =====================================================================
import * as THREE from 'three';

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const DEG = Math.PI / 180;

// تنعيم حرج التخميد (SmoothDamp) لمتجه: يعيد الموضع الجديد ويحدّث السرعة
function damp3(cur, vel, target, omega, dt) {
  const x = omega * dt, e = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  const dx = cur.clone().sub(target), tmp = vel.clone().addScaledVector(dx, omega).multiplyScalar(dt);
  vel.sub(tmp.clone().multiplyScalar(omega)).multiplyScalar(e);
  return target.clone().add(dx.add(tmp).multiplyScalar(e));
}
function damp1(cur, vel, target, omega, dt) {
  const x = omega * dt, e = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  const dx = cur - target, tmp = (vel.v + omega * dx) * dt;
  vel.v = (vel.v - omega * tmp) * e;
  return target + (dx + tmp) * e;
}

export class Face {
  constructor(player, opts = {}) {
    this.pl = player; this.rig = player.rig;
    this.rand = opts.rand || Math.random;
    this.enabled = true;
    const rig = this.rig;
    rig.root.updateMatrixWorld(true);
    this.eyeBone = { L: rig.allBones.find((b) => b.name === 'eyeL'), R: rig.allBones.find((b) => b.name === 'eyeR') };
    this.neck = rig.b('C', 'neck');
    this.skin = rig.meshes.find((m) => m.name === 'Human');
    this.lash = rig.meshes.find((m) => /eyelash/i.test(m.name));
    this.eyes = rig.meshes.find((m) => /high-poly/i.test(m.name));
    this.ok = !!(this.eyeBone.L && this.eyeBone.R && this.skin && this.eyes && this.neck && player.jawRestW);
    this.stats = { blinks: 0, gazeShifts: 0, maxJawErrMm: 0, maxHeadYawDeg: 0, maxHeadPitchDeg: 0, maxEyeDeg: 0 };
    if (!this.ok) { this.enabled = false; return; }
    this._prepEyes();
    this._prepLids();
    this._calibrateHead();
    // الحالة الديناميكية
    this.blink = { t: -1, dur: 0.24, next: 1.4 + this.rand() * 2.2, dbl: false };
    this.lidBase = 0.1; this.lidNow = -1;
    const mid = this.eyeMid0.clone();
    this.gaze = { kind: 'ahead', until: 0, pos: mid.clone().addScaledVector(this.f0, 0.6), vel: new THREE.Vector3(), jit: new THREE.Vector3(), jitV: new THREE.Vector3(), jitNext: 0, lastKind: '' };
    this.headOff = { y: 0, p: 0 }; this.headVel = { y: { v: 0 }, p: { v: 0 } };
    this.time = 0;
    this.override = null;       // للاختبار: { kind }
  }

  // ---------- العينان ----------
  _prepEyes() {
    const rig = this.rig, geo = this.eyes.geometry.attributes.position, n = geo.count, tmp = new THREE.Vector3();
    const sides = { L: [], R: [] };
    for (let i = 0; i < n; i++) sides[geo.getX(i) > 0 ? 'L' : 'R'].push(i);
    this.eyeInfo = {};
    this.geoCenter = {}; let rad = 0, rc = 0;
    for (const k of ['L', 'R']) {
      const idx = sides[k], bone = this.eyeBone[k];
      const cW = new THREE.Vector3(), poleW = new THREE.Vector3(); let np = 0;
      const cG = new THREE.Vector3();
      for (let j = 0; j < idx.length; j++) cG.add(tmp.fromBufferAttribute(geo, idx[j]));
      cG.multiplyScalar(1 / idx.length); this.geoCenter[k] = cG;
      for (let j = 0; j < idx.length; j += 4) { rig.vertexWorld(this.eyes, idx[j], tmp); cW.add(tmp); }
      cW.multiplyScalar(1 / Math.ceil(idx.length / 4));
      for (const i of idx) {
        tmp.fromBufferAttribute(geo, i).sub(cG); const l = tmp.length(); rad += l; rc++;
        if (-tmp.y / l > 0.985) { rig.vertexWorld(this.eyes, i, tmp); poleW.add(tmp); np++; }
      }
      poleW.multiplyScalar(1 / Math.max(1, np));
      const q = bone.getWorldQuaternion(new THREE.Quaternion()), qi = q.clone().invert();
      this.eyeInfo[k] = {
        bone, cLocal: bone.worldToLocal(cW.clone()),
        fwdLocal: poleW.sub(cW).normalize().applyQuaternion(qi),
        restQ: bone.quaternion.clone(), restP: bone.position.clone(),
      };
    }
    this.eyeR = rad / rc;           // نصف قطر المقلة (فضاء الشبكة)
  }
  _eyeCenterW(k) { const e = this.eyeInfo[k]; return e.bone.localToWorld(e.cLocal.clone()); }
  _eyeFwdW(k) { const e = this.eyeInfo[k]; return e.fwdLocal.clone().applyQuaternion(e.bone.getWorldQuaternion(new THREE.Quaternion())); }
  _resetEyes() {
    for (const k of ['L', 'R']) { const e = this.eyeInfo[k]; e.bone.quaternion.copy(e.restQ); e.bone.position.copy(e.restP); e.bone.updateWorldMatrix(false, true); }
  }

  // ---------- الجفون ----------
  _prepLids() {
    const R = this.eyeR;
    this.lidSets = [];
    for (const mesh of [this.skin, this.lash]) {
      if (!mesh) continue;
      const attr = mesh.geometry.attributes.position, orig = attr.array.slice(), n = attr.count;
      const idx = [], cen = [], wu = [], wl = [];
      for (let i = 0; i < n; i++) {
        const k = orig[i * 3] > 0 ? 'L' : 'R', c = this.geoCenter[k];
        const dx = orig[i * 3] - c.x, dy = orig[i * 3 + 1] - c.y, dz = orig[i * 3 + 2] - c.z;
        const d = Math.hypot(dx, dy, dz), fy = -dy;
        if (d > 3.6 * R || fy < 0.12 * d) continue;
        const el = Math.atan2(dz, fy), az = Math.atan2(Math.abs(dx), fy);
        const wa = 1 - sstep(0.55, 1.3, az), wr = 1 - sstep(1.9 * R, 3.4 * R, d);
        const u = sstep(0.12, 0.5, el) * (1 - sstep(0.8, 1.4, el)) * wa * wr;
        const l = sstep(-0.12, -0.5, el) * (1 - sstep(-1.0, -1.5, el)) * wa * wr;
        if (u < 0.01 && l < 0.01) continue;
        idx.push(i); cen.push(k === 'L' ? 0 : 1); wu.push(u); wl.push(l);
      }
      this.lidSets.push({ mesh, attr, orig, idx: Int32Array.from(idx), cen: Uint8Array.from(cen), wu: Float32Array.from(wu), wl: Float32Array.from(wl) });
    }
    this.lidVerts = this.lidSets.reduce((a, s) => a + s.idx.length, 0);
  }
  // c: درجة إغلاق 0..1 (0 = مفتوحة كما في النموذج)
  _applyLids(c) {
    const thU = 0.95 * c, thL = 0.38 * c, cs = [this.geoCenter.L, this.geoCenter.R];
    for (const s of this.lidSets) {
      const a = s.attr.array, o = s.orig;
      for (let j = 0; j < s.idx.length; j++) {
        const i = s.idx[j] * 3, ce = cs[s.cen[j]], phi = thU * s.wu[j] - thL * s.wl[j];
        const y = o[i + 1] - ce.y, z = o[i + 2] - ce.z, cp = Math.cos(phi), sp = Math.sin(phi);
        a[i] = o[i]; a[i + 1] = ce.y + y * cp - z * sp; a[i + 2] = ce.z + y * sp + z * cp;
      }
      s.attr.needsUpdate = true;
    }
  }

  // ---------- الرأس ----------
  _calibrateHead() {
    const pl = this.pl, H = pl.head;
    this.neckRestP = this.neck.position.clone(); this.neckRestW = this.neck.getWorldPosition(new THREE.Vector3());
    this._resetEyes();
    const mid = () => this._eyeCenterW('L').add(this._eyeCenterW('R')).multiplyScalar(0.5);
    const fwd = () => this._eyeFwdW('L').add(this._eyeFwdW('R')).normalize();
    // اتجاه «أمام الجسم»: الرأس بوضعية الراحة (بلا التفات)
    pl.applyHead(0, 0, 0); this.neck.position.copy(this.neckRestP); this.neck.updateWorldMatrix(false, true);
    this.bodyFwd = fwd();
    this.bodyFwd.y = 0; this.bodyFwd.normalize();
    pl.applyHead(H.yaw, H.pitch, H.roll);
    this.eyeMid0 = mid(); this.f0 = fwd();
    this.u0 = new THREE.Vector3(0, 1, 0).addScaledVector(this.f0, -this.f0.y).normalize();
    this.l0 = new THREE.Vector3().crossVectors(this.u0, this.f0).normalize();
    const ang = (f) => [Math.atan2(f.dot(this.l0), f.dot(this.f0)), Math.atan2(f.dot(this.u0), Math.hypot(f.dot(this.f0), f.dot(this.l0)))];
    this._ang = ang;
    // مصفوفة التأثير: كيف يغيّر (التفات، ميل) اتجاه النظر (يسار، أعلى)
    const a0 = ang(this.f0), h = 0.05, J = [[0, 0], [0, 0]];
    pl.applyHead(H.yaw + h, H.pitch, H.roll); let a = ang(fwd()); J[0][0] = (a[0] - a0[0]) / h; J[1][0] = (a[1] - a0[1]) / h;
    pl.applyHead(H.yaw, H.pitch + h, H.roll); a = ang(fwd()); J[0][1] = (a[0] - a0[0]) / h; J[1][1] = (a[1] - a0[1]) / h;
    pl.applyHead(H.yaw, H.pitch, H.roll);
    const det = J[0][0] * J[1][1] - J[0][1] * J[1][0];
    this.Jinv = Math.abs(det) > 1e-4 ? [[J[1][1] / det, -J[0][1] / det], [-J[1][0] / det, J[0][0] / det]] : [[1, 0], [0, 1]];
    this.J = J;
    this._resetEyes();
  }
  _jawErr() { const p = new THREE.Vector3(); this.rig.vertexWorld(this.pl.jawVert.m, this.pl.jawVert.i, p); return [p, this.pl.jawRestW]; }
  _applyHeadOffset(hy, hp) {
    const pl = this.pl, H = pl.head, neck = this.neck;
    this.neck.position.copy(this.neckRestP);
    pl.applyHead(H.yaw + hy, H.pitch + hp, H.roll);
    for (let it = 0; it < 2; it++) {
      const [p, rest] = this._jawErr();
      const d = new THREE.Vector3(rest[0] - p.x, rest[1] - p.y, rest[2] - p.z);
      const wp = neck.getWorldPosition(new THREE.Vector3());
      neck.position.copy(neck.parent.worldToLocal(wp.add(d)));
      neck.updateWorldMatrix(false, true);
    }
    const [p, rest] = this._jawErr();
    this.jawErrMm = Math.hypot(p.x - rest[0], p.y - rest[1], p.z - rest[2]) * 1000;
    this.stats.maxJawErrMm = Math.max(this.stats.maxJawErrMm, this.jawErrMm);
    this.neckShiftMm = neck.getWorldPosition(new THREE.Vector3()).distanceTo(this.neckRestW) * 1000;
    this.stats.maxNeckShiftMm = Math.max(this.stats.maxNeckShiftMm || 0, this.neckShiftMm);
  }

  // ---------- الرمش ----------
  _blinkValue(dt) {
    const b = this.blink;
    if (b.t < 0) {
      b.next -= dt;
      if (b.next <= 0) { b.t = 0; b.dur = 0.2 + this.rand() * 0.1; b.dbl = this.rand() < 0.1; this.stats.blinks++; }
      return 0;
    }
    b.t += dt;
    const x = b.t / b.dur;
    let c;
    if (x < 0.34) c = sstep(0, 0.34, x);                     // إغلاق أسرع
    else if (x < 0.42) c = 1;
    else c = 1 - sstep(0.42, 1, x);                          // فتح أبطأ
    if (x >= 1) {
      b.t = -1;
      b.next = b.dbl ? 0.16 : clamp(-Math.log(1 - this.rand()) * 3.4 + 1.8, 1.8, 9);
      b.dbl = false;
      return 0;
    }
    return c;
  }

  // ---------- النظر ----------
  _pickGaze(ctx) {
    const g = this.gaze, playing = ctx.playing;
    const w = playing ? { finger: 0.42, scroll: 0.14, bow: 0.14, ahead: 0.30 } : { ahead: 0.5, finger: 0.2, scroll: 0.18, bow: 0.12 };
    if (g.lastKind) w[g.lastKind] *= 0.25;                 // لا نكرّر الهدف نفسه مباشرة
    let r = this.rand() * Object.values(w).reduce((a, b) => a + b, 0), kind = 'ahead';
    for (const k in w) { r -= w[k]; if (r <= 0) { kind = k; break; } }
    const span = { finger: [2.4, 5.5], scroll: [1.4, 2.8], bow: [1.2, 2.4], ahead: [2.0, 4.5] }[kind];
    g.lastKind = g.kind; g.kind = kind; g.until = this.time + span[0] + this.rand() * (span[1] - span[0]);
    g.aheadOff = [(this.rand() - 0.5) * 0.7, -0.12 - this.rand() * 0.12];
    this.stats.gazeShifts++;
    if (this.rand() < 0.3 && this.blink.t < 0) this.blink.next = Math.min(this.blink.next, 0.03 + this.rand() * 0.08);   // رمشة مرافقة لتحويل النظر
  }
  _gazeTarget(ctx) {
    const g = this.gaze, kind = this.override ? this.override.kind : g.kind;
    if (kind === 'ahead') {
      const p = this.eyeMid0.clone().addScaledVector(this.bodyFwd, 2.0);
      p.y += (g.aheadOff ? g.aheadOff[1] : -0.15);
      p.addScaledVector(new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), this.bodyFwd), g.aheadOff ? g.aheadOff[0] : 0);
      return p;
    }
    const pts = this.pl.gazePoints(ctx.st), P = new THREE.Vector3(...pts[kind]);
    // الأهداف القريبة (الأصابع/الرأس الحلزوني/القوس) تقع على يسار الوجه بزاوية 55–70° وهو أبعد من مدى العينين؛
    // فننظر نحوها بنسبة من الزاوية مع ميل للأسفل: وهذا ما يفعله العازف فعلًا (يلتفت قليلًا ويخفض عينيه نحو لوحة الأصابع)
    const mix = { finger: 0.62, scroll: 0.55, bow: 0.5 }[kind], bias = { finger: -0.1, scroll: -0.08, bow: -0.05 }[kind];
    const d = P.clone().sub(this.eyeMid0), dist = d.length(), [gy, gp] = this._ang(d.normalize());
    const y = gy * mix, pch = gp * mix + bias;
    const dir = this.f0.clone().multiplyScalar(Math.cos(pch) * Math.cos(y)).addScaledVector(this.l0, Math.cos(pch) * Math.sin(y)).addScaledVector(this.u0, Math.sin(pch));
    return this.eyeMid0.clone().addScaledVector(dir, Math.max(0.35, dist));
  }

  // ---------- التحديث كل إطار ----------
  update(dt, ctx = {}) {
    if (!this.enabled) return false;
    dt = clamp(dt, 0.001, 0.1);
    this.time += dt;
    const g = this.gaze;
    if (this.time >= g.until) this._pickGaze(ctx);
    let target = this._gazeTarget(ctx);
    // ارتعاش دقيق للعين (micro-saccades) ≈ 0.3°
    g.jitNext -= dt;
    if (g.jitNext <= 0) { g.jitNext = 0.25 + this.rand() * 0.6; g.jitTarget = new THREE.Vector3((this.rand() - 0.5) * 0.004, (this.rand() - 0.5) * 0.003, (this.rand() - 0.5) * 0.004); }
    if (g.jitTarget) g.jit = damp3(g.jit, g.jitV, g.jitTarget, 30, dt);
    target.add(g.jit);
    g.pos = damp3(g.pos, g.vel, target, 34, dt);             // «ساكاد» سريع ثم تتبّع سلس

    // زوايا النظر نسبةً إلى الرأس في وضعية العزف (يسار، أعلى)
    const dir = g.pos.clone().sub(this.eyeMid0).normalize();
    const [gy, gp] = this._ang(dir);
    // الرأس يتبع جزءًا صغيرًا من زاوية النظر ببطء؛ والعينان تكملان الباقي
    const wantY = clamp(0.36 * gy, -6 * DEG, 6 * DEG), wantP = clamp(0.3 * gp, -3.5 * DEG, 3.5 * DEG);
    const cy = this.Jinv[0][0] * wantY + this.Jinv[0][1] * wantP, cp = this.Jinv[1][0] * wantY + this.Jinv[1][1] * wantP;
    this.headOff.y = damp1(this.headOff.y, this.headVel.y, clamp(cy, -7 * DEG, 7 * DEG), 4.5, dt);
    this.headOff.p = damp1(this.headOff.p, this.headVel.p, clamp(cp, -4 * DEG, 4 * DEG), 4.5, dt);
    this._applyHeadOffset(this.headOff.y, this.headOff.p);
    this.stats.maxHeadYawDeg = Math.max(this.stats.maxHeadYawDeg, Math.abs(this.headOff.y) / DEG);
    this.stats.maxHeadPitchDeg = Math.max(this.stats.maxHeadPitchDeg, Math.abs(this.headOff.p) / DEG);

    // العينان: تتجهان إلى الهدف نفسه (تقارب طبيعي)، بحدّ أقصى 30° عن اتجاه الرأس
    this._resetEyes();
    const q = new THREE.Quaternion();
    for (const k of ['L', 'R']) {
      const e = this.eyeInfo[k], c0 = this._eyeCenterW(k), f0 = this._eyeFwdW(k);
      let want = g.pos.clone().sub(c0).normalize();
      const a = f0.angleTo(want), maxA = 32 * DEG;
      if (a > maxA) want = f0.clone().lerp(want, maxA / a).normalize();
      this.stats.maxEyeDeg = Math.max(this.stats.maxEyeDeg, Math.min(a, maxA) / DEG);
      q.setFromUnitVectors(f0, want);
      this.rig.setWorldQuaternion(e.bone, q.multiply(e.bone.getWorldQuaternion(new THREE.Quaternion())));
      const c1 = this._eyeCenterW(k), shift = c0.sub(c1);                      // نُبقي مركز المقلة في مكانه
      e.bone.position.copy(e.bone.parent.worldToLocal(e.bone.getWorldPosition(new THREE.Vector3()).add(shift)));
      e.bone.updateWorldMatrix(false, true);
    }
    this.pitchDown = clamp(-gp, 0, 0.6);

    // الجفون: إغلاق خفيف عند النظر لأسفل + الرمش
    const base = 0.1 + 0.2 * clamp(this.pitchDown / 0.5, 0, 1);
    this.lidBase += (base - this.lidBase) * (1 - Math.exp(-dt * 6));
    const bl = this._blinkValue(dt);
    let c = this.lidBase + (1 - this.lidBase) * bl;
    if (this.force != null) c = this.force;               // للاختبار فقط
    if (Math.abs(c - this.lidNow) > 0.002) { this._applyLids(c); this.lidNow = c; }
    this.closure = c;
    return true;
  }

  report() {
    return {
      enabled: this.enabled, lidVertices: this.lidVerts, eyeRadiusMm: +(this.eyeR * 1000).toFixed(1),
      gaze: this.gaze.kind, closure: +(this.closure || 0).toFixed(2),
      headOffsetDeg: this.headOff ? [+(this.headOff.y / DEG).toFixed(2), +(this.headOff.p / DEG).toFixed(2)] : null,
      jawErrMm: +(this.jawErrMm || 0).toFixed(2), neckShiftMm: +(this.neckShiftMm || 0).toFixed(1), stats: { ...this.stats, maxJawErrMm: +this.stats.maxJawErrMm.toFixed(2), maxNeckShiftMm: +(this.stats.maxNeckShiftMm || 0).toFixed(1) },
    };
  }
}
