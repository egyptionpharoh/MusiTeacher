// ============================================================================
// audio.js — محرك الصوت الإيقاعي (Web Audio، أصوات مولَّدة برمجيًا بالكامل، لا ملفات ولا مصادر خارجية)
//  • صوت الإيقاع: نغمة ثابتة واحدة ممتدة بطول القيمة الزمنية الفعلية (فتُسمَع البلانش ممتدة،
//    ويُسمَع الفرق بين «نوار + سكتة نوار» و«بلانش»). لا علاقة له بالنغمات أو الدرجات الصوتية.
//  • المترونوم والعدّ التمهيدي: نقرة خشبية قصيرة مختلفة الطابع تمامًا، والضربة الأولى أقوى.
//  • لا تداخل: كل تشغيل جديد يوقف السابق فورًا.
// ============================================================================
(function (root) {
  'use strict';
  let ctx = null, master = null, noiseBuf = null;
  let volume = 0.8;
  let live = new Set(), timers = [], token = 0;

  function ensure() {
    if (ctx) return ctx;
    const AC = root.AudioContext || root.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = volume;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4;
    master.connect(comp); comp.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.06), ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3);
    return ctx;
  }
  async function resume() { const c = ensure(); if (c && c.state === 'suspended') { try { await c.resume(); } catch (e) { /* */ } } return c; }
  function setVolume(v) { volume = Math.max(0, Math.min(1, v)); if (master) master.gain.setTargetAtTime(volume, ctx.currentTime, 0.02); }
  const track = (n) => { live.add(n); n.onended = () => live.delete(n); return n; };

  // صوت الإيقاع: مثلثي ناعم + توافقي خفيف، ممتد بطول العلامة مع فصل قصير قبل النقرة التالية
  function note(t, dur, gain) {
    // فصل ثابت قصير (≤45ms) قبل النقرة التالية حتى تتميز العلامات المتتالية، مع الحفاظ على امتداد العلامة الطويلة
    const len = Math.max(0.05, dur - Math.min(0.045, dur * 0.2));
    const o1 = track(ctx.createOscillator()), o2 = track(ctx.createOscillator());
    o1.type = 'triangle'; o1.frequency.value = 523.25;
    o2.type = 'sine'; o2.frequency.value = 1046.5;
    const g = ctx.createGain(), g2 = ctx.createGain(), lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 2600;
    g2.gain.value = 0.18;
    const peak = 0.55 * (gain || 1);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.008);
    g.gain.exponentialRampToValueAtTime(peak * 0.62, t + 0.09);
    g.gain.setValueAtTime(peak * 0.62, t + Math.max(0.09, len - 0.03));
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    o1.connect(lp); o2.connect(g2); g2.connect(lp); lp.connect(g); g.connect(master);
    o1.start(t); o2.start(t); o1.stop(t + len + 0.02); o2.stop(t + len + 0.02);
  }
  // نقرة خشبية (مترونوم / عدّ تمهيدي)
  function click(t, accent, kind) {
    const src = track(ctx.createBufferSource()); src.buffer = noiseBuf;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass';
    bp.frequency.value = kind === 'count' ? (accent ? 2400 : 1900) : (accent ? 3400 : 2700); bp.Q.value = 6;
    const g = ctx.createGain();
    const lvl = (kind === 'count' ? 0.9 : 0.55) * (accent ? 1.35 : 1);
    g.gain.setValueAtTime(lvl, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    src.connect(bp); bp.connect(g); g.connect(master);
    src.start(t); src.stop(t + 0.06);
  }

  function stopAll() {
    token++;
    timers.forEach(clearTimeout); timers = [];
    live.forEach((n) => { try { n.stop(); } catch (e) { /* */ } });
    live.clear();
  }

  /**
   * يشغّل جدولًا من RD.buildSchedule. on: { start(t0), event(ev), end() }
   * يعيد وعدًا يُحَل عند الانتهاء أو الإيقاف ({stopped:true}).
   */
  async function play(schedule, on) {
    on = on || {};
    stopAll();
    const c = await resume();
    if (!c) return { stopped: true, noAudio: true };
    const my = token;
    const t0 = c.currentTime + 0.12;
    schedule.events.forEach((ev) => {
      if (ev.type === 'note') note(t0 + ev.t, ev.d);
      else click(t0 + ev.t, ev.accent, ev.type);
      if (on.event) timers.push(setTimeout(() => { if (my === token) on.event(ev); }, (0.12 + ev.t) * 1000));
    });
    if (on.start) on.start(t0);
    return new Promise((res) => {
      timers.push(setTimeout(() => { if (my === token) { if (on.end) on.end(); res({ stopped: false }); } }, (0.12 + schedule.total) * 1000 + 60));
      const check = setInterval(() => { if (my !== token) { clearInterval(check); res({ stopped: true }); } }, 120);
      timers.push(setTimeout(() => clearInterval(check), (0.12 + schedule.total) * 1000 + 200));
    });
  }

  root.RDAudio = { resume, play, stopAll, setVolume, get volume() { return volume; }, get busy() { return live.size > 0; } };
})(typeof window !== 'undefined' ? window : globalThis);
