// 🗂️ نموذج بيانات «الخطط الفصلية» — ثلاثة كيانات منفصلة بمعرّفات ثابتة، لا يعدّل أحدها الآخر:
//   1) Plan        الخطة الأصلية كما أدخلها/استوردها المعلم (+ نسخ سابقة عند الاستبدال)
//   2) Assignment  التوزيع: ربط «جزء من درس» بحصة فعلية في جدول المنبّه (يشير للحصة بمعرّفها ولا ينسخ الجدول)
//   3) LogEntry    سجل التنفيذ: ما حدث فعلًا في الحصة (لا يغيّر الخطة ولا التوزيع)
//
// Plan       = { id, year, semester, grade, subject, title, source, units:[Unit], versions:[{id, at, reason, units}], createdAt, updatedAt }
// Unit       = { id, title, lessons:[Lesson] }
// Lesson     = { id, title, weeks, start, end, sessions(null=غير محدد), outcomes, assessment, notes, unsure:[حقول غير مؤكدة] }
// Assignment = { id, planId, lessonId, part, kind:'session'|'completion', classKey, grade, section, profileId, dateKey, slotKey,
//                replaces, alertPlan, snapshot:{lessonTitle, unitTitle, sessions}, history:[{at, from, to, reason}], createdAt }
// LogEntry   = { id, assignmentId, status, executedOn, note, reason, at }

export const STATUSES = [
  { id: 'done', label: 'تم التنفيذ', tone: 'ok' },
  { id: 'partial', label: 'نُفذ جزء من الدرس', tone: 'warn' },
  { id: 'postponed', label: 'مؤجلة', tone: 'warn' },
  { id: 'cancelled', label: 'ملغاة', tone: 'bad' },
  { id: 'missed', label: 'لم تُنفذ', tone: 'bad' },
  { id: 'needs-completion', label: 'تحتاج إلى استكمال', tone: 'warn' },
];
export const STATUS_LABEL = { scheduled: 'مجدولة', awaiting: 'بانتظار التسجيل', ...Object.fromEntries(STATUSES.map((s) => [s.id, s.label])) };
export const SEMESTERS = ['الفصل الدراسي الأول', 'الفصل الدراسي الثاني'];

