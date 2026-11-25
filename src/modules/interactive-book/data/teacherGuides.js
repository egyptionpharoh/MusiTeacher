// 📚 روابط «أدلة المعلم الرقمية» لكل صف — المصدر الوحيد لهذه الروابط في المنصة.
// لتحديث رابط أي صف: غيّر قيمة url في سطره هنا فقط، ولا شيء آخر.
//
// مهم: MusiTeacher لا يستضيف هذه الأدلة ولا ينسخها؛ الزر يفتح الصفحة الخارجية كما هي في تبويب جديد.
// بعض الصفحات وسيطة (صفحة تحميل، إعلانات، أو تحويل إلى Google Drive)، فلا نعد بأنها تعرض ملف PDF مباشرة.
//
// check: نتيجة آخر فحص للرابط (من خارج المتصفح، بتاريخ checkedOn):
//   'ok'          الصفحة تفتح وتعرض دليل هذا الصف مع رابط عرض/تحميل
//   'unverified'  لم نتمكن من قراءة الصفحة آليًا (قد يحجب الموقع أدوات الفحص) — لا يعني أن الرابط معطّل
//   'broken'      الرابط معطّل → يُخفى زر الفتح لهذا الصف حتى يُحدَّث الرابط

export const GUIDES_CHECKED_ON = '2026-11-25';

export const TEACHER_GUIDES = [
  { grade: 1, label: 'الصف الأول', site: 'منصة أفدني (om.afedne.com)', check: 'ok',
    url: 'https://om.afedne.com/library/file/220/دليل_المعلم_الفنون_الموسيقية_الصف_الأول_الأساسي_منهج_سلطنة_عمان',
    hint: 'صفحة الدليل على المنصة، ومنها رابط العرض على Google Drive.' },
  { grade: 2, label: 'الصف الثاني', site: 'أفدني (afidni.com)', check: 'ok',
    url: 'https://afidni.com/تحميل-دليل-المعلم-الفنون-الموسيقية-صف/',
    hint: 'صفحة تحميل وسيطة، ومنها رابط الملف على Google Drive.' },
  { grade: 3, label: 'الصف الثالث', site: 'أفدني (afidni.com)', check: 'unverified',
    url: 'https://afidni.com/ملف-دليل-معلم-الفنون-الموسيقية-pdf-صف-ثالث/',
    hint: 'صفحة تحميل وسيطة.' },
  { grade: 4, label: 'الصف الرابع', site: 'أفدني (afidni.com)', check: 'unverified',
    url: 'https://afidni.com/ملف-دليل-معلم-الفنون-الموسيقية-pdf-صف-رابع/',
    hint: 'صفحة تحميل وسيطة.' },
  { grade: 5, label: 'الصف الخامس', site: 'منصة أفدني (om.afedne.com)', check: 'ok',
    url: 'https://om.afedne.com/library/file/153/دليل_المعلم_للمهارات_الموسيقية_للصف_الخامس_منهج_عمان',
    hint: 'صفحة الدليل على المنصة، ومنها رابط العرض على Google Drive.' },
  { grade: 6, label: 'الصف السادس', site: 'أفدني (afidni.com)', check: 'ok',
    url: 'https://afidni.com/دليل-معلم-فنون-موسيقية-صف-سادس-فصل-ثاني/',
    hint: 'صفحة تحميل وسيطة، ومنها رابط الملف على Google Drive.' },
  { grade: 7, label: 'الصف السابع', site: 'أفدني (afidni.com)', check: 'ok',
    url: 'https://afidni.com/نسخة-دليل-المعلم-الفنون-الموسيقية/',
    hint: 'صفحة تحميل وسيطة، ومنها رابط الملف على Google Drive.' },
  { grade: 8, label: 'الصف الثامن', site: 'منصة أفدني (om.afedne.com)', check: 'ok',
    url: 'https://om.afedne.com/library/file/434/دليل_المعلم_في_المهارات_الموسيقية_الصف_الثامن_عمان_2025-2026',
    hint: 'صفحة الدليل على المنصة، ومنها رابط العرض على Google Drive.' },
  { grade: 9, label: 'الصف التاسع', site: 'أفدني (afidni.com)', check: 'ok',
    url: 'https://afidni.com/دليل-المعلم-المهارات-الموسيقية-pdf/',
    hint: 'صفحة تحميل وسيطة، ومنها رابط الملف على Google Drive.' },
  { grade: 10, label: 'الصف العاشر', site: 'كتب المناهج العمانية (omanedubooks.com)', check: 'unverified',
    // صفحة تحويل: معامل url يبدأ بشرطة سفلية ثم رابط Google Drive — نُبقيه كما زُوّدنا به حرفيًا
    url: 'https://www.omanedubooks.com/p/redirect_17.html?&&url=_https://drive.google.com/file/d/1WDrGUeQwD0SJjXAzEyOUPYIdTa8_xtnu/view?usp=sharing',
    hint: 'صفحة تحويل تنقلك إلى الملف على Google Drive.' },
  { grade: 11, label: 'الصف الحادي عشر', site: 'وزارة التربية والتعليم (ict.moe.gov.om)', check: 'ok',
    url: 'https://ict.moe.gov.om/book/PDF/11/karas%20nshat%20music_Classical/index.html',
    hint: 'كتاب تفاعلي على موقع الوزارة بعنوان «المهارات الموسيقية للصف 11».' },
  { grade: 12, label: 'الصف الثاني عشر', site: 'منصة Edu-Oman (edu-oman.com)', check: 'ok',
    url: 'https://edu-oman.com/library/file/1783/دليل_المعلم_الصف_الثاني_عشر_في_المهارات_الموسيقية',
    hint: 'صفحة الدليل على المنصة، ومنها روابط Google Drive.' },
];

/** أسماء الصفوف من الأول إلى الثاني عشر (تُستخدم أيضًا في رفع الدليل الشخصي) */
export const GRADE_OPTIONS = TEACHER_GUIDES.map(({ grade, label }) => ({ grade, label }));
export const gradeLabel = (g) => (GRADE_OPTIONS.find((o) => o.grade === Number(g)) || {}).label || '';

/**
 * رابط آمن للفتح: http/https فقط، مع ترميز الأحرف العربية دون إفساد ما هو مرمَّز أصلًا (مثل %20).
 * يعيد null إن كان الرابط فارغًا أو غير صالح.
 */
export function safeHref(raw) {
  if (!raw || typeof raw !== 'string') return null;
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    return u.href;
  } catch { return null; }
}

/** دليل صف معيّن جاهز للعرض، أو null إن لم يوجد رابط صالح (فيُخفى زر الفتح) */
export function guideFor(grade) {
  const g = TEACHER_GUIDES.find((x) => x.grade === Number(grade));
  if (!g || g.check === 'broken') return null;
  const href = safeHref(g.url);
  return href ? { ...g, href } : null;
}
