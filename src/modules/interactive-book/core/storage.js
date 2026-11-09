// «مكتبتي الرقمية»: تخزين الكتب على جهاز المعلم (IndexedDB) — قاعدة مستقلة لكل حساب.
// ملف PDF الأصلي يُحفظ كما هو (Blob) دون تعديل، وكل ما يضيفه المعلم (تعليقات، ملاحظات، علامات، آخر صفحة)
// يُحفظ منفصلًا عنه. لا شيء يُرفع إلى أي خادم.

const DB_VERSION = 1;
const STORES = ['books', 'files', 'thumbs', 'texts', 'anns', 'state'];

export function dbNameFor(uid) { return `musiteacher-interactive-book:${uid || 'guest'}`; }

const conns = new Map();
function open(uid) {
  const name = dbNameFor(uid);
  if (!conns.has(name)) {
    conns.set(name, new Promise((resolve, reject) => {
      const req = indexedDB.open(name, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        for (const s of STORES) if (!db.objectStoreNames.contains(s)) db.createObjectStore(s);
      };
      req.onsuccess = () => {
        const db = req.result;
        db.onversionchange = () => { db.close(); conns.delete(name); };
        resolve(db);
      };
      req.onerror = () => { conns.delete(name); reject(req.error); };
      req.onblocked = () => reject(new Error('blocked'));
    }));
  }
  return conns.get(name);
}

function wrap(req) { return new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); }); }
function done(tx) { return new Promise((res, rej) => { tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error || new Error('abort')); }); }

export function makeLibrary(uid) {
  const db = () => open(uid);
  const get = async (store, key) => wrap((await db()).transaction(store).objectStore(store).get(key));
  const put = async (store, key, val) => { const t = (await db()).transaction(store, 'readwrite'); t.objectStore(store).put(val, key); return done(t); };

  return {
    uid,
    async list() {
      const t = (await db()).transaction(['books', 'state']);
      const books = await wrap(t.objectStore('books').getAll());
      const states = await Promise.all(books.map((b) => wrap(t.objectStore('state').get(b.id))));
      return books.map((b, i) => ({ ...b, lastPage: (states[i] && states[i].lastPage) || 1, openedAt: (states[i] && states[i].openedAt) || 0 }))
        .sort((a, b) => (b.openedAt || b.createdAt) - (a.openedAt || a.createdAt));
    },
    async findByHash(hash) { return (await this.list()).find((b) => b.hash === hash) || null; },
    getBook: (id) => get('books', id),
    getFile: (id) => get('files', id),
    getTexts: async (id) => (await get('texts', id)) || [],
    getThumb: (id, page) => get('thumbs', `${id}:${page}`),
    getState: async (id) => (await get('state', id)) || { lastPage: 1, bookmarks: [], notes: {}, openedAt: 0 },
    saveState: (id, state) => put('state', id, state),
    getAnns: async (id) => (await get('anns', id)) || { pages: {} },
    saveAnns: (id, anns) => put('anns', id, anns),

    /** يحفظ كتابًا جديدًا كاملًا في معاملة واحدة (لا يبقى كتاب ناقص عند الفشل) */
    async add(book, file, texts, thumbs) {
      const t = (await db()).transaction(STORES, 'readwrite');
      t.objectStore('books').put(book, book.id);
      t.objectStore('files').put(file, book.id);
      t.objectStore('texts').put(texts, book.id);
      for (const [page, blob] of thumbs) t.objectStore('thumbs').put(blob, `${book.id}:${page}`);
      t.objectStore('state').put({ lastPage: 1, bookmarks: [], notes: {}, openedAt: Date.now() }, book.id);
      t.objectStore('anns').put({ pages: {} }, book.id);
      return done(t);
    },
    async rename(id, name) {
      const b = await get('books', id);
      if (!b) return;
      b.name = name; b.updatedAt = Date.now();
      await put('books', id, b);
    },
    async remove(id) {
      const d = await db();
      const b = await wrap(d.transaction('books').objectStore('books').get(id));
      const t = d.transaction(STORES, 'readwrite');
      for (const s of ['books', 'files', 'texts', 'anns', 'state']) t.objectStore(s).delete(id);
      const pages = (b && b.pages) || 0;
      if (pages) t.objectStore('thumbs').delete(IDBKeyRange.bound(`${id}:`, `${id}:￿`));
      return done(t);
    },
  };
}

/** المساحة المتاحة للتخزين في المتصفح (تقريبية) */
export async function storageInfo() {
  try {
    if (!navigator.storage || !navigator.storage.estimate) return null;
    const e = await navigator.storage.estimate();
    let persisted = false;
    try { persisted = navigator.storage.persisted ? await navigator.storage.persisted() : false; } catch { /* */ }
    return { usage: e.usage || 0, quota: e.quota || 0, persisted };
  } catch { return null; }
}

/** يطلب من المتصفح ألا يحذف المكتبة عند امتلاء القرص */
export async function askPersist() {
  try { if (navigator.storage && navigator.storage.persist) return await navigator.storage.persist(); } catch { /* */ }
  return false;
}
