// اختبارات «نوتات النشيد والمارشات»: البيانات الموسيقية، الإعادات، المزامنة، المنضّد، الألعاب، الحقوق.
// node --test tests/anthem.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { freqOf, keySigLabel, parseSong, playOrder, buildTimeline, eventAt, keyAlters, noteName, valueName, transposeSong, printedAccidentals, measureCapacity, pitchSig, rhythmSig, TPQ } from '../src/lib/anthem/notation.js';
import { SONGS, PENDING, RIGHTS, REVIEW, getSong, reviewRow, defaultTempo, keyText } from '../src/lib/anthem/songs.js';
import { SCORES } from '../src/lib/anthem/scores.js';
import { engrave, toSvgString, beamGroups } from '../src/lib/anthem/engrave.js';
import { rng, noteQuestion, rhythmQuestion, completeQuestion, orderQuestion, checkOrder, listenQuestion, challenge, onsets, scoreTaps, explainNote } from '../src/lib/anthem/games.js';
import { estimatePitch, INSTRUMENTS } from '../src/lib/anthem/audio.js';

const EXPECTED = { 'bilad-al-izz': 36, 'ya-hayyu-ya-qayyum': 35, 'humat-al-haq': 56, 'tazhu-bika-al-awam': 28, 'anshudat-al-watan': 20, 'ya-zeina': 16, 'sawt-al-nahda': 52, 'habibati-oman': 144, 'nahda-mutajaddida': 50, 'ya-mawtini': 61 };
const notes = (m) => m.measures.flatMap((ms) => ms.events.filter((e) => e.kind === 'note'));

