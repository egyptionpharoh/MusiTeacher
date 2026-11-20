// =====================================================================
//  تقطيع الأسماء العربية إلى مقاطع صوتية، ثم ربطها بتمثيل إيقاعي.
//  ثلاث طبقات منفصلة عمدًا:
//   1) التقطيع الصوتي: مقاطع الاسم كما يُنطق موقوفًا عليه (قاموس لأسماء شائعة مُشكَّلة، وتقدير آلي لغيرها).
//   2) طول المقطع: خفيف (صامت + حركة قصيرة) أو ثقيل (حركة طويلة أو منتهٍ بساكن). ليس هذا عروضًا شعريًا.
//   3) التمثيل الإيقاعي: اختيار تعليمي يقرره المعلم (نبضة لكل مقطع، أو قصير/طويل، أو يدوي).
//  الأسماء تُعالَج داخل المتصفح فقط ولا تُرسل إلى أي خدمة.
// =====================================================================
import { TPB, FIG } from './figures.js';

// المقاطع مكتوبة بالتشكيل وبينها «|». (h = ثقيل · l = خفيف) يُستنتج آليًا من الشكل.
const DICT = `محمد=مُ|حَمْ|مَد
أحمد=أَحْ|مَد
محمود=مَحْ|مُود
مصطفى=مُصْ|طَ|فَى
علي=عَ|لِي
عمر=عُ|مَر
عثمان=عُثْ|مَان
خالد=خَا|لِد
سالم=سَا|لِم
سعيد=سَ|عِيد
سعود=سُ|عُود
عبدالله=عَبْ|دُلْ|لَاه
عبدالرحمن=عَبْ|دُرْ|رَحْ|مَان
عبدالعزيز=عَبْ|دُلْ|عَ|زِيز
عبدالرحيم=عَبْ|دُرْ|رَ|حِيم
عبدالكريم=عَبْ|دُلْ|كَ|رِيم
عبدالملك=عَبْ|دُلْ|مَ|لِك
حمد=حَ|مَد
حمود=حَمْ|مُود
حامد=حَا|مِد
راشد=رَا|شِد
ناصر=نَا|صِر
منصور=مَنْ|صُور
سيف=سَيْف
سلطان=سُلْ|طَان
سليمان=سُ|لَيْ|مَان
سليم=سَ|لِيم
يوسف=يُو|سُف
يونس=يُو|نُس
يعقوب=يَعْ|قُوب
يحيى=يَحْ|يَى
إبراهيم=إِبْ|رَا|هِيم
إسماعيل=إِسْ|مَا|عِيل
إسحاق=إِسْ|حَاق
زكريا=زَ|كَ|رِيْ|يَا
موسى=مُو|سَى
عيسى=عِي|سَى
هارون=هَا|رُون
خليفة=خَ|لِي|فَه
خلفان=خَلْ|فَان
مازن=مَا|زِن
مالك=مَا|لِك
ماجد=مَا|جِد
مهند=مُ|هَنْ|نَد
هيثم=هَيْ|ثَم
قيس=قَيْس
زايد=زَا|يِد
طلال=طَ|لَال
بدر=بَدْر
فهد=فَهْد
فيصل=فَيْ|صَل
فارس=فَا|رِس
وليد=وَ|لِيد
ياسر=يَا|سِر
أنس=أَ|نَس
أيمن=أَيْ|مَن
أسامة=أُ|سَا|مَه
حسن=حَ|سَن
حسين=حُ|سَيْن
حمزة=حَمْ|زَه
صالح=صَا|لِح
هلال=هِ|لَال
عزان=عَزْ|زَان
مرشد=مُرْ|شِد
سعد=سَعْد
نبيل=نَ|بِيل
جمال=جَ|مَال
كريم=كَ|رِيم
عادل=عَا|دِل
عامر=عَا|مِر
بلال=بِ|لَال
زياد=زِ|يَاد
رائد=رَا|ئِد
تميم=تَ|مِيم
معاذ=مُ|عَاذ
مؤمن=مُؤْ|مِن
أمجد=أَمْ|جَد
أنور=أَنْ|وَر
مروان=مَرْ|وَان
عمار=عَمْ|مَار
نور=نُور
فاطمة=فَا|طِ|مَه
مريم=مَرْ|يَم
عائشة=عَا|ئِ|شَه
خديجة=خَ|دِي|جَه
زينب=زَيْ|نَب
سارة=سَا|رَه
ريم=رِيم
هند=هِنْد
ليلى=لَيْ|لَى
منى=مُ|نَى
آمنة=آ|مِ|نَه
جميلة=جَ|مِي|لَه
شيماء=شَيْ|مَاء
بشرى=بُشْ|رَى
أمل=أَ|مَل
هدى=هُ|دَى
سلمى=سَلْ|مَى
شهد=شَهْد
رهف=رَ|هَف
جنى=جَ|نَى
لمى=لَ|مَى
دانة=دَا|نَه
غالية=غَا|لِ|يَه
موزة=مَوْ|زَه
عزة=عَزْ|زَه
نورة=نُو|رَه
ميثاء=مَيْ|ثَاء
بثينة=بُ|ثَيْ|نَه
أسماء=أَسْ|مَاء
رقية=رُ|قَيْ|يَه
حلا=حَ|لَا
ملاك=مَ|لَاك`;

