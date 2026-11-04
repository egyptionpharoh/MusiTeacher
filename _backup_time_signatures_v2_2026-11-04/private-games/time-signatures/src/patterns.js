// =====================================================================
//  أنماط إشارات اليد للموازين البسيطة (2/4، 3/4، 4/4) — نواة نقية بلا رسم ولا صوت (تُختبر في Node).
//
//  المصدر التعليمي (بنك دروس MusiTeacher، أدلة المعلم لمادة الفنون الموسيقية — سلطنة عُمان):
//   • الرباعي: الصف الخامس، درس «الميزان الرباعي»، الإجراء (5) والنموذج (5):
//       «الوحدة الزمنية الأولى… إلى الأسفل، والثانية إلى الجانب الأيسر، والثالثة إلى الجانب الأيمن، والإشارة الرابعة إلى الأعلى»،
//       «باستخدام اليد اليمنى».
//   • الثنائي: الصف السابع، «الرباط الزمني والنقطة الزمنية»، الإجراء (4) والنموذج (5): سهم لأسفل على الوحدة الأولى ولأعلى على الثانية.
//   • الثلاثي: الدرس نفسه، الإجراء (9) والنموذج (10): لأسفل، ثم إلى اليمين، ثم لأعلى.
//  وتشريح الحركة (الإكتوس = لحظة تغيّر الاتجاه التي تُفهم نبضةً، والارتداد بعده بثلث إلى نصف حجم الضربة،
//  والتحضير = ارتداد الضربة السابقة، والضربة الأخيرة كبيرة لأنها تعود إلى نقطة بدء الضربة الأولى) من مراجع تعليم القيادة العامة.
//
//  الإحداثيات «في مستوى المايسترو» ومن وجهة نظره هو: u موجب = يمين المايسترو، v موجب = أعلى.
//  v = 0 مستوى الإكتوس (أرضية النمط)، v ≈ 1 قمة النمط. الاتجاهات (down/left/right/up) من وجهة نظره أيضًا.
// =====================================================================

const norm = (x, y) => { const l = Math.hypot(x, y) || 1; return [x / l, y / l]; };

// لكل نبضة: P موضع الإكتوس، A اتجاه الوصول إليه، B اتجاه الارتداد منه، ap/rb طول مقبضي منحنى بيزييه (حجم الوصول/الارتداد)
export const METERS = {
  2: {
    n: 2, sig: '2/4', name: 'الميزان الثنائي', short: 'الثنائي',
    accents: ['strong', 'weak'],
    dirs: ['down', 'up'],
    beats: [
      { P: [0, 0], A: [0, -1], ap: 1.1, B: norm(0.55, 1), rb: 0.55 },
      { P: [0.42, 0.34], A: norm(-0.35, -1), ap: 0.22, B: norm(-0.3, 1), rb: 0.7 },
    ],
    source: { grade: 'الصف السابع', lesson: 'الرِّباط الزمني والنقطة الزمنية', proc: 'الإجراء (4)', model: 'النموذج (5)',
      text: 'ويطلب إليهم مصاحبته بأداء إشارات اليد الدالة على الميزان الثنائي', note: 'في النموذج سهم أحمر إلى الأسفل على الوحدة الأولى، وسهم أزرق إلى الأعلى على الثانية.' },
  },
  3: {
    n: 3, sig: '3/4', name: 'الميزان الثلاثي', short: 'الثلاثي',
    accents: ['strong', 'weak', 'weak'],
    dirs: ['down', 'right', 'up'],
    beats: [
      { P: [0, 0], A: [0, -1], ap: 1.1, B: norm(0.1, 1), rb: 0.55 },
      { P: [0.86, 0.16], A: norm(1, -0.3), ap: 0.5, B: norm(0.2, 1), rb: 0.4 },
      { P: [0.32, 0.44], A: norm(-0.9, -0.45), ap: 0.28, B: norm(-0.15, 1), rb: 0.7 },
    ],
    source: { grade: 'الصف السابع', lesson: 'الرِّباط الزمني والنقطة الزمنية', proc: 'الإجراء (9)', model: 'النموذج (10)',
      text: 'غناءه صولفائيًا مع أداء إشارات اليد الدالة على الميزان الثلاثي', note: 'في النموذج سهم أحمر إلى الأسفل، ثم أخضر إلى اليمين، ثم بنفسجي منحنٍ إلى الأعلى.' },
  },
  4: {
    n: 4, sig: '4/4', name: 'الميزان الرباعي', short: 'الرباعي',
    accents: ['strong', 'weak', 'medium', 'weak'],
    dirs: ['down', 'left', 'right', 'up'],
    beats: [
      { P: [0, 0], A: [0, -1], ap: 1.1, B: norm(0.15, 1), rb: 0.55 },
      { P: [-0.72, 0.2], A: norm(-1, -0.45), ap: 0.35, B: norm(0.35, 1), rb: 0.18 },
      { P: [0.86, 0.18], A: norm(1, -0.35), ap: 0.45, B: norm(0.2, 1), rb: 0.4 },
      { P: [0.32, 0.44], A: norm(-0.9, -0.45), ap: 0.28, B: norm(-0.15, 1), rb: 0.7 },
    ],
    source: { grade: 'الصف الخامس', lesson: 'الميزان الرباعي', proc: 'الإجراء (5)', model: 'النموذج (5)',
      text: 'أداء إشارات الميزان الرباعي باستخدام اليد اليمنى، وأن الوحدة الزمنية الأولى يعبر عنها بالإشارة إلى الأسفل، والثانية إلى الجانب الأيسر، والثالثة إلى الجانب الأيمن، والإشارة الرابعة إلى الأعلى',
      note: 'النموذج (5) يرسم الأسهم الأربعة مرقمة: 1 أسفل، 2 يسار، 3 يمين، 4 أعلى.' },
  },
};

