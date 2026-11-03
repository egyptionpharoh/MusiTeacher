// اختبارات النواة الإيقاعية لمسابقة التدوين والإملاء الإيقاعي:
//   node --test tests/rhythm-dictation.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';

const require = createRequire(import.meta.url);
const GAME = path.resolve('private-games/rhythm-dictation');
const RD = require(path.join(GAME, 'js/rhythm.js'));
const C = require(path.join(GAME, 'js/content.js'));
const T = RD.TPB;

// ------------------------------------------------------------ القيم الزمنية
test('القيم الزمنية لكل العلامات والأشكال صحيحة (بوحدة النوار)', () => {
  const expected = {
    w: 4, hd: 3, h: 2, qd: 1.5, q: 1, e: 0.5, s: 0.25,
    rw: 4, rh: 2, rq: 1, re: 0.5, rs: 0.25,
    ee: 1, ssss: 1, ess: 1, sse: 1, ses: 1, eds: 1, sed: 1, ss: 0.5, trip: 1,
  };
  assert.deepEqual(Object.keys(expected).sort(), RD.FIGURES.map((f) => f.id).sort());
  for (const [id, beats] of Object.entries(expected)) assert.equal(RD.FIG[id].beats, beats, id);
});

test('التقسيم الداخلي للأشكال: مواضع النقرات داخل الوحدة', () => {
  const on = (id) => RD.timeline([id]).filter((e) => !e.rest).map((e) => e.t / T);
  assert.deepEqual(on('ee'), [0, 0.5]);
  assert.deepEqual(on('ssss'), [0, 0.25, 0.5, 0.75]);
  assert.deepEqual(on('ess'), [0, 0.5, 0.75]);       // تاتيفي: كروش ثم دوبل كروشين
  assert.deepEqual(on('sse'), [0, 0.25, 0.5]);       // تفاتي: دوبل كروشين ثم كروش
  assert.deepEqual(on('ses'), [0, 0.25, 0.75]);      // تفافي: دوبل كروش، كروش، دوبل كروش
  assert.deepEqual(on('eds'), [0, 0.75]);            // تافي: كروش بنقطة + دوبل كروش
  assert.deepEqual(on('sed'), [0, 0.25]);            // تفا: دوبل كروش + كروش بنقطة
  assert.deepEqual(RD.timeline(['trip']).map((e) => e.t), [0, 4, 8]); // تريوليه: ثلاث نقرات متساوية (12 تِك)
});

test('السكتات: مدة صحيحة، والسكتات المتجاورة تُدمج سمعيًا', () => {
  assert.deepEqual(RD.timeline(['rq', 'rq']), [{ t: 0, d: 24, rest: true }]);
  assert.ok(RD.sameRhythm(['rq', 'rq'], ['rh']));
  assert.ok(!RD.sameRhythm(['q', 'rq'], ['h']), 'نوار + سكتة ≠ بلانش');
});

// ------------------------------------------------------------ المولّد
test('المولّد: كل مازورة مجموعها يساوي الميزان تمامًا، وبأشكال المستوى فقط (4000 سؤال)', () => {
  let n = 0;
  for (const L of C.LEVELS) for (const beats of [2, 3, 4]) for (const measures of [1, 2, 3, 4]) {
    for (let k = 0; k < 40; k++) {
      const pat = RD.generate({ allowed: L.allowed, focus: L.focus, beats, measures, seed: 1 + k * 7919 + beats * 31 + measures });
      assert.equal(pat.length, measures);
      pat.forEach((m) => {
        assert.equal(RD.seqTicks(m), beats * T, `${L.id} ${beats}/4 ${m}`);
        m.forEach((id) => assert.ok(L.allowed.includes(id) || id === 'q', `${L.id}: ${id} خارج المستوى`));
        assert.ok(RD.timeline(m).some((e) => !e.rest), 'مازورة كلها سكتات');
      });
      assert.ok(!RD.timeline(pat[0])[0].rest, 'لا يبدأ التمرين بسكتة');
      n++;
    }
  }
  assert.ok(n >= 3800);
});

