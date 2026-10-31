// theory.mjs — المصدر الوحيد لأسماء النغمات وترددها في Oriental Maestro. لا يعتمد على DOM ولا على الصوت.
//
// القاعدة الحاكمة: الاسم المعروض والتردد المسموع يخرجان من الدالة نفسها (pitchOf)، فلا يمكن أن يظهر اسم لنغمة
// ويُسمع تردد نغمة أخرى. والـ tuning كائن غير قابل للتعديل: كل تغيير ينتج كائنًا جديدًا، فلا يوجد تراكم للخفض.
//
// ───────────── المراجع المعتمدة ─────────────
// 1) الغربي: السلّم المعدّل المتساوي 12-TET، A4 = 440Hz افتراضيًا، وترقيم الأوكتاف العلمي (C4 = دو الوسطى = MIDI 60).
//    الأسماء: دو ري مي فا صول لا سي. العلامات: دييز ♯ ، بيمول ♭ ، نصف دييز ½♯ ، نصف بيمول ½♭.
// 2) الشرقي: جدول «أسماء أهم درجات السلم العربي، الطبيعية منها والمحوّلة بنصف البعد وربعه» (ص 49 من كتاب المنهج، صورة
//    أرسلها المستخدم). 49 درجة بخطوة ربع تون من يكاه (صول 3) إلى جواب النوى (صول 5)، وراست = دو.
//    قاعدة الجدول: «نيم X» = X ناقص ربع تون، و«تيك X» = X زائد ربع تون (يتحقق منها اختبار الاتساق).
//    الربع تون = 50 سنتًا في الاصطلاح الكتابي (24-TET)، وهو قابل للضبط (quarterCents) لأن الأداء الفعلي يتفاوت حسب
//    المنطقة والمدرسة (ويكيبيديا: Arab tone system / Arabic maqam).
//    خارج المدى G3–G5 لا يوجد اسم في الجدول، فيُعرض الاسم الغربي بدل اختراع اسم.
//
// إزاحة المفتاح: كل مفتاح من الـ 12 في الأوكتاف له إزاحة shift ∈ {-1, 0, +1} ربع تون. فكل درجة من الجدول يمكن
// الوصول إليها (مثلًا سيكاه = مي −1 أو ري♯ +1)، والاسم يُشتق من الدرجة المسموعة وليس من المفتاح الذي أنتجها.

export const A4_HZ = 440;
export const MIDI_MIN = 21;   // A0
export const MIDI_MAX = 108;  // C8

export const SOLFEGE = Object.freeze(['دو', 'ري', 'مي', 'فا', 'صول', 'لا', 'سي']);
const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const NATURAL_PC = Object.freeze([0, 2, 4, 5, 7, 9, 11]);
export const WHITE_PCS = NATURAL_PC;

// لكل درجة من 12: [فهرس الحرف، علامة التحويل]
const SHARP_SPELL = [[0, 0], [0, 1], [1, 0], [1, 1], [2, 0], [3, 0], [3, 1], [4, 0], [4, 1], [5, 0], [5, 1], [6, 0]];
const FLAT_SPELL = [[0, 0], [1, -1], [1, 0], [2, -1], [2, 0], [3, 0], [4, -1], [4, 0], [5, -1], [5, 0], [6, -1], [6, 0]];

const mod12 = (n) => ((n % 12) + 12) % 12;
const isWhitePc = (pc) => NATURAL_PC.includes(pc);

function assertMidi(midi) {
  if (!Number.isInteger(midi) || midi < MIDI_MIN || midi > MIDI_MAX) {
    throw new RangeError(`MIDI خارج النطاق ${MIDI_MIN}–${MIDI_MAX}: ${midi}`);
  }
}

export const octaveOf = (midi) => Math.floor(midi / 12) - 1;

export function midiToHz(midi, cents = 0, a4 = A4_HZ) {
  return a4 * Math.pow(2, (midi - 69) / 12 + cents / 1200);
}

const KIND = {
  natural: { symbol: '', word: '', ascii: '' },
  sharp: { symbol: '♯', word: 'دييز', ascii: '#' },
  flat: { symbol: '♭', word: 'بيمول', ascii: 'b' },
  'half-sharp': { symbol: '½♯', word: 'نصف دييز', ascii: '½#' },
  'half-flat': { symbol: '½♭', word: 'نصف بيمول', ascii: '½b' },
};

