// =====================================================================
//  محرّك الصوت: تسجيلات حقيقية لكل آلة (دُم/تك × قوية/خفيفة × لقطتان)، تشغيل فوري وجدولة دقيقة على ساعة الصوت.
// =====================================================================
import { sampleUrl } from '../data/instruments.js';

export class AudioEngine {
  constructor() { this.ctx = null; this.master = null; this.buffers = new Map(); this.loading = new Map(); this.rr = {}; this.voices = {}; this.pending = []; this.volume = 0.9; this.log = []; }
  ensure() {
    if (!this.ctx) {
      const C = window.AudioContext || window.webkitAudioContext; if (!C) return null;
      this.ctx = new C({ latencyHint: 'interactive' });
      this.master = this.ctx.createGain(); this.master.gain.value = this.volume;
      const comp = this.ctx.createDynamicsCompressor(); comp.threshold.value = -6; comp.ratio.value = 4; comp.attack.value = 0.002; comp.release.value = 0.12;   // يمنع التشبّع عند تراكب الضربات السريعة
      this.master.connect(comp); comp.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }
  get now() { return this.ctx ? this.ctx.currentTime : 0; }
  setVolume(v) { this.volume = v; if (this.master) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.02); }
  /** يحمّل تسجيلات آلة واحدة (8 ملفات صغيرة) ويزيل الصمت في أولها حتى تبدأ الضربة لحظة النقر */
  load(inst) {
    if (this.loading.has(inst.id)) return this.loading.get(inst.id);
    const ctx = this.ensure(); if (!ctx) return Promise.resolve(false);
    const jobs = [];
    for (const stroke of ['dum', 'tak']) for (const level of ['s', 'w']) for (let t = 1; t <= inst.takes; t++) {
      const key = `${inst.id}_${stroke}_${level}${t}`;
      jobs.push(fetch(sampleUrl(inst, stroke, level, t)).then((r) => { if (!r.ok) throw new Error(key); return r.arrayBuffer(); })
        .then((ab) => ctx.decodeAudioData(ab)).then((buf) => { this.buffers.set(key, this.trim(buf)); }));
    }
    const p = Promise.all(jobs).then(() => true).catch((e) => { console.warn('تعذّر تحميل صوت', e.message); this.loading.delete(inst.id); return false; });
    this.loading.set(inst.id, p); return p;
  }
  trim(buf) {
    const d = buf.getChannelData(0); let pk = 0; for (let i = 0; i < d.length; i++) { const a = Math.abs(d[i]); if (a > pk) pk = a; }
    let on = 0; const th = pk * 0.04; while (on < d.length && Math.abs(d[on]) < th) on++;
    on = Math.max(0, on - 32); if (on < 64) return buf;
    const out = this.ctx.createBuffer(1, d.length - on, buf.sampleRate); out.getChannelData(0).set(d.subarray(on)); return out;
  }
  ready(inst) { return this.buffers.has(`${inst.id}_dum_s1`) && this.buffers.has(`${inst.id}_tak_w${inst.takes}`); }
  /**
   * يعزف ضربة. opt: when (زمن على ساعة الصوت؛ الافتراضي الآن) · rho موضع الضرب 0..1 · gain
   * موضع الضرب يغيّر اللون قليلًا: الضرب أقرب إلى الحافة أنحف وأقصر رنينًا (مرشّح عالٍ خفيف)، كما في الجلد الحقيقي.
   */
  hit(inst, stroke, level = 's', opt = {}) {
    const ctx = this.ensure(); if (!ctx) return null;
    const rk = `${inst.id}_${stroke}_${level}`; const take = (this.rr[rk] = ((this.rr[rk] || 0) % inst.takes) + 1);
    const buf = this.buffers.get(`${rk}${take}`); if (!buf) return null;
    const when = Math.max(opt.when ?? 0, ctx.currentTime);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const g = ctx.createGain(); g.gain.value = opt.gain ?? 1;
    let node = src;
    if (opt.rho != null) { const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 20 + 160 * Math.max(0, opt.rho - 0.15); f.Q.value = 0.5; src.connect(f); node = f; }
    node.connect(g); g.connect(this.master);
    // الجلد الواحد لا يرنّ برنينين: الضربة الجديدة تُخمد ذيل السابقة من النوع نفسه بسرعة (بلا طقطقة)
    const vk = `${inst.id}_${stroke}`, prev = this.voices[vk];
    if (prev && prev.end > when) { try { prev.g.gain.setTargetAtTime(0, when, 0.03); prev.src.stop(when + 0.25); } catch (e) { /* انتهى */ } }
    this.voices[vk] = { src, g, end: when + buf.duration };
    // كل مصدر مجدول يُحفظ حتى ينتهي، ليمكن إلغاء ما جُدول مسبقًا عند الإيقاف (لا ضربات «شبحية» بعد الإيقاف)
    this.pending = this.pending.filter((v) => v.end > ctx.currentTime); this.pending.push({ src, g, end: when + buf.duration });
    src.start(when);
    this.log.push({ inst: inst.id, stroke, level, take, when, at: ctx.currentTime }); if (this.log.length > 400) this.log.shift();
    return when;
  }
  stopAll() {
    if (!this.ctx) return; const t = this.ctx.currentTime;
    for (const v of this.pending) { try { v.g.gain.cancelScheduledValues(t); v.g.gain.setTargetAtTime(0, t, 0.02); v.src.stop(t + 0.15); } catch (e) { /* انتهى */ } }
    this.pending = []; this.voices = {};
  }
  /** زمن الصوت المسموع فعلًا الآن (بعد تأخير المخرج) — تُرسم عليه الحركة لتتزامن مع ما يُسمع */
  get heardNow() { if (!this.ctx) return 0; return this.ctx.currentTime - (this.ctx.outputLatency || this.ctx.baseLatency || 0); }
}