export const DIR_AR = { down: 'إلى الأسفل', up: 'إلى الأعلى', left: 'إلى اليسار', right: 'إلى اليمين' };
export const DIR_ARROW = { down: '⬇', up: '⬆', left: '⬅', right: '➡' };
export const ACCENT_AR = { strong: 'قوي', weak: 'ضعيف', medium: 'متوسط' };
export const BEAT_ORD = ['الأولى', 'الثانية', 'الثالثة', 'الرابعة'];

// ---------- منحنى بيزييه مكعب ----------
const bez = (p0, c1, c2, p3, t) => {
  const s = 1 - t, a = s * s * s, b = 3 * s * s * t, c = 3 * s * t * t, d = t * t * t;
  return [a * p0[0] + b * c1[0] + c * c2[0] + d * p3[0], a * p0[1] + b * c1[1] + c * c2[1] + d * p3[1]];
};
const bezD = (p0, c1, c2, p3, t) => {
  const s = 1 - t;
  return [3 * s * s * (c1[0] - p0[0]) + 6 * s * t * (c2[0] - c1[0]) + 3 * t * t * (p3[0] - c2[0]),
          3 * s * s * (c1[1] - p0[1]) + 6 * s * t * (c2[1] - c1[1]) + 3 * t * t * (p3[1] - c2[1])];
};

/** المقطع من الإكتوس i إلى الإكتوس i+1 (يلتف إلى الأولى بعد الأخيرة)؛ beatsOverride لتجربة «اكتشف الخطأ» */
export function segment(meter, i, beatsOverride) {
  const bs = beatsOverride || METERS[meter].beats, n = bs.length;
  const a = bs[((i % n) + n) % n], b = bs[(((i + 1) % n) + n) % n];
  const c1 = [a.P[0] + a.B[0] * a.rb, a.P[1] + a.B[1] * a.rb];
  const c2 = [b.P[0] - b.A[0] * b.ap, b.P[1] - b.A[1] * b.ap];
  return [a.P, c1, c2, b.P];
}

/**
 * موضع اليد (u,v) عند موضع زمني بالنبضات: pos = 0 لحظة النبضة الأولى (إكتوس 1)، 1 الثانية… ويستمر.
 * القيم السالبة (−1..0) = ضربة التحضير: ارتداد الضربة الأخيرة نحو الأولى.
 * داخل النبضة يُستخدم تشويه زمني خفيف: تباطؤ عند قمة الارتداد وتسارع نحو الإكتوس (الإحساس بالنبضة).
 */
export function handAt(meter, pos, beatsOverride) {
  const n = (beatsOverride || METERS[meter].beats).length;
  const k = Math.floor(pos), s = pos - k;
  const seg = segment(meter, ((k % n) + n) % n, beatsOverride);
  const t = warp(s);
  const p = bez(...seg, t), d = bezD(...seg, t);
  return { u: p[0], v: p[1], du: d[0], dv: d[1], beat: ((k % n) + n) % n, frac: s };
}

