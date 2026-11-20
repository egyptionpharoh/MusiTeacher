// =====================================================================
//  «المؤدّي»: يربط ضغطة المفتاح (ماوس/لمس/لوحة حاسوب/تمرين) بالإصبع والصوت في لحظة واحدة.
//  • تحديد اليد: ما دون دو الوسطى لليسرى، ومنها فما فوق لليمنى (أو اليد المحددة في التمرين).
//  • اختيار الإصبع الأنسب (أقل حركة لليد)، أو الإصبع المكتوب في التمرين (ترقيم الأصابع ١–٥).
//  • غلاف زمني للإصبع: نزول ثم ضغط، والمفتاح الفعلي ينزل مع الإصبع (المفتاح يتبع قيمة ضغط الإصبع نفسها).
//  • انزلاق اليد على طول اللوحة بنابض مخمَّد (لا قفزات).
//  • الصوت يبدأ مع بدء الضغط (لا ينتظر اكتمال الحركة) ويتوقف عند رفع الإصبع.
// =====================================================================
import { KEYS, WHITE_COUNT, MIDDLE_C, keyById } from '../instrument/organ-data.js';

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const lerpExp = (cur, goal, rate, dt) => cur + (goal - cur) * (1 - Math.exp(-rate * dt));
class Spring { constructor(x) { this.x = x; this.v = 0; }
  step(goal, w, dt) { const x0 = this.x - goal, c = this.v + w * x0, e = Math.exp(-w * dt); this.x = goal + (x0 + c * dt) * e; this.v = (this.v - w * c * dt) * e; return this.x; } }

// مدى خانة الإبهام لكل يد (اليمنى: الإبهام أخفض الأصابع؛ اليسرى: الإبهام أعلاها)
const RANGE = { R: [0, WHITE_COUNT - 5], L: [4, WHITE_COUNT - 1] };
const DIR = { R: 1, L: -1 };

export class Performer {
  constructor(player, audio, opts = {}) {
    this.p = player; this.organ = player.organ; this.audio = audio;
    this.hand = { R: { base: new Spring(14), goal: 14, d: Array(5).fill(null) }, L: { base: new Spring(11), goal: 11, d: Array(5).fill(null) } };
    this.t = 0; this.lastEventT = -99; this.activeNotes = 0; this.onEvent = opts.onEvent || null;
    this.held = new Map();                                  // id -> {side, handle, d}
    this.stats = { presses: 0 };
    this.split = MIDDLE_C;
    this.bpm = 72;                                          // سرعة التمرين الحالية: تحدد زمن انتقال اليد في العبور
  }
  set player(p) { this.p = p; }

  handFor(k, want) {
    if (want === 'R' || want === 'L') return want;
    const pref = k.midi >= this.split ? 'R' : 'L', other = pref === 'R' ? 'L' : 'R';
    const free = (s) => this.hand[s].d.some((f) => !f || f.amtGoal === 0);
    return free(pref) ? pref : (free(other) ? other : pref);
  }
  // ---------- اختيار الإصبع ----------
  choose(s, k, finger) {
    const H = this.hand[s], dir = DIR[s], [lo, hi] = RANGE[s], slot = k.slotEff;
    const held = H.d.some((f) => f && f.amtGoal > 0);
    if (finger >= 1 && finger <= 5) {                       // الإصبع المحدد في التمرين
      const d = finger - 1;
      if (H.d[d] && H.d[d].amtGoal > 0) this.release(H.d[d].id);   // إن كان مشغولًا يُرفع أولًا (تبديل الأصابع)
      const to = clamp(slot - dir * d, lo, hi), from = H.cross && !H.cross.done ? H.cross.to : H.goal, delta = dir * (to - from);
      // عبور الأصابع (تقنية السلالم):
      //  • «تحت»: الإبهام يعبر تحت الأصابع إلى مفتاح أبعد في اتجاه الحركة (يمنى صاعدة دو ري مي ← فا).
      //  • «فوق»: إصبع (عادة ٣) يعبر فوق الإبهام الضاغط إلى مفتاح في الجهة الأخرى (يمنى هابطة فا ← مي).
      // في الحالتين لا تقفز اليد: تبدأ بالانزلاق جزئيًا أثناء التحضير وتكمل بعد الضغط، والإبهام/الإصبع يبقى محوَر الدوران.
      const thumbDown = H.d[0] && (H.d[0].amtGoal > 0 || H.d[0].amt > 0.3);
      const kind = d === 0 && delta >= 1.5 ? 'under' : (d >= 1 && delta <= -1.5 && thumbDown ? 'over' : null);
      // لا تقفز اليد عند بدء التحضير: الهدف ينزلق تدريجيًا (انظر update) — «تزلّج» جانبي هادئ يقوده الساعد
      if (kind) { H.cross = { kind, d, from, to, id: k.id, done: false, t0: this.t, lead: 0.12, frac: kind === 'under' ? 0.35 : 0.5 }; H.goal = from; }
      else { H.goal = to; if (H.cross && H.cross.done) H.cross = null; }
      return d;
    }
    let bestD = 0, bestCost = 1e9, newBase = H.goal;
    for (let d = 0; d < 5; d++) {
      if (H.d[d] && H.d[d].amtGoal > 0) continue;
      const base = clamp(slot - dir * d, lo, hi);
      const err = Math.abs(base - (slot - dir * d));
      let cost = err * 6 + (held ? Math.abs(slot - (H.goal + dir * d)) * 3 : Math.abs(base - H.goal)) + (d === 1 || d === 2 ? 0 : 0.15);
      if (H.d[d]) cost += 0.05;
      if (k.black && d === 0) cost += 2.2;                  // الإبهام قصير، لا يُستعمل للأسود إلا اضطرارًا
      if (k.black && d === 4) cost += 0.6;
      if (cost < bestCost) { bestCost = cost; bestD = d; newBase = base; }
    }
    if (!held) H.goal = newBase;
    return bestD;
  }

