// =====================================================================
//  «مذياع على الطريق»: عند مرور المركبة أمام دكان/مقهى على جانب الطريق يُسمع مقطع وطني قصير صادر منه
//  ثم يتلاشى بعد تجاوزه — كأن السائق مرّ مصادفةً أمام مذياع. لا يتجاوز المقطع مدة المرور (ثوانٍ قليلة حسب السرعة).
//
//  مصادر المقاطع:
//   1) إيقاعات الفنون العُمانية (البرعة، طبل النساء، الرزحة، المديمة، الحمبورة) — مدوّناتها منقولة من أدلة المعلم
//      في لعبة «إيقاعات الفنون العُمانية» (src/data/omani-arts.js) وتُعزف بالعيّنات نفسها (CC0)، وتُجهَّز مرة واحدة.
//   2) أغانٍ وأناشيد وطنية يضعها مالك المنصة في assets/audio/national/ ويسجّلها في manifest.json
//      (حلوة عُمان، يا موطني، مقطع من النشيد الوطني…). اللعبة لا تنزّل أي تسجيل من الإنترنت.
//
//  قواعد عدم التداخل: لا يبدأ مقطع والسؤال الحالي صوتي ولم يُجَب بعد، ولا أثناء تشغيل صوت سؤال؛
//  وإذا بدأ أحدهما أثناء المقطع يتلاشى المقطع فورًا. ولا يعمل في العدّ التنازلي أو الارتطام أو الاستراحة.
// =====================================================================
import { ARTS, buildArt, INSTRUMENTS } from '../data/omani-arts.js';

const ARTS_ON_RADIO = ['baraa', 'tabl_nisa', 'razha', 'madima', 'hambura'];
const WIN = 34;              // نصف نافذة السماع بالمتر (قبل المصدر وبعده)

export class RoadsideRadio {
  constructor(app) { this.app = app; this.clips = []; this.i = 0; this.cur = null; this.on = true; this.vol = 0.7; this.loading = null; }
  setOptions(on, vol) { this.on = on !== false; this.vol = typeof vol === 'number' ? vol : 0.7; if (!this.on) this.stop(0.2); }

  load() {
    if (this.loading) return this.loading;
    this.loading = (async () => {
      const A = this.app.audio, ctx = A.ensure(); if (!ctx) return false;
      const arts = ARTS.filter((a) => ARTS_ON_RADIO.includes(a.id)).map(buildArt);
      const names = new Set(); for (const a of arts) for (const t of a.tracks) for (const k of ['D', 'T']) INSTRUMENTS[t.inst].samples[k].forEach((n) => names.add(n));
      const bufs = {}; await Promise.all([...names].map(async (n) => { bufs[n] = await A.load(`./assets/audio/omani/${n}.mp3`); }));
      for (const a of arts) { try { this.clips.push({ title: a.title, buffer: await this.render(a, bufs, 8, ctx.sampleRate) }); } catch (e) { console.warn('[radio]', a.id, e.message); } }
      // أغانٍ وأناشيد يضيفها مالك المنصة (اختياري)
      try {
        const r = await fetch('./assets/audio/national/manifest.json', { cache: 'no-cache' });
        if (r.ok) { const m = await r.json(); for (const s of (m.clips || [])) if (s && s.file) this.clips.push({ title: s.title || s.file, url: `./assets/audio/national/${s.file}`, start: +s.start || 0 }); }
      } catch (e) { /* لا ملف أغانٍ: نكتفي بالإيقاعات */ }
      // ترتيب متناوب: إيقاع ثم أغنية (إن وُجدت)…
      const songs = this.clips.filter((c) => c.url), beats = this.clips.filter((c) => !c.url);
      this.clips = []; for (let k = 0; k < Math.max(songs.length, beats.length); k++) { if (songs[k]) this.clips.push(songs[k]); if (beats[k]) this.clips.push(beats[k]); }
      return true;
    })();
    return this.loading;
  }
  /** يعزف دورات الفن مسبقًا في ذاكرة صوتية واحدة (بلا تكلفة أثناء القيادة) */
  async render(art, bufs, secs, sr) {
    const oc = new OfflineAudioContext(1, Math.ceil(sr * secs), sr);
    const out = oc.createGain(); out.gain.value = 0.8; out.connect(oc.destination);
    const spu = 60 / art.bpm.v / art.upb;
    for (let t0 = 0.03, loop = 0; t0 < secs && loop < 64; t0 += art.total * spu, loop++) {
      for (const tr of art.tracks) {
        const inst = INSTRUMENTS[tr.inst];
        for (const h of tr.hits) {
          const when = t0 + h.u * spu; if (when >= secs) continue;
          const names = inst.samples[h.k], b = bufs[names[(h.u + loop) % names.length]]; if (!b) continue;
          const s = oc.createBufferSource(); s.buffer = b; s.playbackRate.value = (inst.rate || 1) * (h.k === 'T' && inst.rateT ? inst.rateT : 1);
          const g = oc.createGain(); g.gain.value = (inst.gain || 1) * (h.acc ? 1.15 : 0.9) * 0.6;
          if (inst.choke && h.k === 'T') g.gain.setTargetAtTime(0, when + inst.choke * 0.4, inst.choke * 0.3);
          s.connect(g); g.connect(out); s.start(when);
        }
      }
    }
    return await oc.startRendering();
  }

