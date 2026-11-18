// التقويم المدرسي في «منبّه الحصص»: البيانات الأولية (المصادر الثلاثة)، الأعوام الدراسية، النسخ دون تكرار، التعديل والحذف، التذكيرات، الإجازات، .ics
//   node --test tests/school-calendar.test.mjs   (ويُشغَّل أيضًا بـ TZ=America/New_York و TZ=UTC)
import test from 'node:test';
import assert from 'node:assert/strict';
import { SEED_2026_2027 as SEED } from '../src/modules/class-alarm/core/calendarSeed.js';
import {
  mergeSeed, normalizeCalendar, listItems, occurrence, upcomingGroups, itemsOnDay, calendarAlertsForDay, calendarHolidays, saveYear, saveEvent,
  deleteEvent, restoreEvent, copyYearEvents, setYearStatus, deleteYear, nextYearDraft, buildCalendarICS, hijriEstimate, CAT, CATEGORIES, monthGrid,
} from '../src/modules/class-alarm/core/calendar.js';
import { normalizeStore, emptyStore, defaultSettings, emptyProfile, normalizeProfile } from '../src/modules/class-alarm/core/model.js';
import { upcomingAlerts, resolveDay } from '../src/modules/class-alarm/core/schedule.js';
import { decide } from '../src/modules/class-alarm/core/engine.js';
import { zonedToMs, weekdayOf } from '../src/modules/class-alarm/core/time.js';

const fresh = () => normalizeCalendar(mergeSeed(null, SEED).cal);
const Y = (cal) => cal.years[0];
const bySeed = (cal, id) => cal.events.find((e) => e.seedId === id);
const occOf = (cal, id) => occurrence(bySeed(cal, id), cal.years.find((y) => y.id === bySeed(cal, id).yearId));

test('البيانات الأولية: 19 من صورة المواعيد + 19 من الخطة المبرمجة + 82 من دليل المناسبات = 120 دون تكرار', () => {
  const cal = fresh();
  assert.equal(cal.events.length, 120);
  const n = (src) => cal.events.filter((e) => e.src.id === src).length;
  assert.deepEqual([n('image'), n('plan'), n('guide')], [19, 19, 82]);
  assert.equal(new Set(cal.events.map((e) => e.seedId)).size, 120);
  // كل أرقام الدليل من 1 إلى 82 موجودة
  const nums = cal.events.filter((e) => e.src.id === 'guide').map((e) => +/م (\d+)/.exec(e.src.ref)[1]).sort((a, b) => a - b);
  assert.deepEqual(nums, Array.from({ length: 82 }, (_, i) => i + 1));
  // كل مناسبات الدليل مصنفة، وتغطي الفئات المطلوبة
  const cats = new Set(cal.events.filter((e) => e.src.id === 'guide').map((e) => e.category));
  for (const c of ['national', 'educational', 'cultural', 'health', 'environment', 'social', 'global', 'religious']) assert.ok(cats.has(c), c);
  assert.equal(Y(cal).name, '2026/2027');
});

test('صورة المواعيد: كل بطاقة بفترتها وصفوفها وفصلها كما وردت', () => {
  const cal = fresh();
  const exp = [
    ['img-s1-1', '1-12', '2026-10-26', '2026-11-13', 's1'], ['img-s1-2', '1-4', '2027-01-03', '2027-01-21', 's1'], ['img-s1-3', '5-11', '2026-12-16', '2027-01-08', 's1'],
    ['img-s1-4', '12', '2026-12-08', '2026-12-24', 's1'], ['img-s1-5', '5-11', '2026-12-20', '2027-01-14', 's1'], ['img-s1-6', '12', '2027-01-12', '2027-01-19', 's1'],
    ['img-s2-1', '5-12', '2027-03-01', '2027-03-18', 's2'], ['img-s2-2', '1-4', '2027-03-01', '2027-03-18', 's2'], ['img-s2-3', '5-11', '2027-05-30', '2027-06-11', 's2'],
    ['img-s2-4', '12', '2027-05-24', '2027-06-10', 's2'], ['img-s2-5', '5-11', '2027-06-01', '2027-06-20', 's2'], ['img-s2-6', '12', '2027-06-22', '2027-06-29', 's2'],
    ['img-s2-7', '1-11', '2027-06-01', '2027-07-08', 's2'], ['img-s2-8', '1-4', '2027-06-07', '2027-06-30', 's2'], ['img-r2-1', '5-11', '2027-06-23', '2027-07-11', 's2'],
    ['img-ex-1', '5-12', '2026-12-20', '2027-01-21', 's1'], ['img-ex-2', '5-12', '2027-06-01', '2027-07-13', 's2'], ['img-chk-1', '12', '2026-12-13', '2026-12-24', 's1'], ['img-chk-2', '12', '2027-05-27', '2027-06-10', 's2'],
  ];
  for (const [id, grades, s, e, sem] of exp) {
    const ev = bySeed(cal, id);
    assert.deepEqual([ev.grades, ev.start, ev.end, ev.semester, ev.kind], [grades, s, e, sem, 'range'], id);
    assert.ok(ev.src.ref.includes('البطاقة'), id);
  }
});

