// اختبارات التطوير الجديد: عرض «موعد الدرس» • صفوفي • الربط التلقائي بالمنبّه • الخطط المقترحة (صلاحية الأدمن) • إعدادات المنبّه
//   node --test tests/lesson-plans-integration.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as XLSX from '../node_modules/xlsx/xlsx.mjs';
import { lessonTiming, maxWeekOf, formatDateAr, formatRangeAr, toLatinDigits } from '../src/modules/lesson-plans/core/calendar.js';
import { normalizeWorkspace, normalizePlan } from '../src/modules/lesson-plans/core/model.js';
import { autoLinkEvent, withOverride, planWindows } from '../src/modules/lesson-plans/core/auto.js';
import { linksForDay, eveningDigest } from '../src/modules/lesson-plans/core/links.js';
import { classesFromProfile, makeAssignment } from '../src/modules/lesson-plans/core/track.js';
import { officialDraft, parsePlanGrid } from '../src/modules/lesson-plans/core/importPlan.js';
import { createLessonPlansHandler } from '../src/modules/lesson-plans/server/http.js';
import { sniffSheet } from '../src/modules/lesson-plans/server/suggested.js';
import { emptyProfile, normalizeProfile, defaultSettings, normalizeSettings } from '../src/modules/class-alarm/core/model.js';
import { alertsForDay, resolveDay } from '../src/modules/class-alarm/core/schedule.js';
import { makeMemoryStores } from './lesson-plans/memoryStores.mjs';

const REF = JSON.parse(fs.readFileSync(new URL('../src/data/semester-plans.json', import.meta.url), 'utf8'));
const S1 = 'الفصل الدراسي الأول', S2 = 'الفصل الدراسي الثاني', Y = '2026/2027';

// ---------- 1) عرض «موعد الدرس» ----------
test('تنسيق التاريخ بالعربية بأرقام واضحة واتجاه سليم', () => {
  assert.equal(formatDateAr('2026-12-31'), '31 ديسمبر 2026');
  assert.equal(formatDateAr('2026-12-13', { day: true }), 'الأحد 13 ديسمبر 2026');
  assert.equal(formatRangeAr('2026-11-29', '2026-12-03'), 'الأحد 29 نوفمبر – الخميس 3 ديسمبر 2026');
  assert.equal(formatRangeAr('2026-12-13', '2026-12-17'), 'الأحد 13 – الخميس 17 ديسمبر 2026');
  assert.equal(toLatinDigits('٢٠٢٦/١٢/٣١ و ۲۹'), '2026/12/31 و 29');
});

test('الحالة المبلّغ عنها: «الخامس عشر، السادس عشر، السابع عشر» → أسابيع مرتبة وتواريخ صحيحة بلا تكرار حروف', () => {
  const t = lessonTiming({ weeks: 'الخامس عشر، السادس عشر، السابع عشر', year: Y, semester: S1 });
  assert.equal(t.state, 'ok');
  assert.equal(t.weeksText, 'الخامس عشر، السادس عشر، السابع عشر');
  assert.deepEqual(t.weeks.map((w) => w.text), ['الأحد 13 – الخميس 17 ديسمبر 2026', 'الأحد 20 – الخميس 24 ديسمبر 2026', 'الأحد 27 – الأربعاء 30 ديسمبر 2026']);
  assert.ok(!/الخخ/.test(t.weeksText));
  // ترتيب معكوس + أرقام هندية وعربية في المدخل
  const u = lessonTiming({ weeks: 'السادس عشر، ١٥', year: Y, semester: S1 });
  assert.deepEqual(u.weeks.map((w) => w.week), [15, 16]);
});

