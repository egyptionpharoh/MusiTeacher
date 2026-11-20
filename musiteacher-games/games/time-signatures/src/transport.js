// =====================================================================
//  ناقل الزمن: موضع الحركة بالنبضات محسوبًا من ساعة الصوت نفسها (نقية، تُختبر في Node بساعة وهمية).
//   pos = 0 إكتوس النبضة الأولى، 1 الثانية… ؛ pos = −1 وضعية الاستعداد (اليد عند إكتوس الضربة الأخيرة)،
//   والمقطع −1..0 هو ضربة التحضير (ارتداد الضربة الأخيرة الذي يقود إلى الأولى) بلا نقرة.
//   tempo: مدة النبضة بالثواني (البطء = الحركة نفسها بمدة أطول، لا حركة مختلفة).
// =====================================================================
export class Transport {
  constructor(clock) { this.clock = clock; this.playing = false; this.held = -1; this.dur = 1; this.t0 = 0; this.stopAt = null; this.nextBeat = 0; this.onPause = null; }

  /** يبدأ من وضعية الاستعداد: ضربة تحضير (نبضة واحدة) ثم النبضة الأولى. lead: مهلة الجدولة الأولى */
  start(dur, { from = -1, stopAt = null, lead = 0.12 } = {}) {
    this.dur = dur; this.t0 = this.clock() + lead - from * dur;
    this.playing = true; this.stopAt = stopAt; this.nextBeat = Math.max(0, Math.ceil(from - 1e-9));
    if (from > -1 + 1e-9 && Math.abs(from - Math.round(from)) < 1e-9) this.nextBeat = Math.round(from) + 1;   // الاستئناف من إكتوس: نقرته سُمعت
  }
  /** نبضة واحدة من الموضع الحالي إلى الإكتوس التالي (عرض «خطوة بخطوة») */
  step(dur) { const from = this.playing ? this.pos() : this.held; const to = Math.floor(from + 1e-9) + 1; this.start(dur, { from, stopAt: to, lead: 0.05 }); }
  /** تشغيل حتى إكتوس معيّن ثم توقف (التمارين) */
  runTo(dur, k) { this.start(dur, { from: this.playing ? this.pos() : this.held, stopAt: k }); }

  pos(t = this.clock()) {
    if (!this.playing) return this.held;
    let p = (t - this.t0) / this.dur;
    if (p < -1) p = -1;
    if (this.stopAt != null && p >= this.stopAt) { p = this.stopAt; this.playing = false; this.held = p; this.stopAt = null; if (this.onPause) this.onPause(p); }
    return p;
  }
  /** تغيير السرعة أثناء الأداء دون قفزة في الحركة: الموضع الحالي يبقى، وتتغيّر مدة ما بعده */
  setDur(dur) {
    if (!this.playing) { this.dur = dur; return; }
    const t = this.clock(), p = (t - this.t0) / this.dur;
    this.dur = dur; this.t0 = t - p * dur;
    this.nextBeat = Math.max(this.nextBeat, Math.ceil(p + 1e-9));
  }
  stop() { if (this.playing) this.held = this.pos(); this.playing = false; this.stopAt = null; }
  reset() { this.playing = false; this.held = -1; this.stopAt = null; }
  timeOf(b) { return this.t0 + b * this.dur; }

  /** يجدول النبضات التي يقع زمنها قبل now+look، ويعيد [ {b, t} ] (لا يتجاوز نقطة التوقف) */
  due(look = 0.15) {
    if (!this.playing) return [];
    const out = [], lim = this.clock() + look;
    while (this.timeOf(this.nextBeat) < lim) {
      if (this.stopAt != null && this.nextBeat > this.stopAt + 1e-9) break;
      out.push({ b: this.nextBeat, t: this.timeOf(this.nextBeat) });
      this.nextBeat++;
    }
    return out;
  }
}
