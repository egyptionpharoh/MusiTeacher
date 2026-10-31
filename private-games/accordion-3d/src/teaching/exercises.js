// =====================================================================
//  التمارين: تعريفات (نغمات بالنبضات) + محرّك الدرس (عرض النموذج / تدريب الطالب بالانتظار أو بالإيقاع).
// =====================================================================
import { TREBLE, BASS, bassFor, keyByMidi, noteName, bassById } from '../instrument/accordion-data.js';

const R = (midi, t, d = 1) => ({ side: 'R', id: 'k' + midi, t, d, midi });
const Lb = (pc, kind, t, d = 1) => { const b = bassFor(pc, kind); return { side: 'L', id: b.id, t, d, label: b.label }; };
const seq = (notes, d = 1, t0 = 0) => notes.map((m, i) => R(m, t0 + i * d, d));

const SCALE_C = [60, 62, 64, 65, 67, 69, 71, 72];
const SCALE2 = [60, 62, 64, 65, 67, 69, 71, 72, 74, 76, 77, 79, 81, 83, 84];
const ODE_A = [64, 64, 65, 67, 67, 65, 64, 62, 60, 60, 62, 64];
const odeMelody = () => {
  const ev = []; let t = 0; const add = (m, d) => { ev.push(R(m, t, d)); t += d; };
  [64, 64, 65, 67, 67, 65, 64, 62, 60, 60, 62, 64].forEach((m) => add(m, 1)); add(64, 1.5); add(62, 0.5); add(62, 2);
  [64, 64, 65, 67, 67, 65, 64, 62, 60, 60, 62, 64].forEach((m) => add(m, 1)); add(62, 1.5); add(60, 0.5); add(60, 2);
  return ev;
};
const odeBass = () => {
  const ev = []; const bars = ['C', 'G', 'C', 'G', 'C', 'G', 'C', 'C'].concat(['C', 'G', 'C', 'G', 'C', 'G', 'C', 'C']).slice(0, 16);
  // نضع باص على النبضة ١ ووترًا على النبضة ٣ في كل ميزان (٤ نبضات)
  bars.forEach((c, i) => { const pc = c === 'C' ? 0 : 7; ev.push(Lb(pc, 'bass', i * 4, 2)); ev.push(Lb(pc, c === 'C' ? 'major' : 'seventh', i * 4 + 2, 2)); });
  return ev;
};
const bassPattern = (chords) => { const ev = []; chords.forEach(([pc, kind], i) => { ev.push(Lb(pc, 'bass', i * 4, 1.5)); ev.push(Lb(pc, kind, i * 4 + 2, 1.5)); }); return ev; };

export const EXERCISES = [
  { id: 'rec-white', level: 1, kind: 'recognize', title: 'تعرّف المفاتيح البيضاء', desc: 'يُعرض اسم نغمة ويُطلب منك الضغط على مفتاحها الأبيض.', hand: 'R', range: [60, 83], black: false, count: 10 },
  { id: 'five', level: 1, kind: 'sequence', title: 'وضع الخمس نغمات (دو–صول)', desc: 'خمس نغمات متتابعة بالأصابع ١–٥ ثم نزولًا.', hand: 'R', events: seq([60, 62, 64, 65, 67, 65, 64, 62, 60], 1), bpm: 70 },
  { id: 'scale-c', level: 1, kind: 'sequence', title: 'سلّم دو الكبير', desc: 'ثماني نغمات صعودًا ونزولًا باليد اليمنى.', hand: 'R', events: seq([...SCALE_C, ...SCALE_C.slice(0, -1).reverse()], 1), bpm: 76 },
  { id: 'bass-c', level: 1, kind: 'sequence', title: 'باص ووتر دو', desc: 'اليد اليسرى: باص دو ثم وتر دو الكبير، ثم صول.', hand: 'L', events: bassPattern([[0, 'major'], [0, 'major'], [7, 'seventh'], [0, 'major']]), bpm: 60 },
  { id: 'rec-all', level: 2, kind: 'recognize', title: 'تعرّف المفاتيح البيضاء والسوداء', desc: 'يشمل المفاتيح المحوّلة (♯).', hand: 'R', range: [58, 84], black: true, count: 12 },
  { id: 'arp', level: 2, kind: 'sequence', title: 'أرپيج دو الكبير', desc: 'دو–مي–صول–دو صعودًا ونزولًا.', hand: 'R', events: seq([60, 64, 67, 72, 67, 64, 60, 64, 67, 72, 76, 79, 84, 79, 76, 72], 1), bpm: 84 },
  { id: 'ode-r', level: 2, kind: 'sequence', title: 'نشيد الفرح (اللحن)', desc: 'لحن بيتهوفن باليد اليمنى.', hand: 'R', events: odeMelody(), bpm: 84 },
  { id: 'bass-prog', level: 2, kind: 'sequence', title: 'الباص والمصاحبة: دو–صول٧–دو–فا', desc: 'نمط «باص ثم وتر» في أربع موازين.', hand: 'L', events: bassPattern([[0, 'major'], [7, 'seventh'], [0, 'major'], [5, 'major'], [7, 'seventh'], [0, 'major']]), bpm: 66 },
  { id: 'ode-2h', level: 3, kind: 'sequence', title: 'نشيد الفرح بيدين', desc: 'اللحن باليمنى والباص ثم الوتر باليسرى.', hand: 'B', events: [...odeMelody(), ...odeBass()].sort((a, b) => a.t - b.t || (a.side === 'L' ? -1 : 1)), bpm: 72 },
  { id: 'scale2', level: 3, kind: 'sequence', title: 'سلّم دو بأوكتافين', desc: 'مدّ اليد وانتقال الأصابع على مدى أوكتافين.', hand: 'R', events: seq([...SCALE2, ...SCALE2.slice(0, -1).reverse()], 0.5), bpm: 96 },
];
export const LEVEL_AR = { 1: 'مبتدئ', 2: 'متوسط', 3: 'متقدم' };

