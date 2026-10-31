// node --test tests/oriental/
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  A4_HZ, MIDI_MIN, MIDI_MAX, midiToHz, octaveOf, westernName,
  makeTuning, setShift, cycleShift, pitchOf, easternName, easternInfo, labelOf,
  EASTERN_NAMES, EASTERN_Q_MIN, EASTERN_Q_MAX, EASTERN_ALIASES,
} from '../../private-games/oriental-organ-piano/js/theory.mjs';
import { buildKeyMap, KEY_LAYOUT } from '../../private-games/oriental-organ-piano/js/keymap.mjs';

const close = (a, b, rel = 1e-9) => Math.abs(a - b) <= Math.abs(b) * rel;
const NAT = [0, 2, 4, 5, 7, 9, 11];
const L = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const ACC = { natural: 0, sharp: 1, flat: -1, 'half-sharp': 0.5, 'half-flat': -0.5 };

test('الغربي: الاسم يطابق الدرجة الفعلية لكل المفاتيح 21–108 بالدييز والبيمول', () => {
  for (let m = MIDI_MIN; m <= MIDI_MAX; m++) {
    for (const accidental of ['sharp', 'flat']) {
      const n = westernName(m, { accidental });
      const semis = 12 * (n.octave + 1) + NAT[L.indexOf(n.letter)] + ACC[n.accidental];
      assert.equal(semis, m, `${m} ${accidental}`);
      assert.ok(!/\d/.test(n.text) && !/\d/.test(n.short), 'رقم الأوكتاف لا يدخل في الاسم');
    }
  }
});

test('الغربي: نقاط مرجعية معروفة', () => {
  assert.equal(westernName(60).scientific, 'C4');
  assert.equal(westernName(60).text, 'دو');
  assert.equal(westernName(61).text, 'دو دييز');
  assert.equal(westernName(61, { accidental: 'flat' }).text, 'ري بيمول');
  assert.equal(westernName(61, { accidental: 'flat' }).scientific, 'Db4');
  assert.equal(westernName(71).text, 'سي');
  assert.equal(westernName(21).scientific, 'A0');
  assert.equal(octaveOf(59), 3);
  assert.ok(close(midiToHz(69), 440));
  assert.ok(close(midiToHz(60), 261.6255653005986));
  assert.ok(close(midiToHz(21), 27.5));
  assert.ok(close(midiToHz(108), 4186.0090448, 1e-8));
  for (let m = 21; m <= 96; m++) assert.ok(close(midiToHz(m + 12), midiToHz(m) * 2));
});

test('أرباع التون الغربية: الاسم المكتوب يطابق الدرجة المسموعة لكل مفتاح وكل إزاحة', () => {
  for (let m = MIDI_MIN; m <= MIDI_MAX; m++) {
    for (const shift of [-1, 0, 1]) {
      const n = westernName(m, { shift });
      const semis = 12 * (n.octave + 1) + NAT[L.indexOf(n.letter)] + ACC[n.accidental];
      assert.equal(semis * 2, 2 * m + shift, `midi ${m} shift ${shift}`);
    }
  }
  assert.equal(westernName(64, { shift: -1 }).short, 'مي½♭');
  assert.equal(westernName(64, { shift: -1 }).text, 'مي نصف بيمول');
  assert.equal(westernName(63, { shift: 1 }).short, 'مي½♭');        // ري♯ + ربع = مي½♭ نفس الدرجة
  assert.equal(westernName(60, { shift: 1 }).short, 'دو½♯');
  assert.equal(westernName(61, { shift: 1 }).short, 'ري½♭');
  assert.equal(westernName(60, { shift: -1 }).short, 'سي½♯');       // دو − ربع = سي½♯ من الأوكتاف الأدنى
  assert.equal(westernName(60, { shift: -1 }).octave, 3);
  assert.equal(westernName(64, { shift: 1 }).short, 'مي½♯');
});

test('الغربي: مي وسي طبيعيتان وكل الإزاحات صفر حتى لو طُلب غير ذلك', () => {
  const t = makeTuning({ mode: 'western', shifts: { 4: -1, 11: -1 } });
  assert.ok(t.shifts.every((s) => s === 0));
  for (const m of [52, 59, 64, 71, 76]) {
    assert.equal(pitchOf(m, t).cents, 0);
    assert.ok(close(pitchOf(m, t).hz, midiToHz(m)));
  }
  assert.equal(setShift(t, 4, -1), t);
  assert.equal(cycleShift(t, 4), t);
});