test('المولّد: مواضع العلامات الطويلة سليمة التدوين (لا بلانش على الضربة 2 في 4/4، الروند في 4/4 فقط)', () => {
  const L = C.LEVELS[C.LEVELS.length - 1];
  for (let k = 0; k < 600; k++) {
    for (const beats of [2, 3, 4]) {
      const pat = RD.generate({ allowed: L.allowed, focus: [], beats, measures: 2, seed: 99 + k * 13 + beats });
      pat.forEach((m) => {
        let t = 0;
        m.forEach((id) => {
          const b = t / T;
          if (id === 'w' || id === 'rw') assert.ok(beats === 4 && b === 0);
          if (id === 'hd') assert.ok((beats === 3 && b === 0) || (beats === 4 && (b === 0 || b === 1)));
          if ((id === 'h' || id === 'rh') && beats === 4) assert.ok(b === 0 || b === 2, 'بلانش في موضع غير معتاد');
          if (RD.FIG[id].ticks === T && RD.FIG[id].kind !== 'note') assert.equal(t % T, 0, 'شكل الوحدة يبدأ على ضربة');
          t += RD.FIG[id].ticks;
        });
      });
    }
  }
});

test('المولّد: الشكل الجديد في المستوى يظهر في السؤال', () => {
  const L = C.LEVELS.find((l) => l.id === 'g4');
  let hits = 0;
  for (let k = 0; k < 200; k++) {
    const pat = RD.generate({ allowed: L.allowed, focus: L.focus, beats: 2, measures: 2, seed: 5 + k });
    if (pat.flat().some((id) => L.focus.includes(id))) hits++;
  }
  assert.equal(hits, 200);
});

// ------------------------------------------------------------ التصحيح
const G = (u, c, b, o) => RD.gradeAnswer(u, c, b, o);

test('التصحيح: الإجابة المطابقة تمامًا = كل النقاط', () => {
  const r = G([['ee', 'q'], ['h']], [['ee', 'q'], ['h']], 2);
  assert.equal(r.all, true); assert.equal(r.points, 30); assert.equal(r.measures[0].status, 'exact');
});

test('التصحيح: الكتابة المكافئة سمعيًا مقبولة مع تنبيه (كروش كروش = تاتي، تيفي تيفي = تفاتيفي)', () => {
  const r = G([['e', 'e', 'q'], ['ss', 'ss', 'q']], [['ee', 'q'], ['ssss', 'q']], 2);
  assert.equal(r.measures[0].status, 'equivalent'); assert.equal(r.measures[1].status, 'equivalent');
  assert.equal(r.all, true); assert.match(r.measures[0].issues[0].text, /بكتابة مختلفة/);
  const strict = G([['e', 'e', 'q']], [['ee', 'q']], 2, { acceptEquivalent: false });
  assert.equal(strict.all, false); assert.equal(strict.points, 0);
});

test('التصحيح: سكتتا نوار مكافئتان لسكتة بلانش، لكن نوار + سكتة ليست بلانش', () => {
  assert.equal(RD.gradeMeasure(['q', 'rq', 'rq', 'q'], ['q', 'rh', 'q'], 4).status, 'equivalent');
  const r = RD.gradeMeasure(['q', 'rq'], ['h'], 2);
  assert.equal(r.status, 'wrong'); assert.equal(r.issues[0].type, 'length');
});

test('التصحيح: نفس مجموع الأزمنة وتوزيع مختلف = خطأ (لا يُقبل لمجرد تساوي المجموع)', () => {
  // تاتيفي وتفاتي: كلاهما وحدة واحدة وثلاث نقرات، لكن توزيعهما مختلف
  const r = RD.gradeMeasure(['sse', 'q'], ['ess', 'q'], 2);
  assert.equal(r.status, 'wrong'); assert.equal(r.issues[0].type, 'distribution'); assert.equal(r.issues[0].beat, 1);
  // نفس عدد العناصر ونفس المجموع
  assert.equal(RD.gradeMeasure(['q', 'h', 'q'], ['h', 'q', 'q'], 4).status, 'wrong');
  assert.equal(RD.gradeMeasure(['eds', 'q'], ['sed', 'q'], 2).status, 'wrong');
});

test('التصحيح: يميز التقسيم والسكتات والمدة والمازورة الفارغة', () => {
  assert.equal(RD.gradeMeasure(['ssss', 'q'], ['ee', 'q'], 2).issues[0].type, 'subdivision');
  assert.equal(RD.gradeMeasure(['rq', 'q'], ['q', 'q'], 2).issues[0].type, 'rests');
  assert.equal(RD.gradeMeasure(['q'], ['q', 'q'], 2).issues[0].type, 'duration');
  assert.equal(RD.gradeMeasure([], ['q', 'q'], 2).issues[0].type, 'empty');
});

