// =====================================================================
//  التمارين: تعريفات (نغمة، زمن بالنبضات، مدة، اليد، رقم الإصبع) + محرّك الدرس (عرض النموذج / تدريب الطالب).
//  مبنية على كتاب الصف الرابع (آلة الأورج): مكان نغمة دو، الخمس نغمات الأولى من سلم دو الكبير بترقيم الأصابع ١–٥،
//  سلم دو الكبير في طبقات مختلفة، ثم ألحان بسيطة من التراث العالمي العام (نشيد الفرح لبيتهوفن، تلألئي يا نجمة).
//  ترقيم الأصابع: ١ الإبهام … ٥ الخنصر، لكل يد.
// =====================================================================
import { KEYS, keyByMidi, noteName, pc } from '../instrument/organ-data.js';

const ev = (midi, t, d, hand, f) => ({ id: 'k' + midi, midi, t, d, hand, f });
// تتابع نغمات بيد واحدة وأصابع محددة
const line = (hand, notes, fingers, d = 1, t0 = 0) => notes.map((m, i) => ev(m, t0 + i * d, d, hand, fingers[i]));
// لحن بمُدد مختلفة: [[midi, مدة, إصبع], ...]
const melody = (hand, arr, t0 = 0) => { const out = []; let t = t0; for (const [m, d, f] of arr) { if (m) out.push(ev(m, t, d, hand, f)); t += d; } return out; };
const sortEv = (a) => a.sort((x, y) => x.t - y.t || (x.hand === 'L' ? -1 : 1));

const C4 = 60, C3 = 48;
const FIVE_R = [60, 62, 64, 65, 67], FIVE_L = [48, 50, 52, 53, 55];
const SCALE_R = [60, 62, 64, 65, 67, 69, 71, 72], SCALE_L = [48, 50, 52, 53, 55, 57, 59, 60];
// ترقيم السلم الأكاديمي (كتب المنهج تعطي الخمس نغمات الأولى فقط بالأصابع ١–٥؛ أما السلم الكامل فبالترقيم المعتمد في تعليم البيانو):
//  اليمنى صعودًا 1 2 3 | 1 2 3 4 5 (الإبهام يعبر تحت الإصبع ٣ إلى فا)، نزولًا 5 4 3 2 1 | 3 2 1 (الإصبع ٣ يعبر فوق الإبهام إلى مي)
//  اليسرى صعودًا 5 4 3 2 1 | 3 2 1 (الإصبع ٣ يعبر فوق الإبهام إلى لا)، نزولًا 1 2 3 | 1 2 3 4 5 (الإبهام يعبر تحت الإصبع ٣ إلى صول)
const F_SCALE_R_UP = [1, 2, 3, 1, 2, 3, 4, 5], F_SCALE_R_DN = [4, 3, 2, 1, 3, 2, 1];
const F_SCALE_L_UP = [5, 4, 3, 2, 1, 3, 2, 1], F_SCALE_L_DN = [2, 3, 1, 2, 3, 4, 5];
// سلم كامل في أربع مازورات ٤/٤: ثماني نغمات صعودًا ثم سبع نزولًا والأخيرة بيضاء (نغمة القرار ممدودة)
const scaleLine = (hand, notes, fUp, fDn) => [...line(hand, notes, fUp, 1), ...notes.slice(0, -1).reverse().map((m, i) => ev(m, 8 + i, i === 6 ? 2 : 1, hand, fDn[i]))];
// الخمس نغمات صعودًا ونزولًا كما في الكتاب، في ثلاث مازورات والأخيرة مستديرة
const fiveLine = (hand, notes, f) => [...notes, ...notes.slice(0, -1).reverse()].map((m, i) => ev(m, i, i === 8 ? 4 : 1, hand, f[i]));

