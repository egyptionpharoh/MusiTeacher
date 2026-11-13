// اختبارات منبّه الحصص الذكي (النواة):  node --test tests/class-alarm.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { zonedToMs, zonedParts, parseHHMM, fmtTime, addDays, weekdayOf, afterWords, MIN } from '../src/modules/class-alarm/core/time.js';
import { emptyProfile, normalizeProfile, normalizeStore, generatePeriods, defaultSettings, normalizeSettings, cloneProfile, classLabel } from '../src/modules/class-alarm/core/model.js';
import { resolveDay, alertsForDay, dayStatus, weekStats, upcomingAlerts } from '../src/modules/class-alarm/core/schedule.js';
import { decide, record, nextDue } from '../src/modules/class-alarm/core/engine.js';
import { parseGrid, parseLessonText, timeRange, periodNo, dayIndex, fromAI, csvToGrid, docxTables, applyDraft } from '../src/modules/class-alarm/core/parse.js';
import { buildICS } from '../src/modules/class-alarm/core/ics.js';

const TZ = 'Asia/Muscat';
const SUN = '2026-11-08'; // الأحد
const at = (k, t) => zonedToMs(k, t, TZ);

function sample() {
  const p = emptyProfile({ teacher: 'أ. حسين', school: 'مدرسة طلحة', subject: 'المهارات الموسيقية' }, new Date('2026-11-08T03:00:00Z'));
  p.lessons = { 0: { p1: { grade: 'الصف الخامس', section: '1' }, p2: { grade: 'الصف الخامس', section: '2' }, p5: { grade: 'الصف السادس', section: '1', note: 'إحضار الأورغ' } }, 1: { p3: { grade: 'الصف 7', section: '3' } } };
  return normalizeProfile(p);
}

test('المنطقة الزمنية: 7:30 في مسقط = 03:30 UTC', () => {
  assert.equal(new Date(at(SUN, '07:30')).toISOString(), '2026-11-08T03:30:00.000Z');
  const p = zonedParts(Date.parse('2026-11-08T20:30:00Z'), TZ);
  assert.equal(p.dateKey, '2026-11-09'); assert.equal(p.wd, 1); assert.equal(p.hh, 0);
  // القاهرة صيفًا (توقيت صيفي) وشتاءً
  assert.equal(new Date(zonedToMs('2026-07-01', '08:00', 'Africa/Cairo')).toISOString(), '2026-07-01T05:00:00.000Z');
  assert.equal(new Date(zonedToMs('2026-12-01', '08:00', 'Africa/Cairo')).toISOString(), '2026-12-01T06:00:00.000Z');
});

test('قراءة الأوقات والأرقام العربية', () => {
  assert.equal(parseHHMM('٧:٣٠'), 450); assert.equal(parseHHMM('1:10 م'), 790); assert.equal(parseHHMM('12:05 ص'), 5);
  assert.equal(parseHHMM('7.30'), 450); assert.equal(parseHHMM('25:00'), null);
  assert.equal(fmtTime('13:05'), '1:05 م'); assert.equal(fmtTime('07:30'), '7:30 ص');
  assert.deepEqual(timeRange('8:10 - 7:30'), { start: '07:30', end: '08:10' });
  assert.deepEqual(timeRange('١٢:٣٠ – ١:١٠'), { start: '12:30', end: '13:10' });
  assert.equal(afterWords(2), 'بعد دقيقتين'); assert.equal(afterWords(10), 'بعد 10 دقائق');
  assert.equal(weekdayOf(SUN), 0); assert.equal(addDays('2026-12-31', 1), '2027-01-01');
});

test('توليد التوقيت مع الفسحة', () => {
  const ps = generatePeriods({ first: '07:30', duration: 40, count: 8, breaks: [{ after: 3, minutes: 20 }] });
  assert.equal(ps.filter((p) => p.kind === 'lesson').length, 8);
  assert.equal(ps[3].kind, 'break'); assert.equal(ps[3].start, '09:30'); assert.equal(ps[4].start, '09:50');
  assert.equal(ps.at(-1).end, '13:10');
  const def = generatePeriods();
  assert.equal(def[4].kind, 'break', 'الفسحة الافتراضية بعد الحصة الرابعة');
  assert.equal(def[4].start, '10:10'); assert.equal(def[5].start, '10:30');
});

