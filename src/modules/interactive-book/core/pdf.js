// تحميل PDF.js (نسخة مضمّنة في public/vendor/pdfjs) وفتح الملفات برسائل أخطاء عربية واضحة.
// لا يُعدَّل محتوى الملف الأصلي أبدًا: نقرأ ونعرض فقط.

export const VENDOR = '/vendor/pdfjs/';
export const LIMITS = { maxBytes: 150 * 1024 * 1024, maxPages: 800 };

let libPromise = null;

/** يحمّل مكتبة PDF.js مرة واحدة فقط */
export function loadPdfjs(base = VENDOR) {
  if (!libPromise) {
    libPromise = import(/* webpackIgnore: true */ /* turbopackIgnore: true */ `${base}pdf.min.mjs`).then((lib) => {
      lib.GlobalWorkerOptions.workerSrc = `${base}pdf.worker.min.mjs`;
      return lib;
    }).catch((e) => { libPromise = null; throw friendly(e); });
  }
  return libPromise;
}

export class BookError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

export function friendly(e) {
  if (e instanceof BookError) return e;
  const name = (e && e.name) || '';
  if (name === 'PasswordException') return new BookError('password', 'هذا الملف محمي بكلمة مرور، ولا يمكن فتحه. احفظ نسخة غير محمية من البرنامج الذي أنشأه ثم ارفعها.');
  if (name === 'InvalidPDFException') return new BookError('invalid', 'الملف تالف أو ليس PDF صالحًا. جرّب فتحه على جهازك أولًا، أو احفظه من جديد بصيغة PDF.');
  if (name === 'MissingPDFException') return new BookError('missing', 'تعذّر العثور على الملف.');
  if (name === 'UnexpectedResponseException') return new BookError('network', 'انقطع الاتصال أثناء تحميل مكتبة العرض. تحقق من الإنترنت ثم أعد المحاولة.');
  if (/Failed to fetch|dynamically imported module|Importing a module/i.test(String(e && e.message))) {
    return new BookError('network', 'تعذّر تحميل محرك عرض الكتب. تحقق من الاتصال ثم حدّث الصفحة.');
  }
  return new BookError('unknown', 'تعذّر قراءة الملف. قد يكون تالفًا أو بصيغة غير مدعومة.');
}

/** يتحقق من أن البايتات الأولى تخص ملف PDF فعلًا */
export async function sniffPdf(blob) {
  const head = new Uint8Array(await blob.slice(0, 1024).arrayBuffer());
  const text = String.fromCharCode(...head);
  return text.includes('%PDF-');
}

/** يفتح مستند PDF من بيانات ثنائية. يرفض الملفات المحمية بكلمة مرور برسالة واضحة. */
export async function openPdf(data, { base = VENDOR } = {}) {
  const lib = await loadPdfjs(base);
  const task = lib.getDocument({
    data,
    standardFontDataUrl: `${base}standard_fonts/`,
    wasmUrl: `${base}wasm/`, iccUrl: `${base}iccs/`,
    isEvalSupported: false, enableXfa: false,
  });
  try {
    return await task.promise;
  } catch (e) {
    throw friendly(e);
  }
}

/** نص الصفحة كما هو في الملف (للبحث فقط) — يُعاد بناؤه من مواقع الحروف لأن بعض البرامج
 *  تكتب الحروف العربية منفصلة وبترتيب بصري وبأشكال العرض (ﺍﻟ…)، فنعيدها كلمات صحيحة قابلة للبحث. */
export async function pageText(page) {
  try {
    const tc = await page.getTextContent();
    return textFromItems(tc.items);
  } catch { return ''; }
}

const AR = /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/;
const LTR = /[0-9A-Za-z\u0660-\u0669]/;

export function textFromItems(items) {
  const parts = [];
  for (const it of items) {
    if (typeof it.str !== 'string' || !it.transform) continue;
    const str = it.str.normalize('NFKC');
    if (!str.trim()) continue;
    const fs = Math.hypot(it.transform[2], it.transform[3]) || it.height || 10;
    parts.push({ s: str, x: it.transform[4], y: it.transform[5], w: it.width || 0, fs });
  }
  // تجميع الأسطر حسب الارتفاع
  parts.sort((a, b) => b.y - a.y);
  const lines = [];
  for (const p of parts) {
    const ln = lines.find((l) => Math.abs(l.y - p.y) < Math.max(2, p.fs * 0.45));
    if (ln) ln.items.push(p); else lines.push({ y: p.y, items: [p] });
  }
  const out = [];
  for (const ln of lines) {
    let ar = 0, la = 0;
    for (const p of ln.items) for (const ch of p.s) { if (AR.test(ch)) ar++; else if (/[A-Za-z]/.test(ch)) la++; }
    const rtl = ar >= la;
    const items = ln.items.sort((a, b) => (rtl ? b.x - a.x : a.x - b.x));
    // عناصر لاتينية/أرقام متتالية داخل سطر عربي تُعاد إلى ترتيبها الطبيعي
    if (rtl) {
      for (let i = 0; i < items.length;) {
        if (!AR.test(items[i].s) && LTR.test(items[i].s)) {
          let j = i; while (j + 1 < items.length && !AR.test(items[j + 1].s) && LTR.test(items[j + 1].s)) j++;
          const run = items.slice(i, j + 1).reverse(); items.splice(i, run.length, ...run); i = j + 1;
        } else i++;
      }
    }
    let line = '';
    for (let i = 0; i < items.length; i++) {
      const cur = items[i];
      if (i) {
        const prev = items[i - 1];
        const ltrPair = rtl && !AR.test(prev.s) && !AR.test(cur.s) && LTR.test(prev.s) && LTR.test(cur.s);
        const gap = rtl && !ltrPair ? prev.x - (cur.x + cur.w) : cur.x - (prev.x + prev.w);
        const sep = Math.abs(gap) > cur.fs * 0.22 && !line.endsWith(' ') && !cur.s.startsWith(' ');
        if (sep) line += ' ';
      }
      line += cur.s;
    }
    // بعض الملفات تفك «لإ/لأ/لآ» بترتيب معكوس: «اإلصدار» ← «الإصدار»
    out.push(line.replace(/ا([إأآ])ل/g, 'ال$1').replace(/\s+/g, ' ').trim());
  }
  return out.filter(Boolean).join('\n');
}

/** إغلاق المستند وتحرير ذاكرته وعامل المعالجة */
export async function closePdf(doc) {
  if (!doc) return;
  try {
    if (doc.loadingTask && typeof doc.loadingTask.destroy === 'function') await doc.loadingTask.destroy();
    else if (typeof doc.destroy === 'function') await doc.destroy();
    else if (typeof doc.cleanup === 'function') await doc.cleanup();
  } catch { /* */ }
}
