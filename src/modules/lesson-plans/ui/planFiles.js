// 📂 قراءة ملف الخطة في المتصفح + قالب Excel القابل للتنزيل.
// Excel/CSV/Word (جداول) تُقرأ محليًا على جهاز المعلم. PDF والصور وملفات Word الممسوحة (صور فقط) تحتاج القراءة الذكية عبر الخادم.
// الملف الأصلي لا يُرفع للتخزين أبدًا؛ عند القراءة الذكية يُرسل للمعالجة لحظيًا فقط.
import { parsePlanGrid, fromAIPlans } from '../core/importPlan.js';
import { csvToGrid, docxTables } from '../../class-alarm/core/parse.js';
import { unzipEntry, unzipNames } from '../../class-alarm/core/zip.js';
import { downloadBlob } from '../../class-alarm/ui/files';

export const PLAN_ACCEPT = '.xlsx,.xls,.csv,.docx,.pdf,.jpg,.jpeg,.png,.webp,image/*,application/pdf';
const MAX_PDF = 3.2 * 1024 * 1024;

const kindOf = (f) => {
  const n = (f.name || '').toLowerCase();
  if (/\.(xlsx|xlsm|xls|ods)$/.test(n)) return 'sheet';
  if (/\.(csv|tsv|txt)$/.test(n)) return 'csv';
  if (/\.docx$/.test(n)) return 'docx';
  if (/\.doc$/.test(n)) return 'doc';
  if (/\.pdf$/.test(n) || f.type === 'application/pdf') return 'pdf';
  if (/^image\//.test(f.type) || /\.(jpe?g|png|webp)$/.test(n)) return 'image';
  return 'unknown';
};
const gridText = (g) => g.filter((r) => r.some((c) => String(c ?? '').trim())).map((r) => r.map((c) => String(c ?? '').replace(/\s+/g, ' ').trim()).join(' | ')).join('\n');

/** يعيد { ok, drafts, via, note, preview } أو { ok:false, error } */
export async function readPlanFile(file, { ai, onStage = () => {} } = {}) {
  const kind = kindOf(file);
  const preview = kind === 'pdf' || kind === 'image' ? { kind, url: URL.createObjectURL(file) } : null;
  if (kind === 'doc') return { ok: false, error: 'ملفات Word القديمة (.doc) غير مدعومة. احفظ الملف بصيغة .docx أو PDF ثم أعد المحاولة.' };
  if (kind === 'unknown') return { ok: false, error: 'صيغة غير مدعومة. المتاح: Excel، CSV، Word (docx)، PDF، صور.' };

  if (kind === 'sheet' || kind === 'csv' || kind === 'docx') {
    onStage('نقرأ الملف على جهازك...');
    let grids = [], images = [], localErr = null;
    try {
      if (kind === 'csv') grids = [csvToGrid(await file.text())];
      else if (kind === 'docx') {
        const buf = new Uint8Array(await file.arrayBuffer());
        const xml = await unzipEntry(buf, 'word/document.xml');
        if (!xml) throw new Error('bad');
        grids = docxTables(new TextDecoder().decode(xml));
        if (!grids.length) images = await docxImages(buf);
      } else {
        const XLSX = await import('xlsx');
        const wb = XLSX.read(new Uint8Array(await file.arrayBuffer()), { type: 'array', cellDates: true });
        grids = wb.SheetNames.filter((n) => !/تعليمات|instructions/i.test(n)).map((n) => XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: '', blankrows: false }));
      }
    } catch { return { ok: false, error: 'تعذر فتح الملف. تأكد أنه غير تالف وغير محمي بكلمة مرور.' }; }
    const all = [];
    for (const g of grids) { const r = parsePlanGrid(g); if (r.ok) all.push(...r.drafts); else localErr = localErr || r.error; }
    if (all.length) return { ok: true, drafts: all, via: 'local', note: 'قُرئ الملف على جهازك مباشرة.', preview };
    if (images.length) {
      if (!ai) return { ok: false, error: 'ملف Word هذا يحتوي صورة ممسوحة للخطة (وليس جدولًا قابلًا للقراءة)، وقراءة الصور تحتاج «القراءة الذكية» غير المفعّلة حاليًا. أعد كتابة الخطة في قالب Excel، أو فعّل القراءة الذكية.', images: images.length };
      onStage('الملف يحتوي صورة للخطة؛ نقرؤها بالقراءة الذكية...');
      return viaAI(ai, { kind: 'images', images: images.slice(0, 4) }, { kind: 'image', url: `data:${images[0].mime};base64,${images[0].data}` });
    }
    if (!ai) return { ok: false, error: localErr || 'لم نتعرف على الخطة في الملف.' };
    const text = grids.map(gridText).join('\n\n---\n\n').slice(0, 30000);
    if (!text.trim()) return { ok: false, error: localErr || 'الملف فارغ.' };
    onStage('ترتيب الجدول غير معتاد؛ نستعين بالقراءة الذكية...');
    return viaAI(ai, { kind: 'text', text }, preview);
  }
  if (!ai) return { ok: false, error: 'قراءة ملفات PDF والصور تحتاج «القراءة الذكية»، وهي غير مفعّلة على المنصة حاليًا. استخدم ملف Excel أو Word (جدول) أو قالب المنصة.', preview };
  if (kind === 'pdf') {
    if (file.size > MAX_PDF) return { ok: false, error: 'ملف PDF أكبر من 3 ميجابايت. احفظ صفحات الخطة فقط في ملف أصغر.' };
    onStage('نقرأ ملف PDF بالقراءة الذكية...');
    return viaAI(ai, { kind: 'pdf', mime: 'application/pdf', data: await toB64(file) }, preview);
  }
  onStage('نقرأ الصورة بالقراءة الذكية...');
  return viaAI(ai, { kind: 'image', mime: 'image/jpeg', data: await shrink(file) }, preview);
}