  blocked() {
    const R = this.app.race, A = this.app.audio;
    if (!this.on || this.vol <= 0 || A.muted || !A.ctx) return true;
    if (R.state !== 'drive' && R.state !== 'finished') return true;
    if (A.questionUntil > A.ctx.currentTime) return true;                      // صوت السؤال يعمل الآن
    if (R.j && !R.j.passed && R.j.ch && R.j.ch.audio) return true;              // سؤال سمعي لم يُجب بعد
    return false;
  }
  /** كل إطار أثناء القيادة */
  update() {
    const W = this.app.world, R = this.app.race, A = this.app.audio;
    const spots = W.radioSpots || [];
    if (this.cur) {
      const s = this.cur.spot, dz = s.obj.position.z - R.z;
      if (this.blocked() || dz > WIN || s.obj.position.z !== this.cur.zAt) { this.stop(A.questionUntil > A.ctx.currentTime ? 0.12 : 0.4); return; }
      const near = Math.max(0, 1 - Math.abs(dz) / WIN);
      const g = this.vol * 0.9 * Math.pow(near, 1.1) * (0.55 + 0.45 * Math.min(1, 8 / Math.max(4, Math.abs(s.x - R.x))));
      this.cur.gain.gain.setTargetAtTime(g, A.ctx.currentTime, 0.08);
      if (this.cur.pan) this.cur.pan.pan.setTargetAtTime(Math.max(-0.9, Math.min(0.9, (s.x - R.x) / 14)), A.ctx.currentTime, 0.1);
      return;
    }
    if (!this.clips.length || this.blocked()) return;
    for (const s of spots) {
      if (!s.obj.visible) continue;
      const dz = s.obj.position.z - R.z;
      if (dz < -8 && dz > -WIN - 12 && s.played !== s.obj.position.z) { s.played = s.obj.position.z; this.start(s); break; }
    }
  }
  /** بعد إجابة صحيحة: إن كان محل المذياع قريبًا أمام السيارة يُؤخَّر السؤال التالي ثوانيَ قليلة
   *  فتُسمع المقطوعة عند المرور به ثم تتلاشى قبل أن يبدأ صوت السؤال (استراحة قصيرة بين الأسئلة لا تتداخل معها) */
  breakTime(z, v) {
    if (!this.on || this.vol <= 0 || !this.clips.length || this.app.audio.muted) return 0;
    const W = this.app.world;
    for (const s of W.radioSpots || []) {
      if (s.dyn) continue;
      const ahead = z - s.obj.position.z;
      if (ahead > 14 && ahead < 110 && s.played !== s.obj.position.z) return Math.min(6.5, (ahead + WIN * 0.7) / Math.max(10, v));
    }
    // لا يوجد محل قريب: نضع محل المذياع المتنقّل على الرصيف، مرة كل إجابتين صحيحتين (حتى لا يتكرر كثيرًا)
    if (!W.placeBreakKiosk || (this.breaks = (this.breaks || 0) + 1) % 2) return 0;
    this.side = -(this.side || 1);
    W.placeBreakKiosk(z - 46, this.side);
    return Math.min(6.5, (46 + WIN * 0.7) / Math.max(10, v));
  }
  async start(spot) {
    const A = this.app.audio, ctx = A.ctx;
    const clip = this.clips[this.i++ % this.clips.length];
    let buf = clip.buffer;
    if (!buf && clip.url) { buf = await A.load(clip.url); if (!buf) return; }
    if (this.cur || this.blocked()) return;
    const src = ctx.createBufferSource(); src.buffer = buf; src.loop = !clip.url;
    const gain = ctx.createGain(); gain.gain.value = 0;
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    src.connect(gain); if (pan) { gain.connect(pan); pan.connect(A.music); } else gain.connect(A.music);
    const off = clip.url ? Math.min(clip.start || 0, Math.max(0, buf.duration - 1)) : Math.random() * 2;
    src.start(ctx.currentTime + 0.02, off);
    this.cur = { src, gain, pan, spot, zAt: spot.obj.position.z, title: clip.title };
  }
  stop(fade = 0.3) {
    if (!this.cur) return;
    const { src, gain } = this.cur, A = this.app.audio, t = A.ctx.currentTime;
    try { gain.gain.cancelScheduledValues(t); gain.gain.setTargetAtTime(0, t, fade / 3); src.stop(t + fade + 0.1); } catch (e) { /* */ }
    this.cur = null;
  }
}