// =====================================================================
export class Lesson {
  constructor(perf, ui) {
    this.perf = perf; this.ui = ui; this.ex = null; this.mode = 'idle';           // idle | demo | practice
    this.opts = { bpm: 72, wait: true, hints: true, speed: 1 };
    this.timers = []; this.score = { ok: 0, bad: 0, total: 0 }; this.idx = 0;
    perf.onEventUser = null;
  }
  get bpm() { return this.opts.bpm * this.opts.speed; }
  beat() { return 60 / this.bpm; }
  clearTimers() { this.timers.forEach(clearTimeout); this.timers = []; }
  stop() { this.clearTimers(); this.mode = 'idle'; this.perf.releaseAll(); this.setLit([]); this.ui.onLesson && this.ui.onLesson({ type: 'stop' }); this.rec = null; }
  setLit(items) { this.ui.setLit(items); }

  load(ex) { this.stop(); this.ex = ex; this.opts.bpm = ex.bpm || 72; this.score = { ok: 0, bad: 0, total: 0 }; this.ui.onLesson && this.ui.onLesson({ type: 'load', ex }); }

  // ---------- عرض النموذج ----------
  demo() {
    const ex = this.ex; if (!ex || !ex.events) return; this.stop(); this.mode = 'demo';
    const b = this.beat(), P = this.perf; let tEnd = 0;
    const human = () => (Math.random() - 0.5) * 0.012;                // تنويع بشري دقيق في التوقيت
    for (const e of ex.events) {
      const t0 = Math.max(0, e.t * b * 1000 + human() * 1000), tOff = t0 + Math.max(60, e.d * b * 1000 * (0.9 - Math.random() * 0.05));
      this.timers.push(setTimeout(() => { if (this.mode === 'demo') P.prepare(e.side, e.id); }, Math.max(0, t0 - 110)));
      this.timers.push(setTimeout(() => { if (this.mode === 'demo') { P.press(e.side, e.id, 0.62 + Math.random() * 0.18); this.setLit([{ id: e.id, side: e.side, color: 'demo' }]); } }, t0));
      this.timers.push(setTimeout(() => { P.release(e.id); }, tOff));
      tEnd = Math.max(tEnd, tOff);
    }
    this.timers.push(setTimeout(() => { this.mode = 'idle'; this.setLit([]); this.ui.onLesson && this.ui.onLesson({ type: 'demo-end' }); }, tEnd + 400));
    this.ui.onLesson && this.ui.onLesson({ type: 'demo-start' });
  }

