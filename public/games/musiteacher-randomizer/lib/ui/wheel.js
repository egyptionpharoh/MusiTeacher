// =====================================================================
//  عجلة Canvas: دوران ناعم بعشوائية حقيقية (crypto). الفائز يُختار أولًا بالتساوي، ثم تُحسب زاوية التوقف داخل قطاعه
//  (موضع عشوائي غير قريب من الحافة) فلا يتأثر العدل بالفيزياء. صوت «تك» قصير عند عبور كل قطاع (WebAudio).
// =====================================================================
import { rand } from '../core/names.js';

const COLORS = ['#22c3ff', '#7c5cff', '#f2b84b', '#34d399', '#f472b6', '#60a5fa', '#fb923c', '#a3e635', '#e879f9', '#2dd4bf', '#facc15', '#f87171'];

export class Wheel {
  constructor(canvas, { onTick } = {}) {
    this.c = canvas; this.ctx = canvas.getContext('2d'); this.items = []; this.angle = 0; this.spinning = false; this.onTick = onTick;
    this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(canvas); this.resize();
  }
  destroy() { this.ro.disconnect(); cancelAnimationFrame(this.raf); }
  resize() {
    const r = this.c.getBoundingClientRect(); const d = Math.min(window.devicePixelRatio || 1, 2);
    const s = Math.max(200, Math.round(r.width * d)); if (this.c.width !== s) { this.c.width = s; this.c.height = s; }
    this.draw();
  }
  setItems(items) { this.items = items.slice(); this.draw(); }
  draw(highlight = -1) {
    const { ctx, c } = this, S = c.width, R = S / 2 - S * 0.02, cx = S / 2, cy = S / 2, n = this.items.length;
    ctx.clearRect(0, 0, S, S);
    ctx.save(); ctx.translate(cx, cy);
    // الإطار
    ctx.beginPath(); ctx.arc(0, 0, R + S * 0.015, 0, Math.PI * 2); ctx.fillStyle = '#0b1222'; ctx.fill();
    ctx.lineWidth = S * 0.012; ctx.strokeStyle = '#f2b84b'; ctx.stroke();
    if (!n) {
      ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.fillStyle = '#1c2b4b'; ctx.fill();
      ctx.fillStyle = '#9fb0d3'; ctx.font = `700 ${S * 0.045}px Cairo, sans-serif`; ctx.textAlign = 'center'; ctx.fillText('أضف أسماء للبدء', 0, -S * 0.14);
      ctx.restore(); return;
    }
    const seg = (Math.PI * 2) / n;
    ctx.rotate(this.angle);
    for (let i = 0; i < n; i++) {
      const a0 = -Math.PI / 2 + i * seg;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, R, a0, a0 + seg); ctx.closePath();
      ctx.fillStyle = COLORS[(n % COLORS.length === 1 && i === n - 1) ? 2 : i % COLORS.length];
      ctx.globalAlpha = highlight >= 0 && highlight !== i ? 0.35 : 1; ctx.fill(); ctx.globalAlpha = 1;
      if (n <= 60) { ctx.strokeStyle = 'rgba(11,18,34,.55)'; ctx.lineWidth = Math.max(1, S * 0.003); ctx.stroke(); }
      // النص
      ctx.save(); ctx.rotate(a0 + seg / 2);
      const label = String(this.items[i]);
      const maxW = R * 0.72;
      let fs = Math.min(S * 0.05, (seg * R * 0.62)); fs = Math.max(fs, S * 0.016);
      ctx.font = `800 ${fs}px Cairo, sans-serif`;
      let t = label; while (ctx.measureText(t).width > maxW && t.length > 3) t = `${t.slice(0, -2)}…`;
      ctx.fillStyle = '#0b1222'; ctx.textBaseline = 'middle'; ctx.direction = 'rtl';
      // عند التوقف نقلب نصوص النصف الأيسر حتى لا تُقرأ مقلوبة (لا قلب أثناء الدوران لتجنّب الوميض)
      const screen = a0 + seg / 2 + this.angle;
      if (!this.spinning && Math.cos(screen) < -0.05) { ctx.rotate(Math.PI); ctx.textAlign = 'left'; ctx.fillText(t, -R * 0.93, 0); }
      else { ctx.textAlign = 'right'; ctx.fillText(t, R * 0.93, 0); }
      ctx.restore();
    }
    ctx.restore();
  }
  /** يدور ويعيد رقم العنصر الفائز. dur بالمللي ثانية */
  spin({ dur = 5200, reduced = false } = {}) {
    const n = this.items.length; if (!n || this.spinning) return Promise.resolve(-1);
    this.spinning = true;
    const winner = Math.floor(rand() * n);
    const seg = (Math.PI * 2) / n;
    // المؤشر في الأعلى: نريد منتصف (أو موضعًا عشوائيًا داخل) قطاع الفائز تحت المؤشر
    const within = (0.18 + rand() * 0.64) * seg;
    const target = -(winner * seg + within);
    const base = this.angle % (Math.PI * 2);
    const turns = reduced ? 1 : 5 + Math.floor(rand() * 3);
    let delta = target - base; delta = ((delta % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    const start = this.angle, total = turns * Math.PI * 2 + delta, T = reduced ? 900 : dur;
    let last = Math.floor(((-start) % (Math.PI * 2) + Math.PI * 2) / seg);
    const t0 = performance.now();
    return new Promise((res) => {
      const step = (now) => {
        const p = Math.min(1, (now - t0) / T);
        const e = 1 - (1 - p) ** 4;                        // تباطؤ ناعم في النهاية
        this.angle = start + total * e; this.draw();
        const idx = Math.floor((((-this.angle) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) / seg);
        if (idx !== last) { last = idx; this.onTick && this.onTick(1 - p); }
        if (p < 1) this.raf = requestAnimationFrame(step);
        else { this.spinning = false; this.draw(winner); res(winner); }
      };
      this.raf = requestAnimationFrame(step);
    });
  }
}

// ------------------------------------------------ الأصوات (اختيارية مع كتم)
const AUD = '/games/musiteacher-randomizer/assets/audio/';
export class Sounds {
  constructor() { this.on = true; this.cache = {}; }
  ac() { if (!this._ac) { try { this._ac = new (window.AudioContext || window.webkitAudioContext)(); } catch { this._ac = null; } } return this._ac; }
  tick(speed = 1) {
    if (!this.on) return; const ac = this.ac(); if (!ac) return;
    const t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain();
    o.type = 'triangle'; o.frequency.value = 1500 + speed * 500;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.12, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.045);
    o.connect(g).connect(ac.destination); o.start(t); o.stop(t + 0.05);
  }
  play(name, vol = 0.7) {
    if (!this.on) return;
    try {
      const a = this.cache[name] || (this.cache[name] = new Audio(AUD + name));
      a.volume = vol; a.currentTime = 0; a.play().catch(() => {});
    } catch { /* ignore */ }
  }
  stopAll() { Object.values(this.cache).forEach((a) => { try { a.pause(); } catch { /* ignore */ } }); }
}
