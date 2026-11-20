// =====================================================================
//  ساعة الإيقاع: تجدول ضربات النمط على ساعة الصوت نفسها (دقة عينة)، وتُبلّغ الواجهة بكل ضربة في لحظتها للحركة.
//  مستقلة عن الآلة وعن النمط: تأخذ نمطًا مُحلَّلًا (rhythms.js) ودالة عزف.
// =====================================================================
export class Transport {
  /** audio: AudioEngine · onStep(cell|null, index, time, loopNo): تُستدعى لحظة سماع الخانة */
  constructor(audio, onStep) { this.audio = audio; this.onStep = onStep; this.playing = false; this.bpm = 84; this.loop = true; this.pattern = null; this.guide = 1; this.queue = []; }
  get stepDur() { return 60 / this.bpm / this.pattern.div; }
  setPattern(p) { const was = this.playing; this.stop(); this.pattern = p; this.bpm = p.bpm; if (was) this.start(); }
  setBpm(b) {
    if (this.playing) { const pos = this.position(); this.bpm = b; this.t0 = this.audio.now - pos * this.stepDur; this.next = Math.ceil(pos - 1e-6); this.queue = this.queue.filter((q) => q.time <= this.audio.now); }
    else this.bpm = b;
  }
  /** الموضع الحالي بالخانات منذ البداية (كسري) */
  position() { return this.playing ? (this.audio.now - this.t0) / this.stepDur : 0; }
  start(lead = 0.12) {
    if (!this.pattern || !this.audio.ensure()) return;
    this.playing = true; this.t0 = this.audio.now + lead; this.next = 0; this.queue = [];
    clearInterval(this.timer); this.timer = setInterval(() => this.schedule(), 25); this.schedule();
  }
  stop() { this.playing = false; clearInterval(this.timer); this.queue = []; }
  schedule() {
    if (!this.playing) return;
    const horizon = this.audio.now + 0.2, n = this.pattern.total;
    while (this.t0 + this.next * this.stepDur < horizon) {
      const idx = this.next % n, loopNo = Math.floor(this.next / n);
      if (!this.loop && loopNo >= 1) { this.endAt = this.t0 + this.next * this.stepDur; break; }
      const time = this.t0 + this.next * this.stepDur, cell = this.pattern.cells[idx];
      if (cell && this.guide > 0 && this.play) this.play(cell, time, this.guide);
      this.queue.push({ cell, idx, time, loopNo }); this.next++;
    }
  }
  /** تُستدعى كل إطار: تُطلق أحداث الخانات التي حان وقت سماعها */
  frame() {
    if (!this.playing) return;
    const now = this.audio.now;
    while (this.queue.length && this.queue[0].time <= now) { const q = this.queue.shift(); this.onStep(q.cell, q.idx, q.time, q.loopNo); }
    if (this.endAt != null && now >= this.endAt) { this.endAt = null; this.stop(); this.onStep(null, -1, now, -1); }
  }
}
/**
 * حكم على ضربة المستخدم أمام النمط: أقرب خانة فيها ضربة، والفرق الزمني.
 * يعيد { idx, loopNo, dt (ث، سالب = مبكر), ok, strokeOk } أو null إن لم تكن هناك خانة قريبة.
 */
export function judge(transport, stroke, tapTime, win = 0.16) {
  const p = transport.pattern; if (!transport.playing || !p) return null;
  const pos = (tapTime - transport.t0) / transport.stepDur, k = Math.round(pos); if (k < 0) return null;
  const idx = ((k % p.total) + p.total) % p.total, cell = p.cells[idx], dt = (pos - k) * transport.stepDur;
  if (!cell || Math.abs(dt) > Math.min(win, transport.stepDur * 0.45)) return null;
  return { idx, loopNo: Math.floor(k / p.total), dt, strokeOk: cell.stroke === stroke, ok: cell.stroke === stroke && Math.abs(dt) <= 0.09 };
}
