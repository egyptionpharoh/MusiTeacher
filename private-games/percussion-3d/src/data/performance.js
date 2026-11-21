// =====================================================================
//  إعدادات الأداء لكل آلة على حدة — المصدر الوحيد لموضع كل ضربة (ومنه: حركة اليد، ونقطة التموّج، والعلامة المؤقتة).
//  لكل ضربة: اليد، والموضع (rho نسبة من نصف القطر، ang زاوية حول المحور: 0 = جهة العازف، موجبة = يمين العازف)،
//  والجزء الملامس، وهيئة الأصابع، ومدة الهبوط والارتداد، والصوت المستخدم، ودرجة التوثيق.
//  verified: 'source' مأخوذ من نص الدرس/دليل المعلم · 'common' ممارسة شائعة موثّقة لهذه العائلة من الآلات · 'assumed' تقريب تعليمي يحتاج مراجعة موسيقية.
// =====================================================================

/** هيئات اليد (زوايا الثني بالراديان لكل سُلامية: [قاعدية، وسطى، طرفية]؛ موجب = نحو باطن الكف) */
export const SHAPES = {
  // الأصابع الأربعة مضمومة ممدودة والكف مبسوطة: الملامسة بباطن الأصابع من المفاصل حتى الأطراف
  flat: { contact: ['index', 'middle', 'ring', 'little'], pads: true, spread: 1,
    fingers: { index: [0.06, 0.05, 0.03], middle: [0.06, 0.05, 0.03], ring: [0.07, 0.05, 0.03], little: [0.09, 0.06, 0.03], thumb: [0.15, 0.1, 0.05] } },
  // أطراف الأصبعين الوسطى والبنصر، والسبابة والخنصر منثنيتان قليلًا
  tips: { contact: ['middle', 'ring'], pads: false, spread: 0.6,
    fingers: { index: [0.55, 0.6, 0.3], middle: [0.28, 0.32, 0.12], ring: [0.3, 0.32, 0.12], little: [0.75, 0.8, 0.4], thumb: [0.2, 0.2, 0.1] } },
  // الأصابع مفتوحة متباعدة (التك في الكاسر والرحماني: «الدُّم بضمّ أصابع اليد، والتك بفتحها»)
  open: { contact: ['index', 'middle', 'ring', 'little'], pads: true, spread: -1.4,
    fingers: { index: [0.06, 0.05, 0.03], middle: [0.06, 0.05, 0.03], ring: [0.06, 0.05, 0.03], little: [0.08, 0.05, 0.03], thumb: [0.05, 0.05, 0.02] } },
  // اليد اليسرى الحاملة للإطار: البنصر والخنصر ينقران قرب الحافة، والسبابة والوسطى مسترخيتان
  ka: { contact: ['ring', 'little'], pads: false, spread: 0.3,
    fingers: { index: [0.55, 0.5, 0.25], middle: [0.5, 0.45, 0.22], ring: [0.3, 0.3, 0.12], little: [0.32, 0.3, 0.12], thumb: [0.1, 0.1, 0.05] },
    lifted: { ring: [-0.25, 0.05, 0.02], little: [-0.25, 0.05, 0.02] } },
};

/** مواصفات حركة الضربة: hold = ارتفاع الرفع (م)، wrist = رفع الكف عند المعصم في وضع الاستعداد، down/reb بالثواني */
const MOTION = {
  dum: { down: 0.085, reb: 0.13, lift: 0.045, wrist: 0.45, liftW: 0.03 },
  tak: { down: 0.07, reb: 0.1, lift: 0.028, wrist: 0.5, liftW: 0.018 },
  ka: { down: 0.06, reb: 0.09, lift: 0, wrist: 0, liftW: 0, fingersOnly: true },
};

/** وصف عربي ثابت لعناصر الأداء (يُعرض في تبويب الضربات) */
export const HAND_AR = { R: 'اليد اليمنى', L: 'اليد اليسرى' };
export const SHAPE_AR = {
  flat: 'الأصابع مضمومة ممدودة والكف مبسوطة؛ تلامس الجلدَ بباطن الأصابع من المفاصل حتى الأطراف',
  tips: 'بأطراف الأصابع (الوسطى والبنصر) في ضربة خفيفة سريعة',
  open: 'بأصابع مفتوحة متباعدة',
  ka: 'بالبنصر والخنصر من اليد التي تحمل الآلة',
};

/**
 * strokes: dum/tak لكل آلة، و ka (تك اليد اليسرى) حيث تُعرف.
 * sound: عينة الصوت المستخدمة (الكا تستخدم عينة التك بشدة أخفّ لعدم توفر تسجيل مستقل).
 */