  // ---------- تدريب الطالب ----------
  practice() {
    const ex = this.ex; if (!ex) return; this.stop(); this.mode = 'practice'; this.idx = 0; this.score = { ok: 0, bad: 0, total: 0 };
    if (ex.kind === 'recognize') { this.questions = this.makeQuestions(ex); this.score.total = this.questions.length; this.showQuestion(); }
    else {
      // نجمّع الأحداث المتزامنة (يدان) في خطوات
      this.steps = []; let last = null;
      for (const e of ex.events) { if (last && Math.abs(last.t - e.t) < 1e-6) last.items.push(e); else { last = { t: e.t, items: [e] }; this.steps.push(last); } }
      this.score.total = ex.events.length; this.pressedNow = new Set();
      if (this.opts.wait) this.showStep(); else this.runTimed();
    }
    this.ui.onLesson && this.ui.onLesson({ type: 'practice-start' });
  }
  makeQuestions(ex) {
    const pool = TREBLE.filter((k) => k.midi >= ex.range[0] && k.midi <= ex.range[1] && (ex.black || !k.black)); const q = []; let prev = -1;
    for (let i = 0; i < ex.count; i++) { let k; do { k = pool[Math.floor(Math.random() * pool.length)]; } while (k.midi === prev && pool.length > 1); prev = k.midi; q.push(k); }
    return q;
  }
  showQuestion() {
    const k = this.questions[this.idx]; if (!k) return this.finish();
    this.setLit([]); this.ui.onLesson && this.ui.onLesson({ type: 'question', text: `اضغط مفتاح: ${noteName(k.midi)}`, i: this.idx + 1, n: this.questions.length, target: k });
  }
  showStep() {
    const s = this.steps[this.idx]; if (!s) return this.finish();
    this.need = new Set(s.items.map((e) => e.id));
    this.setLit(this.opts.hints ? s.items.map((e) => ({ id: e.id, side: e.side, color: 'hint' })) : []);
    this.ui.onLesson && this.ui.onLesson({ type: 'step', i: this.idx + 1, n: this.steps.length, items: s.items });
  }
  runTimed() {
    // وضع الإيقاع: الخطوات تظهر في أوقاتها، والتقييم بنافذة سماح
    const b = this.beat(); this.timedHits = new Map();
    this.steps.forEach((s, i) => {
      this.timers.push(setTimeout(() => { if (this.mode !== 'practice') return; this.idx = i; this.need = new Set(s.items.map((e) => e.id)); this.hit = new Set();
        this.setLit(this.opts.hints ? s.items.map((e) => ({ id: e.id, side: e.side, color: 'hint' })) : []); this.ui.onLesson && this.ui.onLesson({ type: 'step', i: i + 1, n: this.steps.length, items: s.items });
        s.missAt = performance.now() + Math.max(450, b * 1000 * 0.9); }, s.t * b * 1000));
    });
    const last = this.steps[this.steps.length - 1];
    this.timers.push(setTimeout(() => this.finish(), (last.t + 2) * b * 1000));
  }
  /** تُستدعى من الواجهة عند ضغط الطالب مفتاحًا/زرًا */
  onUserPress(side, id) {
    if (this.mode !== 'practice' || !this.ex) return;
    if (this.ex.kind === 'recognize') {
      const k = this.questions[this.idx]; if (!k) return;
      if (side === 'R' && id === k.id) { this.score.ok++; this.ui.onLesson({ type: 'feedback', ok: true, text: 'أحسنت! ✔' }); this.idx++; setTimeout(() => this.showQuestion(), 650); }
      else { this.score.bad++; this.ui.onLesson({ type: 'feedback', ok: false, text: 'ليس هذا المفتاح، جرّب مرة أخرى' }); this.setLit([{ id: k.id, side: 'R', color: 'hint', pulse: true }]); setTimeout(() => this.setLit([]), 700); }
      return;
    }
    if (!this.need) return;
    if (this.need.has(id)) {
      this.need.delete(id); this.score.ok++;
      this.setLit(this.opts.hints ? [...this.need].map((n) => ({ id: n, side: bassById[n] ? 'L' : 'R', color: 'hint' })) : []);
      if (this.need.size === 0) { this.ui.onLesson({ type: 'feedback', ok: true, text: '✔' }); this.idx++; if (this.opts.wait) setTimeout(() => this.showStep(), 160); }
    } else { this.score.bad++; this.ui.onLesson({ type: 'feedback', ok: false, text: 'نغمة غير مطلوبة الآن' }); }
  }
  finish() {
    const s = this.score, pct = s.ok + s.bad ? Math.round(100 * s.ok / (s.ok + s.bad)) : 0;
    this.mode = 'idle'; this.clearTimers(); this.setLit([]);
    this.ui.onLesson && this.ui.onLesson({ type: 'done', ok: s.ok, bad: s.bad, pct });
  }
}