test('الخطة المبرمجة: التواريخ تطابق أيام الأسبوع المكتوبة في الخطة، والصفوف والأرقام محفوظة', () => {
  const cal = fresh();
  const DN = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  for (const ev of cal.events.filter((e) => e.src.id === 'plan')) {
    const m = /– (?:من )?(\S+) (\d+)\/(\d+)/.exec(ev.src.ref);
    assert.ok(m, ev.title);
    assert.equal(DN[weekdayOf(ev.start)].replace('الإثنين', 'الاثنين'), m[1], `${ev.title}: ${ev.start}`);
    assert.equal(+ev.start.slice(5, 7), +m[2]); assert.equal(+ev.start.slice(8), +m[3]);
  }
  const t = (id) => { const e = bySeed(cal, id); return [e.title, e.grades, e.start, e.end]; };
  assert.deepEqual(t('plan-04'), ['تقييم العرض الشفوي والأنشطة العملية', '5-10', '2026-10-01', '2026-12-31']);
  assert.deepEqual(t('plan-05'), ['تقييم الأنشطة العملية (1)', '11-12', '2026-10-01', '2026-10-31']);
  assert.deepEqual(t('plan-10'), ['تقييم الأنشطة العملية (2)', '11-12', '2026-11-01', '2026-11-30']);
  assert.deepEqual(t('plan-11'), ['تقييم الأنشطة العملية (1)', '1-4', '2026-11-01', '2026-11-30']);
  assert.deepEqual(t('plan-16'), ['تنفيذ الملاحظة (1)', '1-4', '2026-12-01', '2026-12-31']);
  assert.deepEqual(t('plan-19'), ['إجازة منتصف العام الدراسي', '', '2027-01-24', '2027-01-28']);
  assert.equal(cal.events.filter((e) => e.category === 'music').length, 7, 'مواعيد المادة منفصلة عن الإدارية');
  assert.ok(cal.events.filter((e) => e.src.id === 'image').every((e) => e.category !== 'music'));
});

test('الدليل: المناسبات الثابتة سنوية تُحسب داخل العام، والمتغيرة والهجرية بلا تاريخ حتى يُعتمد، مع اقتراح تقريبي للهجرية', () => {
  const cal = fresh();
  assert.deepEqual(occOf(cal, 'guide-01'), { start: '2026-09-08', end: '2026-09-08' });
  assert.deepEqual(occOf(cal, 'guide-40'), { start: '2027-01-05', end: '2027-01-05' });
  assert.deepEqual(occOf(cal, 'guide-73'), { start: '2027-07-23', end: '2027-07-23' });
  assert.deepEqual(occOf(cal, 'guide-30'), { start: '2026-12-01', end: '2026-12-31' }, 'شهر ديسمبر كاملًا');
  assert.deepEqual(occOf(cal, 'guide-62'), { start: '2027-04-20', end: '2027-04-27' });
  assert.deepEqual(occOf(cal, 'guide-75'), { start: '2027-08-01', end: '2027-08-07' });
  const vars = cal.events.filter((e) => e.kind === 'variable');
  assert.equal(vars.length, 9);
  assert.ok(vars.every((e) => !e.start && e.review.need));
  for (const e of vars.filter((v) => v.hijri)) {
    const est = hijriEstimate(Y(cal), e.hijri);
    assert.ok(est && est.start >= Y(cal).start, `${e.title}: ${est && est.start}`);
  }
  assert.equal(hijriEstimate(Y(cal), bySeed(cal, 'guide-80').hijri).end > hijriEstimate(Y(cal), bySeed(cal, 'guide-80').hijri).start, true, 'العشر الأواخر فترة');
});