export const PERFORMANCE = {
  riq: {
    // الرق في المشهد موضوع أفقيًا أمام العازف (لتسهيل الرؤية)، واليسرى تمسك الإطار من جهة اليسار
    yawR: -0.5, yawL: 0.55, pitch: -0.12,
    // آلة خفيفة: تُرفع عن الأرض وتميل نحو العازف، واليسرى تمسك الإطار عند عمود خشبي بين فتحتي صنوج
    present: { lift: 0.12, tilt: 0.3 }, support: { kind: 'grip', ang: -0.63, rho: 0.9, thumb: 'wall' },
    strokes: {
      dum: { hand: 'R', rho: 0.08, ang: 0.6, shape: 'flat', where: 'وسط الرق', verified: 'source', ...MOTION.dum },
      tak: { hand: 'R', rho: 0.86, ang: 1.15, shape: 'tips', where: 'الحافة الخارجية قرب الإطار الخشبي', verified: 'source', jingles: true, ...MOTION.tak },
      ka: { hand: 'L', rho: 0.84, ang: -1.45, shape: 'ka', where: 'قرب الحافة من جهة اليد الحاملة', verified: 'common', sound: 'tak', gain: 0.8, ...MOTION.ka },
    },
  },
  tabla: {
    yawR: -0.55, yawL: 0.6, pitch: -0.15,
    // آلة ثقيلة تبقى على الأرض: اليسرى مستندة على الحافة (ومنها تنقر الكا)
    support: { kind: 'rim', ang: -1.35, rho: 0.9 },
    strokes: {
      dum: { hand: 'R', rho: 0.12, ang: 0.5, shape: 'flat', where: 'وسط الغشاء', verified: 'source', ...MOTION.dum },
      tak: { hand: 'R', rho: 0.9, ang: 1.2, shape: 'tips', where: 'حافة الطبلة', verified: 'source', ...MOTION.tak },
      ka: { hand: 'L', rho: 0.88, ang: -1.4, shape: 'ka', where: 'حافة الطبلة من جهة اليد اليسرى', verified: 'common', sound: 'tak', gain: 0.8, ...MOTION.ka },
    },
  },
  mizhar: {
    // الدرس: «تُنقر الدُم على الحافة، والتك في الوسط — عكس الدف والطبلة». نلتزم بنص الدرس، ونُحيل التعارض مع مراجع الدفوف الإطارية العامة إلى المراجعة.
    yawR: -0.45, yawL: 0.5, pitch: -0.1,
    // آلة خفيفة: اليسرى تمسك الإطار والإبهام في «فتحة الإبهام» (FRAME_HOLD_ANG في builders.js)
    present: { lift: 0.12, tilt: 0.3 }, support: { kind: 'grip', ang: -0.7, rho: 0.93, thumb: 'hole' },
    strokes: {
      dum: { hand: 'R', rho: 0.8, ang: 0.9, shape: 'flat', where: 'على الحافة', verified: 'source', review: true, ...MOTION.dum },
      tak: { hand: 'R', rho: 0.1, ang: 0.4, shape: 'tips', where: 'في الوسط', verified: 'source', review: true, ...MOTION.tak },
    },
  },
  kasir: {
    support: { kind: 'side', ang: -1.3, drop: 0.11 },   // طبل طويل على الأرض: كفّ اليسرى مسنودة على جانبه تثبّته
    // الدليل: «الدُّم تُؤدّى بضمّ أصابع اليد، والتك بفتحها». مكانا الضربتين غير محدّدين في الدرس.
    yawR: -0.5, yawL: 0.5, pitch: -0.12,
    strokes: {
      dum: { hand: 'R', rho: 0.15, ang: 0.5, shape: 'flat', where: 'وسط الجلد (تقريب)', verified: 'assumed', ...MOTION.dum },
      tak: { hand: 'R', rho: 0.75, ang: 1.0, shape: 'open', where: 'قرب الحافة (تقريب)', verified: 'assumed', ...MOTION.tak, down: 0.075, reb: 0.11 },
    },
  },
  rahmani: {
    support: { kind: 'side', ang: -1.3, drop: 0.13 },
    yawR: -0.5, yawL: 0.5, pitch: -0.12,
    strokes: {
      dum: { hand: 'R', rho: 0.15, ang: 0.4, shape: 'flat', where: 'وسط الجلد (تقريب)', verified: 'assumed', ...MOTION.dum, down: 0.095, reb: 0.15, lift: 0.055 },
      tak: { hand: 'R', rho: 0.72, ang: 0.95, shape: 'open', where: 'قرب الحافة (تقريب)', verified: 'assumed', ...MOTION.tak, down: 0.08, reb: 0.12 },
    },
  },
};

/** وظيفة اليد الأخرى (تُعرض في تبويب الضربات) */
export const SUPPORT_AR = {
  grip: 'تمسك الإطار: الإبهام على جدار الإطار الخارجي والأصابع ملتفّة فوق الحافة؛ تثبّت الآلة وتمتص ارتداد الضربات',
  hole: 'تمسك الإطار والإبهام داخل «فتحة الإبهام»، والأصابع ملتفّة فوق الحافة',
  rim: 'مستندة على حافة الطبلة تثبّتها، والبنصر والخنصر جاهزان لنقر «الكا»',
  side: 'كفّها مسنودة على جانب الطبل تثبّته وتمنع ميله، دون أن تحمل وزنه',
};

export const VERIFIED_AR = { source: 'من نص الدرس', common: 'ممارسة شائعة في هذه الآلة', assumed: 'تقريب تعليمي — يحتاج مراجعة' };
export const STROKE_KEYS = ['dum', 'tak', 'ka'];
export const perfOf = (inst) => PERFORMANCE[inst.id];
/** نقطة الضربة على الجلد في إحداثيات الآلة */
export function anchorOf(inst, stroke, R) { const s = PERFORMANCE[inst.id].strokes[stroke]; const r = s.rho * R; return { x: r * Math.sin(s.ang), z: r * Math.cos(s.ang) }; }
/** عينة الصوت لضربة (الكا تعزف عينة التك) */
export const soundOf = (inst, stroke) => (PERFORMANCE[inst.id].strokes[stroke] || {}).sound || stroke;