// نشيد الفرح (بيتهوفن، 1824 — ملكية عامة) في وضع الخمس نغمات: كل نغمة بإصبعها
const FR = { 60: 1, 62: 2, 64: 3, 65: 4, 67: 5 };
const odeR = () => {
  const A = [64, 64, 65, 67, 67, 65, 64, 62, 60, 60, 62, 64];
  const arr = [];
  for (const m of A) arr.push([m, 1, FR[m]]); arr.push([64, 1.5, 3], [62, 0.5, 2], [62, 2, 2]);
  for (const m of A) arr.push([m, 1, FR[m]]); arr.push([62, 1.5, 2], [60, 0.5, 1], [60, 2, 1]);
  return melody('R', arr);
};
// باص اليد اليسرى للنشيد: دو٣ وصول٢… نغمة ممدودة في أول كل مازورة (٤ نبضات)
const odeL = () => {
  const bars = [[48, 1], [43, 5], [48, 1], [43, 5], [48, 1], [43, 5], [48, 1], [48, 1], [48, 1], [43, 5], [48, 1], [43, 5], [48, 1], [43, 5], [48, 1], [48, 1]];
  // اليد اليسرى في وضع فا٢–دو٣: دو٣ بالإبهام (١) وصول٢ بالبنصر (٤)
  return bars.map(([m], i) => ev(m, i * 4, 3.5, 'L', m === 48 ? 1 : 4));
};
// تلألئي يا نجمة (لحن فرنسي من القرن الثامن عشر «Ah! vous dirai-je, maman» — ملكية عامة)
const TW = [[60, 1], [60, 1], [67, 1], [67, 1], [69, 1], [69, 1], [67, 2], [65, 1], [65, 1], [64, 1], [64, 1], [62, 1], [62, 1], [60, 2],
  [67, 1], [67, 1], [65, 1], [65, 1], [64, 1], [64, 1], [62, 2], [67, 1], [67, 1], [65, 1], [65, 1], [64, 1], [64, 1], [62, 2],
  [60, 1], [60, 1], [67, 1], [67, 1], [69, 1], [69, 1], [67, 2], [65, 1], [65, 1], [64, 1], [64, 1], [62, 1], [62, 1], [60, 2]];
const FT = { 60: 1, 62: 2, 64: 3, 65: 4, 67: 5, 69: 5 };
const twinkleR = () => {
  // اليد في وضع دو: لا (69) تُعزف بالخنصر بعد انتقال صغير، ثم تعود
  const arr = TW.map(([m, d]) => [m, d, FT[m]]);
  return melody('R', arr);
};
const twinkleL = () => {
  // مصاحبة بسيطة: نغمة جذر كل مازورة (دو٣/فا٢/صول٢) بأصابع ثابتة
  const roots = [48, 53, 48, 43, 48, 43, 48, 43, 48, 53, 48, 43];   // 12 مازورة × 4 نبضات (مازورة = نصف سطر)
  const fin = { 48: 1, 43: 4, 41: 5 };       // وضع فا٢–دو٣: دو٣ بالإبهام، صول٢ بالبنصر، فا٢ بالخنصر
  return roots.map((m, i) => { const n = m === 53 ? 41 : m; return ev(n, i * 4, 3.6, 'L', fin[n]); });
};
// تدريب إيقاعي باليمنى: نوار وبلانش وكروش على الخمس نغمات (أشكال إيقاعية من المنهج)
const rhythmR = () => melody('R', [
  [60, 1, 1], [60, 1, 1], [60, 2, 1], [62, 1, 2], [62, 1, 2], [62, 2, 2], [64, 0.5, 3], [64, 0.5, 3], [64, 1, 3], [65, 0.5, 4], [65, 0.5, 4], [65, 1, 4],
  [67, 1, 5], [65, 1, 4], [64, 1, 3], [62, 1, 2], [60, 4, 1]]);

