// اختبارات «الخطط الفصلية» وتكاملها مع «منبّه الحصص»:  node --test tests/lesson-plans.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePlanGrid, fromAIPlans, officialDraft, draftToUnits, detectMeta } from '../src/modules/lesson-plans/core/importPlan.js';
import { normalizeWorkspace, normalizePlan, emptyWorkspace, gradeNum, classKeyOf, uid } from '../src/modules/lesson-plans/core/model.js';
import { replacePlanUnits, restoreVersion } from '../src/modules/lesson-plans/core/merge.js';
import { classesFromProfile, occurrences, suggestDistribution, validateSlot, makeAssignment, lessonState, conflicts, alternativeSlots } from '../src/modules/lesson-plans/core/track.js';
import { linksForDay, eveningDigest } from '../src/modules/lesson-plans/core/links.js';
import { emptyProfile, normalizeProfile, defaultSettings } from '../src/modules/class-alarm/core/model.js';
import { alertsForDay } from '../src/modules/class-alarm/core/schedule.js';
import { zonedToMs } from '../src/modules/class-alarm/core/time.js';

// جدول الصف العاشر كما في ملف Word المرفق (صورة) — منقول يدويًا كملف اختبار Excel بصيغة الأسابيع وعمودي الحصص
const GRADE10_GRID = [
  ['الصف العاشر', 'الفصل الدراسي الأول'],
  ['الأسبوع', 'التاريخ', 'الوحدة', 'الدرس', 'عدد الحصص', ''],
  ['', '', '', '', 'مدارس الفترة الواحدة', 'مدارس الفترتين'],
  ['الأول', '٢٠٢٥/٩/٤ – ٨/٣١', 'الأولى', 'مفتاح (فا) الخط الرابع', '١', '١'],
  ['الثاني', '٢٠٢٥/٩/١١-٧', 'الأولى', 'مفتاح (فا) الخط الرابع', '١', '١'],
  ['الثالث', '٢٠٢٥/٩/١٨-١٤', 'الأولى', 'سلم (فا) الكبير وسلم (ري) الصغير الهارموني', '١', '١'],
  ['الرابع', '٢٠٢٥/٩/٢٥-٢١', 'الأولى', 'سلم (فا) الكبير وسلم (ري) الصغير الهارموني', '١', '١'],
  ['الخامس', '٢٠٢٥/١٠/٢-٩/٢٨', 'الأولى', 'التآلف الكبير والتآلف الصغير', '١', '١'],
  ['السادس', '٢٠٢٥/١٠/٩-٥', 'الأولى', 'التآلف الكبير والتآلف الصغير', '١', '١'],
  ['السابع', '٢٠٢٥/١٠/١٦-١٢', 'الأولى', 'التآلف الكبير والتآلف الصغير', '١', '١'],
  ['الثامن', '٢٠٢٥/١٠/٢٣-١٩', 'الثانية', 'فن المولد', '١', '١'],
  ['التاسع', '٢٠٢٥/١٠/٣٠-٢٦', 'الثانية', 'نشيد (يا نبي سلام عليك)', '١', '١'],
];

test('استيراد خطة بالأسابيع (الصف العاشر): دمج الأسابيع في دروس، عمودا الحصص، الوحدات، الترتيب', () => {
  const r = parsePlanGrid(GRADE10_GRID, { year: '2025/2026' });
  assert.equal(r.ok, true, r.error);
  const d = r.drafts[0];
  assert.equal(d.grade, 'الصف العاشر'); assert.equal(d.semester, 'الفصل الدراسي الأول');
  assert.deepEqual(d.units.map((u) => u.title), ['الوحدة الأولى', 'الوحدة الثانية']);
  const ls = d.units.flatMap((u) => u.lessons);
  assert.deepEqual(ls.map((l) => l.title), ['مفتاح (فا) الخط الرابع', 'سلم (فا) الكبير وسلم (ري) الصغير الهارموني', 'التآلف الكبير والتآلف الصغير', 'فن المولد', 'نشيد (يا نبي سلام عليك)']);
  assert.deepEqual([ls[0].start, ls[0].end, ls[0].sessions], ['2025-08-31', '2025-09-11', 2]);
  assert.deepEqual([ls[2].start, ls[2].end, ls[2].sessions, ls[2].sessionsAlt], ['2025-09-28', '2025-10-16', 3, 3]);
  assert.ok(d.altLabels, 'يُطلب من المعلم اختيار عمود الحصص');
  assert.ok(ls.every((l) => l.unsure.length === 0), JSON.stringify(ls.map((l) => l.unsure)));
});