test('اليوم: الحصص والفراغ والفسحة بمواعيد مطلقة', () => {
  const day = resolveDay(sample(), SUN);
  assert.equal(day.isWorkday, true);
  const l = day.events.filter((e) => e.type === 'lesson');
  assert.equal(l.length, 3);
  assert.equal(l[0].startMs, at(SUN, '07:30'));
  assert.equal(l[0].cls, 'الصف الخامس – الشعبة 1');
  assert.ok(day.events.some((e) => e.type === 'break'));
  assert.equal(resolveDay(sample(), '2026-11-13').isWorkday, false, 'الجمعة عطلة');
});

test('التنبيهات: 10 دقائق ودقيقتان قبل كل حصة بنص مفيد', () => {
  const p = sample(); const s = defaultSettings();
  const al = alertsForDay(p, s, SUN);
  assert.equal(al.length, 6);
  assert.equal(al[0].due, at(SUN, '07:20'));
  assert.equal(al[1].due, at(SUN, '07:28'));
  assert.match(al[0].body, /المهارات الموسيقية – الصف الخامس – الشعبة 1/);
  assert.match(al[0].body, /تبدأ بعد 10 دقائق/);
  assert.match(al[0].body, /مدرسة: طلحة/);
  assert.match(al.find((a) => a.eventKey === 'p5').body, /إحضار الأورغ/);
  // نهاية الحصة + بدايتها
  p.plan.start.on = true; p.plan.end.on = true; p.plan.end.min = 5;
  const al2 = alertsForDay(p, s, SUN);
  assert.equal(al2.length, 12);
  assert.ok(al2.some((a) => a.type === 'end' && a.due === at(SUN, '08:05')));
});

test('تعديل اليوم فقط لا يغيّر الجدول الأساسي', () => {
  const p = sample();
  p.overrides[SUN] = { cancelled: { p2: true }, changed: { p1: { start: '07:45', end: '08:25' } }, extra: [{ kind: 'meeting', title: 'اجتماع المعلمين', start: '13:20', end: '14:00' }] };
  const n = normalizeProfile(p);
  const al = alertsForDay(n, defaultSettings(), SUN);
  assert.ok(!al.some((a) => a.eventKey === 'p2'), 'الملغاة لا تنبه');
  assert.equal(al.find((a) => a.eventKey === 'p1').due, at(SUN, '07:35'));
  assert.ok(al.some((a) => /اجتماع/.test(a.title)));
  const next = alertsForDay(n, defaultSettings(), addDays(SUN, 7));
  assert.equal(next.find((a) => a.eventKey === 'p1').due, at(addDays(SUN, 7), '07:20'), 'الأسبوع التالي بالتوقيت الأصلي');
  assert.ok(next.some((a) => a.eventKey === 'p2'));
});

test('الإيقاف: كتم اليوم، الإجازات، الإيقاف المؤقت، فترة السماح، كتم حصة', () => {
  const p = sample(); const s = defaultSettings();
  p.overrides[SUN] = { muted: true };
  assert.equal(alertsForDay(normalizeProfile(p), s, SUN).length, 0);
  const h = sample(); h.holidays = [{ name: 'العيد الوطني', from: '2026-11-08', to: '2026-11-10' }];
  assert.equal(alertsForDay(normalizeProfile(h), s, SUN).length, 0);
  assert.equal(resolveDay(normalizeProfile(h), SUN).holiday.name, 'العيد الوطني');
  assert.equal(alertsForDay(sample(), { ...s, pausedUntil: at(SUN, '08:00') }, SUN).length, 4);
  assert.equal(alertsForDay(sample(), { ...s, quiet: { on: true, from: '07:25', to: '15:00' } }, SUN).length, 5);
  assert.equal(alertsForDay(sample(), { ...s, enabled: false }, SUN).length, 0);
  const m = sample(); m.lessons[0].p1.muted = true;
  assert.equal(alertsForDay(normalizeProfile(m), s, SUN).length, 4);
});

