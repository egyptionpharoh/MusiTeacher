// 💾 الحفظ المحلي على جهاز المعلم (IndexedDB): الجداول والإعدادات والنغمات الخاصة.
// لا شيء يُرفع لأي خادم إلا إذا فعّل المعلم «المزامنة مع حسابي» بنفسه (والنغمات لا تُرفع أبدًا).
const DB = 'musiteacher-class-alarm', VER = 1;
const LS_KEY = 'mt-class-alarm:store';
const FIRED_KEY = 'mt-class-alarm:fired';
let mem = { kv: new Map(), tones: new Map() };

function open() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('no-idb')); return; }
    const r = indexedDB.open(DB, VER);
    r.onupgradeneeded = () => {
      const db = r.result;
      if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
      if (!db.objectStoreNames.contains('tones')) db.createObjectStore('tones', { keyPath: 'id' });
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.onblocked = () => reject(new Error('blocked'));
  });
}
async function tx(store, mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const req = fn(t.objectStore(store));
    t.oncomplete = () => { db.close(); resolve(req && 'result' in req ? req.result : undefined); };
    t.onerror = () => { db.close(); reject(t.error); };
    t.onabort = () => { db.close(); reject(t.error || new Error('aborted')); };
  });
}

export let persistent = true;

export async function loadStore() {
  try {
    const v = await tx('kv', 'readonly', (s) => s.get('store'));
    if (v) return v;
  } catch { persistent = false; }
  try { const raw = window.localStorage.getItem(LS_KEY); if (raw) return JSON.parse(raw); } catch { /* */ }
  return mem.kv.get('store') || null;
}

export async function saveStore(store) {
  const v = JSON.parse(JSON.stringify(store));
  try { await tx('kv', 'readwrite', (s) => s.put(v, 'store')); persistent = true; return true; } catch {
    try { window.localStorage.setItem(LS_KEY, JSON.stringify(v)); return true; } catch { mem.kv.set('store', v); persistent = false; return false; }
  }
}

export async function listTones() {
  try { return ((await tx('tones', 'readonly', (s) => s.getAll())) || []).sort((a, b) => a.createdAt - b.createdAt); } catch { return [...mem.tones.values()]; }
}
export async function saveTone(t) {
  try { await tx('tones', 'readwrite', (s) => s.put(t)); return true; } catch (e) {
    mem.tones.set(t.id, t);
    if (e && e.name === 'QuotaExceededError') throw new Error('مساحة التخزين في المتصفح ممتلئة.');
    return false;
  }
}
export async function deleteTone(id) {
  try { await tx('tones', 'readwrite', (s) => s.delete(id)); } catch { /* */ }
  mem.tones.delete(id);
}

export async function wipeAll() {
  try { await tx('kv', 'readwrite', (s) => s.clear()); await tx('tones', 'readwrite', (s) => s.clear()); } catch { /* */ }
  try { window.localStorage.removeItem(LS_KEY); window.localStorage.removeItem(FIRED_KEY); } catch { /* */ }
  mem = { kv: new Map(), tones: new Map() };
}

// سجل التنبيهات التي أُطلقت (لمنع التكرار بعد إعادة تحميل الصفحة) — localStorage لأنه متزامن وسريع
export function loadFired() {
  try { return JSON.parse(window.localStorage.getItem(FIRED_KEY) || '{}') || {}; } catch { return mem.kv.get('fired') || {}; }
}
export function saveFired(f) {
  try { window.localStorage.setItem(FIRED_KEY, JSON.stringify(f)); } catch { mem.kv.set('fired', f); }
}

export async function estimate() {
  try { if (navigator.storage && navigator.storage.estimate) return await navigator.storage.estimate(); } catch { /* */ }
  return null;
}
export async function requestPersist() {
  try { if (navigator.storage && navigator.storage.persist) return await navigator.storage.persist(); } catch { /* */ }
  return false;
}
