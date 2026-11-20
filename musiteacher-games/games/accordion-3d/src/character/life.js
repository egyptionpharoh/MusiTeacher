// =====================================================================
//  حياة العازفة: رمش، تنفس، نظر، حركة رأس، وإغماض عينين — بسلوك عشوائي مضبوط (لا دورات زمنية ثابتة).
//  تعيد استعمال محرك العينين والجفون من Face المشترك (تدوير رؤوس الجلد حول مركز المقلة) وتستبدل منطق الكمان
//  (مسند الذقن) بمنطق خاص بالأكورديون:
//    حالتان رئيسيتان: «عزف» و«راحة» مع انتقال بينهما يتبع نشاط النغمات فعلًا:
//      • العزف: النظر إلى المفاتيح/الأزرار الفعلية المضغوطة، مع لمحات قصيرة إلى المنفاخ والأمام والمشاهد، ورمش أقل.
//      • الراحة: نظرات هادئة حول المكان (جانبين، أعلى، أسفل، المشاهد، الآلة) وإغماضات قصيرة، رمش أكثر.
//      • حين تُضغط نغمة أثناء الراحة تفتح عينيها فورًا وتعود إلى الآلة قبل أن تستأنف العزف.
//    التنفس: يحرّك الجذع والصدر قليلًا بسرعة وسعة متغيرتين، فتتبعه الذراعان عبر IK (اليدان ثابتتان على الأهداف).
//    الرأس: يتبع جزءًا من زاوية النظر + اهتزاز ناعم غير دوري.
// =====================================================================
import * as THREE from 'three';
import { Face } from '../../_shared/3d/character/face.js';

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

export class Life extends Face {
  constructor(player, opts = {}) {
    // Face يتوقع رأسًا مرجعيًا ونقطة فك للكمان؛ نعطيه رأس العزف (ينظر قليلًا إلى الأسفل نحو الآلة) ونعطّل منطق الفك
    player.head = player.head || { yaw: 0, pitch: 0.13, roll: 0 };
    player.jawRestW = player.jawRestW || [0, 0, 0];
    super(player, { rand: opts.rand });
    this.opts = opts; this.R = this.rand;
    if (!this.ok) return;
    this.enabled = true;
    // ---- حالة السلوك ----
    this.mode = 'rest'; this.modeT = 0; this.restAfter = 2 + this.R() * 2;
    this.focus = { kind: 'ahead', until: 0, off: [0, 0], last: '' };
    this.closeEp = { on: false, t: 0, dur: 0, amt: 0 };
    this.nextEpisodeCheck = 0;
    this.lastNoteT = -99; this.noteHeld = 0;
    this.blinkLog = [];                                   // أزمنة الرمشات لاختبار عشوائية التوقيت
    this.stats.eyeClosures = 0; this.stats.modeChanges = 0; this.stats.sighs = 0;
    this._scheduleBlink(true);
    // ---- التنفس ----
    this.br = { phase: this.R(), amp: 1, ampT: 0, ampGoal: 1, rateGoal: 0.26, rate: 0.26, sigh: 0, last: 0 };
    this._breathBones = null;
    // ---- الرأس ----
    this.sway = Array.from({ length: 3 }, () => ({ f1: 0.07 + this.R() * 0.1, f2: 0.19 + this.R() * 0.2, p1: this.R() * 6.28, p2: this.R() * 6.28 }));
    this.headOff.r = 0; this.headVel.r = { v: 0 };
    this.pitchBias = 0; this.lean = 0;
  }