test('استيراد من قالب المنصة: عدة خطط في ملف واحد، وخلايا ناقصة تبقى غير مؤكدة دون اختراع', () => {
  const grid = [
    ['العام الدراسي', 'الفصل الدراسي', 'الصف', 'الوحدة', 'اسم الدرس', 'بداية الفترة الزمنية', 'نهاية الفترة الزمنية', 'عدد الحصص المخصصة للدرس', 'المخرجات التعليمية', 'أدوات التقويم', 'الملاحظات', 'تاريخ الحصة الفعلي (يُترك فارغًا)', 'رقم الحصة الفعلي (يُترك فارغًا)'],
    ['2026/2027', 'الأول', 'الخامس', 'الأولى', 'نشيد (نهضة متجددة)', '2026-09-06', '2026-09-17', 2, 'يغني النشيد', 'إنشاد فردي', '', '', ''],
    ['2026/2027', 'الأول', 'الخامس', 'الأولى', 'الميزان الرباعي', '20/9/2026', '1/10/2026', '', 'يتعرف الميزان', '', '', '', ''],
    ['2026/2027', 'الأول', 'الخامس', 'الأولى', '', '4/10/2026', '22/10/2026', 3, '', '', '', '', ''],
    ['2026/2027', 'الأول', 'السادس', 'الأولى', 'الأزمنة الأساسية وتقسيماتها', '2026-09-06', '2026-09-17', 2, '', '', '', '', ''],
  ];
  const r = parsePlanGrid(grid);
  assert.equal(r.ok, true, r.error);
  assert.equal(r.drafts.length, 2, 'خطة مستقلة لكل صف');
  const g5 = r.drafts.find((d) => d.grade === 'الصف الخامس');
  const ls = g5.units[0].lessons;
  assert.equal(ls.length, 2, 'الصف بلا اسم درس ولكن بفترة وحصص = تكملة للدرس السابق (خلية مدمجة)');
  assert.equal(ls[1].sessions, 3, 'لا نجمع حصص التكملة إلا في خطط الأسابيع');
  assert.equal(ls[1].end, '2026-10-22');
  const g5b = parsePlanGrid([grid[0], grid[1], ['2026/2027', 'الأول', 'الخامس', 'الأولى', 'الميزان الرباعي', '20/9/2026', '1/10/2026', '', '', '', '', '', '']]).drafts[0];
  assert.ok(g5b.units[0].lessons[1].unsure.includes('sessions'), 'عدد حصص فارغ يبقى فارغًا وغير مؤكد');
  assert.equal(g5b.units[0].lessons[1].sessions, null);
  assert.ok(g5b.issues.some((i) => /لن نضع عددًا من عندنا/.test(i)));
});

test('الترويسة: العام والفصل والصف من نص نموذج الوزارة', () => {
  const m = detectMeta('الفصل الدراس ي الأول / الصف الخامس الخطة الفصلية لمادة الفنون الموسيقية للعام الدراسي 2027 / 2026م');
  assert.deepEqual(m, { year: '2026/2027', semester: 'الفصل الدراسي الأول', grade: 'الصف الخامس' });
  assert.equal(gradeNum('الصف العاشر'), 10); assert.equal(gradeNum('10'), 10); assert.equal(gradeNum('الحادي عشر'), 11);
  assert.equal(classKeyOf('الصف العاشر', '1'), classKeyOf('الصف 10', 'الشعبة 1'));
});

