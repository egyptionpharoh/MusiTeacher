// =====================================================================
//  الصوت: تسجيلات حقيقية فقط لأصوات الأسئلة (بيانو Salamander، كمان VSCO، أكورديون FluidR3، إكسيليفون VSCO،
//  طبلة ورق VCSL، آلات الباند VCSL/MuseScore) — المصادر في CREDITS.md.
//  مؤثرات اللعب (المحرك، الرياح، الانطلاق) مولّدة بالـ Web Audio لأنها ليست آلات موسيقية.
//  ثلاث قنوات: «الراديو» (السؤال) + المؤثرات + المحرك؛ والمحرك والمؤثرات تنخفض تلقائيًا أثناء السؤال.
// =====================================================================
import { FIG, timeline, TPB } from '../data/figures.js';
import { INSTRUMENTS, PIECES } from '../data/content.js';

// العينات المستخدمة من الموارد المشتركة (_shared/samples) — بأسماء ملفاتها كما في manifest.json
const SETS = {
  piano: { dir: './_shared/samples/salamander/', notes: { A3: 57, C4: 60, Ds4: 63, Fs4: 66, A4: 69, C5: 72, Ds5: 75, Fs5: 78, A5: 81, C6: 84 }, gains: { A3: 2.314, C4: 1.501, Ds4: 1.344, Fs4: 1.828, A4: 2.189, C5: 4.0, Ds5: 3.089, Fs5: 2.163, A5: 2.475, C6: 1.981 }, kind: 'decay', level: 0.5 },
  violin: { dir: './_shared/samples/violin/', notes: { G3: 55, A3: 57, C4: 60, E4: 64, G4: 67, A4: 69, C5: 72, E5: 76, G5: 79, A5: 81 }, gains: { G3: 0.508, A3: 0.638, C4: 0.476, E4: 0.65, G4: 0.679, A4: 0.595, C5: 0.585, E5: 0.631, G5: 0.616, A5: 0.477 }, kind: 'sustain', level: 1.6 },
  accordion: { dir: './_shared/samples/accordion/', notes: { A3: 57, C4: 60, Eb4: 63, Gb4: 66, A4: 69, C5: 72, Eb5: 75 }, gains: {}, kind: 'sustain', level: 0.8 },
  xylophone: { dir: './_shared/samples/xylophone/', notes: { G4: 67, C5: 72, G5: 79, C6: 84 }, gains: { G4: 0.795, C5: 0.793, G5: 0.812, C6: 0.795 }, kind: 'decay', level: 1.2 },
};

export class GameAudio {
  constructor() { this.ctx = null; this.buf = new Map(); this.loading = new Map(); this.active = []; this.vol = { master: 0.9, music: 1, sfx: 0.7, engine: 0.45 }; this.muted = false; this.questionUntil = 0; }
  ensure() {
    if (!this.ctx) {
      const C = window.AudioContext || window.webkitAudioContext; if (!C) return null;
      const ctx = this.ctx = new C({ latencyHint: 'interactive' });
      this.master = ctx.createGain(); this.master.gain.value = this.vol.master;
      const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -8; comp.ratio.value = 3.5;
      this.master.connect(comp); comp.connect(ctx.destination);
      this.music = ctx.createGain(); this.music.gain.value = this.vol.music; this.music.connect(this.master);
      this.sfx = ctx.createGain(); this.sfx.gain.value = this.vol.sfx; this.sfx.connect(this.master);
      this.engBus = ctx.createGain(); this.engBus.gain.value = 0; this.engBus.connect(this.master);
      this._engine();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }
  get now() { return this.ctx ? this.ctx.currentTime : 0; }
  setVolume(k, v) { this.vol[k] = v; if (!this.ctx) return; const n = { master: this.master, music: this.music, sfx: this.sfx }[k]; if (n) n.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05); }
  setMuted(m) { this.muted = m; if (this.master) this.master.gain.setTargetAtTime(m ? 0 : this.vol.master, this.ctx.currentTime, 0.05); }

