// node --test tests/oriental/
import test from 'node:test';
import assert from 'node:assert/strict';
import { MAQAMAT, degreesOf, shiftsFor, tuningFor, keyOfQ } from '../../private-games/oriental-organ-piano/js/maqamat.mjs';
import { pitchOf, easternName, midiToHz } from '../../private-games/oriental-organ-piano/js/theory.mjs';

const names = (id, o) => degreesOf(id, o).map((d) => d.eastern);

test('كل مقام: سبع درجات، والمجموع أوكتاف كامل (عدا الصبا: 22 ربعًا)', () => {
  for (const m of MAQAMAT) {
    assert.equal(m.steps.length, 7, m.id);
    const sum = m.steps.reduce((a, b) => a + b, 0);
    assert.equal(sum, m.id === 'saba' ? 22 : 24, m.id);
    if (m.desc) assert.equal(m.desc.reduce((a, b) => a + b, 0), 24, m.id + ' desc');
    for (const s of m.steps) assert.ok([2, 3, 4, 6].includes(s), `${m.id}: بعد غير معتاد ${s}`);
  }
});

test('أسماء الدرجات من جدول المنهج (ص 49) — صعودًا', () => {
  assert.deepEqual(names('rast'), ['راست', 'دوكاه', 'سيكاه', 'جهاركاه', 'نوى', 'حسيني', 'أوج', 'كردان']);
  assert.deepEqual(names('bayati'), ['دوكاه', 'سيكاه', 'جهاركاه', 'نوى', 'حسيني', 'عجم', 'كردان', 'محير']);
  assert.deepEqual(names('sikah'), ['سيكاه', 'جهاركاه', 'نوى', 'حسيني', 'أوج', 'كردان', 'محير', 'جواب سيكاه']);
  assert.deepEqual(names('hijaz'), ['دوكاه', 'كردي', 'حجاز', 'نوى', 'حسيني', 'عجم', 'كردان', 'محير']);
  assert.deepEqual(names('saba'), ['دوكاه', 'سيكاه', 'جهاركاه', 'حجاز', 'حسيني', 'عجم', 'كردان', 'شاهناز']);
  assert.deepEqual(names('nahawand'), ['راست', 'دوكاه', 'كردي', 'جهاركاه', 'نوى', 'حصار', 'ماهور', 'كردان']);
  assert.deepEqual(names('kurd'), ['دوكاه', 'كردي', 'جهاركاه', 'نوى', 'حسيني', 'عجم', 'كردان', 'محير']);
  assert.deepEqual(names('ajam'), ['راست', 'دوكاه', 'بوسليك', 'جهاركاه', 'نوى', 'حسيني', 'ماهور', 'كردان']);
  assert.deepEqual(names('huzam'), ['سيكاه', 'جهاركاه', 'نوى', 'حصار', 'ماهور', 'كردان', 'محير', 'جواب سيكاه']);
  assert.deepEqual(names('ajamush'), ['عجم عشيران', 'راست', 'دوكاه', 'كردي', 'جهاركاه', 'نوى', 'حسيني', 'عجم']);
  assert.deepEqual(names('hijazkar'), ['راست', 'زيركولاه', 'بوسليك', 'جهاركاه', 'نوى', 'حصار', 'ماهور', 'كردان']);
});

test('الهبوط: الراست بالعجم، والنهاوند بالعجم', () => {
  assert.deepEqual(names('rast', { descending: true }), ['كردان', 'عجم', 'حسيني', 'نوى', 'جهاركاه', 'سيكاه', 'دوكاه', 'راست']);
  assert.deepEqual(names('nahawand', { descending: true }), ['كردان', 'عجم', 'حصار', 'نوى', 'جهاركاه', 'كردي', 'دوكاه', 'راست']);
  assert.deepEqual(names('bayati', { descending: true }), [...names('bayati')].reverse());
});

test('الضبط المشتق: المفاتيح المخفوضة ربع تون فقط حيث يلزم', () => {
  const lowered = (id) => shiftsFor(id).map((s, pc) => (s ? pc + ':' + s : null)).filter(Boolean);
  assert.deepEqual(lowered('rast'), ['4:-1', '11:-1']);
  assert.deepEqual(lowered('bayati'), ['4:-1']);
  assert.deepEqual(lowered('sikah'), ['4:-1', '11:-1']);
  assert.deepEqual(lowered('saba'), ['4:-1']);
  for (const id of ['hijaz', 'nahawand', 'kurd', 'ajam', 'ajamush', 'hijazkar']) assert.deepEqual(lowered(id), [], id);
  assert.deepEqual(lowered('huzam'), ['4:-1']);
});

