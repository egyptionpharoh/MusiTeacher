// =====================================================================
//  أسماء الطلاب المشاركين — الإدخال اليدوي هو الأساس.
//  «مصادر الأسماء» واجهة موحّدة قابلة للتوسعة: أي مصدر مستقبلي (فصول MusiTeacher أو قناة رسمية معتمدة)
//  يُضاف عنصرًا في SOURCES يعيد قائمة أسماء فقط، دون تعديل بقية اللعبة.
//  ⚠ لا يوجد أي ربط بنظام نور: لا يُسمح بتجاوز صلاحياته، وأي ربط مستقبلي يكون عبر قناة رسمية مصرّح بها فقط.
// =====================================================================

const clean = (s) => String(s || '')
  .replace(/[‎‏‪-‮]/g, '')
  .replace(/^\s*(?:\d+|[٠-٩]+)\s*[-.)_:،]\s*/, '')        // ترقيم في أول السطر
  .replace(/\s+/g, ' ').trim().slice(0, 60);

/** نص ملصوق → أسماء (سطر لكل اسم؛ ويقبل الفواصل أيضًا إن لم توجد أسطر) */
export function parseNames(text) {
  const lines = String(text || '').split(/\r?\n/);
  const parts = lines.length > 1 ? lines : String(text || '').split(/[,،؛;]/);
  return parts.map(clean).filter((x) => x && !/^(?:الاسم|اسم الطالب|م|الرقم|name)$/i.test(x));
}

/** يدمج دون تكرار (يحترم الترتيب) ويعيد عدد المكرر المتجاهَل */
export function mergeNames(list, add) {
  const seen = new Set(list.map((n) => n.replace(/\s+/g, '')));
  const out = [...list]; let dup = 0;
  add.forEach((n) => { const k = n.replace(/\s+/g, ''); if (seen.has(k)) dup++; else { seen.add(k); out.push(n); } });
  return { names: out, dup };
}

/** نتيجة قارئ الملفات → أسماء: في الجداول نختار العمود الذي يشبه الأسماء أكثر (نص عربي/لاتيني لا أرقام) */
export function namesFromRead(r) {
  const out = [];
  const looksName = (c) => { const s = clean(c); return s.length >= 2 && /[ء-يa-zA-Z]{2,}/.test(s) && !/\d{3,}/.test(s); };
  (r.sheets || []).forEach((sh) => (sh.blocks || []).forEach((b) => {
    if (b.kind === 'table' && Array.isArray(b.rows) && b.rows.length) {
      const w = Math.max(...b.rows.map((x) => x.length));
      let best = -1, score = -1;
      for (let c = 0; c < w; c++) {
        const cells = b.rows.map((x) => x[c] || '');
        const sc = cells.filter(looksName).length + cells.filter((x) => clean(x).includes(' ')).length * 0.5;
        if (sc > score) { score = sc; best = c; }
      }
      if (best >= 0) out.push(...parseNames(b.rows.map((x) => x[best] || '').join('\n')).filter(looksName));
    } else if (b.kind === 'lines') out.push(...parseNames((b.lines || []).join('\n')).filter(looksName));
  }));
  return out.length ? out : parseNames(r.rawText || '');
}

export function shuffle(a, rnd = rand) { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; }

/** عشوائية حقيقية من المتصفح (crypto) */
export function rand() {
  if (window.crypto && crypto.getRandomValues) { const u = new Uint32Array(1); crypto.getRandomValues(u); return u[0] / 4294967296; }
  return Math.random();
}

export const SOURCES = [
  { id: 'manual', label: 'إدخال يدوي', available: true },
  {
    id: 'file', label: 'من ملف (Word / Excel / PDF / نص)', available: true,
    /** يعيد الأسماء من ملف بقارئ الملفات الموجود أصلًا في العجلة (يعمل داخل المتصفح فقط) */
    async load(file) {
      const m = await import('../../assets/readers-5YEYTTYF.js');
      const r = await m.readNamesFile(file);
      return namesFromRead(r);
    },
  },
  // مستقبلًا: { id: 'musiteacher-classes', label: 'فصولي في MusiTeacher', available: false, async load(classId) { … } }
];