test('الشرقي الافتراضي (راست على دو): مي وسي بنصف بيمول بالحساب', () => {
  const t = makeTuning({ mode: 'eastern' });
  assert.deepEqual(t.shifts.map((s, i) => (s ? i : -1)).filter((i) => i >= 0), [4, 11]);
  assert.ok(Math.abs(pitchOf(64, t).hz - 320.2437) < 0.001);
  assert.ok(Math.abs(pitchOf(71, t).hz - 479.8234) < 0.001);
  assert.ok(close(1200 * Math.log2(pitchOf(64, t).hz / midiToHz(64)), -50, 1e-9));
});

test('جدول المنهج: 49 درجة متتالية من يكاه (G3) إلى جواب النوى (G5)', () => {
  assert.equal(EASTERN_NAMES.length, 49);
  assert.equal(EASTERN_Q_MIN, 2 * 55);       // G3
  assert.equal(EASTERN_Q_MAX, 2 * 79);       // G5
  assert.equal(new Set(EASTERN_NAMES).size, 49, 'اسم مكرر');
  for (const q of Object.keys(EASTERN_ALIASES)) assert.ok(+q >= EASTERN_Q_MIN && +q <= EASTERN_Q_MAX);
});

test('جدول المنهج: قاعدة نيم = −ربع تون وتيك = +ربع تون تنطبق على كل الجدول', () => {
  const count = { 'نيم': 0, 'تيك': 0 };
  EASTERN_NAMES.forEach((name, i) => {
    const m = /^(جواب )?(نيم|تيك) (.+)$/.exec(name);
    if (!m) return;
    const base = (m[1] || '') + m[3];
    const neighbor = EASTERN_NAMES[m[2] === 'نيم' ? i + 1 : i - 1];
    assert.equal(neighbor, base, `${name} ← يجب أن يجاور ${base}`);
    count[m[2]]++;
  });
  assert.deepEqual(count, { 'نيم': 10, 'تيك': 10 });   // عشرة لكل نوع في الجدول
});

test('جدول المنهج: درجات المقامات في مخططات الكتاب تقع على المواضع الصحيحة', () => {
  const q = (name) => EASTERN_Q_MIN + EASTERN_NAMES.indexOf(name);
  const pos = (n, shift = 0) => 2 * n + shift;
  // درجات سلم الراست السبع + يكاه (ص 49 والصفحة التالية)
  assert.equal(q('يكاه'), pos(55)); assert.equal(q('راست'), pos(60)); assert.equal(q('دوكاه'), pos(62));
  assert.equal(q('سيكاه'), pos(64, -1)); assert.equal(q('جهاركاه'), pos(65)); assert.equal(q('نوى'), pos(67));
  assert.equal(q('حسيني'), pos(69)); assert.equal(q('أوج'), pos(71, -1)); assert.equal(q('كردان'), pos(72));
  // مقامات الكرد والبياتي والعجم عشيران والحجاز: كردي = مي♭، عجم = سي♭، حجاز = فا♯، محير = ري5
  assert.equal(q('كردي'), pos(63)); assert.equal(q('عجم'), pos(70)); assert.equal(q('حجاز'), pos(66));
  assert.equal(q('محير'), pos(74)); assert.equal(q('عجم عشيران'), pos(58)); assert.equal(q('عراق'), pos(59, -1));
  assert.equal(q('بوسليك'), pos(64)); assert.equal(q('ماهور'), pos(71)); assert.equal(q('كوشت'), pos(59));
});

test('الاسم والتردد متلازمان: كل مفتاح × كل إزاحة × أكثر من قيمة ربع تون', () => {
  for (const quarterCents of [50, 35]) {
    for (let pc = 0; pc < 12; pc++) {
      for (const shift of [-1, 0, 1]) {
        const t = setShift(makeTuning({ mode: 'eastern', shifts: {}, quarterCents }), pc, shift);
        for (let m = MIDI_MIN; m <= MIDI_MAX; m++) {
          const p = pitchOf(m, t);
          const info = easternInfo(m, t);
          assert.equal(p.q, 2 * m + p.shift);
          assert.ok(close(p.hz, midiToHz(m, p.shift * quarterCents)));
          if (p.q >= EASTERN_Q_MIN && p.q <= EASTERN_Q_MAX) {
            assert.equal(info.name, EASTERN_NAMES[p.q - EASTERN_Q_MIN]);
          } else {
            assert.equal(info, null);
          }
          // الاسم الغربي المعروض يصف الدرجة المسموعة نفسها
          const w = westernName(m, { shift: p.shift });
          assert.equal((12 * (w.octave + 1) + NAT[L.indexOf(w.letter)] + ACC[w.accidental]) * 2, p.q);
        }
      }
    }
  }
});