function describe(base, kind, letterIndex) {
  const k = KIND[kind];
  const solfege = SOLFEGE[letterIndex];
  const octave = octaveOf(base);
  return {
    midi: base, pc: mod12(base), octave, solfege, letter: LETTERS[letterIndex], accidental: kind,
    symbol: k.symbol, word: k.word,
    text: k.word ? `${solfege} ${k.word}` : solfege,          // رقم الأوكتاف لا يدخل في الاسم
    short: `${solfege}${k.symbol}`,
    scientific: `${LETTERS[letterIndex]}${k.ascii}${octave}`,
  };
}

/**
 * الاسم الغربي للدرجة المسموعة = المفتاح midi مع إزاحة shift ∈ {-1,0,+1} ربع تون.
 * مع الإزاحة تُكتب الدرجة نصف دييز على المفتاح الأبيض الأدنى إن وُجد، وإلا نصف بيمول على الأبيض الأعلى.
 */
export function westernName(midi, { accidental = 'sharp', shift = 0 } = {}) {
  assertMidi(midi);
  if (shift !== -1 && shift !== 0 && shift !== 1) throw new RangeError('shift يجب أن تكون -1 أو 0 أو 1');
  if (shift === 0) {
    const [li, acc] = (accidental === 'flat' ? FLAT_SPELL : SHARP_SPELL)[mod12(midi)];
    return describe(midi, acc === 0 ? 'natural' : acc === 1 ? 'sharp' : 'flat', li);
  }
  const lower = (2 * midi + shift - 1) / 2;
  if (isWhitePc(mod12(lower))) return describe(lower, 'half-sharp', NATURAL_PC.indexOf(mod12(lower)));
  const upper = lower + 1;
  return describe(upper, 'half-flat', NATURAL_PC.indexOf(mod12(upper)));
}

// ───────────── الضبط (tuning) ─────────────
function normalizeShifts(shifts) {
  const out = new Array(12).fill(0);
  if (Array.isArray(shifts)) {
    if (shifts.length !== 12) throw new RangeError('shifts يجب أن تكون 12 قيمة');
    shifts.forEach((v, i) => { out[i] = v; });
  } else if (shifts && typeof shifts === 'object') {
    for (const [k, v] of Object.entries(shifts)) {
      const pc = Number(k);
      if (!Number.isInteger(pc) || pc < 0 || pc > 11) throw new RangeError(`درجة غير صالحة: ${k}`);
      out[pc] = v;
    }
  }
  for (const v of out) if (v !== -1 && v !== 0 && v !== 1) throw new RangeError('كل إزاحة يجب أن تكون -1 أو 0 أو 1');
  return out;
}

/** الوضع الغربي: كل الإزاحات صفر دائمًا. الشرقي الافتراضي (راست على دو): مي وسي بنصف بيمول. */
export function makeTuning({ mode = 'western', shifts, quarterCents = 50, a4 = A4_HZ } = {}) {
  if (mode !== 'western' && mode !== 'eastern') throw new RangeError(`وضع غير معروف: ${mode}`);
  if (!(quarterCents >= 10 && quarterCents <= 50)) throw new RangeError('quarterCents يجب أن تكون بين 10 و50');
  if (!(a4 >= 400 && a4 <= 480)) throw new RangeError('a4 يجب أن تكون بين 400 و480');
  const s = mode === 'western' ? new Array(12).fill(0) : normalizeShifts(shifts === undefined ? { 4: -1, 11: -1 } : shifts);
  return Object.freeze({ mode, a4, quarterCents, shifts: Object.freeze(s) });
}

/** تعيين إزاحة درجة بعينها. idempotent، ويُرجع tuning جديدًا. في الوضع الغربي لا يغيّر شيئًا. */
export function setShift(tuning, pc, shift) {
  if (!Number.isInteger(pc) || pc < 0 || pc > 11) throw new RangeError('pc يجب أن تكون 0..11');
  if (tuning.mode === 'western') return tuning;
  const s = [...tuning.shifts];
  s[pc] = shift;
  return makeTuning({ mode: tuning.mode, shifts: s, quarterCents: tuning.quarterCents, a4: tuning.a4 });
}

