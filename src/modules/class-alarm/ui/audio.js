// 🔔 محرك الصوت (Web Audio API): نغمات افتراضية مُركَّبة برمجيًا (أصلية بالكامل، بلا تسجيلات محمية)
// + تشغيل نغمات المعلم الخاصة المحفوظة في جهازه.
// ملاحظة مهمة: المتصفحات تمنع تشغيل الصوت قبل أول تفاعل للمستخدم مع الصفحة (نقرة/لمسة).
// لذلك «نُجهّز» الصوت عند أول نقرة، وتعرض الواجهة تنبيهًا واضحًا إن لم يكن الصوت جاهزًا.

export const TONES = [
  { id: 'chime', name: 'نغمة هادئة', desc: 'أجراس ناعمة متصاعدة' },
  { id: 'bell', name: 'جرس مدرسي', desc: 'رنين جرس كهربائي قصير' },
  { id: 'clear', name: 'تنبيه واضح', desc: 'نبضات حادة يصعب تجاهلها' },
  { id: 'melody', name: 'نغمة موسيقية قصيرة', desc: 'جملة لحنية على مقام الحجاز' },
  { id: 'classic', name: 'نغمة كلاسيكية', desc: 'قفلة هارمونية بصوت الأورغن' },
  { id: 'start', name: 'بداية الحصة', desc: 'فانفار نحاسي قصير' },
  { id: 'soft', name: 'تنبيه لطيف', desc: 'نغمتان هابطتان هادئتان' },
  { id: 'marimba', name: 'ماريمبا', desc: 'نقرات خشبية مرحة' },
];
export const CUSTOM_PREFIX = 'custom:';
export const MAX_TONE_BYTES = 2 * 1024 * 1024;
export const MAX_TONE_SECONDS = 30;
export const TONE_ACCEPT = 'audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/ogg,audio/webm,audio/mp4,audio/x-m4a,audio/aac,.mp3,.wav,.ogg,.m4a,.aac,.webm';

let ctx = null;
const decoded = new Map();
const playing = new Set();
let customResolver = async () => null;
export function setCustomResolver(fn) { customResolver = fn; }

function getCtx() {
  if (ctx) return ctx;
  const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
  if (!AC) return null;
  ctx = new AC({ latencyHint: 'interactive' });
  return ctx;
}
export function audioState() { return ctx ? ctx.state : 'none'; }

/** يُستدعى من داخل حدث نقرة/لمسة لفك قيد الصوت */
export async function unlockAudio() {
  const c = getCtx();
  if (!c) return false;
  try {
    if (c.state !== 'running') await c.resume();
    const b = c.createBuffer(1, 1, 22050); const s = c.createBufferSource(); s.buffer = b; s.connect(c.destination); s.start(0);
  } catch { /* */ }
  return c.state === 'running';
}

// ---------- أدوات التركيب ----------
const hz = (midi) => 440 * 2 ** ((midi - 69) / 12);
function voice(c, out, { f, t, d = 1, type = 'sine', a = 0.005, peak = 0.5, partials = [[1, 1]], detune = 0, lp }) {
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  let node = g;
  if (lp) { const fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = lp; g.connect(fl); node = fl; }
  node.connect(out);
  for (const [mult, amp] of partials) {
    const o = c.createOscillator(); o.type = type; o.frequency.value = f * mult; o.detune.value = detune;
    const pg = c.createGain(); pg.gain.value = amp; o.connect(pg); pg.connect(g);
    o.start(t); o.stop(t + d + 0.05);
  }
  return t + d;
}
const BELLISH = [[1, 1], [2.76, 0.35], [5.4, 0.18], [8.93, 0.08]];