  // ---------- أدوات ----------
  _lognorm(mean, sigma) { const u1 = Math.max(1e-6, this.R()), u2 = this.R(); const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2); return Math.exp(Math.log(mean) - sigma * sigma / 2 + sigma * z); }
  _scheduleBlink(first = false) {
    const m = this.mode === 'play' ? 5.4 : 3.7;
    this.blink.next = first ? 0.8 + this.R() * 2 : Math.max(0.85, this._lognorm(m, 0.55));
  }
  _blinkValue(dt) {                                       // رمش بمدة وعمق وشكل متغيرة
    const b = this.blink;
    if (this.closeEp.on) { b.t = -1; return 0; }
    if (b.t < 0) {
      b.next -= dt;
      if (b.next <= 0) { b.t = 0; b.dur = 0.14 + this.R() * 0.17; b.amp = 0.78 + this.R() * 0.22; b.dbl = this.R() < 0.09; this.stats.blinks++; this.blinkLog.push(+this.time.toFixed(3)); if (this.blinkLog.length > 400) this.blinkLog.shift(); }
      return 0;
    }
    b.t += dt;
    const x = b.t / b.dur;
    let c;
    if (x < 0.34) c = sstep(0, 0.34, x); else if (x < 0.42) c = 1; else c = 1 - sstep(0.42, 1, x);
    if (x >= 1) { b.t = -1; if (b.dbl) { b.next = 0.12 + this.R() * 0.12; b.dbl = false; } else this._scheduleBlink(); return 0; }
    return c * b.amp;
  }

  // ---------- أهداف النظر (إحداثيات العالم) ----------
  _targets() {
    const pl = this.pl, avg = (arr) => { if (!arr || !arr.length) return null; const v = new THREE.Vector3(); for (const p of arr) v.add(p); return v.multiplyScalar(1 / arr.length); };
    const R = avg(pl.rTargets), L = avg(pl.lTargets);
    const acc = pl.acc, mid = acc.root.localToWorld(new THREE.Vector3(acc.getWidth() * 0.5, 0.2, 0.15));
    const eye = this.eyeMid0, fwd = this.bodyFwd, left = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), fwd);
    const at = (d, l, u) => eye.clone().addScaledVector(fwd, d).addScaledVector(left, l).add(new THREE.Vector3(0, u, 0));
    return { R, L, bellows: mid, ahead: at(2, 0, -0.1), viewer: this.opts.getCamPos ? this.opts.getCamPos().clone() : at(2, 0, 0), eye, fwd, left, at };
  }
  _pickFocus(ctx) {
    const f = this.focus, playing = this.mode === 'play';
    const w = playing
      ? { R: 0.5, L: 0.13, bellows: 0.07, ahead: 0.12, viewer: 0.08, glance: 0.10 }
      : { ahead: 0.2, viewer: 0.18, R: 0.14, L: 0.06, bellows: 0.06, glance: 0.36 };
    if (f.last && w[f.last] != null) w[f.last] *= 0.2;
    if (!ctx.targets.L) w.L = 0; if (!ctx.targets.R) w.R = 0;
    let r = this.R() * Object.values(w).reduce((a, b) => a + b, 0), kind = 'ahead';
    for (const k in w) { r -= w[k]; if (r <= 0) { kind = k; break; } }
    const span = { R: [2.0, 5.5], L: [1.0, 2.8], bellows: [0.8, 1.8], ahead: [1.0, 3.0], viewer: [0.8, 2.4], glance: [1.2, 3.8] }[kind];
    f.last = f.kind; f.kind = kind; f.until = this.time + (playing ? 1 : 1.35) * (span[0] + this.R() * (span[1] - span[0]));
    if (kind === 'glance') {                              // نظرة جانبية/علوية/سفلية متفاوتة
      const side = this.R() < 0.5 ? -1 : 1, big = this.R();
      f.off = [side * (0.25 + this.R() * (playing ? 0.5 : 1.0)), (this.R() - 0.55) * (big < 0.25 ? 0.9 : 0.4)];
    } else f.off = [(this.R() - 0.5) * 0.16, (this.R() - 0.5) * 0.1];
    this.stats.gazeShifts++;
    if (this.R() < 0.32 && this.blink.t < 0 && !this.closeEp.on) this.blink.next = Math.min(this.blink.next, 0.03 + this.R() * 0.09);   // رمشة مرافقة لتحويل النظر
    // احتمال إغماض قصير: في الراحة غالبًا، وفي العزف نادرًا (مع نغمة ممدودة)
    const pClose = this.time < 8 ? 0 : playing ? (this.noteHeld > 1.8 ? 0.07 : 0.0) : 0.2;
    if (!this.closeEp.on && this.R() < pClose) { this.closeEp = { on: true, t: 0, dur: playing ? 0.5 + this.R() * 0.9 : 0.8 + this.R() * 2.2, amt: 0.9 + this.R() * 0.1 }; this.stats.eyeClosures++; }
  }
  _gazeTarget(ctx) {
    const f = this.focus, T = ctx.targets;
    let base;
    switch (f.kind) {
      case 'R': base = T.R.clone(); break;
      case 'L': base = T.L.clone(); break;
      case 'bellows': base = T.bellows.clone(); break;
      case 'viewer': {                                     // تنظر نحو المشاهد إن كان أمامها تقريبًا وإلا إلى الأمام
        const d = T.viewer.clone().sub(T.eye); const ang = Math.atan2(d.dot(T.left), d.dot(T.fwd));
        base = Math.abs(ang) < 75 * DEG && d.length() > 0.3 ? T.viewer.clone() : T.at(2, 0, -0.05); break;
      }
      case 'glance': base = T.at(1.6, f.off[0] * 1.6, f.off[1] * 0.9); break;
      default: base = T.at(2, f.off[0] * 0.6, -0.1 + f.off[1] * 0.4);
    }
    if (f.kind === 'R' || f.kind === 'L') { base.addScaledVector(T.left, f.off[0] * 0.04); base.y += f.off[1] * 0.03; }
    return base;
  }

  // ---------- تنفس: يُستدعى قبل حركة اليدين كي تتبع الذراعان الجذع ----------
  pre(dt) {
    if (!this.ok) return;
    const rig = this.rig, br = this.br; dt = clamp(dt, 0.001, 0.1);
    if (!this._breathBones) {
      const bs = ['spine', 'chest', 'upperChest'].map((k) => rig.b('C', k)).filter(Boolean);
      this._breathBones = bs.map((b) => ({ b, q: rig.worldQ(b) }));
    }
    // معدل وسعة متغيران ببطء؛ وتنهيدة أحيانًا (أعمق وأبطأ) أثناء الراحة
    br.ampT -= dt; if (br.ampT <= 0) { br.ampT = 3 + this.R() * 6; br.ampGoal = 0.75 + this.R() * 0.6; br.rateGoal = (this.mode === 'play' ? 0.30 : 0.22) + this.R() * 0.1;
      if (this.mode === 'rest' && this.R() < 0.07) { br.sigh = 1; br.ampGoal = 1.9; br.rateGoal = 0.15; this.stats.sighs++; } else br.sigh = 0; }
    br.amp += (br.ampGoal - br.amp) * (1 - Math.exp(-dt * 0.8)); br.rate += (br.rateGoal - br.rate) * (1 - Math.exp(-dt * 0.5));
    br.phase = (br.phase + dt * br.rate) % 1;
    const x = br.phase, v = x < 0.4 ? sstep(0, 0.4, x) : 1 - sstep(0.4, 1, x);      // شهيق أسرع من الزفير
    br.last = v * br.amp;
    const A = 0.016 * br.last, X = new THREE.Vector3(1, 0, 0);
    this._breathBones.forEach((e, i) => rig.setWorldQuaternion(e.b, new THREE.Quaternion().setFromAxisAngle(X, -A * [0.35, 0.7, 1.0][i]).multiply(e.q)));
  }

  _applyHeadOffset(hy, hp, hr = 0) {
    const pl = this.pl, H = pl.head;
    pl.applyHead(H.yaw + hy, H.pitch + hp, H.roll + hr);
    this.jawErrMm = 0; this.neckShiftMm = 0;
  }

  // ---------- التحديث كل إطار ----------
  /** ctx: { active: عدد النغمات الجارية، sinceNote: ثوانٍ منذ آخر ضغط/رفع، bellowsV: سرعة المنفاخ } */
  update(dt, ctx = {}) {
    if (!this.enabled || !this.ok) return false;
    dt = clamp(dt, 0.001, 0.1); this.time += dt;
    const active = ctx.active || 0, since = ctx.sinceNote ?? 99;
    this.noteHeld = active > 0 ? this.noteHeld + dt : 0;
    // ---- حالة العزف/الراحة ----
    const wasMode = this.mode;
    if (active > 0 || since < this.restAfter) {
      if (this.mode !== 'play') { this.mode = 'play'; this.stats.modeChanges++; this.focus.until = 0; this.focus.last = ''; this.focus.forceKind = 'R'; if (this.closeEp.on) { this.closeEp.dur = Math.min(this.closeEp.dur, this.closeEp.t + 0.05); } this.blink.next = Math.max(this.blink.next, 1.0); }
      if (active > 0) this.restAfter = 1.8 + this.R() * 3.2;
    } else if (this.mode !== 'rest') { this.mode = 'rest'; this.stats.modeChanges++; this.focus.until = 0; this.focus.forceKind = null; this._scheduleBlink(); }
    ctx.targets = this._targets();
    // ---- اختيار النظر ----
    const g = this.gaze, f = this.focus;
    if (this.time >= f.until) {
      if (f.forceKind) { f.last = f.kind; f.kind = f.forceKind; f.forceKind = null; f.until = this.time + 1.6 + this.R() * 2.5; f.off = [0, 0]; this.stats.gazeShifts++; }
      else this._pickFocus(ctx);
    }
    // أثناء العزف: النظر يلحق الإصبع المضغوط الأحدث (يمين أو يسار) إن كان قريبًا
    let focusKind = f.kind;
    if (this.mode === 'play' && (focusKind === 'R' || focusKind === 'L') && !ctx.targets[focusKind]) focusKind = 'ahead';
    const saveKind = f.kind; f.kind = focusKind;
    const target = this._gazeTarget(ctx); f.kind = saveKind;
    // ارتعاش العين الدقيق
    g.jitNext -= dt;
    if (g.jitNext <= 0) { g.jitNext = 0.2 + this.R() * 0.6; g.jitTarget = new THREE.Vector3((this.R() - 0.5) * 0.004, (this.R() - 0.5) * 0.003, (this.R() - 0.5) * 0.004); }
    if (g.jitTarget) g.jit = damp3(g.jit, g.jitV, g.jitTarget, 30, dt);
    target.add(g.jit);
    const saccade = (this.mode === 'play' ? 30 : 22);
    g.pos = damp3(g.pos, g.vel, target, saccade, dt);
    // ---- الرأس يتبع جزءًا من زاوية النظر + اهتزاز ناعم ----
    const dir = g.pos.clone().sub(this.eyeMid0).normalize();
    let [gy, gp] = this._ang(dir);
    const rest = this.mode === 'rest';
    const frac = rest ? 0.55 : 0.42, lim = rest ? [38, 18, 16] : [14, 10, 8];
    const wantY = clamp(frac * gy, -lim[0] * DEG, lim[0] * DEG), wantP = clamp(frac * gp, -lim[1] * DEG * 1.2, lim[1] * DEG);
    const cy = this.Jinv[0][0] * wantY + this.Jinv[0][1] * wantP, cp = this.Jinv[1][0] * wantY + this.Jinv[1][1] * wantP;
    const t = this.time, sw = this.sway.map((s) => Math.sin(t * s.f1 * 6.283 + s.p1) * 0.65 + Math.sin(t * s.f2 * 6.283 + s.p2) * 0.35);
    const closing = this.closeEp.on ? 1 : 0;
    this.pitchBias += ((closing ? 0.05 : 0) - this.pitchBias) * (1 - Math.exp(-dt * 2));
    this.lean += (clamp((ctx.bellowsV || 0) * 40, -1, 1) * 1.4 * DEG - this.lean) * (1 - Math.exp(-dt * 2.2));      // الرأس يميل قليلًا مع اتجاه المنفاخ
    const wantR = clamp(-0.28 * wantY, -4 * DEG, 4 * DEG) + this.lean;                       // ميلان خفيف يرافق الالتفات
    const om = rest ? 3.4 : 4.6;
    this.headOff.y = damp1(this.headOff.y, this.headVel.y, clamp(cy, -40 * DEG, 40 * DEG) + sw[0] * 0.8 * DEG, om, dt);
    this.headOff.p = damp1(this.headOff.p, this.headVel.p, clamp(cp, -25 * DEG, 14 * DEG) + sw[1] * 0.6 * DEG + this.pitchBias, om, dt);
    this.headOff.r = damp1(this.headOff.r, this.headVel.r, wantR + sw[2] * 0.9 * DEG, om, dt);
    this._applyHeadOffset(this.headOff.y, this.headOff.p, this.headOff.r);
    this.stats.maxHeadYawDeg = Math.max(this.stats.maxHeadYawDeg, Math.abs(this.headOff.y) / DEG);
    this.stats.maxHeadPitchDeg = Math.max(this.stats.maxHeadPitchDeg, Math.abs(this.headOff.p) / DEG);
    // ---- العينان ----
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
      const c1 = this._eyeCenterW(k), shift = c0.sub(c1);
      e.bone.position.copy(e.bone.parent.worldToLocal(e.bone.getWorldPosition(new THREE.Vector3()).add(shift)));
      e.bone.updateWorldMatrix(false, true);
    }
    this.pitchDown = clamp(-gp, 0, 0.6);
    // ---- الجفون: إغلاق خفيف عند النظر لأسفل + رمشة + إغماض ----
    const base = 0.1 + 0.2 * clamp(this.pitchDown / 0.5, 0, 1);
    this.lidBase += (base - this.lidBase) * (1 - Math.exp(-dt * 6));
    let ep = 0;
    const E = this.closeEp;
    if (E.on) { E.t += dt; const tin = 0.22, tout = 0.34; ep = E.t < tin ? sstep(0, tin, E.t) : (E.t < E.dur ? 1 : 1 - sstep(E.dur, E.dur + tout, E.t)); if (E.t > E.dur + tout) { E.on = false; this._scheduleBlink(); } ep *= E.amt; }
    const bl = this._blinkValue(dt);
    let c = this.lidBase + (1 - this.lidBase) * Math.max(bl, ep);
    if (this.force != null) c = this.force;
    if (Math.abs(c - this.lidNow) > 0.002) { this._applyLids(c); this.lidNow = c; }
    this.closure = c;
    return true;
  }

  report() {
    const iv = []; for (let i = 1; i < this.blinkLog.length; i++) iv.push(this.blinkLog[i] - this.blinkLog[i - 1]);
    const mean = iv.length ? iv.reduce((a, b) => a + b, 0) / iv.length : 0, sd = iv.length ? Math.sqrt(iv.reduce((a, b) => a + (b - mean) ** 2, 0) / iv.length) : 0;
    return { enabled: this.enabled, mode: this.mode, gaze: this.focus.kind, closure: +(this.closure || 0).toFixed(2), blinks: this.stats.blinks, blinkMeanS: +mean.toFixed(2), blinkSdS: +sd.toFixed(2), blinkCV: mean ? +(sd / mean).toFixed(2) : 0,
      closures: this.stats.eyeClosures, shifts: this.stats.gazeShifts, modeChanges: this.stats.modeChanges, breath: +(this.br ? this.br.last : 0).toFixed(2), sighs: this.stats.sighs,
      headDeg: [+(this.headOff.y / DEG).toFixed(1), +(this.headOff.p / DEG).toFixed(1), +((this.headOff.r || 0) / DEG).toFixed(1)], maxEyeDeg: +this.stats.maxEyeDeg.toFixed(1), maxHeadYawDeg: +this.stats.maxHeadYawDeg.toFixed(1) };
  }
}
