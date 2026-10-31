// =====================================================================
//  «المؤدّي»: يحرّك العازفة والآلة معًا من أحداث ضغط/رفع (الماوس أو اللمس أو الدرس).
//  • اختيار الإصبع الأنسب (أقل حركة لليد) وانتقال اليد المنزلق على المفاتيح/الأزرار.
//  • ضغط الأصابع بغلاف زمني (نزول ثم لمس ثم ضغط)، والمفتاح الفعلي ينزل فتلحقه الأصبع.
//  • المنفاخ: سرعة تتبع الهواء المطلوب (عدد النغمات وقوتها)، يبدّل اتجاهه عند طرفيه أو عند الوقفات، بتنويع عشوائي ناعم.
//  • الصوت يُقاد بسرعة المنفاخ (airflow) فيرتبط الصوت بحركته.
// =====================================================================
import { TREBLE, BASS, WHITE_COUNT, bassById } from '../instrument/accordion-data.js';
import { DIM } from '../instrument/accordion-model.js';

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const keyMap = Object.fromEntries(TREBLE.map((k) => [k.id, k]));
const W_MIN = 0.125, W_MAX = 0.305;
const lerpExp = (cur, goal, rate, dt) => cur + (goal - cur) * (1 - Math.exp(-rate * dt));

// انتقال بنابض مخمَّد حرجيًا (حركة ناعمة بلا قفزات)
class Spring { constructor(x) { this.x = x; this.v = 0; }
  step(goal, w, dt) { const x0 = this.x - goal, c = this.v + w * x0, e = Math.exp(-w * dt); this.x = goal + (x0 + c * dt) * e; this.v = (this.v - w * c * dt) * e; return this.x; } }

export class Performer {
  constructor(player, audio, opts = {}) {
    this.p = player; this.acc = player.acc; this.audio = audio;
    this.rs = { base: new Spring(6), goal: 6 };
    this.ls = { row: new Spring(0.6), z: new Spring(3), goalRow: 0.6, goalZ: 3 };
    this.rd = Array.from({ length: 5 }, () => null);        // أصابع اليد اليمنى
    this.ld = Array.from({ length: 3 }, () => null);        // أصابع اليد اليسرى
    this.bel = { w: 0.2, v: 0, dir: 1, idle: 0, noise: 0, nph: Math.random() * 10, manual: null, flipped: 0, flipAt: 0.03, strokeK: 1 };
    this.t = 0; this.lastEventT = -99; this.activeNotes = 0; this.lastVel = 0.7; this.onEvent = opts.onEvent || null;
    this.held = new Map();                                  // id -> {side, handle}
    this.stats = { presses: 0, flips: 0 };
  }

  // ---------- اختيار الإصبع ----------
  chooseR(slot) {
    const held = this.rd.some((d) => d && d.amtGoal > 0);
    let bestD = -1, bestCost = 1e9, newBase = this.rs.goal;
    for (let d = 0; d < 5; d++) {
      if (this.rd[d] && this.rd[d].amtGoal > 0) continue;
      const base = clamp(slot - d, 0, WHITE_COUNT - 5.0);
      const err = Math.abs(base - (slot - d));
      let cost = err * 6 + (held ? Math.abs(slot - (this.rs.goal + d)) * 3 : Math.abs(base - this.rs.goal)) + (d === 1 || d === 2 ? 0 : 0.15);
      if (this.rd[d]) cost += 0.05;                         // إصبع ما زال يرتفع
      if (cost < bestCost) { bestCost = cost; bestD = d; newBase = base; }
    }
    if (bestD < 0) bestD = 0;
    if (!held) this.rs.goal = newBase;
    return bestD;
  }
  chooseL(row) {
    const held = this.ld.some((d) => d && d.amtGoal > 0);
    let bestD = -1, bestCost = 1e9, newRow = this.ls.goalRow;
    for (let d = 0; d < 3; d++) {
      if (this.ld[d] && this.ld[d].amtGoal > 0) continue;
      const r0 = clamp(row - d, 0, 3);
      const cost = Math.abs(r0 - (row - d)) * 6 + (held ? Math.abs(row - (this.ls.goalRow + d)) * 3 : Math.abs(r0 - this.ls.goalRow)) + (d === 1 ? 0 : 0.15);
      if (cost < bestCost) { bestCost = cost; bestD = d; newRow = r0; }
    }
    if (bestD < 0) bestD = 0;
    if (!held) this.ls.goalRow = newRow;
    return bestD;
  }

