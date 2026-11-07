// أنواع السجلات وبيانات النماذج — قيم نقية تُستخدم في الواجهة وفي مولّد Word.

export const SUBJECTS = [
  { id: 'skills', label: 'المهارات الموسيقية' },
  { id: 'arts', label: 'الفنون الموسيقية' },
  { id: 'both', label: 'المهارات / الفنون الموسيقية' },
];

export const SEMESTERS = [
  { id: 'first', label: 'الأول' },
  { id: 'second', label: 'الثاني' },
  { id: 'both', label: 'الأول والثاني' },
];

export const ROLES = [
  { id: 'male', label: 'معلم المادة' },
  { id: 'female', label: 'معلمة المادة' },
];

// محافظات سلطنة عُمان (11 محافظة)
export const GOVERNORATES = [
  'مسقط', 'ظفار', 'مسندم', 'البريمي', 'الداخلية', 'شمال الباطنة', 'جنوب الباطنة',
  'جنوب الشرقية', 'شمال الشرقية', 'الظاهرة', 'الوسطى',
];

export const RECORD_GROUPS = [
  { id: 'grading', label: 'الدرجات والتقويم' },
  { id: 'followup', label: 'المتابعة' },
  { id: 'activities', label: 'الأنشطة والفرق' },
  { id: 'admin', label: 'التخطيط والتوثيق' },
];

/** title: أسطر العنوان الرئيسي · connector: ما يسبق اسم المادة · subject: هل يظهر اسم المادة افتراضيًا */
export const RECORDS = [
  { id: 'grades', group: 'grading', title: ['سجل درجات'], connector: 'في مادة', subject: true },
  { id: 'achievement', group: 'grading', title: ['سجل التحصيل الدراسي'], connector: 'في مادة', subject: true },
  { id: 'formative', group: 'grading', title: ['سجل التقويم التكويني'], connector: 'في مادة', subject: true },
  { id: 'assessment', group: 'grading', title: ['سجل التقييم والمتابعة'], connector: 'في مادة', subject: true },
  { id: 'performance', group: 'followup', title: ['سجل متابعة أداء الطلاب'], connector: 'في مادة', subject: true },
  { id: 'practical', group: 'followup', title: ['سجل متابعة', 'المهارات العملية'], connector: 'في مادة', subject: true },
  { id: 'attendance', group: 'followup', title: ['سجل الحضور والغياب'], connector: 'لمادة', subject: true },
  { id: 'remedial', group: 'followup', title: ['سجل الخطط العلاجية', 'والإثرائية'], connector: 'في مادة', subject: true },
  { id: 'activities', group: 'activities', title: ['سجل الأنشطة', 'الموسيقية'], connector: '', subject: false },
  { id: 'events', group: 'activities', title: ['سجل الفعاليات', 'والمناسبات الموسيقية'], connector: '', subject: false },
  { id: 'band', group: 'activities', title: ['سجل الفرقة', 'الموسيقية المدرسية'], connector: '', subject: false },
  { id: 'competitions', group: 'activities', title: ['سجل المسابقات', 'الموسيقية'], connector: '', subject: false },
  { id: 'gifted', group: 'activities', title: ['سجل رعاية', 'الموهوبين موسيقيًا'], connector: '', subject: false },
  { id: 'planning', group: 'admin', title: ['سجل التحضير', 'والخطط الفصلية'], connector: 'لمادة', subject: true },
  { id: 'portfolio', group: 'admin', title: ['ملف إنجاز المعلم'], connector: 'في مادة', subject: true },
  { id: 'instruments', group: 'admin', title: ['سجل عهدة', 'الآلات الموسيقية'], connector: '', subject: false },
];

export const getRecord = (id) => RECORDS.find((r) => r.id === id) || RECORDS[0];

/** العام الدراسي الافتراضي: يبدأ في أغسطس. */
export function defaultYear(now = new Date()) {
  const y = now.getFullYear();
  const start = now.getMonth() >= 7 ? y : y - 1;
  return `${start}-${start + 1}`;
}

export function defaultData(now) {
  return {
    recordId: 'grades', subject: 'skills', governorate: 'مسقط', school: '', year: defaultYear(now),
    semester: 'first', role: 'male', teacher: '', grade: '', showSubject: true, customTitle: '',
    logoPos: '', titleFont: '', schoolLogo: null, emblem: null,
  };
}

const clean = (s) => String(s || '').replace(/[\u202A-\u202E\u2066-\u2069]/g, '').replace(/\s+/g, ' ').trim();
const ltr = (s) => (s && /\d/.test(s) ? `\u202A${s}\u202C` : s);
/** «مدرسة …» تُكتب مرة واحدة حتى لو كتبها المعلم ضمن الاسم. */
export const schoolName = (s) => clean(s).replace(/^مدرسة\s+/, '');
export const governorateName = (s) => clean(s).replace(/^(محافظة|بمحافظة)\s+/, '');

/** نصوص الغلاف النهائية من بيانات المعلم. */
export function coverTexts(data) {
  const rec = getRecord(data.recordId);
  const custom = clean(data.customTitle);
  const title = custom ? custom.split(/\s*[|/]\s*/).filter(Boolean).slice(0, 2) : rec.title;
  const subject = (SUBJECTS.find((s) => s.id === data.subject) || SUBJECTS[0]).label;
  const showSubject = data.showSubject !== undefined ? data.showSubject : rec.subject;
  const sem = SEMESTERS.find((s) => s.id === data.semester) || SEMESTERS[0];
  const role = (ROLES.find((r) => r.id === data.role) || ROLES[0]).label;
  const gov = governorateName(data.governorate);
  const school = schoolName(data.school);
  return {
    country: 'سلطنة عُمان',
    ministry: 'وزارة التعليم',
    directorate: `المديرية العامة للتعليم بمحافظة ${gov || '..........'}`,
    directorateA: 'المديرية العامة للتعليم',
    directorateB: `بمحافظة ${gov || '..........'}`,
    school: `مدرسة ${school || '....................'}`,
    title,
    connector: showSubject ? (custom ? 'في مادة' : rec.connector || 'لمادة') : '',
    subject: showSubject ? subject : '',
    // الأرقام المفصولة بشرطة داخل نص عربي تنعكس (2027-2026)؛ علامتا LRE/PDF تثبّتان اتجاهها في المتصفح وWord
    year: `للعام الدراسي ${ltr(clean(data.year)) || '..........'}`,
    semester: data.semester === 'both' ? 'الفصلان الدراسيان: الأول والثاني' : `الفصل الدراسي: ${sem.label}`,
    grade: clean(data.grade) ? `الصف: ${clean(data.grade)}` : '',
    preparer: `إعداد ${role}: ${clean(data.teacher) || '................................'}`,
    brand: 'بوابة MusiTeacher الذكية',
  };
}