const SYNTH = {
  chime(c, out, t) { [76, 79, 83, 88].forEach((n, i) => voice(c, out, { f: hz(n), t: t + i * 0.22, d: 1.8, peak: 0.32, partials: BELLISH })); return 2.6; },
  bell(c, out, t) {
    // جرس كهربائي: مطرقة تضرب بسرعة (نبضات 18/ث) على صوت معدني
    const dur = 1.8;
    const g = c.createGain(); g.gain.value = 0.26; g.connect(out);
    const trem = c.createOscillator(); trem.type = 'square'; trem.frequency.value = 18;
    const tg = c.createGain(); tg.gain.value = 0.24; trem.connect(tg); tg.connect(g.gain);
    const env = c.createGain(); env.gain.setValueAtTime(0.0001, t); env.gain.exponentialRampToValueAtTime(0.9, t + 0.02); env.gain.setValueAtTime(0.9, t + dur - 0.15); env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    env.connect(g);
    for (const [m, a] of [[1, 0.5], [2.4, 0.25], [3.9, 0.12], [5.3, 0.06]]) { const o = c.createOscillator(); o.frequency.value = 1180 * m / 1.6; const pg = c.createGain(); pg.gain.value = a; o.connect(pg); pg.connect(env); o.start(t); o.stop(t + dur + 0.05); }
    trem.start(t); trem.stop(t + dur + 0.05);
    return dur + 0.2;
  },
  clear(c, out, t) { for (let k = 0; k < 3; k++) for (let j = 0; j < 2; j++) voice(c, out, { f: 1046.5, t: t + k * 0.55 + j * 0.16, d: 0.12, type: 'square', peak: 0.16, lp: 3200 }); return 1.7; },
  melody(c, out, t) {
    // دو – ري بيمول – مي – فا – صول – فا – مي (حجاز على دو)، نقر وتري
    const seq = [[60, 0.2], [61, 0.2], [64, 0.2], [65, 0.2], [67, 0.45], [65, 0.2], [64, 0.6]];
    let x = t; for (const [n, l] of seq) { voice(c, out, { f: hz(n + 12), t: x, d: l + 0.5, type: 'triangle', peak: 0.38, partials: [[1, 1], [2, 0.3], [3, 0.12]] }); x += l; }
    return x - t + 0.6;
  },
  classic(c, out, t) {
    const chords = [[60, 64, 67], [60, 65, 69], [59, 62, 67], [60, 64, 72]];
    chords.forEach((ch, i) => ch.forEach((n) => voice(c, out, { f: hz(n), t: t + i * 0.55, d: i === 3 ? 1.6 : 0.6, a: 0.04, peak: 0.13, partials: [[1, 1], [2, 0.5], [4, 0.25], [8, 0.1]] })));
    return 3.4;
  },
  start(c, out, t) {
    [[60, 0, 0.16], [64, 0.16, 0.16], [67, 0.32, 0.16], [72, 0.48, 0.8]].forEach(([n, s, l]) => { voice(c, out, { f: hz(n), t: t + s, d: l + 0.15, type: 'sawtooth', a: 0.03, peak: 0.2, lp: 2400 }); voice(c, out, { f: hz(n), t: t + s, d: l + 0.15, type: 'sawtooth', a: 0.03, peak: 0.12, detune: 9, lp: 2400 }); });
    return 1.6;
  },
  soft(c, out, t) { voice(c, out, { f: hz(79), t, d: 1.1, peak: 0.35, partials: BELLISH }); voice(c, out, { f: hz(74), t: t + 0.45, d: 1.5, peak: 0.35, partials: BELLISH }); return 2.1; },
  marimba(c, out, t) { [72, 76, 79, 76, 84].forEach((n, i) => voice(c, out, { f: hz(n), t: t + i * 0.14, d: 0.45, peak: 0.45, partials: [[1, 1], [4, 0.25], [10, 0.05]] })); return 1.3; },
};

/** يشغّل نغمة ويعيد { ok, duration, stop } */
export async function playTone(toneId, volume = 0.8) {
  const c = getCtx();
  if (!c) return { ok: false, reason: 'unsupported' };
  if (c.state !== 'running') { try { await c.resume(); } catch { /* */ } }
  if (c.state !== 'running') return { ok: false, reason: 'locked' };
  const master = c.createGain();
  master.gain.value = Math.max(0, Math.min(1, volume));
  master.connect(c.destination);
  const t = c.currentTime + 0.03;
  let duration = 0, src = null;
  if (String(toneId).startsWith(CUSTOM_PREFIX)) {
    const buf = await customBuffer(toneId.slice(CUSTOM_PREFIX.length));
    if (buf) { src = c.createBufferSource(); src.buffer = buf; src.connect(master); src.start(t); duration = Math.min(buf.duration, MAX_TONE_SECONDS); src.stop(t + duration); }
    else duration = SYNTH.chime(c, master, t);
  } else duration = (SYNTH[toneId] || SYNTH.chime)(c, master, t);
  const h = { master, src };
  playing.add(h);
  const stop = () => {
    if (!playing.has(h)) return;
    playing.delete(h);
    try { master.gain.cancelScheduledValues(c.currentTime); master.gain.setTargetAtTime(0, c.currentTime, 0.03); } catch { /* */ }
    setTimeout(() => { try { if (src) src.stop(); master.disconnect(); } catch { /* */ } }, 200);
  };
  setTimeout(() => playing.delete(h), (duration + 0.5) * 1000);
  return { ok: true, duration, stop };
}
export function stopAll() { for (const h of [...playing]) { try { h.master.gain.value = 0; if (h.src) h.src.stop(); h.master.disconnect(); } catch { /* */ } playing.delete(h); } }

async function customBuffer(id) {
  if (decoded.has(id)) return decoded.get(id);
  const rec = await customResolver(id);
  if (!rec || !rec.blob) return null;
  try { const buf = await getCtx().decodeAudioData(await rec.blob.arrayBuffer()); decoded.set(id, buf); return buf; } catch { return null; }
}
export function forgetCustom(id) { decoded.delete(id); }

/** فحص ملف صوتي يرفعه المعلم: النوع والحجم وإمكانية التشغيل والمدة */
export async function inspectToneFile(file) {
  if (!file) throw new Error('لم يتم اختيار ملف.');
  if (file.size > MAX_TONE_BYTES) throw new Error(`حجم الملف ${(file.size / 1048576).toFixed(1)} ميجابايت، والحد الأقصى 2 ميجابايت. اختر مقطعًا أقصر.`);
  if (!/^audio\//.test(file.type) && !/\.(mp3|wav|ogg|m4a|aac|webm)$/i.test(file.name)) throw new Error('صيغة غير مدعومة. استخدم MP3 أو WAV أو OGG أو M4A.');
  const c = getCtx();
  if (!c) throw new Error('المتصفح لا يدعم تشغيل الصوت.');
  let buf;
  try { buf = await c.decodeAudioData(await file.arrayBuffer()); } catch { throw new Error('تعذر قراءة الملف الصوتي في هذا المتصفح. جرّب تحويله إلى MP3.'); }
  return { duration: buf.duration, trimmed: buf.duration > MAX_TONE_SECONDS };
}
