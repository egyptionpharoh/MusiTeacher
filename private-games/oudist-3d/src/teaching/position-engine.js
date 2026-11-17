// =====================================================================
//  محرّك المواضع (Fingering & String Position Engine) للعود.
//
//  النغمة الواحدة قد تُعزف على أكثر من وتر وفي أكثر من وضع لليد. القاعدة القديمة (placeNote) كانت تختار لكل نغمة
//  منفردة «أقرب وتر إلى الأنف» دون نظر إلى ما قبلها وما بعدها، ولا تعرف إلا الوضع الأول.
//  هذا المحرّك يبحث عن أفضل مسار للجملة كلها (برمجة ديناميكية / Viterbi): لكل نغمة مرشّحون
//  (وتر، مسافة من الأنف، إصبع، وضع اليد)، ولكل انتقال كلفة تمثّل جهد العازف:
//    • الوتر المطلق بلا كلفة (كما يُدرَّس في الوضع الأول)، والأقرب إلى الأنف أرخص، والخنصر والمدّ أغلى قليلًا.
//    • تبديل الوتر: المجاور رخيص، والقفز فوق وتر أغلى.
//    • تغيير وضع اليد على الزند: أغلى الانتقالات، وأرخص إن جرى أثناء رنين وتر مطلق (كما يفعل العازف).
//    • الإصبع نفسه لنغمتين مختلفتين متتاليتين: كلفة (انزلاق أو قفز)، وتزيد في النغمات السريعة.
//    • الأوضاع الأعلى أغلى من الوضع الأول، فلا يُصعد إليها إلا حين تتجاوز الجملة مداه.
//  الإصبع داخل الوضع P يتبع قاعدة المنصة نفسها مُزاحة: (المسافة − P) ≤ درجة ← السبابة، ≤ درجة وثلاثة أرباع ← الوسطى،
//  درجتان ← البنصر، درجتان ونصف ← الخنصر. أرباع التون مدعومة (المسافات بأنصاف صحيحة من نصف التون).
// =====================================================================
import { COURSES, fingerFor } from '../instrument/oud-data.js';

export const PCOST = {
  stopped: 0.15, pinky: 0.35, reach5: 0.2, perPos: 0.5, perSemi: 0.05,
  course1: 0.25, course2: 0.55, course3: 1.2, slurCross: 6,
  shift: 1.2, shiftPer: 0.5, shiftOnOpen: 0.5,
  sameFingerSlide: 0.5, sameFingerHop: 0.7, sameFingerRoll: 0.35, crossStretch: 0.6, fastK: 1.5,
};
export const MAX_POS = 2;                       // أقصى إزاحة للوضع (بأنصاف التون) تدعمها حركة اليد في اللعبة
const r2 = (x) => Math.round(x * 2) / 2;

/** كل المواضع الممكنة لنغمة: [{course, semis, finger, pos}] — pos = إزاحة وضع اليد (0 = الوضع الأول) */
export function candidates(midi, maxPos = MAX_POS) {
  const out = [];
  for (const c of COURSES) {
    const s = r2(midi - c.midi); if (s < 0 || s > 5 + maxPos) continue;
    if (s === 0) { for (let P = 0; P <= maxPos; P++) out.push({ course: c.index, semis: 0, finger: 0, pos: P }); continue; }
    for (let P = 0; P <= maxPos; P++) { const rel = s - P; if (rel > 5 || rel <= 0 || (P > 0 && rel < 1)) continue; out.push({ course: c.index, semis: s, finger: fingerFor(rel), pos: P, rel }); }
  }
  // القرار (الوتر المفرد الغليظ) للنغمات التي لا يعطيها وتر آخر فقط — كما في قاعدة المنصة
  const noQarar = out.filter((q) => q.course !== 0);
  return noQarar.length ? noQarar : out;
}
// perSemi: الأقرب إلى الأنف أفضل (قاعدة الوضع الأول) — فلا يُختار خنصر بعيد على وتر غليظ ونغمته متاحة بإصبع أقرب
const own = (q) => (q.finger === 0 ? 0 : PCOST.stopped + PCOST.perSemi * q.semis + (q.finger === 4 ? PCOST.pinky : 0) + (q.rel === 5 ? PCOST.reach5 : 0)) + PCOST.perPos * q.pos;
function move(a, b, beats, slur) {
  let c = 0; if (slur && (a.course !== b.course || a.pos !== b.pos)) c += PCOST.slurCross;
  const dc = Math.abs(a.course - b.course);
  c += dc === 0 ? 0 : dc === 1 ? PCOST.course1 : dc === 2 ? PCOST.course2 : PCOST.course3;
  if (a.pos !== b.pos) c += (PCOST.shift + PCOST.shiftPer * Math.abs(a.pos - b.pos)) * (a.finger === 0 || b.finger === 0 ? PCOST.shiftOnOpen : 1);
  if (a.finger && a.finger === b.finger && (a.course !== b.course || a.semis !== b.semis) && a.pos === b.pos) {
    // الإصبع نفسه على الموضع نفسه في وتر مجاور: «دحرجة» صغيرة لا قفزة
    const roll = dc === 1 && a.semis === b.semis;
    c += (roll ? PCOST.sameFingerRoll : a.course === b.course && Math.abs(a.semis - b.semis) <= 1 ? PCOST.sameFingerSlide : PCOST.sameFingerHop) * (beats < 0.5 ? PCOST.fastK : 1);
  }
  if (a.finger && b.finger && dc >= 2) c += PCOST.crossStretch;       // إصبعان مضغوطان متتاليان بينهما وتر فأكثر: مدّ عرضي غير مريح
  return c;
}
/**
 * يخطّط جملة كاملة. notes: [{midi, beats}] ← يعيد [{course, semis, finger, pos}] بالترتيب نفسه.
 * opt.maxPos: 0 لحصر الحل في الوضع الأول.
 */
export function planPositions(notes, opt = {}) {
  const maxPos = opt.maxPos ?? MAX_POS, N = notes.length; if (!N) return [];
  const C = notes.map((n) => { const c = candidates(n.midi, maxPos); if (!c.length) throw new Error('نغمة خارج مدى العود: ' + n.midi); return c; });
  const cost = [C[0].map((q) => own(q))], back = [C[0].map(() => -1)];
  for (let i = 1; i < N; i++) {
    cost.push([]); back.push([]);
    for (let j = 0; j < C[i].length; j++) {
      let best = Infinity, bi = 0; const o = own(C[i][j]);
      for (let k = 0; k < C[i - 1].length; k++) { const v = cost[i - 1][k] + move(C[i - 1][k], C[i][j], notes[i - 1].beats ?? 1, notes[i].slur) + o; if (v < best - 1e-9) { best = v; bi = k; } }
      cost[i][j] = best; back[i][j] = bi;
    }
  }
  let j = 0; for (let k = 1; k < C[N - 1].length; k++) if (cost[N - 1][k] < cost[N - 1][j] - 1e-9) j = k;
  const out = Array(N);
  for (let i = N - 1; i >= 0; i--) { const q = C[i][j]; out[i] = { course: q.course, semis: q.semis, finger: q.finger, pos: q.pos }; j = back[i][j]; }
  return out;
}
/** ملخّص للمسار: عدد تبديلات الوتر وتغييرات الوضع — للاختبار والعرض */
export function pathStats(path) {
  let cross = 0, shifts = 0; for (let i = 1; i < path.length; i++) { if (path[i].course !== path[i - 1].course) cross++; if (path[i].pos !== path[i - 1].pos) shifts++; }
  return { cross, shifts, maxPos: Math.max(0, ...path.map((p) => p.pos)) };
}