  // ------------------------------------------------------------ التحميل
  async load(url) {
    if (this.buf.has(url)) return this.buf.get(url);
    if (this.loading.has(url)) return this.loading.get(url);
    const ctx = this.ensure(); if (!ctx) return null;
    const p = fetch(url).then((r) => { if (!r.ok) throw new Error(url + ' ' + r.status); return r.arrayBuffer(); })
      .then((ab) => ctx.decodeAudioData(ab)).then((b) => { const t = this._trim(b); this.buf.set(url, t); return t; })
      .catch((e) => { console.warn('[audio]', e.message); this.loading.delete(url); return null; });
    this.loading.set(url, p); return p;
  }
  _trim(buf) {
    const d = buf.getChannelData(0); let pk = 0; for (let i = 0; i < d.length; i++) pk = Math.max(pk, Math.abs(d[i]));
    let on = 0; const th = pk * 0.03; while (on < d.length && Math.abs(d[on]) < th) on++;
    on = Math.max(0, on - 64); if (on < 128) return buf;
    const out = this.ctx.createBuffer(buf.numberOfChannels, buf.length - on, buf.sampleRate);
    for (let c = 0; c < buf.numberOfChannels; c++) out.getChannelData(c).set(buf.getChannelData(c).subarray(on));
    return out;
  }
  setUrl(set, name) { return SETS[set].dir + name + '.mp3'; }
  async loadSet(set, midis) {
    const S = SETS[set]; if (!S) return;
    const names = Object.keys(S.notes).filter((n) => !midis || midis.some((m) => Math.abs(S.notes[n] - m) <= 4));
    await Promise.all(names.map((n) => this.load(this.setUrl(set, n))));
  }
  /** يحمّل مسبقًا كل ما يحتاجه تحدٍّ (قبل وصول السائق إليه) */
  async preload(spec) {
    if (!spec) return true;
    const k = spec.kind;
    if (k === 'url') return !!(await this.load(spec.url));                // تسجيل رفعه المعلم: يجب أن يُفكّ بنجاح
    if (k === 'rhythm' || k === 'meter') await Promise.all(['band/wood-1', 'band/wood-a', 'band/claves-1', 'band/claves-a'].map((f) => this.load(`./assets/audio/${f}.mp3`)));
    else if (k === 'perc' || k === 'durub') await this.loadPerc(spec.inst || 'tabla');
    else if (k === 'notes' || k === 'scale') await this.loadSet(spec.set, spec.notes.map((n) => n.midi));
    else if (k === 'inst') { const P = INSTRUMENTS[spec.inst].play; if (P.kind === 'melody') await this.loadSet(P.set, [72, 76, 79, 84]); else if (P.kind === 'perc') await this.loadPerc(P.inst); else await Promise.all([P.file, P.alt].filter(Boolean).map((f) => this.load(`./assets/audio/${f}.mp3`))); }
  }
  loadPerc(inst) { const jobs = []; for (const s of ['dum', 'tak']) for (const l of ['s', 'w']) for (const t of [1, 2]) jobs.push(this.load(`./assets/audio/perc/${inst}_${s}_${l}${t}.mp3`)); return Promise.all(jobs); }
  async preloadSfx() { await Promise.all(['band/glock_medium_C5', 'band/glock_medium_G5', 'band/cymbals_short1', 'band/bass_s1', 'band/snare_s1', 'band/claves-a', 'band/claves-1'].map((f) => this.load(`./assets/audio/${f}.mp3`))); }

