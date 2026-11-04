// اختبارات نواة «طريقة أداء الموازين الإيقاعية» (بلا متصفح):  node --test tests/time-signatures.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { METERS, handAt, segment, measuredDir, wrongVariant, pathSamples, beatDur, warp } from '../private-games/time-signatures/src/patterns.js';
import { Transport } from '../private-games/time-signatures/src/transport.js';

const near = (a, b, e = 1e-9) => Math.abs(a - b) <= e;

test('الموازين الثلاثة: عدد النبضات والنبر والاتجاهات كما في الأدلة', () => {
  assert.deepEqual(Object.keys(METERS).map(Number), [2, 3, 4]);
  assert.deepEqual(METERS[2].dirs, ['down', 'up']);
  assert.deepEqual(METERS[3].dirs, ['down', 'right', 'up']);
  assert.deepEqual(METERS[4].dirs, ['down', 'left', 'right', 'up']);
  assert.deepEqual(METERS[2].accents, ['strong', 'weak']);
  assert.deepEqual(METERS[3].accents, ['strong', 'weak', 'weak']);
  assert.deepEqual(METERS[4].accents, ['strong', 'weak', 'medium', 'weak']);
  for (const m of [2, 3, 4]) { assert.equal(METERS[m].beats.length, m); assert.equal(METERS[m].n, m); assert.ok(METERS[m].source.text.length > 10); }
});

test('المسار الفعلي يطابق الاتجاهات المكتوبة لكل نبضة (قياس من المنحنى نفسه، لا من الجدول)', () => {
  for (const m of [2, 3, 4]) assert.deepEqual(METERS[m].beats.map((_, i) => measuredDir(m, i)), METERS[m].dirs, 'الميزان ' + m);
});

test('عند كل نبضة (موضع صحيح) تكون اليد تمامًا في نقطة الإكتوس، والحركة متصلة بلا قفزات', () => {
  for (const m of [2, 3, 4]) {
    for (let k = -1; k < 3 * m; k++) {
      const h = handAt(m, k), P = METERS[m].beats[((k % m) + m) % m].P;
      assert.ok(near(h.u, P[0], 1e-12) && near(h.v, P[1], 1e-12), `m${m} k${k}`);
      assert.equal(h.beat, ((k % m) + m) % m);
    }
    // اتصال: الفرق بين عيّنتين متجاورتين صغير دائمًا (لا قفز عند حدود النبضات)
    let prev = handAt(m, -1), maxStep = 0;
    for (let i = 1; i <= 400 * m; i++) { const h = handAt(m, -1 + i / 400); maxStep = Math.max(maxStep, Math.hypot(h.u - prev.u, h.v - prev.v)); prev = h; }
    assert.ok(maxStep < 0.03, 'أكبر خطوة ' + maxStep);
  }
});

test('الإكتوس واضح: تغيّر حاد في الاتجاه عند كل نبضة، والضربة الأولى تهبط من قمة النمط', () => {
  for (const m of [2, 3, 4]) {
    for (let i = 0; i < m; i++) {
      const a = handAt(m, i - 0.001), b = handAt(m, i + 0.001);
      const ang = Math.acos((a.du * b.du + a.dv * b.dv) / (Math.hypot(a.du, a.dv) * Math.hypot(b.du, b.dv)));
      assert.ok(ang > 0.6, `m${m} نبضة ${i + 1}: زاوية تغيّر الاتجاه ${ang.toFixed(2)} rad`);
    }
    // أعلى نقطة في الدورة تقع قبل النبضة الأولى مباشرة (ضربة الهبوط) وأعلى من كل نقاط النبضات
    let top = -1, topPos = 0;
    for (let i = 0; i <= 1000; i++) { const p = -1 + i / 1000, h = handAt(m, p); if (h.v > top) { top = h.v; topPos = p; } }
    assert.ok(top > 0.8 && topPos > -1 && topPos < 0, `m${m} القمة ${top.toFixed(2)} عند ${topPos.toFixed(2)}`);
    for (const b of METERS[m].beats) assert.ok(b.P[1] < top - 0.3);
    // الأولى هي أخفض نقطة (أرضية النمط)
    for (const b of METERS[m].beats.slice(1)) assert.ok(b.P[1] > METERS[m].beats[0].P[1]);
  }
});

test('الارتداد بعد الإكتوس أصغر من حركة الوصول (ثلث إلى نصف تقريبًا) عدا الضربة الأخيرة', () => {
  for (const m of [2, 3, 4]) for (let i = 0; i < m - 1; i++) {
    const seg = segment(m, i); let peak = -1; for (let k = 0; k <= 100; k++) peak = Math.max(peak, handAt(m, i + k / 100).v);
    const reb = peak - METERS[m].beats[i].P[1];
    assert.ok(reb > 0.05 && reb < 0.55, `m${m} ارتداد النبضة ${i + 1} = ${reb.toFixed(2)}`); assert.ok(seg);
  }
});

test('التشويه الزمني: تسارع نحو الإكتوس وتباطؤ في منتصف النبضة، ويحفظ بداية النبضة ونهايتها', () => {
  assert.equal(warp(0), 0); assert.ok(near(warp(1), 1, 1e-12));
  for (let s = 0; s < 1; s += 0.01) assert.ok(warp(s + 0.01) > warp(s), 'رتيبة');
  const d = (s) => (warp(s + 1e-4) - warp(s)) / 1e-4;
  assert.ok(d(0.5) < d(0.02) && d(0.5) < d(0.98));
});

