// مكتبة «الخطط الدراسية المقترحة» المدمجة (24 ملف Excel من النشرة الوزارية 2026-2027)
//   node --test tests/suggested-library.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import * as XLSX from '../node_modules/xlsx/xlsx.mjs';
import { SUGGESTED_LIBRARY } from '../src/modules/lesson-plans/data/suggestedLibrary.js';
import { parsePlanGrid } from '../src/modules/lesson-plans/core/importPlan.js';
import { parseDate } from '../src/modules/lesson-plans/core/dates.js';
import { normalizeWorkspace, normalizePlan } from '../src/modules/lesson-plans/core/model.js';
import { planWindows } from '../src/modules/lesson-plans/core/auto.js';

const SRC = JSON.parse(fs.readFileSync(new URL('./lesson-plans/fixtures/ministry-plans-2026-2027.json', import.meta.url), 'utf8'));
const GN = ['الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس', 'السابع', 'الثامن', 'التاسع', 'العاشر', 'الحادي عشر', 'الثاني عشر'];
const pub = (u) => new URL(`../public${u}`, import.meta.url);
const W1 = { 'الفصل الدراسي الأول': '2026-09-06', 'الفصل الدراسي الثاني': '2027-01-31' };
const addDays = (k, n) => { const d = new Date(`${k}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const nb = (t) => t.replace(/[أإآ]/g, 'ا').replace(/[ًٌٍَُِّْـ]/g, '').replace(/[()«»"'.\-–\s]/g, '');

function readLikeTheApp(u) {
  const wb = XLSX.read(fs.readFileSync(pub(u)), { type: 'buffer', cellDates: true });
  const grids = wb.SheetNames.filter((n) => !/تعليمات|instructions/i.test(n)).map((n) => XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: '', blankrows: false }));
  return { wb, grids };
}

test('24 ملفًا: لكل صف من الأول إلى الثاني عشر ملف مستقل لكل فصل، وكلها موجودة ضمن public (تُنشر مع التطبيق)', () => {
  assert.equal(SUGGESTED_LIBRARY.length, 24);
  for (let g = 1; g <= 12; g++) for (const s of Object.keys(W1)) {
    const it = SUGGESTED_LIBRARY.filter((x) => x.grade === g && x.semester === s);
    assert.equal(it.length, 1, `${g} ${s}`);
    const buf = fs.readFileSync(pub(it[0].url));
    assert.equal(buf.length, it[0].size);
    assert.equal(crypto.createHash('sha256').update(buf).digest('hex').slice(0, 16), it[0].sha256);
    assert.match(it[0].url, /^\/suggested-plans\/grade-\d{2}\/semester-[12]\.xlsx$/);
    assert.equal(it[0].fileName, `الصف ${GN[g - 1]} - ${s}.xlsx`);
  }
});

test('بيانات النشرة المنقولة: كل تاريخ داخل أسبوعه الدراسي (الأحد–الخميس) والأسابيع متسلسلة بلا تداخل', () => {
  let rows = 0, conflicts = 0;
  for (const [k, list] of Object.entries(SRC)) {
    const sem = k.split('|')[1];
    let prevEnd = '', maxWeek = 0;
    for (const r of list) {
      rows++;
      const ws = addDays(W1[sem], (r.week - 1) * 7), we = addDays(ws, 4);
      assert.ok(r.week >= maxWeek && r.week <= maxWeek + 1, `${k} تسلسل الأسبوع ${r.week}`);
      maxWeek = r.week;
      if (!r.start) { conflicts++; continue; }
      assert.ok(ws <= r.start && r.start <= r.end && r.end <= we, `${k} أسبوع ${r.week}: ${r.start}..${r.end} خارج ${ws}..${we}`);
      assert.ok(r.start > prevEnd, `${k} تداخل عند ${r.start}`);
      prevEnd = r.end;
    }
  }
  assert.equal(rows, 441);
  assert.equal(conflicts, 2, 'صفّا التعارض الموثّقان في الصف الثاني عشر/الفصل الأول فقط');
});

test('كل ملف يُقرأ بنفس قارئ الأداة: الصف والفصل والعام صحيحة، والدروس والتواريخ وعدد الحصص تطابق المصدر', () => {
  for (const it of SUGGESTED_LIBRARY) {
    const { grids } = readLikeTheApp(it.url);
    const r = parsePlanGrid(grids[0]);
    assert.equal(r.ok, true, it.url);
    assert.equal(r.drafts.length, 1);
    const d = r.drafts[0];
    assert.deepEqual([d.grade, d.semester, d.year], [`الصف ${GN[it.grade - 1]}`, it.semester, '2026/2027']);
    assert.deepEqual(d.altLabels, ['مدارس الفترة الواحدة', 'مدارس الفترتين']);
    const exp = [];
    for (const x of SRC[`${it.grade}|${it.semester}`]) {
      const l = exp[exp.length - 1];
      if (l && nb(l.title) === nb(x.lesson) && l.unit === x.unit) { l.s += x.s1; l.s2 += x.s2; if (x.start) { l.start = l.start || x.start; l.end = x.end; } } else exp.push({ title: x.lesson, unit: x.unit, s: x.s1, s2: x.s2, start: x.start, end: x.end });
    }
    const got = d.units.flatMap((u) => u.lessons.map((l) => ({ ...l, unit: u.title })));
    assert.equal(got.length, exp.length, it.url);
    got.forEach((l, i) => {
      assert.equal(nb(l.title), nb(exp[i].title));
      assert.equal(l.unit, `الوحدة ${exp[i].unit}`);
      assert.deepEqual([l.sessions, l.sessionsAlt], [exp[i].s, exp[i].s2]);
      assert.deepEqual([l.start, l.end], [exp[i].start || '', exp[i].end || '']);
    });
  }
});

test('الرموز الموسيقية (خارج المستوى الأساسي مثل 𝄽 و𝅗𝅥) تُقرأ سليمة من ملفات المكتبة', () => {
  const { grids } = readLikeTheApp('/suggested-plans/grade-02/semester-1.xlsx');
  const cells = grids[0].flat().filter((c) => typeof c === 'string');
  assert.ok(cells.some((c) => c.includes('(𝅗𝅥)') && c.includes('(𝄼)')));
  assert.ok(!cells.some((c) => /[\uD800-\uDFFF]/.test(c.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, ''))), 'لا أنصاف أزواج بديلة');
});

test('ورقة «تعليمات ومصدر الخطة» تحمل المصدر ولا يقرؤها المحلّل كخطة', () => {
  const { wb } = readLikeTheApp('/suggested-plans/grade-12/semester-1.xlsx');
  assert.deepEqual(wb.SheetNames, ['الخطة', 'تعليمات ومصدر الخطة']);
  const t = XLSX.utils.sheet_to_json(wb.Sheets['تعليمات ومصدر الخطة'], { header: 1 }).flat().join(' ');
  assert.match(t, /وزارة التربية والتعليم بسلطنة عُمان/);
  assert.match(t, /تعارض/);
  const plan = XLSX.utils.sheet_to_json(wb.Sheets['الخطة'], { header: 1 }).flat().join(' ');
  assert.match(plan, /أُعيد تنظيم الملف إلكترونيًا بصيغة Excel/);
});

test('خطة مكتبة معتمدة كخطة معلم تُنتج فترات ربط صحيحة (الصف الحادي عشر: دروس داخل الأسبوع الواحد)', () => {
  const { grids } = readLikeTheApp('/suggested-plans/grade-11/semester-1.xlsx');
  const d = parsePlanGrid(grids[0]).drafts[0];
  const ws = normalizeWorkspace({ plans: [normalizePlan({ ...d, units: d.units })] });
  const w = planWindows(ws.plans[0]);
  const harm = w.find((x) => x.lesson.title === 'عزف الألحان الهارمونية');
  assert.deepEqual([harm.start, harm.end, harm.lesson.sessions], ['2026-10-21', '2026-11-03', 10]);
});

test('تواريخ Excel التي تصل قبل منتصف الليل بثوانٍ (SheetJS) لا ترجع يومًا للخلف', () => {
  assert.equal(parseDate(new Date(2026, 8, 12, 23, 59, 48)), '2026-09-13');
  assert.equal(parseDate(new Date(2026, 8, 13, 0, 0, 12)), '2026-09-13');
});
