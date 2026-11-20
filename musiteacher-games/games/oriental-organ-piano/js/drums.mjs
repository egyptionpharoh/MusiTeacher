// drums.mjs — أصوات الإيقاع مولَّدة برمجيًا بالكامل (لا تسجيلات، فلا حقوق خارجية).
// دوال خالصة: كل دالة تُرجع Float32Array بمعدل العينة المطلوب، فتُختبر في Node وتُحوَّل في المتصفح إلى AudioBuffer.
// النمذجة تقريبية تعليمية: الدُّم = رنين غشاء منخفض تهبط طبقته قليلًا، التك = ضربة الحافة الحادة، الرق = جلاجل معدنية…

function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296 * 2 - 1; }; }

// مرشح تمرير نطاقي من الدرجة الثانية (RBJ) على مصفوفة
function bandpass(x, sr, f, q) {
  const w = 2 * Math.PI * f / sr, al = Math.sin(w) / (2 * q), c = Math.cos(w);
  const b0 = al, b2 = -al, a0 = 1 + al, a1 = -2 * c, a2 = 1 - al;
  const y = new Float32Array(x.length); let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) { const v = (b0 * x[i] + b2 * x2 - a1 * y1 - a2 * y2) / a0; x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v; }
  return y;
}
function highpass(x, sr, f) {
  const RC = 1 / (2 * Math.PI * f), dt = 1 / sr, a = RC / (RC + dt);
  const y = new Float32Array(x.length); let px = 0, py = 0;
  for (let i = 0; i < x.length; i++) { py = a * (py + x[i] - px); px = x[i]; y[i] = py; }
  return y;
}
const noise = (n, seed) => { const r = rng(seed), a = new Float32Array(n); for (let i = 0; i < n; i++) a[i] = r(); return a; };
function normalize(a, peak) { let m = 0; for (const v of a) m = Math.max(m, Math.abs(v)); const k = m ? peak / m : 0; for (let i = 0; i < a.length; i++) a[i] *= k; return a; }
function fadeOut(a, sr, ms = 6) { const n = Math.min(a.length, Math.floor(sr * ms / 1000)); for (let i = 0; i < n; i++) a[a.length - 1 - i] *= i / n; return a; }

// غشاء: جيب تهبط طبقته من f0 إلى f1، مع غلاف أُسّي، ونقرة ضجيج قصيرة في البداية
function membrane(sr, { f0, f1, drop = 0.04, decay, len, click = 0.3, clickF = 2000, seed = 1, harm = 0 }) {
  const n = Math.floor(len * sr), out = new Float32Array(n);
  let ph = 0, ph2 = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const f = f1 + (f0 - f1) * Math.exp(-t / drop);
    ph += 2 * Math.PI * f / sr; ph2 += 2 * Math.PI * f * 1.59 / sr;  // نمط الغشاء الثاني (نسبة 1.59 تقريبًا)
    const env = Math.exp(-t / decay) * Math.min(1, t * sr / 24);
    out[i] = (Math.sin(ph) + harm * Math.sin(ph2) * Math.exp(-t / (decay * 0.35))) * env;
  }
  const c = bandpass(noise(Math.floor(0.03 * sr), seed), sr, clickF, 1.2);
  for (let i = 0; i < c.length && i < n; i++) out[i] += c[i] * click * Math.exp(-i / (0.006 * sr)) * 4;
  return out;
}
// ضربة حادة: ضجيج مُرشَّح + رنين قصير (تك الدربكة، الحافة)
function crack(sr, { f, q = 4, decay = 0.05, len = 0.18, tone = 0, toneF = 800, seed = 2 }) {
  const n = Math.floor(len * sr);
  const b = bandpass(noise(n, seed), sr, f, q), out = new Float32Array(n);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr, env = Math.exp(-t / decay);
    ph += 2 * Math.PI * toneF / sr;
    out[i] = b[i] * env * 3 + tone * Math.sin(ph) * Math.exp(-t / (decay * 1.3));
  }
  return out;
}
// معدني: موجات مربعة بنسب غير توافقية (طريقة الهاي هات الكلاسيكية) مع مرشح عالٍ
function metal(sr, { base = 330, decay = 0.06, len = 0.3, hp = 6000, seed = 3 }) {
  const ratios = [1, 1.342, 1.2312, 1.6532, 1.9523, 2.1523];
  const n = Math.floor(len * sr), raw = new Float32Array(n);
  const ph = ratios.map(() => 0);
  for (let i = 0; i < n; i++) {
    let v = 0;
    ratios.forEach((r, k) => { ph[k] += base * r / sr; v += (ph[k] % 1) < 0.5 ? 1 : -1; });
    raw[i] = v / ratios.length;
  }
  const nz = noise(n, seed);
  for (let i = 0; i < n; i++) raw[i] = raw[i] * 0.7 + nz[i] * 0.3;
  const y = highpass(highpass(raw, sr, hp), sr, hp);
  for (let i = 0; i < n; i++) y[i] *= Math.exp(-(i / sr) / decay);
  return y;
}
function clapSound(sr, seed = 9) {
  const n = Math.floor(0.3 * sr), out = new Float32Array(n);
  const b = bandpass(noise(n, seed), sr, 1300, 1.4);
  const bursts = [0, 0.011, 0.022, 0.034];
  for (let i = 0; i < n; i++) {
    const t = i / sr; let env = 0;
    bursts.forEach((t0, k) => { if (t >= t0) env += (k === bursts.length - 1 ? 1 : 0.7) * Math.exp(-(t - t0) / (k === bursts.length - 1 ? 0.07 : 0.006)); });
    out[i] = b[i] * env * 2.5;
  }
  return out;
}

