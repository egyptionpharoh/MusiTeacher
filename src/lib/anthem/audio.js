// محرك الصوت: توليد تعليمي من النوتة عبر Web Audio (بلا ملفات صوتية ولا مكتبات).
// التوقيت مجدول على ساعة AudioContext؛ تغيير السرعة يغيّر مواعيد النغمات فقط ولا يمس ترددها.
import { freqOf } from './notation.js';

/** الأصوات المتاحة: كلها محاكاة مركّبة تقريبية لطابع الآلة، وليست تسجيلات آلات حقيقية */
export const INSTRUMENTS = [
  { id: 'piano', label: 'بيانو' }, { id: 'violin', label: 'كمان' }, { id: 'flute', label: 'فلوت' },
  { id: 'trumpet', label: 'ترومبيت' }, { id: 'clarinet', label: 'كلارينيت' }, { id: 'brass', label: 'مجموعة نحاسيات' },
  { id: 'drum', label: 'إيقاع (طبلة)' },
];

let noiseBuf = null;
function noise(ctx) {
  if (noiseBuf && noiseBuf.sampleRate === ctx.sampleRate) return noiseBuf;
  const b = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); const d = b.getChannelData(0);
  let seed = 12345; for (let i = 0; i < d.length; i++) { seed = (seed * 1103515245 + 12345) & 0x7fffffff; d[i] = (seed / 0x3fffffff) - 1; }
  noiseBuf = b; return b;
}
function env(g, t, end, { a = 0.01, peak = 0.8, sus = 0.6, tau = 0.25, rel = 0.06 }) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(peak, t + a);
  g.gain.setTargetAtTime(peak * sus, t + a, tau);
  g.gain.setTargetAtTime(0.0001, Math.max(end, t + a + 0.01), rel);
  return end + rel * 7;
}
function vibrato(ctx, osc, f, t, depth = 0.005, rate = 5.4, delay = 0.18) {
  const lfo = ctx.createOscillator(); const lg = ctx.createGain(); lfo.frequency.value = rate;
  lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(f * depth, t + delay + 0.2);
  lfo.connect(lg); lg.connect(osc.frequency); return lfo; // يبدأ مع بقية العقد
}

/**
 * يجدول نغمة واحدة. @returns {{stop:(at:number)=>void, end:number}}
 */
