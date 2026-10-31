// engine.mjs — محرك الصوت (WebAudio). لا يعرف شيئًا عن الأسماء ولا الواجهة: يستقبل ترددًا (Hz) محسوبًا من theory.mjs
// فيبقى «الاسم والتردد من مصدر واحد». المكونات:
//   • أجزاء (parts): upper (الصوت الرئيسي) / layer (الطبقة الثانية) / lower (يسار نقطة التقسيم) / drums.
//   • تأثيرات مشتركة: صدى (Reverb) وكورس (Chorus) بإرسال من كل جزء، ثم ضاغط/محدِّد يمنع التشويه.
//   • العينات تُحمَّل عند الحاجة فقط (أول اختيار للصوت) وتُفك مرة واحدة. الأصوات المستمرة تُكرَّر بحلقة
//     تُحسب تلقائيًا مع مزج متقاطع، فيستمر الصوت ما دام المفتاح مضغوطًا دون طقطقة.
//   • النمذجة الفيزيائية (قانون/عود) والتركيب (أورج شرقي، موزيت، ناي) منقولة من النسخة السابقة.
//   • أصوات الإيقاع مولَّدة (drums.mjs) وتُجدول بدقة على ساعة الصوت.

import { VOICES } from './voices.mjs';
import { renderOudPluck, renderQanunPluck, seededRandom } from './plucks.mjs';
import { DRUMS, renderDrum } from './drums.mjs';
import { curveDb } from './calib.mjs';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const dbToGain = (db) => Math.pow(10, db / 20);
function holdParam(param, t) {
  if (typeof param.cancelAndHoldAtTime === 'function') { try { param.cancelAndHoldAtTime(t); return; } catch (e) { /* البديل */ } }
  const v = param.value; param.cancelScheduledValues(t); param.setValueAtTime(v, t);
}
const NOTE_NAMES = { C: 0, Db: 1, Cs: 1, D: 2, Eb: 3, Ds: 3, E: 4, F: 5, Gb: 6, Fs: 6, G: 7, Ab: 8, Gs: 8, A: 9, Bb: 10, As: 10, B: 11 };
export function midiOfName(n) {
  const m = /^([A-G](?:b|s)?)(-?\d)$/.exec(n);
  if (!m) throw new Error('اسم عينة غير صالح: ' + n);
  return 12 * (Number(m[2]) + 1) + NOTE_NAMES[m[1]];
}

/**
 * حلقة تلقائية لعينة مستمرة: نقطة نهاية قرب آخر التسجيل، وبداية بعد استقرار الصوت، تُختار بحيث يتطابق الشكل
 * الموجي حولهما (ارتباط أعلى)، ثم مزج متقاطع بقدرة متساوية يُخبز في نسخة من البيانات فلا تُسمع الوصلة.
 */
export function makeLoop(data, sr, hz, { minStart = 0.45, tailSkip = 0.18, xfade = 0.12 } = {}) {
  const dur = data.length / sr;
  const end = Math.floor((dur - tailSkip) * sr);
  const period = sr / hz;
  let start = Math.floor(Math.max(minStart, dur * 0.3) * sr);
  if (end - start < sr * 0.4) start = Math.floor(end - sr * 0.4);
  const W = Math.max(256, Math.floor(period * 3));
  let best = start, bestC = -Infinity;
  const span = Math.ceil(period * 1.5);
  for (let s = start - span; s <= start + span; s++) {
    if (s - W < 0) continue;
    let c = 0, ea = 0, eb = 0;
    for (let i = 0; i < W; i += 2) { const a = data[end - W + i], b = data[s - W + i]; c += a * b; ea += a * a; eb += b * b; }
    const nc = c / Math.sqrt(ea * eb + 1e-12);
    if (nc > bestC) { bestC = nc; best = s; }
  }
  const out = new Float32Array(data);
  const X = Math.min(Math.floor(xfade * sr), best - 1, end - best - 1);
  for (let i = 0; i < X; i++) {
    const k = i / X, a = Math.cos(k * Math.PI / 2), b = Math.sin(k * Math.PI / 2);
    out[end - X + i] = data[end - X + i] * a + data[best - X + i] * b;
  }
  return { data: out, loopStart: best / sr, loopEnd: end / sr, corr: bestC };
}

