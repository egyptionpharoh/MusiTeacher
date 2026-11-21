// =====================================================================
//  ساعة الإيقاع: جدولة الضربات على ساعة الصوت نفسها (لا على مؤقّتات الصفحة)، بوحدة الدوبل كروش.
//  الموضع = u0 + (t − t0) ÷ مدة الوحدة. عند تغيير السرعة يُعاد تثبيت المرساة (t0, u0) على الموضع الحالي فلا قفز ولا تكرار.
//  كل ضربة تُجدول مرة واحدة فقط (sched = رقم آخر ضربة مجدولة)، والإيقاف يلغي الصوت والحركة المجدولين.
// =====================================================================
export class Transport {
  constructor(audio) {
    this.audio = audio; this.piece = null; this.bpm = 90; this.loop = true; this.playing = false;
    this.onHit = null;      // (hit, time, absIndex) عند جدولة ضربة
    this.onPos = null;      // (pos|null) كل إطار
    this.onEnd = null;
    this.horizon = 0.3; this.timer = 0;
  }
  setPiece(pc) { const was = this.playing; if (was) this.stop(); this.piece = pc; if (pc && pc.bpm) this.bpm = pc.bpm; }
  get unitDur() { return 60 / this.bpm / (this.piece ? (this.piece.meter[1] === 8 ? 2 : 4) : 4); }   // النبضة: النوار في x/4 والكروش في x/8
  posAt(t) { return this.u0 + (t - this.t0) / this.unitDur; }
  timeOf(u) { return this.t0 + (u - this.u0) * this.unitDur; }
  start(lead = 0.12) {
    if (!this.piece) return; const ctx = this.audio.ensure(); if (!ctx) return;
    this.t0 = ctx.currentTime + lead; this.u0 = 0; this.sched = 0; this.playing = true; this.pump();
    // مؤقّت مستقل عن رسم الإطارات: على الأجهزة البطيئة (أو عند تباطؤ الرسم) لا تضيع أي ضربة
    clearInterval(this.timer); this.timer = setInterval(() => this.pump(), 25);
  }
  stop() { this.playing = false; clearInterval(this.timer); this.timer = 0; if (this.onPos) this.onPos(null); }
  restart() { this.stop(); this.start(); }
  setBpm(b) {
    if (this.playing) { const now = this.audio.now, p = this.posAt(now); this.bpm = b; this.t0 = now; this.u0 = p; }
    else this.bpm = b;
  }
  /** الضربة رقم k (مطلقًا عبر التكرارات) */
  hitAt(k) { const H = this.piece.hits, n = H.length; if (!n) return null; const loopNo = Math.floor(k / n); if (!this.loop && loopNo > 0) return null; const h = H[k % n]; return { h, u: loopNo * this.piece.total + h.u, loopNo }; }
  pump() {
    if (!this.playing) return;
    const now = this.audio.now, until = now + this.horizon;
    for (;;) {
      const x = this.hitAt(this.sched); if (!x) break;
      const t = this.timeOf(x.u); if (t > until) break;
      if (t >= now - 0.02 && this.onHit) this.onHit(x.h, Math.max(t, now), this.sched, x.loopNo);
      this.sched++;
    }
  }
  /** يُستدعى كل إطار */
  frame(visualNow) {
    if (!this.playing) return;
    this.pump();
    const p = this.posAt(visualNow ?? this.audio.now);
    if (!this.loop && p >= this.piece.total) { this.stop(); if (this.onEnd) this.onEnd(); return; }
    if (this.onPos) this.onPos(p < 0 ? null : p % this.piece.total, Math.floor(Math.max(0, p) / this.piece.total));
  }
}

/** تقييم ضربة المتعلم: أقرب ضربة في النمط إلى زمن النقر */
export function judge(tr, stroke, t) {
  if (!tr.playing || !tr.piece) return null;
  const p = tr.posAt(t), tot = tr.piece.total, loopNo = Math.floor(p / tot), local = p - loopNo * tot;
  let best = null;
  for (const h of tr.piece.hits) for (const off of [-tot, 0, tot]) { const d = (local - (h.u + off)) * tr.unitDur; if (!best || Math.abs(d) < Math.abs(best.dt)) best = { h, dt: d, loopNo: loopNo + (off < 0 ? -1 : off > 0 ? 1 : 0) }; }
  if (!best || Math.abs(best.dt) > 0.22) return null;
  const want = best.h.k === 'D' ? 'dum' : 'tak', strokeOk = (stroke === 'ka' ? 'tak' : stroke) === want;
  return { ...best, strokeOk, ok: strokeOk && Math.abs(best.dt) < 0.08 };
}
