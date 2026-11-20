// maqamat.mjs — المقامات: درجاتها بوحدة ربع التون، ومنها يُشتق ضبط المفاتيح (أي مفتاح يُخفض ربع تون).
// يعتمد على theory.mjs وحده، فاسم كل درجة يخرج من جدول المنهج (ص 49) نفسه ولا يُكتب يدويًا.
//
// الاصطلاح: q = 2 × MIDI + إزاحة (ربع التون = وحدة). الراست = دو4 = q 120. الأوكتاف = 24 وحدة.
// تحويل درجة إلى مفتاح: q زوجي ← المفتاح q/2 بلا إزاحة؛ q فردي ← المفتاح الأعلى (q+1)/2 مخفوضًا ربع تون
// (نصف بيمول)، وهو الاصطلاح المعتاد: سيكاه = مي½♭ على مفتاح مي، أوج = سي½♭ على مفتاح سي.
//
// المراجع: سلالم المقامات وأجناسها كما في التدوين العربي المعتاد (MaqamWorld؛ وكتاب المنهج للتسميات).
// الأبعاد هنا بالتقسيم الكتابي (24 ربعًا)؛ والأداء الفعلي للسيكاه والأوج يتفاوت بحسب المدرسة، ولذلك قيمة
// ربع التون نفسها قابلة للضبط في الأورج (quarterCents في theory.mjs).

import { makeTuning, EASTERN_NAMES, EASTERN_Q_MIN, EASTERN_Q_MAX, westernName } from './theory.mjs';

const RAST = 120;      // دو4
const DUKAH = 124;     // ري4
const SIKAH = 127;     // مي½♭4
const AJAM_USH = 116;  // سي♭3 (عجم عشيران)

/**
 * steps: الأبعاد المتتالية صعودًا بوحدة ربع التون. desc (اختياري): أبعاد الهبوط من الجواب إذا اختلفت.
 * ajnas: الأجناس كما تُدرَّس [اسم الجنس، رقم الدرجة التي يبدأ منها (0 = القرار)].
 */
export const MAQAMAT = Object.freeze([
  { id: 'rast', ar: 'راست', tonicQ: RAST, steps: [4, 3, 3, 4, 4, 3, 3],
    desc: [4, 2, 4, 4, 3, 3, 4],      // هبوطًا من الجواب: كردان ← عجم ← حسيني ← نوى ← جهاركاه ← سيكاه ← دوكاه ← راست
    ajnas: [['راست', 0], ['راست', 4]],
    note: 'صعودًا يُعزف الأوج (سي½♭)، وفي الهبوط يُعزف غالبًا العجم (سي♭).' },
  { id: 'bayati', ar: 'بياتي', tonicQ: DUKAH, steps: [3, 3, 4, 4, 2, 4, 4],
    ajnas: [['بياتي', 0], ['نهاوند', 3]],
    note: 'قراره الدوكاه، وثانيته السيكاه (مي½♭).' },
  { id: 'sikah', ar: 'سيكاه', tonicQ: SIKAH, steps: [3, 4, 4, 3, 3, 4, 3],
    ajnas: [['سيكاه', 0], ['راست', 2]],
    note: 'قراره السيكاه نفسها (مي½♭)، ويبدأ بجنس سيكاه من ثلاث درجات.' },
  { id: 'huzam', ar: 'هزام', tonicQ: SIKAH, steps: [3, 4, 2, 6, 2, 4, 3],
    ajnas: [['سيكاه', 0], ['حجاز', 2]],
    note: 'مثل السيكاه في قراره، ثم جنس حجاز على النوى (صول – لا♭ – سي).' },
  { id: 'saba', ar: 'صبا', tonicQ: DUKAH, steps: [3, 3, 2, 6, 2, 4, 2],
    ajnas: [['صبا', 0], ['حجاز', 2]],
    note: 'الدرجة الثامنة ري♭ (شاهناز) لا ري: الصبا لا يكتمل في الجواب كما يكتمل غيره.' },
  { id: 'hijaz', ar: 'حجاز', tonicQ: DUKAH, sharps: false, steps: [2, 6, 2, 4, 2, 4, 4],
    ajnas: [['حجاز', 0], ['نهاوند', 3]],
    note: 'بين الكردي (مي♭) والحجاز (فا♯) مسافة تون ونصف تميّز جنس الحجاز.' },
  { id: 'hijazkar', ar: 'حجاز كار', tonicQ: RAST, steps: [2, 6, 2, 4, 2, 6, 2],
    ajnas: [['حجاز', 0], ['حجاز', 4]],
    note: 'جنسا حجاز: على الراست وعلى النوى.' },
  { id: 'nahawand', ar: 'نهاوند', tonicQ: RAST, steps: [4, 2, 4, 4, 2, 6, 2],
    desc: [4, 4, 2, 4, 4, 2, 4],
    ajnas: [['نهاوند', 0], ['حجاز', 4]],
    note: 'صعودًا يُعزف الماهور (سي)، وفي الهبوط يُعزف غالبًا العجم (سي♭).' },
  { id: 'kurd', ar: 'كرد', tonicQ: DUKAH, steps: [2, 4, 4, 4, 2, 4, 4],
    ajnas: [['كرد', 0], ['نهاوند', 3]],
    note: 'ثانيته الكردي (مي♭)؛ لا أرباع فيه.' },
  { id: 'ajam', ar: 'عجم', tonicQ: RAST, steps: [4, 4, 2, 4, 4, 4, 2],
    ajnas: [['عجم', 0], ['عجم', 4]],
    note: 'يماثل السلّم الكبير في الموسيقى الغربية (دو الكبير).' },
  { id: 'ajamush', ar: 'عجم عشيران', tonicQ: AJAM_USH, steps: [4, 4, 2, 4, 4, 4, 2],
    ajnas: [['عجم', 0], ['عجم', 4]],
    note: 'العجم مصوَّرًا على عجم عشيران (سي♭3): سي♭ – دو – ري – مي♭ – فا – صول – لا.' },
]);
export const MAQAM_BY_ID = Object.freeze(Object.fromEntries(MAQAMAT.map((m) => [m.id, m])));

