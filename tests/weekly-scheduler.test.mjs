// «Weekly Lesson Scheduler»: ربط درس الخطة بكل حصة فعلية في «منبّه الحصص» ثم ظهوره في التنبيه.
//   node --test tests/weekly-scheduler.test.mjs        (ويُشغَّل أيضًا بـ TZ=America/New_York و TZ=UTC للتحقق من توقيت عُمان)
// البيانات: ملفات Excel الحقيقية من مكتبة الخطط المقترحة (الصفوف 4 و5 و11 – الفصل الأول 2026/2027) تُقرأ بقارئ التطبيق نفسه،
// وخطط اصطناعية صغيرة للحالات الخاصة. جدول معلم واقعي: صف بحصة واحدة أسبوعيًا، وصف بحصتين، وصف بخمس حصص.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as XLSX from '../node_modules/xlsx/xlsx.mjs';
import { parsePlanGrid } from '../src/modules/lesson-plans/core/importPlan.js';
import { normalizeWorkspace, normalizePlan, allLessons } from '../src/modules/lesson-plans/core/model.js';
import { withOverride } from '../src/modules/lesson-plans/core/auto.js';
import { replacePlanUnits } from '../src/modules/lesson-plans/core/merge.js';
import { linksForDay, weekPlan, lessonHref } from '../src/modules/lesson-plans/core/links.js';
import { allocate, schoolWeekOf } from '../src/modules/lesson-plans/core/weekly.js';
import { planCalendar, weekOfDate } from '../src/modules/lesson-plans/core/calendar.js';
import { emptyProfile, normalizeProfile, defaultSettings } from '../src/modules/class-alarm/core/model.js';
import { alertsForDay, agenda, resolveDay, upcomingAlerts } from '../src/modules/class-alarm/core/schedule.js';
import { zonedParts, zonedToMs } from '../src/modules/class-alarm/core/time.js';

const Y = '2026/2027', S1 = 'الفصل الدراسي الأول';

// ---------- البيانات ----------
function libraryPlan(grade, id) {
  const wb = XLSX.read(fs.readFileSync(new URL(`../public/suggested-plans/grade-${grade}/semester-1.xlsx`, import.meta.url)), { type: 'buffer', cellDates: true });
  const grid = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames.find((n) => !/تعليمات/.test(n))], { header: 1, raw: true, defval: '', blankrows: false });
  const d = parsePlanGrid(grid).drafts[0];
  return normalizePlan({ ...d, id, units: d.units });
}
const plan = (id, grade, lessons, extra = {}) => normalizePlan({ id, year: Y, semester: S1, grade, units: [{ id: `${id}U`, title: 'الوحدة', lessons }], ...extra });

/** جدول المعلم: الصف الرابع/1 حصة أسبوعيًا (الاثنين) • الصف الخامس/1 حصتان (الأحد والثلاثاء) • الصف السادس/2 حصة (الأربعاء) • الصف الحادي عشر خمس حصص */
function teacher(over = {}) {
  const p = emptyProfile({ teacher: 'أ. حسين', school: 'مدرسة الاختبار', subject: 'المهارات الموسيقية' }, new Date('2026-09-01T03:00:00Z'));
  p.lessons = {
    0: { p1: { grade: 'الصف الحادي عشر' }, p2: { grade: 'الصف الخامس', section: '1' } },
    1: { p1: { grade: 'الصف الرابع', section: '1' }, p3: { grade: 'الصف 11' } },
    2: { p1: { grade: 'الحادي عشر' }, p4: { grade: 'الصف الخامس', section: '1' } },
    3: { p3: { grade: 'الصف السادس', section: '2' }, p5: { grade: 'الصف الحادي عشر' } },
    4: { p2: { grade: 'الصف الحادي عشر' } },
  };
  return normalizeProfile({ ...p, ...over });
}
const L = (w, prof, k, slot) => linksForDay(w, prof, k, k).get(slot);
const show = (x) => (!x ? '—' : x.review ? 'مراجعة' : !x.lessonTitle ? 'لا درس' : `${x.lessonTitle}${x.extra ? ':استكمال' : x.combined ? ':مجمّع' : x.part ? `:${x.part}${x.sessions ? `/${x.sessions}` : ''}` : ''}`);
const libWs = () => normalizeWorkspace({ plans: [libraryPlan('04', 'G4'), libraryPlan('05', 'G5'), libraryPlan('11', 'G11')] });

