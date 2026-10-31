// sequencer.mjs — جدولة الإيقاع والمترونوم بالنظر للأمام (lookahead) على ساعة الصوت، لا على مؤقتات الصفحة.
// منفصل عن WebAudio: يأخذ دالة now() ودالة trigger(sound, time, vel)، فيُختبر في Node بساعة وهمية.
//
// قواعد مهمة:
//  • تغيير الإيقاع أثناء العزف يحدث عند بداية الدورة التالية (لا ينقطع الإيقاع في منتصفها).
//  • تغيير السرعة يطبق على الخطوة التالية مباشرة دون قفزة في الزمن.
//  • الحشوة (fill) تُعزف مرة واحدة في الدورة التالية ثم يعود النمط الأساسي.
//  • الإنهاء (ending) يكمل الدورة الحالية ثم يضرب دُمًّا/ضربة ختام على أول الدورة ويتوقف.

import { eventsOf, stepsOf } from './rhythms.mjs';

export class Sequencer {
  constructor({ now, trigger, onStep = () => {}, onState = () => {}, lookahead = 0.12 }) {
    Object.assign(this, { now, trigger, onStep, onState, lookahead });
    this.running = false; this.bpm = 100; this.rhythm = null; this.pending = null;
    this.riq = false; this.fillNext = false; this.ending = false; this.metro = { on: false, beats: 4, accent: true };
    this.step = 0; this.nextTime = 0; this.cycleVariant = 'main';
    this._cache = new Map();
  }
  _events(r, variant) {
    const key = r.id + '|' + variant + '|' + this.riq;
    if (!this._cache.has(key)) this._cache.set(key, eventsOf(r, { riq: this.riq, variant }));
    return this._cache.get(key);
  }
  clearCache() { this._cache.clear(); }
  setBpm(b) { this.bpm = Math.min(240, Math.max(30, Math.round(b))); }
  stepDur(r) { return 60 / this.bpm / (r ? r.sub : 1); }

  /** اختيار إيقاع: إن كان التشغيل جاريًا يُطبَّق مع بداية الدورة التالية. */
  setRhythm(r) {
    if (!this.running || !this.rhythm) { this.rhythm = r; this.step = 0; return; }
    if (r && this.rhythm && r.id === this.rhythm.id) return;
    this.pending = r;
  }
  start(at) {
    if (this.running) return;
    this.running = true; this.ending = false; this.fillNext = false;
    this.step = 0; this.cycleVariant = 'main';
    this.nextTime = Math.max(at || 0, this.now() + 0.05);
    this.onState('start');
  }
  stop() { if (!this.running) return; this.running = false; this.pending = null; this.ending = false; this.onState('stop'); }
  fill() { if (this.running && this.rhythm) this.fillNext = true; }
  end() { if (this.running) this.ending = true; }

  /** يُستدعى كل ~25 مللي ثانية: يجدول كل ما يقع داخل نافذة النظر للأمام. */
  tick() {
    if (!this.running) return;
    const horizon = this.now() + this.lookahead;
    let guard = 0;
    while (this.nextTime < horizon && this.running && guard++ < 512) this._scheduleStep();
  }
  _scheduleStep() {
    const t = this.nextTime;
    // المترونوم وحده (بلا إيقاع): خطوة = وحدة
    if (!this.rhythm) {
      const b = this.step % this.metro.beats;
      if (this.metro.on) this.trigger(b === 0 && this.metro.accent ? 'clickHi' : 'click', t, 1);
      this.onStep({ step: b, steps: this.metro.beats, time: t, beat: b });
      this.step++; this.nextTime += 60 / this.bpm;
      return;
    }
    const r = this.rhythm, n = stepsOf(r);
    if (this.step === 0) {
      // بداية دورة: تطبيق الإنهاء/الإيقاع المعلّق/الحشوة
      if (this.ending) {
        if (r.lanes.dt) this.trigger('dum', t, 1); else { this.trigger('kick', t, 1); this.trigger('ohat', t, 0.8); }
        this.onStep({ step: 0, steps: n, time: t, end: true });
        this.stop(); return;
      }
      if (this.pending) { this.rhythm = this.pending; this.pending = null; this.onState('changed'); return this._scheduleStep(); }
      this.cycleVariant = this.fillNext ? 'fill' : 'main';
      if (this.fillNext) { this.fillNext = false; this.onState('fill'); }
    }
    const evs = this._events(r, this.cycleVariant);
    for (const e of evs) if (e.step === this.step) this.trigger(e.sound, t, e.vel);
    if (this.metro.on && this.step % r.sub === 0) {
      const beat = this.step / r.sub;
      this.trigger(beat === 0 && this.metro.accent ? 'clickHi' : 'click', t, 0.9);
    }
    this.onStep({ step: this.step, steps: n, time: t, beat: Math.floor(this.step / r.sub), variant: this.cycleVariant });
    this.nextTime += this.stepDur(r);
    this.step = (this.step + 1) % n;
  }
}

/** نقر السرعة (Tap tempo): متوسط آخر الفواصل، ويُتجاهل فاصل أطول من ثانيتين. */
export class TapTempo {
  constructor() { this.times = []; }
  tap(t) {
    if (this.times.length && t - this.times[this.times.length - 1] > 2) this.times = [];
    this.times.push(t);
    if (this.times.length > 6) this.times.shift();
    if (this.times.length < 2) return null;
    const d = []; for (let i = 1; i < this.times.length; i++) d.push(this.times[i] - this.times[i - 1]);
    const avg = d.reduce((a, b) => a + b, 0) / d.length;
    return Math.min(240, Math.max(30, Math.round(60 / avg)));
  }
}
