// =====================================================================
//  المحرك الإيقاعي: مسار مستقل لكل آلة (مستوى صوت + كتم حقيقي)، وجدولة مسبقة على ساعة الصوت نفسها
//  فتبقى كل الآلات متزامنة بدقة العيّنة مهما طال التكرار أو تغيّرت السرعة أو كُتم مسار.
//    المصدر ← كسب الضربة ← كسب المسار (الشريط) ← بوابة الكتم ← الكسب العام ← ضاغط ← المخرج
//  الكتم يغلق «بوابة» المسار خلال أجزاء من الثانية (يشمل ذيل الرنين)، والجدولة تستمر بصمت فلا يتأثر توقيت البقية.
// =====================================================================
import { INSTRUMENTS, allSampleNames } from './data.js';

const LOOKAHEAD = 0.32, TICK_MS = 25, START_DELAY = 0.12;

export class Engine {
  constructor() {
    this.ctx = null; this.buffers = new Map(); this.tracks = []; this.art = null;
    this.playing = false; this.paused = false; this.loop = true; this.bpm = 90; this.volume = 0.9;
    this.unit = 0; this.nextTime = 0; this.timer = null; this.queue = []; this.log = []; this.rr = {};
    this.onStop = null; this.perf = false; this.loadState = 'idle'; this.pending = []; this.loops = 0;
  }
  ensure() {
    if (!this.ctx) {
      const C = window.AudioContext || window.webkitAudioContext; if (!C) return null;
      this.ctx = new C({ latencyHint: 'interactive' });
      this.master = this.ctx.createGain(); this.master.gain.value = this.volume;
      const comp = this.ctx.createDynamicsCompressor(); comp.threshold.value = -8; comp.ratio.value = 4; comp.attack.value = 0.003; comp.release.value = 0.15;
      this.master.connect(comp); comp.connect(this.ctx.destination);
      if (this.art) this.wire();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }
  get now() { return this.ctx ? this.ctx.currentTime : 0; }
  /** تحميل كل العينات مرة واحدة (24 ملفًا صغيرًا ≈ 0.6 م.ب) مع قصّ الصمت في أولها حتى تقع الضربة على زمنها تمامًا */
  load(base = './assets/audio/') {
    if (this.loading) return this.loading;
    const ctx = this.ensure(); if (!ctx) return Promise.resolve(false);
    this.loadState = 'loading';
    this.loading = Promise.all(allSampleNames().map((n) => fetch(`${base}${n}.mp3`).then((r) => { if (!r.ok) throw new Error(n); return r.arrayBuffer(); })
      .then((ab) => ctx.decodeAudioData(ab)).then((b) => this.buffers.set(n, this.trim(b)))))
      .then(() => { this.loadState = 'ready'; return true; })
      .catch((e) => { console.warn('تعذّر تحميل صوت', e.message); this.loadState = 'failed'; this.loading = null; return false; });
    return this.loading;
  }
  trim(buf) {
    const d = buf.getChannelData(0); let pk = 0; for (let i = 0; i < d.length; i++) { const a = Math.abs(d[i]); if (a > pk) pk = a; }
    let on = 0; const th = pk * 0.04; while (on < d.length && Math.abs(d[on]) < th) on++;
    on = Math.max(0, on - 24); if (on < 48) return buf;
    const out = this.ctx.createBuffer(1, d.length - on, buf.sampleRate); out.getChannelData(0).set(d.subarray(on)); return out;
  }

  // ---------- المسارات ----------
  setArt(art) {
    this.stop(); this.unwire();
    this.art = art; this.bpm = art.bpm.v;
    this.tracks = art.tracks.map((t) => ({ id: t.inst, info: t.info, hits: t.hits, byUnit: new Map(t.hits.map((h) => [h.u, h])), entry: t.entry || null, vol: 0.85, mute: false, solo: false, gainNode: null, gate: null, last: null }));
    if (this.ctx) this.wire();
  }
  wire() {
    for (const t of this.tracks) {
      t.gainNode = this.ctx.createGain(); t.gainNode.gain.value = t.vol;
      t.gate = this.ctx.createGain(); t.gate.gain.value = this.audible(t) ? 1 : 0;
      t.gainNode.connect(t.gate); t.gate.connect(this.master);
    }
  }
  unwire() { for (const t of this.tracks) { try { t.gate && t.gate.disconnect(); t.gainNode && t.gainNode.disconnect(); } catch (e) { /* */ } } }
  track(id) { return this.tracks.find((t) => t.id === id); }
  /** مسموع؟ إن وُجد «منفرد» فالمسموع هو المنفرد فقط، وإلا فكل ما ليس مكتومًا */
  audible(t) { const anySolo = this.tracks.some((x) => x.solo); return anySolo ? t.solo : !t.mute; }
  applyGates() { if (!this.ctx) return; const now = this.ctx.currentTime; for (const t of this.tracks) { const g = t.gate.gain; g.cancelScheduledValues(now); g.setTargetAtTime(this.audible(t) ? 1 : 0, now, 0.006); } }
  setMute(id, v) { const t = this.track(id); if (t) { t.mute = v; this.applyGates(); } }
  setSolo(id, v) { const t = this.track(id); if (t) { t.solo = v; this.applyGates(); } }
  clearSolo() { for (const t of this.tracks) t.solo = false; this.applyGates(); }
  resetMix() { for (const t of this.tracks) { t.solo = false; t.mute = false; } this.applyGates(); }
  setVol(id, v) { const t = this.track(id); if (!t) return; t.vol = v; if (t.gainNode) t.gainNode.gain.setTargetAtTime(v, this.ctx.currentTime, 0.015); }
  setVolume(v) { this.volume = v; if (this.master) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.02); }
  setBpm(v) { this.bpm = Math.max(30, Math.min(300, v)); }
  get secPerUnit() { return 60 / this.bpm / this.art.upb; }