export const EXERCISES = [
  // ---------- مبتدئ ----------
  { id: 'find-c', level: 1, kind: 'recognize', title: 'أين نغمة دو؟', desc: 'نغمة دو هي المفتاح الأبيض يسار المفتاحين الأسودين. اضغط أي نغمة دو في أي طبقة.', anyPc: 0, count: 6 },
  { id: 'rec-white', level: 1, kind: 'recognize', title: 'تعرّف النغمات البيضاء', desc: 'يظهر اسم نغمة، فاضغط مفتاحها الأبيض في الطبقة الوسطى (دو٤ إلى سي٤).', range: [60, 71], black: false, count: 10 },
  { id: 'five-r', level: 1, kind: 'sequence', title: 'الخمس نغمات الأولى — اليد اليمنى', desc: 'دو ري مي فا صول بالأصابع ١ ٢ ٣ ٤ ٥ (الإبهام على دو الوسطى) ثم نزولًا.', hands: 'R',
    events: fiveLine('R', FIVE_R, [1, 2, 3, 4, 5, 4, 3, 2, 1]), bpm: 66, start: { R: 14 }, src: 'دليل المعلم — الصف الرابع (آلة الأورج) والصف الخامس' },
  { id: 'five-l', level: 1, kind: 'sequence', title: 'الخمس نغمات الأولى — اليد اليسرى', desc: 'دو٣ ري مي فا صول بالأصابع ٥ ٤ ٣ ٢ ١ (الخنصر على دو) ثم نزولًا.', hands: 'L',
    events: fiveLine('L', FIVE_L, [5, 4, 3, 2, 1, 2, 3, 4, 5]), bpm: 66, start: { L: 11 } },
  { id: 'scale-r', level: 1, kind: 'sequence', title: 'سلّم دو الكبير — اليد اليمنى', desc: 'صعودًا ١ ٢ ٣ ثم يعبر الإبهام تحت الإصبع ٣ إلى فا: ١ ٢ ٣ ٤ ٥. نزولًا ٥ ٤ ٣ ٢ ١ ثم يعبر الإصبع ٣ فوق الإبهام إلى مي: ٣ ٢ ١. شاهد اليد بسرعة بطيئة أولًا.', hands: 'R',
    events: scaleLine('R', SCALE_R, F_SCALE_R_UP, F_SCALE_R_DN), bpm: 60, start: { R: 14 } },
  // ---------- متوسط ----------
  { id: 'scale-l', level: 2, kind: 'sequence', title: 'سلّم دو الكبير — اليد اليسرى', desc: 'صعودًا ٥ ٤ ٣ ٢ ١ ثم يعبر الإصبع ٣ فوق الإبهام إلى لا: ٣ ٢ ١. نزولًا ١ ٢ ٣ ثم يعبر الإبهام تحت الإصبع ٣ إلى صول: ١ ٢ ٣ ٤ ٥.', hands: 'L',
    events: scaleLine('L', SCALE_L, F_SCALE_L_UP, F_SCALE_L_DN), bpm: 60, start: { L: 11, R: 19 } },   // اليمنى تستريح أعلى قليلًا فلا تزاحم إبهام اليسرى عند دو٤
  { id: 'five-both', level: 2, kind: 'sequence', title: 'الخمس نغمات باليدين معًا', desc: 'اليدان معًا بفارق طبقة: اليسرى على دو٣ واليمنى على دو٤، صعودًا ثم نزولًا.', hands: 'B',
    events: sortEv([...fiveLine('R', FIVE_R, [1, 2, 3, 4, 5, 4, 3, 2, 1]), ...fiveLine('L', FIVE_L, [5, 4, 3, 2, 1, 2, 3, 4, 5])]), bpm: 60, start: { R: 14, L: 11 } },
  { id: 'rec-all', level: 2, kind: 'recognize', title: 'تعرّف البيض والسود', desc: 'يشمل النغمات المحوّلة (♯) في الطبقة الوسطى.', range: [60, 71], black: true, count: 12 },
  { id: 'rhythm-r', level: 2, kind: 'sequence', title: 'تدريب إيقاعي (نوار، بلانش، كروش)', desc: 'الخمس نغمات بأشكال إيقاعية مختلفة. استعمل الإيقاع (أوقف انتظار الطالب) وشغّل المترونوم.', hands: 'R', events: rhythmR(), bpm: 72, start: { R: 14 } },
  { id: 'twinkle-r', level: 2, kind: 'sequence', title: 'لحن «تلألئي يا نجمة»', desc: 'لحن شعبي فرنسي قديم (ملكية عامة) باليد اليمنى في وضع دو.', hands: 'R', events: twinkleR(), bpm: 84, start: { R: 14 } },
  // ---------- متقدم ----------
  { id: 'ode-r', level: 3, kind: 'sequence', title: 'نشيد الفرح (بيتهوفن) — اللحن', desc: 'اللحن كاملًا باليد اليمنى في وضع الخمس نغمات.', hands: 'R', events: odeR(), bpm: 84, start: { R: 14 } },
  { id: 'ode-2h', level: 3, kind: 'sequence', title: 'نشيد الفرح باليدين', desc: 'اللحن باليمنى، ونغمة الباص في أول كل مازورة باليسرى.', hands: 'B', events: sortEv([...odeR(), ...odeL()]), bpm: 76, start: { R: 14, L: 7 } },
  { id: 'twinkle-2h', level: 3, kind: 'sequence', title: '«تلألئي يا نجمة» باليدين', desc: 'اللحن باليمنى ومصاحبة الجذور باليسرى.', hands: 'B', events: sortEv([...twinkleR(), ...twinkleL()]), bpm: 80, start: { R: 14, L: 7 } },
  { id: 'scale-2h', level: 3, kind: 'sequence', title: 'سلّم دو الكبير باليدين معًا', desc: 'اليدان معًا بفارق طبقة، كل يد بترقيم أصابعها الخاص.', hands: 'B',
    events: sortEv([...scaleLine('R', SCALE_R, F_SCALE_R_UP, F_SCALE_R_DN), ...scaleLine('L', SCALE_L, F_SCALE_L_UP, F_SCALE_L_DN)]), bpm: 54, start: { R: 14, L: 11 } },
];
export const LEVEL_AR = { 1: 'مبتدئ', 2: 'متوسط', 3: 'متقدم' };