test('رد القراءة الذكية: درس غير مقروء لا يُسقط ولا يُدمج، ويبقى غير مؤكد', () => {
  const r = fromAIPlans({ plans: [{ year: '2026/2027', semester: 'الفصل الدراسي الأول', grade: 'الصف الخامس', subject: 'الفنون الموسيقية', session_columns: ['عدد الحصص'], per_week_rows: false,
    rows: [{ unit: 'الوحدة الأولى', lesson: 'نشيد (نهضة متجددة)', period_text: '6 – 10 / 9/2026 ، 13- 17 / 9/ 2026', start: '2026-09-06', end: '2026-09-17', sessions: 2, sessions_alt: null, outcomes: 'يغني النشيد', assessment: 'إنشاد فردي', notes: '', unclear: [] },
      { unit: 'الوحدة الأولى', lesson: '', period_text: '20 -24 / 9/ 2026', start: '', end: '', sessions: null, sessions_alt: null, outcomes: '', assessment: '', notes: '', unclear: ['lesson', 'sessions'] },
      { unit: '', lesson: 'العلامة الإيقاعية الروند', period_text: '4-8/10/2026 ، 18-22/10/2026', start: '2026-10-04', end: '2026-10-22', sessions: 3, sessions_alt: null, outcomes: '', assessment: '', notes: '', unclear: ['unit'] }] }], warnings: ['الوحدة غير واضحة لدرس الروند'] });
  assert.equal(r.ok, true);
  const ls = r.drafts[0].units.flatMap((u) => u.lessons);
  assert.equal(ls.length, 3);
  assert.equal(ls[1].title, ''); assert.ok(ls[1].unsure.includes('title')); assert.ok(ls[1].unsure.includes('sessions'));
  assert.equal(ls[1].start, '2026-09-20', 'الفترة تُقرأ من نصها إن لم يرسل النموذج تاريخًا');
  assert.ok(ls[2].unsure.includes('unit'));
  assert.ok(r.drafts[0].issues.some((i) => /الروند/.test(i)));
});

test('الخطة الرسمية المدمجة نقطة بداية: الأسابيع → تواريخ، والحصص فارغة', () => {
  const data = { 'الفصل الدراسي الأول': { 'الصف العاشر': { 'مفتاح ( فا ) الخط الرابع': { weeks: 'الأول، الثاني' }, 'فن المولد': { weeks: 'السابع' } } } };
  const d = officialDraft(data, 'الفصل الدراسي الأول', 'الصف العاشر');
  assert.deepEqual([d.units[0].lessons[0].start, d.units[0].lessons[0].end], ['2026-09-06', '2026-09-17']);
  assert.deepEqual([d.units[0].lessons[1].start, d.units[0].lessons[1].end], ['2026-10-18', '2026-10-22']);
  assert.equal(d.units[0].lessons[0].sessions, null);
});

// ---------- التكامل مع جدول المنبّه ----------
const TZ = 'Asia/Muscat', SUN = '2026-11-08';
function schedule() {
  const p = emptyProfile({ teacher: 'أ. حسين', school: 'مدرسة الاختبار', subject: 'المهارات الموسيقية' }, new Date('2026-11-08T03:00:00Z'));
  p.lessons = { 0: { p1: { grade: 'الصف الخامس', section: '1' }, p3: { grade: 'الصف الخامس', section: '2' } }, 3: { p3: { grade: 'الصف الخامس', section: '1' } }, 1: { p2: { grade: 'الصف 5', section: '1' } } };
  return normalizeProfile(p);
}
function planWS() {
  const plan = normalizePlan({ id: 'P1', year: '2026/2027', semester: 'الفصل الدراسي الأول', grade: 'الصف الخامس', units: [{ id: 'U1', title: 'الوحدة الأولى', lessons: [
    { id: 'L1', title: 'أساسيات الإيقاع الموسيقي', start: '2026-11-08', end: '2026-11-19', sessions: 2 },
    { id: 'L2', title: 'آلة الأكورديون', start: '2026-11-15', end: '2026-11-26', sessions: 2 },
    { id: 'L3', title: 'درس بلا حصص', sessions: null }] }] });
  return normalizeWorkspace({ plans: [plan] });
}

test('قراءة صفوف وشعب المعلم من جدول المنبّه دون نسخه', () => {
  const cls = classesFromProfile(schedule());
  assert.deepEqual(cls.map((c) => c.label), ['الصف الخامس – الشعبة 1', 'الصف الخامس – الشعبة 2']);
  assert.equal(cls[0].weekly.length, 3, '«الصف 5» و«الصف الخامس» نفس الصف');
  const occ = occurrences(schedule(), cls[0].classKey, SUN, '2026-11-14');
  assert.deepEqual(occ.map((o) => `${o.dateKey}|${o.slotKey}`), ['2026-11-08|p1', '2026-11-09|p2', '2026-11-11|p3']);
});

