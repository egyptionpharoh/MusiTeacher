// بيانات السلالم — لعبة «سُلّم صول الكبير» (MusiTeacher)
// كل نغمة تُعرَّف بمعطيات موسيقية صريحة: اسم الدرجة، التحويل، الأوكتاف، الوتر، رقم الإصبع.
// مواضع الأصابع لا تُكتب يدويًا: تُحسب من عدد أنصاف الدرجات فوق الوتر المفتوح (السلم المعدَّل).
// لإضافة سلم جديد لاحقًا: أنشئ كائنًا بالبنية نفسها وأضفه إلى SCALES.

// أسماء النغمات بالسولفيج العربي
export const STEP_AR = { C: 'دو', D: 'ري', E: 'مي', F: 'فا', G: 'صول', A: 'لا', B: 'سي' };
const STEP_INDEX = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 };
const STEP_SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

// الأوتار من الأغلظ إلى الأرفع — الفهرس نفسه المستخدم في VN.stringAt بملف violin.js
export const STRINGS = [
  { index: 0, id: 'G', ar: 'صول', midi: 55 },   // G3
  { index: 1, id: 'D', ar: 'ري', midi: 62 },    // D4
  { index: 2, id: 'A', ar: 'لا', midi: 69 },    // A4
  { index: 3, id: 'E', ar: 'مي', midi: 76 },    // E5
];

export function midiOf(n) { return 12 * (n.octave + 1) + STEP_SEMI[n.step] + (n.alter || 0); }
// موضع النغمة على المدرج: 0 = الخط الأول (مي 4)، كل خطوة = خط أو فراغ
export function staffPos(n) { return n.octave * 7 + STEP_INDEX[n.step] - (4 * 7 + STEP_INDEX.E); }
export function noteNameAr(n) { return STEP_AR[n.step] + (n.alter === 1 ? ' دييز' : n.alter === -1 ? ' بيمول' : ''); }
export function noteNameLatin(n) { return n.step + (n.alter === 1 ? '♯' : n.alter === -1 ? '♭' : '') + n.octave; }
export const FINGER_AR = ['وتر مفتوح', 'الإصبع الأول', 'الإصبع الثاني', 'الإصبع الثالث', 'الإصبع الرابع'];

const N = (step, octave, string, finger, alter = 0) => ({ step, octave, alter, string, finger });

// =====================================================================
//  سُلّم صول الكبير — الوضع الأول، أوكتاف واحد (صول 3 ← صول 4)
//  الترقيم كما في الفيديو المرجعي (Ševčík, Op. 1 Book 1, No. 12):
//  صعودًا «ري» على وتر ري مفتوح، ونزولًا «ري» بالإصبع الرابع على وتر صول.
// =====================================================================
export const G_MAJOR_1ST = {
  id: 'g-major-1st',
  title: 'سُلّم صول الكبير',
  subtitle: 'الكمان · الوضع الأول',
  source: 'ترقيم الأصابع وفق تمارين Ševčík (Op. 1, Book 1, No. 12)',
  keySignature: [{ step: 'F', octave: 5 }],   // دييز واحد على خط فا الخامس
  time: [4, 4],
  // نمط الأصابع لكل وتر في هذا السلم: رقم الإصبع ← أنصاف الدرجات فوق الوتر المفتوح
  // (الإصبع الثاني «عالٍ» والثالث ملاصق له: نصف درجة بينهما)
  pattern: {
    0: { 1: 2, 2: 4, 3: 5, 4: 7 },   // وتر صول: لا، سي، دو، ري
    1: { 1: 2, 2: 4, 3: 5, 4: 7 },   // وتر ري: مي، فا دييز، صول، لا
  },
  ascending: [
    N('G', 3, 0, 0), N('A', 3, 0, 1), N('B', 3, 0, 2), N('C', 4, 0, 3),
    N('D', 4, 1, 0), N('E', 4, 1, 1), N('F', 4, 1, 2, 1), N('G', 4, 1, 3),
  ],
  descending: [
    N('G', 4, 1, 3), N('F', 4, 1, 2, 1), N('E', 4, 1, 1), N('D', 4, 0, 4),
    N('C', 4, 0, 3), N('B', 3, 0, 2), N('A', 3, 0, 1), N('G', 3, 0, 0),
  ],
};

