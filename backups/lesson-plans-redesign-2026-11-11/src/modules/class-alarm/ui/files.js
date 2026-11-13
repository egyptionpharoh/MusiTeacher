// 📂 الاستيراد والتصدير في المتصفح.
// الاستيراد: Excel/CSV/Word تُقرأ محليًا على الجهاز أولًا؛ الصور وPDF (أو ما تعذر فهمه محليًا) تُرسل لقراءة ذكية عبر خادم المنصة.
// التصدير: صورة PNG عالية الدقة وPDF مرسومة بنفس تصميم القالب (sheetCanvas)، وWord وExcel قابلان للتحرير، وملف تقويم .ics.
import { parseGrid, csvToGrid, docxTables, fromAI } from '../core/parse.js';
import { unzipEntry } from '../core/zip.js';
import { jpegToPdf } from '../core/pdf.js';
import { buildScheduleDocx } from '../core/docx.js';
import { sheetRows, listRows } from '../core/sheet.js';
import { drawSheet } from './sheetCanvas';

export const IMPORT_ACCEPT = '.xlsx,.xls,.csv,.ods,.docx,.pdf,.jpg,.jpeg,.png,.webp,.heic,.txt,image/*,application/pdf';
const MAX_PDF = 3.2 * 1024 * 1024;

const kindOf = (f) => {
  const n = (f.name || '').toLowerCase();
  if (/\.(xlsx|xlsm|xls|ods)$/.test(n)) return 'sheet';
  if (/\.(csv|txt|tsv)$/.test(n)) return 'csv';
  if (/\.docx$/.test(n)) return 'docx';
  if (/\.doc$/.test(n)) return 'doc';
  if (/\.pdf$/.test(n) || f.type === 'application/pdf') return 'pdf';
  if (/^image\//.test(f.type) || /\.(jpe?g|png|webp|gif|bmp|heic)$/.test(n)) return 'image';
  return 'unknown';
};

const gridText = (grid) => grid.filter((r) => r.some((c) => String(c || '').trim())).map((r) => r.map((c) => String(c ?? '').replace(/\s+/g, ' ').trim()).join(' | ')).join('\n').slice(0, 20000);

/**
 * يقرأ الملف ويعيد { ok, draft, issues, stats, via:'local'|'ai', note } أو { ok:false, error }
 * ai: دالة (payload) → رد الخادم، أو null إن لم تكن القراءة الذكية متاحة
 */
export async function importFile(file, { ai, onStage = () => {} } = {}) {
  const kind = kindOf(file);
  if (kind === 'doc') return { ok: false, error: 'ملفات Word القديمة (.doc) غير مدعومة. افتح الملف في Word واحفظه بصيغة .docx أو PDF ثم أعد المحاولة.' };
  if (kind === 'unknown') return { ok: false, error: 'صيغة الملف غير مدعومة. الصيغ المتاحة: Excel، CSV، Word (docx)، PDF، صور JPG/PNG.' };

  let localFail = null, textForAI = '';
  if (kind === 'sheet' || kind === 'csv' || kind === 'docx') {
    onStage('نقرأ الملف على جهازك...');
    try {
      const grids = await gridsOf(file, kind);
      for (const g of grids) {
        const r = parseGrid(g);
        if (r.ok && r.stats.lessons > 0) return { ...r, via: 'local' };
        if (!localFail) localFail = r;
      }
      textForAI = grids.map(gridText).join('\n\n---\n\n');
    } catch (e) { localFail = { ok: false, error: 'تعذر فتح الملف. تأكد أنه غير تالف وغير محمي بكلمة مرور.' }; }
    if (!ai) return localFail && localFail.error ? localFail : { ok: false, error: 'لم نتمكن من التعرف على الجدول في الملف.' };
    if (!textForAI.trim()) return localFail || { ok: false, error: 'الملف فارغ.' };
    onStage('الترتيب غير معتاد؛ نستعين بالقراءة الذكية...');
    return viaAI(ai, { kind: 'text', text: textForAI, name: file.name });
  }
  if (!ai) return { ok: false, error: 'قراءة الصور وملفات PDF تحتاج خدمة القراءة الذكية، وهي غير مفعّلة حاليًا على المنصة. استخدم ملف Excel أو Word، أو أدخل الجدول يدويًا.' };
  if (kind === 'pdf') {
    if (file.size > MAX_PDF) return { ok: false, error: 'ملف PDF أكبر من 3 ميجابايت. صوّر صفحة الجدول فقط أو احفظها صورة ثم ارفعها.' };
    onStage('نرسل الملف للقراءة الذكية...');
    return viaAI(ai, { kind: 'pdf', mime: 'application/pdf', data: await toBase64(file), name: file.name });
  }
  onStage('نجهز الصورة...');
  let img;
  try { img = await shrinkImage(file); } catch { return { ok: false, error: 'تعذر فتح الصورة في هذا المتصفح. جرّب صورة JPG أو PNG.' }; }
  onStage('نقرأ الجدول من الصورة...');
  return viaAI(ai, { kind: 'image', mime: 'image/jpeg', data: img, name: file.name });
}

async function viaAI(ai, payload) {
  const r = await ai(payload);
  const out = fromAI(r.schedule);
  return out.ok ? { ...out, via: 'ai', note: r.provider ? `قُرئ بالذكاء الاصطناعي (${r.provider})` : '' } : out;
}

async function gridsOf(file, kind) {
  if (kind === 'csv') return [csvToGrid(await file.text())];
  if (kind === 'docx') {
    const xml = await unzipEntry(new Uint8Array(await file.arrayBuffer()), 'word/document.xml');
    if (!xml) throw new Error('bad docx');
    return docxTables(new TextDecoder().decode(xml));
  }
  const XLSX = await import('xlsx');
  const wb = XLSX.read(new Uint8Array(await file.arrayBuffer()), { type: 'array', cellDates: false });
  return wb.SheetNames.map((n) => XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: false, defval: '', blankrows: true }))
    .map((g) => fillMerged(g));
}
// الخلايا المدمجة في Excel تظهر فارغة؛ لا نملؤها (قد تكون حصة فارغة فعلًا) لكن نحافظ على الأبعاد
const fillMerged = (g) => g.map((r) => r.map((c) => (c == null ? '' : String(c))));