// ---------- 1) المثال المطلوب حرفيًا ----------
test('مثال المعلم: درس لكل أسبوع (11–14) وحصة الأحد ⇒ أحد الأسبوع 13 = «الدرس الثالث» في التنبيه (وليس أول درس في الملف)', () => {
  const prof = teacher({ lessons: { 0: { p2: { grade: 'الصف الخامس' } } } });
  const w = normalizeWorkspace({ plans: [plan('P', 'الصف الخامس', [
    { id: 'a', title: 'الدرس الأول', weeks: 'الحادي عشر' }, { id: 'b', title: 'الدرس الثاني', weeks: 'الثاني عشر' },
    { id: 'c', title: 'الدرس الثالث', weeks: 'الثالث عشر' }, { id: 'd', title: 'الدرس الرابع', weeks: 'الرابع عشر' }])] });
  const sun13 = '2026-11-29';
  assert.equal(weekOfDate(planCalendar(w.plans[0]), sun13), 13);
  const k = L(w, prof, sun13, 'p2');
  assert.equal(k.lessonTitle, 'الدرس الثالث'); assert.equal(k.week, 13); assert.equal(k.weekText, 'الأسبوع الثالث عشر');
  const a = alertsForDay(prof, defaultSettings(), sun13, undefined, { links: linksForDay(w, prof, sun13, sun13) }).find((x) => x.eventKey === 'p2' && x.min === 10);
  assert.equal(a.title, 'حان موعد حصتك القادمة');
  const lines = a.body.split('\n');
  assert.equal(lines[0], 'المهارات الموسيقية – الصف الخامس');
  assert.equal(lines[1], 'الدرس المقرر: الدرس الثالث', 'الدرس في السطر الثاني ليظهر حتى في إشعار النظام المختصر');
  assert.ok(lines.includes('الحصة الثانية • 8:10 ص – 8:50 ص • الأحد 29 نوفمبر 2026'), a.body);
  assert.ok(lines.includes('الأسبوع الدراسي: الثالث عشر – الفصل الدراسي الأول'), a.body);
  assert.deepEqual([a.lesson.title, a.lesson.week, a.lesson.source], ['الدرس الثالث', 'الأسبوع الثالث عشر', 'auto']);
  // الأسبوع 12 (لا يُعرض الثالث مبكرًا) والأسبوع 15 (لا درس في الخطة ⇒ لا يُخترع)
  assert.equal(L(w, prof, '2026-11-22', 'p2').lessonTitle, 'الدرس الثاني');
  assert.equal(L(w, prof, '2026-12-13', 'p2').state, 'none');
  assert.ok(!/الدرس المقرر/.test(alertsForDay(prof, defaultSettings(), '2026-12-13', undefined, { links: linksForDay(w, prof, '2026-12-13', '2026-12-13') })[0].body));
});