async function viaAI(ai, payload, preview) {
  const r = await ai(payload);
  const out = fromAIPlans(r.result);
  return out.ok ? { ...out, via: 'ai', note: `قُرئ بالقراءة الذكية (${r.provider}). راجع كل خانة مقابل الملف الأصلي.`, preview } : { ...out, preview };
}

async function docxImages(buf) {
  const names = unzipNames(buf).filter((n) => /^word\/media\/.+\.(png|jpe?g|gif|bmp|webp)$/i.test(n));
  const out = [];
  for (const n of names.slice(0, 4)) {
    const bytes = await unzipEntry(buf, n);
    if (!bytes || bytes.length < 5000) continue; // أيقونات وشعارات صغيرة
    const mime = /\.png$/i.test(n) ? 'image/png' : 'image/jpeg';
    out.push({ mime: 'image/jpeg', data: await shrink(new Blob([bytes], { type: mime })) });
  }
  return out;
}
function toB64(blob) { return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1] || ''); r.onerror = () => rej(r.error); r.readAsDataURL(blob); }); }
async function shrink(blob, max = 2200) {
  const url = URL.createObjectURL(blob);
  try {
    const im = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const s = Math.min(1, max / Math.max(im.naturalWidth, im.naturalHeight));
    const c = document.createElement('canvas'); c.width = Math.round(im.naturalWidth * s); c.height = Math.round(im.naturalHeight * s);
    const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(im, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.9).split(',')[1];
  } finally { URL.revokeObjectURL(url); }
}

/** قالب Excel للخطة الفصلية: ورقة «الخطة» + ورقة «تعليمات» (لا بيانات تجريبية في ورقة الخطة) */
export async function downloadPlanTemplate() {
  const XLSX = await import('xlsx');
  const head = ['العام الدراسي', 'الفصل الدراسي', 'الصف', 'الوحدة', 'اسم الدرس', 'بداية الفترة الزمنية', 'نهاية الفترة الزمنية', 'عدد الحصص المخصصة للدرس', 'المخرجات التعليمية', 'أدوات التقويم', 'الملاحظات', 'تاريخ الحصة الفعلي (اختياري – يُترك فارغًا)', 'رقم الحصة الفعلي (اختياري – يُترك فارغًا)'];
  const ws = XLSX.utils.aoa_to_sheet([head, ...Array.from({ length: 40 }, () => head.map(() => ''))]);
  ws['!cols'] = [12, 18, 14, 16, 34, 16, 16, 12, 50, 26, 26, 22, 18].map((w) => ({ wch: w }));
  ws['!autofilter'] = { ref: `A1:M41` };
  const help = [
    ['قالب الخطة الفصلية — منصة MusiTeacher'],
    [''],
    ['• املأ ورقة «الخطة»: صف لكل درس، بنفس ترتيب الخطة الأصلية.'],
    ['• العام الدراسي بصيغة 2026/2027، والفصل: الأول أو الثاني، والصف: الخامس أو 5.'],
    ['• التواريخ بصيغة يوم/شهر/سنة مثل 6/9/2026 (أو تاريخ Excel).'],
    ['• عدد الحصص رقم صحيح. إذا تركته فارغًا لن تضع المنصة عددًا من عندها، وستطلب منك إدخاله قبل التوزيع على جدولك.'],
    ['• إذا كان الدرس يمتد عدة أسابيع اكتبه في صف واحد ببداية ونهاية الفترة، أو اكتبه في صفوف متتالية بنفس الاسم وستُدمج.'],
    ['• يمكن وضع أكثر من صف أو فصل في الملف نفسه؛ ستُنشأ خطة مستقلة لكل (عام + فصل + صف).'],
    ['• العمودان الأخيران (التاريخ ورقم الحصة الفعليان) خاصان بالتوزيع الفعلي وليسا جزءًا من الخطة؛ اتركهما فارغين. الربط بحصصك يتم تلقائيًا من جدولك في «منبّه الحصص الذكي».'],
    ['• الخطة تبقى في حسابك فقط ولا تُنشر لغيرك. استخدام محتوى الوزارة داخل حسابك لا يعني امتلاك حق إعادة نشره.'],
  ];
  const hs = XLSX.utils.aoa_to_sheet(help); hs['!cols'] = [{ wch: 120 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'الخطة');
  XLSX.utils.book_append_sheet(wb, hs, 'تعليمات');
  wb.Workbook = { Views: [{ RTL: true }] };
  downloadBlob(new Blob([XLSX.write(wb, { bookType: 'xlsx', type: 'array' })], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'قالب-الخطة-الفصلية.xlsx');
}