test('كل دروس الخطة المرجعية (176 درسًا في 24 خطة) تُعرض بتواريخ نظيفة ومرتبة أو برسالة واضحة', () => {
  let n = 0; const states = {};
  for (const [sem, gs] of Object.entries(REF)) for (const [g, ls] of Object.entries(gs)) {
    const mx = maxWeekOf(Object.values(ls).map((v) => v.weeks));
    for (const v of Object.values(ls)) {
      n++;
      const t = lessonTiming({ weeks: v.weeks, year: Y, semester: sem, maxWeek: mx });
      states[t.state] = (states[t.state] || 0) + 1;
      for (let i = 1; i < t.weeks.length; i++) assert.ok(t.weeks[i].start > t.weeks[i - 1].start, 'مرتبة زمنيًا');
      for (const w of t.weeks) {
        assert.match(w.text, /^[؀-ۿ\s0-9–]+$/, `نص بلا رموز اتجاه أو أرقام هندية: ${w.text}`);
        assert.ok(w.start <= w.end && w.start >= '2026-09-06' && w.end <= '2027-06-10', `${g} ${w.week}`);
      }
    }
  }
  assert.equal(n, 176);
  assert.deepEqual(states, { ok: 169, 'by-plan': 5, unknown: 2 });
});

test('نهاية الفصل: الأسبوع 17 من الفصل الأول ينتهي 30 ديسمبر؛ والأسبوع 18 من الثاني 31 مايو إلا للصفوف الممتدة حتى الأسبوع 19', () => {
  const mx = (g) => maxWeekOf(Object.values(REF[S2][g]).map((v) => v.weeks));
  const w18 = (g) => lessonTiming({ weeks: 'الثامن عشر', year: Y, semester: S2, maxWeek: mx(g) }).weeks[0];
  assert.deepEqual([w18('الصف الخامس').start, w18('الصف الخامس').end], ['2027-05-30', '2027-05-31']);
  assert.deepEqual([w18('الصف الأول').start, w18('الصف الأول').end], ['2027-05-30', '2027-06-03']);
  assert.equal(lessonTiming({ weeks: 'حسب الخطة', year: Y, semester: S2 }).state, 'by-plan');
});

// ---------- 2) البيانات القديمة + صفوفي ----------
test('ترحيل آمن: مساحة عمل قديمة بلا settings/overrides تُقرأ كما هي مع قيم افتراضية', () => {
  const old = { version: 1, plans: [{ id: 'P', grade: 'الصف الخامس', units: [{ id: 'U', lessons: [{ id: 'L', title: 'درس' }] }] }], assignments: [], log: [], updatedAt: 5 };
  const w = normalizeWorkspace(old);
  assert.equal(w.plans[0].units[0].lessons[0].title, 'درس');
  assert.deepEqual(w.settings, { grades: [], autoLink: true, gradesAt: 0 });
  assert.deepEqual(w.overrides, []);
  const w2 = normalizeWorkspace({ ...w, settings: { grades: [5, '6', 5, 13, 0], autoLink: false } });
  assert.deepEqual(w2.settings.grades, [5, 6]); assert.equal(w2.settings.autoLink, false);
  // خطة قديمة حُفظ فصلها باسم مختصر («الأول») تُصحَّح عند القراءة فتعمل مع التقويم والربط
  assert.equal(normalizeWorkspace({ plans: [{ semester: 'الأول' }, { semester: 'الفصل الثاني' }] }).plans.map((p) => p.semester).join('|'), 'الفصل الدراسي الأول|الفصل الدراسي الثاني');
});

