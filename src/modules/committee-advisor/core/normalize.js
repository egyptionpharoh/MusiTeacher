// تطبيع النص العربي وتقطيعه للبحث المحلي — بلا أي خدمة خارجية.
const DIACRITICS = /[ؐ-ًؚ-ٰٟۖ-ۭـ]/g;
const PUNCT = /[^\p{L}\p{N}\s]/gu;

export function normalizeArabic(s) {
  return String(s || '')
    .replace(DIACRITICS, '')
    .replace(/[إأآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي').replace(/ء/g, '')
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .toLowerCase()
    .replace(PUNCT, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// كلمات شائعة لا تميّز سؤالًا عن آخر
export const STOPWORDS = new Set([
  'ما', 'ماذا', 'من', 'هل', 'كيف', 'متي', 'لماذا', 'اين', 'في', 'فى', 'علي', 'الي', 'عن', 'مع', 'او', 'ثم', 'اذا', 'لو', 'ان', 'انا', 'انت', 'هو', 'هي',
  'هذا', 'هذه', 'ذلك', 'تلك', 'التي', 'الذي', 'الذين', 'كان', 'يكون', 'تكون', 'اي', 'كل', 'لي', 'لدي', 'عندي', 'يجب', 'ممكن', 'يمكن', 'يمكنني', 'استطيع',
  'افعل', 'اعمل', 'يفعل', 'نفعل', 'اتصرف', 'لا', 'لم', 'لن', 'قد', 'ف', 'و', 'ب', 'ل', 'يا', 'الا', 'به', 'بها', 'له', 'لها', 'منه', 'فيه', 'عليه', 'هناك',
  'شي', 'شيء', 'اريد', 'ابغي', 'ابي', 'عايز', 'لو سمحت', 'سمحت', 'من فضلك', 'فضلك', 'الرجاء', 'اذن', 'بعض', 'غير', 'مثل', 'جدا', 'حتي', 'كما', 'نحن', 'هم',
  'تم', 'يتم', 'عند', 'عندما', 'اني', 'انني', 'انه', 'لان', 'او', 'ام', 'هنا', 'الان', 'اليوم', 'وش', 'ايش', 'شو', 'وين', 'ليش', 'كيفيه', 'المعلم', 'معلم',
  // عامية شائعة
  'ايه', 'امتي', 'ازاي', 'مين', 'ليه', 'فين', 'عاوز', 'عايزه', 'بتاع', 'دلوقتي', 'كده', 'معاه', 'معايا', 'معاها', 'بس', 'طيب', 'يعني', 'اعمل', 'اسوي', 'وايد',
  'كم', 'يجوز', 'يحق', 'يلزم', 'ينبغي', 'يسمح', 'مسموح', 'ايضا', 'كذلك',
  'مش', 'ومش', 'هقدر', 'اقدر', 'مقدرش', 'هعمل', 'حاجه', 'لازم', 'ينفع', 'مينفعش', 'عشان', 'علشان', 'اللي', 'دي', 'ده', 'دا',
]);

const PREFIXES = ['وال', 'بال', 'كال', 'فال', 'لل', 'ال'];
const SUFFIXES = ['اتها', 'اتهم', 'يات', 'ات', 'ون', 'ين', 'ان', 'ها', 'هم', 'هن', 'كم', 'نا', 'ه', 'ي'];

/** جذع خفيف: نزع «ال» وحروف العطف/الجر الملتصقة بها، ثم لاحقة واحدة — يكفي للمطابقة دون تشويه الكلمات القصيرة */
export function stem(w) {
  let t = w;
  for (const p of PREFIXES) { if (t.startsWith(p) && t.length - p.length >= 2) { t = t.slice(p.length); break; } }
  if (t.length >= 5 && /^[وف]/.test(t)) t = t.slice(1);
  for (const s of SUFFIXES) { if (t.endsWith(s) && t.length - s.length >= 3) { t = t.slice(0, -s.length); break; } }
  return t;
}

/** يبني قاموس المرادفات: العبارات المتعددة الكلمات تُستبدل أولًا، ثم الكلمات المفردة تُوحَّد إلى جذع رأس المجموعة */
export function buildSynonyms(groups) {
  const phrases = []; const words = new Map();
  for (const g of groups) {
    const headNorm = normalizeArabic(g[0]);
    const head = headNorm.includes(' ') ? headNorm.replace(/\s+/g, '_') : stem(headNorm);
    for (const raw of g) {
      const n = normalizeArabic(raw);
      if (!n) continue;
      if (n.includes(' ')) phrases.push([n, head]);
      else words.set(stem(n), head);
    }
  }
  phrases.sort((a, b) => b[0].length - a[0].length);
  return { phrases, words };
}

/** صيغ بديلة للكلمة العامية: «بيغش» ← «يغش»، «بيطلبوا» ← «يطلب» — تُستخدم فقط إن عرفها القاموس */
function variants(raw) {
  const out = [];
  let w = raw;
  if (/^ب[يتن]/.test(w) && w.length >= 4) { w = w.slice(1); out.push(stem(w)); }
  if (w.endsWith('وا') && w.length >= 5) out.push(stem(w.slice(0, -2)));
  if (/^[يتن]/.test(w) && w.length >= 4) out.push(stem(w.slice(1)));
  if (/^[كبلفو]/.test(raw) && raw.length >= 4) out.push(stem(raw.slice(1))); // «كمراقب» ← «مراقب»
  return out;
}

/** نص ← رموز البحث (بعد التطبيع وحذف الكلمات الشائعة والجذع والمرادفات)
 *  vocab (اختياري): مفردات قاعدة المعرفة، لتجربة الصيغ العامية البديلة */
export function tokenize(text, syn, vocab) {
  let s = ` ${normalizeArabic(text)} `;
  if (syn) for (const [p, head] of syn.phrases) for (const pre of ['', 'ال', 'و', 'ف', 'ب', 'ل', 'ول', 'وال']) s = s.split(` ${pre}${p} `).join(` ${head} `);
  const out = [];
  for (const raw of s.trim().split(' ')) {
    if (!raw || STOPWORDS.has(raw)) continue;
    if (raw.includes('_')) { out.push(raw); continue; }
    const st = stem(raw);
    if (!st || STOPWORDS.has(st) || (st.length < 2 && !/\d/.test(st))) continue;
    const known = (t) => (syn && syn.words.has(t)) || (vocab && vocab.has(t));
    let pick = st;
    if (!known(st)) { const alt = variants(raw).find(known); if (alt) pick = alt; }
    if (STOPWORDS.has(pick)) continue;
    out.push(syn && syn.words.has(pick) ? syn.words.get(pick) : pick);
  }
  return out;
}