// ---------- 2) الدورة كاملة من ملف Excel حقيقي ----------
test('دورة كاملة: ملف Excel (الصف الخامس) ← تحليل ← ربط تلقائي بجدول حصتين أسبوعيًا ← الأسبوع ← الحصة ← الدرس ← التنبيه', () => {
  const prof = teacher(); const w = libWs();
  const g5 = allLessons(w.plans[1]);
  assert.ok(g5.length > 5 && g5.every((l) => l.sessions), 'الخطة حُللت بعدد حصص كل درس');
  // «آلة الأكورديون» الأسبوعان 8–9 (حصتان في الخطة) ثم «قراءة إيقاعية وصولفيج غنائي» الأسابيع 10–12 (3 حصص)
  const seq = ['2026-10-25|p2', '2026-10-27|p4', '2026-11-01|p2', '2026-11-03|p4', '2026-11-08|p2', '2026-11-10|p4', '2026-11-15|p2', '2026-11-17|p4']
    .map((x) => { const [k, s] = x.split('|'); return show(L(w, prof, k, s)); });
  assert.deepEqual(seq, ['آلة الأكورديون:1/2', 'آلة الأكورديون:2/2', 'آلة الأكورديون:استكمال', 'آلة الأكورديون:استكمال',
    'قراءة إيقاعية وصولفيج غنائي:1/3', 'قراءة إيقاعية وصولفيج غنائي:2/3', 'قراءة إيقاعية وصولفيج غنائي:3/3', 'قراءة إيقاعية وصولفيج غنائي:استكمال']);
  const k = L(w, prof, '2026-11-10', 'p4');
  assert.equal(k.week, 10); assert.equal(k.semester, S1);
  const al = alertsForDay(prof, defaultSettings(), '2026-11-10', undefined, { links: linksForDay(w, prof, '2026-11-10', '2026-11-10') }).filter((a) => a.eventKey === 'p4');
  assert.equal(al.length, 2, 'تنبيهان (قبل 10 و2 دقيقة)');
  for (const a of al) { assert.match(a.body, /^المهارات الموسيقية – الصف الخامس – الشعبة 1\nالدرس المقرر: قراءة إيقاعية وصولفيج غنائي \(الحصة 2 من 3\)\n/); assert.match(a.body, /الأسبوع الدراسي: العاشر/); }
  // التوقيت: الحصة الرابعة 9:30 بتوقيت مسقط = 05:30 UTC، وتنبيه «قبل 10 دقائق» 05:20 UTC — مهما كانت منطقة الجهاز
  assert.equal(new Date(al[0].due).toISOString(), '2026-11-10T05:20:00.000Z');
  const ext = L(w, prof, '2026-11-17', 'p4');
  assert.match(ext.note, /استكمال وتثبيت/);
  // رابط «فتح الدرس في خطتي»
  assert.match(lessonHref(w, k, '/dashboard/tools/plans'), /^\/dashboard\/tools\/plans\?tab=time&semester=.+&grade=.+&lesson=m%3A/);
});

test('صف بحصة واحدة أسبوعيًا (الرابع): كل أسبوع حصة من الدرس الممتد، ثم الدرس التالي في أسبوعه', () => {
  const prof = teacher(); const w = libWs();
  const seq = ['2026-11-02', '2026-11-09', '2026-11-16', '2026-11-23', '2026-11-30'].map((k) => show(L(w, prof, k, 'p1')));
  assert.deepEqual(seq, ['نشيد (سلامتي):1/3', 'نشيد (سلامتي):2/3', 'نشيد (سلامتي):3/3', 'آلة الأورج:1/2', 'آلة الأورج:2/2']);
});

test('عدة دروس في الأسبوع نفسه ودرس ممتد على 3 أسابيع (الحادي عشر، 5 حصص أسبوعيًا) — بالترتيب وبعدد الحصص', () => {
  const prof = teacher(); const w = libWs();
  const wk = (sun) => [[0, 'p1'], [1, 'p3'], [2, 'p1'], [3, 'p5'], [4, 'p2']].map(([d, s]) => { const k = new Date(Date.parse(`${sun}T12:00:00Z`) + d * 864e5).toISOString().slice(0, 10); return show(L(w, prof, k, s)); });
  assert.deepEqual(wk('2026-11-15'), ['مكونات آلة الجيتار:1/3', 'مكونات آلة الجيتار:2/3', 'مكونات آلة الجيتار:3/3', 'طريقة العزف على آلة الجيتار:1/8', 'طريقة العزف على آلة الجيتار:2/8']);
  assert.deepEqual(wk('2026-11-22'), [3, 4, 5, 6, 7].map((n) => `طريقة العزف على آلة الجيتار:${n}/8`));
  assert.equal(show(L(w, prof, '2026-11-29', 'p1')), 'طريقة العزف على آلة الجيتار:8/8');
  // الحصة الأخيرة في الخطة (الأسبوع التاسع: «تطبيقات» حصتان يومَي الأربعاء والخميس)
  assert.deepEqual([show(L(w, prof, '2026-11-04', 'p5')), show(L(w, prof, '2026-11-05', 'p2'))], ['تطبيقات:1/2', 'تطبيقات:2/2']);
});