let seq = 0;
export const uid = (p = 'x') => `${p}${Date.now().toString(36)}${(seq++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const str = (v, n = 200) => (typeof v === 'string' ? v.trim().slice(0, n) : typeof v === 'number' && Number.isFinite(v) ? String(v) : '');
const dk = (v) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : '');

// ---------- الصفوف والشعب: مطابقة «الصف العاشر» بـ «الصف 10» و«10» ----------
const GRADE_WORDS = ['الاول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس', 'السابع', 'الثامن', 'التاسع', 'العاشر', 'الحادي عشر', 'الثاني عشر'];
const bare = (s) => String(s || '').replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x660)).replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/\s+/g, ' ').trim();
export function gradeNum(text) {
  const b = bare(text).replace(/^الصف\s*/, '').replace(/\s*(الاساسي|اساسي)$/, '');
  const m = b.match(/^(\d{1,2})\b/);
  if (m && +m[1] >= 1 && +m[1] <= 12) return +m[1];
  for (let i = GRADE_WORDS.length - 1; i >= 0; i--) { const w = GRADE_WORDS[i]; if (b === w || b === w.replace(/^ال/, '') || b.startsWith(`${w} `)) return i + 1; }
  return 0;
}
export const GRADE_NAMES = ['الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس', 'السابع', 'الثامن', 'التاسع', 'العاشر', 'الحادي عشر', 'الثاني عشر'].map((g) => `الصف ${g}`);
export const normSection = (s) => bare(s).replace(/^(الشعبه|شعبه|فصل)\s*/, '').toLowerCase();
export function classKeyOf(grade, section) {
  const n = gradeNum(grade);
  return `${n || bare(grade).toLowerCase()}|${normSection(section)}`;
}
export function classLabelOf(grade, section) {
  const n = gradeNum(grade);
  const g = n ? GRADE_NAMES[n - 1] : grade || 'بدون صف';
  return section ? `${g} – الشعبة ${String(section).replace(/^(الشعبة|شعبة)\s*/, '')}` : g;
}

// ---------- التطبيع (حماية من البيانات التالفة) ----------
function normLesson(l) {
  const o = l && typeof l === 'object' ? l : {};
  const n = Math.round(+o.sessions);
  return {
    id: str(o.id, 40) || uid('l'), title: str(o.title, 200), weeks: str(o.weeks, 120),
    start: dk(o.start), end: dk(o.end), sessions: Number.isFinite(n) && n >= 1 && n <= 40 ? n : null,
    outcomes: str(o.outcomes, 3000), assessment: str(o.assessment, 1500), notes: str(o.notes, 1500),
    unsure: Array.isArray(o.unsure) ? o.unsure.filter((x) => typeof x === 'string').slice(0, 10) : [],
  };
}
function normUnits(units) {
  const seen = new Set();
  return (Array.isArray(units) ? units : []).slice(0, 40).map((u) => ({
    id: str(u && u.id, 40) || uid('u'), title: str(u && u.title, 200),
    lessons: (Array.isArray(u && u.lessons) ? u.lessons : []).slice(0, 80).map(normLesson).map((l) => { while (seen.has(l.id)) l.id = uid('l'); seen.add(l.id); return l; }),
  }));
}
export function normalizePlan(p) {
  const o = p && typeof p === 'object' ? p : {};
  return {
    id: str(o.id, 40) || uid('p'), year: str(o.year, 20), semester: str(o.semester, 40), grade: str(o.grade, 40), subject: str(o.subject, 80),
    title: str(o.title, 160),
    source: o.source && typeof o.source === 'object' ? { name: str(o.source.name, 200), kind: str(o.source.kind, 20), official: o.source.official === true, importedAt: +o.source.importedAt || 0 } : { name: '', kind: 'manual', official: false, importedAt: 0 },
    units: normUnits(o.units),
    versions: (Array.isArray(o.versions) ? o.versions : []).slice(-10).map((v) => ({ id: str(v.id, 40) || uid('v'), at: +v.at || 0, reason: str(v.reason, 120), units: normUnits(v.units) })),
    createdAt: +o.createdAt || Date.now(), updatedAt: +o.updatedAt || Date.now(),
  };
}
const STATUS_IDS = new Set(STATUSES.map((s) => s.id));
function normAssignment(a) {
  const o = a && typeof a === 'object' ? a : {};
  if (!dk(o.dateKey) || !str(o.slotKey, 60) || !str(o.planId, 40) || !str(o.lessonId, 40)) return null;
  const pos = (x) => (x && dk(x.dateKey) ? { dateKey: x.dateKey, slotKey: str(x.slotKey, 60) } : null);
  return {
    id: str(o.id, 40) || uid('a'), planId: o.planId, lessonId: o.lessonId,
    part: Math.max(1, Math.min(40, Math.round(+o.part) || 1)), kind: o.kind === 'completion' ? 'completion' : 'session',
    classKey: str(o.classKey, 80), grade: str(o.grade, 60), section: str(o.section, 30), profileId: str(o.profileId, 40),
    dateKey: o.dateKey, slotKey: o.slotKey, replaces: str(o.replaces, 40) || null,
    alertPlan: o.alertPlan && typeof o.alertPlan === 'object' ? o.alertPlan : null,
    snapshot: { lessonTitle: str(o.snapshot && o.snapshot.lessonTitle, 200), unitTitle: str(o.snapshot && o.snapshot.unitTitle, 200), sessions: +(o.snapshot && o.snapshot.sessions) || null },
    history: (Array.isArray(o.history) ? o.history : []).slice(-20).map((h) => ({ at: +h.at || 0, from: pos(h.from), to: pos(h.to), reason: str(h.reason, 300) })),
    createdAt: +o.createdAt || Date.now(),
  };
}
function normLog(e) {
  const o = e && typeof e === 'object' ? e : {};
  if (!str(o.assignmentId, 40) || !STATUS_IDS.has(o.status)) return null;
  return { id: str(o.id, 40) || uid('g'), assignmentId: o.assignmentId, status: o.status, executedOn: dk(o.executedOn), note: str(o.note, 1000), reason: str(o.reason, 300), at: +o.at || Date.now() };
}

export function emptyWorkspace() { return { version: 1, plans: [], assignments: [], log: [], updatedAt: 0 }; }
export function normalizeWorkspace(w) {
  const o = w && typeof w === 'object' ? w : {};
  return {
    version: 1,
    plans: (Array.isArray(o.plans) ? o.plans : []).slice(0, 60).map(normalizePlan),
    assignments: (Array.isArray(o.assignments) ? o.assignments : []).slice(0, 5000).map(normAssignment).filter(Boolean),
    log: (Array.isArray(o.log) ? o.log : []).slice(0, 10000).map(normLog).filter(Boolean),
    updatedAt: +o.updatedAt || 0,
  };
}

export const allLessons = (plan) => plan.units.flatMap((u) => u.lessons.map((l) => ({ ...l, unitId: u.id, unitTitle: u.title })));
export function findLesson(ws, planId, lessonId) {
  const p = ws.plans.find((x) => x.id === planId);
  if (!p) return null;
  for (const u of p.units) { const l = u.lessons.find((x) => x.id === lessonId); if (l) return { plan: p, unit: u, lesson: l }; }
  return null;
}
export const planLabel = (p) => p.title || [p.grade, p.semester, p.year].filter(Boolean).join(' – ') || 'خطة بدون عنوان';
