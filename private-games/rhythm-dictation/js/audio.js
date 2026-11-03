// ============================================================================
// audio.js — محرك الصوت الإيقاعي بتسجيلات حقيقية لآلات إيقاعية
// المصدر: Versilian Community Sample Library (VCSL) — ترخيص CC0 (ملك عام). التفاصيل: audio/CREDITS.md
//  • العلامة القصيرة: ضربة واحدة مسجّلة تُكتم عند نهاية قيمتها (فلا تمتد فوق السكتة التالية).
//  • العلامة الطويلة (بلانش فأكثر) في الآلات التي لها «رول» مسجّل: ضربة + رول ممتد بطول القيمة.
//  • النبر: قوة الضربة من buildSchedule (vel)، والضربة القوية تستعمل تسجيل الضربة الأقوى.
//  • المترونوم: بلوك خشبي حقيقي · العدّ التمهيدي: كلافيس حقيقية · لا تداخل: كل تشغيل يوقف السابق.
// ============================================================================
(function (root) {
  'use strict';
  const BASE = 'audio/';
  // a: تسجيل الضربة القوية · n: تسجيلات الضربة العادية (تتناوب) · roll: تسجيل الرول · gain: معايرة المستوى
  const VOICES = {
    timpani: { label: 'التمباني', a: 'timpani-a', n: ['timpani-1', 'timpani-2'], roll: 'timpani-roll', gain: 1.0 },
    bass:    { label: 'الطبلة الكبيرة', a: 'bass-a', n: ['bass-1', 'bass-2'], roll: 'bass-roll', gain: 1.0 },
    frame:   { label: 'طبلة الإطار (الدف)', a: 'frame-a', n: ['frame-1', 'frame-2'], roll: null, gain: 1.0 },
    darbuka: { label: 'الدربكة (دُم على أول المازورة، تَك على غيرها)', a: 'darbuka-a', n: ['darbuka-1', 'darbuka-2'], roll: null, gain: 0.9 },
    snare:   { label: 'الطبلة الصغيرة', a: 'snare-a', n: ['snare-1', 'snare-2'], roll: 'snare-roll', gain: 0.85 },
    clap:    { label: 'تصفيق اليدين', a: 'clap-a', n: ['clap-1', 'clap-2'], roll: null, gain: 0.85 },
  };
  const ROLL_TICKS = 24;          // البلانش فأكثر يُؤدّى رولًا (حين تملك الآلة رولًا)
  const CLICK = { a: 'wood-a', n: 'wood-1' }, COUNT = { a: 'claves-a', n: 'claves-1' };

  let ctx = null, master = null, volume = 0.8, voiceId = 'timpani';
  const buffers = {}, onsetOf = {}, loading = {};
  let live = new Set(), timers = [], token = 0, rr = 0;

  function ensure() {
    if (ctx) return ctx;
    const AC = root.AudioContext || root.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = volume;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -10; comp.ratio.value = 3; comp.attack.value = 0.003; comp.release.value = 0.15;
    master.connect(comp); comp.connect(ctx.destination);
    return ctx;
  }
  async function resume() { const c = ensure(); if (c && c.state === 'suspended') { try { await c.resume(); } catch (e) { /* */ } } return c; }
  function setVolume(v) { volume = Math.max(0, Math.min(1, v)); if (master) master.gain.setTargetAtTime(volume, ctx.currentTime, 0.02); }

  // تحميل ملف وفك ترميزه، مع تحديد لحظة الضربة داخله (تعويض أي تأخير من ترميز MP3) لدقة التوقيت
  function load(name) {
    if (buffers[name]) return Promise.resolve(buffers[name]);
    if (loading[name]) return loading[name];
    loading[name] = fetch(BASE + name + '.mp3', { credentials: 'same-origin' })
      .then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.arrayBuffer(); })
      .then((ab) => new Promise((res, rej) => ensure().decodeAudioData(ab, res, rej)))
      .then((buf) => {
        const d = buf.getChannelData(0); let pk = 0;
        for (let i = 0; i < d.length; i++) { const v = Math.abs(d[i]); if (v > pk) pk = v; }
        let i = 0; while (i < d.length && Math.abs(d[i]) < pk * 0.05) i++;
        onsetOf[name] = Math.max(0, i / buf.sampleRate - 0.002);
        buffers[name] = buf; return buf;
      })
      .catch((e) => { delete loading[name]; throw e; });
    return loading[name];
  }
  function namesFor(v) { const V = VOICES[v]; return [V.a, ...V.n, V.roll].filter(Boolean); }
  async function preload(v) {
    ensure();
    const list = namesFor(v || voiceId).concat([CLICK.a, CLICK.n, COUNT.a, COUNT.n]);
    await Promise.all(list.map(load));
    return true;
  }
  function setVoice(v) { if (VOICES[v]) { voiceId = v; preload(v).catch(() => {}); } }

  const track = (n) => { live.add(n); n.onended = () => live.delete(n); return n; };
  function shot(name, t, gain, until, fade) {
    const buf = buffers[name]; if (!buf) return;
    const src = track(ctx.createBufferSource()); src.buffer = buf;
    const g = ctx.createGain(); g.gain.setValueAtTime(gain, t);
    if (until != null) {                                 // كتم الضربة عند نهاية قيمتها
      const f = fade || 0.05;
      g.gain.setValueAtTime(gain, Math.max(t, until - f)); g.gain.linearRampToValueAtTime(0.0001, until);
    }
    src.connect(g); g.connect(master);
    const off = onsetOf[name] || 0;
    src.start(t, off); src.stop(until != null ? until + 0.02 : t + buf.duration);
  }
  function note(ev, t0) {
    const V = VOICES[voiceId], t = t0 + ev.t, vel = ev.vel == null ? 1 : ev.vel;
    const strong = vel >= 0.95;
    const name = strong ? V.a : V.n[(rr++) % V.n.length];
    const end = t + ev.d - 0.01;
    if (V.roll && ev.len >= ROLL_TICKS) {
      shot(name, t, V.gain * vel * 0.85, end, 0.12);
      shot(V.roll, t + 0.01, V.gain * vel * 0.8, end, 0.12);
    } else {
      shot(name, t, V.gain * vel, end, Math.min(0.06, ev.d * 0.25));
    }
  }

  function stopAll() {
    token++;
    timers.forEach(clearTimeout); timers = [];
    live.forEach((n) => { try { n.stop(); } catch (e) { /* */ } });
    live.clear();
  }

  /**
   * يشغّل جدولًا من RD.buildSchedule. on: { start(t0), event(ev), end() }
   * يعيد وعدًا يُحَل عند الانتهاء أو الإيقاف ({stopped:true}) أو تعذر التحميل ({failed:true}).
   */
  async function play(schedule, on) {
    on = on || {};
    stopAll();
    const my = token;
    const c = await resume();
    if (!c) return { stopped: true, noAudio: true };
    try { await preload(voiceId); } catch (e) { return { stopped: true, failed: true }; }
    if (my !== token) return { stopped: true };
    const t0 = c.currentTime + 0.12;
    schedule.events.forEach((ev) => {
      if (ev.type === 'note') note(ev, t0);
      else {
        const S = ev.type === 'count' ? COUNT : CLICK;
        shot(ev.accent ? S.a : S.n, t0 + ev.t, ev.type === 'count' ? 0.9 : 0.6);
      }
      if (on.event) timers.push(setTimeout(() => { if (my === token) on.event(ev); }, Math.max(0, (t0 + ev.t - c.currentTime) * 1000)));
    });
    if (on.start) on.start(t0);
    return new Promise((res) => {
      timers.push(setTimeout(() => { if (my === token) { if (on.end) on.end(); res({ stopped: false }); } }, (t0 - c.currentTime + schedule.total) * 1000 + 60));
      const check = setInterval(() => { if (my !== token) { clearInterval(check); res({ stopped: true }); } }, 120);
      timers.push(setTimeout(() => clearInterval(check), (t0 - c.currentTime + schedule.total) * 1000 + 200));
    });
  }

  // تعزيز الفوز: رول تمباني متصاعد ثم ضربة صنج وضربة تمباني قوية (تسجيلات حقيقية، نحو 3 ثوانٍ)
  async function fanfare(level) {
    const c = await resume(); if (!c) return;
    try { await Promise.all(['timpani-roll', 'timpani-a', 'cymbal'].map(load)); } catch (e) { return; }
    const t = c.currentTime + 0.05, big = level !== 'small';
    const roll = track(ctx.createBufferSource()); roll.buffer = buffers['timpani-roll'];
    const g = ctx.createGain(); g.gain.setValueAtTime(0.05, t); g.gain.exponentialRampToValueAtTime(big ? 0.9 : 0.5, t + 1.1);
    g.gain.setValueAtTime(big ? 0.9 : 0.5, t + 1.15); g.gain.linearRampToValueAtTime(0.0001, t + 1.3);
    roll.connect(g); g.connect(master); roll.start(t, onsetOf['timpani-roll'] || 0); roll.stop(t + 1.35);
    shot('timpani-a', t + 1.2, big ? 1 : 0.6);
    shot('cymbal', t + 1.2, big ? 0.7 : 0.35, t + 3.6, 1.2);
  }

  root.RDAudio = {
    VOICES, ROLL_TICKS, resume, play, stopAll, setVolume, setVoice, preload, fanfare,
    get voice() { return voiceId; }, get volume() { return volume; }, get busy() { return live.size > 0; },
    now() { return ctx ? ctx.currentTime : 0; },
    /** عتبة الرول للتصحيح: الآلة بلا رول = لا يُسمع امتداد أي علامة */
    rollTicksFor(v) { const V = VOICES[v || voiceId]; return V && V.roll ? ROLL_TICKS : Infinity; },
  };
})(typeof window !== 'undefined' ? window : globalThis);
