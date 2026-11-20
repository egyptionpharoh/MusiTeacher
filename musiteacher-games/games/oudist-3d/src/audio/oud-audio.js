// =====================================================================
//  صوت العود: نمذجة فيزيائية لوتر منقور بالريشة + رنين جسم العود (Web Audio).
//  المحرك منقول من لعبة «العود الافتراضي» في المنصة نفسها (private-games/virtual-oud) — كود MusiTeacher، بلا عينات خارجية:
//   • Karplus–Strong موسّع: خط تأخير + فلتر فقد + تمرير كلي لضبط الطبقة بدقة كسرية (ضروري لأرباع التون) + موضع النقر.
//   • الأزواج: وتران متقاربان يُضربان بفارق جزء من الملّي ثانية مع انحراف ضبط طفيف (تموّج الأوتار المزدوجة).
//   • نقرة احتكاك الريشة، ورنين جسم (هواء ~150 هرتز، خشب ~220 هرتز وعشرات الرنينات الأعلى)، وغرفة صغيرة.
//  الإضافة هنا: ذاكرة مؤقتة للمخازن (لا تأخير عند الضرب)، وجدولة الصوت بدقة على ساعة الصوت لتطابق لحظة عبور الريشة.
// =====================================================================
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
function seededRandom(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
function holdParam(param, t) {
  if (typeof param.cancelAndHoldAtTime === 'function') { try { param.cancelAndHoldAtTime(t); return; } catch (e) { /* البديل */ } }
  const v = param.value; param.cancelScheduledValues(t); param.setValueAtTime(v, t);
}
const DYN = { p: { amp: 0.42, hard: 0.30, click: 0.010 }, mf: { amp: 0.68, hard: 0.55, click: 0.018 }, f: { amp: 1.00, hard: 0.80, click: 0.030 } };
const dynOf = (vel) => (vel < 0.45 ? 'p' : vel < 0.82 ? 'mf' : 'f');

function renderString(out, start, freq, sr, p, rnd) {
  const w = 2 * Math.PI * freq / sr, S = p.S;
  const re = (1 - S) + S * Math.cos(w), im = -S * Math.sin(w);
  const magH = Math.hypot(re, im), tauH = -Math.atan2(im, re) / w;
  const d = sr / freq - tauH, N = Math.floor(d - 0.5), frac = d - N, C = (1 - frac) / (1 + frac);
  const rho = Math.pow(10, -3 / (p.t60 * freq)) / magH, len = out.length - start;
  const ex = new Float32Array(N); let lp = 0; const a = 0.15 + 0.8 * p.hard;
  for (let i = 0; i < N; i++) { lp += a * ((rnd() * 2 - 1) - lp); ex[i] = lp; }
  const P = Math.max(1, Math.round(p.pick * N)), ex2 = new Float32Array(N);
  for (let i = 0; i < N; i++) ex2[i] = ex[i] - (i >= P ? ex[i - P] : 0);
  let mean = 0; for (let i = 0; i < N; i++) mean += ex2[i]; mean /= N;
  let rms = 0; for (let i = 0; i < N; i++) { ex2[i] -= mean; rms += ex2[i] * ex2[i]; }
  rms = Math.sqrt(rms / N) || 1; const g = p.amp / rms;
  const y = new Float32Array(len); let lpPrevIn = 0, apPrevIn = 0, apPrevOut = 0;
  for (let n = 0; n < len; n++) {
    const v = n >= N ? y[n - N] : 0, lpOut = (1 - S) * v + S * lpPrevIn; lpPrevIn = v;
    const apOut = C * lpOut + apPrevIn - C * apPrevOut; apPrevIn = lpOut; apPrevOut = apOut;
    y[n] = (n < N ? ex2[n] * g : 0) + rho * apOut;
  }
  let xPrev = 0, yPrev = 0;
  for (let n = 0; n < len; n++) { const yy = y[n] - xPrev + 0.995 * yPrev; xPrev = y[n]; yPrev = yy; out[start + n] += yy; }
}

export class OudAudio {
  constructor() { this.ctx = null; this.voices = []; this.cache = new Map(); this.volume = 0.85; this.onstate = null; this.ok = !!(window.AudioContext || window.webkitAudioContext); }
  init() {
    if (this.ctx || !this.ok) return this.ctx;
    try { this.ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' }); } catch (e) { this.ok = false; this.onstate && this.onstate('failed'); return null; }
    const ctx = this.ctx; this.sr = ctx.sampleRate; this.rnd = Math.random;
    this.master = ctx.createGain(); this.master.gain.value = this.volume;
    this.out = ctx.createGain(); this.out.gain.value = 1.15;
    const lim = ctx.createDynamicsCompressor(); lim.threshold.value = -10; lim.knee.value = 8; lim.ratio.value = 6; lim.attack.value = 0.003; lim.release.value = 0.2;
    this.out.connect(lim);
    const dry = ctx.createGain(); dry.gain.value = 0.92; const wet = ctx.createGain(); wet.gain.value = 0.16;
    const room = ctx.createConvolver(); room.buffer = this.makeRoom(1.1, 3.2);
    lim.connect(dry); lim.connect(room); room.connect(wet); dry.connect(this.master); wet.connect(this.master); this.master.connect(ctx.destination);
    this.strings = ctx.createGain();
    const direct = ctx.createGain(); direct.gain.value = 0.5;
    const body = ctx.createConvolver(); body.normalize = false; body.buffer = this.makeBody();
    const warm = ctx.createBiquadFilter(); warm.type = 'highshelf'; warm.frequency.value = 4500; warm.gain.value = -5;
    this.strings.connect(direct); this.strings.connect(body); body.connect(warm); direct.connect(warm); warm.connect(this.out);
    return ctx;
  }
  resume() { if (this.ctx && this.ctx.state !== 'running') this.ctx.resume().catch(() => {}); }
  get now() { return this.ctx ? this.ctx.currentTime : performance.now() / 1000; }
  setVolume(v) { this.volume = v; if (this.master) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.03); }
  makeRoom(seconds, decay) {
    const len = Math.floor(this.sr * seconds), ir = this.ctx.createBuffer(2, len, this.sr), rnd = seededRandom(5);
    for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (rnd() * 2 - 1) * Math.pow(1 - i / len, decay); }
    return ir;
  }
  makeBody() {
    const sr = this.sr, len = Math.floor(sr * 0.16), ir = this.ctx.createBuffer(1, len, sr), d = ir.getChannelData(0), rnd = seededRandom(1977);
    const modes = [{ f: 150, q: 9, a: 1.0 }, { f: 222, q: 12, a: 0.85 }, { f: 296, q: 14, a: 0.5 }];
    for (let k = 0; k < 42; k++) { const f = 340 * Math.pow(5200 / 340, (k + rnd() * 0.9) / 42); modes.push({ f, q: 12 + rnd() * 24, a: (0.25 + rnd() * 0.5) / Math.pow(f / 340, 0.55) }); }
    modes.forEach((m, i) => { const tau = m.q / (Math.PI * m.f), ph = rnd() * Math.PI * 2, sign = i % 3 === 1 ? -1 : 1; for (let n = 0; n < len; n++) { const t = n / sr; d[n] += sign * m.a * Math.exp(-t / tau) * Math.sin(2 * Math.PI * m.f * t + ph); } });
    let peak = 0; for (let n = 0; n < len; n++) peak = Math.max(peak, Math.abs(d[n])); for (let n = 0; n < len; n++) d[n] *= 0.055 / peak;
    return ir;
  }
  // مخزن نقرة على مجموعة (وتر مفرد أو زوج)
  makePluck(freq, course, open, dynKey) {
    const sr = this.sr, dyn = DYN[dynKey], rnd = this.rnd, double = course > 0, nylon = course >= 3;
    const baseT60 = [3.6, 3.3, 3.0, 2.7, 2.2, 1.9][course] || 2.4, t60 = open ? baseT60 : baseT60 * 0.58;
    const S = (nylon ? 0.34 : 0.22) + (open ? 0 : 0.07) + (1 - dyn.hard) * 0.08;
    const dur = Math.min(5, t60 * 1.15 + 0.2), len = Math.ceil(dur * sr), out = new Float32Array(len);
    const pick = 0.2 + rnd() * 0.05, common = { t60, S, hard: dyn.hard, amp: 1 };
    renderString(out, 0, freq * Math.pow(2, (double ? -0.9 : 0) / 1200), sr, Object.assign({}, common, { pick }), rnd);
    if (double) { const lag = Math.floor((0.0012 + rnd() * 0.0025) * sr), det = 0.8 + rnd() * 1.4; renderString(out, lag, freq * Math.pow(2, det / 1200), sr, Object.assign({}, common, { pick: pick + 0.015, amp: 0.85 }), rnd); }
    const clickLen = Math.floor(0.004 * sr); let bp1 = 0, bp2 = 0;
    for (let i = 0; i < clickLen; i++) { const e = Math.sin(Math.PI * i / clickLen); bp1 += 0.45 * ((rnd() * 2 - 1) - bp1); bp2 += 0.45 * (bp1 - bp2); out[i] += (bp1 - bp2) * dyn.click * 12 * e; }
    let peak = 0, e = 0; const e0 = Math.floor(0.006 * sr), e1 = Math.min(len, Math.floor(0.16 * sr));
    for (let i = 0; i < len; i++) peak = Math.max(peak, Math.abs(out[i])); for (let i = e0; i < e1; i++) e += out[i] * out[i];
    const rms = Math.sqrt(e / Math.max(1, e1 - e0)) || 1, lowBoost = 1 + 0.12 * (5 - course) / 5, trim = [1, 1, 1, 1, 0.9, 0.55][course] || 1;
    let gain = (0.15 * dyn.amp * lowBoost * trim) / rms; if (peak * gain > 0.9) gain = 0.9 / peak;
    const fade = Math.floor(0.05 * sr); for (let i = 0; i < len; i++) { let v = out[i] * gain; if (i > len - fade) v *= (len - i) / fade; out[i] = v; }
    const buf = this.ctx.createBuffer(1, len, sr); if (buf.copyToChannel) buf.copyToChannel(out, 0); else buf.getChannelData(0).set(out);
    return { buf, t60 };
  }
  bufferFor(course, midi, open, vel) {
    const dk = dynOf(vel), key = `${course}|${Math.round(midi * 2)}|${open ? 1 : 0}|${dk}`;
    let v = this.cache.get(key);
    if (!v || v.used >= 3) {                     // نسخ متعددة قليلة لكل نغمة: لا تتطابق الضربات المتكررة حرفيًا
      const freq = 440 * Math.pow(2, (midi - 69) / 12);
      v = { ...this.makePluck(freq, course, open, dk), used: 0 }; this.cache.set(key, v);
      if (this.cache.size > 160) this.cache.delete(this.cache.keys().next().value);
    }
    v.used++; return v;
  }
  /** تحضير مسبق لنغمات تمرين (لا تأخير عند العزف) */
  prewarm(list) { if (!this.ctx) return; const q = list.slice(); const step = () => { const t0 = performance.now(); while (q.length && performance.now() - t0 < 12) { const [c, m, o, v] = q.shift(); const key = `${c}|${Math.round(m * 2)}|${o ? 1 : 0}|${dynOf(v)}`; if (!this.cache.has(key)) this.bufferFor(c, m, o, v).used = 0; } if (q.length) setTimeout(step, 30); }; step(); }
  /** ضرب مجموعة عند لحظة when (ساعة الصوت): يحل محل الرنين السابق على المجموعة نفسها بتلاشٍ قصير جدًا */
  pluck(course, midi, open, vel = 0.7, when = 0) {
    if (!this.ctx) return null;
    const t = Math.max(this.ctx.currentTime, when || 0);
    this.cut(course, t, 0.006);
    const { buf, t60 } = this.bufferFor(course, midi, open, vel);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const g = this.ctx.createGain(); g.gain.setValueAtTime(1, t);
    let node = g; if (this.ctx.createStereoPanner) { const pan = this.ctx.createStereoPanner(); pan.pan.value = (course - 2.5) * 0.07; g.connect(pan); node = pan; }
    src.connect(g); node.connect(this.strings); src.start(t); src.stop(t + buf.duration + 0.05);
    const v = { src, g, t0: t, t60, active: true, course, midi };
    this.voices[course] = v; this.lastPluck = { course, midi, t };
    return v;
  }
  /** كتم المجموعة (رفع الإصبع أو لمس الوتر) */
  damp(course, when, tau = 0.06) {
    const v = this.voices[course]; if (!v || !v.active || !this.ctx) return;
    const t = Math.max(this.ctx.currentTime, when || 0); v.active = false; holdParam(v.g.gain, t); v.g.gain.setTargetAtTime(0, t, tau);
    try { v.src.stop(t + 0.6); } catch (e) { /* موقوف */ }
  }
  cut(course, t, tau) {
    const v = this.voices[course]; if (!v) return; v.active = false; holdParam(v.g.gain, t); v.g.gain.setTargetAtTime(0, t, tau);
    try { v.src.stop(t + 0.08); } catch (e) { /* موقوف */ }
  }
  stopAll() { if (!this.ctx) return; for (let c = 0; c < 6; c++) this.damp(c, this.ctx.currentTime, 0.05); }
}
