// اختبارات وحدات «الكتاب التفاعلي الذكي»: تخطيط الصفحات، البحث، التعليقات، واستخراج النص.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { viewPages, viewOf, firstView, lastView, slotsOf, sideOf, flipPlan, viewCount } from '../src/modules/interactive-book/core/layout.js';
import { normalize, searchTexts } from '../src/modules/interactive-book/core/search.js';
import { makeShape, extend, meaningful, hits, History } from '../src/modules/interactive-book/core/annotations.js';
import { textFromItems } from '../src/modules/interactive-book/core/pdf.js';
import { guessDirection } from '../src/modules/interactive-book/core/process.js';

test('الصفحتان المتقابلتان: الغلاف وحده ثم أزواج، والأخيرة وحدها عند العدد الزوجي', () => {
  assert.deepEqual(viewPages(0, 10, 'double'), [1]);
  assert.deepEqual(viewPages(1, 10, 'double'), [2, 3]);
  assert.deepEqual(viewPages(5, 10, 'double'), [10]);
  assert.equal(lastView(10, 'double'), 5); assert.equal(lastView(11, 'double'), 5);
  assert.deepEqual(viewPages(5, 11, 'double'), [10, 11]);
  assert.equal(viewCount(10, 'double'), 6); assert.equal(firstView('double'), 0);
  assert.equal(viewOf(7, 'double'), 3); assert.equal(viewOf(7, 'single'), 7);
});

test('الاتجاه العربي: الصفحة الأولى من الزوج يمينًا، والغلاف في جهة التقليب', () => {
  assert.deepEqual(slotsOf(1, 10, 'double'), { first: 2, second: 3 });
  assert.equal(sideOf('first', 'rtl'), 'right'); assert.equal(sideOf('second', 'rtl'), 'left');
  assert.equal(sideOf('first', 'ltr'), 'left');
  assert.deepEqual(slotsOf(0, 10, 'double'), { second: 1 });
});

test('خطة التقليب: الوجه والظهر وما تحت الورقة', () => {
  assert.deepEqual(flipPlan(1, 2, 10, 'double'), { forward: true, front: 3, back: 4, under: 5, stay: 2 });
  assert.deepEqual(flipPlan(2, 1, 10, 'double'), { forward: false, front: 4, back: 3, under: 2, stay: 5 });
  assert.deepEqual(flipPlan(0, 1, 10, 'double'), { forward: true, front: 1, back: 2, under: 3, stay: null });
  assert.equal(flipPlan(3, 4, 10, 'single').under, 4);
});

test('البحث يتجاهل التشكيل والهمزات والتاء المربوطة وأشكال العرض', () => {
  assert.equal(normalize('مُوسِيقَى'), normalize('موسيقي'));
  assert.equal(normalize('ﺍﻟﻤﻮﺳﻴﻘﻰ'), normalize('الموسيقي'));
  const r = searchTexts(['لا شيء هنا', 'درس عن الإيقاع الثنائي والإيقاع الثلاثي', 'مقدمة'], 'الايقاع');
  assert.equal(r.length, 1); assert.equal(r[0].page, 2); assert.equal(r[0].count, 2);
  assert.equal(r[0].snippet.match, 'الإيقاع');
  assert.deepEqual(searchTexts(['abc'], 'a'), []);
});

test('النص المستخرج من حروف منفصلة بترتيب بصري يعود كلمات صحيحة', () => {
  // «الدرس 12» مكتوبًا حرفًا حرفًا من اليسار لليمين (كما تفعل بعض البرامج)
  const word = 'ﺱﺭﺪﻟﺍ'; // بصريًا: س ر د ل ا
  const items = [];
  let x = 100;
  for (const ch of ['1', '2']) { items.push({ str: ch, transform: [10, 0, 0, 10, x, 500], width: 6 }); x += 6; }
  x += 6;
  for (const ch of word) { items.push({ str: ch, transform: [10, 0, 0, 10, x, 500], width: 6 }); x += 6; }
  assert.equal(normalize(textFromItems(items)), normalize('الدرس 12'));
  assert.equal(textFromItems([{ str: 'تاريخ اإلصدار', transform: [10, 0, 0, 10, 0, 0], width: 60 }]), 'تاريخ الإصدار');
});

test('اتجاه الكتاب يُستنتج من لغة نصه', () => {
  assert.equal(guessDirection(['هذا كتاب عربي '.repeat(30)]), 'rtl');
  assert.equal(guessDirection(['This is an English music theory book '.repeat(20)]), 'ltr');
  assert.equal(guessDirection(['']), 'rtl');
});

test('التعليقات: رسم ومسح وتراجع', () => {
  const s = makeShape('pen', '#000', 4, [0.1, 0.1]);
  extend(s, [0.5, 0.5]); extend(s, [0.9, 0.9]);
  assert.ok(meaningful(s));
  assert.ok(hits(s, [0.3, 0.3], 0.02)); assert.ok(!hits(s, [0.9, 0.1], 0.02));
  const r = makeShape('rect', '#000', 4, [0.2, 0.2]); extend(r, [0.6, 0.6]);
  assert.ok(hits(r, [0.2, 0.4], 0.02)); assert.ok(!hits(r, [0.4, 0.4], 0.02), 'داخل المستطيل الفارغ لا يُمسح');
  const tiny = makeShape('arrow', '#000', 4, [0.2, 0.2]); extend(tiny, [0.201, 0.2]);
  assert.ok(!meaningful(tiny));
  const h = new History();
  h.push({ page: 1, before: [], after: [s] }); h.push({ page: 1, before: [s], after: [s, r] });
  assert.deepEqual(h.popUndo().before, [s]); assert.ok(h.canRedo());
  assert.deepEqual(h.popRedo().after, [s, r]); assert.ok(!h.canRedo());
});