// ---------- 3) الضغط والجمع: لا يُسقط درس ولا يُكرَّر ----------
test('حصص أقل من حصص الخطة: توزيع مضغوط بالترتيب (كل درس حصة على الأقل)، وأقل من عدد الدروس: دروس مجمّعة في الحصة', () => {
  const prof = teacher();
  // الصف الخامس (حصتان): درسان في الأسبوع العاشر بـ 4 + 2 حصص ⇒ أ ثم ب (لا يضيع «ب»)
  const w = normalizeWorkspace({ plans: [plan('P', 'الصف الخامس', [{ id: 'A', title: 'أ', weeks: 'العاشر', sessions: 4 }, { id: 'B', title: 'ب', weeks: 'العاشر', sessions: 2 }])] });
  const a = L(w, prof, '2026-11-08', 'p2'), b = L(w, prof, '2026-11-10', 'p4');
  assert.deepEqual([show(a), show(b)], ['أ:1/4', 'ب:1/2']);
  assert.equal(a.compressed, true); assert.match(a.note, /أقل مما تخصصه الخطة/);
  // ثلاث حصص (أضفنا حصة الأربعاء) و4+2 ⇒ أ، أ، ب (أكبر باقٍ)
  const prof3 = teacher({ lessons: { ...teacher().lessons, 3: { ...teacher().lessons[3], p1: { grade: 'الصف الخامس', section: '1' } } } });
  assert.deepEqual(['2026-11-08|p2', '2026-11-10|p4', '2026-11-11|p1'].map((x) => { const [k, s] = x.split('|'); return show(L(w, prof3, k, s)); }), ['أ:1/4', 'أ:2/4', 'ب:1/2']);
  // الصف السادس (حصة واحدة): درسان في الأسبوع نفسه ⇒ «أ + ب» في الحصة نفسها (معروف أو غير معروف عدد الحصص)
  for (const s of [1, null]) {
    const w6 = normalizeWorkspace({ plans: [plan('Q', 'الصف السادس', [{ id: 'A', title: 'أ', weeks: 'العاشر', sessions: s }, { id: 'B', title: 'ب', weeks: 'العاشر', sessions: s }])] });
    const k = L(w6, prof, '2026-11-11', 'p3');
    assert.equal(show(k), 'أ + ب:مجمّع'); assert.equal(k.lessons.length, 2);
    const al = alertsForDay(prof, defaultSettings(), '2026-11-11', undefined, { links: linksForDay(w6, prof, '2026-11-11', '2026-11-11') }).find((x) => x.eventKey === 'p3');
    assert.match(al.body, /الدرس المقرر: أ \+ ب\n/);
  }
});

test('غموض حقيقي: درسان بلا عدد حصص وثلاث حصص في الأسبوع ⇒ «غير محدد – يحتاج مراجعة»، ولا يُعرض درس غير مؤكد', () => {
  const prof = teacher({ lessons: { 0: { p2: { grade: 'الصف الخامس' } }, 1: { p2: { grade: 'الصف الخامس' } }, 2: { p2: { grade: 'الصف الخامس' } } } });
  const w = normalizeWorkspace({ plans: [plan('P', 'الصف الخامس', [{ id: 'A', title: 'أ', weeks: 'العاشر' }, { id: 'B', title: 'ب', weeks: 'العاشر' }])] });
  const k = L(w, prof, '2026-11-09', 'p2');
  assert.equal(k.review, true); assert.equal(k.lessonTitle, ''); assert.deepEqual(k.candidates.map((c) => c.title), ['أ', 'ب']);
  const al = alertsForDay(prof, defaultSettings(), '2026-11-09', undefined, { links: linksForDay(w, prof, '2026-11-09', '2026-11-09') })[0];
  assert.match(al.body, /الدرس المقرر: غير محدد — توزيع الدروس على الحصص يحتاج مراجعتك/);
  assert.ok(!/المقرر: [أب]/.test(al.body));
});

