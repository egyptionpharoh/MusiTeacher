// =====================================================================
//  صوت الكمان: عينات كمان حقيقية (Versilian VSCO 2 Community Edition — كمان منفرد Arco Vibrato، ترخيص CC0 — انظر public/audio/violin/AUDIO-LICENSE.txt)
//  تُشغَّل بحلقة تكرار مضبوطة الطور للنغمات الطويلة وتعديل دقيق للطبقة (detune) ليطابق التردد المحسوب بالضبط.
//  إن تعذّر تحميل العينات أو فك ترميزها يعود تلقائيًا إلى المولّد البرمجي القديم (الوصف التالي) فلا ينقطع الصوت.
//  المولّد البرمجي (احتياطي): موجة ملمومة (Helmholtz) بتناغمات 1/n (نغمة وتر مُقوَّس)، ثم تشكيل بالرنين الخشبي لجسم الكمان
//  (قمم قرب 290 و530 و2800 هرتز)، ضجيج قوس خفيف عند الهجوم، وصدى قاعة قصير مولَّد رياضيًا.
//  الجدولة تعتمد ساعة AudioContext فتكون النغمة دقيقة التوقيت بالنسبة لحركة القوس والأصابع.
//  يجب استدعاء unlock() من حركة مستخدم (نقرة) كما تشترط المتصفحات.
// =====================================================================
export class ViolinSynth {
  constructor() {
    this.ctx = null; this.master = null; this.muted = false; this.volume = 0.8; this.voices = new Set(); this.log = [];
    // العينات: G3..G7 بأسماء تحوي الـ bemol (Ab, Bb, Db, Eb, Gb) كما في المصدر
    this.sampleBase = 'public/audio/violin/'; this.raw = new Map(); this.bufs = new Map(); this.decoding = false;
    this.useSamples = !/[?&]synth=1/.test(location.search);
    this.samplesState = this.useSamples ? 'loading' : 'off';
    if (this.useSamples) this._fetchSamples();
  }

  static NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
  static MIDI_LO = 55; static MIDI_HI = 103;
  static noteName(m) { return ViolinSynth.NAMES[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1); }