// =====================================================================
export class Lesson {
  constructor(perf, ui) {
    this.perf = perf; this.ui = ui; this.ex = null; this.mode = 'idle';           // idle | demo | practice
    this.opts = { bpm: 72, wait: true, hints: true, fingers: true, metronome: false, loop: false };
    this.timers = []; this.score = { ok: 0, bad: 0, total: 0 }; this.idx = 0;
  }
  beat() { return 60 / this.opts.bpm; }
  emit(e) { this.ui.onLesson && this.ui.onLesson(e); }
  clearTimers() { this.timers.forEach(clearTimeout); this.timers = []; }
  stop() { this.clearTimers(); this.mode = 'idle'; this.perf.releaseAll(); this.ui.setLit([]); this.emit({ type: 'stop' }); }
  load(ex) { this.stop(); this.ex = ex; this.opts.bpm = ex.bpm || 72; this.score = { ok: 0, bad: 0, total: 0 }; this.placeHands(); this.emit({ type: 'load', ex }); }
  placeHands() { const s = this.ex && this.ex.start; if (!s) return; for (const h of ['R', 'L']) if (s[h] != null) this.perf.placeHand(h, s[h]); }
  metronome(nBeats, t0ms = 0) {
    if (!this.opts.metronome || !this.perf.audio || !this.perf.audio.click) return;
    const b = this.beat() * 1000;
    for (let i = 0; i < nBeats; i++) this.timers.push(setTimeout(() => { if (this.mode !== 'idle') this.perf.audio.click(i % 4 === 0); }, t0ms + i * b));
  }

