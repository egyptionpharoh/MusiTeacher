// تصنيفات مشاغل الإنماء المهني — تُضاف التصنيفات الجديدة هنا دون تعديل الواجهة.

export const DOMAINS = [
  { id: 'ai', label: 'الذكاء الاصطناعي في التعليم', icon: 'spark', color: '#6D28D9' },
  { id: 'strategies', label: 'استراتيجيات التدريس الحديثة', icon: 'compass', color: '#1D4ED8' },
  { id: 'active', label: 'التعلم النشط والتعاوني', icon: 'people', color: '#0E7490' },
  { id: 'classroom', label: 'إدارة الصف والفروق الفردية', icon: 'grid', color: '#047857' },
  { id: 'assessment', label: 'التقويم من أجل التعلم', icon: 'check', color: '#B45309' },
  { id: 'planning', label: 'التخطيط وتصميم الأنشطة', icon: 'map', color: '#BE185D' },
  { id: 'questions', label: 'الأسئلة ومستويات التفكير', icon: 'question', color: '#9A3412' },
  { id: 'digital', label: 'التقنية والموارد الرقمية', icon: 'screen', color: '#0369A1' },
  { id: 'thinking', label: 'التفكير والإبداع', icon: 'bulb', color: '#A16207' },
  { id: 'motivation', label: 'الدافعية والانضباط الإيجابي', icon: 'heart', color: '#BE123C' },
  { id: 'community', label: 'مجتمعات التعلم وتبادل الخبرات', icon: 'chat', color: '#0F766E' },
  { id: 'arts', label: 'الفنون والموسيقى في التدريس', icon: 'music', color: '#86198F' },
  { id: 'inclusion', label: 'الدمج وتنوع المتعلمين', icon: 'hand', color: '#4338CA' },
  { id: 'wellbeing', label: 'رفاه المعلم وإدارة الوقت', icon: 'leaf', color: '#15803D' },
];

export const SPECS = [
  { id: 'all', label: 'جميع التخصصات' },
  { id: 'music', label: 'المهارات الموسيقية' },
  { id: 'arts', label: 'الفنون التشكيلية' },
  { id: 'languages', label: 'اللغات' },
  { id: 'stem', label: 'العلوم والرياضيات' },
  { id: 'humanities', label: 'الدراسات الاجتماعية والإنسانيات' },
  { id: 'pe', label: 'الرياضة المدرسية' },
  { id: 'it', label: 'تقنية المعلومات' },
];

export const AUDIENCES = [
  { id: 'all', label: 'جميع المعلمين' },
  { id: 'c1', label: 'معلمو الحلقة الأولى (1-4)' },
  { id: 'c2', label: 'معلمو الحلقة الثانية (5-10)' },
  { id: 'post', label: 'معلمو ما بعد الأساسي (11-12)' },
  { id: 'new', label: 'المعلمون الجدد' },
  { id: 'lead', label: 'المعلمون الأوائل وقادة الفرق' },
];

export const DURATION_BANDS = [
  { id: 'short', label: 'مشغل قصير (15-20 دقيقة)', min: 0, max: 25 },
  { id: 'medium', label: 'مشغل متوسط (30-45 دقيقة)', min: 26, max: 50 },
  { id: 'long', label: 'برنامج أطول (60 دقيقة فأكثر)', min: 51, max: 999 },
];
export const DURATIONS = [15, 20, 30, 45, 60, 90];

export const FORMATS = [
  { id: 'theory', label: 'معرفي' },
  { id: 'applied', label: 'تطبيقي' },
  { id: 'workshop', label: 'ورشة عمل' },
  { id: 'exchange', label: 'تبادل خبرات' },
  { id: 'showcase', label: 'عرض تجربة ناجحة' },
];

export const LEVELS = [
  { id: 'beginner', label: 'مبتدئ' },
  { id: 'intermediate', label: 'متوسط' },
  { id: 'advanced', label: 'متقدم' },
];

export const DEPTHS = [
  { id: 'brief', label: 'موجز' },
  { id: 'standard', label: 'متوسط' },
  { id: 'detailed', label: 'مفصّل' },
];

export const STYLES = [
  { id: 'mixed', label: 'مزيج متوازن' },
  { id: 'practical', label: 'عملي' },
  { id: 'interactive', label: 'تفاعلي' },
  { id: 'knowledge', label: 'معرفي' },
];

export const STAGES = [
  { id: 'all', label: 'جميع المراحل' },
  { id: 'c1', label: 'الحلقة الأولى' },
  { id: 'c2', label: 'الحلقة الثانية' },
  { id: 'post', label: 'ما بعد الأساسي' },
];

const by = (list) => Object.fromEntries(list.map((x) => [x.id, x]));
export const DOMAIN = by(DOMAINS);
export const label = (list, id, fallback = '') => (list.find((x) => x.id === id) || {}).label || fallback;
export const bandOf = (min) => DURATION_BANDS.find((b) => min >= b.min && min <= b.max) || DURATION_BANDS[1];
