// =====================================================================
//  مصدر البيانات الموحَّد للتعليم: النغمة ← الوتر ← الإصبع ← موضع الإصبع على الوتر ← التردد ← حركة القوس.
//
//  القاعدة الوحيدة: التردد يُحسب من طول الوتر المهتز الفعلي (المسافة من الفرس إلى موضع الإصبع):
//        f = f_open × L / y
//  وهي نفس y التي تضع بها العازفة طرف الإصبع (انظر placeLeftHand في violinist.js).
//  لذلك لا يمكن أن يسمع المستخدم نغمة تختلف عن المكان المرئي للإصبع.
//
//  الأوتار (بالتوليف المتساوي، لا = 440 Hz): صول 196.00 — ري 293.66 — لا 440.00 — مي 659.26
//  الأصابع في الوضع الأول (نمط «الثاني العالي»): الأول +2 نصف نغمة، الثاني +4، الثالث +5، الرابع +7.
// =====================================================================

import { SCALES, buildSequence } from '../scales/scale-data.js';

export const L_STRING = 0.325;                                    // طول الوتر المهتز بالمتر (فرس ← عتبة الرقبة) كما في violin.js
export const STRINGS = [
  { idx: 0, name: 'G', ar: 'صول', hz: 196.0 },
  { idx: 1, name: 'D', ar: 'ري', hz: 293.6648 },
  { idx: 2, name: 'A', ar: 'لا', hz: 440.0 },
  { idx: 3, name: 'E', ar: 'مي', hz: 659.2551 },
];
export const FINGER_SEMITONES = [0, 2, 4, 5, 7];                  // الدليل 0 = وتر مفتوح، 1..4 = الأصابع
export const FINGER_LABEL = ['وتر مفتوح', 'السبابة (1)', 'الوسطى (2)', 'البنصر (3)', 'الخنصر (4)'];
// وصف موضع الإصبع على الوتر من أنصاف الدرجات الفعلية للأصابع على هذا الوتر (pat = أنصاف الدرجات للأصابع 1..4)
export function fingerNote(f, pat) {
  const sem = pat[f - 1], d = f === 1 ? sem : sem - pat[f - 2];       // d: المسافة بالنصف نغمة عن الإصبع السابق (أو الوتر المفتوح)
  const prev = ['', 'الوتر المفتوح', 'الإصبع الأول', 'الإصبع الثاني', 'الإصبع الثالث'][f];
  const tag = (f === 1 && sem === 1) || (f === 2 && sem === 3) ? 'واطئ — ' : (f === 2 && sem === 4) ? 'عالٍ — ' : '';
  return d === 1 ? `${tag}نصف نغمة فوق ${prev}` : d === 2 ? `${tag}نغمة كاملة فوق ${prev}` : '';
}

// موضع حافة الإصبع على الوتر: المسافة y من الفرس (متر). الإصبع 0 = الوتر المفتوح = L كاملة.
export function stopLength(finger) { return L_STRING / Math.pow(2, FINGER_SEMITONES[finger] / 12); }
// التردد من الطول المهتز مباشرة
export function frequencyFromLength(stringIdx, y) { return STRINGS[stringIdx].hz * L_STRING / y; }
export function pitchHz(stringIdx, finger) { return frequencyFromLength(stringIdx, stopLength(finger)); }

const NOTE_AR = ['دو', 'دو♯', 'ري', 'ري♯', 'مي', 'فا', 'فا♯', 'صول', 'صول♯', 'لا', 'لا♯', 'سي'];
const NOTE_EN = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
export function noteInfo(hz) {
  const m = 69 + 12 * Math.log2(hz / 440), r = Math.round(m);
  return { midi: r, en: NOTE_EN[((r % 12) + 12) % 12] + (Math.floor(r / 12) - 1), ar: NOTE_AR[((r % 12) + 12) % 12], cents: Math.round((m - r) * 100) };
}