test('المحرك: لا تكرار، لا تنبيه متأخر، والحصص المتتالية', () => {
  const al = alertsForDay(sample(), defaultSettings(), SUN);
  let fired = {};
  let d = decide(at(SUN, '07:19'), al, fired); assert.equal(d.fire.length, 0);
  d = decide(at(SUN, '07:20') + 2000, al, fired); assert.equal(d.fire.length, 1); fired = record(fired, d, at(SUN, '07:20'));
  d = decide(at(SUN, '07:20') + 5000, al, fired); assert.equal(d.fire.length, 0, 'لا تكرار');
  // تبويب معلَّق: نبضة متأخرة 60 ثانية داخل فترة السماح → يرن
  d = decide(at(SUN, '07:29'), al, fired); assert.equal(d.fire.length, 1);
  fired = record(fired, d, at(SUN, '07:29'));
  // عودة بعد غياب طويل: تنبيهات الحصة الثانية فاتت → تُسجل فائتة ولا ترن
  d = decide(at(SUN, '08:30'), al, fired); assert.equal(d.fire.length, 0); assert.equal(d.miss.length, 2);
  // «قبل» لا يرن بعد بداية الحصة حتى داخل فترة السماح
  const one = [{ id: 'x', due: 1000, type: 'before', startMs: 1500 }];
  assert.equal(decide(1600, one, {}).fire.length, 0);
  assert.equal(nextDue(al, {}, at(SUN, '07:00')), at(SUN, '07:20'));
  assert.equal(nextDue(al, fired, at(SUN, '07:00')), at(SUN, '08:00'));
});

test('حالة اللوحة: قبل اليوم، أثناء الحصة، الفسحة، بعد اليوم، اليوم التالي', () => {
  const p = sample();
  assert.equal(dayStatus(p, at(SUN, '06:00')).phase, 'before');
  const s = dayStatus(p, at(SUN, '07:40'));
  assert.equal(s.phase, 'lesson'); assert.equal(s.current.key, 'p1'); assert.equal(s.next.key, 'p2');
  assert.equal(dayStatus(p, at(SUN, '10:15')).phase, 'break');
  assert.equal(dayStatus(p, at(SUN, '09:00')).phase, 'gap');
  const after = dayStatus(p, at(SUN, '14:00'));
  assert.equal(after.phase, 'after'); assert.equal(after.upcoming.dateKey, '2026-11-09'); assert.equal(after.upcoming.event.key, 'p3');
  const fri = dayStatus(p, at('2026-11-13', '09:00'));
  assert.equal(fri.phase, 'off'); assert.equal(fri.upcoming.dateKey, '2026-11-15');
});

test('منتصف الليل: تنبيهات الغد ضمن المراقبة', () => {
  const p = sample();
  const al = upcomingAlerts(p, defaultSettings(), at(SUN, '23:59'));
  assert.ok(al.some((a) => a.dateKey === '2026-11-09'));
});

test('إحصاء الأسبوع', () => {
  const w = weekStats(sample());
  assert.equal(w.lessons, 4); assert.equal(w.minutes, 160); assert.equal(w.busiestDay, 0);
});

test('التطبيع يحمي من البيانات التالفة', () => {
  const st = normalizeStore({ profiles: [{ periods: [{ start: 'x' }], lessons: { 9: {} }, overrides: { bad: {} }, holidays: [{ from: 'no' }] }], settings: { volume: 9 } });
  assert.equal(st.profiles.length, 1); assert.equal(st.settings.volume, 1);
  assert.deepEqual(st.profiles[0].overrides, {}); assert.equal(st.profiles[0].holidays.length, 0);
  assert.equal(normalizeStore(null).profiles.length, 1);
  assert.equal(normalizeSettings({ repeat: { on: false } }).repeat.on, false);
  assert.equal(normalizeSettings({}).repeat.on, true);
  const c = cloneProfile(sample()); assert.notEqual(c.id, sample().id); assert.equal(c.lessons[0].p1.section, '1');
  assert.equal(classLabel({ grade: '5', section: 'أ' }), 'الصف 5 – الشعبة أ');
});

