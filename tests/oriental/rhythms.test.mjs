// node --test tests/oriental/
import test from 'node:test';
import assert from 'node:assert/strict';
import { RHYTHMS, RHYTHM_BY_ID, HERITAGE, SOURCES, eventsOf, stepsOf, fillLanes, validateCustom } from '../../private-games/oriental-organ-piano/js/rhythms.mjs';
import { Sequencer, TapTempo } from '../../private-games/oriental-organ-piano/js/sequencer.mjs';
import { DRUMS, renderDrum } from '../../private-games/oriental-organ-piano/js/drums.mjs';

const dt = (id) => RHYTHM_BY_ID[id].lanes.dt;

test('كل إيقاع سليم: أطوال المسارات = الوحدات × التقسيم، ورموز معروفة، ومصدر', () => {
  for (const r of RHYTHMS) {
    assert.ok(stepsOf(r) > 0, r.id);
    assert.doesNotThrow(() => eventsOf(r), r.id);
    assert.doesNotThrow(() => eventsOf(r, { variant: 'fill', riq: true }), r.id);
    assert.ok(r.src.length >= 1 && r.src.every((s) => SOURCES[s]), r.id + ': مصدر');
    if (r.group !== 'west') assert.ok(r.src.length >= 2, r.id + ': يحتاج مصدرين على الأقل');
    assert.match(r.meter, /^\d+\/\d+$/);
    const ev = eventsOf(r);
    assert.equal(ev[0].step, 0, r.id + ': الدورة تبدأ بضربة');
  }
});

test('الصيغ الأساسية كما في المصادر (دُم/تك)', () => {
  assert.equal(dt('maqsum'), 'DT-TD-T-');
  assert.equal(dt('baladi'), 'DD-TD-T-');
  assert.equal(dt('saidi'), 'DT-DD-T-');
  assert.equal(dt('malfuf'), 'D--T--T-');
  assert.equal(dt('ayyub'), 'D--kD-T-');
  assert.equal(dt('samai'), 'D--T-DDT--');
  assert.equal(dt('khaliji'), 'D--D--T-');
  // الفروق المميزة: البلدي = المقسوم بدُم ثانية، والصعيدي فيه دُمّان متتاليان في الوحدة الثانية
  assert.equal(dt('baladi')[1], 'D'); assert.equal(dt('maqsum')[1], 'T');
  assert.equal(dt('saidi').slice(3, 5), 'DD');
  assert.equal(RHYTHM_BY_ID.samai.beats, 10);
});

test('الفنون التراثية بطاقات موثّقة بلا أنماط مختلقة', () => {
  const ids = RHYTHMS.map((r) => r.id);
  for (const h of HERITAGE) { assert.ok(h.src.length > 10, h.id); assert.ok(!ids.includes(h.id), h.id + ' ليس نمطًا'); }
  assert.match(HERITAGE.find((h) => h.id === 'azi').text, /لا يُذكر فيه طبل/);
});

test('الحشوة: آخر وحدتين فقط تتغيران، والدُّم الأولى باقية', () => {
  for (const r of RHYTHMS) {
    const f = fillLanes(r), n = stepsOf(r);
    for (const [lane, s] of Object.entries(f)) {
      assert.equal(s.length, n);
      const keep = Math.max(1, n - 2 * r.sub); assert.equal(s.slice(0, keep), r.lanes[lane].slice(0, keep), r.id + '/' + lane);
    }
  }
});

test('محرر الإيقاع يرفض المدخلات الخاطئة ويقبل الصحيحة', () => {
  assert.throws(() => validateCustom({ ar: '', beats: 4, sub: 2, lanes: { rah: 'x-------' } }), /اسم/);
  assert.throws(() => validateCustom({ ar: 'تجربة', beats: 4, sub: 2, lanes: { rah: 'x---' } }), /الطول/);
  assert.throws(() => validateCustom({ ar: 'تجربة', beats: 4, sub: 2, lanes: { rah: 'x---D---' } }), /رمز/);
  assert.throws(() => validateCustom({ ar: 'تجربة', beats: 4, sub: 2, lanes: { zz: 'x-------' } }), /غير معروف/);
  assert.throws(() => validateCustom({ ar: 'تجربة', beats: 4, sub: 2, lanes: { rah: '--------' } }), /فارغ/);
  const r = validateCustom({ ar: 'نمط تدريبي', beats: 4, sub: 2, bpm: 300, lanes: { rah: 'x---x---', kas: '--x---xx', clap: '--------' } });
  assert.equal(r.group, 'mine'); assert.equal(r.bpm, 240); assert.ok(!r.lanes.clap);
  assert.equal(eventsOf(r).length, 5);
});

// ---------------------------------------------------------------- المجدول بساعة وهمية
function rig(bpm = 120) {
  let t = 0; const hits = [];
  const seq = new Sequencer({ now: () => t, trigger: (s, time, vel) => hits.push({ s, time: +time.toFixed(6), vel }) });
  seq.setBpm(bpm);
  const run = (until) => { while (t < until) { t += 0.025; seq.tick(); } };
  return { seq, hits, run, at: () => t };
}