test('ربط يدوي بحصة محددة + حصتان للدرس + منع الربط بحصة ليست للصف أو محجوزة', () => {
  const prof = schedule(); let ws = planWS();
  const cls = classesFromProfile(prof)[0];
  const plan = ws.plans[0], L1 = plan.units[0].lessons[0];
  assert.equal(validateSlot(ws, prof, cls.classKey, SUN, 'p3'), 'هذه الحصة ليست لهذا الصف/الشعبة في جدولك');
  assert.equal(validateSlot(ws, prof, cls.classKey, SUN, 'p9'), 'الحصة لم تعد موجودة في الجدول');
  assert.equal(validateSlot(ws, prof, cls.classKey, SUN, 'p1'), null);
  const a1 = makeAssignment({ plan, lesson: L1, unitTitle: 'الوحدة الأولى', cls, profile: prof, dateKey: SUN, slotKey: 'p1', part: 1 });
  const a2 = makeAssignment({ plan, lesson: L1, unitTitle: 'الوحدة الأولى', cls, profile: prof, dateKey: '2026-11-11', slotKey: 'p3', part: 2 });
  ws = { ...ws, assignments: [a1, a2] };
  assert.match(validateSlot(ws, prof, cls.classKey, SUN, 'p1'), /مرتبطة بالفعل/);
  const st = lessonState(ws, 'P1', L1, cls.classKey, SUN);
  assert.equal(st.needsSlot.length, 0); assert.equal(st.complete, false);
});

test('التوزيع المقترح: بالترتيب، داخل الفترة، لا يتجاوز الحصص، لا يستخدم حصة محجوزة، ويتخطى درسًا بلا حصص', () => {
  const prof = schedule(); const ws = planWS();
  const cls = classesFromProfile(prof)[0];
  const s = suggestDistribution(ws, ws.plans[0], prof, cls, { fromKey: SUN });
  const ids = s.suggestions.map((x) => `${x.lesson.id}#${x.part}@${x.slot.dateKey}|${x.slot.slotKey}`);
  assert.deepEqual(ids, ['L1#1@2026-11-08|p1', 'L1#2@2026-11-09|p2', 'L2#1@2026-11-15|p1', 'L2#2@2026-11-16|p2']);
  assert.ok(s.skipped.some((k) => k.lesson.id === 'L3' && /غير محدد/.test(k.reason)));
  assert.equal(s.suggestions.filter((x) => x.lesson.id === 'L1').length, 2, 'لا يتجاوز عدد الحصص');
});

test('سجل التنفيذ: منفذة + مؤجلة + موعد بديل؛ الدرس لا يكتمل قبل كل حصصه؛ الخطة لا تتغير', () => {
  const prof = schedule(); let ws = planWS();
  const cls = classesFromProfile(prof)[0];
  const plan = ws.plans[0], L1 = plan.units[0].lessons[0];
  const before = JSON.stringify(ws.plans);
  const a1 = makeAssignment({ plan, lesson: L1, cls, profile: prof, dateKey: SUN, slotKey: 'p1', part: 1 });
  const a2 = makeAssignment({ plan, lesson: L1, cls, profile: prof, dateKey: '2026-11-09', slotKey: 'p2', part: 2 });
  ws = { ...ws, assignments: [a1, a2], log: [{ id: 'g1', assignmentId: a1.id, status: 'done', executedOn: SUN, at: 1 }, { id: 'g2', assignmentId: a2.id, status: 'postponed', reason: 'نشاط مدرسي', at: 2 }] };
  let st = lessonState(ws, 'P1', L1, cls.classKey, '2026-11-10');
  assert.equal(st.doneParts, 1); assert.equal(st.complete, false); assert.equal(st.postponed.length, 1);
  const alt = alternativeSlots(ws, prof, cls.classKey, '2026-11-10');
  assert.deepEqual([alt[0].dateKey, alt[0].slotKey], ['2026-11-11', 'p3'], 'البديل: الأربعاء الحصة الثالثة');
  const a3 = { ...makeAssignment({ plan, lesson: L1, cls, profile: prof, dateKey: '2026-11-11', slotKey: 'p3', part: 2, replaces: a2.id }) };
  ws = { ...ws, assignments: [...ws.assignments, a3] };
  st = lessonState(ws, 'P1', L1, cls.classKey, '2026-11-10');
  assert.equal(st.postponed.length, 0); assert.equal(st.complete, false);
  ws = { ...ws, log: [...ws.log, { id: 'g3', assignmentId: a3.id, status: 'done', at: 3 }] };
  st = lessonState(ws, 'P1', L1, cls.classKey, '2026-11-12');
  assert.equal(st.complete, true);
  assert.equal(JSON.stringify(ws.plans), before, 'الخطة الأصلية لم تتغير');
});