test('التعارضات وغير الواضح مُعلَّمة للمراجعة ولا تُخمَّن', () => {
  const cal = fresh();
  const rev = cal.events.filter((e) => e.review.need).map((e) => e.seedId).sort();
  for (const id of ['plan-07', 'plan-09', 'plan-14', 'plan-17', 'plan-18', 'guide-02', 'guide-18', 'guide-76', 'guide-82']) assert.ok(rev.includes(id), id);
  assert.match(bySeed(cal, 'plan-09').review.note, /سبت/);
  assert.match(bySeed(cal, 'plan-17').review.note, /20 ديسمبر/);
  assert.equal(bySeed(cal, 'plan-14').expected, true); assert.equal(bySeed(cal, 'plan-14').suspend, false);
  assert.equal(bySeed(cal, 'plan-19').suspend, true);
});

test('دمج البيانات الأولية مرة أخرى لا يكرر شيئًا، وما حذفه المعلم لا يعود إلا بطلبه', () => {
  let cal = fresh();
  assert.equal(mergeSeed(cal, SEED).added, 0);
  cal = deleteEvent(cal, bySeed(cal, 'guide-05').id);
  assert.equal(mergeSeed(cal, SEED).added, 0);
  const r = mergeSeed(cal, SEED, { restoreDeleted: true });
  assert.equal(r.added, 1); assert.equal(r.cal.trash.length, 0); assert.equal(r.cal.events.length, 120);
});

test('الأعوام ديناميكية: إنشاء عام جديد، نسخ المناسبات دون تكرار، والتعديل في عام لا يمس غيره', () => {
  let cal = fresh();
  const y1 = Y(cal);
  const draft = nextYearDraft(y1);
  assert.equal(draft.name, '2027/2028'); assert.equal(weekdayOf(draft.start), weekdayOf(y1.start));
  cal = saveYear(cal, { ...draft, id: 'y2' });
  assert.equal(saveYear(cal, { ...draft, id: 'y3' }).years.length, 2, 'لا عامين بالاسم نفسه');
  const r = copyYearEvents(cal, y1.id, 'y2');
  assert.equal(r.added, 82, 'السنوية (73) والمتغيرة (9) من الدليل');
  cal = r.cal;
  const y2 = cal.years.find((y) => y.id === 'y2');
  const lit = cal.events.find((e) => e.yearId === 'y2' && e.seedId === 'guide-01');
  assert.deepEqual(occurrence(lit, y2), { start: '2027-09-08', end: '2027-09-08' });
  const again = copyYearEvents(cal, y1.id, 'y2');
  assert.deepEqual([again.added, again.skipped], [0, 82], 'لا تكرار');
  const withAdmin = copyYearEvents(cal, y1.id, 'y2', { oneTime: true });
  assert.equal(withAdmin.added, 38);
  assert.ok(withAdmin.cal.events.filter((e) => e.yearId === 'y2' && e.src.id === 'image').every((e) => !e.start && e.review.need));
  // تعديل نسخة العام الجديد لا يغيّر العام السابق
  cal = saveEvent(cal, { ...lit, title: 'اليوم العالمي لمحو الأمية (معدّل)' });
  assert.equal(bySeed(cal, 'guide-01').title, 'اليوم العالمي لمحو الأمية');
  assert.equal(cal.events.find((e) => e.id === lit.id).title, 'اليوم العالمي لمحو الأمية (معدّل)');
  assert.match(cal.events.find((e) => e.id === lit.id).history.at(-1).what, /الاسم/);
  // تعديل العام نفسه
  cal = saveYear(cal, { ...y1, name: '2026/2027', end: '2027-07-15' });
  assert.equal(Y(cal).end, '2027-07-15');
  // أرشفة وحذف عام
  cal = setYearStatus(cal, 'y2', 'archived');
  assert.equal(cal.years.find((y) => y.id === 'y2').status, 'archived');
  const before = cal.events.length;
  cal = deleteYear(cal, 'y2');
  assert.equal(cal.years.length, 1); assert.equal(cal.events.length, before - 82); assert.equal(cal.trash.length, 82, 'مواعيده في المحذوفات');
});