function toBase64(blob) {
  return new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result).split(',')[1] || ''); r.onerror = () => reject(r.error); r.readAsDataURL(blob); });
}
async function shrinkImage(file, max = 2000) {
  const url = URL.createObjectURL(file);
  try {
    const im = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const s = Math.min(1, max / Math.max(im.naturalWidth, im.naturalHeight));
    const c = document.createElement('canvas'); c.width = Math.round(im.naturalWidth * s); c.height = Math.round(im.naturalHeight * s);
    const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(im, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.88).split(',')[1];
  } finally { URL.revokeObjectURL(url); }
}

/** شعار المدرسة: صورة صغيرة PNG (≤ 360 بكسل) تُحفظ داخل بيانات الجدول */
export async function logoDataUrl(file) {
  const url = URL.createObjectURL(file);
  try {
    const im = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const s = Math.min(1, 360 / Math.max(im.naturalWidth, im.naturalHeight));
    const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(im.naturalWidth * s)); c.height = Math.max(1, Math.round(im.naturalHeight * s));
    c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
    return c.toDataURL('image/png');
  } finally { URL.revokeObjectURL(url); }
}

// ======================= التصدير =======================
export function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = name; a.rel = 'noopener';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
export const safeName = (s) => String(s || 'جدول').replace(/[\\/:*?"<>|\r\n]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) || 'جدول';

const canvasBlob = (c, type, q) => new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('blob'))), type, q));

/** opts = خيارات القالب نفسها المستخدمة في المعاينة */
export async function exportPNG(profile, opts, name) { const c = await drawSheet(profile, opts, 3); const b = await canvasBlob(c, 'image/png'); downloadBlob(b, `${name}.png`); return b; }
export async function exportPDF(profile, opts, name) {
  const c = await drawSheet(profile, opts, 3);
  const b = await canvasBlob(c, 'image/jpeg', 0.92);
  const pdf = jpegToPdf(new Uint8Array(await b.arrayBuffer()), c.width, c.height, { title: name });
  downloadBlob(new Blob([pdf], { type: 'application/pdf' }), `${name}.pdf`);
}
export async function sharePNG(profile, opts, name) {
  const c = await drawSheet(profile, opts, 2);
  const b = await canvasBlob(c, 'image/png');
  const file = new File([b], `${name}.png`, { type: 'image/png' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: name }); return true; }
  return false;
}
export async function exportDocx(profile, template, name, h24) {
  const bytes = await buildScheduleDocx(profile, { template, h24 });
  downloadBlob(new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }), `${name}.docx`);
}
export async function exportXlsx(profile, name, h24) {
  const XLSX = await import('xlsx');
  const { header, rows } = sheetRows(profile, { h24 });
  const title = [[profile.school || ''], [`الجدول الدراسي الأسبوعي${profile.teacher ? ` – ${profile.teacher}` : ''}`], [[profile.subject, profile.year, profile.semester && `الفصل ${profile.semester}`].filter(Boolean).join(' • ')], []];
  const ws = XLSX.utils.aoa_to_sheet([...title, header, ...rows]);
  ws['!cols'] = header.map((_, i) => ({ wch: i === 0 ? 12 : 16 }));
  ws['!merges'] = [0, 1, 2].map((r) => ({ s: { r, c: 0 }, e: { r, c: header.length - 1 } }));
  const ws2 = XLSX.utils.aoa_to_sheet(listRows(profile));
  ws2['!cols'] = [10, 7, 8, 8, 20, 12, 8, 14, 30].map((w) => ({ wch: w }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'الجدول');
  XLSX.utils.book_append_sheet(wb, ws2, 'قائمة الحصص');
  wb.Workbook = { Views: [{ RTL: true }] };
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  downloadBlob(new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `${name}.xlsx`);
}

/** طباعة مباشرة: إطار مخفي يحتوي القالب فقط بمقاس A4 أفقي */
export function printSheet(sheet) {
  const f = document.createElement('iframe');
  f.setAttribute('aria-hidden', 'true');
  Object.assign(f.style, { position: 'fixed', width: '0', height: '0', border: '0', left: '0', bottom: '0', opacity: '0' });
  document.body.appendChild(f);
  const d = f.contentDocument;
  d.open();
  d.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>الجدول الدراسي</title><link rel="preconnect" href="https://fonts.gstatic.com"><link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap" rel="stylesheet"><style>@page{size:A4 landscape;margin:0}html,body{margin:0;padding:0}body{-webkit-print-color-adjust:exact;print-color-adjust:exact}.wrap{width:297mm;height:209mm;display:flex;align-items:center;justify-content:center;overflow:hidden}.wrap>.cat-sheet{transform:scale(1);transform-origin:center}${sheet.css}</style></head><body><div class="wrap">${sheet.html}</div></body></html>`);
  d.close();
  const go = () => { try { f.contentWindow.focus(); f.contentWindow.print(); } catch { /* */ } setTimeout(() => f.remove(), 60000); };
  const fonts = f.contentDocument.fonts;
  setTimeout(() => (fonts && fonts.ready ? fonts.ready.then(go) : go()), 350);
}
