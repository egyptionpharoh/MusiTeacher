// =====================================================================
//  صوت الأكورديون: عينات أكورديون حقيقية (FluidR3_GM، CC BY 3.0 US — انظر _shared/credits.json) عبر محرك MTAudio المشترك.
//  • مسار «ناي/يمين» ومسار «باص/يسار» منفصلان بفلتر وكسب مختلفين فيتميّز الباص والمصاحبة عن اللحن.
//  • كسب المسارين وسطوع الفلتر يتبعان «تدفق الهواء» أي سرعة حركة المنفاخ (setAir) كما في الآلة الحقيقية.
//  • النغمة المضغوطة تستمر ما دام المفتاح مضغوطًا (تكرار متقاطع للعينة)، وتنتهي بإطلاق ناعم عند رفع الإصبع.
// =====================================================================
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

export class AccordionAudio {
  constructor() { this.ctx = null; this.sampler = null; this.state = 'idle'; this.loaded = 0; this.total = 0; this.air = 0; this.onstate = null; this.muted = false; this.log = []; }

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC || !window.MTAudio) { this.state = 'failed'; this.onstate && this.onstate('failed'); return; }
    this.state = 'loading';
    const ctx = this.ctx = new AC({ latencyHint: 'interactive' });
    const master = this.master = ctx.createGain(); master.gain.value = 0.9;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 3; comp.attack.value = 0.01; comp.release.value = 0.25;
    master.connect(comp); comp.connect(ctx.destination);
    // غرفة صغيرة (صدى خفيف مولَّد برمجيًا)
    const ir = ctx.createBuffer(2, Math.floor(ctx.sampleRate * 1.1), ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3.2); }
    const conv = ctx.createConvolver(); conv.buffer = ir; const wet = ctx.createGain(); wet.gain.value = 0.09; master.connect(wet); wet.connect(conv); conv.connect(comp);
    // مسار اللحن (اليمين)
    this.tIn = ctx.createGain(); this.tTone = ctx.createBiquadFilter(); this.tTone.type = 'lowpass'; this.tTone.Q.value = 0.4; this.tTone.frequency.value = 6000;
    this.tAir = ctx.createGain(); this.tAir.gain.value = 0;
    this.tIn.connect(this.tTone); this.tTone.connect(this.tAir); this.tAir.connect(master);
    // مسار الباص والمصاحبة (اليسار): أغمق وأخف قليلًا
    this.bIn = ctx.createGain(); this.bTone = ctx.createBiquadFilter(); this.bTone.type = 'lowpass'; this.bTone.Q.value = 0.5; this.bTone.frequency.value = 1500;
    this.bAir = ctx.createGain(); this.bAir.gain.value = 0;
    this.bIn.connect(this.bTone); this.bTone.connect(this.bAir); this.bAir.connect(master);
    this.sampler = new window.MTAudio.Sampler(ctx, {
      set: 'accordion', attack: 0.035, release: 0.13, level: 0.85, variation: 0.6, loopXfade: 0.24, loopStart: 0.5,
      onprogress: (n, t) => { this.loaded = n; this.total = t; this.onstate && this.onstate('loading', n, t); },
      onstate: (st) => { this.state = st === 'ready' ? 'ready' : st; this.onstate && this.onstate(this.state); },
    });
  }
  resume() { if (this.ctx && this.ctx.state !== 'running') this.ctx.resume().catch(() => {}); }
  get ready() { return !!(this.sampler && this.sampler.ready); }

  /** تدفق الهواء 0..1 (من سرعة المنفاخ). يُستدعى كل إطار. */
  setAir(a) {
    this.air = a; if (!this.ctx) return;
    const t = this.ctx.currentTime, g = this.muted ? 0 : Math.pow(clamp(a, 0, 1), 0.7);
    this.tAir.gain.setTargetAtTime(g * 1.0, t, 0.025); this.bAir.gain.setTargetAtTime(g * 0.82, t, 0.025);
    this.tTone.frequency.setTargetAtTime(1800 + 6200 * clamp(a, 0, 1), t, 0.04);
    this.bTone.frequency.setTargetAtTime(700 + 1400 * clamp(a, 0, 1), t, 0.04);
  }

  /** يبدأ نغمة مستمرة. side: 'R' | 'L'. notes: قائمة أرقام MIDI. يعيد مقبضًا لـ noteOff. */
  noteOn(side, notes, vel = 0.8, when) {
    if (!this.ready) return null;
    this.resume();
    const out = side === 'R' ? this.tIn : this.bIn, voices = [];
    const t0 = Math.max(when || 0, this.ctx.currentTime + 0.002);
    notes.forEach((m, i) => {
      const v = this.sampler.play(m, t0 + (side === 'L' && notes.length > 1 ? i * 0.006 : 0), 60, { vel: clamp(vel * (side === 'L' ? (notes.length > 1 ? 0.72 : 0.9) : 1) * (1 + (Math.random() - 0.5) * 0.08), 0.1, 1), out, release: 0.13 });
      if (v) voices.push(v);
    });
    this.log.push({ side, notes, t: +t0.toFixed(3), vel });
    if (this.log.length > 200) this.log.shift();
    return { voices, t0, side, notes };
  }
  noteOff(h, when, fade = 0.12) {
    if (!h) return;
    const at = Math.max(when || 0, this.ctx.currentTime + 0.002);
    for (const v of h.voices) v.stop(at, fade);
  }
  allOff() { /* تُدار المقابض من الخارج */ }
}