  // ---------- الأحداث ----------
  /** تهيئة الإصبع قبل الضغط بقليل (لتلامس الإصبع المفتاح لحظة العزف) — اختياري */
  prepare(side, id) {
    if (this.held.has(id) || this.prep && this.prep.has(id)) return;
    (this.prep = this.prep || new Map());
    if (side === 'R') { const k = keyMap[id]; if (!k) return; const d = this.chooseR(k.slot); this.rd[d] = { id, amt: 0, amtGoal: 0, lift: 1, liftGoal: 0 }; this.prep.set(id, d); }
    else { const b = bassById[id]; if (!b) return; const d = this.chooseL(b.row); this.ls.goalZ = b.col; this.ld[d] = { id, amt: 0, amtGoal: 0, lift: 1, liftGoal: 0 }; this.prep.set(id, d); }
  }
  press(side, id, vel = 0.75) {
    if (this.held.has(id)) return;
    let d;
    if (this.prep && this.prep.has(id)) { d = this.prep.get(id); this.prep.delete(id); }
    else if (side === 'R') { const k = keyMap[id]; if (!k) return; d = this.chooseR(k.slot); this.rd[d] = { id, amt: 0, amtGoal: 1, lift: 1, liftGoal: 0 }; }
    else { const b = bassById[id]; if (!b) return; d = this.chooseL(b.row); this.ls.goalZ = b.col; this.ld[d] = { id, amt: 0, amtGoal: 1, lift: 1, liftGoal: 0 }; }
    const arr = side === 'R' ? this.rd : this.ld, fin = arr[d]; fin.amtGoal = 1; fin.liftGoal = 0; fin.vel = vel;
    const notes = side === 'R' ? [keyMap[id].midi] : bassById[id].notes;
    const handle = this.audio ? this.audio.noteOn(side, notes, vel) : null;
    this.held.set(id, { side, handle, d, notes, vel, t: this.t });
    this.activeNotes++; this.lastVel = vel; this.stats.presses++; this.lastEventT = this.t;
    // الذراع تدفع المنفاخ فورًا عند أول نغمة
    const vT = this.targetSpeed(); if (Math.abs(this.bel.v) < vT * 0.55) this.bel.v = this.bel.dir * vT * 0.55;
    this.bel.idle = 0;
    this.onEvent && this.onEvent({ type: 'on', side, id, notes, vel });
  }
  release(id) {
    const h = this.held.get(id); if (!h) return;
    const arr = h.side === 'R' ? this.rd : this.ld, fin = arr[h.d];
    if (fin && fin.id === id) { fin.amtGoal = 0; fin.liftDelay = 0.05; }
    if (this.audio && h.handle) this.audio.noteOff(h.handle);
    this.held.delete(id); this.activeNotes = Math.max(0, this.activeNotes - 1); this.lastEventT = this.t;
    this.onEvent && this.onEvent({ type: 'off', side: h.side, id });
  }
  sinceNote() { return this.activeNotes > 0 ? 0 : this.t - this.lastEventT; }
  releaseAll() { for (const id of [...this.held.keys()]) this.release(id); }

  // ---------- المنفاخ ----------
  targetSpeed() {
    const n = this.activeNotes;
    return 0.016 + 0.011 * Math.min(n, 4) + 0.03 * this.lastVel * Math.min(1, n);
  }
  /** تحكم يدوي: قيمة -1..1 (سالب = إغلاق)، null = تلقائي */
  setManualBellows(v) { this.bel.manual = v; }
  flipBellows() { const b = this.bel; b.dir *= -1; this.stats.flips++; b.flipped = this.t; b.flipAt = 0.012 + Math.random() * 0.04; b.w0 = b.w; b.strokeK = 0.82 + Math.random() * 0.4; }   // كل شدّة لها طول وسرعة مختلفان قليلًا