test('إضافة وتعديل وحذف واسترجاع موعد يدوي (مع سجل التعديلات)', () => {
  let cal = fresh();
  cal = saveEvent(cal, { title: 'اجتماع أولياء الأمور', kind: 'day', start: '2026-11-22', category: 'school', remind: { mode: 'custom', before: [2], onStart: true } });
  let ev = cal.events.find((e) => e.title === 'اجتماع أولياء الأمور');
  assert.equal(ev.src.id, 'manual'); assert.equal(ev.yearId, Y(cal).id); assert.equal(ev.history[0].what, 'إنشاء');
  cal = saveEvent(cal, { ...ev, start: '2026-11-23', category: 'other' });
  ev = cal.events.find((e) => e.id === ev.id);
  assert.equal(ev.end, '2026-11-23'); assert.match(ev.history.at(-1).what, /تاريخ البداية/);
  cal = deleteEvent(cal, ev.id);
  assert.ok(!cal.events.some((e) => e.id === ev.id)); assert.equal(cal.trash.length, 1);
  cal = restoreEvent(cal, ev.id);
  assert.ok(cal.events.some((e) => e.id === ev.id)); assert.equal(cal.trash.length, 0);
});

test('التذكيرات: قبل 3 أيام وقبل يوم وعند البداية وقبل نهاية الفترة، الساعة 7:00 بتوقيت مسقط، وحسب التصنيف', () => {
  const cal = fresh();
  const id = bySeed(cal, 'img-s1-1').id; // 26 أكتوبر – 13 نوفمبر
  const on = (k) => calendarAlertsForDay(cal, k, 'Asia/Muscat').filter((a) => a.calEventId === id);
  assert.equal(on('2026-10-23')[0].calType, 'b3');
  assert.match(on('2026-10-25')[0].title, /تذكير غدًا: إدخال التقرير الوصفي الأول/);
  assert.match(on('2026-10-26')[0].title, /^تبدأ اليوم/);
  assert.match(on('2026-11-12')[0].title, /^تنتهي غدًا/);
  assert.equal(on('2026-11-01').length, 0);
  assert.equal(new Date(on('2026-10-26')[0].due).toISOString(), '2026-10-26T03:00:00.000Z');
  assert.match(on('2026-10-26')[0].body, /الصفوف: 1-12/);
  // مناسبات عالمية: لا تذكير افتراضيًا، وتظهر عند تفعيل التصنيف
  const peace = bySeed(cal, 'guide-04').id;
  assert.equal(calendarAlertsForDay(cal, '2026-09-21', 'Asia/Muscat').filter((a) => a.calEventId === peace).length, 0);
  const cal2 = { ...cal, settings: { ...cal.settings, cats: { ...cal.settings.cats, global: true } } };
  assert.equal(calendarAlertsForDay(cal2, '2026-09-21', 'Asia/Muscat').filter((a) => a.calEventId === peace).length, 1);
  // اليوم الوطني: تذكير واحد (من الخطة) لا تذكيران
  assert.equal(calendarAlertsForDay(cal, '2026-11-18', 'Asia/Muscat').filter((a) => /الوطن/.test(a.title)).length, 1);
  // المتغير بلا تاريخ لا يُنبَّه له، والمعطّل لا، والعام المؤرشف لا، والمنبه المتوقف لا
  assert.equal(calendarAlertsForDay(saveEvent(cal, { ...bySeed(cal, 'img-s1-1'), enabled: false }), '2026-10-26', 'Asia/Muscat').filter((a) => a.calEventId === id).length, 0);
  assert.equal(calendarAlertsForDay(setYearStatus(cal, Y(cal).id, 'archived'), '2026-10-26', 'Asia/Muscat').length, 0);
  assert.equal(calendarAlertsForDay(cal, '2026-10-26', 'Asia/Muscat', { enabled: false }).length, 0);
});

test('التذكيرات تدخل محرك المنبّه نفسه، ولا تضيع إن فُتحت الأداة متأخرة في اليوم نفسه', () => {
  const store = normalizeStore({ ...emptyStore(), calendar: fresh() });
  const p = normalizeProfile(emptyProfile({ tz: 'Asia/Muscat' }));
  const s = defaultSettings();
  const now = zonedToMs('2026-10-26', '10:30', 'Asia/Muscat');
  const list = upcomingAlerts(p, s, now, { calendarAlerts: (k) => calendarAlertsForDay(store.calendar, k, p.tz, s) });
  const mine = list.filter((a) => a.type === 'calendar' && a.dateKey === '2026-10-26');
  assert.ok(mine.some((a) => /التقرير الوصفي الأول/.test(a.title)));
  const d = decide(now, mine, {}, 90000);
  assert.equal(d.miss.length, 0); assert.ok(d.fire.length >= 1, 'تصدر بعد 3.5 ساعات من موعدها');
  const late = decide(zonedToMs('2026-10-26', '20:00', 'Asia/Muscat'), mine, {}, 90000);
  assert.ok(late.miss.length >= 1, 'بعد 12 ساعة تُعدّ فائتة');
});