  // ---------- عرض النموذج: العازف يؤدي التمرين بالأصابع الصحيحة ----------
  /** يحدد لكل نغمة إن كانت «عبورًا» (الإبهام تحت الأصابع أو إصبع فوق الإبهام) بمحاكاة موضع اليد كما يحسبه المؤدي. */
  crossPlan(events) {
    const keys = this.perf.organ.keys, goal = { R: null, L: null }, prev = { R: null, L: null }, out = new Map();
    for (const e of events) {
      const k = keys[e.id], dir = e.hand === 'L' ? -1 : 1; if (!k || !e.f) continue;
      const g = k.slotEff - dir * (e.f - 1), g0 = goal[e.hand], p = prev[e.hand];
      if (g0 != null && p) {
        const delta = dir * (g - g0);
        if (e.f === 1 && delta >= 1.5) out.set(e, { kind: 'under', pivot: p });
        else if (e.f > 1 && delta <= -1.5 && p.f === 1) out.set(e, { kind: 'over', pivot: p });
      }
      goal[e.hand] = g; prev[e.hand] = e;
    }
    return out;
  }
  demo(again = false) {
    const ex = this.ex; if (!ex || !ex.events) return;
    if (again) { this.clearTimers(); this.perf.releaseAll(); } else this.stop();
    this.mode = 'demo'; this.placeHands();
    const b = this.beat(), P = this.perf, lead = 900; let tEnd = 0;          // مهلة قصيرة قبل البدء تتحرك فيها اليدان إلى مكانهما
    P.bpm = this.opts.bpm;
    const human = () => (Math.random() - 0.5) * 0.012;
    this.metronome(Math.ceil(Math.max(...ex.events.map((e) => e.t + e.d))) + 1, lead - this.beat() * 1000 * 0);
    // عبور الأصابع: الإصبع العابر يبدأ حركته مبكرًا (بعد بداية النغمة السابقة بقليل) فيعبر بانسياب أثناءها،
    // والإصبع المحوري (٣ على مي مثلًا) لا يُرفع حتى يستقر الإبهام على مفتاحه (عزف متصل legato).
    const plan = this.crossPlan(ex.events), T0 = new Map(), pivotOff = new Map();
    for (const e of ex.events) T0.set(e, lead + Math.max(0, e.t * b * 1000 + human() * 1000));
    for (const [e, c] of plan) pivotOff.set(c.pivot, T0.get(e) + Math.min(60, b * 1000 * 0.08));
    const TOFF = new Map();
    for (const e of ex.events) TOFF.set(e, pivotOff.has(e) ? pivotOff.get(e) : T0.get(e) + Math.max(70, e.d * b * 1000 * (0.93 - Math.random() * 0.03)));
    // توقيت بدء العبور (ABRSM: «بمجرد عزف دو، وأثناء عزف ري ومي، يتحرك الإبهام في مسار ناعم نحو فا»):
    //  • تحت: يبدأ الإبهام رحلته فور رفعه عن نغمته السابقة (دو) — أي أثناء الإصبعين ٢ و٣ — لا بعد عزف مي.
    //  • فوق: يبدأ الإصبع ٣ بالمرور فوق الإبهام بعد أن يعزف الإبهام نغمته بقليل، فيصل في وقته دون اندفاع.
    const prevThumb = (e) => { let r = null; for (const x of ex.events) { if (x === e) break; if (x.hand === e.hand && x.f === 1 && x.t < e.t) r = x; } return r; };
    for (const e of ex.events) {
      const t0 = T0.get(e), c = plan.get(e), tOff = TOFF.get(e);
      let prepAt = t0 - 120;
      if (c && c.kind === 'under') { const pt = prevThumb(e); prepAt = pt && pt !== c.pivot ? Math.min(TOFF.get(pt) + 40, t0 - 150) : T0.get(c.pivot) + 0.2 * (t0 - T0.get(c.pivot)); }
      else if (c) prepAt = T0.get(c.pivot) + 0.18 * (t0 - T0.get(c.pivot));
      const leadS = (t0 - prepAt) / 1000;
      this.timers.push(setTimeout(() => { if (this.mode === 'demo') P.prepare(e.id, { hand: e.hand, finger: e.f, lead: leadS }); }, Math.max(0, prepAt)));
      this.timers.push(setTimeout(() => { if (this.mode !== 'demo') return; P.press(e.id, 0.62 + Math.random() * 0.18, { hand: e.hand, finger: e.f }); this.ui.lit(e, 'demo', true); this.emit({ type: 'demo-note', e }); }, t0));
      this.timers.push(setTimeout(() => { P.release(e.id); this.ui.lit(e, 'demo', false); }, tOff));
      tEnd = Math.max(tEnd, tOff);
    }
    this.timers.push(setTimeout(() => {
      // تكرار النموذج: يبدأ من جديد بعد نَفَس قصير (نبضة واحدة) دون أن تقفز اليد، فتُشاهَد تقنية العبور مرات متتالية
      if (this.opts.loop && this.mode === 'demo') { this.ui.setLit([]); this.emit({ type: 'demo-end', again: true }); this.timers.push(setTimeout(() => { if (this.mode === 'demo') this.demo(true); }, Math.max(250, b * 1000 - 400))); return; }
      this.mode = 'idle'; this.ui.setLit([]); this.emit({ type: 'demo-end' });
    }, tEnd + 400));
    this.emit({ type: 'demo-start' });
  }