test('المقسوم بسرعة 120: الضربات في أزمنتها بالضبط', () => {
  const { seq, hits, run } = rig(120);
  seq.setRhythm(RHYTHM_BY_ID.maqsum); seq.start(1);
  run(1 + 2 - 0.13);     // دورة كاملة = 4 وحدات × 0.5 ث = 2 ث
  const pattern = hits.map((h) => [h.s, +(h.time - 1).toFixed(3)]);
  assert.deepEqual(pattern, [['dum', 0], ['tak', 0.25], ['tak', 0.75], ['dum', 1], ['tak', 1.5]]);
});

test('تغيير الإيقاع أثناء العزف يحدث عند بداية الدورة التالية', () => {
  const { seq, hits, run } = rig(120);
  seq.setRhythm(RHYTHM_BY_ID.maqsum); seq.start(1);
  run(1.6); seq.setRhythm(RHYTHM_BY_ID.baladi);
  run(3.9);
  const second = hits.filter((h) => h.time >= 3 - 1e-9 && h.time < 3.9);
  assert.equal(seq.rhythm.id, 'baladi');
  assert.deepEqual(second.map((h) => h.s).slice(0, 2), ['dum', 'dum']);       // البلدي يبدأ بدُمّين
  assert.ok(hits.filter((h) => h.time < 3 - 1e-9).every((h, i, a) => true));
  assert.equal(hits.filter((h) => h.time >= 1 && h.time < 3 - 1e-9).length, 5);  // الدورة الأولى مقسوم كاملة
});

test('تغيير السرعة لا يُحدث قفزة: الخطوة التالية بالسرعة الجديدة', () => {
  const { seq, hits, run } = rig(120);
  seq.setRhythm(RHYTHM_BY_ID.maqsum); seq.start(1);
  run(1.3); seq.setBpm(60); run(4);
  const times = hits.map((h) => h.time);
  for (let i = 1; i < times.length; i++) assert.ok(times[i] > times[i - 1]);
  const gaps = []; for (let i = 1; i < times.length; i++) gaps.push(+(times[i] - times[i - 1]).toFixed(3));
  assert.ok(gaps.includes(0.5) && gaps.includes(1), JSON.stringify(gaps));    // خطوة الثُمن صارت 0.5 ث
});

test('الحشوة مرة واحدة ثم يعود النمط، والإنهاء يختم بدُم ويتوقف', () => {
  const { seq, hits, run } = rig(120);
  seq.setRhythm(RHYTHM_BY_ID.maqsum); seq.start(1);
  run(1.5); seq.fill(); run(4.9);
  const cyc = (k) => hits.filter((h) => h.time >= 1 + 2 * k - 1e-9 && h.time < 3 + 2 * k - 1e-9).map((h) => h.s);
  assert.ok(cyc(1).filter((s) => s === 'ka').length >= 1, 'الحشوة في الدورة الثانية');
  assert.equal(cyc(2).filter((s) => s === 'ka').length, 0, 'عاد النمط الأساسي');
  seq.end(); run(9);
  assert.equal(seq.running, false);
  const last = hits[hits.length - 1];
  assert.equal(last.s, 'dum'); assert.ok(Math.abs((last.time - 1) % 2) < 1e-6, 'الختام على أول دورة');
});

test('المترونوم وحده بنبر على الوحدة الأولى', () => {
  const { seq, hits, run } = rig(60);
  seq.setRhythm(null); seq.metro = { on: true, beats: 3, accent: true }; seq.start(1);
  run(6.9);
  assert.deepEqual(hits.slice(0, 6).map((h) => h.s), ['clickHi', 'click', 'click', 'clickHi', 'click', 'click']);
  assert.deepEqual(hits.slice(0, 4).map((h) => h.time - 1), [0, 1, 2, 3]);
});

test('نقر السرعة', () => {
  const tt = new TapTempo();
  assert.equal(tt.tap(0), null);
  tt.tap(0.5); tt.tap(1.0);
  assert.equal(tt.tap(1.5), 120);
  assert.equal(tt.tap(10), null);  // فاصل طويل يبدأ من جديد
});

test('أصوات الإيقاع: مولّدة، بلا تجاوز للقمة، مختلفة عن بعضها', () => {
  const sr = 44100, rms = {};
  for (const name of Object.keys(DRUMS)) {
    const a = renderDrum(name, sr);
    let peak = 0, e = 0; for (const v of a) { peak = Math.max(peak, Math.abs(v)); e += v * v; }
    assert.ok(peak <= 0.9 + 1e-6 && peak > 0.1, name);
    assert.ok(Math.abs(a[a.length - 1]) < 1e-3, name + ': ينتهي بصمت');
    rms[name] = Math.sqrt(e / a.length);
  }
  // الدُّم أغلظ من التك: طاقة أكثر تحت 300 هرتز (عبر عدّ عبور الصفر)
  const zc = (a) => { let z = 0; for (let i = 1; i < a.length; i++) if ((a[i] >= 0) !== (a[i - 1] >= 0)) z++; return z / (a.length / sr); };
  assert.ok(zc(renderDrum('dum', sr).subarray(2000, 12000)) < 400);
  assert.ok(zc(renderDrum('tak', sr).subarray(0, 3000)) > 2000);
  assert.ok(zc(renderDrum('rahmani', sr).subarray(2000, 20000)) < zc(renderDrum('kasir', sr).subarray(2000, 8000)), 'الرحماني أغلظ من الكاسر');
});
