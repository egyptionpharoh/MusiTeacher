// تصنيف ألعاب MusiTeacher حسب الأجهزة الموصى بها — مصدر واحد تستعمله المنصة الأساسية و MusiTeacher Games.
// كل قيمة مبنية على اختبار فعلي للعبة (هاتف رأسي/أفقي، جهاز لوحي، حاسوب): تجاوز العرض، أزرار صغيرة على الإصبع،
// أزرار مقصوصة، ومساحة المجسم/لوحة الرسم، مع مراجعة لقطات الشاشة.
//   desktop : الأفضل على الحاسوب والشاشات الكبيرة (Desktop Recommended) — يظهر تنبيه على الهاتف واللوحي
//   tablet  : تعمل جيدًا على الأجهزة اللوحية (Tablet Supported)       — يظهر تنبيه على الهاتف فقط
//   mobile  : تدعم الهاتف بالكامل (Mobile Supported)                  — لا تنبيه
// لعبة جديدة بلا تصنيف ← يظهر تنبيه الهاتف احتياطيًا، ويُذكر ذلك في تقرير النسخ حتى تُختبر وتُصنَّف.
// القياس: 2026-11-20 (390×844 و 844×390 و 820×1180 بلمس) — التفاصيل في تقرير المعلم.
export const GAME_DEVICES = {
  // الأفضل على الحاسوب: لوحات تحكم كثيفة أو مفاتيح كثيرة صغيرة حتى على اللوحي
  'violinist-3d': 'desktop',
  'virtual-qanun': 'desktop',
  'oriental-organ-piano': 'desktop',
  // حاسوب أو جهاز لوحي: تعمل جيدًا على اللوحي، وعلى الهاتف تزدحم الأزرار أو تصغر مساحة الآلة
  'accordion-3d': 'tablet',
  'organ-3d': 'tablet',
  'oudist-3d': 'tablet',
  'virtual-violin': 'tablet',
  'virtual-oud': 'tablet',
  'percussion-3d': 'tablet',
  'time-signatures': 'tablet',
  'guitar-3d': 'tablet',          // لم يُحمَّل مجسمها في بيئة الاختبار (مكتبة خارجية)؛ تصنيف حذر حتى تُختبر بعد النشر
  // تعمل على الهاتف أيضًا: تصميم متجاوب فعلي، بلا أزرار مقصوصة، وأزرار مناسبة للإصبع
  'oud-3d': 'mobile',
  'qanun-3d': 'mobile',
  'band-3d': 'mobile',
  'omani-rhythms': 'mobile',
  'melodic-dictation': 'mobile',
  'rhythm-dictation': 'mobile',
  'rhythm-world-3d': 'mobile',
  'piano-scales': 'mobile',
  'violin-scales': 'mobile',
  'accordion-scales': 'mobile',
  'xylophone': 'mobile',
  'oud-maqamat': 'mobile',
};