export const norm = (s) => String(s || '').replace(/[ً-ْٰـ]/g, '').replace(/[أإآٱ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/\s+/g, '').trim();
const DICTMAP = new Map(DICT.split('\n').map((l) => { const [k, v] = l.split('='); return [norm(k), { name: k, syl: v.split('|') }]; }));
export const dictionarySize = DICTMAP.size;

const LONG = new Set(['ا', 'و', 'ي', 'ى', 'آ']);
/** خفيف أم ثقيل من المقطع المشكَّل أو غير المشكَّل */
export function weightOf(syl, isLast) {
  const bare = syl.replace(/[ً-ْٰ]/g, '');
  if (bare.length >= 2 || bare === 'آ') return 'h';                         // حركة طويلة أو ساكن في آخره
  if (isLast) return 'h';                                   // الوقف على آخر الاسم يُسكّنه
  return 'l';
}

/** تقدير آلي لاسم غير موجود في القاموس (يُعرض على أنه تقديري قابل للتعديل) */
function guess(raw) {
  const ch = [...raw.replace(/[\u064B-\u0652\u0670\u0640\s]/g, '')], n = ch.length, out = [];
  const isLong = (k) => {
    if (k <= 0 || k >= n) return false;
    if (ch[k] === 'ا' || ch[k] === 'ى' || ch[k] === 'آ') return true;
    if (ch[k] === 'و' || ch[k] === 'ي') return !LONG.has(ch[k - 1]) && !(k + 1 < n && LONG.has(ch[k + 1]));
    return false;
  };
  let i = 0;
  while (i < n) {
    let syl = ch[i], j = i + 1, long = false;
    if (isLong(j)) { syl += ch[j]; j++; long = true; }
    if (j < n && ch[j] !== 'ة') {
      if (j === n - 1) { syl += ch[j]; j++; }                                           // الساكن الأخير (الوقف)
      else if (!long && !isLong(j + 1) && ch[j + 1] !== 'ة') { syl += ch[j]; j++; }   // ساكنان متتاليان: يُغلق المقطع
    }
    if (j === n - 1 && ch[j] === 'ة') { syl += ch[j]; j++; }
    out.push(syl); i = j;
  }
  return out;
}

/** يحلل اسمًا: {name, syllables:[{text, w}], source:'dict'|'guess'} */
export function analyse(name) {
  const key = norm(name); const d = DICTMAP.get(key);
  const syl = d ? d.syl : guess(name);
  return { name: name.trim(), source: d ? 'dict' : 'guess', syllables: syl.map((t, i) => ({ text: t, w: weightOf(t, i === syl.length - 1) })) };
}

/** يقسم/يدمج المقاطع يدويًا: يعيد قائمة جديدة */
export function splitAt(sylls, i, pos) {
  const s = sylls[i]; const chars = [...s.text]; if (pos <= 0 || pos >= chars.length) return sylls;
  const a = chars.slice(0, pos).join(''), b = chars.slice(pos).join('');
  const out = [...sylls]; out.splice(i, 1, { text: a, w: weightOf(a, false) }, { text: b, w: weightOf(b, i === sylls.length - 1) }); return out;
}
export function mergeWithNext(sylls, i) {
  if (i >= sylls.length - 1) return sylls; const out = [...sylls]; const t = out[i].text + out[i + 1].text;
  out.splice(i, 2, { text: t, w: weightOf(t, i + 1 === sylls.length - 1) }); return out;
}

/**
 * التمثيل الإيقاعي.
 * mode: 'beat' نبضة لكل مقطع (نوار) · 'length' الخفيف كروش والثقيل نوار · 'custom' اختيار المعلم (sylls[i].fig)
 * يعيد {perSyl:[figId], seq:[figIds مع تجميع الكروشين في «تاتي» داخل النبضة], filled:bool}
 */
export function rhythmFor(sylls, mode) {
  const perSyl = sylls.map((s) => (mode === 'custom' && s.fig ? s.fig : mode === 'length' ? (s.w === 'l' ? 'e' : 'q') : 'q'));
  const seq = []; let t = 0;
  for (let i = 0; i < perSyl.length; i++) {
    const id = perSyl[i];
    if (id === 'e' && perSyl[i + 1] === 'e' && t % TPB === 0) { seq.push('ee'); t += 12; i++; continue; }
    seq.push(id); t += FIG[id].ticks;
  }
  let filled = false;
  if (t % TPB) { const need = TPB - (t % TPB); if (need === 9) seq.push('rs', 're'); else seq.push(need === 3 ? 'rs' : 're'); filled = true; }
  return { perSyl, seq, filled };
}