// ---------- 3) الربط التلقائي ----------
const SUN = '2026-11-08';
function schedule() {
  const p = emptyProfile({ teacher: 'أ. حسين', school: 'مدرسة الاختبار', subject: 'المهارات الموسيقية' }, new Date('2026-11-08T03:00:00Z'));
  // الصف الخامس/1: الأحد والاثنين والأربعاء (3 حصص أسبوعيًا) • الصف الخامس/2: الأحد • الصف السادس/1: الثلاثاء
  p.lessons = { 0: { p1: { grade: 'الصف الخامس', section: '1' }, p3: { grade: 'الصف الخامس', section: '2' } }, 1: { p2: { grade: 'الصف 5', section: '1' } }, 2: { p4: { grade: 'الصف السادس', section: '1' } }, 3: { p3: { grade: 'الصف الخامس', section: '1' } } };
  return normalizeProfile(p);
}
const ws = (lessons, extra = {}) => normalizeWorkspace({ plans: [normalizePlan({ id: 'P5', year: Y, semester: S1, grade: 'الصف الخامس', units: [{ id: 'U', title: 'الوحدة الأولى', lessons }] })], ...extra });
const linkOf = (w, prof, k, slot) => linksForDay(w, prof, k, SUN).get(slot);

test('درس أسبوعه 10 بلا عدد حصص: كل حصص الشعبة في ذلك الأسبوع له، مرقّمة حسب الحصص الفعلية (لا افتراض حصة واحدة)', () => {
  const prof = schedule(); const w = ws([{ id: 'A', title: 'الميزان الرباعي', weeks: 'العاشر' }]);
  assert.deepEqual(['2026-11-08|p1', '2026-11-09|p2', '2026-11-11|p3'].map((x) => { const [k, s] = x.split('|'); const l = linkOf(w, prof, k, s); return `${l.lessonTitle}:${l.part}`; }), ['الميزان الرباعي:1', 'الميزان الرباعي:2', 'الميزان الرباعي:3']);
  const l = linkOf(w, prof, SUN, 'p3'); // الشعبة 2 لها حصة واحدة
  assert.equal(l.part, 1);
  assert.equal(linkOf(w, prof, '2026-11-15', 'p1').state, 'none', 'خارج فترة الدرس: لا درس مخطط');
});

test('حصص أكثر من عدد حصص الدرس → «يحتاج مراجعة» ولا نفترض الدرس التالي', () => {
  const prof = schedule(); const w = ws([{ id: 'A', title: 'أ', weeks: 'العاشر', sessions: 2 }, { id: 'B', title: 'ب', weeks: 'الحادي عشر', sessions: 2 }]);
  assert.equal(linkOf(w, prof, '2026-11-09', 'p2').part, 2);
  const r = linkOf(w, prof, '2026-11-11', 'p3');
  assert.equal(r.review, true); assert.equal(r.lessonTitle, '');
  assert.deepEqual(r.candidates.map((c) => c.title), ['أ', 'ب']);
});

test('دروس متداخلة بعدد حصص معروف تُوزّع بالترتيب؛ وبدونه → مراجعة', () => {
  const prof = schedule();
  const w = ws([{ id: 'A', title: 'أ', start: '2026-11-08', end: '2026-11-19', sessions: 2 }, { id: 'B', title: 'ب', start: '2026-11-08', end: '2026-11-19', sessions: 4 }]);
  const seq = ['2026-11-08|p1', '2026-11-09|p2', '2026-11-11|p3', '2026-11-15|p1', '2026-11-16|p2', '2026-11-18|p3'].map((x) => { const [k, s] = x.split('|'); const l = linkOf(w, prof, k, s); return l.review ? 'مراجعة' : `${l.lessonTitle}${l.part}`; });
  assert.deepEqual(seq, ['أ1', 'أ2', 'ب1', 'ب2', 'ب3', 'ب4']);
  // درس وحده في أسبوع ثم يتداخل مع آخر: الأسبوع الأول مؤكد، أسبوع التداخل بلا عدد حصص → مراجعة
  const w3 = ws([{ id: 'A', title: 'أ', start: '2026-11-08', end: '2026-11-19' }, { id: 'B', title: 'ب', start: '2026-11-15', end: '2026-11-19' }]);
  assert.equal(linkOf(w3, prof, '2026-11-11', 'p3').lessonTitle, 'أ');
  assert.equal(linkOf(w3, prof, '2026-11-11', 'p3').part, 3);
  assert.equal(linkOf(w3, prof, '2026-11-16', 'p2').review, true);
  const w2 = ws([{ id: 'A', title: 'أ', weeks: 'العاشر' }, { id: 'B', title: 'ب', weeks: 'العاشر' }]);
  const r = linkOf(w2, prof, SUN, 'p1');
  assert.equal(r.review, true); assert.equal(r.candidates.length, 2);
});

