// تجهيز ملف PDF ليصبح كتابًا: تحقق → قراءة الصفحات → نصوص البحث + صور مصغّرة لكل صفحة (مع تقدم حقيقي).
// المحتوى نفسه لا يُغيَّر: الملف الأصلي يُحفظ كما هو، والصفحات تُرسم منه وقت العرض.
import { openPdf, closePdf, sniffPdf, pageText, BookError, LIMITS } from './pdf.js';

const THUMB_W = 180;

export async function sha256(input) {
  const buf = input instanceof ArrayBuffer ? input : await input.arrayBuffer();
  const d = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

const cleanName = (n) => String(n || 'كتاب').replace(/\.pdf$/i, '').replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120) || 'كتاب';

function canvasToBlob(canvas, type = 'image/jpeg', q = 0.78) {
  return new Promise((res) => canvas.toBlob((b) => res(b), type, q));
}

/** يتحقق من الملف قبل أي معالجة */
export async function validateFile(file) {
  if (!file) throw new BookError('empty', 'لم يُختر أي ملف.');
  const isPdfName = /\.pdf$/i.test(file.name || '') || file.type === 'application/pdf';
  if (!isPdfName) throw new BookError('type', 'الملف ليس PDF. اختر ملفًا بامتداد ‎.pdf');
  if (file.size === 0) throw new BookError('empty', 'الملف فارغ.');
  if (file.size > LIMITS.maxBytes) throw new BookError('size', `حجم الملف ${(file.size / 1048576).toFixed(0)} ميغابايت، والحد الأقصى ${LIMITS.maxBytes / 1048576} ميغابايت.`);
  if (!(await sniffPdf(file))) throw new BookError('invalid', 'محتوى الملف ليس PDF صالحًا (ربما غُيّر امتداده فقط).');
}

/**
 * يعالج الملف ويعيد { book, texts, thumbs }.
 * onProgress({ stage, done, total })  — stage: 'open' | 'pages' | 'save'
 * signal: AbortSignal لإلغاء المعالجة.
 */
export async function processPdf(file, { onProgress = () => {}, signal, makeId = defaultId, findDuplicate } = {}) {
  await validateFile(file);
  onProgress({ stage: 'open', done: 0, total: 0 });
  const buf = await file.arrayBuffer(); // قراءة واحدة للملف (البصمة ثم الفتح) لتوفير الذاكرة
  const hash = await sha256(buf);
  if (findDuplicate) {
    const dup = await findDuplicate(hash);
    if (dup) { const e = new BookError('duplicate', `هذا الكتاب موجود في مكتبتك باسم «${dup.name}».`); e.book = dup; throw e; }
  }
  const data = new Uint8Array(buf);
  const doc = await openPdf(data);
  try {
    const total = doc.numPages;
    if (!total) throw new BookError('invalid', 'الملف لا يحتوي على صفحات.');
    if (total > LIMITS.maxPages) throw new BookError('pages', `عدد صفحات الملف ${total}، والحد الأقصى ${LIMITS.maxPages} صفحة. قسّم الكتاب إلى أجزاء.`);
    const texts = new Array(total).fill('');
    const thumbs = [];
    const sizes = [];
    let textChars = 0;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { alpha: false });
    for (let n = 1; n <= total; n++) {
      if (signal && signal.aborted) throw new BookError('aborted', 'أُلغيت المعالجة.');
      const page = await doc.getPage(n);
      const vp1 = page.getViewport({ scale: 1 });
      sizes.push([Math.round(vp1.width), Math.round(vp1.height)]);
      texts[n - 1] = await pageText(page);
      textChars += texts[n - 1].replace(/\s/g, '').length;
      const scale = THUMB_W / vp1.width;
      const vp = page.getViewport({ scale });
      canvas.width = Math.max(1, Math.round(vp.width)); canvas.height = Math.max(1, Math.round(vp.height));
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      try { await page.render({ canvasContext: ctx, viewport: vp }).promise; } catch { /* صفحة لا تُرسم: تبقى بيضاء */ }
      thumbs.push([n, await canvasToBlob(canvas)]);
      page.cleanup();
      onProgress({ stage: 'pages', done: n, total });
      if (n % 4 === 0) await new Promise((r) => setTimeout(r, 0)); // لا تُجمّد الواجهة
    }
    canvas.width = 0; canvas.height = 0;
    const [w0, h0] = sizes[0];
    const book = {
      id: makeId(), name: cleanName(file.name), fileName: String(file.name || '').slice(0, 200), size: file.size, hash,
      pages: total, width: w0, height: h0,
      // صفحات بأبعاد مختلفة عن الأولى (للعرض الصحيح)
      sizes: sizes.some(([w, h]) => Math.abs(w / h - w0 / h0) > 0.02) ? sizes : null,
      searchable: textChars >= Math.max(20, total * 8),
      scanned: textChars < total * 8,
      direction: guessDirection(texts),
      createdAt: Date.now(), updatedAt: Date.now(),
    };
    onProgress({ stage: 'save', done: total, total });
    return { book, texts, thumbs };
  } finally {
    await closePdf(doc);
  }
}

/** اتجاه التقليب: عربي (من اليمين) إن غلب النص العربي، وإلا لاتيني. الكتب الممسوحة: عربي افتراضيًا. */
export function guessDirection(texts) {
  let ar = 0, la = 0;
  for (const t of texts.slice(0, 30)) {
    for (const ch of t) {
      if (/[؀-ۿ]/.test(ch)) ar++;
      else if (/[A-Za-z]/.test(ch)) la++;
    }
  }
  return la > ar * 2 && la > 200 ? 'ltr' : 'rtl';
}

function defaultId() {
  const a = new Uint8Array(9); crypto.getRandomValues(a);
  return 'bk_' + Array.from(a).map((b) => b.toString(36).padStart(2, '0')).join('').slice(0, 14);
}
