// 📚 «الخطط الدراسية المقترحة»: ملفات Excel يرفعها الأدمن فقط، ويتصفحها المعلمون ويعاينونها وينزّلونها.
// لا تُضاف تلقائيًا إلى خطة أي معلم، ولا يستطيع المعلم تعديلها؛ والتحقق هنا من محتوى الملف الفعلي (لا من اسمه فقط).
import { gradeNum } from '../core/model.js';

export const SUGGESTED_MAX_BYTES = 2 * 1024 * 1024;
const SEMESTERS = ['الفصل الدراسي الأول', 'الفصل الدراسي الثاني'];
const str = (v, n) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n) : '');

/** نوع الملف من بايتاته (التوقيع)، لا من امتداده */
export function sniffSheet(buf) {
  if (!buf || buf.length < 8) return null;
  if (buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04) {
    // ملف ZIP: نتأكد أنه مصنف Excel وليس Word أو أرشيفًا آخر (أسماء الملفات الداخلية مخزنة كنص في الأرشيف)
    const s = buf.toString('latin1');
    return s.includes('xl/workbook') ? { kind: 'xlsx', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' } : null;
  }
  if (buf[0] === 0xd0 && buf[1] === 0xcf && buf[2] === 0x11 && buf[3] === 0xe0 && buf[4] === 0xa1 && buf[5] === 0xb1 && buf[6] === 0x1a && buf[7] === 0xe1) return { kind: 'xls', mime: 'application/vnd.ms-excel' };
  // CSV: نص UTF-8 صالح بلا بايتات صفرية، فيه أسطر وفواصل
  if (buf.includes(0)) return null;
  const text = buf.toString('utf8');
  if (text.includes('�')) return null;
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length >= 2 && lines.slice(0, 5).every((l) => /[,;\t]/.test(l))) return { kind: 'csv', mime: 'text/csv; charset=utf-8' };
  return null;
}

/** بيانات الخطة المقترحة (الوصفية) */
export function normalizeMeta(m) {
  const o = m && typeof m === 'object' ? m : {};
  const grade = Math.round(+o.grade);
  return {
    grade: grade >= 1 && grade <= 12 ? grade : gradeNum(o.gradeName || ''),
    semester: SEMESTERS.includes(o.semester) ? o.semester : '',
    year: /^\d{4}\/\d{4}$/.test(String(o.year || '').trim()) ? String(o.year).trim() : '',
    subject: str(o.subject, 80) || 'المهارات الموسيقية',
    title: str(o.title, 160),
    note: str(o.note, 600),
    lessons: Math.max(0, Math.min(500, Math.round(+o.lessons) || 0)),
  };
}

/** فحص طلب الرفع: الامتداد + الحجم + التوقيع + البيانات الوصفية */
export function validateUpload(body, { requireFile = true } = {}) {
  const meta = normalizeMeta(body && body.meta);
  if (!meta.grade) return { error: 'حدد الصف.' };
  if (!meta.semester) return { error: 'حدد الفصل الدراسي.' };
  if (!meta.year) return { error: 'اكتب العام الدراسي بصيغة 2026/2027.' };
  const f = body && body.file;
  if (!f) return requireFile ? { error: 'اختر ملف Excel للخطة.' } : { meta };
  const name = str(f.name, 160);
  if (!/\.(xlsx|xls|csv)$/i.test(name)) return { error: 'الخطط المقترحة تُرفع بصيغة Excel فقط (xlsx أو xls أو csv).' };
  if (typeof f.b64 !== 'string' || !/^[A-Za-z0-9+/=\s]+$/.test(f.b64.slice(0, 2000))) return { error: 'ملف غير صالح.' };
  if (f.b64.length > Math.ceil(SUGGESTED_MAX_BYTES / 3) * 4 + 8) return { error: 'حجم الملف أكبر من 2 ميجابايت.', status: 413 };
  const buf = Buffer.from(f.b64, 'base64');
  if (!buf.length) return { error: 'الملف فارغ.' };
  if (buf.length > SUGGESTED_MAX_BYTES) return { error: 'حجم الملف أكبر من 2 ميجابايت.', status: 413 };
  const kind = sniffSheet(buf);
  if (!kind) return { error: 'محتوى الملف ليس جدول Excel صالحًا (قد يكون الامتداد مغيّرًا).' };
  const ext = name.split('.').pop().toLowerCase();
  if (ext !== kind.kind) return { error: `امتداد الملف (${ext}) لا يطابق محتواه الفعلي (${kind.kind}).` };
  if (!meta.lessons) return { error: 'لم يتعرف المعاين على دروس في الملف؛ راجع الملف قبل نشره.' };
  return { meta, file: { name, mime: kind.mime, size: buf.length, data: buf } };
}

/** ما يُرسل للمعلمين في القائمة (بدون بايتات الملف ولا هوية من رفعه) */
export const publicItem = (d) => ({ id: d._id, grade: d.grade, semester: d.semester, year: d.year, subject: d.subject, title: d.title, note: d.note, lessons: d.lessons, fileName: d.fileName, size: d.size, updatedAt: d.updatedAt });
