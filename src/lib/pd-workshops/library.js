// البحث والتصفية والاقتراح العشوائي داخل مكتبة الأفكار.
import { IDEAS } from './ideas.js';
import { normalizeIdea, normTitle } from './schema.js';
import { DOMAIN, SPECS, AUDIENCES, FORMATS, label, bandOf } from './taxonomy.js';

let cache = null;
/** المكتبة مطبّعة مرة واحدة. */
export function libraryIdeas() {
  if (!cache) cache = IDEAS.map((i) => normalizeIdea(i, 'library')).filter(Boolean);
  return cache;
}

export const EMPTY_FILTERS = Object.freeze({ q: '', domain: '', spec: '', audience: '', band: '', format: '', level: '' });

function haystack(i) {
  return normTitle([
    i.title, i.tag, i.summary, i.goal, (DOMAIN[i.domain] || {}).label,
    ...i.strategies, ...i.axes.map((a) => a.t), label(FORMATS, i.format),
    ...i.specs.map((x) => label(SPECS, x)), ...i.audience.map((x) => label(AUDIENCES, x)),
  ].join(' '));
}

/** تصفية: كل الفلاتر اختيارية. "جميع التخصصات/جميع المعلمين" تطابق أي اختيار. */
export function filterIdeas(ideas, f = {}) {
  const words = normTitle(f.q || '').split(' ').filter(Boolean);
  return ideas.filter((i) => {
    if (f.domain && i.domain !== f.domain) return false;
    if (f.spec && f.spec !== 'all' && !i.specs.includes(f.spec) && !i.specs.includes('all')) return false;
    if (f.audience && f.audience !== 'all' && !i.audience.includes(f.audience) && !i.audience.includes('all')) return false;
    if (f.band && bandOf(i.duration).id !== f.band) return false;
    if (f.format && i.format !== f.format) return false;
    if (f.level && i.level !== f.level) return false;
    if (words.length) { const h = haystack(i); if (!words.every((w) => h.includes(w))) return false; }
    return true;
  });
}

/** ترتيب: المميزة أولًا ثم ما يطابق التخصص المختار نصيًا. */
export function sortIdeas(ideas, f = {}) {
  const score = (i) => (i.featured ? 2 : 0) + (f.spec && f.spec !== 'all' && i.specs.includes(f.spec) ? 3 : 0);
  return [...ideas].sort((a, b) => score(b) - score(a));
}

/** فكرة عشوائية لم تُعرض مؤخرًا (rand قابل للحقن للاختبار). */
export function randomIdea(ideas, recent = [], rand = Math.random) {
  if (!ideas.length) return null;
  const fresh = ideas.filter((i) => !recent.includes(i.id));
  const pool = fresh.length ? fresh : ideas;
  return pool[Math.floor(rand() * pool.length) % pool.length];
}

export function facetCounts(ideas) {
  const c = {};
  for (const i of ideas) c[i.domain] = (c[i.domain] || 0) + 1;
  return c;
}