// ---------- 4) الإجازات والأسابيع بلا درس ----------
test('إجازة في جدول المعلم: لا درس في يومها، وترقيم الحصص يتبعها، والدرس الذي فقد كل حصصه يظهر تحذيرًا لا يُتجاوز بصمت', () => {
  const prof = teacher({ holidays: [{ name: 'إجازة رسمية', from: '2026-11-08', to: '2026-11-12' }] });
  const w = libWs();
  assert.equal(resolveDay(prof, '2026-11-09').isWorkday, false);
  assert.equal(L(w, prof, '2026-11-09', 'p1'), undefined, 'لا حصة يوم الإجازة');
  assert.equal(show(L(w, prof, '2026-11-16', 'p1')), 'نشيد (سلامتي):2/3', 'الحصة التالية للصف الرابع هي الثانية من الدرس');
  // الصف السادس: درس مقرر في الأسبوع العاشر فقط، وكل حصصه في الإجازة
  const w6 = normalizeWorkspace({ plans: [plan('Q', 'الصف السادس', [{ id: 'A', title: 'الإيقاع الثلاثي', weeks: 'العاشر', sessions: 1 }, { id: 'B', title: 'السلم الكبير', weeks: 'الحادي عشر', sessions: 1 }])] });
  const wp = weekPlan(w6, prof, '2026-11-10', '2026-11-10');
  const c6 = wp.classes.find((c) => c.label.startsWith('الصف السادس'));
  assert.equal(c6.missing.length, 1); assert.equal(c6.missing[0].title, 'الإيقاع الثلاثي'); assert.match(c6.missing[0].reason, /إجازة/);
  assert.equal(wp.weekText, 'الأسبوع العاشر');
  assert.equal(show(L(w6, prof, '2026-11-18', 'p3')), 'السلم الكبير:1/1', 'لا يُدفع الدرس الفائت إلى أسبوع غيره تلقائيًا');
});

test('بلا خطة / بلا ربط صريح / صف غير موجود في الخطط: المنبّه يعمل كما هو ولا يخترع درسًا', () => {
  const prof = teacher();
  const empty = normalizeWorkspace({});
  assert.equal(linksForDay(empty, prof, '2026-11-08', '2026-11-08').size, 0);
  const base = alertsForDay(prof, defaultSettings(), '2026-11-08');
  assert.deepEqual(alertsForDay(prof, defaultSettings(), '2026-11-08', undefined, { links: linksForDay(empty, prof, '2026-11-08', '2026-11-08') }).map((a) => a.body), base.map((a) => a.body));
  // خطة الصف الخامس فقط، مرفوعة دون أي «ربط» يدوي ⇒ تربط تلقائيًا؛ حصص الصفوف الأخرى بلا درس
  const w = normalizeWorkspace({ plans: [libraryPlan('05', 'G5')] });
  assert.ok(L(w, prof, '2026-11-08', 'p2').lessonTitle);
  assert.equal(L(w, prof, '2026-11-08', 'p1'), undefined, 'الحادي عشر بلا خطة');
});

