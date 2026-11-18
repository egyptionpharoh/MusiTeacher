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
export function melody(list) {
  const out = [];
  for (const tok of list.trim().split(/\s+/)) {
    if (tok === '|') continue;
    const [n, b] = tok.split(':'), beats = b ? +b : 1;
    if (n === 'R') { out.push([-1, 0, beats]); continue; }
    const nt = parseNote(n);
    let s = -1; for (let k = 3; k >= 0; k--) if (nt.midi >= OPEN_MIDI[k] - 1e-9) { s = k; break; }
    const semi = nt.midi - (s >= 0 ? OPEN_MIDI[s] : 0);
    if (s < 0 || semi > 7 + 1e-9) throw new Error(`النغمة ${n} خارج مدى الكمان في الوضع الأول (صول3 ← سي5)`);
    const f = semi === 0 ? 0 : semi <= 2.5 ? 1 : semi <= 4.5 ? 2 : semi <= 6 ? 3 : 4;
    const pat = FINGER_SEMITONES.slice(1);
    if (f) { pat[f - 1] = semi; for (let q = f - 2; q >= 0; q--) pat[q] = Math.min(pat[q], pat[q + 1] - 1); for (let q = f; q < 4; q++) pat[q] = Math.max(pat[q], pat[q - 1] + 1); }
    out.push([s, f, beats, pat, { en: nt.en, ar: nt.ar }]);
  }
  return out;
}
// المقطوعات المعتمدة من نوتات المعلم تُضاف هنا (لا توجد بعدُ مقطوعات خاصة بالكمان)
export const PIECES = [];

export const EXERCISES = [
  ...scaleExercises(),
  { id: 'scale', group: 'other', title: 'الأصابع ١-٢-٣ على وتر لا', bpm: 60, notes: [[A, 0, 1], [A, 1, 1], [A, 2, 1], [A, 3, 1], [A, 2, 1], [A, 1, 1], [A, 0, 2]] },
  { id: 'open', group: 'other', title: 'القوس على الأوتار المفتوحة (لا ← مي)', bpm: 60, notes: [[A, 0, 2], [E, 0, 2], [A, 0, 2], [E, 0, 2]] },
  { id: 'twinkle', group: 'other', title: 'لحن «يا نجمة صغيرة» (لحن تقليدي) — لا ومي', bpm: 84, notes: TWINKLE },
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