test('الدرجة نفسها لها الاسم نفسه أيًّا كان المفتاح الذي أنتجها (سيكاه = مي−1 = ري♯+1)', () => {
  const a = setShift(makeTuning({ mode: 'eastern', shifts: {} }), 4, -1);   // مي −ربع
  const b = setShift(makeTuning({ mode: 'eastern', shifts: {} }), 3, 1);    // ري♯ +ربع
  assert.equal(easternName(64, a), 'سيكاه');
  assert.equal(easternName(63, b), 'سيكاه');
  assert.ok(close(pitchOf(64, a).hz, pitchOf(63, b).hz));
  // الراست الافتراضي: أوج على سي4، وعراق على سي3، وجواب سيكاه على مي5
  const t = makeTuning({ mode: 'eastern' });
  assert.equal(easternName(71, t), 'أوج'); assert.equal(easternName(59, t), 'عراق'); assert.equal(easternName(76, t), 'جواب سيكاه');
  assert.equal(easternInfo(76, t).alias, 'بزرك');
  assert.equal(easternName(52, t), null);                                    // مي3 نصف بيمول = 103 خارج الجدول
  assert.equal(labelOf(52, t, { display: 'eastern' }).fallback, true);
});

test('عرض المفاتيح: غربي / شرقي / الاثنان', () => {
  const t = makeTuning({ mode: 'eastern' });
  const both = labelOf(64, t, { display: 'both' });
  assert.equal(both.primary, 'مي½♭'); assert.equal(both.secondary, 'سيكاه'); assert.equal(both.octave, 4);
  assert.equal(labelOf(64, t, { display: 'western' }).secondary, null);
  assert.equal(labelOf(60, t, { display: 'eastern' }).primary, 'راست');
  const fb = labelOf(61, t, { display: 'eastern' });         // فا♯/دو♯ = زيركولاه في الجدول
  assert.equal(fb.primary, 'زيركولاه'); assert.equal(fb.fallback, false);
});

test('لا تراكم: الضبط ثابت لا يتغير والتكرار لا يغيّر التردد (عكس خطأ النسخة القديمة)', () => {
  const t0 = makeTuning({ mode: 'eastern' });
  const f0 = pitchOf(64, t0).hz;
  let t = t0;
  for (let i = 0; i < 100; i++) { t = cycleShift(cycleShift(cycleShift(t, 5), 5), 5); }   // 3 دورات = الأصل
  assert.equal(pitchOf(64, t).hz, f0);
  assert.deepEqual([...t.shifts], [...t0.shifts]);
  let u = t0;
  for (let i = 0; i < 100; i++) u = setShift(u, 4, -1);                                     // نفس القيمة مرارًا
  assert.deepEqual([...u.shifts], [...t0.shifts]);
  assert.ok(close(pitchOf(64, setShift(t0, 4, 0)).hz, midiToHz(64)));                      // الإطفاء يعيد الطبيعي تمامًا
  assert.throws(() => { t0.shifts.push(1); });                                              // غير قابل للتعديل
  assert.throws(() => { 'use strict'; t0.mode = 'western'; });
});

test('التحقق من المدخلات', () => {
  assert.throws(() => makeTuning({ mode: 'x' }), RangeError);
  assert.throws(() => makeTuning({ quarterCents: 80 }), RangeError);
  assert.throws(() => makeTuning({ mode: 'eastern', shifts: { 4: 2 } }), RangeError);
  assert.throws(() => makeTuning({ mode: 'eastern', shifts: { 12: 1 } }), RangeError);
  assert.throws(() => westernName(20), RangeError);
  assert.throws(() => westernName(60, { shift: 2 }), RangeError);
  assert.equal(A4_HZ, 440);
});

test('خريطة لوحة المفاتيح: كل زر لنغمة واحدة، ولا تعارض، وترتيب تصاعدي', () => {
  const codes = KEY_LAYOUT.map(([c]) => c);
  assert.equal(new Set(codes).size, codes.length, 'زر مكرر');
  const offs = KEY_LAYOUT.map(([, o]) => o);
  assert.equal(new Set(offs).size, offs.length, 'نغمة مكررة');
  const map = buildKeyMap(48);
  assert.equal(map.get('KeyQ'), 60);
  assert.equal(map.get('KeyZ'), 48);
  assert.equal(map.get('KeyS'), 49);
  assert.equal(map.get('Digit2'), 61);
  assert.equal(map.size, 29);
  const sorted = [...map.values()].sort((a, b) => a - b);
  assert.deepEqual(sorted, [...new Set(sorted)]);
  assert.ok(!map.has('Space'));
  assert.throws(() => buildKeyMap(49), RangeError);
});