// تسارع نحو الإكتوس: الزمن داخل النبضة يمر أبطأ قليلًا في منتصفها (قمة الارتداد) — دالة رتيبة تحفظ 0 و1
export const WARP_K = 0.16;
export function warp(s) { return s + WARP_K * Math.sin(2 * Math.PI * s) / (2 * Math.PI); }

/** عيّنات مسار دورة كاملة (للرسم): نقاط (u,v) */
export function pathSamples(meter, perBeat = 40, beatsOverride) {
  const n = (beatsOverride || METERS[meter].beats).length, out = [];
  for (let i = 0; i < n * perBeat; i++) { const h = handAt(meter, i / perBeat, beatsOverride); out.push([h.u, h.v]); }
  return out;
}

/** اتجاه الحركة الإجمالي للنبضة (من وجهة نظر المايسترو) كما يقيسه المسار الفعلي: من الإكتوس السابق حتى هذا الإكتوس،
 *  مع قمة المسار بينهما. يُستخدم في الاختبار للتحقق أن المسار المرسوم يطابق أسهم الدليل. */
export function measuredDir(meter, i, beatsOverride) {
  const bs = beatsOverride || METERS[meter].beats, n = bs.length;
  const P = bs[i].P, Pprev = bs[(i - 1 + n) % n].P;
  let top = -1e9;
  for (let k = 0; k <= 100; k++) top = Math.max(top, handAt(meter, (i - 1) + k / 100, beatsOverride).v);
  if (i === 0) return top > 0.75 && bs[0].A[1] < -0.9 ? 'down' : '?';                           // الأولى: هبوط من قمة النمط
  const dx = P[0] - Pprev[0], dy = P[1] - Pprev[1];
  if (i === n - 1) {                                                                            // الأخيرة: صعود ثم ارتداد كبير إلى القمة
    let nextTop = -1e9; for (let k = 0; k <= 100; k++) nextTop = Math.max(nextTop, handAt(meter, i + k / 100, beatsOverride).v);
    return dy > 0.15 && nextTop > 0.75 ? 'up' : (dx > 0 ? 'right' : 'left');
  }
  return Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'up' : 'down');
}

/** نسخة خاطئة عمدًا من النمط (لتمرين «اكتشف الخطأ» فقط): تبديل اتجاهي نبضتين أفقيتين أو عكس اتجاه نبضة */
export function wrongVariant(meter, rand = Math.random) {
  const src = METERS[meter].beats.map((b) => ({ ...b, P: [...b.P], A: [...b.A], B: [...b.B] }));
  const n = src.length;
  const opts = [];
  if (n === 4) opts.push('swap23');
  if (n === 3) opts.push('flip2');
  if (n === 2) opts.push('flip2side');
  const kind = opts[Math.floor(rand() * opts.length)];
  let wrongBeat = 1, dirs = [...METERS[meter].dirs];
  if (kind === 'swap23') {                                   // 2 إلى اليمين و3 إلى اليسار (خطأ شائع)
    const b2 = src[1], b3 = src[2];
    b2.P = [0.8, 0.17]; b2.A = norm(1, -0.34); b2.ap = 0.36;
    b3.P = [-0.78, 0.16]; b3.A = norm(-1, -0.3); b3.ap = 0.62;
    b3.B = norm(0.5, 1);
    wrongBeat = 1; dirs = ['down', 'right', 'left', 'up'];
  } else if (kind === 'flip2') {                             // الثلاثي: الثانية إلى اليسار بدل اليمين
    const b2 = src[1]; b2.P = [-0.82, 0.14]; b2.A = norm(-1, -0.32); b2.B = norm(0.4, 1);
    wrongBeat = 1; dirs[1] = 'left';
  } else {                                                   // الثنائي: الثانية إلى اليسار بدل الأعلى
    const b2 = src[1]; b2.P = [-0.72, 0.04]; b2.A = norm(-1, -0.35); b2.ap = 0.45; b2.B = norm(0.35, 1); b2.rb = 1.0;
    wrongBeat = 1; dirs[1] = 'left';
  }
  return { beats: src, wrongBeat, dirs, kind };
}

/** مدة النبضة بالثواني لسرعة bpm ومعامل البطء (0.5 = نصف السرعة: الحركة نفسها بزمن مضاعف) */
export const beatDur = (bpm, slow = 1) => 60 / (bpm * slow);

export const PATTERN_API = { METERS, DIR_AR, DIR_ARROW, ACCENT_AR, BEAT_ORD, segment, handAt, warp, pathSamples, measuredDir, wrongVariant, beatDur };
