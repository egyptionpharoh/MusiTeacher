// خريطة التنقل في «أدوات المعلم» — مسارات صريحة بلا اعتماد على سجل المتصفح (router.back).
// الرئيسية ← أدوات المعلم ← الأداة.  منفصلة عن الواجهة لتُختبر وحدها.
export const HOME_PATH = '/';
export const TOOLS_PATH = '/dashboard/tools';

// الأدوات العشر التي يظهر فيها شريط التنقل الموحد (بقية المسارات تحت /dashboard/tools لا تتأثر)
export const TOOL_TITLES = {
  'music-factory': 'مصنع الألحان',
  'interactive-book': 'الكتاب التفاعلي الذكي',
  covers: 'بنك أغلفة السجلات',
  'audio-separator': 'استوديو فصل الصوت',
  workshops: 'مشاغل الإنماء المهني',
  plans: 'الخطط الفصلية',
  anthem: 'نوتات النشيد والمارشات',
  initiatives: 'مبادرات تعليمية',
  'class-alarm': 'منبّه الحصص الذكي',
  'committee-advisor': 'مستشار اللجان والامتحانات',
};

/**
 * يعيد وصف موقع الصفحة في هيكل المنصة، أو null إن لم تكن من الصفحات المشمولة.
 * { kind: 'tools' } لصفحة الأدوات نفسها، و { kind: 'tool', slug, title, up } لأداة فرعية.
 */
export function navFor(pathname) {
  if (typeof pathname !== 'string') return null;
  const p = pathname.split(/[?#]/)[0].replace(/\/+$/, '') || '/';
  if (p === TOOLS_PATH) return { kind: 'tools', title: 'أدوات المعلم', up: { href: HOME_PATH, label: 'العودة للرئيسية' } };
  if (!p.startsWith(TOOLS_PATH + '/')) return null;
  const slug = p.slice(TOOLS_PATH.length + 1).split('/')[0];
  if (!Object.prototype.hasOwnProperty.call(TOOL_TITLES, slug)) return null;
  return { kind: 'tool', slug, title: TOOL_TITLES[slug], up: { href: TOOLS_PATH, label: 'الأدوات' } };
}