  async _fetchSamples() {
    try {
      const jobs = [];
      for (let m = ViolinSynth.MIDI_LO; m <= ViolinSynth.MIDI_HI; m++) {
        jobs.push(fetch(this.sampleBase + ViolinSynth.noteName(m) + '.mp3').then((r) => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); }).then((ab) => this.raw.set(m, ab)));
      }
      await Promise.all(jobs);
      this.samplesState = 'fetched';
      if (this.ctx) this._decodeAll();
    } catch (err) { this.samplesState = 'failed'; console.warn('تعذّر تحميل عينات الكمان، سيُستخدم المولّد البرمجي:', err); }
  }

  // فك الترميز بعد وجود AudioContext (يحتاج نقرة المستخدم)، مع حساب نقطتي الحلقة لكل نغمة
  async _decodeAll() {
    if (this.decoding || !this.ctx || this.samplesState !== 'fetched') return;
    this.decoding = true;
    try {
      for (const [m, ab] of this.raw) {
        const buf = await this.ctx.decodeAudioData(ab.slice(0));
        this.bufs.set(m, ViolinSynth.buildLoop(buf, 440 * Math.pow(2, (m - 69) / 12)));
      }
      this.samplesState = 'ready';
    } catch (err) { this.samplesState = 'failed'; console.warn('تعذّر فك ترميز عينات الكمان، سيُستخدم المولّد البرمجي:', err); }
    this.decoding = false;
  }

  // حلقة سلسة: نبحث (بحثًا خشنًا ثم دقيقًا) عن نقطة نهاية يتطابق عندها شكل الموجة مع بدايتها، ثم نخبز تلاشيًا متقاطعًا (150 م.ث)
  // في ذيل الحلقة مع المقطع السابق لبدايتها، فلا يبقى نقر أو قفزة طور عند العودة للبداية حتى لو كانت العينة غير دورية تمامًا.
  static buildLoop(buf, f) {
    const sr = buf.sampleRate, nch = buf.numberOfChannels, n = buf.length;
    const chs = []; for (let c = 0; c < nch; c++) chs.push(buf.getChannelData(c));
    const m = new Float32Array(n); for (let i = 0; i < n; i++) { let v = 0; for (let c = 0; c < nch; c++) v += chs[c][i]; m[i] = v / nch; }
    const s = Math.round(0.55 * sr), X = Math.round(0.15 * sr), eMin = s + Math.round(1.1 * sr), eMax = n - Math.round(0.14 * sr), W1 = 48, W2 = 1536;
    const cand = [];
    for (let e = eMin; e < eMax; e++) { let c = 0; for (let i = 0; i < W1; i++) { const q = m[s + i] - m[e + i]; c += q * q; } cand.push([c, e]); }
    cand.sort((x, y) => x[0] - y[0]);
    const picks = []; for (const [, e] of cand) { if (picks.every((q) => Math.abs(q - e) > 24)) picks.push(e); if (picks.length >= 40) break; }
    let best = picks[0], bc = Infinity, en = 1e-9; for (let i = 0; i < W2; i++) en += m[s + i] * m[s + i];
    for (const e of picks) { if (e + W2 > n) continue; let c = 0; for (let i = 0; i < W2; i++) { const q = m[s + i] - m[e + i]; c += q * q; } if (c < bc) { bc = c; best = e; } }
    const eqp = Math.sqrt(bc / en) > 0.5;            // غير متطابقتين: تلاشٍ بقدرة ثابتة (يتجنب هبوط الجهارة)؛ متطابقتان: تلاشٍ خطي
    const L = best - s, out = new AudioBuffer({ length: best, numberOfChannels: nch, sampleRate: sr });
    for (let c = 0; c < nch; c++) {
      const o = out.getChannelData(c), x = chs[c];
      for (let i = 0; i < best; i++) {
        if (i < best - X) o[i] = x[i];
        else { const t = (i - (best - X)) / X, ga = eqp ? Math.cos(t * Math.PI / 2) : 1 - t, gb = eqp ? Math.sin(t * Math.PI / 2) : t; o[i] = x[i] * ga + x[i - L] * gb; }
      }
    }
    let r = 0; for (let i = s; i < best; i += 2) r += m[i] * m[i]; r = Math.sqrt(r / ((best - s) / 2));
    return { buf: out, loopStart: s / sr, loopEnd: best / sr, rms: r, mismatch: Math.sqrt(bc / en) };   // mismatch: نسبة الطاقة غير المتطابقة (0 = تطابق تام)
  }

  get ready() { return !!this.ctx && this.ctx.state === 'running'; }

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      this.ctx = new AC({ latencyHint: 'interactive' });
      this._build();
    }
    if (this.ctx.state !== 'running') this.ctx.resume().catch(() => {});
    if (this.samplesState === 'fetched') this._decodeAll();
    return true;
  }

  _build() {
    const c = this.ctx;
    // موجة وتر مقوَّس: سعة التناغم n ≈ 1/n مع انحدار إضافي للتناغمات العليا
    const N = 48, re = new Float32Array(N + 1), im = new Float32Array(N + 1);
    for (let n = 1; n <= N; n++) im[n] = (1 / n) * Math.pow(0.93, n - 1) * (n % 7 === 0 ? 0.7 : 1);
    this.wave = c.createPeriodicWave(re, im, { disableNormalization: false });
    // ناقل التشكيل: مرشحات جسم الكمان
    const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 150; hp.Q.value = 0.5;
    const body1 = c.createBiquadFilter(); body1.type = 'peaking'; body1.frequency.value = 290; body1.gain.value = 5; body1.Q.value = 2.2;
    const body2 = c.createBiquadFilter(); body2.type = 'peaking'; body2.frequency.value = 530; body2.gain.value = 3.5; body2.Q.value = 1.6;
    const hill = c.createBiquadFilter(); hill.type = 'peaking'; hill.frequency.value = 2800; hill.gain.value = 6; hill.Q.value = 0.9;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 7200; lp.Q.value = 0.4;
    this.bus = c.createGain(); this.bus.gain.value = 1;
    this.bus.connect(hp); hp.connect(body1); body1.connect(body2); body2.connect(hill); hill.connect(lp);
    const comp = c.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 3; comp.attack.value = 0.01; comp.release.value = 0.2;
    lp.connect(comp); this.comp = comp;
    this.master = c.createGain(); this.master.gain.value = this.muted ? 0 : this.volume * 0.55;
    // صدى قاعة صغيرة (ضجيج أُسّي التلاشي، قناتان)
    const len = Math.floor(c.sampleRate * 1.5), ir = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); let seed = 12345 + ch * 977; for (let i = 0; i < len; i++) { seed = (seed * 16807) % 2147483647; d[i] = ((seed / 2147483647) * 2 - 1) * Math.pow(1 - i / len, 2.6); } }
    const conv = c.createConvolver(); conv.buffer = ir;
    const wet = c.createGain(); wet.gain.value = 0.22, comp.connect(this.master); comp.connect(conv); conv.connect(wet); wet.connect(this.master);
    this.master.connect(c.destination);
    // ضجيج للقوس
    const nl = c.sampleRate * 2, nb = c.createBuffer(1, nl, c.sampleRate), nd = nb.getChannelData(0); let s2 = 99;
    for (let i = 0; i < nl; i++) { s2 = (s2 * 16807) % 2147483647; nd[i] = (s2 / 2147483647) * 2 - 1; }
    this.noiseBuf = nb;
  }

  // محلّل اختياري لقياس ما يُسمَع فعليًا (للاختبار): يعيد AnalyserNode موصولًا بالمخرج الرئيسي
  tap(fft = 32768) {
    if (!this.ctx) return null;
    if (!this.analyser) { this.analyser = this.ctx.createAnalyser(); this.analyser.fftSize = fft; this.analyser.smoothingTimeConstant = 0; this.master.connect(this.analyser); }
    return this.analyser;
  }

  setMuted(m) { this.muted = m; if (this.master) this.master.gain.setTargetAtTime(m ? 0 : this.volume * 0.55, this.ctx.currentTime, 0.02); }
  setVolume(v) { this.volume = v; if (this.master && !this.muted) this.master.gain.setTargetAtTime(v * 0.55, this.ctx.currentTime, 0.02); }

  // نغمة واحدة: hz التردد، when وقت البداية على ساعة AudioContext، dur مدة الصوت (ث)، dir اتجاه القوس
  playNote({ hz, when, dur, dir = 'down', vibrato = false }) {
    if (!this.ctx || this.ctx.state !== 'running') return null;
    if (this.samplesState === 'ready') { const v = this._playSample({ hz, when, dur, dir, vibrato }); if (v) return v; }
    const c = this.ctx, t0 = Math.max(when, c.currentTime + 0.005), t1 = t0 + dur;
    const osc = c.createOscillator(); osc.setPeriodicWave(this.wave); osc.frequency.value = hz;
    // انحراف بطيء جدًا (±2 سنت) يمنع الجمود الآلي، دون تغيير اسم النغمة
    const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = vibrato ? 5.4 : 0.7 + Math.random() * 0.5; lg.gain.value = hz * (vibrato ? 0.0075 : 0.0011);
    lfo.connect(lg); lg.connect(osc.frequency);
    if (vibrato) { lg.gain.setValueAtTime(0, t0); lg.gain.linearRampToValueAtTime(hz * 0.0075, t0 + Math.min(0.45, dur * 0.5)); }
    const env = c.createGain(), A = dir === 'down' ? 0.055 : 0.075, R = Math.min(0.07, dur * 0.35);
    env.gain.setValueAtTime(0.0001, t0);
    env.gain.exponentialRampToValueAtTime(1, t0 + A);
    env.gain.exponentialRampToValueAtTime(0.82, t0 + A + 0.2);
    env.gain.setValueAtTime(0.82, Math.max(t0 + A + 0.2, t1 - R));
    env.gain.exponentialRampToValueAtTime(0.0001, t1);
    // سعة أعلى لأصوات الأوتار العليا حتى لا تبدو مي أخفت: تعويض بسيط بالتردد
    const comp = Math.min(1.25, Math.max(0.6, Math.pow(440 / hz, 0.18)));
    const g = c.createGain(); g.gain.value = 0.5 * comp;
    osc.connect(env); env.connect(g); g.connect(this.bus);
    // ضجيج خدش القوس عند الهجوم ثم خافت أثناء الإمرار
    const ns = c.createBufferSource(); ns.buffer = this.noiseBuf; ns.loop = true;
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = Math.min(6000, hz * 7); bp.Q.value = 0.8;
    const ng = c.createGain(); ng.gain.setValueAtTime(0.0001, t0); ng.gain.linearRampToValueAtTime(0.07, t0 + 0.012); ng.gain.exponentialRampToValueAtTime(0.012, t0 + 0.12); ng.gain.setValueAtTime(0.012, Math.max(t0 + 0.12, t1 - R)); ng.gain.exponentialRampToValueAtTime(0.0001, t1);
    ns.connect(bp); bp.connect(ng); ng.connect(this.bus);
    osc.start(t0); lfo.start(t0); ns.start(t0, Math.random());
    const end = t1 + 0.05; osc.stop(end); lfo.stop(end); ns.stop(end);
    const v = { osc, hz, t0, t1, env };
    this.voices.add(v); osc.onended = () => { this.voices.delete(v); [osc, lfo, ns, env, g, lg, bp, ng].forEach((n) => { try { n.disconnect(); } catch (_) {} }); };
    this.log.push({ hz: +hz.toFixed(2), t0: +t0.toFixed(3), dur: +dur.toFixed(3), dir }); if (this.log.length > 200) this.log.shift();
    return v;
  }

  // نغمة من العينات: أقرب نغمة نصف-صوتية + detune بالسنت لمطابقة التردد، حلقة للاستمرار، غلاف سعة للقوس
  _playSample({ hz, when, dur, dir, vibrato }) {
    const c = this.ctx, mf = 69 + 12 * Math.log2(hz / 440), m = Math.round(mf), e = this.bufs.get(m);
    if (!e) return null;
    const t0 = Math.max(when, c.currentTime + 0.005), t1 = t0 + dur, cents = (mf - m) * 100;
    const src = c.createBufferSource(); src.buffer = e.buf; src.loop = true; src.loopStart = e.loopStart; src.loopEnd = e.loopEnd; src.detune.value = cents;
    let lfo = null, lg = null;
    if (vibrato) {
      lfo = c.createOscillator(); lg = c.createGain(); lfo.frequency.value = 5.4; lg.gain.setValueAtTime(0, t0); lg.gain.linearRampToValueAtTime(14, t0 + Math.min(0.5, dur * 0.5));
      lfo.connect(lg); lg.connect(src.detune); lfo.start(t0);
    }
    const A = dir === 'down' ? 0.03 : 0.045, R = Math.min(0.09, dur * 0.4);
    const norm = Math.min(16, Math.max(2, 0.38 / Math.max(1e-4, e.rms)));            // نفس الجهارة عبر النطاق، وبمستوى المولّد القديم تقريبًا
    const env = c.createGain(); env.gain.setValueAtTime(0.0001, t0);
    env.gain.linearRampToValueAtTime(1, t0 + A);
    env.gain.setValueAtTime(1, Math.max(t0 + A, t1 - R));
    env.gain.linearRampToValueAtTime(0.0001, t1);
    const g = c.createGain(); g.gain.value = norm;
    src.connect(env); env.connect(g); g.connect(this.comp);
    src.start(t0); src.stop(t1 + 0.03);
    const v = { osc: src, hz, t0, t1, env };
    this.voices.add(v);
    src.onended = () => { this.voices.delete(v); [src, lfo, lg, env, g].forEach((n) => { if (n) try { n.disconnect(); } catch (_) {} }); if (lfo) try { lfo.stop(); } catch (_) {} };
    this.log.push({ hz: +hz.toFixed(2), t0: +t0.toFixed(3), dur: +dur.toFixed(3), dir, src: 'sample', note: ViolinSynth.noteName(m), cents: +cents.toFixed(1) }); if (this.log.length > 200) this.log.shift();
    return v;
  }

  // إسكات فوري (إيقاف/إعادة): إخماد سريع لكل الأصوات الجارية
  stopAll() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    for (const v of [...this.voices]) { try { v.env.gain.cancelScheduledValues(now); v.env.gain.setValueAtTime(Math.max(0.0001, v.env.gain.value), now); v.env.gain.exponentialRampToValueAtTime(0.0001, now + 0.04); v.osc.stop(now + 0.06); } catch (_) {} }
  }
}