  // ---------- العزف ----------
  /** ضربة واحدة على مسار. when على ساعة الصوت. */
  hit(t, k, when, acc) {
    const inst = t.info, names = inst.samples[k], rk = `${t.id}_${k}`;
    const i = (this.rr[rk] = ((this.rr[rk] ?? -1) + 1) % names.length);
    const buf = this.buffers.get(names[i]); if (!buf) return;
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    src.playbackRate.value = (inst.rate || 1) * (k === 'T' && inst.rateT ? inst.rateT : 1);
    const g = this.ctx.createGain(); g.gain.value = (inst.gain || 1) * (acc ? 1.25 : 0.92);
    src.connect(g); g.connect(t.gainNode);
    // الجلد الواحد لا يرنّ برنينين: الضربة الجديدة تُخمد ذيل السابقة على الآلة نفسها (بلا طقطقة)
    const prev = t.last; if (prev && prev.end > when) { try { prev.g.gain.setTargetAtTime(0, when, 0.03); prev.src.stop(when + 0.3); } catch (e) { /* */ } }
    if (inst.choke && k === 'T') { g.gain.setTargetAtTime(0, when + inst.choke * 0.4, inst.choke * 0.3); }
    t.last = { src, g, end: when + buf.duration / src.playbackRate.value };
    src.start(when);
    this.pending.push({ src, g, when }); if (this.pending.length > 96) this.pending.splice(0, 48);
  }
  /** نقرة فورية على آلة (للتعرّف على صوتها من بطاقتها) — تتجاوز الكتم عمدًا */
  tap(id, k = 'D') {
    const ctx = this.ensure(); const t = this.track(id); if (!ctx || !t) return;
    const names = t.info.samples[k], buf = this.buffers.get(names[0]); if (!buf) return;
    const src = ctx.createBufferSource(); src.buffer = buf; src.playbackRate.value = (t.info.rate || 1) * (k === 'T' && t.info.rateT ? t.info.rateT : 1);
    const g = ctx.createGain(); g.gain.value = (t.info.gain || 1) * t.vol; src.connect(g); g.connect(this.master); src.start();
    if (t.info.choke && k === 'T') g.gain.setTargetAtTime(0, ctx.currentTime + t.info.choke * 0.4, t.info.choke * 0.3);
  }
  play(fromStart = true) {
    const ctx = this.ensure(); if (!ctx || !this.art) return false;
    if (this.playing) return true;
    if (fromStart || !this.paused) { this.unit = 0; this.loops = 0; this.log = []; }
    this.playing = true; this.paused = false; this.queue = []; this.cur = null; this.nextTime = ctx.currentTime + START_DELAY;
    this.tick(); this.timer = setInterval(() => this.tick(), TICK_MS);
    return true;
  }
  tick() {
    if (!this.playing) return;
    const ctx = this.ctx, horizon = ctx.currentTime + LOOKAHEAD;
    while (this.nextTime < horizon) {
      const u = this.unit, when = this.nextTime;
      for (const t of this.tracks) { const h = t.byUnit.get(u); if (h && this.enters(t, u)) { this.hit(t, h.k, when, h.acc); this.log.push({ inst: t.id, k: h.k, u, loop: this.loops, when }); } }
      if (this.log.length > 4000) this.log.splice(0, 2000);
      this.queue.push({ u, when, loop: this.loops });
      this.nextTime += this.secPerUnit; this.unit++;
      if (this.unit >= this.art.total) {
        this.unit = 0; this.loops++;
        if (!this.loop) { this.endAt = this.nextTime; clearInterval(this.timer); this.timer = null; setTimeout(() => { if (this.playing && this.endAt) this.stop(true); }, Math.max(0, (this.nextTime - ctx.currentTime) * 1000 + 120)); return; }
      }
    }
  }
  /**
   * الموضع الحالي المسموع (بالدوبل كروش، مع كسر) + ما مرّ من خانات منذ النداء السابق (passed)
   * — لتحريك المؤشر والإضاءة وحركة الآلات بالتزامن مع الصوت الفعلي لا مع لحظة الجدولة.
   */
  position() {
    if (!this.playing || !this.ctx) return null;
    const now = this.ctx.currentTime, passed = [];
    while (this.queue.length && this.queue[0].when <= now) { this.cur = this.queue.shift(); passed.push(this.cur); }
    if (!this.cur) return { u: 0, frac: 0, pre: true, passed };
    return { u: this.cur.u, frac: Math.min(0.999, (now - this.cur.when) / this.secPerUnit), loop: this.cur.loop, passed };
  }
  /** خيار «أداء كما في وصف الدليل»: آلة لها entry تصمت حتى الدورة entry.loop، وتدخل قبلها بالأناكروز من الخانة entry.pickup */
  enters(t, u) { const e = t.entry; if (!this.perf || !e) return true; return this.loops >= e.loop || (this.loops === e.loop - 1 && u >= e.pickup); }
  pause() {
    if (!this.playing) return;
    const p = this.cur ? { u: this.cur.u } : null; clearInterval(this.timer); this.timer = null; this.playing = false; this.paused = true; this.endAt = 0;
    // الضربات المجدولة مسبقًا (≤ 0.14 ث) تُسكَت، ويُستأنف من بداية النبضة الحالية
    this.silenceScheduled(); this.unit = p ? Math.floor(p.u / this.art.upb) * this.art.upb : 0; this.queue = []; this.cur = null;
  }
  silenceScheduled() {
    // كل ضربة مجدولة ولم تبدأ تُلغى، وكل ضربة ترنّ تُخمد بسرعة — دون المساس ببوابات الكتم
    if (!this.ctx) return; const now = this.ctx.currentTime;
    for (const p of this.pending) { try { if (p.when > now) { p.g.gain.value = 0; p.src.stop(0); } else { p.g.gain.cancelScheduledValues(now); p.g.gain.setTargetAtTime(0, now, 0.02); p.src.stop(now + 0.2); } } catch (e) { /* */ } }
    this.pending = []; for (const t of this.tracks) t.last = null;
  }
  stop(natural = false) {
    const was = this.playing || this.paused;
    clearInterval(this.timer); this.timer = null;
    if (this.playing && !natural) this.silenceScheduled();
    this.playing = false; this.paused = false; this.unit = 0; this.queue = []; this.cur = null; this.endAt = 0;
    if (was && this.onStop) this.onStop(natural);
  }
}