  // ---------- الأحداث ----------
  /** تجهيز الإصبع قبل الضغط بقليل (يقترب من المفتاح) — للعرض التوضيحي */
  prepare(id, opt = {}) {
    const k = this.organ.keys[id]; if (!k || this.held.has(id)) return;
    (this.prep = this.prep || new Map()); if (this.prep.has(id)) return;
    const s = this.handFor(k, opt.hand), d = this.choose(s, k, opt.finger), H = this.hand[s];
    const cross = H.cross && !H.cross.done && H.cross.id === id && H.cross.d === d ? H.cross.kind : null;
    // الإصبع العابر يتحرك ببطء على امتداد زمن التحضير كله (lead)، لا في اللحظة الأخيرة
    const lead = Math.max(0.12, opt.lead || 0.12);
    if (cross) { H.cross.t0 = this.t; H.cross.lead = lead; }
    H.d[d] = { id, amt: 0, amtGoal: 0, lift: 1, liftGoal: cross ? 0.12 : 0.25, liftRate: cross ? 2.6 / lead : 0, cross };
    this.prep.set(id, { s, d });
  }
  press(id, vel = 0.75, opt = {}) {
    const k = this.organ.keys[id]; if (!k || this.held.has(id)) return null;
    let s, d;
    if (this.prep && this.prep.has(id)) { ({ s, d } = this.prep.get(id)); this.prep.delete(id); }
    else { s = this.handFor(k, opt.hand); d = this.choose(s, k, opt.finger); }
    const H = this.hand[s], same = H.d[d] && H.d[d].id === id;
    let cross = same ? H.d[d].cross : null;
    if (H.cross && !H.cross.done && H.cross.id === id && H.cross.d === d) {
      // بعد استقرار الإصبع العابر تكمل اليد انزلاقها إلى موضعها الجديد على منحنى ناعم مدته تتبع السرعة (لا دفعة واحدة)
      cross = H.cross.kind; H.cross.done = true; H.cross.p0 = this.t; H.cross.g0 = H.goal;
      H.cross.glide = clamp(0.38 * 60 / this.bpm, 0.15, 0.4); H.cross.until = this.t + H.cross.glide + 0.25;
    }
    H.d[d] = { id, amt: same ? H.d[d].amt : 0, amtGoal: 1, lift: same ? H.d[d].lift : 1, liftGoal: 0, vel, cross };
    const handle = this.audio ? this.audio.noteOn(k.midi, vel) : null;
    this.held.set(id, { s, d, handle, midi: k.midi, t: this.t });
    this.activeNotes++; this.stats.presses++; this.lastEventT = this.t;
    this.onEvent && this.onEvent({ type: 'on', id, midi: k.midi, hand: s, finger: d + 1, vel });
    return { hand: s, finger: d + 1 };
  }
  release(id) {
    const h = this.held.get(id); if (!h) return;
    const f = this.hand[h.s].d[h.d];
    if (f && f.id === id) {
      f.amtGoal = 0; f.liftDelay = 0.04;
      // بعد عبور إصبع فوق الإبهام، ينسحب الإبهام إلى موضعه الجديد من تحت الكف (منخفضًا) لا صاعدًا عبر الإصبع
      const H = this.hand[h.s]; if (h.d === 0 && H.cross && H.cross.kind === 'over') { f.cross = 'under'; f.liftDelay = 0.001; }
    }
    if (this.audio && h.handle) this.audio.noteOff(h.handle);
    this.held.delete(id); this.activeNotes = Math.max(0, this.activeNotes - 1); this.lastEventT = this.t;
    this.onEvent && this.onEvent({ type: 'off', id, midi: h.midi, hand: h.s });
  }
  releaseAll() { for (const id of [...this.held.keys()]) this.release(id); if (this.prep) this.prep.clear(); for (const s of ["R", "L"]) if (this.hand[s].cross && !this.hand[s].cross.done) { this.hand[s].goal = this.hand[s].cross.from; this.hand[s].cross = null; } }
  sinceNote() { return this.activeNotes > 0 ? 0 : this.t - this.lastEventT; }
  /** حفظ موضع اليدين واستعادته (عند تبديل الشخصية تبقى اليدان على المفاتيح نفسها) */
  snapshotHands() { return { R: this.hand.R.goal, L: this.hand.L.goal }; }
  restoreHands(k) { for (const s of ['R', 'L']) { this.hand[s].d = Array(5).fill(null); this.hand[s].cross = null; if (k && k[s] != null) { this.hand[s].goal = k[s]; this.hand[s].base.x = k[s]; this.hand[s].base.v = 0; } } }
  /** يحرّك يدًا إلى موضع (خانة الإبهام) دون عزف — لبداية التمارين */
  placeHand(s, base) { const [lo, hi] = RANGE[s]; this.hand[s].goal = clamp(base, lo, hi); this.hand[s].cross = null; }