test('استيراد: جدول أيام × حصص كما في جداول المدارس', () => {
  const grid = [
    ['جدول المعلم', '', '', '', ''],
    ['اليوم / الحصة', 'الأولى', 'الثانية', 'الفسحة', 'الثالثة'],
    ['', '7:30 - 8:10', '8:10 - 8:50', '8:50 - 9:10', '٩:١٠ - ٩:٥٠'],
    ['الأحد', '5/1', '٥/٢', '', ''],
    ['الاثنين', '', 'سادس 3', '', 'موسيقى 7/1'],
    ['الثلاثاء', '', '', '', ''],
  ];
  const r = parseGrid(grid);
  assert.equal(r.ok, true, r.error);
  assert.deepEqual(r.draft.days, [0, 1, 2]);
  assert.equal(r.draft.periods.filter((p) => p.kind === 'lesson').length, 3);
  assert.equal(r.draft.periods.find((p) => p.kind === 'break').start, '08:50');
  assert.equal(r.draft.lessons[0].p1.grade, 'الصف 5'); assert.equal(r.draft.lessons[0].p2.section, '2');
  assert.equal(r.draft.lessons[1].p2.grade, 'الصف السادس'); assert.equal(r.draft.lessons[1].p2.section, '3');
  assert.equal(r.draft.lessons[1].p3.subject, 'موسيقى');
  const p = normalizeProfile(applyDraft(emptyProfile(), r.draft));
  assert.equal(alertsForDay(p, defaultSettings(), SUN).length, 4);
});

test('استيراد: جدول مقلوب (الأيام أعمدة) وبلا أوقات → تنبيه للمراجعة', () => {
  const grid = [['الحصة', 'الأحد', 'الاثنين'], ['1', '10/2', ''], ['2', '', '9/1'], ['3', 'نشاط', '']];
  const r = parseGrid(grid);
  assert.equal(r.ok, true);
  assert.equal(r.draft.lessons[1].p2.grade, 'الصف 9');
  assert.ok(r.issues.some((i) => /توقيت/.test(i)));
  assert.equal(r.draft.periods[0].start, '');
});

test('استيراد: صيغة القائمة و CSV', () => {
  const g = csvToGrid('اليوم,الحصة,من,إلى,الصف,الشعبة\nالأحد,1,07:30,08:10,5,1\nالخميس,2,08:10,08:50,6,"2"\n');
  const r = parseGrid(g);
  assert.equal(r.ok, true); assert.deepEqual(r.draft.days, [0, 4]);
  assert.equal(r.draft.lessons[4].p2.section, '2'); assert.equal(r.draft.periods[1].end, '08:50');
  assert.equal(parseGrid([['لا شيء هنا']]).ok, false);
});

test('استيراد: Word (جداول document.xml)', () => {
  const xml = '<w:body><w:tbl><w:tr><w:tc><w:p><w:r><w:t>اليوم</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>الأولى</w:t></w:r></w:p></w:tc></w:tr><w:tr><w:tc><w:p><w:r><w:t>الأحد</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>5/</w:t></w:r><w:r><w:t>1</w:t></w:r></w:p></w:tc></w:tr><w:tr><w:tc><w:p><w:r><w:t>الاثنين</w:t></w:r></w:p></w:tc><w:tc><w:p/></w:tc></w:tr></w:tbl></w:body>';
  const t = docxTables(xml);
  assert.deepEqual(t[0][1], ['الأحد', '5/1']);
  assert.equal(parseGrid(t[0]).draft.lessons[0].p1.section, '1');
});