  // ------------------------------------------------------------ التشغيل الأساسي
  play(buffer, when, o = {}) {
    if (!buffer) return null;
    const ctx = this.ctx, src = ctx.createBufferSource(); src.buffer = buffer;
    if (o.rate) src.playbackRate.value = o.rate;
    const g = ctx.createGain(); const lv = o.gain ?? 1;
    if (o.dur != null) {
      g.gain.setValueAtTime(0, when); g.gain.linearRampToValueAtTime(lv, when + (o.attack ?? 0.012));
      const end = when + o.dur; g.gain.setValueAtTime(lv, end); g.gain.exponentialRampToValueAtTime(0.0008, end + (o.release ?? 0.25));
    } else g.gain.value = lv;
    src.connect(g); g.connect(o.out || this.music); src.start(when);
    if (o.dur != null) src.stop(when + o.dur + (o.release ?? 0.25) + 0.05);
    const v = { src, g, end: when + (o.dur != null ? o.dur + 0.3 : buffer.duration / (o.rate || 1)) };
    this.active.push(v); return v;
  }
  /** نغمة من مجموعة عينات بأقرب عينة وإزاحة الطبقة (cents للربع تون) */
  note(set, midi, when, dur, o = {}) {
    const S = SETS[set]; if (!S) return null;
    let best = null, bd = 1e9;
    for (const n in S.notes) { const url = this.setUrl(set, n); if (!this.buf.has(url)) continue; const d = Math.abs(S.notes[n] - midi); if (d < bd) { bd = d; best = n; } }
    if (!best) return null;
    const rate = Math.pow(2, ((midi - S.notes[best]) * 100 + (o.cents || 0)) / 1200);
    const gain = (S.gains[best] ? 1 / Math.max(0.4, S.gains[best]) : 1) * S.level * (o.gain ?? 1);
    return this.play(this.buf.get(this.setUrl(set, best)), when, { rate, gain: Math.min(2.2, gain), dur: S.kind === 'decay' ? Math.max(dur, 1.2) : dur, attack: S.kind === 'sustain' ? 0.04 : 0.005, release: S.kind === 'decay' ? 0.8 : 0.22 });
  }
  file(name, when, o = {}) { return this.play(this.buf.get(`./assets/audio/${name}.mp3`), when, o); }
  perc(inst, k, when, acc) { const lv = acc ? 's' : 'w', t = 1 + Math.floor(Math.random() * 2); return this.play(this.buf.get(`./assets/audio/perc/${inst}_${k === 'D' ? 'dum' : 'tak'}_${lv}${t}.mp3`), when, { gain: acc ? 1 : 0.85 }); }
  stopQuestion() { const t = this.now; for (const v of this.active) { try { v.g.gain.cancelScheduledValues(t); v.g.gain.setTargetAtTime(0, t, 0.03); v.src.stop(t + 0.15); } catch (e) { /* */ } } this.active = []; this.questionUntil = 0; this._duck(false); }