test('الإلغاء والإجازة والحصة الاستثنائية من المنبّه تنعكس على الترقيم فورًا (حساب لحظي)', () => {
  let prof = schedule(); const w = ws([{ id: 'A', title: 'أ', weeks: 'العاشر', sessions: 3 }]);
  assert.equal(linkOf(w, prof, '2026-11-11', 'p3').part, 3);
  prof = normalizeProfile({ ...prof, overrides: { '2026-11-09': { cancelled: { p2: true } } } });
  assert.equal(resolveDay(prof, '2026-11-09').events.find((e) => e.key === 'p2').cancelled, true);
  assert.equal(linkOf(w, prof, '2026-11-09', 'p2'), undefined, 'الحصة الملغاة بلا درس');
  assert.equal(linkOf(w, prof, '2026-11-11', 'p3').part, 2, 'الحصة التالية صارت الثانية');
});

test('تصحيح المعلم لحصة واحدة: درس محدد / لا درس / إلغاء التصحيح — دون تكرار، والترقيم يتبعه', () => {
  const prof = schedule(); let w = ws([{ id: 'A', title: 'أ', weeks: 'العاشر' }, { id: 'B', title: 'ب', weeks: 'العاشر' }]);
  w = withOverride(w, { profileId: prof.id, dateKey: SUN, slotKey: 'p1', planId: 'P5', lessonId: 'B' });
  w = withOverride(w, { profileId: prof.id, dateKey: SUN, slotKey: 'p1', planId: 'P5', lessonId: 'A' });
  assert.equal(w.overrides.length, 1, 'تصحيح واحد فقط للحصة');
  let l = linkOf(w, prof, SUN, 'p1');
  assert.equal(l.lessonTitle, 'أ'); assert.equal(l.overridden, true);
  w = withOverride(w, { profileId: prof.id, dateKey: SUN, slotKey: 'p1', lessonId: '' });
  l = linkOf(w, prof, SUN, 'p1'); assert.equal(l.state, 'none'); assert.equal(l.lessonTitle, '');
  w = normalizeWorkspace(withOverride(w, { profileId: prof.id, dateKey: SUN, slotKey: 'p1', lessonId: null }));
  assert.equal(w.overrides.length, 0); assert.equal(linkOf(w, prof, SUN, 'p1').review, true);
  // تصحيح يستهلك حصة من الدرس: بقية الحصص تُرقّم بعده
  let w3 = ws([{ id: 'A', title: 'أ', weeks: 'العاشر', sessions: 3 }]);
  w3 = withOverride(w3, { profileId: prof.id, dateKey: SUN, slotKey: 'p1', lessonId: '' });
  assert.equal(linkOf(w3, prof, '2026-11-09', 'p2').part, 1);
});

