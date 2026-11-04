// =====================================================================
//  النبض المسموع: تسجيلات حقيقية (VCSL، CC0) للبلوك الخشبي والكلافيس، مجدولة على ساعة الصوت
//  (AudioContext.currentTime) نفسها التي تقرأ منها الحركة، فيتزامن الصوت والإكتوس.
//  النبر: القوي = عيّنة النبر بمستوى كامل، المتوسط (الثالثة في الرباعي) أخفض، الضعيف أخفض بوضوح.
//  إن تعذّر تحميل العيّنات يُستخدم نقر مُركَّب بديل.
// =====================================================================
const FILES = { wood: { a: 'audio/wood-a.mp3', n: 'audio/wood-1.mp3' }, claves: { a: 'audio/claves-a.mp3', n: 'audio/claves-1.mp3' } };
const LEVEL = { strong: 1.0, medium: 0.62, weak: 0.4 };

export class Pulse {
  constructor() { this.ctx = null; this.buf = {}; this.voice = 'wood'; this.vol = 0.8; this.muted = false; this.live = new Set(); this.loaded = false; this.stats = { scheduled: 0 }; }

  /** يُستدعى عند أول تفاعل للمستخدم (سياسة التشغيل التلقائي في المتصفحات) */
  async init() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      this.ctx = new AC({ latencyHint: 'interactive' });
      this.master = this.ctx.createGain(); this.master.gain.value = this.muted ? 0 : this.vol; this.master.connect(this.ctx.destination);
      this._loading = this._load();
    }
    if (this.ctx.state === 'suspended') { try { await this.ctx.resume(); } catch (e) { /* */ } }
    await this._loading;
    return true;
  }
  async _load() {
    const jobs = [];
    for (const v in FILES) for (const k in FILES[v]) jobs.push((async () => {
      try { const r = await fetch(FILES[v][k]); if (!r.ok) throw new Error(r.status); this.buf[v + k] = await this.ctx.decodeAudioData(await r.arrayBuffer()); }
      catch (e) { console.warn('sample', v, k, e); }
    })());
    await Promise.all(jobs);
    this.loaded = Object.keys(this.buf).length > 0;
  }

  now() { return this.ctx ? this.ctx.currentTime : performance.now() / 1000; }
  /** الزمن المسموع الآن (يطرح كمون الخرج) — منه تُحسب الحركة كي يتطابق ما يُرى مع ما يُسمع */
  heardNow() {
    const c = this.ctx; if (!c) return performance.now() / 1000;
    if (c.getOutputTimestamp) {
      const ts = c.getOutputTimestamp();
      if (ts && ts.contextTime > 0 && ts.performanceTime > 0) return ts.contextTime + (performance.now() - ts.performanceTime) / 1000;
    }
    return c.currentTime - (c.outputLatency || c.baseLatency || 0);
  }

  setVolume(v) { this.vol = Math.max(0, Math.min(1, v)); if (this.master && !this.muted) this.master.gain.setTargetAtTime(this.vol, this.ctx.currentTime, 0.02); }
  setMuted(m) { this.muted = !!m; if (this.master) this.master.gain.setTargetAtTime(this.muted ? 0 : this.vol, this.ctx.currentTime, 0.02); }
  setVoice(v) { if (FILES[v]) this.voice = v; }

  /** نقرة عند الزمن t (زمن سياق الصوت) بنبر accent */
  click(t, accent = 'weak') {
    const c = this.ctx; if (!c) return;
    const g = c.createGain(); g.gain.value = LEVEL[accent] ?? 0.4; g.connect(this.master);
    const b = this.buf[this.voice + (accent === 'strong' ? 'a' : 'n')] || this.buf[this.voice + 'a'];
    let src;
    if (b) { src = c.createBufferSource(); src.buffer = b; src.connect(g); src.start(Math.max(t, c.currentTime)); }
    else {                                                   // بديل مُركَّب
      src = c.createOscillator(); src.frequency.value = accent === 'strong' ? 1500 : 1000;
      const e = c.createGain(); e.gain.setValueAtTime(0.0001, t); e.gain.exponentialRampToValueAtTime(0.6, t + 0.002); e.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
      src.connect(e); e.connect(g); src.start(t); src.stop(t + 0.08);
    }
    const rec = { src, t, g };
    this.live.add(rec); src.onended = () => { this.live.delete(rec); try { g.disconnect(); } catch (e) { /* */ } };
    this.stats.scheduled++;
  }

  /** إلغاء كل النقرات المجدولة بعد الزمن t (الإيقاف وتغيير السرعة) */
  cancelAfter(t = 0) {
    for (const r of [...this.live]) if (r.t >= t - 1e-4) { try { r.src.stop(); } catch (e) { /* */ } this.live.delete(r); try { r.g.disconnect(); } catch (e) { /* */ } }
  }
  /** إيقاف تام: لا يبقى صوت بعد الإيقاف */
  hush() { this.cancelAfter(-1); }
  pending() { return this.live.size; }
  async close() { this.hush(); if (this.ctx) { try { await this.ctx.close(); } catch (e) { /* */ } } this.ctx = null; }
}