// ---------- 5) التعديل اليدوي والعودة للتوزيع الأصلي ----------
test('تعديل يدوي: تقديم/تأجيل/استكمال لحصة واحدة دون تغيير الخطة، وإعادة التوزيع التلقائي تعيد الأصل', () => {
  const prof = teacher(); let w = libWs();
  const before = JSON.stringify(w.plans);
  // تأجيل: حصة الأحد 11/8 بلا درس من الخطة (اختبار) ⇒ «قراءة إيقاعية» تبدأ الثلاثاء
  w = withOverride(w, { profileId: prof.id, dateKey: '2026-11-08', slotKey: 'p2', classKey: '5|1', lessonId: '' });
  assert.equal(L(w, prof, '2026-11-08', 'p2').overridden, true);
  assert.equal(show(L(w, prof, '2026-11-10', 'p4')), 'قراءة إيقاعية وصولفيج غنائي:1/3');
  // استكمال: حصة الثلاثاء 11/17 (كانت «استكمال») يختار لها المعلم درس الأكورديون السابق
  const acc = allLessons(w.plans[1]).find((l) => l.title === 'آلة الأكورديون');
  w = withOverride(w, { profileId: prof.id, dateKey: '2026-11-17', slotKey: 'p4', classKey: '5|1', planId: 'G5', lessonId: acc.id });
  const k = L(w, prof, '2026-11-17', 'p4');
  assert.equal(k.lessonTitle, 'آلة الأكورديون'); assert.equal(k.overridden, true);
  assert.equal(JSON.stringify(w.plans), before, 'ملف الخطة لم يتغير');
  assert.equal(w.overrides.length, 2);
  // إعادة التوزيع التلقائي (ما يفعله زر «إعادة التوزيع التلقائي»)
  const reset = normalizeWorkspace({ ...w, overrides: w.overrides.filter((o) => o.profileId !== prof.id) });
  assert.equal(show(L(reset, prof, '2026-11-08', 'p2')), 'قراءة إيقاعية وصولفيج غنائي:1/3');
});

// ---------- 6) المزامنة: استبدال الخطة وتغيير الجدول ----------
test('استبدال ملف الخطة: المنبّه يقرأ النسخة الجديدة فورًا، والتعديلات اليدوية على دروس باقية تبقى', () => {
  const prof = teacher(); let w = libWs();
  const acc = allLessons(w.plans[1]).find((l) => l.title === 'قراءة إيقاعية وصولفيج غنائي');
  w = withOverride(w, { profileId: prof.id, dateKey: '2026-11-17', slotKey: 'p4', classKey: '5|1', planId: 'G5', lessonId: acc.id });
  // نسخة جديدة: نفس الدروس مع تغيير اسم درس الأسبوع العاشر وعدد حصصه إلى 4
  const units = w.plans[1].units.map((u) => ({ ...u, lessons: u.lessons.map((l) => (l.id === acc.id ? { ...l, id: 'new', sessions: 4 } : { ...l, id: `n${l.id}` })) }));
  const { plan: p2 } = replacePlanUnits(w.plans[1], units, 'استبدال بملف جديد');
  w = normalizeWorkspace({ ...w, plans: [w.plans[0], p2, w.plans[2]] });
  assert.equal(w.plans.length, 3, 'لا خطة مكررة');
  assert.equal(show(L(w, prof, '2026-11-15', 'p2')), 'قراءة إيقاعية وصولفيج غنائي:3/4', 'عدد الحصص الجديد مطبَّق');
  assert.equal(L(w, prof, '2026-11-17', 'p4').overridden, true, 'التعديل اليدوي بقي (الدرس احتفظ بمعرّفه)');
  // درس حُذف من النسخة الجديدة ⇒ يعود التوزيع التلقائي لتلك الحصة بدل عرض درس قديم
  const units2 = p2.units.map((u) => ({ ...u, lessons: u.lessons.filter((l) => l.title !== 'قراءة إيقاعية وصولفيج غنائي') }));
  const { plan: p3 } = replacePlanUnits(p2, units2, 'استبدال');
  const w3 = normalizeWorkspace({ ...w, plans: [w.plans[0], p3, w.plans[2]] });
  const k = L(w3, prof, '2026-11-17', 'p4');
  assert.notEqual(k.lessonTitle, 'قراءة إيقاعية وصولفيج غنائي'); assert.ok(!k.overridden);
});