test('الربط اليدوي له الأولوية، والصفوف غير المختارة لا تُربط، وإيقاف الربط التلقائي يحترم القرار', () => {
  const prof = schedule(); let w = ws([{ id: 'A', title: 'أ', weeks: 'العاشر', sessions: 3 }, { id: 'B', title: 'ب', weeks: 'العاشر', sessions: 3 }]);
  const cls = classesFromProfile(prof)[0];
  const a = makeAssignment({ plan: w.plans[0], lesson: w.plans[0].units[0].lessons[1], cls, profile: prof, dateKey: SUN, slotKey: 'p1', part: 1 });
  w = { ...w, assignments: [a] };
  assert.equal(linkOf(w, prof, SUN, 'p1').source, 'manual');
  w = { ...w, log: [{ id: 'g', assignmentId: a.id, status: 'postponed', at: 1 }] };
  assert.equal(linkOf(w, prof, SUN, 'p1'), undefined, 'حصة مؤجلة يدويًا لا يملؤها التلقائي');
  const hidden = normalizeWorkspace({ ...ws([{ id: 'A', title: 'أ', weeks: 'العاشر' }]), settings: { grades: [6] } });
  assert.equal(linksForDay(hidden, prof, SUN, SUN).size, 0);
  const off = normalizeWorkspace({ ...ws([{ id: 'A', title: 'أ', weeks: 'العاشر' }]), settings: { autoLink: false } });
  assert.equal(linksForDay(off, prof, SUN, SUN).size, 0);
});

test('المنبّه: التنبيه يحمل الدرس التلقائي، والمراجعة لا تخترع درسًا، وبلا خطط يعمل كما هو', () => {
  const prof = schedule();
  const w = ws([{ id: 'A', title: 'الميزان الرباعي', weeks: 'العاشر', sessions: 3 }]);
  const al = alertsForDay(prof, defaultSettings(), SUN, undefined, { links: linksForDay(w, prof, SUN, SUN) }).filter((x) => x.eventKey === 'p1');
  assert.match(al[0].body, /الدرس: الميزان الرباعي \(الحصة 1 من 3\)/);
  const w2 = ws([{ id: 'A', title: 'أ', weeks: 'العاشر' }, { id: 'B', title: 'ب', weeks: 'العاشر' }]);
  const al2 = alertsForDay(prof, defaultSettings(), SUN, undefined, { links: linksForDay(w2, prof, SUN, SUN) }).filter((x) => x.eventKey === 'p1');
  assert.ok(!/الدرس:/.test(al2[0].body));
  assert.equal(alertsForDay(prof, defaultSettings(), SUN).length, alertsForDay(prof, defaultSettings(), SUN, undefined, { links: linksForDay(normalizeWorkspace({}), prof, SUN, SUN) }).length);
  const d = eveningDigest(w2, prof, SUN, '2026-11-07', { tomorrow: true, unlinked: true });
  assert.match(d.body, /تحتاج مراجعة/);
});

test('الخطة المرجعية كمسودة → ربط تلقائي حقيقي بالأسابيع (الصف الخامس، الفصل الأول)', () => {
  const prof = schedule();
  const d = officialDraft(REF, S1, 'الصف الخامس');
  const w = normalizeWorkspace({ plans: [normalizePlan({ ...d, units: d.units })] });
  const win = planWindows(w.plans[0]).find((x) => x.start <= SUN && SUN <= x.end);
  const l = linkOf(w, prof, SUN, 'p1');
  assert.ok(win, 'يوجد درس للأسبوع العاشر');
  assert.ok(l.lessonTitle === win.lesson.title || l.review, JSON.stringify(l));
});

test('حسابان لمعلمين مختلفين: بيانات كل منهما لا تؤثر على الآخر', () => {
  const profA = schedule(), profB = normalizeProfile({ ...schedule(), id: 'other' });
  const wA = ws([{ id: 'A', title: 'درس المعلم أ', weeks: 'العاشر' }]);
  const wB = normalizeWorkspace({ plans: [normalizePlan({ id: 'Q', year: Y, semester: S1, grade: 'الصف الخامس', units: [{ id: 'U', lessons: [{ id: 'X', title: 'درس المعلم ب', weeks: 'العاشر' }] }] })] });
  assert.equal(linkOf(wA, profA, SUN, 'p1').lessonTitle, 'درس المعلم أ');
  assert.equal(linkOf(wB, profB, SUN, 'p1').lessonTitle, 'درس المعلم ب');
  const wA2 = withOverride(wA, { profileId: profA.id, dateKey: SUN, slotKey: 'p1', lessonId: '' });
  assert.equal(linkOf(wA2, profB, SUN, 'p1').lessonTitle, 'درس المعلم أ', 'تصحيح جدول أ لا يمس جدولًا آخر');
});