  // ---------- تدريب الطالب ----------
  practice() {
    const ex = this.ex; if (!ex) return; this.stop(); this.mode = 'practice'; this.perf.bpm = this.opts.bpm; this.idx = 0; this.score = { ok: 0, bad: 0, total: 0 }; this.placeHands();
    if (ex.kind === 'recognize') { this.questions = this.makeQuestions(ex); this.score.total = this.questions.length; this.showQuestion(); }
    else {
      this.steps = []; let last = null;
      for (const e of ex.events) { if (last && Math.abs(last.t - e.t) < 1e-6) last.items.push(e); else { last = { t: e.t, items: [e] }; this.steps.push(last); } }
      this.score.total = ex.events.length;
      if (this.opts.wait) this.showStep(); else this.runTimed();
    }
    this.emit({ type: 'practice-start' });
  }
  makeQuestions(ex) {
    if (ex.anyPc != null) return Array.from({ length: ex.count }, () => ({ anyPc: ex.anyPc }));
    const pool = KEYS.filter((k) => k.midi >= ex.range[0] && k.midi <= ex.range[1] && (ex.black || !k.black)); const q = []; let prev = -1;
    for (let i = 0; i < ex.count; i++) { let k; do { k = pool[Math.floor(Math.random() * pool.length)]; } while (k.midi === prev && pool.length > 1); prev = k.midi; q.push(k); }
    return q;
  }
  showQuestion() {
    const k = this.questions[this.idx]; if (!k) return this.finish();
    this.ui.setLit([]);
    const text = k.anyPc != null ? `اضغط أي نغمة ${noteName(k.anyPc)} على لوحة المفاتيح` : `اضغط مفتاح: ${noteName(k.midi)}`;
    this.emit({ type: 'question', text, i: this.idx + 1, n: this.questions.length, target: k });
  }
  showStep() {
    const s = this.steps[this.idx]; if (!s) return this.finish();
    this.need = new Set(s.items.map((e) => e.id)); this.got = new Set();
    this.ui.setLit(this.opts.hints ? s.items.map((e) => ({ ...e, color: 'hint' })) : []);
    this.emit({ type: 'step', i: this.idx + 1, n: this.steps.length, items: s.items });
  }
  runTimed() {
    const b = this.beat(), lead = 1200;
    const last = this.steps[this.steps.length - 1];
    this.metronome(Math.ceil(last.t) + 3, lead - 2 * b * 1000 > 0 ? lead - 2 * b * 1000 : 0);
    this.steps.forEach((s, i) => {
      this.timers.push(setTimeout(() => {
        if (this.mode !== 'practice') return;
        // ما لم يُضغط من الخطوة السابقة يُحسب خطأً
        if (this.need && this.need.size) { this.score.bad += this.need.size; this.emit({ type: 'feedback', ok: false, text: 'فاتتك نغمة' }); }
        this.idx = i; this.need = new Set(s.items.map((e) => e.id)); this.got = new Set();
        this.ui.setLit(this.opts.hints ? s.items.map((e) => ({ ...e, color: 'hint' })) : []); this.emit({ type: 'step', i: i + 1, n: this.steps.length, items: s.items });
      }, lead + s.t * b * 1000));
    });
    this.timers.push(setTimeout(() => { if (this.need && this.need.size) this.score.bad += this.need.size; this.need = null; this.finish(); }, lead + (last.t + last.items[0].d + 0.5) * b * 1000));
  }
  /** من الواجهة عند ضغط الطالب مفتاحًا */
  onUserPress(id) {
    if (this.mode !== 'practice' || !this.ex) return;
    const midi = +id.slice(1);
    if (this.ex.kind === 'recognize') {
      const k = this.questions[this.idx]; if (!k) return;
      const ok = k.anyPc != null ? pc(midi) === k.anyPc : id === k.id;
      if (ok) { this.score.ok++; this.emit({ type: 'feedback', ok: true, text: k.anyPc != null ? `أحسنت! هذه ${noteName(midi, 'ar', true)} ✔` : 'أحسنت! ✔' }); this.idx++; setTimeout(() => this.showQuestion(), 650); }
      else {
        this.score.bad++; this.emit({ type: 'feedback', ok: false, text: `هذه ${noteName(midi)} — جرّب مرة أخرى` });
        const hint = k.anyPc != null ? KEYS.filter((x) => pc(x.midi) === k.anyPc).map((x) => ({ id: x.id, color: 'hint' })) : [{ id: k.id, color: 'hint' }];
        this.ui.setLit(hint); setTimeout(() => this.mode === 'practice' && this.ui.setLit([]), 900);
      }
      return;
    }
    if (!this.need) return;
    if (this.need.has(id)) {
      this.need.delete(id); this.got.add(id); this.score.ok++;
      this.ui.lit({ id }, 'hint', false);
      if (!this.need.size) { this.emit({ type: 'feedback', ok: true, text: '✔' }); if (this.opts.wait) { this.idx++; setTimeout(() => this.mode === 'practice' && this.showStep(), 120); } }
    } else if (!this.got.has(id)) { this.score.bad++; this.emit({ type: 'feedback', ok: false, text: `خطأ: ${noteName(midi)}` }); }
  }
  finish() {
    if (this.mode !== 'practice') return;
    this.mode = 'idle'; this.ui.setLit([]);
    const tot = Math.max(1, this.score.ok + this.score.bad), pct = Math.round(100 * this.score.ok / tot);
    this.emit({ type: 'done', ok: this.score.ok, bad: this.score.bad, pct });
  }
}