/** دورة الأزرار: طبيعي ← نصف بيمول ← نصف دييز ← طبيعي. ثلاث ضغطات تعيد الأصل. */
export function cycleShift(tuning, pc) {
  const next = { 0: -1, '-1': 1, 1: 0 }[tuning.shifts[pc]];
  return setShift(tuning, pc, next);
}

/** المصدر الوحيد للتردد لكل مفتاح. q = موضع الدرجة المسموعة بوحدة ربع التون (2×MIDI + shift). */
export function pitchOf(midi, tuning) {
  assertMidi(midi);
  const pc = mod12(midi);
  const shift = tuning.shifts[pc];
  const cents = shift * tuning.quarterCents;
  return { midi, pc, shift, cents, q: 2 * midi + shift, hz: midiToHz(midi, cents, tuning.a4) };
}

// ───────────── الأسماء الشرقية: جدول ص 49 ─────────────
// الفهرس 0 ↔ q = 110 (صول 3 = يكاه). كل عنصر = اسم الدرجة، والفرق بين عنصرين متتاليين ربع تون.
export const EASTERN_Q_MIN = 110;
export const EASTERN_NAMES = Object.freeze([
  'يكاه', 'نيم حصار قرار', 'حصار قرار', 'تيك حصار قرار', 'عشيران', 'نيم عجم عشيران', 'عجم عشيران',      // 110–116
  'عراق', 'كوشت', 'تيك كوشت', 'راست', 'نيم زيركولاه', 'زيركولاه',                                      // 117–122
  'تيك زيركولاه', 'دوكاه', 'نيم كردي', 'كردي', 'سيكاه', 'بوسليك',                                      // 123–128
  'تيك بوسليك', 'جهاركاه', 'نيم حجاز', 'حجاز', 'تيك حجاز', 'نوى',                                       // 129–134
  'نيم حصار', 'حصار', 'تيك حصار', 'حسيني', 'نيم عجم', 'عجم',                                             // 135–140
  'أوج', 'ماهور', 'تيك ماهور', 'كردان', 'نيم شاهناز', 'شاهناز',                                         // 141–146
  'تيك شاهناز', 'محير', 'نيم سنبلة', 'سنبلة', 'جواب سيكاه', 'جواب بوسليك',                               // 147–152
  'جواب تيك بوسليك', 'جواب جهاركاه', 'جواب نيم حجاز', 'جواب حجاز', 'جواب تيك حجاز', 'جواب النوى',       // 153–158
]);
export const EASTERN_Q_MAX = EASTERN_Q_MIN + EASTERN_NAMES.length - 1; // 158 (صول 5)

// أسماء بديلة مذكورة في الجدول («أو»)
export const EASTERN_ALIASES = Object.freeze({ 151: 'بزرك', 154: 'ماهوران', 158: 'سهم' });

/** {q, name, alias} للدرجة المسموعة، أو null إن لم يكن لها اسم في الجدول. */
export function easternInfo(midi, tuning) {
  const { q } = pitchOf(midi, tuning);
  if (q < EASTERN_Q_MIN || q > EASTERN_Q_MAX) return null;
  return { q, name: EASTERN_NAMES[q - EASTERN_Q_MIN], alias: EASTERN_ALIASES[q] ?? null };
}

export function easternName(midi, tuning) {
  const i = easternInfo(midi, tuning);
  return i ? i.name : null;
}

/** ما يُكتب على المفتاح. display: western | eastern | both. الاسم الغربي هنا اسم الدرجة المسموعة. */
export function labelOf(midi, tuning, { display = 'both', accidental = 'sharp' } = {}) {
  const p = pitchOf(midi, tuning);
  const w = westernName(midi, { accidental, shift: p.shift });
  const info = easternInfo(midi, tuning);
  const e = info ? info.name : null;
  const base = { midi, q: p.q, octave: w.octave, hz: p.hz, cents: p.cents, western: w, eastern: e, alias: info ? info.alias : null };
  if (display === 'western') return { ...base, primary: w.short, secondary: null, fallback: false };
  if (display === 'eastern') return { ...base, primary: e ?? w.short, secondary: null, fallback: e === null };
  return { ...base, primary: w.short, secondary: e, fallback: false };
}
