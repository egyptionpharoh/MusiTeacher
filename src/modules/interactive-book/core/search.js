// البحث داخل نص الكتاب (من الملف نفسه). تطبيع عربي يتجاهل التشكيل والهمزات والتطويل،
// فيجد «مُوسيقى» عند البحث عن «موسيقي» مثلًا.

export function normalize(s) {
  return String(s || '').normalize('NFKC')
    .replace(/[ً-ٰٟۖ-ۭ]/g, '') // التشكيل
    .replace(/ـ/g, '') // التطويل
    .replace(/[إأآٱ]/g, 'ا') // إ أ آ ٱ ← ا
    .replace(/ى/g, 'ي') // ى ← ي
    .replace(/ة/g, 'ه') // ة ← ه
    .replace(/ؤ/g, 'و').replace(/ئ/g, 'ي') // ؤ ئ
    .replace(/[‌-‏‪-‮⁦-⁩]/g, '')
    .toLowerCase();
}

/** خريطة من موضع النص المطبَّع إلى موضعه في النص الأصلي (لاقتطاف جملة السياق بالحروف الأصلية) */
function normWithMap(s) {
  let out = ''; const map = [];
  for (let i = 0; i < s.length; i++) {
    const n = normalize(s[i]);
    for (let k = 0; k < n.length; k++) { out += n[k]; map.push(i); }
  }
  return { out, map };
}

/**
 * يعيد [{ page, count, snippet: { before, match, after } }] — صفحة لكل نتيجة (أول موضع فيها).
 */
export function searchTexts(texts, query, { limit = 200 } = {}) {
  const q = normalize(query).replace(/\s+/g, ' ').trim();
  if (q.length < 2) return [];
  const results = [];
  for (let i = 0; i < texts.length && results.length < limit; i++) {
    const raw = (texts[i] || '').replace(/\s+/g, ' ');
    const { out, map } = normWithMap(raw);
    let at = out.indexOf(q);
    if (at < 0) continue;
    let count = 0; let pos = at;
    while (pos >= 0) { count++; pos = out.indexOf(q, pos + q.length); }
    const s0 = map[at], s1 = map[Math.min(map.length - 1, at + q.length - 1)] + 1;
    results.push({
      page: i + 1, count,
      snippet: { before: raw.slice(Math.max(0, s0 - 40), s0), match: raw.slice(s0, s1), after: raw.slice(s1, s1 + 50) },
    });
  }
  return results;
}
