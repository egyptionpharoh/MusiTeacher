// =====================================================================
//  صوت الأورج — مولَّد برمجيًا بالكامل (لا ملفات صوت خارجية، فلا حقوق خارجية):
//   • تركيب جمعي على طريقة «قضبان الأورج» (Drawbars): لكل نغمة موجة واحدة مُعدّة مسبقًا (PeriodicWave) تجمع
//     التوافقيات 16′ 5⅓′ 8′ 4′ 2⅔′ 2′ 1⅗′ 1⅓′ 1′ بمستوياتها، فتردد الأساس = تردد المفتاح بالضبط (440·2^((m−69)/12)).
//   • غلاف بلا تأخير: هجوم سريع (5–45 مم.ث) مع «نقرة مفتاح» خفيفة، صوت ثابت ما دام المفتاح مضغوطًا، وإطلاق ناعم عند الرفع.
//   • اهتزاز (Vibrato/Chorus) خفيف، و«أنبوب» لصوت الكنيسة (نفَس قصير chiff)، ونقرة توافقية (Percussion) لصوت الجاز.
//   • صدى غرفة مولّد برمجيًا. الدواسة: تُبقي النغمات حتى رفعها.
//  البيانو: عينات Salamander Grand Piano (CC BY 3.0 — مذكورة في نافذة ⓘ و_shared/AUDIO_CREDITS.md) عبر محرك MTAudio المشترك.
// =====================================================================
import { VOICES, voiceById, freqOf } from '../instrument/organ-data.js';

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
// مواضع القضبان التسعة كمضاعفات لتردد «16′» (نصف تردد الأساس): 1 3 2 4 6 8 10 12 16
const HARM = [1, 3, 2, 4, 6, 8, 10, 12, 16];