test('كل الأناشيد العشرة تُقرأ وكل مازورة تكمل ميزانها بالضبط', () => {
  assert.equal(SONGS.length, 10);
  for (const s of SONGS) {
    const m = getSong(s.id).music; assert.equal(m.measures.length, EXPECTED[s.id], s.title);
    for (const ms of m.measures) assert.equal(ms.dur, measureCapacity(m.time), `${s.title} م${ms.number}`);
  }
});
test('المحلل يرفض مازورة لا تكمل الميزان ويحدد موضعها', () => {
  assert.throws(() => parseSong('key=C time=2/4\nC4:4 D4:8 |'), /المازورة 1/);
  assert.throws(() => parseSong('key=C time=2/4\nC4:4 C4:4 | (3 C4:8 D4:8) C4:4 |'), /ثلاثية/);
  assert.throws(() => parseSong('key=C time=2/4\nC4:4 X:4 |'), /غير مفهوم/);
  assert.throws(() => parseSong('key=C time=2/4\nC4:4~ D4:4 |'), /رباط/);
});
test('دليل السلم والعلامات العارضة: الأثر يستمر في المازورة نفسها فقط', () => {
  assert.deepEqual(keyAlters('Eb'), { C: 0, D: 0, E: -1, F: 0, G: 0, A: -1, B: -1 });
  const h = getSong('habibati-oman').music;
  assert.deepEqual(h.measures[49].events.map((e) => e.alter), [0, 0, 0, 0]); // F ♮E F E(♮ مستمر)
  assert.deepEqual(h.measures[51].events.filter((e) => e.step === 'E').map((e) => e.alter), [-1, -1]); // مازورة جديدة: يعود الدليل
  const b = getSong('bilad-al-izz').music; assert.equal(noteName(b.measures[23].events[0]), 'فا دييز');
  assert.equal(b.measures[24].events[1].alter, 0); // Fn4 في م25
  const n = getSong('nahda-mutajaddida').music; // D الكبير: C دييز من الدليل، A# مطبوعة ثم بيكار
  assert.equal(n.measures[4].events[3].alter, 1); assert.equal(n.measures[23].events[3].alter, 1); assert.equal(n.measures[24].events[0].alter, 0);
  const acc = printedAccidentals(n); assert.equal(acc[23][3], 1); assert.equal(acc[24][0], 0); assert.equal(acc[4][3], null);
});
test('الأربطة: نغمة واحدة مسموعة بطول السلسلة', () => {
  const t = getSong('tazhu-bika-al-awam').music; const tl = buildTimeline(t, playOrder(t));
  const k = tl.events.findIndex((e) => e.mi === 15 && e.ei === 2); assert.equal(tl.events[k].soundDur, 1.5); assert.equal(tl.events[k + 1].tiePrev, true);
});
test('النقل إلى نسخة المصدر الثانية بتهجئة صحيحة (بلاد العز: مي بيمول ← دو)', () => {
  const s = getSong('bilad-al-izz', 'C').music; assert.equal(s.key, 'C');
  const f = s.measures[23].events[0]; assert.equal(f.step + f.alter + f.octave, 'D14');
  const a = getSong('bilad-al-izz').music; assert.ok(notes(s).every((e, i) => e.midi === notes(a)[i].midi - 3));
  const h = getSong('humat-al-haq', 'G').music; assert.ok(notes(h).every((e, i) => e.midi === notes(getSong('humat-al-haq').music)[i].midi - 3));
});
test('ترتيب العزف: الإعادات وخانات النهاية والرجوع إلى العلامة والخاتمة', () => {
  const o = (id) => playOrder(getSong(id).music).map((i) => i + 1);
  const bil = o('bilad-al-izz'); assert.deepEqual(bil.slice(9, 20), [10, 11, 4, 5, 6, 7, 8, 9, 10, 12, 13]); assert.equal(bil.length, 58);
  const hayy = o('ya-hayyu-ya-qayyum'); // 1-16 ×2، 17-31، 32[1]، 29-31، 33[2]، D.S. ← 1-31، الخاتمة 34-35
  assert.deepEqual(hayy.slice(46, 54), [31, 32, 29, 30, 31, 33, 1, 2]); assert.deepEqual(hayy.slice(-4), [30, 31, 34, 35]);
  const hab = o('habibati-oman'); assert.deepEqual(hab.slice(-21), [28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 139, 140, 141, 142, 143, 144]);
  const nah = o('nahda-mutajaddida'); assert.deepEqual(nah.slice(22, 27), [23, 24, 25, 10, 11]); assert.ok(nah.includes(26) && !nah.slice(0, 25).includes(26));
  // بلا إعادات: كل مازورة مرة واحدة ويؤخذ آخر خانة نهاية
  const plain = playOrder(getSong('bilad-al-izz').music, { repeats: false }).map((i) => i + 1); assert.ok(!plain.includes(11) && plain.includes(12));
  // الرجوع المحسوم وفق العرف: دون إعادات، خانة النهاية الأخيرة، والتوقف عند Fine
  const hum = o('humat-al-haq'); const k = hum.lastIndexOf(56, hum.length - 2); assert.equal(hum[k + 1], 19); assert.equal(hum[hum.length - 1], 56);
  assert.ok(!hum.slice(k + 1).includes(28) && !hum.slice(k + 1).includes(47), 'لا خانة أولى في مرور الرجوع');
  const zei = o('ya-zeina'); assert.equal(zei.length, 24 + 16); assert.deepEqual(zei.slice(-16), Array.from({ length: 16 }, (_, i) => i + 1));
  const saw = o('sawt-al-nahda'); assert.deepEqual(saw.slice(-49), Array.from({ length: 51 }, (_, i) => i + 2).filter((m) => m !== 7 && m !== 16)); // خانات النهاية الأولى (7، 16) تُتجاوز
  const nd = o('nahda-mutajaddida'); assert.deepEqual(nd.slice(-34 + 2), [...Array.from({ length: 23 }, (_, i) => i + 1), ...Array.from({ length: 9 }, (_, i) => i + 26)]); assert.equal(nd[nd.length - 1], 34);
  // الرجوع غير المحسوم (dsign) لا يُنفَّذ
  const ans = o('anshudat-al-watan'); assert.equal(ans[ans.length - 1], 20); assert.equal(ans.length, 32);
  // بلا تنفيذ القفزات: يتوقف عند نهاية المدون
  assert.equal(playOrder(getSong('humat-al-haq').music, { jumps: false }).length, 70);
});
test('الخط الزمني والمزامنة: البحث الثنائي يعيد الحدث الصحيح', () => {
  const m = getSong('bilad-al-izz').music; const tl = buildTimeline(m, playOrder(m));
  assert.equal(tl.total, 58 * 2);
  const i = eventAt(tl, 6.1); const e = tl.events[i]; assert.ok(e.at <= 6.1 && e.at + e.dur > 6.1); assert.equal(e.mi, 3);
  assert.equal(eventAt(tl, 0), 0); assert.equal(tl.events[eventAt(tl, tl.total - 0.01)].k, 57);
  for (let k = 1; k < tl.events.length; k++) assert.ok(tl.events[k].at >= tl.events[k - 1].at);
});
test('المنضّد: رأس لكل نغمة، ومربع لكل مازورة، ولا قيم غير عددية، ولا خروج عن العرض', () => {
  for (const s of SONGS) {
    const m = getSong(s.id).music;
    for (const width of [360, 900, 1400]) {
      const lay = engrave(m, { width, sp: 10 });
      const heads = lay.items.filter((it) => it.t === 'group' && it.kind === 'note'); assert.equal(heads.length, notes(m).length, s.title);
      assert.equal(lay.measureBoxes.length, m.measures.length);
      const svg = toSvgString(lay); assert.ok(!/NaN|undefined|Infinity/.test(svg), `${s.title} @${width}`);
      for (const b of lay.measureBoxes) assert.ok(b.x >= 0 && b.x + b.w <= width + 0.5, `${s.title} عرض`);
    }
  }
  const bil = getSong('bilad-al-izz').music; // الثلاثية مجموعة عارضة واحدة، والكروش تُجمَّع بالنبضة
  assert.deepEqual(beamGroups(bil.measures[3], bil.beat), [[0, 1, 2], [3, 4]]);
  const z = getSong('ya-zeina').music; assert.deepEqual(beamGroups(z.measures[6], z.beat), [[1, 2], [3, 4, 5]]); // 6/8: نبضة = سوداء منقوطة
});
test('ألعاب: الإجابة مستخرجة من النوتة نفسها في كل الأناشيد', () => {
  for (const s of SONGS) {
    const m = getSong(s.id).music;
    for (let seed = 1; seed <= 12; seed++) {
      const r = rng(seed * 31);
      const q = noteQuestion(m, r); const ev = m.measures[q.mi].events[q.ei];
      assert.equal(q.answer, noteName(ev)); assert.equal(new Set(q.options).size, q.options.length); assert.ok(q.options.includes(q.answer)); assert.equal(q.options.length, 4);
      assert.match(explainNote(m, q.mi, q.ei), /مفتاح صول/);
      const rq = rhythmQuestion(m, r); if (rq) { const sigs = rq.options.map((i) => rhythmSig(m.measures[i])); assert.equal(new Set(sigs).size, sigs.length); assert.ok(rq.options.includes(rq.answer)); }
      const c = completeQuestion(m, r);
      if (c) {
        const orig = c.options.find((o) => o.original); assert.deepEqual(orig.events, m.measures[c.mi].events.slice(c.k));
        for (const o of c.options) assert.equal(o.fits, Math.abs(o.events.reduce((a, e) => a + e.dur, 0) - m.beat) < 0.01, `${s.title} ${o.id}`);
        assert.ok(c.options.some((o) => !o.fits));
      }
      const oq = orderQuestion(m, r);
      if (oq) { assert.equal(checkOrder(m, oq, oq.answer).ok, true); const wrong = oq.tiles.map((t) => t.id); if (!checkOrder(m, oq, wrong).ok) assert.ok(checkOrder(m, oq, wrong).firstWrong >= 0); }
      const lq = listenQuestion(m, r); if (lq) { assert.ok(lq.mis.includes(lq.answer)); assert.equal(new Set(lq.mis.map((i) => pitchSig(m.measures[i]))).size, lq.mis.length); }
    }
    assert.ok(challenge(m, rng(5), 10).length === 10, s.title);
  }
});
test('تمرين النقر: البدايات تستثني السكتات والأربطة، والتقييم بالسماحية', () => {
  const t = getSong('tazhu-bika-al-awam').music; assert.deepEqual(onsets(t, 16), [1.5]); // E4 مربوطة من السابقة (لا تُنقر)، ثم سكتتان، ثم E4
  const r = scoreTaps([0, 0.5, 1], [0.05, 0.45, 1.6]); assert.equal(r.hits, 2); assert.equal(r.extra, 1); assert.equal(r.results[2].hit, false);
  assert.equal(scoreTaps([0, 1], [0, 1]).score, 100);
});
test('المحتوى: لا تكرار، ولا ضياع، والمعلَّق موثَّق', () => {
  const titles = SONGS.map((s) => s.title); assert.equal(new Set(titles).size, titles.length);
  const seqs = SONGS.map((s) => notes(getSong(s.id).music).map((e) => e.midi).join(',')); assert.equal(new Set(seqs).size, seqs.length);
  assert.deepEqual(Object.keys(SCORES).sort(), SONGS.map((s) => s.id).sort());
  const total = SONGS.reduce((a, s) => a + getSong(s.id).music.measures.length, 0); assert.equal(total, 498);
  assert.equal(PENDING.length, 0);
});
test('الحقوق: حالة معتمدة لكل نشيد، لا ملكية عامة دون تحقق، ولا نسبة إلى MusiTeacher', () => {
  for (const s of [...SONGS, ...PENDING]) {
    assert.ok(RIGHTS[s.rights], s.title); assert.notEqual(s.rights, 'public-domain-verified');
    const text = JSON.stringify(s); assert.ok(!/musiteacher|ميوزي/i.test(text), s.title); assert.ok(!/لأغراض تعليمية فقط/.test(text));
    assert.ok(!/وزارة/.test(text), `${s.title}: لا نسبة لجهة رسمية دون مصدر`);
    assert.ok(REVIEW[s.review.status]); assert.ok(s.review.notes.length > 0);
  }
  for (const s of SONGS) { const g = getSong(s.id); assert.ok(g.composer && g.recording && g.allowedUse && g.legal.length && g.source.file && g.source.pages); }
  assert.match(getSong('bilad-al-izz').recording, /لا يطابق الأداء الأصلي/);
});
test('قائمة المراجعة الداخلية والسرعة الافتراضية', () => {
  const r = reviewRow('habibati-oman'); assert.equal(r.measures, 144); assert.equal(r.time, '2/4'); assert.equal(r.clef, 'صول');
  assert.deepEqual(defaultTempo(getSong('nahda-mutajaddida')), { bpm: 115, fromSource: true });
  assert.equal(defaultTempo(getSong('bilad-al-izz')).fromSource, false);
  assert.equal(valueName(getSong('bilad-al-izz').music.measures[2].events[1]), 'سكتة كروش منقوطة');
});
test('مقدّر التردد (المستخدم في اختبار الأصوات) دقيق على موجة معروفة', () => {
  const sr = 44100; const d = new Float32Array(8192); for (let i = 0; i < d.length; i++) d[i] = Math.sin((2 * Math.PI * 440 * i) / sr) + 0.3 * Math.sin((2 * Math.PI * 880 * i) / sr);
  assert.ok(Math.abs(estimatePitch(d, sr) - 440) < 2); assert.equal(INSTRUMENTS.length, 7);
});
test('يا موطني لك الهنا: النسخة المختصرة ومقاطعها', () => {
  const s = getSong('ya-mawtini'); const m = s.music;
  assert.equal(m.key, 'rast-C'); assert.equal(m.tempo, 110); assert.equal(defaultTempo(s).fromSource, true);
  assert.deepEqual(m.measures[3].events.map((e) => noteName(e, { latin: true })), ['G3', 'C4', 'C4', 'D4']); // صول 3 الأساس
  assert.deepEqual(m.measures[14].events.map((e) => noteName(e, { latin: true })), ['B½b3', 'A3', 'C4', 'D4', 'B½b3', 'A3']);
  assert.deepEqual(m.measures[m.measures.length - 1].events.map((e) => noteName(e, { latin: true }) || 'R'), ['C5', 'R']);
  assert.equal(playOrder(m).length, 18 + 2 + 16 + 9 + (16 + 14 + 1) + 7);
  // المقطع المضاف قبل الخاتمة: إعادة بخانتين (م52-53 أولى، م54 ثانية)، ونغمات زينة قبل البيضاوات
  assert.ok(m.measures[37].startRepeat && m.measures[52].endRepeat && m.measures[51].volta === 1 && m.measures[53].volta === 2);
  assert.deepEqual(m.measures[37].events[0].graces.map((g) => g.step + g.octave), ['G4', 'F4']); assert.equal(m.measures[37].dur, m.capacity);
  assert.equal(m.measures[54].labels[0].text, 'الخاتمة');
  const tl = buildTimeline(m, playOrder(m)); assert.ok(tl.events.some((e) => e.graces && e.graces.length === 2));
  // مقام الراست: مي وسي نصف بيمول (ربع تون تحت الطبيعية)، وبقية الدرجات طبيعية
  const e = m.measures[1].events[0]; assert.equal(noteName(e), 'مي نصف بيمول'); assert.equal(e.midi, 63.5);
  assert.ok(Math.abs(freqOf(e.midi) - 320.24) < 0.05);
  assert.equal(noteName(m.measures[m.measures.length - 2].events[2]), 'سي نصف بيمول'); assert.equal(m.measures[m.measures.length - 2].events[1].alter, 0); // لا طبيعية
  assert.equal(keySigLabel('rast-C'), 'سي نصف بيمول ومي نصف بيمول'); assert.equal(keyText(s), 'مقام الراست على دو');
  const sig = toSvgString(engrave(m, { width: 900 })); assert.ok(!/NaN/.test(sig));
  assert.equal(parseSong('key=C time=2/4\nEd4:4 E4:4 |').measures[0].events[1].alter, -0.5); // أثر العلامة المطبوعة يستمر
  assert.ok(s.source.partial.includes('مختصرة') && s.recordingLink.url.startsWith('https://www.youtube.com/'));
  assert.ok(!/ملحن:|ألحان:/.test(s.composer));
});
test('أنشودة الوطن: دليل مقام الراست على فا كما في الصورة المرجعية', () => {
  const s = getSong('anshudat-al-watan'); const m = s.music; const ka = keyAlters(m.key);
  assert.deepEqual([ka.B, ka.E, ka.A, ka.C, ka.D, ka.F, ka.G], [-1, -0.5, -0.5, 0, 0, 0, 0]);
  assert.equal(keySigLabel(m.key), 'سي بيمول، مي نصف بيمول ولا نصف بيمول'); assert.equal(keyText(s), 'مقام الراست على فا');
  const sigItems = engrave(m, { width: 900 }).items.slice(0, 40); assert.ok(sigItems.length);
  const ends = m.measures.filter((x) => x.volta === 2 || x.bar === 'final').map((x) => x.events.filter((e) => e.kind === 'note').pop());
  assert.ok(ends.every((e) => e.step === 'F' || e.step === 'C'), 'الخواتيم على فا (القرار) أو دو');
});
test('التوثيق: كل عمل له بيانات، وكل مصدر موثق برابط، ولا نسبة دون مصدر', async () => {
  const { CREDITS, CREDIT_STATUS, sourceOf, GENERAL_NOTE, RIGHTS_NOTE, UNVERIFIED_TEXT } = await import('../src/lib/anthem/credits.js');
  for (const s of SONGS) {
    const c = CREDITS[s.id]; assert.ok(c && c.summary && c.rows.length, s.title);
    for (const r of c.rows) {
      assert.ok(CREDIT_STATUS[r.status], `${s.title}: ${r.role}`);
      if (r.status === 'verified' || r.status === 'reported') assert.ok(r.src.length && r.src.every((k) => sourceOf(k)), `${s.title}: ${r.role} بلا مصدر`);
      if (r.status === 'unverified') assert.ok(r.value.includes(UNVERIFIED_TEXT), `${s.title}: ${r.role}`);
      for (const k of r.src) { const src = sourceOf(k); assert.ok(src.title && src.publisher); if (src.url) assert.match(src.url, /^https:\/\//); }
    }
  }
  assert.equal(CREDITS['anshudat-al-watan'].rows[0].status, 'verified'); assert.match(CREDITS['anshudat-al-watan'].rows[0].value, /عبد المجيد بن محمد الأنصاري/);
  assert.equal(CREDITS['bilad-al-izz'].rows[0].status, 'provided');
  for (const c of Object.values(CREDITS)) for (const r of c.rows) if (r.status === 'provided') assert.ok(r.src.includes('author'), r.role);
  assert.match(CREDITS['ya-hayyu-ya-qayyum'].rows.find((r) => r.role === 'صفة الموزّع').value, /مدير عام الموسيقى/);
  for (const id of ['anshudat-al-watan', 'bilad-al-izz', 'ya-hayyu-ya-qayyum', 'humat-al-haq', 'sawt-al-nahda', 'habibati-oman', 'nahda-mutajaddida']) assert.ok(!CREDITS[id].rows.some((r) => r.status === 'unverified'), `${id}: كل الأدوار لها نسبة`);
  assert.ok(!CREDITS['sawt-al-nahda'].rows.find((r) => /التوزيع/.test(r.role)).value.includes('الطائي'), 'لا يُنسب التوزيع إلى مؤلف الكلمات');
  assert.match(RIGHTS_NOTE, /لا ينقل/); assert.ok(GENERAL_NOTE.length < 600);
});
test('كاتب PDF: بنية صحيحة وجدول إحالات سليم', async () => {
  const { pdfFromJpegs } = await import('../src/lib/anthem/pdf.js');
  const fake = new Uint8Array([0xff, 0xd8, 1, 2, 3, 0xff, 0xd9]);
  const pdf = pdfFromJpegs([fake, fake], { w: 10, h: 14 }); const txt = new TextDecoder('latin1').decode(pdf);
  assert.ok(txt.startsWith('%PDF-1.4') && txt.trimEnd().endsWith('%%EOF')); assert.match(txt, /\/Count 2/);
  const xref = Number(txt.match(/startxref\n(\d+)/)[1]); assert.ok(txt.slice(xref).startsWith('xref'));
  const offs = [...txt.slice(xref).matchAll(/(\d{10}) 00000 n/g)].map((m) => Number(m[1]));
  offs.forEach((o, i) => assert.ok(txt.slice(o).startsWith(`${i + 1} 0 obj`), `الكائن ${i + 1}`));
});
test('تنسيق TPQ والقيم', () => { assert.equal(TPQ, 48); assert.equal(transposeSong(parseSong('key=C time=2/4\nC4:2 |'), 'D', 1, 2).measures[0].events[0].midi, 62); });
