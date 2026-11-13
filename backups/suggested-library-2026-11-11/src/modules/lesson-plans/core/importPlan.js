// 📥 تحويل ملف الخطة (جدول خلايا من Excel/Word/CSV، أو رد القراءة الذكية لـ PDF/الصور) إلى مسودات منظمة للمراجعة.
// قواعد صارمة: لا نخمّن اسم درس، ولا نخترع عدد حصص، ولا نُسقط صفًا، ولا نغيّر الترتيب. ما لم نتأكد منه يُعلَّم «غير مؤكد».
import { parseRange, parseDate, weekNumbers, addDaysKey } from './dates.js';
import { gradeNum, GRADE_NAMES, SEMESTERS, uid } from './model.js';

const toLatin = (s) => String(s == null ? '' : s).replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x660));
const clean = (s) => toLatin(s).replace(/[‎‏‪-‮ ]/g, ' ').replace(/[ \t]+/g, ' ').replace(/\s*\n\s*/g, '\n').trim();
const bare = (s) => clean(s).replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/[ًٌٍَُِّْـ]/g, '').replace(/\s+/g, ' ').toLowerCase();
const same = (a, b) => bare(a).replace(/[()«»"'.\-–]/g, '').replace(/\s+/g, '') === bare(b).replace(/[()«»"'.\-–]/g, '').replace(/\s+/g, '');

// ---------- تعرّف رؤوس الأعمدة ----------
const HEAD = [
  ['year', /^(العام الدراسي|العام|السنه الدراسيه)$/],
  ['semester', /^(الفصل الدراسي|الفصل)$/],
  ['grade', /^(الصف|الصف الدراسي)$/],
  ['week', /^(الاسبوع|الاسابيع|رقم الاسبوع)$/],
  ['period', /^(الفتره الزمنيه|الفتره|التاريخ|الفتره الزمنيه المقرره|المده الزمنيه)$/],
  ['start', /^(بدايه الفتره الزمنيه|بدايه الفتره|من|تاريخ البدايه|البدايه)$/],
  ['end', /^(نهايه الفتره الزمنيه|نهايه الفتره|الي|تاريخ النهايه|النهايه)$/],
  ['unit', /^(الوحده|الوحدات|الوحده الدراسيه)$/],
  ['lesson', /^(الدرس|الدروس|اسم الدرس|الموضوع|عنوان الدرس|الموضوعات)$/],
  ['sessions', /^(عدد الحصص|الحصص|عدد الحصص المخصصه|عدد الحصص المخصصه للدرس|مدارس الفتره الواحده)$/],
  ['sessionsAlt', /^(مدارس الفترتين)$/],
  ['outcomes', /^(المخرجات التعليميه|المخرجات|المخرجات التعليميه \(الاساسيه\)|الاهداف|نواتج التعلم|المخرجات التعليميه الاساسيه)$/],
  ['assessment', /^(ادوات التقويم|التقويم|اساليب التقويم)$/],
  ['notes', /^(الملاحظات|ملاحظات)$/],
  ['actualDate', /^(تاريخ الحصه الفعلي)/],
  ['actualPeriod', /^(رقم الحصه الفعلي)/],
];
function headKey(cell) {
  const b = bare(cell).replace(/\(.*?(يترك|اختياري).*?\)/g, '').replace(/[:*]/g, '').trim();
  for (const [k, re] of HEAD) if (re.test(b)) return k;
  return null;
}

/** أفضل صف رؤوس (أو صفّان: «عدد الحصص» فوق «مدارس الفترة الواحدة/الفترتين») */
function findHeader(grid) {
  let best = null;
  for (let r = 0; r < Math.min(grid.length, 15); r++) {
    const map = {};
    grid[r].forEach((c, i) => { const k = headKey(c); if (k && !(k in map)) map[k] = i; });
    // صف فرعي تحته
    const sub = grid[r + 1] || [];
    sub.forEach((c, i) => { const k = headKey(c); if (k === 'sessions' || k === 'sessionsAlt') map[k] = i; });
    const score = ('lesson' in map ? 3 : 0) + Object.keys(map).length;
    if ('lesson' in map && (!best || score > best.score)) best = { r, map, score, twoRows: sub.some((c) => /الفترتين|الفتره الواحده/.test(bare(c))) };
  }
  return best;
}

/** صفوف الجدول → مسودة/مسودات (مجمعة حسب العام/الفصل/الصف إن وُجدت أعمدتها) */
export function parsePlanGrid(gridIn, ctx = {}) {
  const grid = (gridIn || []).map((r) => (Array.isArray(r) ? r : []).map((c) => (c instanceof Date ? c : typeof c === 'number' ? c : clean(c))));
  const h = findHeader(grid);
  if (!h) return { ok: false, error: 'لم نجد عمود «الدرس» أو «الدروس» في الملف. استخدم قالب الخطة أو تأكد من وجود رؤوس الأعمدة.' };
  const meta = { ...detectMeta(grid.slice(0, h.r).flat().join(' ')), ...strip(ctx) };
  const at = (row, k) => (k in h.map ? row[h.map[k]] : '');
  const rows = [];
  for (let r = h.r + (h.twoRows ? 2 : 1); r < grid.length; r++) {
    const row = grid[r];
    if (!row || row.every((c) => c === '' || c == null)) continue;
    const txt = row.map((c) => (typeof c === 'string' ? c : '')).join(' ');
    if (/توقيع (مدير|مشرف|معلم)/.test(txt) && !at(row, 'lesson')) continue;
    if (headKey(at(row, 'lesson')) === 'lesson') continue; // تكرار الرأس في صفحة جديدة
    rows.push({
      year: str(at(row, 'year')), semester: str(at(row, 'semester')), grade: str(at(row, 'grade')),
      week: str(at(row, 'week')), period: at(row, 'period'), start: at(row, 'start'), end: at(row, 'end'),
      unit: str(at(row, 'unit')), lesson: str(at(row, 'lesson')), sessions: at(row, 'sessions'), sessionsAlt: at(row, 'sessionsAlt'),
      outcomes: str(at(row, 'outcomes')), assessment: str(at(row, 'assessment')), notes: str(at(row, 'notes')), line: r + 1,
    });
  }
  if (!rows.length) return { ok: false, error: 'وجدنا رؤوس الأعمدة لكن لا توجد دروس تحتها.' };
  const hasAlt = 'sessionsAlt' in h.map;
  return buildDrafts(rows, meta, { perWeekRows: 'week' in h.map || h.twoRows, hasAlt, altLabels: hasAlt ? ['مدارس الفترة الواحدة', 'مدارس الفترتين'] : null });
}
const str = (v) => (v == null ? '' : typeof v === 'string' ? v : String(v));
const strip = (o) => Object.fromEntries(Object.entries(o || {}).filter(([, v]) => v));

/** استخراج العام/الفصل/الصف من نص الترويسة */
export function detectMeta(text) {
  const t = clean(text), b = bare(text);
  const out = {};
  const y = t.match(/(20\d{2})\s*[/\-–]\s*(20\d{2})/);
  if (y) { const [a, c] = [+y[1], +y[2]].sort(); out.year = `${a}/${c}`; }
  if (/الفصل الدراسي الاول|الفصل الدراس ي الاول|الفصل الاول/.test(b)) out.semester = SEMESTERS[0];
  else if (/الفصل الدراسي الثاني|الفصل الدراس ي الثاني|الفصل الثاني/.test(b)) out.semester = SEMESTERS[1];
  const g = b.match(/الصف\s+(الحادي عشر|الثاني عشر|[^\s/،,]+)/);
  if (g) { const n = gradeNum(g[1]); if (n) out.grade = GRADE_NAMES[n - 1]; }
  return out;
}

function normSemester(s) {
  const b = bare(s);
  if (!b) return '';
  // ملاحظة: \b في JavaScript لا يعمل مع الحروف العربية، لذلك نستخدم حدودًا صريحة
  if (/(^|[^\u0600-\u06FF\w])(الاول|1)(?![\u0600-\u06FF\w])/.test(b)) return SEMESTERS[0];
  if (/(^|[^\u0600-\u06FF\w])(الثاني|2)(?![\u0600-\u06FF\w])/.test(b)) return SEMESTERS[1];
  return clean(s);
}
function normGrade(s) { const n = gradeNum(s); return n ? GRADE_NAMES[n - 1] : clean(s); }
function normYear(s) { const m = toLatin(s).match(/(20\d{2})\D+(20\d{2}|\d{2})/); if (!m) return clean(s); const a = +m[1], b = m[2].length === 2 ? 2000 + +m[2] : +m[2]; return `${Math.min(a, b)}/${Math.max(a, b)}`; }
function unitTitle(u) {
  const t = clean(u).replace(/\n/g, ' ');
  if (!t) return '';
  if (/^(الاولى|الاولي|الثانيه|الثالثه|الرابعه|الخامسه|السادسه|الاول|الثاني|الثالث|الرابع)$/.test(bare(t))) {
    const map = { الاولى: 'الأولى', الاولي: 'الأولى', الثانيه: 'الثانية', الثالثه: 'الثالثة', الرابعه: 'الرابعة', الخامسه: 'الخامسة', السادسه: 'السادسة', الاول: 'الأولى', الثاني: 'الثانية', الثالث: 'الثالثة', الرابع: 'الرابعة' };
    return `الوحدة ${map[bare(t)]}`;
  }
  return t;
}
function num(v) {
  if (v === '' || v == null) return null;
  const n = typeof v === 'number' ? v : +toLatin(v).replace(/[^\d.]/g, '');
  return Number.isFinite(n) && n >= 1 && n <= 40 && Number.isInteger(n) ? n : null;
}

/** صفوف خام → مسودات. الصفوف المتتالية لنفس الدرس (خطة بالأسابيع أو خلايا مدمجة) تُدمج في درس واحد بفترة واحدة */
export function buildDrafts(rows, meta = {}, opts = {}) {
  const groups = new Map();
  for (const r of rows) {
    const key = [normYear(r.year || meta.year || ''), normSemester(r.semester || meta.semester || ''), normGrade(r.grade || meta.grade || '')].join('|');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  }
  const drafts = [];
  for (const [key, list] of groups) {
    const [year, semester, grade] = key.split('|');
    const issues = [];
    const units = [];
    let unit = null, last = null, lastUnitText = '';
    for (const r of list) {
      const range = rowRange(r, year);
      const lessonText = clean(r.lesson).replace(/\n/g, ' ');
      const uText = unitTitle(r.unit);
      // صف تكملة: بلا اسم درس لكنه يحمل فترة/حصص → يتبع الدرس السابق (خلية مدمجة)
      const continuation = !lessonText && !r.forceNew && last && (range || r.week || num(r.sessions) != null || r.outcomes || r.assessment);
      const sameAsLast = last && lessonText && same(lessonText, last.title) && (!uText || same(uText, lastUnitText));
      if (continuation || sameAsLast) {
        extend(last, r, range, opts);
        continue;
      }
      if (uText && (!unit || !same(uText, unit.title))) { unit = { id: uid('u'), title: uText, lessons: [] }; units.push(unit); lastUnitText = uText; }
      if (!unit) { unit = { id: uid('u'), title: '', lessons: [] }; units.push(unit); }
      if (!lessonText && !r.forceNew && !range && !r.outcomes) continue; // صف فارغ فعليًا
      const l = {
        id: uid('l'), title: lessonText, weeks: weekText(r), start: range ? range.start : '', end: range ? range.end : '',
        sessions: num(r.sessions), sessionsAlt: opts.hasAlt ? num(r.sessionsAlt) : null, rowsMerged: 1,
        outcomes: clean(r.outcomes), assessment: clean(r.assessment), notes: clean(r.notes), unsure: [], line: r.line,
      };
      if (!l.title) l.unsure.push('title');
      unit.lessons.push(l); last = l;
    }
    for (const u of units) for (const l of u.lessons) {
      if (l.sessions == null) l.unsure.push('sessions');
      if (!l.start || !l.end) l.unsure.push('dates');
      if (!u.title) l.unsure.push('unit');
      l.unsure = [...new Set(l.unsure)];
    }
    const lessons = units.flatMap((u) => u.lessons);
    if (!lessons.length) continue;
    const c = (f) => lessons.filter((l) => l.unsure.includes(f)).length;
    if (c('title')) issues.push(`${c('title')} درس بلا اسم واضح؛ اكتب الاسم كما في الملف الأصلي قبل الاعتماد.`);
    if (c('sessions')) issues.push(`${c('sessions')} درس بلا عدد حصص في الملف؛ لن نضع عددًا من عندنا — أدخله أنت (يلزم للتوزيع على الجدول).`);
    if (c('dates')) issues.push(`${c('dates')} درس لم نتمكن من قراءة فترته الزمنية؛ راجعها.`);
    if (units.some((u) => !u.title)) issues.push('بعض الدروس بلا وحدة محددة في الملف.');
    if (opts.hasAlt) issues.push('الملف يحتوي عمودين لعدد الحصص (مدارس الفترة الواحدة / الفترتين). اختر العمود المناسب لمدرستك.');
    if (!year) issues.push('لم نجد العام الدراسي في الملف؛ حدده.');
    if (!semester) issues.push('لم نجد الفصل الدراسي في الملف؛ حدده.');
    if (!grade) issues.push('لم نجد الصف في الملف؛ حدده.');
    drafts.push({ year, semester, grade, subject: meta.subject || '', units, issues, altLabels: opts.hasAlt ? opts.altLabels : null, stats: { units: units.length, lessons: lessons.length } });
  }
  if (!drafts.length) return { ok: false, error: 'لم نجد دروسًا في الملف.' };
  return { ok: true, drafts };
}

function rowRange(r, year) {
  if (r.start || r.end) {
    const a = parseDate(r.start, year) || (parseRange(r.start, year) || {}).start;
    const b = parseDate(r.end, year) || (parseRange(r.end, year) || {}).end || a;
    if (a && b && a <= b) return { start: a, end: b };
  }
  if (r.period !== '' && r.period != null) {
    const p = typeof r.period === 'number' ? (() => { const d = parseDate(r.period); return d ? { start: d, end: d } : null; })() : parseRange(r.period, year);
    if (p) return p;
  }
  return null;
}
const weekText = (r) => clean(r.week || (typeof r.period === 'string' && !parseRange(r.period) ? r.period : '')).slice(0, 120);
function extend(l, r, range, opts) {
  if (range) { if (!l.start || range.start < l.start) l.start = range.start; if (!l.end || range.end > l.end) l.end = range.end; }
  const add = (a, b) => (a == null && b == null ? null : (a || 0) + (b || 0));
  // في الخطط المكتوبة أسبوعًا بأسبوع، كل صف يحمل حصص ذلك الأسبوع فتُجمع
  if (opts.perWeekRows) { l.sessions = add(l.sessions, num(r.sessions)); if (opts.hasAlt) l.sessionsAlt = add(l.sessionsAlt, num(r.sessionsAlt)); }
  else if (l.sessions == null && num(r.sessions) != null) l.sessions = num(r.sessions);
  if (r.week) l.weeks = [l.weeks, clean(r.week)].filter(Boolean).join('، ');
  for (const k of ['outcomes', 'assessment', 'notes']) { const v = clean(r[k]); if (v && !l[k].includes(v)) l[k] = [l[k], v].filter(Boolean).join('\n'); }
  l.rowsMerged = (l.rowsMerged || 1) + 1;
}

// ---------- رد القراءة الذكية ----------
/** ai = { plans:[{ year, semester, grade, subject, session_columns, rows:[{ unit, lesson, period_text, start, end, sessions, sessions_alt, outcomes, assessment, notes, unclear:[] }] }], warnings } */
export function fromAIPlans(ai, ctx = {}) {
  if (!ai || !Array.isArray(ai.plans) || !ai.plans.length) return { ok: false, error: (ai && ai.warnings && ai.warnings[0]) || 'لم نتعرف على خطة في الملف.' };
  const drafts = [];
  for (const p of ai.plans) {
    const hasAlt = Array.isArray(p.session_columns) && p.session_columns.length > 1 || (p.rows || []).some((r) => r.sessions_alt != null && r.sessions_alt !== '');
    const rows = (p.rows || []).map((r, i) => ({
      year: p.year || '', semester: p.semester || '', grade: p.grade || '', week: r.week || '',
      period: r.start || r.end ? '' : r.period_text || '', start: r.start || '', end: r.end || '',
      unit: r.unit || '', lesson: r.unclear && r.unclear.includes('lesson') ? '' : r.lesson || '', sessions: r.sessions, sessionsAlt: r.sessions_alt,
      outcomes: r.outcomes || '', assessment: r.assessment || '', notes: r.notes || '', line: i + 1, unclear: r.unclear || [], periodText: r.period_text || '', forceNew: !!(r.unclear && r.unclear.includes('lesson')),
    }));
    const res = buildDrafts(rows, { ...strip({ subject: p.subject }), ...strip(ctx) }, { perWeekRows: !!p.per_week_rows, hasAlt, altLabels: hasAlt ? (p.session_columns && p.session_columns.length > 1 ? p.session_columns.slice(0, 2) : ['العمود الأول', 'العمود الثاني']) : null });
    if (!res.ok) continue;
    // ما علّمه النموذج «غير واضح» يبقى غير مؤكد للمراجعة
    const flat = res.drafts.flatMap((d) => d.units.flatMap((u) => u.lessons));
    for (const l of flat) {
      const src = rows.find((r) => r.line === l.line);
      if (!src) continue;
      for (const f of src.unclear) { const k = f === 'lesson' ? 'title' : f === 'period' ? 'dates' : f; if (['title', 'unit', 'sessions', 'dates', 'outcomes', 'assessment'].includes(k)) l.unsure.push(k); }
      if (!l.start && src.periodText) l.weeks = l.weeks || src.periodText.slice(0, 120);
      l.unsure = [...new Set(l.unsure)];
    }
    drafts.push(...res.drafts);
  }
  if (!drafts.length) return { ok: false, error: 'لم نتعرف على دروس في الملف.' };
  for (const w of (ai.warnings || []).slice(0, 6)) if (typeof w === 'string' && w.trim()) drafts[0].issues.push(clean(w).slice(0, 240));
  return { ok: true, drafts };
}

// ---------- الخطة المرجعية المدمجة في المنصة (semester-plans.json) — للاسترشاد وليست وثيقة رسمية ----------
// الأسبوع الأول لكل فصل في ملف المنصة (2026/2027): مأخوذ من نفس الملف (الأحد 6/9/2026 والأحد 31/1/2027)
export const OFFICIAL_YEAR = '2026/2027';
export const OFFICIAL_WEEK1 = { 'الفصل الدراسي الأول': '2026-09-06', 'الفصل الدراسي الثاني': '2027-01-31' };
export function officialDraft(data, semester, grade) {
  const src = data && data[semester] && data[semester][grade];
  if (!src) return null;
  const w1 = OFFICIAL_WEEK1[semester];
  const lessons = Object.entries(src).map(([title, v]) => {
    const weeks = weekNumbers(v.weeks || '');
    const ok = weeks.length && w1;
    return {
      id: uid('l'), title, weeks: clean(v.weeks), start: ok ? addDaysKey(w1, (Math.min(...weeks) - 1) * 7) : '', end: ok ? addDaysKey(w1, (Math.max(...weeks) - 1) * 7 + 4) : '',
      sessions: null, outcomes: '', assessment: '', notes: '', unsure: ['sessions', ...(ok ? [] : ['dates'])],
    };
  });
  return {
    year: OFFICIAL_YEAR, semester, grade, subject: 'المهارات الموسيقية', units: [{ id: uid('u'), title: '', lessons }],
    issues: ['هذه مسودة من الخطة المرجعية المدمجة في المنصة (للاسترشاد، وليست وثيقة رسمية): تحتوي الدروس والأسابيع فقط؛ طابقها مع خطة مدرستك. أدخل عدد الحصص لكل درس، ويمكنك إضافة الوحدات والمخرجات.'],
    stats: { units: 1, lessons: lessons.length }, official: true,
  };
}

/** ترحيل المسودة المعتمدة إلى خطة (اختيار عمود الحصص البديل إن طُلب) */
export function draftToUnits(draft, { useAlt = false } = {}) {
  return draft.units.map((u) => ({
    id: u.id, title: u.title,
    lessons: u.lessons.map((l) => ({ id: l.id, title: l.title, weeks: l.weeks, start: l.start, end: l.end, sessions: useAlt && draft.altLabels ? l.sessionsAlt : l.sessions, outcomes: l.outcomes, assessment: l.assessment, notes: l.notes, unsure: l.unsure.filter((f) => f !== 'title' || !l.title) })),
  }));
}
