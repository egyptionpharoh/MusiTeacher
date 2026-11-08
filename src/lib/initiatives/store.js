// التخزين على جهاز المعلم + دمج المزامنة مع الحساب.
// البيانات النصية في localStorage، وصور التوثيق في IndexedDB (لا تُرفع للمزامنة)، وشعار المدرسة يبقى على الجهاز.
import { normalizeProject, normalizeInitiative } from './schema.js';

export const KEY = 'mt-initiatives:v1';
export const EMPTY = Object.freeze({ projects: [], favs: [], deleted: {}, aiIdeas: [], recent: [], sync: false, syncedAt: 0 });

export function loadLocal() {
  try {
    const v = JSON.parse(window.localStorage.getItem(KEY) || 'null');
    if (!v || typeof v !== 'object') return { ...EMPTY };
    return {
      projects: (Array.isArray(v.projects) ? v.projects : []).map(normalizeProject),
      favs: Array.isArray(v.favs) ? v.favs.filter((x) => typeof x === 'string').slice(0, 300) : [],
      deleted: v.deleted && typeof v.deleted === 'object' ? v.deleted : {},
      aiIdeas: (Array.isArray(v.aiIdeas) ? v.aiIdeas : []).map((i) => normalizeInitiative(i, 'ai')).filter(Boolean).slice(0, 40),
      recent: Array.isArray(v.recent) ? v.recent.slice(0, 20) : [],
      sync: !!v.sync, syncedAt: Number(v.syncedAt) || 0,
    };
  } catch { return { ...EMPTY }; }
}
export function saveLocal(state) {
  try { window.localStorage.setItem(KEY, JSON.stringify(state)); return true; } catch { return false; }
}

/** دمج نسختين (الجهاز والحساب): الأحدث لكل مبادرة، مع احترام المحذوفات، والإبقاء على الشعار المحلي. */
export function mergeData(local, remote) {
  if (!remote) return { projects: local.projects, favs: local.favs, deleted: local.deleted };
  const deleted = { ...(remote.deleted || {}) };
  for (const [k, v] of Object.entries(local.deleted || {})) deleted[k] = Math.max(deleted[k] || 0, v);
  const byId = new Map();
  for (const p of (remote.projects || []).map(normalizeProject)) byId.set(p.id, p);
  for (const p of local.projects) {
    const r = byId.get(p.id);
    if (!r || p.updatedAt >= r.updatedAt) byId.set(p.id, p);
    else byId.set(p.id, normalizeProject({ ...r, meta: { ...r.meta, logo: r.meta.logo || p.meta.logo } }));
  }
  const projects = [...byId.values()].filter((p) => !(deleted[p.id] && deleted[p.id] >= p.updatedAt)).sort((a, b) => b.updatedAt - a.updatedAt);
  const favs = [...new Set([...(local.favs || []), ...((remote.favs) || [])])].filter((id) => !(deleted[`fav:${id}`]));
  return { projects, favs, deleted };
}

// ------------------------------------------------------------------ صور التوثيق (IndexedDB)
const DB = 'mt-initiatives', STORE = 'photos';
function openDB() {
  return new Promise((res, rej) => {
    if (typeof indexedDB === 'undefined') { rej(new Error('no-idb')); return; }
    const q = indexedDB.open(DB, 1);
    q.onupgradeneeded = () => { q.result.createObjectStore(STORE); };
    q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error);
  });
}
async function tx(mode, fn) {
  const db = await openDB();
  return new Promise((res, rej) => { const t = db.transaction(STORE, mode); const s = t.objectStore(STORE); const out = fn(s); t.oncomplete = () => res(out && 'result' in out ? out.result : undefined); t.onerror = () => rej(t.error); });
}
export const photos = {
  put: (id, dataUrl) => tx('readwrite', (s) => s.put(dataUrl, id)),
  get: (id) => tx('readonly', (s) => s.get(id)),
  del: (id) => tx('readwrite', (s) => s.delete(id)),
};

/** تصغير صورة في المتصفح: PNG للشعار (يحفظ الشفافية) أو JPEG لصور التوثيق. */
export function shrinkImage(file, { max = 360, type = 'image/png', quality = 0.85 } = {}) {
  return new Promise((resolve, reject) => {
    if (!file || !/^image\/(png|jpeg|webp|gif)$/.test(file.type)) { reject(new Error('type')); return; }
    if (file.size > 12 * 1024 * 1024) { reject(new Error('size')); return; }
    const url = URL.createObjectURL(file); const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(img.naturalWidth * k)); c.height = Math.max(1, Math.round(img.naturalHeight * k));
      const g = c.getContext('2d'); if (type === 'image/jpeg') { g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); }
      g.drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
      resolve(c.toDataURL(type, quality));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('decode')); };
    img.src = url;
  });
}