test('البطء: الحركة نفسها بالضبط بزمن مضاعف', () => {
  assert.equal(beatDur(60), 1); assert.equal(beatDur(60, 0.5), 2); assert.equal(beatDur(120), 0.5);
  let t = 0; const n = new Transport(() => t), s = new Transport(() => t);
  n.start(beatDur(72)); s.start(beatDur(72, 0.5));
  for (let i = 0; i < 50; i++) {
    t = i * 0.07; const pn = n.pos(); t = 0.12 + (i * 0.07 - 0.12) * 2; const ps = s.pos();
    // نفس الموضع → نفس النقطة
    const a = handAt(4, pn), b = handAt(4, ps); assert.ok(near(pn, ps, 1e-9) && near(a.u, b.u) && near(a.v, b.v));
  }
});

test('الناقل: ضربة تحضير ثم نبضات منتظمة، والتوقف لا يترك نبضات مجدولة', () => {
  let t = 10; const T = new Transport(() => t);
  T.start(0.5);                                  // 120 ن/د
  assert.ok(near(T.pos(), -1 - 0.12 / 0.5 < -1 ? -1 : (10 - T.t0) / 0.5));
  assert.ok(near(T.timeOf(0), 10 + 0.12 + 0.5), 'النبضة الأولى بعد ضربة تحضير كاملة');
  const got = []; for (let i = 0; i < 60; i++) { t = 10 + i * 0.05; got.push(...T.due(0.15)); }
  assert.deepEqual(got.map((e) => e.b), got.map((_, i) => i));
  for (let i = 1; i < got.length; i++) assert.ok(near(got[i].t - got[i - 1].t, 0.5, 1e-9));
  T.stop(); assert.equal(T.playing, false); assert.deepEqual(T.due(), []);
});

test('الناقل: تغيير السرعة أثناء الأداء لا يقفز بالموضع', () => {
  let t = 0; const T = new Transport(() => t);
  T.start(1); t = 2.3; const p = T.pos(); T.setDur(0.5); assert.ok(near(T.pos(), p, 1e-12));
  t = 2.8; assert.ok(near(T.pos(), p + 1, 1e-9));
});

test('خطوة بخطوة والتوقف عند نبضة معيّنة', () => {
  let t = 0; const T = new Transport(() => t); let paused = null; T.onPause = (p) => { paused = p; };
  T.step(1); t = 5; assert.equal(T.pos(), 0); assert.equal(paused, 0); assert.equal(T.playing, false);
  T.step(1); t = 10; assert.equal(T.pos(), 1);
  T.runTo(1, 6); const ev = []; for (let i = 0; i < 200; i++) { t = 10 + i * 0.05; ev.push(...T.due(0.15)); T.pos(); }
  assert.deepEqual(ev.map((e) => e.b), [2, 3, 4, 5, 6], 'نقرات حتى نقطة التوقف فقط');
  assert.equal(T.pos(), 6);
});

test('تمرين «اكتشف الخطأ»: النسخة الخاطئة تختلف فعلًا في نبضة واحدة معلنة، ولا تغيّر الأصل', () => {
  const before = JSON.stringify(METERS);
  for (const m of [2, 3, 4]) for (let r = 0; r < 5; r++) {
    const w = wrongVariant(m, () => r / 5);
    const meas = w.beats.map((_, i) => measuredDir(m, i, w.beats));
    assert.deepEqual(meas, w.dirs, 'الاتجاهات المعلنة للنسخة الخاطئة هي ما يرسمه المسار');
    const diff = meas.map((d, i) => d !== METERS[m].dirs[i]);
    assert.ok(diff[w.wrongBeat], 'النبضة المعلنة خاطئة فعلًا');
    assert.equal(meas[0], 'down', 'النبضة الأولى تبقى صحيحة');
  }
  assert.equal(JSON.stringify(METERS), before);
});

test('عيّنات المسار للرسم', () => { for (const m of [2, 3, 4]) { const s = pathSamples(m, 20); assert.equal(s.length, 20 * m); assert.ok(s.every((p) => p.every(Number.isFinite))); } });

test('الاقتباسات من الأدلة موجودة حرفيًا في بنك الدروس (إن وُجد في المشروع)', async () => {
  const fs = await import('node:fs'), B = 'src/content-bank/semester1/';
  const f5 = B + 'grade5/الميزان-الرباعي.json', f7 = B + 'grade7/الرباط-الزمني-والنقطة-الزمنية.json';
  if (!fs.existsSync(f5) || !fs.existsSync(f7)) return;
  const norm = (s) => s.normalize('NFKC').replace(/[ً-ْٰ]/g, '');
  const g5 = norm(fs.readFileSync(f5, 'utf8')), g7 = norm(fs.readFileSync(f7, 'utf8'));
  assert.ok(g5.includes(norm(METERS[4].source.text)));
  assert.ok(g7.includes(norm(METERS[2].source.text)) && g7.includes(norm(METERS[3].source.text)));
});
