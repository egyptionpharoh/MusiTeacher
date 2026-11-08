// 📚 مكتبة الأعمال المولدة — تُحفظ في متصفح المعلم (IndexedDB) على هذا الجهاز فقط.
// (Vercel لا يملك قرصًا دائمًا؛ ولو أردنا مكتبة سحابية لاحقًا نستبدل هذا الملف وحده.)
const DB = 'musiteacher-music-factory', STORE = 'tracks', VER = 1;
let memory = []; // بديل إن كان IndexedDB غير متاح (تصفح خاص مثلًا)

function open() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('no idb')); return; }
    const r = indexedDB.open(DB, VER);
    r.onupgradeneeded = () => { const db = r.result; if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' }); };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
async function tx(mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const out = fn(t.objectStore(STORE));
    t.oncomplete = () => { db.close(); resolve(out && 'result' in out ? out.result : undefined); };
    t.onerror = () => { db.close(); reject(t.error); };
    t.onabort = () => { db.close(); reject(t.error || new Error('aborted')); };
  });
}

export async function listTracks() {
  try {
    const all = (await tx('readonly', (s) => s.getAll())) || [];
    return all.sort((a, b) => b.createdAt - a.createdAt);
  } catch { return [...memory].sort((a, b) => b.createdAt - a.createdAt); }
}

export async function saveTrack(track) {
  const t = { id: `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, createdAt: Date.now(), ...track };
  try { await tx('readwrite', (s) => s.put(t)); return { ok: true, track: t, persistent: true }; } catch (e) {
    memory.push(t);
    return { ok: true, track: t, persistent: false, error: e && e.name === 'QuotaExceededError' ? 'مساحة المتصفح ممتلئة' : null };
  }
}

export async function deleteTrack(id) {
  try { await tx('readwrite', (s) => s.delete(id)); } catch { /* ignore */ }
  memory = memory.filter((t) => t.id !== id);
}