// السلالم الغربية لوضع «البيانو الغربي» (أنصاف تون فقط؛ الخطوة بوحدة ربع التون = 2 × نصف التون)
export const SCALES = Object.freeze([
  { id: 'C-maj', ar: 'دو الكبير', tonicQ: 120, steps: [4, 4, 2, 4, 4, 4, 2], western: true, note: 'لا علامات تحويل: كل المفاتيح البيضاء من دو إلى دو.' },
  { id: 'G-maj', ar: 'صول الكبير', tonicQ: 134, steps: [4, 4, 2, 4, 4, 4, 2], western: true, sharps: true, note: 'دييز واحد: فا♯.' },
  { id: 'F-maj', ar: 'فا الكبير', tonicQ: 130, steps: [4, 4, 2, 4, 4, 4, 2], western: true, note: 'بيمول واحد: سي♭.' },
  { id: 'D-maj', ar: 'ري الكبير', tonicQ: 124, steps: [4, 4, 2, 4, 4, 4, 2], western: true, sharps: true, note: 'دييزان: فا♯ ودو♯.' },
  { id: 'a-min', ar: 'لا الصغير الطبيعي', tonicQ: 114, steps: [4, 2, 4, 4, 2, 4, 4], western: true, note: 'السلّم الصغير النسبي لدو الكبير (المفاتيح البيضاء من لا إلى لا).' },
  { id: 'a-harm', ar: 'لا الصغير الهارموني', tonicQ: 114, steps: [4, 2, 4, 4, 2, 6, 2], western: true, sharps: true, note: 'الدرجة السابعة مرفوعة: صول♯ (بُعد تون ونصف بين فا وصول♯).' },
]);
export const SCALE_BY_ID = Object.freeze(Object.fromEntries(SCALES.map((m) => [m.id, m])));

/** مفتاح البيانو والإزاحة اللذان يعزفان الدرجة q. */
export function keyOfQ(q) {
  if (!Number.isInteger(q)) throw new RangeError('q يجب أن يكون عددًا صحيحًا');
  return q % 2 === 0 ? { midi: q / 2, shift: 0 } : { midi: (q + 1) / 2, shift: -1 };
}

