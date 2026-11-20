// ============================================================================
// storage.js — حفظ النوتات واستيرادها
// • مكتبة «نوتاتي» داخل هذا المتصفح (localStorage) بأسماء واضحة
// • تصدير ملف ‎.musinote.json‎ قابل للنقل بين الأجهزة يدويًا، واستيراده مع تحقق صارم
// • حفظ تلقائي لمسودة العمل الحالي لاستعادتها بعد إغلاق الصفحة بالخطأ
// ملاحظة صادقة: لا تُرفع النوتات إلى حساب المستخدم على المنصة؛ الحفظ محلي في المتصفح أو كملف.
// ============================================================================
(function (MT) {
  'use strict';
  const SC = MT.score;
  const LIB_KEY = 'musiteacher.melodic.library.v2';
  const DRAFT_KEY = 'musiteacher.melodic.draft.v2';
  const PREF_KEY = 'musiteacher.melodic.prefs.v2';
  const MAX_FILE = 2 * 1024 * 1024;

  function lsGet(k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) {
    try { window.localStorage.setItem(k, v); return { ok: true }; }
    catch (e) {
      const full = e && (e.name === 'QuotaExceededError' || e.code === 22);
      return { error: full ? 'مساحة الحفظ في المتصفح ممتلئة. صدّر بعض النوتات كملفات ثم احذفها من المكتبة.' : 'المتصفح يمنع الحفظ المحلي (قد تكون في وضع التصفح الخاص). استخدم «تصدير ملف» بدلًا من ذلك.' };
    }
  }
  function lsDel(k) { try { window.localStorage.removeItem(k); } catch (e) { /* لا شيء */ } }

  function available() {
    try { const k = '__mt_probe'; window.localStorage.setItem(k, '1'); window.localStorage.removeItem(k); return true; } catch (e) { return false; }
  }

  // ------------------------------------------------------------------ المكتبة
  function readLib() {
    const raw = lsGet(LIB_KEY);
    if (!raw) return [];
    try { const a = JSON.parse(raw); return Array.isArray(a) ? a.filter(x => x && x.id && x.data) : []; }
    catch (e) { return []; }
  }
  function writeLib(items) { return lsSet(LIB_KEY, JSON.stringify(items)); }

  function list() {
    return readLib().map(x => ({ id: x.id, name: x.name, updatedAt: x.updatedAt, createdAt: x.createdAt, notes: (x.data.score && x.data.score.notes || []).length }))
      .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  }

  function nameExists(name, exceptId) {
    const n = name.trim();
    return readLib().some(x => x.name.trim() === n && x.id !== exceptId);
  }

  // يحفظ (أو يحدّث إن مُرِّر id) ويعيد المعرّف
  function save(name, score, id) {
    name = String(name || '').trim();
    if (!name) return { error: 'اكتب اسمًا للنوتة قبل الحفظ.' };
    if (name.length > 60) return { error: 'الاسم طويل جدًا (60 حرفًا كحد أقصى).' };
    const items = readLib();
    const now = new Date().toISOString();
    const s = Object.assign({}, score, { title: name });
    const data = SC.serialize(s);
    let item = id ? items.find(x => x.id === id) : null;
    if (item) { item.name = name; item.data = data; item.updatedAt = now; }
    else {
      item = { id: 'lib-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name, data, createdAt: now, updatedAt: now };
      items.push(item);
    }
    const r = writeLib(items);
    if (r.error) return r;
    // تحقق فعلي: نقرأ ما كُتب ونتأكد من سلامته
    const back = readLib().find(x => x.id === item.id);
    try { SC.deserialize(back.data); } catch (e) { return { error: 'تعذّر التحقق من الحفظ. حاول مرة أخرى.' }; }
    return { ok: true, id: item.id, name };
  }

  function load(id) {
    const item = readLib().find(x => x.id === id);
    if (!item) return { error: 'لم تعد هذه النوتة موجودة في المكتبة.' };
    try {
      const r = SC.deserialize(item.data);
      return { ok: true, score: r.score, warnings: r.warnings, id: item.id, name: item.name };
    } catch (e) {
      return { error: 'النوتة المحفوظة تالفة ولا يمكن فتحها: ' + (e.userMessage || e.message) };
    }
  }

  function rename(id, name) {
    name = String(name || '').trim();
    if (!name) return { error: 'الاسم فارغ.' };
    const items = readLib(); const it = items.find(x => x.id === id);
    if (!it) return { error: 'النوتة غير موجودة.' };
    it.name = name; it.data.score.title = name; it.updatedAt = new Date().toISOString();
    return writeLib(items);
  }

  function remove(id) {
    const items = readLib().filter(x => x.id !== id);
    return writeLib(items);
  }

  // ------------------------------------------------------------- الملفات
  function safeFileName(name) {
    return (String(name || 'نوتة').trim().replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '-').slice(0, 60) || 'نوتة');
  }

  function exportFile(score, name) {
    const s = Object.assign({}, score, { title: name || score.title });
    const data = SC.serialize(s);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const fname = safeFileName(s.title) + '.musinote.json';
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = fname;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
    return { ok: true, fileName: fname, json: data };
  }

  function readFile(file) {
    return new Promise((resolve) => {
      if (!file) return resolve({ error: 'لم يتم اختيار ملف.' });
      if (file.size > MAX_FILE) return resolve({ error: 'حجم الملف كبير جدًا ولا يبدو ملف نوتة.' });
      if (file.size === 0) return resolve({ error: 'الملف فارغ.' });
      const fr = new FileReader();
      fr.onerror = () => resolve({ error: 'تعذّرت قراءة الملف من الجهاز.' });
      fr.onload = () => {
        try {
          const r = SC.deserialize(String(fr.result));
          resolve({ ok: true, score: r.score, warnings: r.warnings, fileName: file.name });
        } catch (e) {
          resolve({ error: e.userMessage || 'الملف غير صالح.' });
        }
      };
      fr.readAsText(file, 'utf-8');
    });
  }

  // ----------------------------------------------------------- المسودة
  function saveDraft(score, meta) {
    if (!score || !score.notes) return;
    if (!score.notes.length) { lsDel(DRAFT_KEY); return; }
    lsSet(DRAFT_KEY, JSON.stringify({ at: new Date().toISOString(), meta: meta || {}, data: SC.serialize(score) }));
  }
  function readDraft() {
    const raw = lsGet(DRAFT_KEY);
    if (!raw) return null;
    try {
      const d = JSON.parse(raw);
      const r = SC.deserialize(d.data);
      if (!r.score.notes.length) return null;
      return { score: r.score, at: d.at, meta: d.meta || {} };
    } catch (e) { lsDel(DRAFT_KEY); return null; }
  }
  function clearDraft() { lsDel(DRAFT_KEY); }

  function prefs(patch) {
    let p = {};
    try { p = JSON.parse(lsGet(PREF_KEY) || '{}') || {}; } catch (e) { p = {}; }
    if (patch) { p = Object.assign(p, patch); lsSet(PREF_KEY, JSON.stringify(p)); }
    return p;
  }

  MT.storage = { available, list, save, load, rename, remove, nameExists, exportFile, readFile, saveDraft, readDraft, clearDraft, prefs, safeFileName };
})(window.MT = window.MT || {});
