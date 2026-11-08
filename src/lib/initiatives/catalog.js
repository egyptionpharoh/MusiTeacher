// البحث والتصفية والاختيار العشوائي في مكتبة المبادرات.
import { INITIATIVES } from './library.js';
import { normalizeInitiative, normTitle } from './schema.js';
import { DOMAIN, LEADS, COSTS, label, durationOf } from './taxonomy.js';

let cache = null;
export function libraryInitiatives() {
  if (!cache) cache = INITIATIVES.map((i) => normalizeInitiative(i, 'library')).filter(Boolean);
  return cache;
}
export const EMPTY_FILTERS = Object.freeze({ q: '', domain: '', lead: '', cost: '', size: '', stage: '', duration: '' });

function haystack(i) {
  return normTitle([i.title, i.slogan, i.summary, i.problem, i.topic, (DOMAIN[i.domain] || {}).label, label(LEADS, i.lead), label(COSTS, i.cost), i.audience].join(' '));
}
/** «الكل» = بلا فلتر مجال. */
export function filterInitiatives(list, f = {}) {
  const words = normTitle(f.q || '').split(' ').filter(Boolean);
  return list.filter((i) => {
    if (f.domain && i.domain !== f.domain) return false;
    if (f.lead && i.lead !== f.lead) return false;
    if (f.cost && i.cost !== f.cost) return false;
    if (f.size && i.size !== f.size) return false;
    if (f.stage && !i.stages.includes(f.stage)) return false;
    if (f.duration && durationOf(i.weeks).id !== f.duration) return false;
    if (words.length) { const h = haystack(i); if (!words.every((w) => h.includes(w))) return false; }
    return true;
  });
}
export function countsBy(list, key) { const c = {}; for (const i of list) c[i[key]] = (c[i[key]] || 0) + 1; return c; }
export function randomInitiative(list, recent = [], rand = Math.random) {
  if (!list.length) return null;
  const fresh = list.filter((i) => !recent.includes(i.id)); const pool = fresh.length ? fresh : list;
  return pool[Math.floor(rand() * pool.length) % pool.length];
}