// ---------- 4) الخادم: الخطط المقترحة (أدمن فقط) + صفوفي ----------
function sheetB64(rows) { const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Plan'); return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })).toString('base64'); }
const PLAN_ROWS = [['العام الدراسي', 'الفصل الدراسي', 'الصف', 'الوحدة', 'اسم الدرس', 'بداية الفترة الزمنية', 'نهاية الفترة الزمنية', 'عدد الحصص المخصصة للدرس'], ['2026/2027', 'الأول', 'الخامس', 'الأولى', 'نشيد', '2026-09-06', '2026-09-17', 2]];
function server(opts = {}) {
  const mem = makeMemoryStores();
  const h = createLessonPlansHandler({ env: {}, authorize: async (r) => { const u = ((r.headers.get('authorization') || '').match(/tok-(.+)$/) || [])[1]; return u ? { ok: true, userId: u, admin: u.startsWith('admin') } : { ok: false, status: 401 }; }, suggested: mem.suggested, prefs: mem.prefs, ...opts });
  const call = async (who, action, method = 'GET', body, q = '') => { const r = await h(new Request(`http://x/api/lesson-plans/${action}${q}`, { method, headers: { authorization: `Bearer tok-${who}`, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }), action); return { status: r.status, ...(await r.json()) }; };
  return { call, mem };
}

test('الخطط المقترحة: الأدمن فقط يرفع/يعدّل/يحذف، والمعلم يتصفح وينزّل فقط', async () => {
  const { call } = server();
  const meta = { grade: 5, semester: S1, year: Y, title: 'خطة مقترحة', lessons: 1 };
  const file = { name: 'plan.xlsx', b64: sheetB64(PLAN_ROWS) };
  const t = await call('teacherA', 'suggested', 'POST', { meta, file });
  assert.equal(t.status, 403); assert.match(t.error, /للأدمن فقط/);
  assert.equal((await call('teacherA', 'status')).admin, false);
  assert.equal((await call('admin1', 'status')).admin, true);
  const a = await call('admin1', 'suggested', 'POST', { meta, file });
  assert.equal(a.status, 200, a.error);
  const list = await call('teacherA', 'suggested');
  assert.equal(list.items.length, 1); assert.equal(list.items[0].grade, 5); assert.equal(list.items[0].uploadedBy, undefined, 'لا تُكشف هوية الأدمن');
  const f = await call('teacherB', 'suggested-file', 'GET', null, `?id=${a.item.id}`);
  assert.equal(f.b64, file.b64, 'الملف يُنزَّل كما رُفع');
  assert.equal((await call('teacherA', 'suggested', 'PATCH', { meta: { title: 'تلاعب' } }, `?id=${a.item.id}`)).status, 403);
  assert.equal((await call('teacherA', 'suggested', 'DELETE', null, `?id=${a.item.id}`)).status, 403);
  assert.equal((await call('admin1', 'suggested', 'PATCH', { meta: { title: 'عنوان جديد' } }, `?id=${a.item.id}`)).item.title, 'عنوان جديد');
  assert.equal((await call('admin1', 'suggested', 'DELETE', null, `?id=${a.item.id}`)).status, 200);
  assert.equal((await call('teacherA', 'suggested')).items.length, 0);
});

test('التحقق من الملف المقترح بالمحتوى لا بالاسم: امتداد مزيف، ملف Word، حجم، بيانات ناقصة', async () => {
  const { call } = server();
  const meta = { grade: 5, semester: S1, year: Y, lessons: 3 };
  const csv = Buffer.from('a,b\n1,2\n').toString('base64');
  assert.match((await call('admin1', 'suggested', 'POST', { meta, file: { name: 'x.xlsx', b64: csv } })).error, /لا يطابق محتواه/);
  assert.match((await call('admin1', 'suggested', 'POST', { meta, file: { name: 'x.pdf', b64: csv } })).error, /Excel فقط/);
  const fakeZip = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from('word/document.xml........')]).toString('base64');
  assert.match((await call('admin1', 'suggested', 'POST', { meta, file: { name: 'x.xlsx', b64: fakeZip } })).error, /ليس جدول Excel/);
  const big = Buffer.alloc(2 * 1024 * 1024 + 10, 65).toString('base64');
  assert.equal((await call('admin1', 'suggested', 'POST', { meta, file: { name: 'x.csv', b64: big } })).status, 413);
  assert.match((await call('admin1', 'suggested', 'POST', { meta: { ...meta, year: '' }, file: { name: 'x.csv', b64: csv } })).error, /العام الدراسي/);
  assert.equal((await call('admin1', 'suggested', 'POST', { meta, file: { name: 'x.csv', b64: csv } })).status, 200);
  assert.equal(sniffSheet(Buffer.from(sheetB64(PLAN_ROWS), 'base64')).kind, 'xlsx');
});

