// محرّك صوت بسيط: يحمّل تسجيلات الآلة عند فتحها فقط، ويعزفها فورًا أو في موعد محدد على ساعة الصوت.
export class AudioEngine {
  constructor() { this.ctx = null; this.buf = new Map(); this.jobs = new Map(); this.rr = {}; this.groups = {}; this.volume = 0.9; this.log = []; }
  ensure() {
    if (!this.ctx) {
      const C = window.AudioContext || window.webkitAudioContext; if (!C) return null;
      this.ctx = new C({ latencyHint: 'interactive' });
      this.master = this.ctx.createGain(); this.master.gain.value = this.volume;
      const comp = this.ctx.createDynamicsCompressor(); comp.threshold.value = -6; comp.ratio.value = 4; comp.attack.value = 0.002; comp.release.value = 0.15;
      this.master.connect(comp); comp.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }
  get now() { return this.ctx ? this.ctx.currentTime : 0; }
  setVolume(v) { this.volume = v; if (this.master) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.02); }
  load(keys) {
    const ctx = this.ensure(); if (!ctx) return Promise.resolve(false);
    return Promise.all(keys.map((k) => {
      if (!this.jobs.has(k)) this.jobs.set(k, fetch(`./assets/audio/${k}.mp3`).then((r) => { if (!r.ok) throw new Error(k); return r.arrayBuffer(); }).then((ab) => ctx.decodeAudioData(ab)).then((b) => { this.buf.set(k, this.trim(b)); }));
      return this.jobs.get(k);
    })).then(() => true).catch((e) => { console.warn('تعذّر تحميل صوت', e.message); this.jobs.delete(e.message); return false; });
  }
  trim(b) {   // يزيل صمت ترميز mp3 في أول الملف حتى تبدأ الضربة لحظة النقر
    const d = b.getChannelData(0); let pk = 0; for (let i = 0; i < d.length; i++) { const a = Math.abs(d[i]); if (a > pk) pk = a; }
    let on = 0; const th = pk * 0.04; while (on < d.length && Math.abs(d[on]) < th) on++;
    on = Math.max(0, on - 32); if (on < 64) return b;
    const o = this.ctx.createBuffer(1, d.length - on, b.sampleRate); o.getChannelData(0).set(d.subarray(on)); return o;
  }
  /** keys: لقطة أو عدة لقطات تتناوب. opt: when · gain · rate · group (يُخمد الصوت السابق في المجموعة نفسها) */
  play(keys, opt = {}) {
    const ctx = this.ensure(); if (!ctx) return null;
    const list = Array.isArray(keys) ? keys : [keys]; const id = list.join('|'); const i = (this.rr[id] = ((this.rr[id] ?? -1) + 1) % list.length);
    const b = this.buf.get(list[i]); if (!b) return null;
    const when = Math.max(opt.when ?? 0, ctx.currentTime);
    const src = ctx.createBufferSource(); src.buffer = b; if (opt.rate) src.playbackRate.value = opt.rate;
    if (opt.loop && b.duration > opt.loop[0] + opt.loop[1] + 0.3) { src.loop = true; src.loopStart = opt.loop[0]; src.loopEnd = b.duration - opt.loop[1]; }
    const g = ctx.createGain(); g.gain.value = opt.gain ?? 1; src.connect(g); g.connect(this.master);
    const v = { src, g, end: when + b.duration / (opt.rate || 1), stop: (t = 0.04) => { try { g.gain.setTargetAtTime(0, Math.max(when, ctx.currentTime), t); src.stop(Math.max(when, ctx.currentTime) + t * 6); } catch (e) { /* انتهى */ } } };
    if (opt.group) { const p = this.groups[opt.group]; if (p && p.end > when) { try { p.g.gain.setTargetAtTime(0, when, opt.fade ?? 0.03); p.src.stop(when + 0.3); } catch (e) { /* انتهى */ } } this.groups[opt.group] = v; }
    src.start(when);
    this.log.push({ key: list[i], when, at: ctx.currentTime, rate: opt.rate || 1 }); if (this.log.length > 500) this.log.shift();
    return v;
  }
  choke(group, t = 0.05) { const p = this.groups[group]; if (p) p.stop(t); }
  stopAll() { for (const k in this.groups) this.groups[k].stop(0.03); this.groups = {}; }
}