test('قراءة خانة الحصة', () => {
  assert.deepEqual(parseLessonText('٥/١'), { subject: '', grade: 'الصف 5', section: '1', room: '' });
  assert.equal(parseLessonText('الصف الخامس الأساسي - 2').grade, 'الصف الخامس');
  assert.equal(parseLessonText('العاشر/أ').section, 'ا');
  assert.equal(parseLessonText('—'), null);
  assert.equal(parseLessonText('7/3 قاعة الموسيقى').room, 'قاعة الموسيقى');
  assert.equal(dayIndex('يوم الأربعاء'), 3); assert.equal(periodNo('الحصة الثانية'), 2); assert.equal(periodNo('الحادية عشرة'), 11);
});

test('رد الذكاء الاصطناعي → مسودة مع تعليم غير المؤكد', () => {
  const r = fromAI({ teacher: 'منى', days: ['الأحد', 'الاثنين'], periods: [{ no: 1, start: '7:30', end: '8:10' }, { no: 2, start: '8:10', end: '' }, { kind: 'break', start: '8:50', end: '9:10' }],
    lessons: [{ day: 'الأحد', period: 1, grade: '5', section: '1' }, { day: 'الاثنين', period: 2, raw: '6/2', uncertain: true }, { day: 'الاثنين', period: 4, grade: '7', section: '1' }] });
  assert.equal(r.ok, true);
  assert.equal(r.draft.lessons[1].p2.grade, 'الصف 6'); assert.equal(r.draft.lessons[1].p2.uncertain, true);
  assert.ok(r.draft.periods.some((p) => p.id === 'p4' && p.uncertain));
  assert.equal(r.draft.periods.find((p) => p.id === 'p2').uncertain, true);
  assert.equal(r.draft.teacher, 'منى');
});

test('ملف التقويم ICS: تكرار أسبوعي + تنبيهات + استثناءات', () => {
  const p = sample();
  p.holidays = [{ name: 'إجازة', from: '2026-11-18', to: '2026-11-19' }];
  p.overrides['2026-11-15'] = { changed: { p1: { start: '08:00', end: '08:40' } } };
  const { text, count } = buildICS(normalizeProfile(p), { from: SUN, weeks: 4, now: Date.parse('2026-11-08T00:00:00Z') });
  assert.equal(count, 5);
  assert.match(text, /RRULE:FREQ=WEEKLY;BYDAY=SU;UNTIL=/);
  assert.match(text, /TRIGGER:-PT10M/); assert.match(text, /TRIGGER:-PT2M/);
  assert.match(text, /DTSTART;TZID=Asia\/Muscat:20261108T073000/);
  assert.match(text, /EXDATE;TZID=Asia\/Muscat:20261115T073000/);
  assert.match(text, /DTSTART;TZID=Asia\/Muscat:20261115T080000/);
  assert.ok(text.split('\r\n').every((l) => new TextEncoder().encode(l).length <= 75));
});

test('الجدول المنسق: كل القوالب تحمل اسم المعلم والمدرسة والحصص', async () => {
  const { buildSheet, TEMPLATES, listRows } = await import('../src/modules/class-alarm/core/sheet.js');
  const p = sample();
  for (const t of TEMPLATES) {
    const { html } = buildSheet(p, { template: t.id });
    assert.match(html, /مدرسة طلحة/); assert.match(html, /أ\. حسين/); assert.match(html, /الخامس \/ 1/);
    assert.match(html, /rowspan="5"/, 'الفسحة عمود مدمج');
    assert.ok(!/<script/i.test(html));
  }
  const x = buildSheet({ ...p, school: '<img onerror=x>' });
  assert.ok(!x.html.includes('<img onerror'), 'تهريب النصوص');
  assert.equal(listRows(p).length, 5);
});