test('تنفيذ جزئي يحتاج حصة استكمال قبل اكتمال الدرس', () => {
  const prof = schedule(); let ws = planWS();
  const cls = classesFromProfile(prof)[0];
  const plan = ws.plans[0], L2 = plan.units[0].lessons[1];
  const a = [1, 2].map((p, i) => makeAssignment({ plan, lesson: L2, cls, profile: prof, dateKey: ['2026-11-15', '2026-11-16'][i], slotKey: ['p1', 'p2'][i], part: p }));
  ws = { ...ws, assignments: a, log: [{ id: 'x1', assignmentId: a[0].id, status: 'done', at: 1 }, { id: 'x2', assignmentId: a[1].id, status: 'partial', at: 2 }] };
  let st = lessonState(ws, 'P1', L2, cls.classKey, '2026-11-17');
  assert.equal(st.pendingCompletion, 1); assert.equal(st.complete, false);
  const c = makeAssignment({ plan, lesson: L2, cls, profile: prof, dateKey: '2026-11-18', slotKey: 'p3', part: 2, kind: 'completion' });
  ws = { ...ws, assignments: [...ws.assignments, c], log: [...ws.log, { id: 'x3', assignmentId: c.id, status: 'done', at: 3 }] };
  st = lessonState(ws, 'P1', L2, cls.classKey, '2026-11-19');
  assert.equal(st.complete, true);
});

test('تعديل جدول المنبّه: ينعكس في الوقت، والإلغاء يظهر تعارضًا دون حذف السجل', () => {
  let prof = schedule(); const ws0 = planWS();
  const cls = classesFromProfile(prof)[0];
  const plan = ws0.plans[0], L1 = plan.units[0].lessons[0];
  const a = makeAssignment({ plan, lesson: L1, cls, profile: prof, dateKey: '2026-11-15', slotKey: 'p1', part: 1 });
  const ws = { ...ws0, assignments: [a], log: [{ id: 'old', assignmentId: 'past', status: 'done', at: 1 }] };
  prof = normalizeProfile({ ...prof, overrides: { '2026-11-15': { changed: { p1: { start: '08:00', end: '08:40' } } } } });
  const link = linksForDay(ws, prof, '2026-11-15', SUN).get('p1');
  assert.equal(link.lessonTitle, 'أساسيات الإيقاع الموسيقي');
  const al = alertsForDay(prof, defaultSettings(), '2026-11-15', undefined, { links: linksForDay(ws, prof, '2026-11-15', SUN) });
  assert.equal(al.find((x) => x.eventKey === 'p1').due, zonedToMs('2026-11-15', '07:50', TZ), 'التنبيه يتبع الوقت المعدل في المنبّه');
  assert.match(al.find((x) => x.eventKey === 'p1').body, /الدرس: أساسيات الإيقاع الموسيقي \(الحصة 1 من 2\)/);
  const cancelled = normalizeProfile({ ...prof, overrides: { '2026-11-15': { cancelled: { p1: true } } } });
  const c = conflicts(ws, cancelled, SUN);
  assert.equal(c.length, 1); assert.match(c[0].reason, /ملغاة/);
  assert.equal(ws.log.length, 1, 'السجل لم يُمس');
  assert.equal(alertsForDay(cancelled, defaultSettings(), '2026-11-15').filter((x) => x.eventKey === 'p1').length, 0, 'لا تنبيه لحصة ملغاة');
});