// ---------- التمارين ----------
// كل نغمة: [الوتر، رقم الإصبع (0 مفتوح)، المدة بالنبضات]
const A = 2, E = 3;
const TWINKLE = [
  [A, 0, 1], [A, 0, 1], [E, 0, 1], [E, 0, 1], [E, 1, 1], [E, 1, 1], [E, 0, 2],
  [A, 3, 1], [A, 3, 1], [A, 2, 1], [A, 2, 1], [A, 1, 1], [A, 1, 1], [A, 0, 2],
  [E, 0, 1], [E, 0, 1], [A, 3, 1], [A, 3, 1], [A, 2, 1], [A, 2, 1], [A, 1, 2],
  [E, 0, 1], [E, 0, 1], [A, 3, 1], [A, 3, 1], [A, 2, 1], [A, 2, 1], [A, 1, 2],
  [A, 0, 1], [A, 0, 1], [E, 0, 1], [E, 0, 1], [E, 1, 1], [E, 1, 1], [E, 0, 2],
  [A, 3, 1], [A, 3, 1], [A, 2, 1], [A, 2, 1], [A, 1, 1], [A, 1, 1], [A, 0, 2],
];
// ---------- السلالم (مصدرها الوحيد scales/scale-data.js، نفسه الذي تستخدمه scales.html) ----------
// كل نغمة هنا تحمل رابعًا: نمط أنصاف الدرجات للأصابع 1..4 على وتر النغمة؛ منه يُحسب موضع الإصبع (فلا يتكرر الجدول).
const DIR_AR = { up: 'صاعدًا', down: 'هابطًا', full: 'صاعدًا وهابطًا' };
function scaleExercises() {
  const out = [];
  for (const sc of Object.values(SCALES)) {
    for (const dir of ['up', 'down', 'full']) {
      const seq = buildSequence(sc, { direction: dir, dOpenDown: true });     // «ري» نازلًا على وتر ري المفتوح (أبسط وأوضح للمبتدئ)
      const notes = seq.map((n, i) => {
        const p = sc.pattern[n.string] || {};
        const pat = [1, 2, 3, 4].map((f) => (p[f] != null ? p[f] : FINGER_SEMITONES[f]));
        return [n.string, n.finger, i === seq.length - 1 ? 2 : 1, pat, { en: n.latin, ar: n.nameAr }];     // الاسم الكتابي من السلم نفسه (سي♭ لا لا♯)
      });
      out.push({ id: `${sc.id}:${dir}`, scale: sc.id, dir, group: 'scales', title: `${sc.title} — ${DIR_AR[dir]}`, bpm: 60, notes });
    }
  }
  return out;
}
// =====================================================================
//  مكتبة المقطوعات — نفس فكرة العود: تُكتب المقطوعة بأسماء النغمات كما في النوتة، والبرنامج يحدد الوتر والإصبع وموضعه.
//  melody('A4 B4 C#5:2 R D5:0.5 E½b5') ← نغمة[:ضربات]  (#=دييز، b=بيمول، ½b=نصف بيمول، ½#=نصف دييز)، R = سكتة.
//  الوضع الأول: كل نغمة على أعلى وتر مفتوح لا يزيد عنها، والإصبع بالبعد عن الوتر المفتوح:
//    0 مفتوح · حتى 2.5 نصف تون ← الأول · حتى 4.5 ← الثاني · حتى 6 ← الثالث · 6.5–7 ← الرابع.
//  أرباع التون تُعزف بموضع إصبع وسطي (التردد يُحسب من طول الوتر نفسه، فالصوت يطابق الإصبع المرئي).
//  لإضافة مقطوعة: { id, group: 'piece', title, bpm, notes: melody('...') } إلى PIECES فتظهر في القائمة تحت «مقطوعات».
// =====================================================================
const STEP = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }, NAME_AR = { C: 'دو', D: 'ري', E: 'مي', F: 'فا', G: 'صول', A: 'لا', B: 'سي' };
const OPEN_MIDI = [55, 62, 69, 76];                               // صول3 ري4 لا4 مي5
function parseNote(tok) {
  const m = /^([A-G])(½b|½#|#|b)?(-?\d)$/.exec(tok); if (!m) throw new Error('نغمة غير مفهومة: ' + tok);
  const alt = { '#': 1, b: -1, '½b': -0.5, '½#': 0.5 }[m[2]] || 0;
  return { midi: 12 * (+m[3] + 1) + STEP[m[1]] + alt, en: m[1] + ({ '#': '♯', b: '♭', '½b': '½♭', '½#': '½♯' }[m[2]] || '') + m[3], ar: NAME_AR[m[1]] + ({ '#': '♯', b: '♭', '½b': ' نصف بيمول', '½#': ' نصف دييز' }[m[2]] || '') };
}
export function melody(list, opt = {}) {
  const out = [], oct = opt.octave || 0;          // octave: نقل بالأوكتاف (+1 = أعلى بأوكتاف)
  for (let tok of list.trim().split(/\s+/)) {
    if (tok === '|') continue;
    tok = tok.replace(/~$/, '');                    // علامة الحلية الموصولة في نوتات العود: تُعزف على الكمان نغمة عادية
    const [n0, b] = tok.split(':'), beats = b ? +b : 1;
    const n = n0 === 'R' ? n0 : n0.replace(/(-?\d)$/, (d) => String(+d + oct));
    if (n === 'R') { out.push([-1, 0, beats]); continue; }
    const nt = parseNote(n);
    let s = -1; for (let k = 3; k >= 0; k--) if (nt.midi >= OPEN_MIDI[k] - 1e-9) { s = k; break; }
    const semi = nt.midi - (s >= 0 ? OPEN_MIDI[s] : 0);
    if (s < 0 || semi > 7 + 1e-9) throw new Error(`النغمة ${n} خارج مدى الكمان في الوضع الأول (صول3 ← سي5)`);
    const f = semi === 0 ? 0 : semi <= 2.5 ? 1 : semi <= 4.5 ? 2 : semi <= 6 ? 3 : 4;
    out.push([s, f, beats, null, { en: nt.en, ar: nt.ar }, semi]);
  }
  // نغمتان متتاليتان على الوتر نفسه بالإصبع نفسه وبارتفاعين مختلفين (صول ← لا بيمول، فا ← صول بيمول): لا يزحلق العازف الإصبع،
  // بل يأخذ الإصبع التالي النغمة الأعلى (أو السابق النغمة الأدنى إن لم يوجد تالٍ)
  const notes = out.filter((n) => n[0] >= 0);
  for (let i = 1; i < notes.length; i++) {
    const a = notes[i - 1], b = notes[i];
    if (a[0] !== b[0] || !a[1] || a[1] !== b[1] || a[5] === b[5]) continue;
    const [hi, lo] = b[5] > a[5] ? [b, a] : [a, b];
    if (hi[1] < 4) hi[1]++; else if (lo[1] > 1) lo[1]--;
  }
  for (const n of notes) {                         // أنصاف الدرجات لكل الأصابع على هذا الوتر (المتأثر بالنغمة يتحرك، والباقي على نمطه)
    const [, f] = n, semi = n[5], pat = FINGER_SEMITONES.slice(1);
    if (f) { pat[f - 1] = semi; for (let q = f - 2; q >= 0; q--) pat[q] = Math.min(pat[q], pat[q + 1] - 1); for (let q = f; q < 4; q++) pat[q] = Math.max(pat[q], pat[q - 1] + 1); }
    n[3] = pat; n.length = 5;
  }
  return out;
}
/** مقطوعة مدوّنة مازورةً مازورة؛ تتحقق من أن مجموع أزمنة كل مازورة يساوي الميزان (الأسماء المبدوءة بـ ^ أناكروز) */
function piece(meter, bars, order) {
  const len = (str) => str.trim().split(/\s+/).reduce((a, tok) => a + (tok.includes(':') ? +tok.replace('~', '').split(':')[1] : 1), 0);
  for (const [k, v] of Object.entries(bars)) if (!k.startsWith('^') && Math.abs(len(v) - meter) > 1e-9) throw new Error(`مازورة «${k}» مجموعها ${len(v)} لا ${meter}`);
  return order.trim().split(/\s+/).map((k) => { if (!(k in bars)) throw new Error('مازورة غير معرّفة: ' + k); return bars[k]; }).join(' | ');
}
// ---------- نقل حرفي من نوتات المعلم كما في لعبة العود (oudist-3d/src/teaching/exercises.js) ----------
// في العود كُتبت أخفض بأوكتاف من المدوّن (لأن العود يُسمع أخفض بأوكتاف). على الكمان تُعزف كما هي مكتوبة في النوتة: octave +1.
// فيبدأ السماعي من دو4 (الإصبع الثالث على وتر صول) وأعلى نغمة فيه ري5، وكلها في الوضع الأول.
const SAMAI = {
  1: 'C3 C3:0.5 C3:0.5 C3', 2: 'E½b3 E½b3:0.5 E½b3:0.5 E½b3', 3: 'G3 F3 E½b3', 4: 'D3:2 R',
  5: 'B½b2 B½b2:0.5 B½b2:0.5 B½b2', 6: 'D3 D3:0.5 D3:0.5 D3', 7: 'F3 E½b3 D3', 8: 'C3:2 R',
  9: 'G3 F3 E½b3', 10: 'G3 F3 E½b3', 11: 'G3 F3 E½b3', 12: 'G3 F3:2', 13: 'F3 E½b3 D3', 14: 'F3 E½b3 D3',
  15: 'E½b3:0.5 F3:0.5 G3:0.5 F3:0.5 E½b3:0.5 D3:0.5', 16: 'C3:2 R',
  17: 'C4:1.5 B½b3:0.5 A3:0.5 B½b3:0.5', 18: 'C4:2 R', 19: 'C4:0.5 B½b3:0.5 C4:0.5 B½b3:0.5 C4:0.5 B½b3:0.5',
  20: 'D4:0.5 C4:0.5 Bb3:0.5 A3:0.5 G3', 21: 'G3:1.5 F3:0.5 E½b3:0.5 F3:0.5', 22: 'G3:2 R',
  23: 'Bb3:0.5 A3:0.5 Bb3:0.5 A3:0.5 Bb3:0.5 A3:0.5', 24: 'C4:0.5 Bb3:0.5 A3:0.5 G3:0.5 F3', 25: 'F3:1.5 E½b3:0.5 D3:0.5 E½b3:0.5', 26: 'F3:2 R',
  27: 'Ab3:0.5 G3:0.5 Ab3:0.5 G3:0.5 Ab3:0.5 G3:0.5', 28: 'B3:0.5 Ab3:0.5 G3:0.5 F3:0.5 G3:0.5 F3:0.5', 29: 'Ab3:0.5 G3:0.5 F3:0.5 E½b3:0.5 F3:0.5 E½b3:0.5',
  30: 'G3:0.5 F3:0.5 E½b3:0.5 D3:0.5 E½b3:0.5 D3:0.5', 31: 'F3:0.5 E½b3:0.5 D3:0.5 C3:0.5 D3:0.5 C3:0.5', 32: 'E½b3 D3 C3',
};
const SAMAI_ORDER = '1 2 3 4 5 6 7 8  1 2 3 4 5 6 7 8  9 10 11 12 13 14 15 16  9 10 11 12 13 14 15 16  17 18 19 20 21 22 23 24 25 26 27 28 29 30 31 32  1 2 3 4 5 6 7 8';
// ---------- دولاب راست (٤/٤ مكتوب ₵) — نسختان من النوتتين المرفقتين ----------
const DULAB = {
  a1: 'C4 C4 G3 G3', a2: 'E½b3:0.5 F3:0.5 E½b3:0.5 D3:0.5 C3:2',
  a6: 'E½b3:0.5 F3:0.5 E½b3:0.5 D3:0.5 C3 D3:0.5 E½b3:0.5', a7: 'F3:1.5 E½b3:0.5 E½b3:0.5 D3:0.5 D3:0.5 C3:0.5',
  e1: 'C3:0.5 R:3.5', rest: 'R:4', e2: 'C3:0.5 F3 F3:0.5 F3 F3',
  b1: 'C3:0.5 F3 G3:0.5 F3:0.5 G3:0.5 F3:0.75 E½b3:0.25', b2: 'D3:0.5 E½b3 F3:0.5 E½b3:0.5 F3:0.5 E½b3:0.75 D3:0.25', b3: 'C3:0.5 D3 F3:0.5 E½b3:0.5 D3:0.5 C3:0.5 B½b2:0.5',
  f1: 'C3:0.5 D3:0.5 E½b3:0.5 F3:0.5 G3:0.5 E½b3:0.5 F3', f2: 'C3 G2 C3 D3', f3: 'E½b3 C3 D3 B½b2', f4: 'C3:4',
  // النسخة الثانية (المزخرفة)
  '^up': 'A3:0.5 B½b3:0.5', c1: 'C4 B½b3:0.5 A3:0.5 G3:0.5 A3:0.5 G3:0.5 F3:0.5', c2: 'E½b3:0.5 F3:0.5 E½b3:0.5 D3:0.5 C3 A3:0.5 B½b3:0.5',
  d1: 'C3:0.5 F3 G3:0.5 F3 G3:0.75 F3:0.25', d2: 'E½b3:0.5 E½b3 F3:0.5 E½b3 F3:0.75 E½b3:0.25', d3: 'D3:0.5 D3 F3:0.5 E½b3:0.5 D3:0.5 C3:0.5 B½b2:0.5',
};
const DULAB1_ORDER = 'a1 a2 a1 a2 a1 a6 a7 e1 rest  a1 a2 a1 a2 a1 a6 a7 e2  b1 b2 b3 f1  b1 b2 b3 f2 f3 f4';
const DULAB2_ORDER = '^up c1 c2 c1 c2 c1 a6 a7 e1 rest  c1 c2 c1 c2 c1 a6 a7 e2  d1 d2 d3 f1  d1 d2 d3 f2 f3 f4';

const ORIG = { octave: 1 };
export const PIECES = [
  { id: 'samai-darij-rast', group: 'piece', title: 'سماعي دارج راست', bpm: 100, notes: melody(piece(3, SAMAI, SAMAI_ORDER), ORIG) },
  { id: 'dulab-rast', group: 'piece', title: 'دولاب راست', bpm: 92, notes: melody(piece(4, DULAB, DULAB1_ORDER), ORIG) },
  { id: 'dulab-rast-2', group: 'piece', title: 'دولاب راست — النسخة المزخرفة', bpm: 84, notes: melody(piece(4, DULAB, DULAB2_ORDER), ORIG) },
];
// ---------- المقامات الشرقية (نفس سلالم لعبة العود، صعودًا وهبوطًا، أعلى بأوكتاف لتناسب الكمان) ----------
export const MAQAMAT = [
  { id: 'maqam-ajam', title: 'مقام العجم على دو', bpm: 72, notes: melody('C3 D3 E3 F3 G3 A3 B3 C4 B3 A3 G3 F3 E3 D3 C3:2', ORIG) },
  { id: 'maqam-rast', title: 'مقام الراست على دو (بأرباع التون)', bpm: 66, notes: melody('C3 D3 E½b3 F3 G3 A3 B½b3 C4 B½b3 A3 G3 F3 E½b3 D3 C3:2', ORIG) },
  { id: 'maqam-kurd', title: 'مقام الكرد على ري', bpm: 70, notes: melody('D3 Eb3 F3 G3 A3 Bb3 C4 D4 C4 Bb3 A3 G3 F3 Eb3 D3:2', ORIG) },
  { id: 'maqam-bayati', title: 'مقام البياتي على ري', bpm: 66, notes: melody('D3 E½b3 F3 G3 A3 Bb3 C4 D4 C4 Bb3 A3 G3 F3 E½b3 D3:2', ORIG) },
  { id: 'maqam-hijaz', title: 'مقام الحجاز على ري', bpm: 66, notes: melody('D3 Eb3 F#3 G3 A3 Bb3 C4 D4 C4 Bb3 A3 G3 F#3 Eb3 D3:2', ORIG) },
  { id: 'maqam-nahawand', title: 'مقام النهاوند على دو (صعود بسي بيمول، هبوط بسي طبيعية)', bpm: 68, notes: melody('C3 D3 Eb3 F3 G3 Ab3 Bb3 C4 B3 Ab3 G3 F3 Eb3 D3 C3:2', ORIG) },
  { id: 'maqam-saba', title: 'مقام الصبا على ري', bpm: 60, notes: melody('D3 E½b3 F3 Gb3 A3 Bb3 C4 Bb3 A3 Gb3 F3 E½b3 D3:2', ORIG) },
].map((e) => ({ ...e, group: 'maqam' }));

export const EXERCISES = [
  ...scaleExercises(),
  { id: 'scale', group: 'other', title: 'الأصابع ١-٢-٣ على وتر لا', bpm: 60, notes: [[A, 0, 1], [A, 1, 1], [A, 2, 1], [A, 3, 1], [A, 2, 1], [A, 1, 1], [A, 0, 2]] },
  { id: 'open', group: 'other', title: 'القوس على الأوتار المفتوحة (لا ← مي)', bpm: 60, notes: [[A, 0, 2], [E, 0, 2], [A, 0, 2], [E, 0, 2]] },
  { id: 'twinkle', group: 'other', title: 'لحن «يا نجمة صغيرة» (لحن تقليدي) — لا ومي', bpm: 84, notes: TWINKLE },
  ...MAQAMAT,
  ...PIECES,
];
export const SCALE_LIST = Object.values(SCALES).map((s) => ({ id: s.id, title: s.title }));

// ---------- الجدول الزمني ----------
// يعيد أحداثًا بالنبضات: b0 بداية، beats المدة. القوس ينزل في الأحداث الزوجية ويصعد في الفردية.
// فاصل صغير آخر كل نغمة (تغيير اتجاه القوس/عبور الوتر) لا يُسمَع فيه صوت: gapSec بالثواني.
export function buildTimeline(exercise) {
  let b = 0, nb = 0, prev = null;
  // السكتة [-1, 0, ضربات]: لا صوت، والأصابع تبقى على النغمة السابقة، والقوس يعود خلالها إلى بداية ضربته التالية
  const first = exercise.notes.find((n) => n[0] >= 0);
  const ev = exercise.notes.map((nt, k) => {
    if (nt[0] < 0) {
      const src = prev || buildTimeline({ notes: [first] }).events[0];
      const e = { ...src, k, beats: nt[2], b0: b, rest: true, note: { ...src.note, en: '—', ar: 'سكتة' }, fnote: '', bow: src.bow };
      b += nt[2]; nb = 0; return e;
    }
    const [s, f, beats, pat, lab] = nt;
    // pat (اختياري) = أنصاف الدرجات للأصابع 1..4 على هذا الوتر؛ الافتراضي: الإصبع الثاني العالي (+4)
    const semis = pat || FINGER_SEMITONES.slice(1);
    const fy = semis.map((n) => L_STRING / Math.pow(2, n / 12));
    const y = f > 0 ? fy[f - 1] : stopLength(0), hz = frequencyFromLength(s, y), info = noteInfo(hz);
    if (lab) { info.en = lab.en; info.ar = lab.ar; }
    const e = { k, string: s, finger: f, beats, b0: b, y, fy, hz, note: info, semis: f > 0 ? semis[f - 1] : 0, fnote: f > 0 ? fingerNote(f, semis) : '', bow: nb % 2 === 0 ? 'down' : 'up' };
    b += beats; nb++; prev = e; return e;
  });
  return { events: ev, totalBeats: b, exercise };
}
// فاصل غير مسموع في آخر النغمة (بالثواني) — بين 40 و110 مللي ثانية، نحو 8% من مدة النبضة
export const gapSeconds = (bpm) => Math.max(0.04, Math.min(0.11, 0.08 * 60 / bpm));

// حالة الأداء عند موضع beat: الوتر الحالي، وضع القوس، ضغط الأصابع (0..1)، ومعلومات النغمة الحالية
export function stateAt(tl, beat, bpm) {
  const evs = tl.events, last = evs[evs.length - 1];
  const bt = Math.max(0, Math.min(tl.totalBeats - 1e-6, beat));
  let i = evs.findIndex((e) => bt >= e.b0 && bt < e.b0 + e.beats); if (i < 0) i = evs.length - 1;
  const e = evs[i], sec = 60 / bpm, dur = e.beats * sec, f = (bt - e.b0) * sec / dur;
  const gap = Math.min(dur * 0.4, gapSeconds(bpm)) / dur, sounding = !e.rest && f < 1 - gap;
  // وضع القوس على الطول (0.17 م ← → 0.50 م): حركة جيبية متصلة طوال مدة النغمة بما فيها الفاصل الصامت؛
  // السرعة تقترب من الصفر عند آخر النغمة وأولها فيكون تغيير الاتجاه انسيابيًا (بلا توقف ولا قفزة في السرعة).
  const sm = (x) => x * x * (3 - 2 * x), p = 0.5 - 0.5 * Math.cos(Math.PI * f);
  let u = e.bow === 'down' ? 0.16 + 0.40 * p : 0.56 - 0.40 * p;
  if (e.rest) {                       // سكتة: القوس يعود بهدوء من نهاية الضربة السابقة إلى بداية الضربة التالية
    const end = i > 0 && !evs[i - 1].rest ? (evs[i - 1].bow === 'down' ? 0.56 : 0.16) : 0.16, nxe = evs[i + 1];
    const start = nxe && !nxe.rest ? (nxe.bow === 'down' ? 0.16 : 0.56) : end;
    u = end + (start - end) * p;
  }
  // عبور الأوتار: خلال الفاصل الأخير ننتقل إلى وتر النغمة التالية
  const nx = evs[i + 1], sm2 = (x) => Math.max(0, Math.min(1, x));
  let sBow = e.string, sFinger = e.string;
  if (nx && nx.string !== e.string && f > 1 - gap) { const t = sm(sm2((f - (1 - gap)) / gap)); sBow = e.string + (nx.string - e.string) * t; sFinger = sBow; }
  // الأصابع: الأصابع 1..finger على الوتر الحالي (الأصابع الأدنى تبقى مكانها)؛ تتغير داخل الفاصل الأخير فقط (حين لا يوجد صوت)
  const press = [0, 0, 0, 0];
  const target = (ev) => { const a = [0, 0, 0, 0]; for (let q = 0; q < ev.finger; q++) a[q] = 1; return a; };
  const cur = target(e); for (let q = 0; q < 4; q++) press[q] = cur[q];
  if (nx) {
    const nxt = target(nx), w = sm(sm2((f - (1 - gap)) / gap));         // تحضير الأصابع داخل الفاصل غير المسموع فقط، فلا يتغيّر ارتفاع النغمة أثناء الصوت
    for (let q = 0; q < 4; q++) press[q] = nx.string !== e.string ? (w > 0.5 ? nxt[q] : cur[q]) : cur[q] + (nxt[q] - cur[q]) * w;
  }
  // مواضع الأصابع على الوتر: تتبدّل مع الوتر الجديد في منتصف الفاصل نفسه الذي تتبدّل فيه الأصابع المضغوطة
  const fy = (nx && nx.string !== e.string && sm(sm2((f - (1 - gap)) / gap)) > 0.5) ? nx.fy : e.fy;
  return { index: i, event: e, next: nx || null, f, u, sBow, sFinger, press, fy, sounding, beat: bt, bpm, done: beat >= tl.totalBeats };
}