test('Word وPDF: ملفات سليمة البنية', async () => {
  const fs = await import('node:fs');
  const { buildScheduleDocx } = await import('../src/modules/class-alarm/core/docx.js');
  const { unzipEntry } = await import('../src/modules/class-alarm/core/zip.js');
  const { jpegToPdf } = await import('../src/modules/class-alarm/core/pdf.js');
  const docx = await buildScheduleDocx(sample());
  const xml = new TextDecoder().decode(await unzipEntry(docx, 'word/document.xml'));
  assert.match(xml, /<w:bidiVisual\/>/); assert.match(xml, /الخامس \/ 1/); assert.match(xml, /w:orient="landscape"/);
  const jpg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
  const pdf = new TextDecoder('latin1').decode(jpegToPdf(jpg, 2246, 1588));
  assert.match(pdf, /^%PDF-1\.4/); assert.match(pdf, /\/DCTDecode/); assert.match(pdf, /%%EOF\n$/);
  if (process.env.CA_DUMP) { fs.mkdirSync('tests/class-alarm/_dist', { recursive: true }); fs.writeFileSync('tests/class-alarm/_dist/sample.docx', docx); }
});

test('الخادم: الصلاحية، القراءة الذكية معطلة افتراضيًا، المزامنة', async () => {
  const { createClassAlarmHandler } = await import('../src/modules/class-alarm/server/http.js');
  const db = new Map();
  const store = { get: async (u) => db.get(u) || null, put: async (u, data, updatedAt) => db.set(u, { data, updatedAt }), remove: async (u) => db.delete(u) };
  const authorize = async (r) => (r.headers.get('authorization') === 'Bearer good' ? { ok: true, userId: 'u1' } : { ok: false, status: 401, error: 'x' });
  const req = (method, body, tok = 'good') => new Request('http://x/api', { method, headers: { authorization: `Bearer ${tok}`, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  let h = createClassAlarmHandler({ authorize, store, env: {} });
  assert.equal((await h(req('GET', null, 'bad'), 'status')).status, 401);
  let r = await (await h(req('GET'), 'status')).json();
  assert.equal(r.ai, false); assert.equal(r.sync, true);
  const ex = await h(req('POST', { kind: 'text', text: 'الأحد | 5/1' }), 'extract');
  assert.equal(ex.status, 503);
  assert.match((await ex.json()).error, /غير مفعّلة/);
  assert.equal((await h(req('POST', { store: { profiles: [{ id: 'a' }] } }), 'sync')).status, 200);
  r = await (await h(req('GET'), 'sync')).json();
  assert.equal(r.store.profiles[0].id, 'a');
  assert.equal((await h(req('POST', { store: { nope: 1 } }), 'sync')).status, 400);
  await h(req('DELETE'), 'sync');
  assert.equal((await (await h(req('GET'), 'sync')).json()).store, null);

  // مزوّد وهمي: Gemini يعيد جدولًا → يُنظَّف ويُعاد
  const fakeFetch = async (url, init) => {
    const body = JSON.parse(init.body);
    assert.ok(body.contents[0].parts[0].inline_data, 'الصورة مرسلة كبيانات');
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ found: true, teacher: '', school: '', subject: '', days: ['الأحد'], periods: [{ no: 1, kind: 'lesson', name: '', start: '07:30', end: '08:10', uncertain: false }], lessons: [{ day: 'الأحد', period: 1, subject: '', grade: '5', section: '1', room: '', raw: '5/1', uncertain: false }], warnings: [] }) }] } }] }), { status: 200 });
  };
  h = createClassAlarmHandler({ authorize, store, env: { CA_AI_ENABLED: 'true', GEMINI_API_KEY: 'k' }, fetchImpl: fakeFetch });
  assert.equal((await (await h(req('GET'), 'status')).json()).ai, true);
  r = await (await h(req('POST', { kind: 'image', mime: 'image/jpeg', data: 'AAAA' }), 'extract')).json();
  assert.equal(r.ok, true); assert.equal(r.provider, 'Gemini');
  const draft = fromAI(r.schedule);
  assert.equal(draft.draft.lessons[0].p1.section, '1');
  assert.equal((await h(req('POST', { kind: 'image', mime: 'image/gif', data: 'AAAA' }), 'extract')).status, 400);
});
