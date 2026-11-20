// =====================================================================
//  النطق العربي للشخصيات عبر Web Speech API في المتصفح نفسه (لا خدمة خارجية، ولا يُرسل أي نص من اللعبة).
//  • يختار أفضل صوت عربي متاح: الأصوات «الطبيعية» في Microsoft Edge أولًا، ثم أي صوت عربي.
//  • النص يظهر دائمًا ترجمةً على الشاشة؛ فإن لم يتوفر صوت عربي تعمل الشخصية بالترجمة وحدها ولا تتوقف اللعبة.
//  • يُقسَّم الكلام إلى جمل قصيرة (بعض المتصفحات تقطع الجمل الطويلة)، وتُبلَّغ الواجهة بكل جملة لتظليلها.
// =====================================================================
const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
let voice = null, ready = null;

function rank(v) {
  const n = (v.name || '').toLowerCase(), l = (v.lang || '').toLowerCase();
  let s = 0;
  if (l.startsWith('ar')) s += 100; else return -1;
  if (/natural|online|neural/.test(n)) s += 40;                   // أصوات Edge الطبيعية
  if (/ar-(om|sa|ae|eg|jo|qa|kw|bh)/.test(l)) s += 8;
  if (/google/.test(n)) s += 20;
  if (/salma|zariyah|hamed|shakir|fatima|aysha|hala|hoda|naayf|layla|maged/.test(n)) s += 5;
  return s;
}
export function initVoices() {
  if (!synth) return Promise.resolve(null);
  if (ready) return ready;
  ready = new Promise((res) => {
    const pick = () => { const vs = synth.getVoices(); if (!vs.length) return false; const best = vs.map((v) => [rank(v), v]).filter((x) => x[0] > 0).sort((a, b) => b[0] - a[0])[0]; voice = best ? best[1] : null; res(voice); return true; };
    if (!pick()) { synth.addEventListener('voiceschanged', pick, { once: true }); setTimeout(() => { if (!pick()) res(null); }, 2500); }
  });
  return ready;
}
export const speechInfo = () => ({ supported: !!synth, voice: voice ? `${voice.name} (${voice.lang})` : null });

let session = 0;
/**
 * ينطق قائمة جمل. opts: pitch · rate · onSentence(i) · onEnd(completed) · onWord()
 * يعيد دالة إيقاف.
 */
export function speak(sentences, opts = {}) {
  stop(); const my = ++session;
  const list = sentences.filter(Boolean);
  const done = (ok) => { if (my === session) { session++; opts.onEnd && opts.onEnd(ok); } };
  if (!synth || !voice) {
    // بلا صوت عربي: نعرض الجمل ترجمةً متتابعة بزمن قراءة تقديري حتى تبقى التجربة كاملة
    let i = 0; const next = () => { if (my !== session) return; if (i >= list.length) return done(true); opts.onSentence && opts.onSentence(i); const ms = 900 + list[i].length * 70; i++; setTimeout(next, ms); };
    next(); return stop;
  }
  let i = 0;
  const say = () => {
    if (my !== session) return; if (i >= list.length) return done(true);
    const u = new SpeechSynthesisUtterance(list[i]); u.voice = voice; u.lang = voice.lang; u.pitch = opts.pitch ?? 1.15; u.rate = opts.rate ?? 0.92; u.volume = 1;
    const idx = i; u.onstart = () => { if (my === session && opts.onSentence) opts.onSentence(idx); };
    u.onboundary = () => { if (my === session && opts.onWord) opts.onWord(); };
    u.onend = () => { i++; say(); };
    u.onerror = (e) => { if (e.error === 'interrupted' || e.error === 'canceled') return; i++; say(); };
    synth.speak(u);
  };
  say(); return stop;
}
export function stop() { session++; if (synth) synth.cancel(); }
export const isSpeaking = () => !!(synth && synth.speaking);