export class OrganAudio {
  constructor() { this.ctx = null; this.voice = voiceById.piano || VOICES[0]; /* الصوت الافتراضي: البيانو */ this.vol = 0.8; this.state = 'idle'; this.onstate = null; this.log = []; this.active = new Set(); this.sustain = false; this.held = new Set(); this.waves = {}; }

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { this.state = 'failed'; this.onstate && this.onstate('failed'); return; }
    const ctx = this.ctx = new AC({ latencyHint: 'interactive' });
    this.master = ctx.createGain(); this.master.gain.value = this.vol * 0.55;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 3.5; comp.attack.value = 0.004; comp.release.value = 0.2;
    this.tone = ctx.createBiquadFilter(); this.tone.type = 'lowpass'; this.tone.frequency.value = 9000; this.tone.Q.value = 0.3;
    this.bus = ctx.createGain(); this.bus.connect(this.tone); this.tone.connect(this.master); this.master.connect(comp); comp.connect(ctx.destination);
    // صدى: نبضة مولّدة (ضجيج متناقص أسيًا) بطولين، ومزيج يتغير مع الصوت المختار
    const ir = (sec, decay) => { const b = ctx.createBuffer(2, Math.floor(ctx.sampleRate * sec), ctx.sampleRate); for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, decay); } return b; };
    this.conv = ctx.createConvolver(); this.conv.buffer = ir(1.9, 3.4);
    this.wet = ctx.createGain(); this.wet.gain.value = 0.16; this.bus.connect(this.wet); this.wet.connect(this.conv); this.conv.connect(this.master);
    // اهتزاز مشترك (LFO) يُعدّل طبقة كل الأصوات قليلًا
    this.lfo = ctx.createOscillator(); this.lfo.frequency.value = 6.4; this.lfoGain = ctx.createGain(); this.lfoGain.gain.value = 0; this.lfo.connect(this.lfoGain); this.lfo.start();
    // تحليل للاختبار (مقياس الطبقة الفعلية)
    this.analyser = ctx.createAnalyser(); this.analyser.fftSize = 16384; this.analyser.smoothingTimeConstant = 0.2; this.bus.connect(this.analyser);   // قبل الصدى: يقيس النغمة نفسها
    // البيانو: عينات حقيقية عبر MTAudio (تُحمّل عند اختيار البيانو أول مرة)
    this.piano = null;
    this.state = 'ready'; this.setVoice(this.voice.id); this.onstate && this.onstate('ready');
  }
  /** تجهيز مبكر عند فتح اللعبة: ينشئ سياق الصوت (يبقى معلّقًا حتى أول لمسة — سياسة المتصفحات) ويبدأ تحميل عينات البيانو،
   *  فتكون جاهزة غالبًا قبل أول نغمة. إن منع المتصفح ذلك يُؤجَّل كل شيء إلى أول ضغطة كما كان. */
  preload() { try { this.init(); } catch (e) { this.ctx = null; } }
  resume() { if (this.ctx && this.ctx.state !== 'running') this.ctx.resume().catch(() => {}); }
  get ready() { return !!this.ctx; }

  waveFor(v) {
    if (this.waves[v.id]) return this.waves[v.id];
    const N = 17, re = new Float32Array(N), im = new Float32Array(N);
    v.drawbars.forEach((lv, i) => { if (lv > 0) im[HARM[i]] += Math.pow(10, (lv - 8) * 3 / 20) * (i === 0 ? 0.9 : 1); });   // كل درجة قضيب ≈ 3 dB
    return (this.waves[v.id] = this.ctx.createPeriodicWave(re, im, { disableNormalization: false }));
  }
  setVoice(id) {
    const v = voiceById[id] || VOICES[0]; this.voice = v;
    if (!this.ctx) return v;
    const t = this.ctx.currentTime;
    this.wet.gain.setTargetAtTime((v.kind === 'piano' ? 0.12 : v.room ?? 0.14) * 0.7, t, 0.05);
    this.lfoGain.gain.setTargetAtTime(v.kind === 'organ' ? (v.vib || 0) * 9 : 0, t, 0.05);          // عمق الاهتزاز بالسنت (يُطبَّق على detune)
    this.tone.frequency.setTargetAtTime(v.id === 'soft' ? 4200 : v.id === 'church' ? 7000 : 9500, t, 0.05);
    if (v.kind === 'piano' && !this.piano && window.MTAudio) {
      this.onstate && this.onstate('loading-piano');
      this.piano = new window.MTAudio.Sampler(this.ctx, { set: 'salamander', attack: 0.004, release: 0.35, level: 0.95, variation: 0.4, out: this.bus,
        onstate: (st) => { this.onstate && this.onstate(st === 'ready' ? 'piano-ready' : st === 'failed' ? 'piano-failed' : st); } });
    }
    return v;
  }
  setVolume(x) { this.vol = clamp(x, 0, 1); if (this.master) this.master.gain.setTargetAtTime(this.vol * 0.55, this.ctx.currentTime, 0.03); }
  setSustain(on) { this.sustain = !!on; if (!on) for (const h of [...this.held]) if (h.released) this._stop(h); }

  /** يبدأ نغمة؛ يعيد مقبضًا لـ noteOff. */
  noteOn(midi, vel = 0.8) {
    if (!this.ctx) this.init();
    this.resume();
    const ctx = this.ctx, v = this.voice, t0 = ctx.currentTime + 0.002, f = freqOf(midi);
    const h = { midi, f, t0, voice: v.id, released: false };
    if (v.kind === 'piano') {
      if (this.piano && this.piano.ready) { h.pv = this.piano.play(midi, t0, 30, { vel: clamp(vel, 0.15, 1) }); }
      else { h.pending = true; }                                   // لم تُحمَّل العينات بعد: نعزف بالأورج الناعم مؤقتًا
      if (!h.pv) { const save = this.voice; this.voice = voiceById.soft; const hh = this._organ(h, voiceById.soft, vel, t0); this.voice = save; Object.assign(h, hh); }
    } else Object.assign(h, this._organ(h, v, vel, t0));
    this.active.add(h); this.held.add(h);
    this.log.push({ midi, f: +f.toFixed(3), t: +t0.toFixed(3), voice: v.id }); if (this.log.length > 300) this.log.shift();
    return h;
  }
  _organ(h, v, vel, t0) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator(); osc.setPeriodicWave(this.waveFor(v)); osc.frequency.value = h.f / 2;      // الموجة مبنية على 16′ (نصف الأساس)
    this.lfoGain.connect(osc.detune);
    const g = ctx.createGain(); g.gain.value = 0;
    // مستوى متساوٍ تقريبًا عبر اللوحة (النغمات العالية أخف قليلًا) — الأورج لا يتأثر بقوة الضغط إلا قليلًا
    const lvl = 0.20 * Math.pow(2, -(h.midi - 60) / 48) * (0.85 + 0.15 * vel);
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(lvl, t0 + v.attack);
    osc.connect(g); g.connect(this.bus); osc.start(t0);
    const out = { osc, g, lvl };
    // نقرة المفتاح (جزء صغير من ضجيج عالٍ لمدة قصيرة) — تميّز الأورج الحقيقي وتمنح إحساس الاستجابة الفورية
    const click = ctx.createBufferSource(); click.buffer = this._clickBuf(); const cg = ctx.createGain(); cg.gain.value = (v.id === 'church' ? 0.02 : 0.05) * (0.6 + 0.4 * vel);
    const hp = ctx.createBiquadFilter(); hp.type = 'bandpass'; hp.frequency.value = clamp(h.f * 4, 800, 6000); hp.Q.value = 1.2;
    click.connect(hp); hp.connect(cg); cg.connect(this.bus); click.start(t0); click.stop(t0 + 0.03);
    // الجاز: نقرة توافقية ثالثة تتلاشى سريعًا (percussion)
    if (v.perc) { const p = ctx.createOscillator(); p.frequency.value = h.f * 3; const pg = ctx.createGain(); pg.gain.setValueAtTime(lvl * v.perc, t0); pg.gain.setTargetAtTime(0, t0 + 0.01, 0.12); p.connect(pg); pg.connect(this.bus); p.start(t0); p.stop(t0 + 1.2); out.perc = p; }
    // الأنابيب: نفَس قصير في بداية النغمة (chiff)
    if (v.chiff) { const n = ctx.createBufferSource(); n.buffer = this._clickBuf(0.12); const nf = ctx.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = h.f * 2; nf.Q.value = 3; const ng = ctx.createGain(); ng.gain.setValueAtTime(lvl * v.chiff, t0); ng.gain.setTargetAtTime(0, t0 + 0.02, 0.04); n.connect(nf); nf.connect(ng); ng.connect(this.bus); n.start(t0); n.stop(t0 + 0.12); }
    return out;
  }
  _clickBuf(sec = 0.03) {
    const key = 'c' + sec; if (this[key]) return this[key];
    const b = this.ctx.createBuffer(1, Math.floor(this.ctx.sampleRate * sec), this.ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3);
    return (this[key] = b);
  }
  noteOff(h) {
    if (!h || h.released) return; h.released = true;
    if (this.sustain) return;                                       // الدواسة مضغوطة: تبقى النغمة
    this._stop(h);
  }
  _stop(h) {
    if (!this.ctx || h.stopped) return; h.stopped = true; this.held.delete(h);
    const t = this.ctx.currentTime, v = voiceById[h.voice] || this.voice;
    if (h.pv) { h.pv.stop(t, 0.35); }
    if (h.osc) {
      const rel = v.kind === 'piano' ? voiceById.soft.release : v.release;
      h.g.gain.cancelScheduledValues(t); h.g.gain.setValueAtTime(h.g.gain.value, t); h.g.gain.setTargetAtTime(0, t, Math.max(0.008, rel / 3));
      const end = t + rel * 2.5 + 0.05;
      try { h.osc.stop(end); } catch (e) { /* */ }
      h.osc.onended = () => { try { h.osc.disconnect(); h.g.disconnect(); this.lfoGain.disconnect(h.osc.detune); } catch (e) { /* */ } };
    }
    this.active.delete(h);
  }
  /** نقرة المترونوم (accent = أول المازورة) */
  click(accent = false) {
    if (!this.ctx) return; const ctx = this.ctx, t = ctx.currentTime + 0.003;
    const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = accent ? 1760 : 1320;
    const g = ctx.createGain(); g.gain.setValueAtTime(accent ? 0.12 : 0.07, t); g.gain.exponentialRampToValueAtTime(0.0005, t + 0.05);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + 0.06);
  }
  allOff() { for (const h of [...this.active]) { h.released = true; this._stop(h); } }

  /** قياس الطبقة المسموعة فعلًا (للاختبار): أعلى قمة في الطيف مع استيفاء قطعي حول القمة. */
  measurePeak(minHz = 40, maxHz = 4200) {
    if (!this.analyser) return null;
    const a = this.analyser, n = a.frequencyBinCount, buf = new Float32Array(n); a.getFloatFrequencyData(buf);
    const hz = (i) => i * this.ctx.sampleRate / a.fftSize;
    let bi = -1, bv = -Infinity;
    for (let i = 2; i < n - 2; i++) { const f = hz(i); if (f < minHz || f > maxHz) continue; if (buf[i] > bv) { bv = buf[i]; bi = i; } }
    if (bi < 0) return null;
    const l = buf[bi - 1], c = buf[bi], r = buf[bi + 1], p = 0.5 * (l - r) / (l - 2 * c + r);
    return { hz: hz(bi + (isFinite(p) ? p : 0)), db: bv };
  }
}