test('تغيير الجدول: نقل حصة وإضافة صف ينعكسان فورًا، وتعديل يدوي على حصة صار صفها مختلفًا لا يُطبَّق على الصف الجديد', () => {
  let prof = teacher(); let w = libWs();
  w = withOverride(w, { profileId: prof.id, dateKey: '2026-11-08', slotKey: 'p2', classKey: '5|1', lessonId: '' });
  // نقل حصة الصف الخامس من الثلاثاء p4 إلى الأربعاء p4، وجعل حصة الأحد p2 للصف الرابع/1
  const les = JSON.parse(JSON.stringify(prof.lessons));
  delete les[2].p4; les[3].p4 = { grade: 'الصف الخامس', section: '1' }; les[0].p2 = { grade: 'الصف الرابع', section: '1' };
  prof = normalizeProfile({ ...prof, lessons: les });
  assert.equal(L(w, prof, '2026-11-10', 'p4'), undefined);
  assert.equal(show(L(w, prof, '2026-11-11', 'p4')), 'قراءة إيقاعية وصولفيج غنائي:1/3');
  const k = L(w, prof, '2026-11-08', 'p2');
  assert.equal(k.overridden, false, 'التعديل كان للصف الخامس ولا يُطبَّق على الصف الرابع');
  assert.equal(k.staleOverride, true);
  assert.equal(show(k), 'نشيد (سلامتي):3/3', 'حصة الأحد صارت جزءًا من حصص الصف الرابع (الأحد 1/11، الاثنين 2/11، الأحد 8/11)');
});

// ---------- 7) الأسبوع الدراسي والعرض المستقبلي في المنبّه ----------
test('تحديد الأسبوع الدراسي: من التقويم الرسمي، أو يُستنتج من دروس خطة تحمل رقم الأسبوع وتاريخه معًا، ولا يُخمَّن بدونها', () => {
  const w = libWs();
  assert.deepEqual(schoolWeekOf(w, '2026-09-06'), { week: 1, text: 'الأسبوع الأول', ordinal: 'الأول', semester: S1, year: Y });
  assert.equal(schoolWeekOf(w, '2026-11-26').week, 12);
  assert.equal(schoolWeekOf(w, '2026-12-30').week, 17);
  assert.equal(schoolWeekOf(w, '2026-12-31'), null, 'بعد نهاية الفصل');
  assert.equal(schoolWeekOf(w, '2026-09-05'), null, 'قبل بدايته');
  // عام غير معروف التقويم: يُستنتج من دروس فيها «الأسبوع + التاريخ»، ثم تُحسب دروس «الأسبوع فقط»
  const p = plan('X', 'الصف الخامس', [{ id: 'a', title: 'أ', weeks: '1', start: '2027-09-05', end: '2027-09-09' }, { id: 'b', title: 'ب', weeks: '3' }], { year: '2027/2028' });
  assert.equal(planCalendar(p).week1, '2027-09-05'); assert.equal(planCalendar(p).inferred, true);
  const prof = teacher();
  assert.equal(L(normalizeWorkspace({ plans: [p] }), prof, '2027-09-19', 'p2').lessonTitle, 'ب');
  assert.equal(planCalendar(plan('Y', 'الصف الخامس', [{ id: 'a', title: 'أ', weeks: '2' }], { year: '2030/2031' })), null);
});

test('الدروس القادمة في المنبّه (بقية اليوم + يوم الدوام التالي) وخطة الأسبوع لكل صف', () => {
  const prof = teacher(); const w = libWs();
  // الأحد 22 نوفمبر 08:00 بتوقيت مسقط (الحصة الأولى جارية)
  const now = zonedToMs('2026-11-22', '08:00', 'Asia/Muscat');
  const links = (k) => linksForDay(w, prof, k, '2026-11-22');
  const ag = agenda(prof, now, links, { days: 1 });
  assert.deepEqual(ag.map((d) => [d.dateKey, d.rel]), [['2026-11-22', 'today'], ['2026-11-23', 'tomorrow']]);
  assert.deepEqual(ag[0].items.map((x) => `${x.e.label}|${x.e.cls}|${x.link ? x.link.lessonTitle : ''}|${x.now ? 'الآن' : ''}`),
    ['الأولى|الصف الحادي عشر|طريقة العزف على آلة الجيتار|الآن', 'الثانية|الصف الخامس – الشعبة 1|قراءة إيقاعية وصولفيج غنائي|']);
  assert.deepEqual(ag[1].items.map((x) => x.link.lessonTitle), ['آلة الأورج', 'طريقة العزف على آلة الجيتار']);
  const wp = weekPlan(w, prof, '2026-11-22', '2026-11-22');
  assert.equal(wp.weekText, 'الأسبوع الثاني عشر');
  assert.deepEqual(wp.classes.map((c) => [c.label, c.items.length]), [['الصف الحادي عشر', 5], ['الصف الخامس – الشعبة 1', 2], ['الصف الرابع – الشعبة 1', 1], ['الصف السادس – الشعبة 2', 1]]);
  assert.equal(wp.classes.find((c) => c.label.startsWith('الصف السادس')).hasPlan, false);
  // تذكير المساء والتنبيهات القادمة تحمل الدرس أيضًا
  const ups = upcomingAlerts(prof, defaultSettings(), now, { linksFor: links });
  assert.ok(ups.some((a) => a.dateKey === '2026-11-22' && a.eventKey === 'p2' && /الدرس المقرر: قراءة إيقاعية/.test(a.body)));
});