/** كل الأصوات: الاسم → { make(sr) , gain , ar } */
export const DRUMS = Object.freeze({
  dum: { ar: 'دُم', gain: 1.0, make: (sr) => membrane(sr, { f0: 150, f1: 92, drop: 0.03, decay: 0.24, len: 0.7, click: 0.25, clickF: 900, seed: 11, harm: 0.25 }) },
  tak: { ar: 'تك', gain: 0.8, make: (sr) => crack(sr, { f: 3800, q: 2.2, decay: 0.035, len: 0.16, tone: 0.5, toneF: 640, seed: 12 }) },
  ka: { ar: 'كا', gain: 0.55, make: (sr) => crack(sr, { f: 3200, q: 2.5, decay: 0.025, len: 0.12, tone: 0.35, toneF: 600, seed: 13 }) },
  riq: { ar: 'رق', gain: 0.45, make: (sr) => { const m = metal(sr, { base: 540, decay: 0.07, len: 0.25, hp: 5500, seed: 14 }); const s = crack(sr, { f: 1800, q: 1.5, decay: 0.02, len: 0.25, seed: 15 }); for (let i = 0; i < m.length; i++) m[i] += s[i] * 0.25; return m; } },
  rahmani: { ar: 'رحماني', gain: 1.0, make: (sr) => membrane(sr, { f0: 96, f1: 58, drop: 0.05, decay: 0.38, len: 1.0, click: 0.35, clickF: 700, seed: 21, harm: 0.15 }) },
  kasir: { ar: 'كاسر', gain: 0.85, make: (sr) => { const a = membrane(sr, { f0: 230, f1: 175, drop: 0.02, decay: 0.12, len: 0.4, click: 0.6, clickF: 2600, seed: 22, harm: 0.4 }); return a; } },
  tar: { ar: 'طار', gain: 0.8, make: (sr) => { const a = membrane(sr, { f0: 120, f1: 96, drop: 0.03, decay: 0.16, len: 0.5, click: 0.5, clickF: 1600, seed: 23, harm: 0.5 }); return a; } },
  clap: { ar: 'تصفيق', gain: 0.75, make: (sr) => clapSound(sr, 24) },
  snj: { ar: 'صنوج', gain: 0.5, make: (sr) => metal(sr, { base: 410, decay: 0.32, len: 1.0, hp: 3500, seed: 25 }) },
  kick: { ar: 'طبل كبير', gain: 1.0, make: (sr) => membrane(sr, { f0: 160, f1: 48, drop: 0.035, decay: 0.28, len: 0.6, click: 0.2, clickF: 3000, seed: 31 }) },
  snare: { ar: 'سنير', gain: 0.8, make: (sr) => { const t = membrane(sr, { f0: 240, f1: 185, drop: 0.01, decay: 0.07, len: 0.3, click: 0, seed: 32 }); const n = crack(sr, { f: 4500, q: 0.7, decay: 0.11, len: 0.3, seed: 33 }); for (let i = 0; i < t.length; i++) t[i] = t[i] * 0.6 + n[i] * 0.55; return t; } },
  hat: { ar: 'هاي هات', gain: 0.45, make: (sr) => metal(sr, { base: 330, decay: 0.035, len: 0.15, hp: 7000, seed: 34 }) },
  ohat: { ar: 'هاي هات مفتوح', gain: 0.45, make: (sr) => metal(sr, { base: 330, decay: 0.25, len: 0.7, hp: 7000, seed: 35 }) },
  rim: { ar: 'حافة', gain: 0.6, make: (sr) => crack(sr, { f: 1700, q: 6, decay: 0.02, len: 0.1, tone: 0.6, toneF: 1700, seed: 36 }) },
  click: { ar: 'مترونوم', gain: 0.6, make: (sr) => crack(sr, { f: 2400, q: 8, decay: 0.012, len: 0.06, tone: 0.8, toneF: 2000, seed: 41 }) },
  clickHi: { ar: 'مترونوم (نبر)', gain: 0.75, make: (sr) => crack(sr, { f: 3200, q: 8, decay: 0.015, len: 0.07, tone: 0.9, toneF: 2800, seed: 42 }) },
});

/** يولّد صوتًا واحدًا: مطبَّع إلى قمة 0.9 ثم يُضرب في كسبه، مع خفوت نهائي يمنع الطقطقة. */
export function renderDrum(name, sr) {
  const d = DRUMS[name];
  if (!d) throw new Error(`صوت إيقاع غير معروف: ${name}`);
  const a = normalize(d.make(sr), 0.9 * d.gain);
  return fadeOut(a, sr);
}