  // ------------------------------------------------------------ تشغيل سؤال
  /** يعيد مدة التشغيل بالثواني (0 إن لم يوجد صوت) */
  async playSpec(spec, onBeat) {
    if (!spec) return 0;
    this.ensure(); await this.preload(spec);
    this.stopQuestion();
    const t0 = this.now + 0.12; let dur = 0;
    const k = spec.kind;
    if (k === 'rhythm') {
      const bpm = spec.bpm || 80, beat = 60 / bpm, bpb = spec.beatsPerBar || 4, ci = spec.countIn ?? 0;
      for (let i = 0; i < ci; i++) this.file(i === 0 ? 'band/claves-a' : 'band/claves-1', t0 + i * beat, { gain: 0.55 });
      const start = t0 + ci * beat;
      const tl = timeline(spec.ids), total = spec.ids.reduce((a, id) => a + FIG[id].ticks, 0);
      for (const e of tl) if (!e.rest) this.file(e.t % (bpb * TPB) === 0 ? 'band/wood-a' : 'band/wood-1', start + (e.t / TPB) * beat, { gain: 0.95 });
      // نبض خفيف مع الإيقاع (يساعد على عدّ الأزمنة)
      for (let b = 0; b < total / TPB; b++) this.file('band/claves-1', start + b * beat, { gain: 0.16 });
      dur = ci * beat + (total / TPB) * beat + 0.4;
    } else if (k === 'meter') {
      const [n, d] = spec.meter, bpm = spec.bpm || 96, beat = 60 / bpm;
      const pulses = n, bars = spec.bars || 4;
      for (let b = 0; b < bars; b++) for (let i = 0; i < pulses; i++) {
        const strong = i === 0, mid = (n === 4 && i === 2) || (n === 6 && i === 3);
        const t = t0 + (b * pulses + i) * beat;
        if (strong) { this.file('band/claves-a', t, { gain: 1 }); this.file('band/wood-a', t, { gain: 0.35 }); }
        else this.file(mid ? 'band/claves-a' : 'band/claves-1', t, { gain: mid ? 0.5 : 0.42 });
        if (onBeat) setTimeout(() => onBeat(i, strong), (t - this.now) * 1000);
      }
      dur = bars * pulses * beat + 0.3;
    } else if (k === 'perc') {
      for (const h of spec.hits) this.perc(spec.inst || 'tabla', h.k, t0 + h.t, h.acc !== false);
      dur = spec.hits[spec.hits.length - 1].t + 0.8;
    } else if (k === 'durub') {
      const P = PIECES.find((p) => p.id === spec.piece); if (!P) return 0;
      const unit = 60 / P.bpm / (P.meter[1] === 8 ? 2 : 4);
      const cyc = P.total * unit;
      for (let c = 0; c < (spec.cycles || 2); c++) for (const h of P.hits) this.perc('tabla', h.k, t0 + c * cyc + h.u * unit, h.acc || h.k === 'D');
      dur = cyc * (spec.cycles || 2) + 0.5;
    } else if (k === 'notes') {
      for (const n of spec.notes) this.note(spec.set, n.midi, t0 + n.t, n.d, { cents: n.cents });
      const last = spec.notes[spec.notes.length - 1]; dur = last.t + last.d + 0.6;
    } else if (k === 'scale') {
      const st = spec.step || 0.42;
      spec.notes.forEach((n, i) => this.note(spec.set, n.midi, t0 + i * st, i === spec.notes.length - 1 ? 1.2 : st * 1.05, { cents: n.cents }));
      dur = spec.notes.length * st + 1.4;
    } else if (k === 'url') {
      const b = this.buf.get(spec.url); if (!b) return 0;
      this.play(b, t0, { gain: 1 }); dur = Math.min(b.duration, 40) + 0.2;
    } else if (k === 'inst') {
      const I = INSTRUMENTS[spec.inst], P = I.play;
      if (P.kind === 'melody') { const mel = [72, 76, 79, 84, 79, 76, 72]; mel.forEach((m, i) => this.note(P.set, P.set === 'xylophone' ? m : m - (P.set === 'violin' ? 0 : 0), t0 + i * 0.36, i === mel.length - 1 ? 1.0 : 0.34)); dur = mel.length * 0.36 + 1.2; }
      else if (P.kind === 'perc') { const pat = 'DTTDTT'; [...pat].forEach((c, i) => this.perc(P.inst, c, t0 + i * 0.3, i % 3 === 0)); dur = 2.4; }
      else { const times = P.slow ? [0, 0.9, 1.8] : [0, 0.4, 0.8, 1.0, 1.2, 1.6]; times.forEach((t, i) => this.file(P.alt && i % 2 ? P.alt : P.file, t0 + t, { gain: 0.9 })); dur = times[times.length - 1] + 1.0; }
    }
    this.questionUntil = t0 + dur;
    this._duck(true); clearTimeout(this._dt); this._dt = setTimeout(() => this._duck(false), (dur + 0.2) * 1000);
    return dur;
  }

