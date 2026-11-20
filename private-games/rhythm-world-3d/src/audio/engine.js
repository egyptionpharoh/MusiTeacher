// =====================================================================
//  محرك الصوت: تسجيلات حقيقية فقط (لا أصوات مولَّدة).
//   • تصفيق / كلافس / بلوك خشبي: من مكتبة VCSL (CC0) — نفس تسجيلات لعبة الإملاء الإيقاعي.
//   • «صوت ممتد»: نغمة كمان حقيقية من VSCO 2 CE (CC0) في _shared/samples/violin، تُقطع عند نهاية قيمة
//     العلامة تمامًا، فيُسمع الفرق بين الصوت الطويل والقصير وبين الصوت والصمت.
//  الجدولة على ساعة AudioContext (دقة أقل من 1 مللي ثانية) مع نافذة استباق 0.2 ثانية.
// =====================================================================
import { FIG, TPB, timeline } from '../data/figures.js';

const FILES = {
  clap: ['clap-a', 'clap-1', 'clap-2'], claves: ['claves-a', 'claves-1'], wood: ['wood-a', 'wood-1'],
};
const SUSTAIN = { url: './_shared/samples/violin/A4.mp3', gain: 0.6 };
export const SOUNDS = { sustain: 'صوت ممتد (كمان)', clap: 'تصفيق', claves: 'كلافس' };

export class Audio {
  constructor() { this.ctx = null; this.buf = {}; this.jobs = {}; this.volume = 0.85; this.sound = 'sustain'; this.voices = new Set(); this.run = null; this.log = []; this.rr = 0; }
  ensure() {
    if (!this.ctx) {
      const C = window.AudioContext || window.webkitAudioContext; if (!C) return null;
      this.ctx = new C({ latencyHint: 'interactive' });
      this.master = this.ctx.createGain(); this.master.gain.value = this.volume;
      const comp = this.ctx.createDynamicsCompressor(); comp.threshold.value = -8; comp.ratio.value = 3; comp.attack.value = 0.003; comp.release.value = 0.15;
      this.master.connect(comp); comp.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    return this.ctx;
  }
  get now() { return this.ctx ? this.ctx.currentTime : 0; }
  setVolume(v) { this.volume = v; if (this.master) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.02); }
  _load(key, url) {
    if (this.buf[key]) return Promise.resolve(this.buf[key]);
    if (!this.jobs[key]) {
      const ctx = this.ensure(); if (!ctx) return Promise.resolve(null);
      this.jobs[key] = fetch(url).then((r) => { if (!r.ok) throw new Error(url); return r.arrayBuffer(); })
        .then((ab) => new Promise((res, rej) => ctx.decodeAudioData(ab, res, rej)))
        .then((b) => { this.buf[key] = this._trim(b); return this.buf[key]; })
        .catch((e) => { console.warn('تعذّر تحميل صوت', e.message); delete this.jobs[key]; return null; });
    }
    return this.jobs[key];
  }
  _trim(b) {   // إزالة صمت ترميز MP3 في أول الملف حتى تبدأ الضربة في موعدها تمامًا
    const d = b.getChannelData(0); let pk = 0; for (let i = 0; i < d.length; i++) { const a = Math.abs(d[i]); if (a > pk) pk = a; }
    let on = 0; const th = pk * 0.04; while (on < d.length && Math.abs(d[on]) < th) on++;
    on = Math.max(0, on - 24); if (on < 48) return b;
    const o = this.ctx.createBuffer(1, d.length - on, b.sampleRate); o.getChannelData(0).set(d.subarray(on)); return o;
  }
  /** يحمّل صوتًا واحدًا (الحالي) والمترونوم — ما يحتاجه العرض فقط */
  load(sound = this.sound) {
    const jobs = [...FILES.wood, ...FILES.claves].map((k) => this._load(k, `./assets/audio/${k}.mp3`));
    if (sound === 'sustain') jobs.push(this._load('sustain', SUSTAIN.url)); else FILES[sound].forEach((k) => jobs.push(this._load(k, `./assets/audio/${k}.mp3`)));
    return Promise.all(jobs).then((r) => r.every(Boolean));
  }
  _src(key, when, gain, dur) {
    const b = this.buf[key]; if (!b) return null;
    const s = this.ctx.createBufferSource(); s.buffer = b; const g = this.ctx.createGain(); g.gain.value = gain;
    s.connect(g); g.connect(this.master);
    if (dur != null) { g.gain.setValueAtTime(gain, when); g.gain.setValueAtTime(gain, Math.max(when, when + dur - 0.035)); g.gain.linearRampToValueAtTime(0.0001, when + dur); s.start(when); s.stop(when + dur + 0.02); }
    else s.start(when);
    const v = { s, g }; this.voices.add(v); s.onended = () => this.voices.delete(v);
    this.log.push({ key, when, dur, at: this.ctx.currentTime }); if (this.log.length > 600) this.log.shift();
    return v;
  }
  /** ضربة/نغمة واحدة: dur بالثواني (للصوت الممتد) · accent للنبر */
  note(when, dur, accent = false, sound = this.sound) {
    if (sound === 'sustain') {
      const b = this.buf.sustain; if (!b) return null;
      const d = Math.min(dur, b.duration - 0.05);
      return this._src('sustain', when, SUSTAIN.gain * (accent ? 1 : 0.8), Math.max(0.06, d - 0.02));
    }
    const list = FILES[sound]; const key = accent ? list[0] : list[1 + (this.rr++ % (list.length - 1))];
    return this._src(key, when, accent ? 1 : 0.85);
  }
  click(when, strong) { return this._src(strong ? 'wood-a' : 'wood-1', when, strong ? 0.55 : 0.4); }
  count(when, strong) { return this._src(strong ? 'claves-a' : 'claves-1', when, 0.7); }
  stopAll() {
    if (this.run) { clearInterval(this.run.timer); this.run.stopped = true; this.run = null; }
    if (!this.ctx) return;
    for (const v of this.voices) { try { v.g.gain.setTargetAtTime(0, this.ctx.currentTime, 0.015); v.s.stop(this.ctx.currentTime + 0.08); } catch (e) { /* انتهى */ } }
    this.voices.clear();
  }

