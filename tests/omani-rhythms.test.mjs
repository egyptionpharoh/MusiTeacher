// اختبار «إيقاعات الفنون العُمانية»: كل مدوّنة في اللعبة تطابق النقل المستقل من نماذج أدلة المعلم
// (موضع كل ضربة بالدوبل كروش + نوعها دُم/تك)، وكل مازورة طولها صحيح، والمسارات متساوية الطول.
// التشغيل: node --test tests/omani-rhythms.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { ARTS, INSTRUMENTS, buildArt, parsePattern, unitsPerBar } from '../private-games/omani-rhythms/src/data.js';

const H = (s) => s.trim().split(/\s+/).map((x) => [x[0], +x.slice(1)]);
const rep = (s, n, step) => { const one = H(s); const out = []; for (let b = 0; b < n; b++) for (const [k, u] of one) out.push([k, u + b * step]); return out; };
// النقل المستقل (من صور النماذج): [نوع الضربة، موضعها]
const EXPECT = {
  razha: { rahmani: H('D0 T4 D8 D10 T12'), kasir: H('D0 T3 D4 T7 D8 T11 D12 T15') },
  kitha: { rahmani: H('D0 T3 T6 D8 T11 T14'), kasir: rep('D0 T2 T3 D4 T6 T7', 2, 8) },
  madima: { rahmani: rep('D0 T6', 4, 12), kasir: rep('T2 D4 T8 D10', 4, 12), tanak: rep('T0 T2 T4 T6 T8 T10', 4, 12), msindo: H('D4 D6 D8 D10 D20 D22 D24 D26 D28 D30 D32 D34') },
  hambura: { kasir: rep('D0 T4 T6 D8 T12 T14', 2, 16), rahmani: H('D0 T6 D8 T12 D16 T18 D20 T22 D24 T28') },
  ayyala: {
    rahmani: H('D0 T4 T8 D12 T16 D24 T28 T32 D36 T40'), ranna: H('D0 T8 T16 D24 T32 T40'),
    kasir: H('D0 T4 T8 D12 T16 T22 D24 T28 T32 D36 T40 T46'), sajat: rep('D0 T4 T8', 4, 12),
    kasir_flat: H('D0 D24 D32'), tar: H('D0 T4 T10 D12 T16 T22 D24 T28 T32 D36 T40 T46'),
  },
  wailiya: { rahmani: rep('D0 T2 T3 T4 T6', 2, 8), kasir: H('D2 D3 D4 D9 D11 D12'), sajat: rep('T2 T3 T6 T7', 2, 8) },
  baraa: { rahmani: H('D0 T3 T6'), kasir: H('T2 D4 T7') },
  tabl_nisa: { rahmani: H('D0 T2 T4 T6'), kasir: H('D0 T2 T4 T6') },
};
const METERS = { razha: '2/4', kitha: '2/4', madima: '6/8', hambura: '4/4', ayyala: '3/4', wailiya: '2/4', baraa: '2/4', tabl_nisa: '2/4' };
const BARS = { razha: 2, kitha: 2, madima: 4, hambura: 2, ayyala: 4, wailiya: 2, baraa: 1, tabl_nisa: 1 };

test('ثمانية فنون بمعرّفات فريدة', () => {
  assert.equal(ARTS.length, 8);
  assert.deepEqual(ARTS.map((a) => a.id).sort(), Object.keys(EXPECT).sort());
});
for (const a of ARTS) {
  test(`${a.title}: الميزان وعدد الموازير والضربات مطابقة للمصدر`, () => {
    const art = buildArt(a);
    assert.equal(`${a.meter[0]}/${a.meter[1]}`, METERS[a.id]);
    assert.equal(art.barsN, BARS[a.id]);
    assert.deepEqual(art.tracks.map((t) => t.inst).sort(), Object.keys(EXPECT[a.id]).sort());
    for (const t of art.tracks) {
      assert.ok(INSTRUMENTS[t.inst], `آلة غير معرّفة ${t.inst}`);
      assert.deepEqual(t.hits.map((h) => [h.k, h.u]), EXPECT[a.id][t.inst], `${a.id}/${t.inst}`);
      for (const bar of t.bars) assert.equal(bar.reduce((s, n) => s + n.d, 0), unitsPerBar(a.meter));
    }
  });
}
test('نبر الويلية على الجزء الثاني من كل مجموعة في الرحماني', () => {
  const t = buildArt(ARTS.find((a) => a.id === 'wailiya')).tracks.find((x) => x.inst === 'rahmani');
  assert.deepEqual(t.hits.filter((h) => h.acc).map((h) => h.u), [3, 6, 11, 14]);
});
test('رباط الكيذا لا يُنتج ضربة جديدة', () => {
  const t = buildArt(ARTS.find((a) => a.id === 'kitha')).tracks.find((x) => x.inst === 'rahmani');
  assert.ok(!t.hits.some((h) => h.u === 4 || h.u === 12));
});
test('المدوّنة الخاطئة تُرفض (طول مازورة غير صحيح)', () => {
  assert.throws(() => parsePattern('D4 T2', [2, 4]));
});
test('السرعة الموثّقة الوحيدة: الحمبورة ♩ = 220', () => {
  assert.deepEqual(ARTS.filter((a) => a.bpm.source).map((a) => [a.id, a.bpm.v]), [['hambura', 220]]);
});

// ---- التكامل مع المنصة: مسجّلة في السجل ولها غلاف وصفحة دخول، وكل صورها وأصواتها موجودة ----
import fs from 'node:fs';
import path from 'node:path';
import { getGame } from '../src/data/virtualGames.js';
import { gamesConfig } from '../src/lib/gamesConfig.js';
import { EXTRAS, allSampleNames } from '../private-games/omani-rhythms/src/data.js';
test('omani-rhythms: مسجّلة في السجل وفي «عالم الألعاب الموسيقية» ولها غلاف وصفحة دخول', () => {
  const g = getGame('omani-rhythms');
  assert.ok(g && g.status === 'available' && g.category === 'percussion');
  assert.ok(fs.existsSync(path.join(process.cwd(), 'public', g.cover)));
  assert.ok(fs.existsSync(path.join(process.cwd(), 'private-games', 'omani-rhythms', g.entry)));
  assert.ok(gamesConfig.some((c) => c.labId === 'omani-rhythms'));
});
test('omani-rhythms: كل العينات الصوتية وصور الآلات موجودة', () => {
  const dir = path.join(process.cwd(), 'private-games', 'omani-rhythms', 'assets');
  for (const n of allSampleNames()) assert.ok(fs.existsSync(path.join(dir, 'audio', `${n}.mp3`)), n);
  for (const i of [...Object.values(INSTRUMENTS), ...Object.values(EXTRAS)]) assert.ok(fs.existsSync(path.join(dir, 'img', `${i.model}.png`)), i.model);
});