  // ------------------------------------------------------------ المحرك (مولّد)
  _engine() {
    const ctx = this.ctx;
    const o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), lp = ctx.createBiquadFilter(), g = ctx.createGain();
    o1.type = 'sawtooth'; o2.type = 'square'; o2.detune.value = -1200 + 7;
    lp.type = 'lowpass'; lp.frequency.value = 600; lp.Q.value = 2;
    const g2 = ctx.createGain(); g2.gain.value = 0.35;
    o1.connect(lp); o2.connect(g2); g2.connect(lp); lp.connect(g); g.gain.value = 0.18; g.connect(this.engBus);
    // ضجيج الرياح
    const n = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), d = n.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const ns = ctx.createBufferSource(); ns.buffer = n; ns.loop = true; const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 0.6; const ng = ctx.createGain(); ng.gain.value = 0;
    ns.connect(bp); bp.connect(ng); ng.connect(this.engBus);
    o1.start(); o2.start(); ns.start();
    this.eng = { o1, o2, lp, wind: ng, bp };
  }
  /** speed: م/ث ، kind: car|moto ، on: هل يعمل المحرك */
  engine(speed, kind, on) {
    if (!this.ctx || !this.eng) return;
    const t = this.ctx.currentTime, e = this.eng;
    const base = kind === 'moto' ? 70 : 46, f = base + speed * (kind === 'moto' ? 4.2 : 3.1);
    e.o1.frequency.setTargetAtTime(f, t, 0.08); e.o2.frequency.setTargetAtTime(f, t, 0.08);
    e.lp.frequency.setTargetAtTime(380 + speed * 22, t, 0.1);
    e.wind.gain.setTargetAtTime(Math.min(0.16, speed * 0.0035), t, 0.2); e.bp.frequency.setTargetAtTime(500 + speed * 18, t, 0.2);
    const duck = this.questionUntil > t ? 0.22 : 1;
    this.engBus.gain.setTargetAtTime(on && !this.muted ? this.vol.engine * duck : 0, t, 0.15);
  }
  _duck(on) { if (!this.ctx) return; this.sfx.gain.setTargetAtTime(on ? this.vol.sfx * 0.5 : this.vol.sfx, this.ctx.currentTime, 0.1); }

  // ------------------------------------------------------------ مؤثرات
  correct() { const t = this.now + 0.01; this.file('band/glock_medium_C5', t, { gain: 0.8, out: this.sfx }); this.file('band/glock_medium_G5', t + 0.11, { gain: 0.8, out: this.sfx }); this.file('band/glock_medium_C5', t + 0.22, { gain: 0.9, rate: 2, out: this.sfx }); }
  wrong() { const t = this.now + 0.01; this.file('band/bass_s1', t, { gain: 1, out: this.sfx }); this._tone(140, 0.35, 'sawtooth', 0.12, -40); }
  crash() { const t = this.now + 0.01; this.file('band/cymbals_short1', t, { gain: 0.9, out: this.sfx }); this.file('band/bass_s1', t, { gain: 1, out: this.sfx }); this.file('band/snare_s1', t + 0.12, { gain: 0.7, out: this.sfx }); }
  boing() { this._tone(330, 0.25, 'sine', 0.2, 600); }
  beep(hi) { this._tone(hi ? 880 : 440, hi ? 0.5 : 0.18, 'sine', 0.22, 0); }
  finish() { const t = this.now + 0.02; [0, 0.15, 0.3, 0.5].forEach((d, i) => this.file('band/glock_medium_' + (i % 2 ? 'G5' : 'C5'), t + d, { gain: 0.9, rate: i === 3 ? 2 : 1, out: this.sfx })); this.file('band/cymbals_short1', t + 0.5, { gain: 0.5, out: this.sfx }); }
  whoosh() { if (!this.ctx) return; const ctx = this.ctx, t = ctx.currentTime, n = ctx.createBuffer(1, ctx.sampleRate * 0.6, ctx.sampleRate), d = n.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.sin(Math.PI * i / d.length); const s = ctx.createBufferSource(); s.buffer = n; const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.setValueAtTime(400, t); f.frequency.exponentialRampToValueAtTime(2400, t + 0.5); const g = ctx.createGain(); g.gain.value = 0.35; s.connect(f); f.connect(g); g.connect(this.sfx); s.start(t); }
  _tone(f, d, type, gain, slide) { if (!this.ctx) return; const ctx = this.ctx, t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.linearRampToValueAtTime(Math.max(30, f + slide), t + d); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0008, t + d); o.connect(g); g.connect(this.sfx); o.start(t); o.stop(t + d + 0.02); }
}
