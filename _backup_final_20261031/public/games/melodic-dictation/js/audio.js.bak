// ============================================================================
// audio.js — محرك الصوت (Web Audio مباشرة، بلا مكتبات خارجية)
// • عينات بيانو Salamander محلية داخل مجلد اللعبة (audio/) مع بديل مُركَّب إن تعذّر تحميلها
// • جدولة دقيقة بزمن AudioContext (lookahead) + مزامنة التمييز المرئي
// • أصوات مترونوم وقراءة إيقاعية مولّدة
// ============================================================================
(function (MT) {
  'use strict';
  const SAMPLES = [
    ['A3', 57, 2.314], ['C4', 60, 1.501], ['Ds4', 63, 1.344], ['Fs4', 66, 1.828], ['A4', 69, 2.189],
    ['C5', 72, 4.0], ['Ds5', 75, 3.089], ['Fs5', 78, 2.163], ['A5', 81, 2.475], ['C6', 84, 1.981],
  ];

  class AudioEngine {
    constructor(baseUrl) {
      this.baseUrl = baseUrl || 'audio/';
      this.ctx = null;
      this.buffers = {};
      this.volume = 0.8;
      this.status = 'idle'; // idle | loading | samples | synth
      this.session = null;
      this.listeners = [];
    }
    onStatus(fn) { this.listeners.push(fn); }
    _setStatus(s) { this.status = s; this.listeners.forEach(fn => fn(s)); }

    ensure() {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.volume;
        const comp = this.ctx.createDynamicsCompressor();
        comp.threshold.value = -14; comp.ratio.value = 3;
        this.master.connect(comp); comp.connect(this.ctx.destination);
        this._load();
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return this.ctx;
    }

    setVolume(v) { this.volume = v; if (this.master) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.02); }

    async _load() {
      this._setStatus('loading');
      let ok = 0;
      await Promise.all(SAMPLES.map(async ([name, midi, gain]) => {
        try {
          // في النسخة المستقلة (ملف واحد) تكون العينات مضمّنة داخل الصفحة
          const url = (window.MT_SAMPLE_URLS && window.MT_SAMPLE_URLS[name]) || (this.baseUrl + name + '.mp3');
          const res = await fetch(url);
          if (!res.ok) throw new Error(res.status);
          const buf = await res.arrayBuffer();
          const audio = await new Promise((resolve, reject) => this.ctx.decodeAudioData(buf, resolve, reject));
          this.buffers[midi] = { buf: audio, gain };
          ok++;
        } catch (e) { /* يُستخدم الصوت المركّب لهذه المنطقة */ }
      }));
      this._setStatus(ok >= 6 ? 'samples' : 'synth');
    }

    // ---------------------------------------------------------------- الأصوات
    _nearest(midi) {
      let best = null, bd = 99;
      Object.keys(this.buffers).forEach(k => { const d = Math.abs(+k - midi); if (d < bd) { bd = d; best = +k; } });
      return bd <= 4 ? best : null;
    }

    note(midi, when, dur, vel, session) {
      const ctx = this.ctx; if (!ctx) return;
      vel = vel === undefined ? 0.9 : vel;
      const out = ctx.createGain();
      out.connect(this.master);
      const sm = this._nearest(midi);
      const end = when + Math.max(0.08, dur);
      if (sm !== null) {
        const s = this.buffers[sm];
        const src = ctx.createBufferSource();
        src.buffer = s.buf;
        src.playbackRate.value = Math.pow(2, (midi - sm) / 12);
        const g = Math.min(1.6, s.gain * 0.42) * vel;
        out.gain.setValueAtTime(0, when);
        out.gain.linearRampToValueAtTime(g, when + 0.004);
        out.gain.setValueAtTime(g, end - 0.02);
        out.gain.exponentialRampToValueAtTime(0.0008, end + 0.28);
        src.connect(out);
        src.start(when);
        src.stop(end + 0.32);
        this._track(src, session);
      } else {
        const f = 440 * Math.pow(2, (midi - 69) / 12);
        const o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), g2 = ctx.createGain();
        o1.type = 'triangle'; o1.frequency.value = f;
        o2.type = 'sine'; o2.frequency.value = f * 2; g2.gain.value = 0.18;
        const peak = 0.32 * vel;
        out.gain.setValueAtTime(0, when);
        out.gain.linearRampToValueAtTime(peak, when + 0.012);
        out.gain.exponentialRampToValueAtTime(peak * 0.45, when + 0.25);
        out.gain.setValueAtTime(peak * 0.45, Math.max(when + 0.26, end - 0.03));
        out.gain.exponentialRampToValueAtTime(0.0008, end + 0.18);
        o1.connect(out); o2.connect(g2); g2.connect(out);
        o1.start(when); o2.start(when); o1.stop(end + 0.22); o2.stop(end + 0.22);
        this._track(o1, session); this._track(o2, session);
      }
    }

    // نقرة المترونوم (الأولى في المازورة أقوى)
    click(when, accent, session) {
      const ctx = this.ctx; if (!ctx) return;
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'square'; o.frequency.value = accent ? 1760 : 1180;
      g.gain.setValueAtTime(0, when);
      g.gain.linearRampToValueAtTime(accent ? 0.22 : 0.12, when + 0.002);
      g.gain.exponentialRampToValueAtTime(0.0005, when + 0.05);
      o.connect(g); g.connect(this.master);
      o.start(when); o.stop(when + 0.06);
      this._track(o, session);
    }

    // صوت القراءة الإيقاعية: نقرة خشبية تمتد بطول القيمة الزمنية (ليُسمع الفرق بين نوار وبلانش)
    hit(when, dur, session) {
      const ctx = this.ctx; if (!ctx) return;
      const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
      o.type = 'triangle'; o.frequency.setValueAtTime(820, when); o.frequency.exponentialRampToValueAtTime(600, when + 0.05);
      f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 3;
      const end = when + Math.max(0.09, dur * 0.92);
      g.gain.setValueAtTime(0, when);
      g.gain.linearRampToValueAtTime(0.5, when + 0.003);
      g.gain.exponentialRampToValueAtTime(0.16, when + 0.06);
      g.gain.setValueAtTime(0.16, Math.max(when + 0.07, end - 0.03));
      g.gain.exponentialRampToValueAtTime(0.0005, end);
      o.connect(f); f.connect(g); g.connect(this.master);
      o.start(when); o.stop(end + 0.02);
      this._track(o, session);
    }

    _track(node, session) {
      if (!session) return;
      session.nodes.add(node);
      node.onended = () => session.nodes.delete(node);
    }

    // ------------------------------------------------------------- معاينة فورية
    preview(midi, dur) {
      if (!this.ensure()) return;
      this.note(midi, this.ctx.currentTime + 0.01, dur || 0.45, 0.85, null);
    }
    previewHit(dur) { if (!this.ensure()) return; this.hit(this.ctx.currentTime + 0.01, dur || 0.3, null); }

    // ---------------------------------------------------------------- التشغيل
    // items: [{ time(ث), type:'note'|'hit'|'click', midi, dur(ث), accent, ref }]
    play(items, opts) {
      opts = opts || {};
      this.stop(true);
      const ctx = this.ensure();
      if (!ctx) { opts.onEnd && opts.onEnd(); return null; }
      const total = opts.total || (items.length ? Math.max(...items.map(i => i.time + (i.dur || 0))) : 0);
      const session = { nodes: new Set(), stopped: false, t0: ctx.currentTime + 0.15, i: 0, visual: [], cycle: 0, opts, total };
      this.session = session;
      const LOOK = 0.3;
      const pump = () => {
        if (session.stopped) return;
        const horizon = ctx.currentTime + LOOK;
        let guard = 0;
        while (guard++ < 500) {
          if (session.i >= items.length) {
            if (opts.loop && total > 0) { session.i = 0; session.t0 += total; session.cycle++; continue; }
            break;
          }
          const it = items[session.i];
          const at = session.t0 + it.time;
          if (at > horizon) break;
          if (it.type === 'note') this.note(it.midi, at, it.dur, it.vel, session);
          else if (it.type === 'hit') this.hit(at, it.dur, session);
          else if (it.type === 'click') this.click(at, it.accent, session);
          if (it.ref !== undefined) session.visual.push({ at, ref: it.ref, cycle: session.cycle });
          session.i++;
        }
      };
      const frame = () => {
        if (session.stopped) return;
        const now = ctx.currentTime;
        while (session.visual.length && session.visual[0].at <= now + 0.01) {
          const v = session.visual.shift();
          opts.onEvent && opts.onEvent(v.ref);
        }
        if (!opts.loop && session.i >= items.length && now >= session.t0 + total + 0.05) {
          this.stop(); return;
        }
        session.raf = requestAnimationFrame(frame);
      };
      pump();
      session.timer = setInterval(pump, 40);
      session.raf = requestAnimationFrame(frame);
      return session;
    }

    isPlaying() { return !!(this.session && !this.session.stopped); }

    stop(silent) {
      const s = this.session;
      if (!s || s.stopped) return;
      s.stopped = true;
      clearInterval(s.timer);
      cancelAnimationFrame(s.raf);
      const now = this.ctx ? this.ctx.currentTime : 0;
      s.nodes.forEach(n => { try { n.stop(now + 0.02); } catch (e) { /* انتهت أصلًا */ } });
      s.nodes.clear();
      this.session = null;
      if (!silent && s.opts.onEnd) s.opts.onEnd();
      else if (silent && s.opts.onEnd) s.opts.onEnd(true);
    }
  }

  MT.AudioEngine = AudioEngine;
})(window.MT = window.MT || {});