// =====================================================================
//  سُلّم دو الكبير — الوضع الأول، أوكتاف واحد (دو 4 ← دو 5)
//  لا علامات تحويل. الإصبع الثاني «واطئ» (+3) لأن فا طبيعية بعد مي: نصف درجة بين الأول والثاني.
//  دو 4 على وتر صول بالإصبع الثالث؛ ري 4 على وتر ري المفتوح.
// =====================================================================
const LOW2 = { 1: 2, 2: 3, 3: 5, 4: 7 };
export const C_MAJOR_1ST = {
  id: 'c-major-1st',
  title: 'سُلّم دو الكبير',
  subtitle: 'الكمان · الوضع الأول',
  source: 'ترقيم أصابع الوضع الأول المعتاد (الإصبع الثاني واطئ)',
  keySignature: [],
  time: [4, 4],
  pattern: { 0: LOW2, 1: LOW2, 2: LOW2 },
  ascending: [
    N('C', 4, 0, 3), N('D', 4, 1, 0), N('E', 4, 1, 1), N('F', 4, 1, 2),
    N('G', 4, 1, 3), N('A', 4, 2, 0), N('B', 4, 2, 1), N('C', 5, 2, 2),
  ],
  descending: [
    N('C', 5, 2, 2), N('B', 4, 2, 1), N('A', 4, 2, 0), N('G', 4, 1, 3),
    N('F', 4, 1, 2), N('E', 4, 1, 1), N('D', 4, 1, 0), N('C', 4, 0, 3),
  ],
};

// =====================================================================
//  سُلّم فا الكبير — الوضع الأول، أوكتاف واحد (فا 4 ← فا 5)، سي بيمول
//  على وتر لا الإصبع الأول واطئ (+1 = سي♭) والثاني واطئ (+3 = دو)؛ وكذلك على وتر مي (فا 5 = +1).
// =====================================================================
export const F_MAJOR_1ST = {
  id: 'f-major-1st',
  title: 'سُلّم فا الكبير',
  subtitle: 'الكمان · الوضع الأول',
  source: 'ترقيم أصابع الوضع الأول المعتاد (الإصبع الأول واطئ على وتري لا ومي)',
  keySignature: [{ step: 'B', octave: 4, alter: -1 }],
  time: [4, 4],
  pattern: { 1: LOW2, 2: { 1: 1, 2: 3, 3: 5, 4: 7 }, 3: { 1: 1, 2: 3, 3: 5, 4: 7 } },
  ascending: [
    N('F', 4, 1, 2), N('G', 4, 1, 3), N('A', 4, 2, 0), N('B', 4, 2, 1, -1),
    N('C', 5, 2, 2), N('D', 5, 2, 3), N('E', 5, 3, 0), N('F', 5, 3, 1),
  ],
  descending: [
    N('F', 5, 3, 1), N('E', 5, 3, 0), N('D', 5, 2, 3), N('C', 5, 2, 2),
    N('B', 4, 2, 1, -1), N('A', 4, 2, 0), N('G', 4, 1, 3), N('F', 4, 1, 2),
  ],
};

export const SCALES = { [C_MAJOR_1ST.id]: C_MAJOR_1ST, [F_MAJOR_1ST.id]: F_MAJOR_1ST, [G_MAJOR_1ST.id]: G_MAJOR_1ST };

// يبني تسلسل العرض.
// direction: 'up' | 'down' | 'full'  (الكامل = صعود ثم نزول دون تكرار القمة، كما في الفيديو)
// dOpenDown: true ← «ري» في النزول على وتر ري المفتوح بدل الإصبع الرابع
// الإيقاع: بيضاء (نصف مازورة) لكل نغمة في 4/4، وفي السلم الكامل تنتهي بمستديرة كما في الفيديو.
export function buildSequence(scale, { direction = 'full', dOpenDown = false } = {}) {
  const down = scale.descending.map(n => (dOpenDown && n.step === 'D' && n.string === 0 && n.finger === 4) ? { ...n, string: 1, finger: 0 } : n);
  let notes;
  if (direction === 'up') notes = scale.ascending.slice();
  else if (direction === 'down') notes = down.slice();
  else notes = scale.ascending.concat(down.slice(1));
  const seq = notes.map((n, i) => {
    const s = STRINGS[n.string];
    const midi = midiOf(n);
    const semis = midi - s.midi;
    if (semis < 0 || (n.finger === 0) !== (semis === 0)) throw new Error('بيانات غير متسقة للنغمة ' + noteNameLatin(n));
    const pat = scale.pattern[n.string] || {};
    if (n.finger > 0 && pat[n.finger] !== semis) throw new Error('رقم الإصبع لا يطابق نمط الوتر: ' + noteNameLatin(n));
    // الأصابع الثابتة: على الوتر نفسه، كل إصبع أقل من الإصبع العازف يبقى موضوعًا على موضعه
    const held = [];
    for (let f = 1; f < n.finger; f++) if (pat[f] != null) held.push({ string: n.string, finger: f, semis: pat[f] });
    return {
      index: i, ...n, midi, semis, held,
      beats: 2, kind: 'half',
      nameAr: noteNameAr(n), latin: noteNameLatin(n), pos: staffPos(n),
      dir: direction === 'full' ? (i < scale.ascending.length ? 'up' : 'down') : direction,
    };
  });
  if (direction === 'full') { const last = seq[seq.length - 1]; last.beats = 4; last.kind = 'whole'; }
  let t = 0;
  for (const e of seq) { e.startBeat = t; t += e.beats; }
  return seq;
}

// المسافة الفيزيائية لموضع الإصبع: طول الوتر المهتز = L · 2^(-n/12)
export function stopFromBridge(L, semis) { return L * Math.pow(2, -semis / 12); }
