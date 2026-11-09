// 🤖 قراءة جدول المدرسة من صورة أو PDF (أو نص جدول غير مرتب) بالذكاء الاصطناعي — على الخادم فقط.
// المفاتيح لا تصل للمتصفح. الملف يُرسل للمزوّد لحظيًا ولا يُحفظ على خادمنا.
// الخدمة معطلة افتراضيًا ولا تعمل إلا بـ CA_AI_ENABLED=true حتى لا يُستهلك رصيد أي مزوّد دون قرار صاحب المنصة.

import { aiConfig, aiStatusOf, runStructured } from '../../shared/ai/structured.js';

export const cfg = aiConfig;
export const aiStatus = aiStatusOf;

const str = { type: 'string' };
export const SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['found', 'teacher', 'school', 'subject', 'days', 'periods', 'lessons', 'warnings'],
  properties: {
    found: { type: 'boolean' },
    teacher: str, school: str, subject: str,
    days: { type: 'array', items: str },
    periods: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['no', 'kind', 'name', 'start', 'end', 'uncertain'], properties: { no: { type: 'integer' }, kind: { type: 'string', enum: ['lesson', 'break'] }, name: str, start: str, end: str, uncertain: { type: 'boolean' } } } },
    lessons: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['day', 'period', 'subject', 'grade', 'section', 'room', 'raw', 'uncertain'], properties: { day: str, period: { type: 'integer' }, subject: str, grade: str, section: str, room: str, raw: str, uncertain: { type: 'boolean' } } } },
    warnings: { type: 'array', items: str },
  },
};

export const SYSTEM = `You extract a teacher's weekly school timetable (Arabic schools, often Oman) from an image, PDF, or messy table text.
Rules:
- Return ONLY data visibly present. NEVER invent times, classes, or days. If something is unreadable, leave it empty and set "uncertain": true.
- days: Arabic day names exactly as used (الأحد، الاثنين، الثلاثاء، الأربعاء، الخميس، الجمعة، السبت) for days that appear in the timetable.
- periods: each teaching period with its number (1..12) and start/end times as "HH:MM" 24h (school hours: a time like 1:10 after noon is 13:10). Breaks (فسحة/استراحة) get kind "break", no 0. If times are not shown, use empty strings and uncertain=true.
- lessons: one item per NON-EMPTY cell: day (Arabic name), period number, and what is written: grade (e.g. "5" or "الصف الخامس"), section/شعبة (e.g. "1"), subject if written, room if written, and raw = the exact cell text. Common cell formats: "5/1" means grade 5 section 1; "٦-٢" means grade 6 section 2.
- Convert Arabic-Indic digits to Latin digits.
- teacher/school/subject: only if written on the document, else "".
- warnings: short Arabic notes about anything ambiguous (e.g. "خانة الأربعاء الحصة 3 غير واضحة").
- If no timetable is present, set found=false and explain in warnings (Arabic).`;

/** تنظيف رد النموذج: أنواع ثابتة وحدود أطوال (لا نثق بالرد كما هو) */
export function sanitize(d) {
  const s = (v, n = 80) => (typeof v === 'string' ? v.trim().slice(0, n) : typeof v === 'number' ? String(v) : '');
  const o = d && typeof d === 'object' ? d : {};
  return {
    found: o.found !== false,
    teacher: s(o.teacher), school: s(o.school, 120), subject: s(o.subject),
    days: (Array.isArray(o.days) ? o.days : []).map((x) => s(x, 20)).filter(Boolean).slice(0, 7),
    periods: (Array.isArray(o.periods) ? o.periods : []).slice(0, 24).map((p) => ({ no: Math.max(0, Math.min(12, Math.round(+p.no) || 0)), kind: p.kind === 'break' ? 'break' : 'lesson', name: s(p.name, 40), start: s(p.start, 8), end: s(p.end, 8), uncertain: !!p.uncertain })),
    lessons: (Array.isArray(o.lessons) ? o.lessons : []).slice(0, 120).map((l) => ({ day: s(l.day, 20), period: Math.max(0, Math.min(12, Math.round(+l.period) || 0)), subject: s(l.subject), grade: s(l.grade, 40), section: s(l.section, 20), room: s(l.room, 60), raw: s(l.raw, 80), uncertain: !!l.uncertain })),
    warnings: (Array.isArray(o.warnings) ? o.warnings : []).map((w) => s(w, 200)).filter(Boolean).slice(0, 6),
  };
}

export async function extractSchedule(input, { env = process.env, fetchImpl = fetch } = {}) {
  const r = await runStructured(input, {
    system: SYSTEM, schema: SCHEMA, tag: 'class-alarm extract',
    instruction: 'Extract the timetable as JSON.',
    textIntro: 'Timetable cells (rows separated by newlines, cells by " | "):',
  }, { env, fetchImpl, disabledError: 'القراءة الذكية للصور وملفات PDF غير مفعّلة على المنصة حاليًا. استخدم Excel أو Word أو الإدخال اليدوي.' });
  if (!r.ok) return r;
  const data = sanitize(r.data);
  if (!data.found && !data.lessons.length) return { ok: false, status: 422, code: 'not_found', error: data.warnings[0] || 'لم نجد جدولًا واضحًا في الملف. تأكد أن الصورة تحتوي الجدول بوضوح.' };
  return { ok: true, provider: r.provider, model: r.model, schedule: data };
}