  // ---------- الإطار ----------
  update(dt) {
    dt = Math.min(dt, 0.05); this.t += dt;
    const st = {};
    for (const s of ['R', 'L']) {
      const H = this.hand[s];
      // أثناء العبور تنزلق اليد أبطأ (حركة الساعد كلها، لا قفزة)، وزمنها يتبع سرعة التمرين
      const crossing = H.cross && (!H.cross.done || this.t < H.cross.until);
      if (H.cross && !H.cross.done) {                       // أثناء التحضير: انزلاق متدرّج (منحنى ناعم) نحو جزء من المسافة
        const u = clamp((this.t - H.cross.t0) / H.cross.lead, 0, 1), e = u * u * (3 - 2 * u);
        H.goal = H.cross.from + (H.cross.to - H.cross.from) * H.cross.frac * e;
      }
      if (H.cross && H.cross.done && this.t >= H.cross.until) { H.goal = H.cross.to; H.cross = null; }
      if (H.cross && H.cross.done) { const u = clamp((this.t - H.cross.p0) / H.cross.glide, 0, 1), e = u * u * (3 - 2 * u); H.goal = H.cross.g0 + (H.cross.to - H.cross.g0) * e; }
      H.base.step(H.goal, crossing ? clamp(5 + this.bpm / 9, 8, 20) : 20, dt);
      const digits = {};
      H.d.forEach((f, d) => {
        if (!f) return;
        if (f.amtGoal === 0 && f.liftDelay > 0) { f.liftDelay -= dt; if (f.liftDelay <= 0) f.liftGoal = 1; }
        f.amt = lerpExp(f.amt, f.amtGoal, f.amtGoal > f.amt ? 40 : 26, dt);
        f.lift = lerpExp(f.lift, f.liftGoal, f.liftGoal < f.lift ? (f.amtGoal === 0 && f.liftRate ? f.liftRate : 34) : 16, dt);
        // المفتاح ينزل لحظة الضغط (مع بدء الصوت)، والإصبع يبلغ سطحه خلال جزء من الثانية ويبقى عليه
        this.organ.setKeyPress(f.id, f.amt);
        if (f.amtGoal === 0 && f.liftGoal >= 1 && f.lift > 0.985 && f.amt < 0.01) { this.organ.setKeyPress(f.id, 0); H.d[d] = null; return; }   // يُحذف الإصبع المرفوع فقط، لا الإصبع الذي يتحضّر ببطء
        if (f.amtGoal === 0 && f.liftGoal === 0.25 && this.prep && ![...this.prep.values()].some((q) => q.s === s && q.d === d)) f.liftGoal = 1;
        digits[d] = { keyId: f.id, amt: f.amt, lift: f.lift, cross: f.cross || null };
      });
      st[s] = { base: H.base.x, digits, dt };
    }
    this.p.pose(st);
  }

  snapshot() {
    const out = { held: [...this.held.keys()], base: { R: +this.hand.R.base.x.toFixed(2), L: +this.hand.L.base.x.toFixed(2) }, fingers: {} };
    for (const s of ['R', 'L']) out.fingers[s] = this.hand[s].d.map((f, d) => f && { finger: d + 1, id: f.id, amt: +f.amt.toFixed(2), lift: +f.lift.toFixed(2) }).filter(Boolean);
    return out;
  }
}