test('«صفوفي» تُحفظ في حساب كل معلم على حدة، وبلا قاعدة بيانات تُرفض الخدمة بوضوح', async () => {
  const { call } = server();
  assert.equal((await call('teacherA', 'prefs')).grades, null);
  assert.deepEqual((await call('teacherA', 'prefs', 'POST', { grades: [6, 5, 5, 99] })).grades, [5, 6]);
  assert.deepEqual((await call('teacherA', 'prefs')).grades, [5, 6]);
  assert.equal((await call('teacherB', 'prefs')).grades, null, 'المعلم الآخر لا يرى صفوف غيره');
  const off = server({ suggested: null, prefs: null });
  assert.equal((await off.call('teacherA', 'suggested')).status, 503);
  assert.equal((await off.call('teacherA', 'prefs')).status, 503);
});

test('خطة مرفوعة كملف Excel حقيقي تُقرأ وتُربط تلقائيًا (من الملف إلى المنبّه)', () => {
  const wb = XLSX.read(Buffer.from(sheetB64([PLAN_ROWS[0], ['2026/2027', 'الأول', 'الخامس', 'الأولى', 'الميزان', '2026-11-08', '2026-11-12', 3]]), 'base64'));
  const grid = XLSX.utils.sheet_to_json(wb.Sheets.Plan, { header: 1, raw: true, defval: '' });
  const r = parsePlanGrid(grid); assert.equal(r.ok, true, r.error);
  const d = r.drafts[0];
  const w = normalizeWorkspace({ plans: [normalizePlan({ year: d.year, semester: d.semester, grade: d.grade, units: d.units })] });
  assert.equal(linkOf(w, schedule(), '2026-11-11', 'p3').lessonTitle, 'الميزان');
  assert.equal(linkOf(w, schedule(), '2026-11-11', 'p3').part, 3);
});

// ---------- 5) إشعارات المنبّه مفعّلة افتراضيًا ----------
test('إشعارات المنبّه مفعّلة افتراضيًا، ولا تتوقف إلا بقرار المعلم من إعدادات الأداة', () => {
  const d = defaultSettings();
  assert.deepEqual([d.enabled, d.sound, d.visual, d.system, d.planReminders.on], [true, true, true, true, true]);
  const fromOld = normalizeSettings({ planReminders: { on: false } });     // قيمة افتراضية قديمة لم يخترها المعلم
  assert.equal(fromOld.planReminders.on, true);
  const chosen = normalizeSettings({ enabled: false, system: false, planReminders: { on: false, userSet: true } });
  assert.deepEqual([chosen.enabled, chosen.system, chosen.planReminders.on], [false, false, false]);
  assert.equal(normalizeSettings({}).enabled, true);
});