export class Engine {
  constructor(ctx, { gameBase = './', sharedBase = './_shared/' } = {}) {
    this.ctx = ctx; this.gameBase = gameBase; this.sharedBase = sharedBase;
    this.sets = new Map();              // set → { state, promise, samples:[{m,c,g,buffer,loopStart,loopEnd,t0,k}] , man }
    this.voices = []; this.maxVoices = 64; this.serial = 0;
    this.modDepth = 0;                  // رجفة إضافية (Modulation) 0..1
    this.pluckCache = new Map();
    this.drumBufs = {};
    this._buildGraph();
  }

  // ---------------------------------------------------------------- الشبكة الصوتية
  _buildGraph() {
    const c = this.ctx;
    this.master = c.createGain(); this.master.gain.value = 0.8;
    const comp = this.comp = c.createDynamicsCompressor();
    comp.threshold.value = -10; comp.knee.value = 8; comp.ratio.value = 8; comp.attack.value = 0.004; comp.release.value = 0.2;
    const clip = c.createWaveShaper();
    const cv = new Float32Array(2049);
    for (let i = 0; i < cv.length; i++) { const x = i / 1024 - 1, a = Math.abs(x); cv[i] = a < 0.8 ? x : Math.sign(x) * (0.8 + 0.2 * Math.tanh((a - 0.8) / 0.2)); }
    clip.curve = cv;
    this.analyser = c.createAnalyser(); this.analyser.fftSize = 1024;
    this.master.connect(comp); comp.connect(clip); clip.connect(this.analyser); this.analyser.connect(c.destination);

    // صدى: استجابة نبضية مولَّدة (غرفة متوسطة) — مجرى إرسال مشترك
    this.revIn = c.createGain();
    this.reverb = c.createConvolver(); this.reverb.buffer = this._roomIR(2.4, 2.6);
    this.revOut = c.createGain(); this.revOut.gain.value = 0.7;
    this.revIn.connect(this.reverb); this.reverb.connect(this.revOut); this.revOut.connect(this.master);
    // كورس: خطّا تأخير يتأرجحان ببطء (يسار/يمين)
    this.chIn = c.createGain(); this.chOut = c.createGain(); this.chOut.gain.value = 0.6;
    [[0.27, 0.012, -0.7], [0.33, 0.017, 0.7]].forEach(([rate, base, pan]) => {
      const d = c.createDelay(0.05); d.delayTime.value = base;
      const lfo = c.createOscillator(); lfo.frequency.value = rate;
      const lg = c.createGain(); lg.gain.value = 0.0035;
      lfo.connect(lg); lg.connect(d.delayTime); lfo.start();
      const p = c.createStereoPanner ? c.createStereoPanner() : c.createGain();
      if (p.pan) p.pan.value = pan;
      this.chIn.connect(d); d.connect(p); p.connect(this.chOut);
    });
    this.chOut.connect(this.master);

    this.parts = {};
    for (const id of ['upper', 'layer', 'lower', 'drums']) {
      const vol = c.createGain(), rev = c.createGain(), cho = c.createGain();
      vol.connect(this.master); vol.connect(rev); vol.connect(cho); rev.connect(this.revIn); cho.connect(this.chIn);
      rev.gain.value = id === 'drums' ? 0.06 : 0.15; cho.gain.value = 0;
      this.parts[id] = { vol, rev, cho, buses: {} };
    }
  }
  _roomIR(seconds, decay) {
    const sr = this.ctx.sampleRate, len = Math.floor(sr * seconds);
    const ir = this.ctx.createBuffer(2, len, sr);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch), rnd = seededRandom(9 + ch * 31);
      for (let i = 0; i < len; i++) {
        const t = i / len;
        d[i] = (rnd() * 2 - 1) * Math.pow(1 - t, decay) * (i < sr * 0.01 ? i / (sr * 0.01) : 1) * 0.5;
      }
    }
    return ir;
  }
  setMaster(v) { this.master.gain.setTargetAtTime(Math.pow(clamp(v, 0, 1), 1.6) * 1.1, this.ctx.currentTime, 0.03); }
  setPartVolume(part, v) { this.parts[part].vol.gain.setTargetAtTime(Math.pow(clamp(v, 0, 1), 1.6) * 1.2, this.ctx.currentTime, 0.03); }
  /** مستوى المؤثرات العام (0..1) مضروبًا في المستوى الافتراضي لكل صوت. */
  setFx(part, { reverb, chorus }, voiceId) {
    const v = VOICES[voiceId] || {}, t = this.ctx.currentTime, P = this.parts[part];
    if (reverb != null) P.rev.gain.setTargetAtTime(reverb * (part === 'drums' ? 0.25 : (v.rev || 0.15) * 3), t, 0.05);
    if (chorus != null) P.cho.gain.setTargetAtTime(chorus * (part === 'drums' ? 0 : 0.6 + (v.chorus || 0)), t, 0.05);
  }

  // ناقل لكل صوت داخل الجزء: معايرة العلو، وصندوق رنين للآلات المنقورة
  _bus(part, voiceId) {
    const P = this.parts[part];
    if (P.buses[voiceId]) return P.buses[voiceId];
    const c = this.ctx, def = VOICES[voiceId];
    const out = c.createGain(); out.gain.value = dbToGain(def.trim || 0);
    out.connect(P.vol);
    let input = out;
    if (def.kind === 'pluck') {
      input = c.createGain();
      const direct = c.createGain(); direct.gain.value = def.model === 'qanun' ? 0.55 : 0.5;
      const body = c.createConvolver(); body.normalize = false; body.buffer = this._bodyIR(def.model);
      input.connect(direct); input.connect(body);
      const tone = c.createBiquadFilter();
      if (def.model === 'qanun') { tone.type = 'peaking'; tone.frequency.value = 2300; tone.Q.value = 0.9; tone.gain.value = 3; }
      else { tone.type = 'highshelf'; tone.frequency.value = 4500; tone.gain.value = -5; }
      const lvl = c.createGain(); lvl.gain.value = def.model === 'qanun' ? 1.43 : 1.15;
      direct.connect(tone); body.connect(tone); tone.connect(lvl); lvl.connect(out);
    }
    P.buses[voiceId] = { out, input };
    return P.buses[voiceId];
  }
  _bodyIR(kind) {
    const sr = this.ctx.sampleRate, len = Math.floor(sr * (kind === 'oud' ? 0.16 : 0.12));
    const ir = this.ctx.createBuffer(1, len, sr), d = ir.getChannelData(0);
    let modes, rnd;
    if (kind === 'qanun') {
      rnd = seededRandom(1453); modes = [{ f: 135, q: 8, a: 0.7 }, { f: 240, q: 10, a: 0.6 }];
      for (let k = 0; k < 30; k++) { const f = 300 * Math.pow(30, (k + rnd() * 0.9) / 30); modes.push({ f, q: 14 + rnd() * 26, a: (0.2 + rnd() * 0.45) / Math.pow(f / 300, 0.6) }); }
      for (let k = 0; k < 18; k++) { const f = 700 * Math.pow(6, (k + rnd()) / 18); modes.push({ f, q: 5 + rnd() * 6, a: 0.28 + rnd() * 0.25 }); }
    } else {
      rnd = seededRandom(1977); modes = [{ f: 150, q: 9, a: 1.0 }, { f: 222, q: 12, a: 0.85 }, { f: 296, q: 14, a: 0.5 }];
      for (let k = 0; k < 42; k++) { const f = 340 * Math.pow(5200 / 340, (k + rnd() * 0.9) / 42); modes.push({ f, q: 12 + rnd() * 24, a: (0.25 + rnd() * 0.5) / Math.pow(f / 340, 0.55) }); }
    }
    modes.forEach((m, i) => {
      const tau = m.q / (Math.PI * m.f), ph = rnd() * Math.PI * 2;
      const sign = kind === 'qanun' ? (i % 2 ? -1 : 1) : (i % 3 === 1 ? -1 : 1);
      for (let n = 0; n < len; n++) { const t = n / sr; d[n] += sign * m.a * Math.exp(-t / tau) * Math.sin(2 * Math.PI * m.f * t + ph); }
    });
    let peak = 0; for (let n = 0; n < len; n++) peak = Math.max(peak, Math.abs(d[n]));
    const k = (kind === 'qanun' ? 0.05 : 0.055) / peak; for (let n = 0; n < len; n++) d[n] *= k;
    return ir;
  }

  // ---------------------------------------------------------------- العينات
  setState(set) { const s = this.sets.get(set); return s ? s.state : 'none'; }
  /** يحمّل مجموعة عينات (مرة واحدة). onProgress(loaded,total). يرجع وعدًا لا يرفض أبدًا (الحالة تُقرأ من state). */
  loadSet(set, { shared = false, onProgress } = {}) {
    if (this.sets.has(set)) return this.sets.get(set).promise;
    const S = { state: 'loading', samples: [], man: null, loaded: 0, total: 0, error: null };
    this.sets.set(set, S);
    const base = (shared ? this.sharedBase + 'samples/' : this.gameBase + 'samples/') + set + '/';
    S.promise = (async () => {
      try {
        const r = await fetch(base + 'manifest.json', { credentials: 'same-origin' });
        if (!r.ok) throw new Error('manifest ' + r.status);
        const man = S.man = await r.json();
        const entries = Object.entries(man.notes).map(([name, v]) => (typeof v === 'number'
          ? { name, m: v, c: 0, g: man.gains && man.gains[name] ? 20 * Math.log10(man.gains[name]) : 0 }
          : { name, ...v }));
        S.total = entries.length;
        const sustained = man.kind === 'sustained' || man.kind === 'sustained-loop';
        const queue = entries.slice();
        const worker = async () => {
          while (queue.length) {
            const e = queue.shift();
            const resp = await fetch(base + e.name + '.' + (man.ext || 'mp3'), { credentials: 'same-origin' });
            if (!resp.ok) throw new Error(e.name + ' ' + resp.status);
            const buf = await this.ctx.decodeAudioData(await resp.arrayBuffer());
            const sr = buf.sampleRate, srcSr = man.sampleRate || 44100;
            const s = { m: e.m + (man.pitchOffset || 0), c: e.c || 0, g: e.g || 0, buffer: buf, t0: e.t0 != null ? e.t0 / srcSr : null, k: e.k };
            if (e.ls != null && e.le != null) { s.loopStart = e.ls / srcSr; s.loopEnd = e.le / srcSr; }
            else if (sustained) {
              const hz = 440 * Math.pow(2, (s.m - 69) / 12);
              const L = makeLoop(buf.getChannelData(0), sr, hz);
              const nb = this.ctx.createBuffer(1, L.data.length, sr); nb.getChannelData(0).set(L.data);
              s.buffer = nb; s.loopStart = L.loopStart; s.loopEnd = L.loopEnd; s.loopCorr = L.corr;
            }
            S.samples.push(s); S.loaded++;
            if (onProgress) onProgress(S.loaded, S.total);
          }
        };
        await Promise.all(Array.from({ length: 6 }, worker));
        S.samples.sort((a, b) => a.m - b.m);
        S.state = 'ready';
      } catch (err) {
        S.state = 'failed'; S.error = String(err && err.message || err);
        console.warn('[الأورج] تعذّر تحميل العينات', set, S.error);
      }
      return S;
    })();
    return S.promise;
  }
  _nearest(set, midi) {
    const S = this.sets.get(set);
    if (!S || S.state !== 'ready' || !S.samples.length) return null;
    let best = null, bd = 1e9;
    for (const s of S.samples) { const d = Math.abs(s.m - midi) + (s.m > midi ? 0.01 : 0); if (d < bd) { bd = d; best = s; } }
    return best;
  }
  ensureVoice(voiceId, onProgress) {
    const v = VOICES[voiceId];
    if (!v || v.kind !== 'sample') return Promise.resolve(true);
    return this.loadSet(v.set, { shared: !!v.shared, onProgress }).then((S) => S.state === 'ready');
  }
  voiceReady(voiceId) { const v = VOICES[voiceId]; return !v || v.kind !== 'sample' || this.setState(v.set) === 'ready'; }

  // ---------------------------------------------------------------- تشغيل النغمات
  /**
   * part: upper|layer|lower ، hz: التردد المحسوب من theory.mjs ، opts: { vel, when, glideFrom (Hz), pan }
   * يُرجع كائن صوت (handle) أو null إن لم تكن العينات جاهزة (لا نصدر صوتًا بديلًا مضللًا).
   */
  noteOn(part, voiceId, hz, opts = {}) {
    const def = VOICES[voiceId];
    if (!def || !(hz > 0)) return null;
    const c = this.ctx, t = Math.max(c.currentTime + 0.003, opts.when || 0);
    const vel = opts.vel == null ? 0.8 : clamp(opts.vel, 0.05, 1);
    this._enforceLimit(t);
    const bus = this._bus(part, voiceId);
    const env = c.createGain(); env.gain.value = 0;
    let node = env;
    if (c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = clamp(opts.pan || 0, -1, 1); env.connect(p); node = p; }
    node.connect(bus.input);
    const v = { id: ++this.serial, part, voiceId, hz, t0: t, env, srcs: [], released: false, ended: false, endAt: Infinity, relTau: 0.08 };
    const amp = (0.35 + 0.65 * Math.pow(vel, 1.2)) / 0.875 * dbToGain(curveDb(voiceId, 69 + 12 * Math.log2(hz / 440)));
    let ok = true;
    if (def.kind === 'sample') ok = this._sample(def, v, hz, t, amp, opts);
    else if (def.kind === 'pluck') this._pluck(def, v, hz, t, amp);
    else this._synth(def.synth, v, hz, t, amp);
    if (!ok) { try { node.disconnect(); } catch (e) { /* */ } return null; }
    // رجفة إضافية عامة (Modulation) لكل الأصوات المستمرة غير المنقورة
    if (this.modDepth > 0 && def.kind !== 'pluck' && def.decay == null && v.detuneTargets) {
      const lfo = c.createOscillator(); lfo.frequency.value = 5.6;
      const lg = c.createGain(); lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(this.modDepth * 28, t + 0.35);
      lfo.connect(lg); v.detuneTargets.forEach((p) => lg.connect(p)); lfo.start(t); v.srcs.push(lfo);
    }
    this.voices.push(v);
    return v;
  }

  _sample(def, v, hz, t, amp, opts) {
    const midi = 69 + 12 * Math.log2(hz / 440);
    const s = this._nearest(def.set, midi);
    if (!s) return false;
    const c = this.ctx;
    const sampleHz = 440 * Math.pow(2, (s.m - 69) / 12 + (s.c + ((def.centsFix && def.centsFix[s.m]) || 0)) / 1200);
    const rate = hz / sampleHz;
    const src = c.createBufferSource(); src.buffer = s.buffer;
    if (opts.glideFrom && def.style === 'eastern') {
      src.playbackRate.setValueAtTime(rate * opts.glideFrom / hz, t);
      src.playbackRate.setTargetAtTime(rate, t + 0.01, 0.035);              // انزلاق شرقي بين النغمتين
    } else src.playbackRate.setValueAtTime(rate, t);
    v.detuneTargets = src.detune ? [src.detune] : [];
    const level = amp * dbToGain(s.g || 0);
    let node = src;
    if (s.loopStart != null) { src.loop = true; src.loopStart = s.loopStart; src.loopEnd = s.loopEnd; }
    if (def.decay === 'piano') {
      // استمرار الخفوت الطبيعي بعد نهاية التسجيل (حلقة ذيل مسطحة يُطبَّق عليها خفوت أُسّي)
      if (s.t0 != null && s.k) {
        const dec = c.createGain(), tStart = t + s.t0 / rate;
        dec.gain.setValueAtTime(1, tStart); dec.gain.setTargetAtTime(0, tStart, 1 / (s.k * rate));
        src.connect(dec); node = dec;
      }
      v.relTau = midi >= 89 ? 0.5 : clamp(0.16 - (midi - 36) * 0.0018, 0.07, 0.16);
      v.endAt = t + 30;
    } else if (def.decay === 'natural') {
      v.relTau = def.release || 0.25;
      v.endAt = t + s.buffer.duration / rate;
    } else v.relTau = def.release || 0.12;
    if (def.style === 'eastern' && src.detune) {
      // رجفة شرقية: أبطأ وأوسع، تبدأ بعد لحظة من الهجوم
      const lfo = c.createOscillator(); lfo.frequency.value = 5.0;
      const lg = c.createGain(); lg.gain.setValueAtTime(0, t); lg.gain.setValueAtTime(0, t + 0.22); lg.gain.linearRampToValueAtTime(18, t + 0.6);
      lfo.connect(lg); lg.connect(src.detune); lfo.start(t); v.srcs.push(lfo);
    }
    node.connect(v.env);
    const a = def.attack || 0.004;
    v.env.gain.setValueAtTime(0, t); v.env.gain.linearRampToValueAtTime(level, t + a);
    src.start(t); v.srcs.unshift(src);
    v.sample = s.m; v.rate = rate;
    if (v.endAt !== Infinity) this._stopAt(v, v.endAt);
    return true;
  }

  _pluck(def, v, hz, t, amp) {
    const key = def.model + '|' + hz.toFixed(3);
    let buf = this.pluckCache.get(key);
    if (!buf) {
      const sr = this.ctx.sampleRate, rnd = seededRandom((def.model === 'qanun' ? 104729 : 130363) + Math.round(hz * 100));
      const data = def.model === 'qanun' ? renderQanunPluck(sr, hz, rnd) : renderOudPluck(sr, hz, rnd);
      buf = this.ctx.createBuffer(1, data.length, sr); buf.getChannelData(0).set(data);
      this.pluckCache.set(key, buf);
      if (this.pluckCache.size > 300) this.pluckCache.delete(this.pluckCache.keys().next().value);
    }
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    if (src.detune) src.detune.value = (Math.random() - 0.5) * 1.6;
    src.connect(v.env);
    v.env.gain.setValueAtTime(amp * (0.95 + Math.random() * 0.1), t);
    src.start(t); v.srcs.push(src);
    v.relTau = def.release || 0;       // القانون يرن حتى يخفت وحده (الرفع لا يكتمه)، والعود يُكتم قليلًا
    this._stopAt(v, t + buf.duration);
  }
  /** تسخين مسبق لنغمات آلة منقورة (حتى لا يتأخر أول نقر). */
  warmPluck(voiceId, hzList) {
    const def = VOICES[voiceId]; if (!def || def.kind !== 'pluck') return;
    const todo = hzList.slice();
    const step = () => {
      const hz = todo.shift(); if (hz == null) return;
      const key = def.model + '|' + hz.toFixed(3);
      if (!this.pluckCache.has(key)) {
        const sr = this.ctx.sampleRate, rnd = seededRandom((def.model === 'qanun' ? 104729 : 130363) + Math.round(hz * 100));
        const data = def.model === 'qanun' ? renderQanunPluck(sr, hz, rnd) : renderOudPluck(sr, hz, rnd);
        const buf = this.ctx.createBuffer(1, data.length, sr); buf.getChannelData(0).set(data); this.pluckCache.set(key, buf);
      }
      setTimeout(step, 6);
    };
    setTimeout(step, 30);
  }

  _synth(kind, v, f, t, amp) {
    const c = this.ctx, env = v.env;
    const osc = (type, freq, wave) => { const o = c.createOscillator(); if (wave) o.setPeriodicWave(wave); else o.type = type; o.frequency.setValueAtTime(freq, t); v.srcs.push(o); return o; };
    v.detuneTargets = [];
    if (kind === 'eorgan') {
      // الصوت الأصلي: سن المنشار + فيبراتو 5.8 هرتز بعمق 0.7% + مرشح 2200 هرتز
      const o1 = osc('sawtooth', f), o2 = osc('sawtooth', f * Math.pow(2, 4 / 1200));
      const g2 = c.createGain(); g2.gain.value = 0.3;
      const lfo = osc('sine', 5.8), lg = c.createGain(); lg.gain.value = f * 0.007;
      lfo.connect(lg); lg.connect(o1.frequency); lg.connect(o2.frequency);
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2200; lp.Q.value = 0.7;
      o1.connect(lp); o2.connect(g2); g2.connect(lp); lp.connect(env);
      env.gain.setValueAtTime(0, t); env.gain.linearRampToValueAtTime(0.32 * amp, t + 0.008);
      v.relTau = 0.09; v.detuneTargets = [o1.detune, o2.detune];
    } else if (kind === 'drawbar') {
      // أورج بالجمع الجيبي (درابار) كما في الأورج الكهربائي الكلاسيكي: كل طبقة (قدم) موجة جيبية بنسبة ثابتة من الأساس.
      // التسجيل: 16' 5⅓' 8' 4' 2⅔' 2' 1' بمستويات 2 3 8 6 4 4 2 (من 8) — الأساس 8' هو الأقوى فيطابق الصوتُ اسمَ المفتاح.
      const bars = [[0.5, 2], [1.5, 3], [1, 8], [2, 6], [3, 4], [4, 4], [8, 2]];
      const sum = c.createGain(); sum.gain.value = 1 / 20;
      for (const [ratio, level] of bars) {
        const fr = f * ratio; if (fr > 12000) continue;
        const o = osc('sine', fr); const g = c.createGain(); g.gain.value = level / 8;
        o.connect(g); g.connect(sum); v.detuneTargets.push(o.detune);
      }
      // نقرة المفتاح القصيرة المميزة للأورج الكلاسيكي
      if (!this.noise) { const n = Math.floor(c.sampleRate * 2), b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0), r = seededRandom(77); for (let i = 0; i < n; i++) d[i] = r() * 2 - 1; this.noise = b; }
      const nk = c.createBufferSource(); nk.buffer = this.noise; nk.loopStart = Math.random(); v.srcs.push(nk);
      const kb = c.createBiquadFilter(); kb.type = 'bandpass'; kb.frequency.value = 2500; kb.Q.value = 0.8;
      const kg = c.createGain(); kg.gain.setValueAtTime(0.0, t); kg.gain.linearRampToValueAtTime(0.05, t + 0.002); kg.gain.setTargetAtTime(0, t + 0.004, 0.006);
      nk.connect(kb); kb.connect(kg); kg.connect(env);
      sum.connect(env);
      env.gain.setValueAtTime(0, t); env.gain.linearRampToValueAtTime(amp, t + 0.006);
      v.relTau = 0.03;
    } else if (kind === 'musette') {
      if (!this.reedWave) this.reedWave = this._wave((n) => Math.abs(Math.sin(Math.PI * n * 0.17)) / Math.pow(n, 0.85) * (1 + 0.6 * Math.exp(-Math.pow((n - 5) / 4, 2))), 48);
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = Math.min(9000, 2600 + f * 3); lp.Q.value = 0.5;
      const nasal = c.createBiquadFilter(); nasal.type = 'peaking'; nasal.frequency.value = 1500; nasal.Q.value = 1.1; nasal.gain.value = 5;
      [[0, 0.5], [13, 0.42], [-11, 0.42]].forEach(([cents, g]) => {
        const o = osc(null, f * Math.pow(2, cents / 1200), this.reedWave); const gg = c.createGain(); gg.gain.value = g;
        o.connect(gg); gg.connect(nasal); v.detuneTargets.push(o.detune);
      });
      nasal.connect(lp); lp.connect(env);
      env.gain.setValueAtTime(0, t); env.gain.linearRampToValueAtTime(0.16 * amp, t + 0.03);
      v.relTau = 0.035;
    } else if (kind === 'nay') {
      if (!this.nayWave) this.nayWave = c.createPeriodicWave(new Float32Array(6), new Float32Array([0, 1, 0.28, 0.1, 0.04, 0.015]));
      if (!this.noise) { const n = Math.floor(c.sampleRate * 2), b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0), r = seededRandom(77); for (let i = 0; i < n; i++) d[i] = r() * 2 - 1; this.noise = b; }
      const o = osc(null, f * Math.pow(2, -35 / 1200), this.nayWave);
      o.frequency.setTargetAtTime(f, t + 0.01, 0.035);
      const lfo = osc('sine', 4.8), lg = c.createGain(); lg.gain.setValueAtTime(0, t); lg.gain.setValueAtTime(0, t + 0.3); lg.gain.linearRampToValueAtTime(f * 0.009, t + 0.8);
      lfo.connect(lg); lg.connect(o.frequency);
      const tone = c.createGain(); o.connect(tone);
      const n = c.createBufferSource(); n.buffer = this.noise; n.loop = true; n.loopStart = Math.random() * 1.5; v.srcs.push(n);
      const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = Math.min(9000, f * 2.2); bp.Q.value = 1.2;
      const bpg = c.createGain(); bpg.gain.value = 0.11;
      const bp2 = c.createBiquadFilter(); bp2.type = 'bandpass'; bp2.frequency.value = f; bp2.Q.value = 9;
      const bpg2 = c.createGain(); bpg2.gain.value = 0.35;
      const chiff = c.createGain(); chiff.gain.setValueAtTime(0, t); chiff.gain.linearRampToValueAtTime(0.5, t + 0.012); chiff.gain.setTargetAtTime(0, t + 0.02, 0.03);
      const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1800;
      n.connect(bp); bp.connect(bpg); bpg.connect(tone); n.connect(bp2); bp2.connect(bpg2); bpg2.connect(tone);
      n.connect(hp); hp.connect(chiff); chiff.connect(env);
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = Math.min(9000, 3000 + f * 2);
      tone.connect(lp); lp.connect(env);
      env.gain.setValueAtTime(0, t); env.gain.setTargetAtTime(0.42 * amp, t, 0.035);
      v.relTau = 0.07; v.detuneTargets = [o.detune];
    }
    v.srcs.forEach((s) => s.start(t));
  }
  _wave(fn, N) { const re = new Float32Array(N + 1), im = new Float32Array(N + 1); for (let n = 1; n <= N; n++) im[n] = fn(n); return this.ctx.createPeriodicWave(re, im); }

  _stopAt(v, when) {
    v.endAt = Math.min(v.endAt, when);
    v.srcs.forEach((s) => { try { s.stop(when + 0.05); } catch (e) { /* */ } });
    if (v.srcs[0]) v.srcs[0].onended = () => { v.ended = true; };
  }
  /** رفع الإصبع: إطلاق بحسب طبيعة الصوت (القانون يرن حتى يخفت وحده). */
  noteOff(v, when) {
    if (!v || v.released) return;
    const t = Math.max(this.ctx.currentTime, when || 0);
    v.released = true;
    if (!v.relTau) return;
    holdParam(v.env.gain, t); v.env.gain.setTargetAtTime(0, t, v.relTau);
    const end = t + v.relTau * 7 + 0.02;
    if (end < v.endAt) this._stopAt(v, end);
  }
  kill(v, tau = 0.012) {
    if (!v || v.ended) return;
    const t = this.ctx.currentTime;
    v.released = true; holdParam(v.env.gain, t); v.env.gain.setTargetAtTime(0, t, tau);
    const end = t + tau * 8 + 0.01; if (end < v.endAt) this._stopAt(v, end);
  }
  _prune() { const now = this.ctx.currentTime; this.voices = this.voices.filter((v) => !v.ended && v.endAt > now - 0.05); }
  _enforceLimit(t) {
    this._prune();
    const live = this.voices.filter((v) => v.endAt > t);
    if (live.length < this.maxVoices) return;
    this.kill(live.filter((v) => v.released)[0] || live[0], 0.01);
  }
  activeCount() { this._prune(); const t = this.ctx.currentTime; return this.voices.filter((v) => !v.ended && v.endAt > t).length; }
  /** إيقاف كل الأصوات فورًا (زر الطوارئ ⏹) بما فيها ذيل الصدى. */
  panic() {
    const t = this.ctx.currentTime;
    this.voices.forEach((v) => this.kill(v, 0.015));
    holdParam(this.revOut.gain, t); this.revOut.gain.setTargetAtTime(0, t, 0.02); this.revOut.gain.setTargetAtTime(0.7, t + 0.5, 0.15);
  }

  // ---------------------------------------------------------------- الإيقاع
  _drum(name) {
    if (!this.drumBufs[name]) {
      const data = renderDrum(name, this.ctx.sampleRate);
      const b = this.ctx.createBuffer(1, data.length, this.ctx.sampleRate); b.getChannelData(0).set(data);
      this.drumBufs[name] = b;
    }
    return this.drumBufs[name];
  }
  warmDrums() { Object.keys(DRUMS).forEach((n) => this._drum(n)); }
  playDrum(name, when, vel = 0.85) {
    const c = this.ctx, src = c.createBufferSource(); src.buffer = this._drum(name);
    const g = c.createGain(); g.gain.value = Math.pow(clamp(vel, 0, 1), 1.3);
    const pan = { tak: 0.15, ka: 0.2, riq: -0.25, hat: 0.3, ohat: 0.3, kasir: 0.2, snj: -0.3, clap: -0.1 }[name] || 0;
    let n = g;
    if (c.createStereoPanner && pan) { const p = c.createStereoPanner(); p.pan.value = pan; g.connect(p); n = p; }
    src.connect(g); n.connect(this.parts.drums.vol);
    src.start(Math.max(when, c.currentTime));
    return src;
  }
}