const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const NAT = [0, 2, 4, 5, 7, 9, 11];
const SOLF = ['دو', 'ري', 'مي', 'فا', 'صول', 'لا', 'سي'];
const ACC = { '-2': '♭', '-1': '½♭', 0: '', 1: '½♯', 2: '♯' };
/** اسم الدرجة q بحرف محدد (letterIndex 0..6): يختار الأوكتاف الأقرب ويحسب العلامة بأرباع التون. */
export function spell(q, letterIndex) {
  const base = Math.floor(q / 24) - 1;
  let best = null;
  for (const oct of [base - 1, base, base + 1]) {
    const nat = 2 * (12 * (oct + 1) + NAT[letterIndex]);
    const d = q - nat;
    if (best === null || Math.abs(d) < Math.abs(best)) best = d;
  }
  if (!(String(best) in ACC)) throw new RangeError(`لا تهجئة للدرجة ${q} بالحرف ${LETTERS[letterIndex]}`);
  return SOLF[letterIndex] + ACC[best];
}

const cum = (start, steps) => steps.reduce((acc, s) => { acc.push(acc[acc.length - 1] + s); return acc; }, [start]);

/** درجات المقام صعودًا (8 درجات بالجواب)، كل منها {q, midi, shift, eastern, western}. */
export function degreesOf(maqam, { descending = false } = {}) {
  const m = typeof maqam === 'string' ? (MAQAM_BY_ID[maqam] || SCALE_BY_ID[maqam]) : maqam;
  if (!m) throw new RangeError('مقام غير معروف');
  let qs, letters;
  // التهجئة الصحيحة: كل درجة تأخذ الحرف التالي (دو ري مي…)، فيُكتب فا♯ في الحجاز وصول♭ في الصبا
  const t = keyOfQ(m.tonicQ);
  const tl = westernName(t.midi, { shift: t.shift, accidental: 'flat' });
  const tli = LETTERS.indexOf(tl.letter);
  if (descending && m.desc) {
    const top = m.tonicQ + m.desc.reduce((a, b) => a + b, 0);
    qs = cum(top, m.desc.map((s) => -s));
    letters = qs.map((_, i) => tli + 7 - i);
  } else {
    qs = cum(m.tonicQ, m.steps);
    letters = qs.map((_, i) => tli + i);
    if (descending) { qs = qs.reverse(); letters = letters.reverse(); }
  }
  return qs.map((q, i) => {
    const k = keyOfQ(q);
    const inTable = q >= EASTERN_Q_MIN && q <= EASTERN_Q_MAX;
    return { q, ...k, eastern: inTable ? EASTERN_NAMES[q - EASTERN_Q_MIN] : null, western: spell(q, letters[i] % 7) };
  });
}

/**
 * إزاحات المفاتيح الاثنتي عشرة اللازمة لعزف المقام صعودًا وهبوطًا.
 * يرمي خطأ إن احتاج مفتاح واحد إزاحتين مختلفتين (لا يحدث في مقامات القائمة؛ يتحقق منه الاختبار).
 */
export function shiftsFor(maqam) {
  const shifts = new Array(12).fill(0);
  const set = new Map();
  for (const d of [...degreesOf(maqam), ...degreesOf(maqam, { descending: true })]) {
    const pc = ((d.midi % 12) + 12) % 12;
    if (set.has(pc) && set.get(pc) !== d.shift) throw new Error(`تعارض إزاحة على الدرجة ${pc} في ${maqam.id || maqam}`);
    set.set(pc, d.shift);
    shifts[pc] = d.shift;
  }
  return shifts;
}

/** ضبط الأورج للمقام (يحافظ على قيمة ربع التون و A4). */
export function tuningFor(maqam, { quarterCents = 50, a4 } = {}) {
  return makeTuning({ mode: 'eastern', shifts: shiftsFor(maqam), quarterCents, ...(a4 ? { a4 } : {}) });
}

/** درجات المقام كفئات نغمية (لتلوين المفاتيح): Map(pc → رقم الدرجة 1..7). */
export function degreePcs(maqam) {
  const out = new Map();
  degreesOf(maqam).slice(0, 7).forEach((d, i) => out.set(((d.midi % 12) + 12) % 12, i + 1));
  const mm = typeof maqam === 'string' ? (MAQAM_BY_ID[maqam] || SCALE_BY_ID[maqam]) : maqam;
  if (mm && mm.desc) {
    degreesOf(maqam, { descending: true }).forEach((d) => { const pc = ((d.midi % 12) + 12) % 12; if (!out.has(pc)) out.set(pc, 'desc'); });
  }
  return out;
}