  /**
   * يعزف تسلسل أشكال. opts:
   *   bpm · beatsPerBar (للنبر وللمترونوم) · pulse: نقر النبض · countIn: عدّ تمهيدي (عدد الأزمنة)
   *   loop · sound · onEvent({type:'part'|'beat'|'end', t(ثانية على الساعة), fi, pi, rest, dur, beat})
   * يعيد كائن التشغيل {start, beatDur}.
   */
  play(ids, opts = {}) {
    this.stopAll(); const ctx = this.ensure(); if (!ctx) return null;
    const bpm = opts.bpm || 80, beat = 60 / bpm, tick = beat / TPB, bpb = opts.beatsPerBar || 4;
    const tl = timeline(ids); const total = tl.reduce((a, e) => Math.max(a, e.t + e.d), 0);
    const totalBeats = Math.ceil(total / TPB - 1e-9) || 1;
    const count = opts.countIn ?? 0; const start = ctx.currentTime + 0.12 + count * beat;
    const run = { start, beatDur: beat, total: totalBeats * beat, loopN: 0, stopped: false, ids, events: [] };
    const push = (e) => { run.events.push(e); };
    for (let c = 0; c < count; c++) { this.count(start - (count - c) * beat, c === 0); push({ type: 'count', t: start - (count - c) * beat, n: c + 1 }); }
    let horizon = start, cycle = 0;
    const scheduleCycle = (t0) => {
      tl.forEach((e) => {
        const t = t0 + e.t * tick, dur = e.d * tick, accent = e.t % (bpb * TPB) === 0;
        if (!e.rest) this.note(t, dur, accent, opts.sound || this.sound);
        push({ type: 'part', t, dur, fi: e.fi, pi: e.pi, rest: e.rest, cycle });
      });
      for (let b = 0; b < totalBeats; b++) { const t = t0 + b * beat; if (opts.pulse !== false) this.click(t, b % bpb === 0); push({ type: 'beat', t, beat: b, cycle }); }
      cycle++;
    };
    scheduleCycle(start); horizon = start + totalBeats * beat;
    if (opts.loop) {
      run.timer = setInterval(() => { if (run.stopped) return; while (horizon < ctx.currentTime + 0.4) { scheduleCycle(horizon); horizon += totalBeats * beat; } }, 40);
    } else push({ type: 'end', t: horizon });
    this.run = run; return run;
  }
}
