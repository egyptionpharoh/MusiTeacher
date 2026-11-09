// 💾 حفظ «الخطط الفصلية» على جهاز المعلم (IndexedDB) — قاعدة مستقلة لكل حساب: musiteacher-lesson-plans:<uid>
// المحتوى: الخطط (بنسخها السابقة) + التوزيع + سجل التنفيذ. الملف الأصلي المرفوع لا يُحفظ إطلاقًا؛ فقط البيانات المستخرجة التي اعتمدها المعلم.
const BASE = 'musiteacher-lesson-plans', VER = 1;
export const PLANS_CHANNEL = 'musiteacher-lesson-plans';
const nameFor = (uid) => (uid ? `${BASE}:${uid}` : BASE);
let mem = new Map();

function open(name) {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('no-idb')); return; }
    const r = indexedDB.open(name, VER);
    r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains('kv')) r.result.createObjectStore('kv'); };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.onblocked = () => reject(new Error('blocked'));
  });
}
async function tx(name, mode, fn) {
  const db = await open(name);
  return new Promise((resolve, reject) => {
    const t = db.transaction('kv', mode);
    const req = fn(t.objectStore('kv'));
    t.oncomplete = () => { db.close(); resolve(req && 'result' in req ? req.result : undefined); };
    t.onerror = () => { db.close(); reject(t.error); };
  });
}

export async function loadWorkspace(uid) {
  try { return (await tx(nameFor(uid), 'readonly', (s) => s.get('ws'))) || null; } catch { return mem.get(nameFor(uid)) || null; }
}
export async function saveWorkspace(uid, ws) {
  const v = JSON.parse(JSON.stringify(ws));
  try { await tx(nameFor(uid), 'readwrite', (s) => s.put(v, 'ws')); return true; } catch { mem.set(nameFor(uid), v); return false; }
}
export async function wipeWorkspace(uid) {
  try { await tx(nameFor(uid), 'readwrite', (s) => s.clear()); } catch { /* */ }
  mem.delete(nameFor(uid));
}

// آخر اختيارات «الخطة الرسمية» لكل حساب (لا تختلط بين معلمين على نفس الجهاز)
const selKey = (uid) => `mt-plans:last:${uid || 'guest'}`;
export function loadSelection(uid) { try { return JSON.parse(localStorage.getItem(selKey(uid)) || 'null'); } catch { return null; } }
export function saveSelection(uid, sel) { try { localStorage.setItem(selKey(uid), JSON.stringify(sel)); } catch { /* */ } }