test('التصحيح: النقاط لكل مازورة صحيحة + مكافأة النمط الكامل فقط عند اكتماله', () => {
  const r = G([['q', 'q'], ['ee', 'q'], []], [['q', 'q'], ['ssss', 'q'], ['h']], 2);
  assert.equal(r.okCount, 1); assert.equal(r.points, 10); assert.equal(r.maxPoints, 40);
});

test('التحقق من التدوين الحر: يكتشف الناقص والزائد بقيم دقيقة', () => {
  const r = RD.checkComposition([['q', 'e'], ['h', 'q'], ['q', 'q'], []], 2);
  assert.match(r[0].text, /1½/); assert.match(r[0].text, /ينقصها ½/);
  assert.match(r[1].text, /تزيد 1/); assert.equal(r[2].ok, true); assert.match(r[3].text, /فارغة/);
});

// ------------------------------------------------------------ تطابق الصوت مع التدوين
test('جدول الصوت: نقرة لكل علامة بصوت في موضعها الزمني وبطول قيمتها، ولا صوت للسكتات', () => {
  const bpm = 60, beats = 4;
  const ms = [['q', 'ee', 'rq', 'ssss'], ['qd', 'e', 'h'], ['eds', 'sed', 'trip', 'rq']];
  const s = RD.buildSchedule(ms, beats, bpm, { countIn: 1, metronome: true });
  const notes = s.events.filter((e) => e.type === 'note');
  const expected = [];
  ms.forEach((m, mi) => RD.timeline(m).filter((e) => !e.rest).forEach((e) => expected.push({ t: s.lead + mi * beats + e.t / T, d: e.d / T })));
  assert.equal(notes.length, expected.length);
  notes.forEach((n, i) => { assert.ok(Math.abs(n.t - expected[i].t) < 1e-9); assert.ok(Math.abs(n.d - expected[i].d) < 1e-9); });
  assert.equal(s.events.filter((e) => e.type === 'count').length, 4, 'عدّ تمهيدي مازورة واحدة');
  assert.equal(s.events.filter((e) => e.type === 'click').length, 12, 'نبض الوحدة في كل ضربة');
  assert.equal(s.events.filter((e) => e.type === 'click' && e.accent).length, 3, 'الضربة الأولى قوية في كل مازورة');
  assert.equal(s.total, 4 + 12);
});

test('جدول الصوت: إعادة الاستماع لا تغير السؤال (نفس الجدول تمامًا)', () => {
  const pat = RD.generate({ allowed: C.LEVELS[5].allowed, beats: 3, measures: 4, seed: 42 });
  const a = JSON.stringify(RD.buildSchedule(pat, 3, 80));
  const b = JSON.stringify(RD.buildSchedule(pat, 3, 80));
  assert.equal(a, b);
});

// ------------------------------------------------------------ نماذج الدليل
test('نماذج الدليل: كل مازورة 2/4 كاملة، وموضع الاقتباس موثق', () => {
  assert.ok(C.MODELS.length >= 3);
  C.MODELS.forEach((M) => {
    assert.equal(M.measures.length, 4);
    M.measures.forEach((m) => assert.equal(RD.seqTicks(m), M.beats * T, M.id));
    assert.match(C.citation(M), /الصف الثامن.*الوحدة الرابعة.*ص \d+/);
  });
  // النموذجان (3) و(6) يختلفان في المازورتين الأولى والرابعة فقط
  const m3 = C.MODELS.find((m) => m.id === 'g8-u4-m3').measures, m6 = C.MODELS.find((m) => m.id === 'g8-u4-m6').measures;
  assert.deepEqual(m3.map((m, i) => RD.sameRhythm(m, m6[i])), [false, true, true, false]);
});

// ------------------------------------------------------------ الاستقلال عن اللعبة اللحنية
test('الاستقلال: لا تستورد اللعبة الإيقاعية أي ملف من اللعبة اللحنية', () => {
  const files = ['index.html', 'js/app.js', 'js/rhythm.js', 'js/content.js', 'js/glyphs.js', 'js/audio.js', 'css/style.css'];
  files.forEach((f) => {
    const p = path.join(GAME, f);
    if (!fs.existsSync(p)) return;
    assert.ok(!/melodic-dictation/.test(fs.readFileSync(p, 'utf8')), f);
  });
});
