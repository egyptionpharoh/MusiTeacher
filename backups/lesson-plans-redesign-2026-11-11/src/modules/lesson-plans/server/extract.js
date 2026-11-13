// 🤖 قراءة الخطة الفصلية من PDF أو صورة ممسوحة (أو جدول غير مرتب) — على الخادم عبر الاستدعاء الموحّد للذكاء الاصطناعي.
// المطلوب من النموذج نسخ ما هو مكتوب فقط: لا تخمين لأسماء الدروس، ولا عدد حصص من عنده، ولا إعادة ترتيب، ولا إسقاط صفوف.
import { runStructured } from '../../shared/ai/structured.js';

const S = { type: 'string' };
const N = { type: ['integer', 'null'] };
export const PLAN_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['plans', 'warnings'],
  properties: {
    plans: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['year', 'semester', 'grade', 'subject', 'session_columns', 'per_week_rows', 'rows'],
        properties: {
          year: S, semester: S, grade: S, subject: S,
          session_columns: { type: 'array', items: S },
          per_week_rows: { type: 'boolean' },
          rows: {
            type: 'array',
            items: {
              type: 'object', additionalProperties: false,
              required: ['week', 'unit', 'lesson', 'period_text', 'start', 'end', 'sessions', 'sessions_alt', 'outcomes', 'assessment', 'notes', 'unclear'],
              properties: { week: S, unit: S, lesson: S, period_text: S, start: S, end: S, sessions: N, sessions_alt: N, outcomes: S, assessment: S, notes: S, unclear: { type: 'array', items: { type: 'string', enum: ['lesson', 'unit', 'sessions', 'period', 'outcomes', 'assessment'] } } },
            },
          },
        },
      },
    },
    warnings: { type: 'array', items: S },
  },
};

export const PLAN_SYSTEM = `You transcribe a teacher's semester plan (Arabic, Omani Ministry of Education style "الخطة الفصلية") into structured JSON.
STRICT RULES:
- Transcribe ONLY what is visibly written. Never invent, summarize, translate, reorder, merge or drop lessons.
- One "plans" item per (semester, grade) table found (e.g. a file may contain الفصل الدراسي الأول and الفصل الدراسي الثاني → two plans).
- year: as written, normalized "YYYY/YYYY" (e.g. "2026/2027"). semester: "الفصل الدراسي الأول" or "الفصل الدراسي الثاني". grade: e.g. "الصف الخامس". subject: as written (e.g. "الفنون الموسيقية").
- rows: keep the original top-to-bottom order. If the table is written week-by-week (one row per week, a lesson repeated over several rows), output one row per week and set per_week_rows=true. Otherwise output one row per lesson and set per_week_rows=false.
- When a lesson cell spans several date rows (merged cell), output ONE row for that lesson with period_text containing all its dates, start = first date, end = last date.
- unit: the unit cell that applies to the row ("الوحدة الأولى" etc.). If the merged unit cell boundaries are unclear, give your reading and add "unit" to unclear.
- period_text: the date text exactly as written. start/end: ISO "YYYY-MM-DD" ONLY if you can read them with certainty, else "".
- sessions: the number in "عدد الحصص" exactly as written; null if empty or unreadable (add "sessions" to unclear). If there are two session columns (e.g. مدارس الفترة الواحدة / مدارس الفترتين) put the first in sessions, the second in sessions_alt, and list both column titles in session_columns.
- outcomes, assessment (أدوات التقويم), notes (الملاحظات): transcribe; join multiple items with " - ".
- If a lesson name is unreadable, set lesson to "" and add "lesson" to unclear (still output the row).
- Ignore signature lines (توقيع ...) and form headers.
- Convert Arabic-Indic digits to Latin digits. Fix nothing else.
- warnings: short Arabic notes about anything ambiguous or missing.`;

export async function extractPlan(input, { env = process.env, fetchImpl = fetch } = {}) {
  const r = await runStructured(input, {
    system: PLAN_SYSTEM, schema: PLAN_SCHEMA, tag: 'lesson-plans extract', maxTokens: 16000,
    instruction: 'Transcribe the semester plan as JSON.',
    textIntro: 'Plan table cells (rows separated by newlines, cells by " | "):',
  }, { env, fetchImpl, disabledError: 'قراءة ملفات PDF والصور تحتاج «القراءة الذكية»، وهي غير مفعّلة على المنصة حاليًا. استخدم ملف Excel أو Word (جدول) أو قالب المنصة.' });
  if (!r.ok) return r;
  const d = r.data && typeof r.data === 'object' ? r.data : {};
  const s = (v, n) => (typeof v === 'string' ? v.slice(0, n) : '');
  const plans = (Array.isArray(d.plans) ? d.plans : []).slice(0, 6).map((p) => ({
    year: s(p.year, 20), semester: s(p.semester, 40), grade: s(p.grade, 40), subject: s(p.subject, 80),
    session_columns: (Array.isArray(p.session_columns) ? p.session_columns : []).map((x) => s(x, 60)).slice(0, 2), per_week_rows: p.per_week_rows === true,
    rows: (Array.isArray(p.rows) ? p.rows : []).slice(0, 120).map((x) => ({
      week: s(x.week, 40), unit: s(x.unit, 120), lesson: s(x.lesson, 200), period_text: s(x.period_text, 200), start: s(x.start, 10), end: s(x.end, 10),
      sessions: Number.isInteger(x.sessions) ? x.sessions : null, sessions_alt: Number.isInteger(x.sessions_alt) ? x.sessions_alt : null,
      outcomes: s(x.outcomes, 3000), assessment: s(x.assessment, 1500), notes: s(x.notes, 1500), unclear: (Array.isArray(x.unclear) ? x.unclear : []).filter((u) => typeof u === 'string').slice(0, 6),
    })),
  }));
  if (!plans.length || !plans.some((p) => p.rows.length)) return { ok: false, status: 422, code: 'not_found', error: (Array.isArray(d.warnings) && d.warnings[0]) || 'لم نجد خطة فصلية واضحة في الملف.' };
  return { ok: true, provider: r.provider, model: r.model, result: { plans, warnings: (Array.isArray(d.warnings) ? d.warnings : []).map((w) => s(w, 240)).slice(0, 8) } };
}