test('كل درجة تُسمع على مفتاحها بالضبط المشتق، وتحمل اسمها من الجدول', () => {
  for (const m of MAQAMAT) {
    const t = tuningFor(m);
    for (const d of [...degreesOf(m), ...degreesOf(m, { descending: true })]) {
      const p = pitchOf(d.midi, t);
      assert.equal(p.q, d.q, `${m.id}: ${d.eastern}`);
      assert.equal(easternName(d.midi, t), d.eastern, `${m.id}: الاسم`);
      assert.ok(Math.abs(p.hz - midiToHz(d.q / 2)) < 1e-9, `${m.id}: التردد`);
    }
  }
});

test('ربع التون القابل للضبط يغيّر التردد لا الاسم', () => {
  const t = tuningFor('rast', { quarterCents: 40 });
  assert.equal(easternName(64, t), 'سيكاه');
  assert.ok(Math.abs(1200 * Math.log2(pitchOf(64, t).hz / midiToHz(64)) + 40) < 1e-9);
});

test('keyOfQ', () => {
  assert.deepEqual(keyOfQ(127), { midi: 64, shift: -1 });
  assert.deepEqual(keyOfQ(120), { midi: 60, shift: 0 });
  assert.throws(() => keyOfQ(1.5));
});

import { SCALES } from '../../private-games/oriental-organ-piano/js/maqamat.mjs';
test('السلالم الغربية: أسماء صحيحة بالدييز أو البيمول المناسب', () => {
  const w = (id) => degreesOf(id).map((d) => d.western);
  assert.deepEqual(w('C-maj'), ['دو', 'ري', 'مي', 'فا', 'صول', 'لا', 'سي', 'دو']);
  assert.deepEqual(w('G-maj'), ['صول', 'لا', 'سي', 'دو', 'ري', 'مي', 'فا♯', 'صول']);
  assert.deepEqual(w('F-maj'), ['فا', 'صول', 'لا', 'سي♭', 'دو', 'ري', 'مي', 'فا']);
  assert.deepEqual(w('D-maj'), ['ري', 'مي', 'فا♯', 'صول', 'لا', 'سي', 'دو♯', 'ري']);
  assert.deepEqual(w('a-harm'), ['لا', 'سي', 'دو', 'ري', 'مي', 'فا', 'صول♯', 'لا']);
  for (const s of SCALES) { assert.equal(s.steps.reduce((a, b) => a + b, 0), 24); assert.ok(degreesOf(s.id).every((d) => d.shift === 0)); }
});

test('تهجئة الدرجات بالحروف المتتالية: فا♯ في الحجاز، صول♭ في الصبا، مي½♭ في الراست', () => {
  const w = (id, o) => degreesOf(id, o).map((d) => d.western);
  assert.deepEqual(w('hijaz'), ['ري', 'مي♭', 'فا♯', 'صول', 'لا', 'سي♭', 'دو', 'ري']);
  assert.deepEqual(w('saba'), ['ري', 'مي½♭', 'فا', 'صول♭', 'لا', 'سي♭', 'دو', 'ري♭']);
  assert.deepEqual(w('rast'), ['دو', 'ري', 'مي½♭', 'فا', 'صول', 'لا', 'سي½♭', 'دو']);
  assert.deepEqual(w('rast', { descending: true }), ['دو', 'سي♭', 'لا', 'صول', 'فا', 'مي½♭', 'ري', 'دو']);
  assert.deepEqual(w('sikah'), ['مي½♭', 'فا', 'صول', 'لا', 'سي½♭', 'دو', 'ري', 'مي½♭']);
  assert.deepEqual(w('hijazkar'), ['دو', 'ري♭', 'مي', 'فا', 'صول', 'لا♭', 'سي', 'دو']);
  assert.deepEqual(w('ajamush'), ['سي♭', 'دو', 'ري', 'مي♭', 'فا', 'صول', 'لا', 'سي♭']);
  for (const m of [...MAQAMAT, ...SCALES]) {
    const ws = degreesOf(m).map((d) => d.western.replace(/[½♭♯]/g, ''));
    for (let i = 1; i < 7; i++) assert.notEqual(ws[i], ws[i - 1], `${m.id}: حرفان متتاليان متطابقان`);
  }
});
