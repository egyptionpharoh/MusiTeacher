// مخازن في الذاكرة بنفس واجهة adapters/suggestedStore.js — للاختبارات فقط (لا تُستخدم في المنصة)
export function makeMemoryStores() {
  const s = new Map(), p = new Map();
  const strip = ({ data, ...rest }) => rest; // eslint-disable-line no-unused-vars
  return {
    suggested: {
      async list() { return [...s.values()].map(strip).sort((a, b) => (a.grade || 0) - (b.grade || 0) || String(a.semester || '').localeCompare(String(b.semester || '')) || (b.updatedAt || 0) - (a.updatedAt || 0)); },
      async get(id) { return s.get(id) || null; },
      async put(doc) { s.set(doc._id, { ...(s.get(doc._id) || {}), ...doc }); },
      async patch(id, set) { if (!s.has(id)) return false; s.set(id, { ...s.get(id), ...set }); return true; },
      async remove(id) { return s.delete(id); },
    },
    prefs: { async get(uid) { return p.get(uid) || null; }, async put(uid, grades, updatedAt) { p.set(uid, { _id: uid, grades, updatedAt }); } },
  };
}