export function voice(ctx, dest, inst, midi, t, dur, vel = 0.8) {
  const f = freqOf(midi); const end = t + Math.max(0.04, dur * 0.94); const nodes = []; const out = ctx.createGain(); out.connect(dest);
  const osc = (type, freq, gain, det = 0) => { const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq; o.detune.value = det; const g = ctx.createGain(); g.gain.value = gain; o.connect(g); nodes.push(o); return { o, g }; };
  let stopAt;
  if (inst === 'drum') {
    const n = ctx.createBufferSource(); n.buffer = noise(ctx); const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1400;
    const g = ctx.createGain(); g.gain.setValueAtTime(vel * 0.9, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    n.connect(hp); hp.connect(g); g.connect(out); n.start(t); n.stop(t + 0.2); nodes.push(n);
    const b = osc('triangle', 190, 1); b.g.gain.setValueAtTime(vel * 0.7, t); b.g.gain.exponentialRampToValueAtTime(0.001, t + 0.12); b.o.frequency.setValueAtTime(220, t); b.o.frequency.exponentialRampToValueAtTime(140, t + 0.1); b.g.connect(out);
    b.o.start(t); b.o.stop(t + 0.15); stopAt = t + 0.2;
    return { end: stopAt, stop: (at) => nodes.forEach((x) => { try { x.stop(at); } catch { /* */ } }) };
  }
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.connect(out);
  if (inst === 'piano') {
    const a = osc('triangle', f, 0.7), b = osc('sine', f * 2, 0.22), c = osc('sine', f * 3, 0.07);
    [a, b, c].forEach((x) => x.g.connect(lp)); lp.frequency.setValueAtTime(Math.min(9000, f * 8), t); lp.frequency.setTargetAtTime(Math.min(4000, f * 3), t, 0.3);
    out.gain.value = 0; stopAt = env(out, t, end, { a: 0.006, peak: vel, sus: 0.28, tau: 0.35, rel: 0.09 });
  } else if (inst === 'violin') {
    const a = osc('sawtooth', f, 0.55); a.g.connect(lp); lp.frequency.value = Math.min(3600, f * 6); lp.Q.value = 0.8;
    nodes.push(vibrato(ctx, a.o, f, t, 0.006, 5.6)); stopAt = env(out, t, end, { a: 0.07, peak: vel * 0.75, sus: 0.85, tau: 0.3, rel: 0.1 });
  } else if (inst === 'flute') {
    const a = osc('sine', f, 0.85), b = osc('sine', f * 2, 0.12); a.g.connect(lp); b.g.connect(lp); lp.frequency.value = 5000;
    const n = ctx.createBufferSource(); n.buffer = noise(ctx); n.loop = true; const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f * 2; bp.Q.value = 2; const ng = ctx.createGain(); ng.gain.value = 0.05;
    n.connect(bp); bp.connect(ng); ng.connect(lp); nodes.push(n);
    nodes.push(vibrato(ctx, a.o, f, t, 0.004, 5));
    stopAt = env(out, t, end, { a: 0.05, peak: vel * 0.8, sus: 0.85, tau: 0.3, rel: 0.07 });
  } else if (inst === 'trumpet') {
    const a = osc('sawtooth', f, 0.6); a.g.connect(lp); lp.Q.value = 1.2;
    lp.frequency.setValueAtTime(Math.min(900, f * 2), t); lp.frequency.linearRampToValueAtTime(Math.min(5000, f * 9), t + 0.05); lp.frequency.setTargetAtTime(Math.min(3200, f * 6), t + 0.05, 0.2);
    stopAt = env(out, t, end, { a: 0.025, peak: vel * 0.7, sus: 0.8, tau: 0.25, rel: 0.06 });
  } else if (inst === 'clarinet') {
    const a = osc('square', f, 0.4); a.g.connect(lp); lp.frequency.value = Math.min(2600, f * 5); lp.Q.value = 0.6;
    stopAt = env(out, t, end, { a: 0.035, peak: vel * 0.75, sus: 0.85, tau: 0.3, rel: 0.06 });
  } else { // brass section
    [-9, 0, 9].forEach((d) => osc('sawtooth', f, 0.28, d).g.connect(lp)); osc('sawtooth', f / 2, 0.14).g.connect(lp);
    lp.frequency.setValueAtTime(Math.min(700, f * 2), t); lp.frequency.linearRampToValueAtTime(Math.min(3000, f * 6), t + 0.08); lp.Q.value = 0.9;
    stopAt = env(out, t, end, { a: 0.05, peak: vel * 0.7, sus: 0.8, tau: 0.3, rel: 0.09 });
  }
  nodes.forEach((x) => { if (x.start) { x.start(t); x.stop(stopAt); } });
  return { end: stopAt, stop: (at) => { out.gain.cancelScheduledValues(at); out.gain.setTargetAtTime(0.0001, at, 0.015); nodes.forEach((x) => { try { x.stop(at + 0.1); } catch { /* */ } }); } };
}
export function click(ctx, dest, t, accent) {
  const o = ctx.createOscillator(); const g = ctx.createGain(); o.frequency.value = accent ? 1900 : 1300;
  g.gain.setValueAtTime(accent ? 0.5 : 0.32, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.05); o.connect(g); g.connect(dest); o.start(t); o.stop(t + 0.06);
  return { stop: (at) => { try { o.stop(at); } catch { /* */ } }, end: t + 0.06 };
}

/**
 * المشغّل: يجدول خطًا زمنيًا (بالسوداء) على ساعة الصوت، ويعطي الموضع الحالي للمزامنة.
 */
export class AnthemPlayer {
  constructor({ onEnd, onState } = {}) {
    this.ctx = null; this.master = null; this.timeline = null; this.bpm = 96; this.volume = 0.8; this.inst = 'piano';
    this.metronome = false; this.beatUnit = 1; this.barBeats = 2; this.loop = null; this.playing = false;
    this.anchors = []; this.idx = 0; this.voices = []; this.timer = null; this.nextClick = 0; this.onEnd = onEnd; this.onState = onState; this.pausedAt = 0;
  }
  ensure() {
    if (!this.ctx) {
      const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext); if (!AC) throw new Error('no-audio');
      this.ctx = new AC(); const comp = this.ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
      this.master = this.ctx.createGain(); this.master.gain.value = this.volume; this.master.connect(comp); comp.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }
  load(timeline, { barBeats, beatUnit } = {}) { this.stop(); this.timeline = timeline; if (barBeats) this.barBeats = barBeats; if (beatUnit) this.beatUnit = beatUnit; this.pausedAt = 0; }
  get spb() { return 60 / this.bpm; }
  setVolume(v) { this.volume = v; if (this.master) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.02); }
  setInstrument(id) { this.inst = id; }
  setMetronome(on) { this.metronome = !!on; }
  /** تغيير السرعة أثناء العزف: نعيد الربط من الموضع الحالي ونعيد جدولة ما لم يبدأ بعد */
  setTempo(bpm) {
    bpm = Math.max(20, Math.min(260, Number(bpm) || this.bpm)); if (bpm === this.bpm) return;
    if (this.playing) { const pos = this.position(); this.halt(); this.bpm = bpm; this.start(pos); } else this.bpm = bpm;
  }
  /** loop = {from, to} بالسوداء أو null */
  setLoop(loop) { const pos = this.playing ? this.position() : this.pausedAt; this.loop = loop && loop.to > loop.from ? loop : null; if (this.playing) { this.halt(); this.start(this.loop && (pos < this.loop.from || pos >= this.loop.to) ? this.loop.from : pos); } }
  play(from) { this.ensure(); const start = from !== undefined ? from : this.pausedAt; this.start(this.loop && (start < this.loop.from || start >= this.loop.to) ? this.loop.from : start); }
  pause() { if (!this.playing) return; this.pausedAt = this.position(); this.halt(); this.emit(); }
  stop() { if (this.playing) this.halt(); this.pausedAt = this.loop ? this.loop.from : 0; this.emit(); }
  seek(beat) { const was = this.playing; if (was) this.halt(); this.pausedAt = Math.max(0, Math.min(beat, this.timeline ? this.timeline.total : 0)); if (was) this.start(this.pausedAt); else this.emit(); }
  emit() { if (this.onState) this.onState({ playing: this.playing, position: this.position() }); }
  /** الموضع الحالي بالسوداء على الخط الزمني (مستمد من ساعة الصوت) */
  position() {
    if (!this.playing || !this.ctx) return this.pausedAt;
    const now = this.ctx.currentTime; let a = this.anchors[0];
    for (const x of this.anchors) if (x.ctx <= now) a = x;
    const p = a.beat + Math.max(0, now - a.ctx) / this.spb;
    return Math.min(p, a.limit);
  }
  start(fromBeat) {
    if (!this.timeline) return; const ctx = this.ensure();
    const ev = this.timeline.events; let i = ev.findIndex((e) => e.at >= fromBeat - 1e-6); if (i < 0) i = ev.length;
    // إن بدأنا داخل حدث، نبدأ من بدايته التالية ونبقي المؤشر في مكانه
    this.idx = i; const t0 = ctx.currentTime + 0.06;
    this.anchors = [{ ctx: t0, beat: fromBeat, limit: this.loop ? this.loop.to : this.timeline.total }];
    this.nextClick = Math.ceil(fromBeat / this.beatUnit - 1e-6) * this.beatUnit;
    this.playing = true; this.endAt = null;
    this.tick(); this.timer = setInterval(() => this.tick(), 25); this.emit();
  }
  halt() {
    clearInterval(this.timer); this.timer = null; this.playing = false;
    const now = this.ctx ? this.ctx.currentTime : 0; this.voices.forEach((v) => { if (v.end > now) v.stop(now); }); this.voices = [];
  }
  ctxAt(beat, a) { return a.ctx + (beat - a.beat) * this.spb; }
  tick() {
    const ctx = this.ctx; const horizon = ctx.currentTime + 0.18; const ev = this.timeline.events; const vol = 0.8;
    let a = this.anchors[this.anchors.length - 1];
    for (let guard = 0; guard < 2000; guard++) {
      const limit = this.loop ? this.loop.to : this.timeline.total;
      const nextEv = this.idx < ev.length && ev[this.idx].at < limit - 1e-6 ? ev[this.idx] : null;
      const nextBeat = Math.min(nextEv ? nextEv.at : limit, this.metronome ? this.nextClick : Infinity);
      // نهاية المقطع
      if (!nextEv && (!this.metronome || this.nextClick >= limit - 1e-6)) {
        const tEnd = this.ctxAt(limit, a);
        if (tEnd > horizon) break;
        if (this.loop) {
          const b = { ctx: tEnd, beat: this.loop.from, limit: this.loop.to }; this.anchors.push(b); a = b;
          this.idx = ev.findIndex((e) => e.at >= this.loop.from - 1e-6); this.nextClick = this.loop.from; continue;
        }
        if (!this.endAt) { this.endAt = tEnd; setTimeout(() => { if (this.playing && this.endAt === tEnd) { this.halt(); this.pausedAt = 0; this.emit(); if (this.onEnd) this.onEnd(); } }, Math.max(0, (tEnd - ctx.currentTime) * 1000 + 60)); }
        break;
      }
      const t = this.ctxAt(nextBeat, a); if (t > horizon) break;
      if (this.metronome && Math.abs(nextBeat - this.nextClick) < 1e-6 && (!nextEv || this.nextClick <= nextEv.at + 1e-6)) {
        const accent = Math.abs((this.nextClick / this.barBeats) - Math.round(this.nextClick / this.barBeats)) < 1e-6;
        this.voices.push(click(ctx, this.master, Math.max(t, ctx.currentTime), accent)); this.nextClick += this.beatUnit; continue;
      }
      if (nextEv) {
        if (nextEv.kind === 'note' && !nextEv.tiePrev) {
          const t1 = Math.max(t, ctx.currentTime); const d = (nextEv.soundDur || nextEv.dur) * this.spb;
          const gs = nextEv.graces || []; const g = gs.length ? Math.min(0.08, d / (3 * gs.length)) : 0; // الزينة تأخذ من زمن النغمة نفسها
          gs.forEach((gm, j) => this.voices.push(voice(ctx, this.master, this.inst, gm, t1 + j * g, g * 1.1, vol * 0.85)));
          this.voices.push(voice(ctx, this.master, this.inst, nextEv.midi, t1 + gs.length * g, d - gs.length * g, vol));
        }
        this.idx++;
      }
    }
    const now = ctx.currentTime; this.voices = this.voices.filter((v) => v.end > now - 0.05);
    if (this.anchors.length > 3) this.anchors = this.anchors.filter((x, k) => k >= this.anchors.length - 3 || x.ctx > now);
  }
  /** سماع نغمة واحدة (النقر على النغمة) */
  preview(midi, beats = 1, inst) { const ctx = this.ensure(); this.voices.push(voice(ctx, this.master, inst || this.inst, midi, ctx.currentTime + 0.02, beats * this.spb, 0.8)); }
  /** سماع سلسلة أحداث مستقلة (الألعاب): [{at,dur,midi,kind}] بالسوداء */
  previewSeq(events, { inst, bpm } = {}) {
    const ctx = this.ensure(); const spb = 60 / (bpm || this.bpm); const t0 = ctx.currentTime + 0.05;
    const vs = events.filter((e) => e.kind === 'note' && !e.tiePrev).map((e) => voice(ctx, this.master, inst || this.inst, e.midi, t0 + e.at * spb, (e.soundDur || e.dur) * spb, 0.8));
    this.voices.push(...vs); return { t0, spb, stop: () => vs.forEach((v) => v.stop(ctx.currentTime)) };
  }
  close() { this.halt(); if (this.ctx) { try { this.ctx.close(); } catch { /* */ } } this.ctx = null; }
}

/** تقدير التردد الأساسي (للاختبار): ارتباط ذاتي على عينات */
export function estimatePitch(data, sampleRate) {
  const n = Math.min(data.length, 8192); let best = 0, bestLag = 0; const minLag = Math.floor(sampleRate / 1500), maxLag = Math.floor(sampleRate / 60);
  let prev = -Infinity; const corr = [];
  for (let lag = minLag; lag <= maxLag; lag++) { let s = 0; for (let i = 0; i < n - lag; i++) s += data[i] * data[i + lag]; corr[lag] = s; }
  const peak = Math.max(...corr.filter((x) => x !== undefined));
  for (let lag = minLag + 1; lag < maxLag; lag++) { if (corr[lag] > corr[lag - 1] && corr[lag] >= corr[lag + 1] && corr[lag] > 0.8 * peak) { bestLag = lag; best = corr[lag]; break; } }
  void prev; void best;
  if (!bestLag) return 0;
  const y0 = corr[bestLag - 1], y1 = corr[bestLag], y2 = corr[bestLag + 1]; const sh = (y0 - y2) / (2 * (y0 - 2 * y1 + y2) || 1);
  return sampleRate / (bestLag + sh);
}