test('المنبّه يعمل بلا خطط، والحصة المؤجلة لا يظهر درسها ولا خطة تنبيهها', () => {
  const prof = schedule();
  assert.equal(alertsForDay(prof, defaultSettings(), SUN).length, 4);
  assert.equal(linksForDay(null, prof, SUN, SUN).size, 0);
  let ws = planWS(); const cls = classesFromProfile(prof)[0];
  const a = { ...makeAssignment({ plan: ws.plans[0], lesson: ws.plans[0].units[0].lessons[0], cls, profile: prof, dateKey: SUN, slotKey: 'p1', part: 1 }), alertPlan: { before: [{ min: 60, tone: 'bell' }], start: { on: false, tone: 'start' }, end: { on: false, min: 5, tone: 'soft' } } };
  ws = { ...ws, assignments: [a] };
  let al = alertsForDay(prof, defaultSettings(), SUN, undefined, { links: linksForDay(ws, prof, SUN, SUN) }).filter((x) => x.eventKey === 'p1');
  assert.deepEqual(al.map((x) => x.min), [60], 'خطة تنبيه خاصة بالحصة المرتبطة (قبل 60 دقيقة)');
  ws = { ...ws, log: [{ id: 'p', assignmentId: a.id, status: 'postponed', at: 1 }] };
  al = alertsForDay(prof, defaultSettings(), SUN, undefined, { links: linksForDay(ws, prof, SUN, SUN) }).filter((x) => x.eventKey === 'p1');
  assert.deepEqual(al.map((x) => x.min), [10, 2]); assert.ok(!/الدرس:/.test(al[0].body));
});

test('تذكير المساء: دروس الغد والمؤجل', () => {
  const prof = schedule(); let ws = planWS(); const cls = classesFromProfile(prof)[0];
  const plan = ws.plans[0];
  const a = makeAssignment({ plan, lesson: plan.units[0].lessons[0], cls, profile: prof, dateKey: '2026-11-09', slotKey: 'p2', part: 1 });
  const b = makeAssignment({ plan, lesson: plan.units[0].lessons[1], cls, profile: prof, dateKey: SUN, slotKey: 'p1', part: 1 });
  ws = { ...ws, assignments: [a, b], log: [{ id: 'q', assignmentId: b.id, status: 'postponed', at: 1 }] };
  const d = eveningDigest(ws, prof, '2026-11-09', SUN, { tomorrow: true, postponed: true, incomplete: true, unlinked: true });
  assert.match(d.body, /أساسيات الإيقاع الموسيقي \(الحصة 1 من 2\)/); assert.match(d.body, /1 حصة مؤجلة بلا موعد جديد/);
  assert.equal(eveningDigest(planWS(), prof, '2026-11-13', SUN, { tomorrow: true }), null);
});

test('استبدال الخطة يحتفظ بالمعرّفات والنسخة السابقة ويبلّغ عن الدروس المحذوفة', () => {
  const ws = planWS(); const plan = ws.plans[0];
  const newUnits = [{ id: 'nu', title: 'الوحدة الأولى', lessons: [{ id: 'n1', title: 'أساسيات  الإيقاع الموسيقي', sessions: 3 }, { id: 'n2', title: 'درس جديد', sessions: 1 }] }];
  const { plan: p2, report } = replacePlanUnits(plan, newUnits, 'test', 5);
  assert.equal(p2.units[0].lessons[0].id, 'L1', 'نفس الدرس يحتفظ بمعرّفه');
  assert.deepEqual(report.removed.map((x) => x.id), ['L2', 'L3']);
  assert.equal(report.added.length, 1); assert.match(report.kept[0].changes[0], /عدد الحصص 2 ← 3/);
  assert.equal(p2.versions.length, 1); assert.equal(p2.versions[0].units[0].lessons.length, 3);
  const back = restoreVersion(p2, p2.versions[0].id);
  assert.equal(back.units[0].lessons.length, 3); assert.equal(back.versions.length, 2);
  assert.equal(normalizeWorkspace({ plans: [p2], assignments: [{ bad: 1 }], log: [{ status: 'zzz' }] }).assignments.length, 0);
});