  updateBellows(dt) {
    const b = this.bel;
    b.nph += dt; b.noise = 0.5 * (Math.sin(b.nph * 1.3) + Math.sin(b.nph * 2.9 + 1.7) * 0.6);   // تنويع ناعم غير دوري
    let vT;
    if (b.manual != null) vT = b.manual * 0.05;
    else if (this.activeNotes > 0) vT = b.dir * this.targetSpeed() * b.strokeK * (1 + 0.16 * b.noise);
    else { b.idle += dt; vT = b.dir * 0.0035 * (1 + 0.5 * b.noise); if (b.idle > 0.32) { const edge = b.dir > 0 ? (W_MAX - b.w) : (b.w - W_MIN); if (edge < 0.07 && this.t - b.flipped > 0.6) this.flipBellows(); } }
    // عند الاقتراب من الحد: يتباطأ ثم يبدّل الاتجاه (تغيير الهواء)
    if (b.manual == null) {
      const room = b.dir > 0 ? (W_MAX - b.w) : (b.w - W_MIN);
      if (this.activeNotes > 0 && this.t - b.flipped > 0.5 && (room < 0.004 || (room < b.flipAt && this.t - b.flipped > 0.8 && Math.abs(b.w - (b.w0 ?? 0.2)) > 0.07))) this.flipBellows();
      else if (room < 0.03) vT *= Math.max(0.35, room / 0.03);
    }
    const tau = (this.t - b.flipped < 0.5) ? 0.07 : 0.14;
    b.v = lerpExp(b.v, vT, 1 / tau, dt);
    b.w = clamp(b.w + b.v * dt, W_MIN, W_MAX);
    if (b.w <= W_MIN + 1e-4 && b.v < 0) b.v = 0; if (b.w >= W_MAX - 1e-4 && b.v > 0) b.v = 0;
    const sp = Math.abs(b.v);
    this.air = clamp(sp / 0.05, 0, 1);
    if (this.activeNotes > 0) this.air = Math.max(this.air, 0.2);        // لا يختفي الصوت تمامًا لحظة تبديل الاتجاه
  }

  // ---------- الإطار ----------
  update(dt) {
    dt = Math.min(dt, 0.05); this.t += dt;
    this.updateBellows(dt);
    // انزلاق اليدين
    this.rs.base.step(this.rs.goal, 22, dt); this.ls.row.step(this.ls.goalRow, 22, dt); this.ls.z.step(this.ls.goalZ, 20, dt);
    const dR = {}, dL = {};
    const upd = (arr, setPress, key) => arr.forEach((f, d) => {
      if (!f) return;
      if (f.amtGoal === 0 && f.liftDelay > 0) { f.liftDelay -= dt; if (f.liftDelay <= 0) f.liftGoal = 1; }
      f.amt = lerpExp(f.amt, f.amtGoal, f.amtGoal > f.amt ? 38 : 24, dt);
      f.lift = lerpExp(f.lift, f.liftGoal, f.liftGoal < f.lift ? 30 : 16, dt);
      setPress(f.id, f.amt);
      if (f.amtGoal === 0 && f.lift > 0.985 && f.amt < 0.01) { setPress(f.id, 0); arr[d] = null; return; }
      (arr === this.rd ? dR : dL)[d] = { [key]: f.id, amt: f.amt, lift: f.lift };
    });
    upd(this.rd, (id, v) => this.acc.setKeyPress(id, v), 'keyId');
    upd(this.ld, (id, v) => this.acc.setBassPress(id, v), 'bassId');
    // أُسقط من prep ما لم يُضغط منذ مدة
    if (this.prep) for (const [id, d] of this.prep) { const arr = keyMap[id] ? this.rd : this.ld; if (!arr[d]) this.prep.delete(id); }
    this.p.pose({ w: this.bel.w, R: { base: this.rs.base.x, digits: dR }, L: { row: this.ls.row.x, z: this.ls.z.x, digits: dL } });
    if (this.audio) this.audio.setAir(this.air);
  }

  snapshot() {
    return { w: +this.bel.w.toFixed(3), v: +this.bel.v.toFixed(4), dir: this.bel.dir, air: +(this.air || 0).toFixed(2), held: [...this.held.keys()], rBase: +this.rs.base.x.toFixed(2), flips: this.stats.flips,
      fingers: this.rd.map((f, d) => f && { d, id: f.id, amt: +f.amt.toFixed(2), lift: +f.lift.toFixed(2) }).filter(Boolean) };
  }
}