// ---------- 8) التوقيت المحلي لسلطنة عُمان ----------
test('توقيت عُمان ثابت مهما كانت منطقة الجهاز: «اليوم» والأسبوع والتنبيهات تُحسب بتوقيت مسقط', () => {
  const prof = teacher(); const w = libWs();
  // 23:30 UTC يوم السبت = 03:30 صباح الأحد في مسقط
  const t = Date.parse('2026-11-21T23:30:00Z');
  const z = zonedParts(t, 'Asia/Muscat');
  assert.deepEqual([z.dateKey, z.wd, z.hh], ['2026-11-22', 0, 3]);
  const ag = agenda(prof, t, (k) => linksForDay(w, prof, k, z.dateKey), { days: 1 });
  assert.equal(ag[0].dateKey, '2026-11-22'); assert.equal(ag[0].items.length, 2);
  assert.equal(new Date(zonedToMs('2026-11-22', '07:30', 'Asia/Muscat')).toISOString(), '2026-11-22T03:30:00.000Z');
  assert.equal(schoolWeekOf(w, z.dateKey).week, 12);
  // نفس الحساب في كل المناطق: الخادم لا يشارك في حساب المواعيد (كلها من ساعة الجهاز محوّلة إلى توقيت المدرسة)
  console.log(`   (TZ=${process.env.TZ || Intl.DateTimeFormat().resolvedOptions().timeZone})`);
});

test('الخوارزمية نفسها (allocate) بلا تكرار: كل حصة تُسند مرة واحدة، ولا يتجاوز درس عدد حصصه إلا كـ«استكمال» معلَن', () => {
  const comp = [{ plan: { id: 'P' }, lesson: { id: 'a', sessions: 2 }, start: '2026-11-08', end: '2026-11-19', order: 0 }, { plan: { id: 'P' }, lesson: { id: 'b', sessions: 1 }, start: '2026-11-08', end: '2026-11-19', order: 1 }];
  const occ = ['08', '10', '12', '15', '17'].map((d) => ({ dateKey: `2026-11-${d}`, slotKey: 'p1' }));
  const r = allocate(comp, occ);
  assert.equal(r.bySlot.size, 5);
  assert.deepEqual([...r.bySlot.values()].map((x) => `${x.items.join('+')}:${x.kind}:${x.part}`), ['0:lesson:1', '0:lesson:2', '1:lesson:1', '1:extra:2', '1:extra:3']);
  assert.deepEqual(r.lessons.map((x) => x.given), [2, 3]);
  // تعديل يدوي لاحق لا يسرق حصة سابقة: اختيار «أ» يوم 17 لا يجعل حصة يوم 10 «استكمالًا»
  const r2 = allocate(comp, occ, (o) => (o.dateKey === '2026-11-17' ? { planId: 'P', lessonId: 'a' } : undefined));
  assert.deepEqual([...r2.bySlot.values()].map((x) => `${x.items.join('+')}:${x.kind}:${x.part}`), ['0:lesson:1', '0:lesson:2', '1:lesson:1', '1:extra:2']);
});