test('الإجازة المؤكدة توقف تنبيهات الحصص، والمتوقعة لا حتى يفعّلها المعلم', () => {
  const cal = fresh();
  const hol = calendarHolidays(cal);
  assert.deepEqual(hol.map((h) => [h.name, h.from, h.to]), [['إجازة منتصف العام الدراسي', '2027-01-24', '2027-01-28']]);
  const p = normalizeProfile(emptyProfile({ tz: 'Asia/Muscat' }));
  assert.equal(resolveDay({ ...p, holidays: hol }, '2027-01-25').isWorkday, false);
  assert.equal(resolveDay({ ...p, holidays: hol }, '2026-11-25').isWorkday, true, 'إجازة اليوم الوطني متوقعة');
  const c2 = saveEvent(cal, { ...bySeed(cal, 'plan-14'), suspend: true });
  assert.equal(calendarHolidays(c2).length, 2);
  assert.equal(calendarHolidays({ ...cal, settings: { ...cal.settings, suspendClasses: false } }).length, 0);
});

test('العرض: القادمة والبحث والتصفية والتقويم الشهري', () => {
  const cal = fresh();
  const yid = Y(cal).id;
  const items = listItems(cal, yid, '2026-11-18');
  assert.equal(items.length, 120);
  assert.equal(items.filter((i) => !i.occ).length, 9);
  const g = upcomingGroups(items, '2026-11-18');
  assert.ok(g.now.some((i) => i.ev.seedId === 'plan-13') && g.now.some((i) => i.ev.seedId === 'plan-10'), 'اليوم الوطني + فترة جارية');
  assert.ok(g.week.some((i) => i.ev.seedId === 'plan-14'));
  assert.equal(listItems(cal, yid, '2026-11-18', { q: 'التقرير الوصفي' }).length, 4);
  assert.equal(listItems(cal, yid, '2026-11-18', { q: 'الاحتبار' }).length, 0);
  assert.equal(listItems(cal, yid, '2026-11-18', { category: 'music' }).length, 7);
  assert.equal(listItems(cal, yid, '2026-11-18', { source: 'guide' }).length, 82);
  assert.equal(listItems(cal, yid, '2026-11-18', { status: 'past' }).every((i) => i.occ.end < '2026-11-18'), true);
  assert.ok(listItems(cal, yid, '2026-11-18', { semester: 's2', source: 'image' }).length === 11);
  assert.ok(itemsOnDay(cal, '2026-12-21').length >= 6);
  assert.equal(monthGrid('2026-11')[0][0], '2026-11-01');
  assert.ok(CATEGORIES.every((c) => CAT[c.id]));
});

test('ملف .ics لتقويم الهاتف: حدث لكل موعد له تاريخ، وتذكيرات VALARM', () => {
  const cal = fresh();
  const ics = buildCalendarICS(cal, { yearId: Y(cal).id, now: Date.UTC(2026, 10, 18) });
  assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 111, '120 − 9 بلا تاريخ');
  assert.match(ics, /DTSTART;VALUE=DATE:20261026\r\nDTEND;VALUE=DATE:20261114/);
  assert.ok((ics.match(/BEGIN:VALARM/g) || []).length > 20);
  assert.match(ics, /TRIGGER:-PT3900M/, 'قبل 3 أيام الساعة 7:00 = 3×1440−420 دقيقة');
  assert.match(ics, /TRIGGER:PT420M/, 'في اليوم نفسه الساعة 7:00');
});

test('الحفظ: التقويم يبقى ضمن مخزن المنبّه بعد التطبيع والتحويل لنص (الحفظ المحلي/المزامنة)', () => {
  const st = normalizeStore({ ...emptyStore(), calendar: fresh() });
  const back = normalizeStore(JSON.parse(JSON.stringify(st)));
  assert.equal(back.calendar.events.length, 120);
  assert.deepEqual(back.calendar.years, st.calendar.years);
  assert.equal(normalizeStore(emptyStore()).calendar, null, 'مخزن قديم بلا تقويم → يُهيأ عند الفتح');
  assert.ok(JSON.stringify(st).length < 900 * 1024, 'أقل من حد المزامنة');
});
