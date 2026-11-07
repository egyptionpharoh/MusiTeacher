// مكتبة تصميمات الأغلفة: كل تصميم = خلفية فنية + تكوين للعناصر + خطوط + معالجة للعنوان + عدة ألوان.

/** خطوط Windows / Office العربية (موجودة في أجهزة المعلمين) مع بديل ويب للمعاينة على الأجهزة الأخرى */
export const FONTS = {
  'Sakkal Majalla': { label: 'سكّال مجلة (رسمي)', css: "'Sakkal Majalla','Amiri',serif", scale: 1 },
  'Arabic Typesetting': { label: 'النسخ التقليدي', css: "'Arabic Typesetting','Amiri',serif", scale: 1.22 },
  'Traditional Arabic': { label: 'العربي التقليدي', css: "'Traditional Arabic','Amiri',serif", scale: 1 },
  'Simplified Arabic': { label: 'العربي المبسّط', css: "'Simplified Arabic','Amiri',serif", scale: 0.92 },
  'Aldhabi': { label: 'الذهبي (زخرفي)', css: "'Aldhabi','Amiri',serif", scale: 1.1 },
  'Segoe UI': { label: 'سيغو (حديث)', css: "'Segoe UI','Cairo',sans-serif", scale: 0.9 },
  'Andalus': { label: 'الأندلس (فني)', css: "'Andalus','Amiri',serif", scale: 1 },
};
export const fontCss = (f) => (FONTS[f] ? FONTS[f].css : `'${f}', 'Amiri', serif`);
export const fontScale = (f) => (FONTS[f] ? FONTS[f].scale : 1);

export const STYLES = [
  { id: 'official', label: 'رسمي عُماني' },
  { id: 'heritage', label: 'تراثي' },
  { id: 'nature', label: 'طبيعي' },
  { id: 'luxury', label: 'فاخر' },
  { id: 'classical', label: 'موسيقي كلاسيكي' },
  { id: 'modern', label: 'حديث' },
  { id: '3d', label: 'ثلاثي الأبعاد' },
  { id: 'academic', label: 'أكاديمي' },
  { id: 'economy', label: 'اقتصادي للطباعة' },
  { id: 'creative', label: 'فني إبداعي' },
  { id: 'events', label: 'مناسبات' },
];

// ألوان مستوحاة من البيئة العُمانية
const P = {
  flag: { name: 'ألوان السلطنة', paper: '#FFFDF8', ink: '#2A1D1A', ink2: '#6B5A52', accent: '#8E1B2C', accent2: '#1E6B3A', gold: '#B38B2D', soft: '#F6EEDD', deep: '#4A0E17', title: '#8E1B2C', titleDark: '#4A0E17', titleGrad: ['#D23A4E', '#8E1B2C', '#4A0E17'] },
  navyGold: { name: 'كحلي وذهبي', paper: '#FDFBF6', ink: '#14233A', ink2: '#56637A', accent: '#1B3A66', accent2: '#2F6F8F', gold: '#B6923A', soft: '#EEF1F6', deep: '#0C1D36', title: '#1B3A66', titleDark: '#0A162B', titleGrad: ['#4C79B8', '#1B3A66', '#0C1D36'] },
  emerald: { name: 'زمرّدي', paper: '#FCFDF9', ink: '#132A22', ink2: '#4E6A5E', accent: '#146B4E', accent2: '#8E1B2C', gold: '#B08A2E', soft: '#EAF3EE', deep: '#0A3324', title: '#146B4E', titleDark: '#073020', titleGrad: ['#3FA57C', '#146B4E', '#073020'] },
  sand: { name: 'رملي', paper: '#FFFCF6', ink: '#3A2716', ink2: '#7A6249', accent: '#8A5A2B', accent2: '#5E7D3A', gold: '#B98A3E', soft: '#F3E6D0', deep: '#4B2E12', title: '#7A4A1E', titleDark: '#3F240B', titleGrad: ['#C98A4B', '#8A5A2B', '#4B2E12'] },
  sunset: { name: 'غروب', paper: '#FFFBF7', ink: '#3A1E1A', ink2: '#7D5A52', accent: '#B2492B', accent2: '#6A3B6E', gold: '#D19A3A', soft: '#FBE7DA', deep: '#5A1D10', title: '#A33E22', titleDark: '#4F1A0C', titleGrad: ['#E98551', '#B2492B', '#5A1D10'] },
  tealGold: { name: 'فيروزي وذهبي', paper: '#0F3B3B', ink: '#F7EFD9', ink2: '#CDBF98', accent: '#E0C27A', accent2: '#8FC9BF', gold: '#D6B25E', soft: '#155050', deep: '#082424', title: '#E9CF86', titleDark: '#3A2E0E', titleGrad: ['#FFF0B8', '#D6B25E', '#8A6A22'], dark: true },
  ivoryTeal: { name: 'عاجي وفيروزي', paper: '#FFFCF4', ink: '#123A3A', ink2: '#53706C', accent: '#1C5B5A', accent2: '#B6923A', gold: '#B6923A', soft: '#F1EAD6', deep: '#0B2F2F', title: '#1C5B5A', titleDark: '#0B2F2F', titleGrad: ['#E9CF86', '#B6923A', '#6D5114'] },
  smoke: { name: 'دخان اللبان', paper: '#FCFAF7', ink: '#2E2723', ink2: '#776A60', accent: '#7C6A5C', accent2: '#5B4636', gold: '#B0905A', soft: '#EFE8E0', deep: '#3A2C22', title: '#5B4636', titleDark: '#2A1D14', titleGrad: ['#A08268', '#5B4636', '#2A1D14'] },
  mauve: { name: 'بنفسجي ظفاري', paper: '#FCFAFC', ink: '#2E2034', ink2: '#76687D', accent: '#7A4E8A', accent2: '#4C3557', gold: '#B79157', soft: '#F1EAF3', deep: '#35203F', title: '#64397A', titleDark: '#2D1638', titleGrad: ['#A574BC', '#64397A', '#2D1638'] },
  sea: { name: 'بحري', paper: '#FBFDFE', ink: '#0F2738', ink2: '#4F6B7E', accent: '#1F5E8A', accent2: '#123E5E', gold: '#D9A441', soft: '#E3F0F7', deep: '#0A2840', title: '#16507A', titleDark: '#082236', titleGrad: ['#4C98CC', '#1F5E8A', '#0A2840'] },
  coral: { name: 'شعاب مرجانية', paper: '#FFFBFA', ink: '#33201F', ink2: '#7C5C59', accent: '#C2554A', accent2: '#2E6F7A', gold: '#E0A43E', soft: '#FBE5E1', deep: '#5B1E18', title: '#B0463B', titleDark: '#521913', titleGrad: ['#EE8A7E', '#C2554A', '#5B1E18'] },
  green: { name: 'أخضر الجبل', paper: '#FBFCF7', ink: '#1E2A16', ink2: '#5C6B50', accent: '#4C7A2B', accent2: '#7A5A2B', gold: '#B4913A', soft: '#EAF1E0', deep: '#24400F', title: '#3D6A1F', titleDark: '#1D370B', titleGrad: ['#7DB255', '#4C7A2B', '#24400F'] },
  olive: { name: 'زيتوني ورملي', paper: '#FDFCF6', ink: '#2B2A18', ink2: '#6C6A4D', accent: '#6E6B2E', accent2: '#8A5A2B', gold: '#B9953E', soft: '#F0EEDB', deep: '#3A3810', title: '#5C5A20', titleDark: '#2D2B08', titleGrad: ['#A6A34E', '#6E6B2E', '#3A3810'] },
  aqua: { name: 'ماء الفلج', paper: '#FAFDFC', ink: '#12302C', ink2: '#527470', accent: '#1F7A72', accent2: '#3E7A2E', gold: '#C29B45', soft: '#DFF1EE', deep: '#0C3B36', title: '#17665F', titleDark: '#08312D', titleGrad: ['#4DB3A8', '#1F7A72', '#0C3B36'] },
  nightGold: { name: 'ليلي ذهبي', paper: '#13294A', deep: '#07142A', ink: '#F5EBD0', ink2: '#C9BB95', accent: '#D6B25E', accent2: '#8FA9D0', gold: '#D6B25E', soft: '#1D365C', title: '#E9CF86', titleDark: '#2B220A', titleGrad: ['#FFF3C4', '#D6B25E', '#87661F'], dark: true },
  blackGold: { name: 'أسود ذهبي', paper: '#1C1A17', deep: '#0B0A08', ink: '#F3E8CC', ink2: '#BFB291', accent: '#CFAE5B', accent2: '#9C8B66', gold: '#CFAE5B', soft: '#2A2722', title: '#E6CB7E', titleDark: '#2A2008', titleGrad: ['#FFF1C1', '#CFAE5B', '#80621C'], dark: true },
  burgundyGold: { name: 'عنّابي ذهبي', paper: '#4A1420', deep: '#25070D', ink: '#F7E9D2', ink2: '#D4BC9E', accent: '#D9B565', accent2: '#E3A2A2', gold: '#D9B565', soft: '#5C1D2B', title: '#EBD08A', titleDark: '#2E0C12', titleGrad: ['#FFF0C0', '#D9B565', '#86621E'], dark: true },
  ivoryGold: { name: 'عاجي ذهبي', paper: '#FFFBF1', ink: '#3A2E16', ink2: '#7C6B48', accent: '#A9832E', accent2: '#6B5320', gold: '#B8913A', soft: '#F4EBD4', deep: '#4D3A12', title: '#9A7524', titleDark: '#4D3A12', titleGrad: ['#F2DA8E', '#B8913A', '#6E531A'] },
  walnut: { name: 'خشب الجوز', paper: '#FFFCF7', ink: '#2F2016', ink2: '#77604E', accent: '#6B4226', accent2: '#8A5A2B', gold: '#B98B45', soft: '#F3E8DB', deep: '#3B2212', title: '#5E3A20', titleDark: '#2D190B', titleGrad: ['#B07A4E', '#6B4226', '#2D190B'] },
  sepia: { name: 'ورق المدوّنات', paper: '#FFFCF2', ink: '#2B241B', ink2: '#6E6252', accent: '#4E4334', accent2: '#8A5A2B', gold: '#A88B57', soft: '#F6EFDC', deep: '#2B241B', title: '#3E3427', titleDark: '#1A140D', titleGrad: ['#8A7A62', '#4E4334', '#1A140D'] },
  brand: { name: 'هوية MusiTeacher', paper: '#FCFDFF', ink: '#14213D', ink2: '#5A6684', accent: '#2563EB', accent2: '#7C3AED', gold: '#22D3EE', soft: '#EAF0FE', deep: '#1E3A8A', title: '#1D4ED8', titleDark: '#172554', titleGrad: ['#60A5FA', '#2563EB', '#5B21B6'] },
  limeTeal: { name: 'فيروزي وليموني', paper: '#FBFEFC', ink: '#11302B', ink2: '#4E6E67', accent: '#0F8B7A', accent2: '#8BBF2D', gold: '#8BBF2D', soft: '#E2F4EF', deep: '#0A4A41', title: '#0E776A', titleDark: '#073A33', titleGrad: ['#3CC1AD', '#0F8B7A', '#0A4A41'] },
  coralTeal: { name: 'مرجاني وفيروزي', paper: '#FFFDFB', ink: '#232A33', ink2: '#5E6772', accent: '#E06B54', accent2: '#2A8C8C', gold: '#F2B544', soft: '#F6E9E2', deep: '#1F4F57', title: '#C9503A', titleDark: '#5E2116', titleGrad: ['#F59C88', '#E06B54', '#7E2A1C'] },
  steel: { name: 'أزرق فولاذي', paper: '#FBFCFD', ink: '#172230', ink2: '#5B6878', accent: '#2C4A6E', accent2: '#5C7FA8', gold: '#9FB3C8', soft: '#E9EEF4', deep: '#16283E', title: '#24405F', titleDark: '#0E1C2D', titleGrad: ['#6E8FB8', '#2C4A6E', '#16283E'] },
  ink: { name: 'أبيض وأسود', paper: '#FFFFFF', ink: '#111111', ink2: '#444444', accent: '#111111', accent2: '#444444', gold: '#555555', soft: '#F2F2F2', deep: '#000000', title: '#111111', titleDark: '#888888', titleGrad: ['#555555', '#111111', '#000000'], mono: true },
  inkGrey: { name: 'رمادي هادئ', paper: '#FFFFFF', ink: '#222222', ink2: '#555555', accent: '#555555', accent2: '#888888', gold: '#777777', soft: '#F4F4F4', deep: '#222222', title: '#222222', titleDark: '#9A9A9A', titleGrad: ['#666666', '#222222', '#000000'], mono: true },
  festive: { name: 'احتفالي', paper: '#FFFDF8', ink: '#23163A', ink2: '#685C80', accent: '#7C3AED', accent2: '#DB2777', gold: '#E9A72B', soft: '#F5EEFF', deep: '#3B0F7A', title: '#6D28D9', titleDark: '#2E1065', titleGrad: ['#A78BFA', '#7C3AED', '#3B0F7A'] },
  national: { name: 'العيد الوطني', paper: '#FFFFFF', ink: '#2A1D1A', ink2: '#6B5A52', accent: '#C8102E', accent2: '#00843D', gold: '#C9A227', soft: '#F7F1EA', deep: '#6E0717', title: '#B30E28', titleDark: '#5C0613', titleGrad: ['#E8455C', '#C8102E', '#5C0613'] },
};

const L = (o) => ({ bounds: [14, 196], header: 'stack', headerTop: 13, titleTop: 104, titleSize: 56, subjectScale: 0.7, fields: 'lines', preparerTop: 238, brandTop: 266, logoDefault: 'right', ...o });

export const DESIGNS = [
  // ---------------- رسمي عُماني
  { id: 'oman-official', name: 'الرسمي العُماني', style: 'official', art: 'omani-lattice', fonts: { title: 'Sakkal Majalla', body: 'Sakkal Majalla' }, effect: 'deep3d',
    desc: 'إطار مزدوج وزخارف نجمية عُمانية، وميدالية مائية خلف العنوان.', layout: L({ bounds: [20, 190] }), palettes: [P.flag, P.navyGold, P.emerald] },
  { id: 'oman-ministry', name: 'الترويسة الوزارية', style: 'official', art: 'omani-band', fonts: { title: 'Sakkal Majalla', body: 'Sakkal Majalla' }, effect: 'emboss',
    desc: 'ترويسة رسمية موزعة يمينًا ويسارًا، وحقول السجل داخل إطار منظم.', layout: L({ header: 'split', bounds: [22, 188], headerTop: 22, titleTop: 98, fields: 'panel', logoDefault: 'left', preparerTop: 242, brandTop: 262 }), palettes: [P.navyGold, P.flag, P.emerald] },
  { id: 'oman-medallion', name: 'الميدالية الذهبية', style: 'official', art: 'medallion', fonts: { title: 'Arabic Typesetting', body: 'Sakkal Majalla' }, effect: 'gold',
    desc: 'نجمة ثمانية كبرى بخطوط ذهبية دقيقة يتوسطها عنوان بارز.', layout: L({ bounds: [22, 188], titleTop: 106, titleSize: 65 }), palettes: [P.ivoryGold, P.navyGold, P.ivoryTeal] },
  // ---------------- تراثي
  { id: 'nizwa-fort', name: 'حصن نزوى', style: 'heritage', art: 'fort', fonts: { title: 'Traditional Arabic', body: 'Sakkal Majalla' }, effect: 'deep3d',
    desc: 'ظل هادئ لقلعة عُمانية ونخيل، يعلوها مدرج موسيقي كخط أفق.', layout: L({ titleTop: 98, preparerTop: 194, safeBottom: 206, brandTop: 262, fieldsGap: 7 }), palettes: [P.sand, P.sunset, P.navyGold] },
  { id: 'omani-door', name: 'الباب العُماني', style: 'heritage', art: 'door', fonts: { title: 'Arabic Typesetting', body: 'Sakkal Majalla' }, effect: 'gold',
    desc: 'العنوان يسكن قوس باب عُماني خشبي بمساميره ونقوشه.', layout: L({ bounds: [44, 166], titleTop: 116, titleSize: 53, preparerTop: 222, brandTop: 279, headerTop: 11 }), palettes: [P.tealGold, P.ivoryTeal, P.burgundyGold] },
  { id: 'dhofar-incense', name: 'لبان ظفار', style: 'heritage', art: 'frankincense', fonts: { title: 'Aldhabi', body: 'Sakkal Majalla' }, effect: 'emboss',
    desc: 'دخان مبخرة ظفارية يتصاعد فيتحول إلى مدرج ونوتات.', layout: L({ titleTop: 100, preparerTop: 228, brandTop: 270, brandX: 34 }), palettes: [P.smoke, P.mauve, P.sand] },
  // ---------------- طبيعي
  { id: 'sea-dhow', name: 'السفينة والبحر', style: 'nature', art: 'sea', fonts: { title: 'Sakkal Majalla', body: 'Sakkal Majalla' }, effect: 'deep3d',
    desc: 'أمواج بحر عُمان تصير مدرجًا تبحر عليه سفينة شراعية.', layout: L({ titleTop: 98, preparerTop: 210, safeBottom: 230, brandTop: 278 }), palettes: [P.sea, P.coral, P.navyGold] },
  { id: 'green-terraces', name: 'مدرجات الجبل الأخضر', style: 'nature', art: 'terraces', fonts: { title: 'Traditional Arabic', body: 'Sakkal Majalla' }, effect: 'emboss',
    desc: 'خطوط المدرجات الزراعية تتحول في قمتها إلى مدرج موسيقي.', layout: L({ titleTop: 84, preparerTop: 160, safeBottom: 184, brandTop: 278, fieldsGap: 6 }), palettes: [P.green, P.olive, P.sand] },
  { id: 'falaj-palms', name: 'الفلج والنخيل', style: 'nature', art: 'falaj', fonts: { title: 'Sakkal Majalla', body: 'Sakkal Majalla' }, effect: 'deep3d',
    desc: 'سعف النخيل في الأعلى، وقناة فلج يجري ماؤها خطوطًا موسيقية.', layout: L({ headerTop: 14, titleTop: 102, preparerTop: 218, safeBottom: 232, brandTop: 272 }), palettes: [P.aqua, P.green, P.sand] },
  // ---------------- فاخر
  { id: 'night-gold', name: 'الليل الذهبي', style: 'luxury', art: 'night', fonts: { title: 'Arabic Typesetting', body: 'Sakkal Majalla' }, effect: 'gold',
    desc: 'خلفية داكنة بشبكة نجوم ذهبية تتلاشى من الزوايا.', layout: L({ bounds: [22, 188], titleTop: 106, titleSize: 65 }), palettes: [P.nightGold, P.blackGold, P.burgundyGold] },
  { id: 'ivory-arabesque', name: 'العاجي المزخرف', style: 'luxury', art: 'gold-frame', fonts: { title: 'Aldhabi', body: 'Traditional Arabic' }, effect: 'gold',
    desc: 'إطار ذهبي ثلاثي وأرابيسك في الزوايا وفواصل نجمية.', layout: L({ bounds: [22, 188], titleTop: 106, titleSize: 60, preparerTop: 232 }), palettes: [P.ivoryGold, P.ivoryTeal, P.navyGold] },
  // ---------------- موسيقي كلاسيكي
  { id: 'oud-melody', name: 'العود واللحن', style: 'classical', art: 'oud', fonts: { title: 'Traditional Arabic', body: 'Sakkal Majalla' }, effect: 'deep3d',
    desc: 'عود عربي كعلامة مائية مائلة، وجملة لحنية تنساب نحو الأعلى.', layout: L({ bounds: [18, 188], titleTop: 102 }), palettes: [P.walnut, P.navyGold, P.emerald] },
  { id: 'manuscript', name: 'دفتر النوتة', style: 'classical', art: 'manuscript', fonts: { title: 'Arabic Typesetting', body: 'Sakkal Majalla' }, effect: 'emboss',
    desc: 'صفحة مدرجات موسيقية كاملة، وبطاقة بيضاء تحمل بيانات السجل.', layout: L({ bounds: [26, 184], headerTop: 13, titleTop: 104, headerPlate: { x: 44, y: 10, w: 122, h: 66, radius: 5 }, plate: { x: 22, y: 92, w: 166, h: 170, radius: 6 }, preparerTop: 236, brandTop: 268 }), palettes: [P.sepia, P.navyGold, P.walnut] },
  { id: 'qanun-strings', name: 'أوتار القانون', style: 'classical', art: 'qanun', fonts: { title: 'Sakkal Majalla', body: 'Sakkal Majalla' }, effect: 'deep3d',
    desc: 'آلة القانون بأوتارها في شريط جانبي، والمحتوى في عمود منظم.', layout: L({ bounds: [74, 202], titleSize: 50, titleTop: 104, brandX: 138 }), palettes: [P.navyGold, P.walnut, P.emerald] },
  // ---------------- حديث
  { id: 'waveform', name: 'الموجة الصوتية', style: 'modern', art: 'waveform', fonts: { title: 'Segoe UI', body: 'Segoe UI' }, effect: 'flat',
    desc: 'موجة صوتية متدرجة ومساحات بيضاء واسعة، بطابع رقمي نظيف.', layout: L({ header: 'split', headerTop: 18, titleTop: 98, titleSize: 53, preparerTop: 214, safeBottom: 236, brandTop: 272, logoDefault: 'left' }), palettes: [P.brand, P.limeTeal, P.coralTeal] },
  { id: 'mosaic', name: 'الفسيفساء', style: 'modern', art: 'mosaic', fonts: { title: 'Segoe UI', body: 'Segoe UI' }, effect: 'flat',
    desc: 'مثلثات هندسية ملونة في زاويتين متقابلتين.', layout: L({ titleTop: 104, titleSize: 53 }), palettes: [P.coralTeal, P.brand, P.aqua] },
  { id: 'staff-sweep', name: 'المدرج المنساب', style: 'modern', art: 'staff-sweep', fonts: { title: 'Segoe UI', body: 'Segoe UI' }, effect: 'flat',
    desc: 'مدرج عريض واحد يعبر الصفحة بانسياب في ثلثها السفلي.', layout: L({ titleTop: 88, titleSize: 53, preparerTop: 180, safeBottom: 194, brandTop: 278, fieldsGap: 6 }), palettes: [P.steel, P.brand, P.coral] },
  // ---------------- ثلاثي الأبعاد
  { id: 'piano-3d', name: 'مفاتيح البيانو المجسّمة', style: '3d', art: 'piano-3d', fonts: { title: 'Sakkal Majalla', body: 'Sakkal Majalla' }, effect: 'deep3d',
    desc: 'لوحة مفاتيح منظورية بعمق ثلاثي الأبعاد تحمل الغلاف.', layout: L({ titleTop: 96, titleSize: 60, preparerTop: 206, safeBottom: 222, brandTop: 283.5, brandSize: 8 }), palettes: [P.navyGold, P.brand, P.walnut] },
  { id: 'sound-rings', name: 'حلقات الصوت', style: '3d', art: 'speaker', fonts: { title: 'Segoe UI', body: 'Segoe UI' }, effect: 'deep3d',
    desc: 'حلقات مجسّمة تتسع كأمواج صوت من مكبر في الزاوية.', layout: L({ titleTop: 102, titleSize: 55 }), palettes: [P.brand, P.coralTeal, P.steel] },
  // ---------------- أكاديمي
  { id: 'academic-band', name: 'الشريط الأكاديمي', style: 'academic', art: 'academic-band', fonts: { title: 'Simplified Arabic', body: 'Simplified Arabic' }, effect: 'flat',
    desc: 'شريط جانبي بزخرفة نجمية، وتوزيع هادئ يناسب السجلات الرسمية.', layout: L({ bounds: [12, 178], titleTop: 104, titleSize: 50, fields: 'panel', preparerTop: 240, brandX: 95 }), palettes: [P.navyGold, P.emerald, P.steel] },
  { id: 'academic-ledger', name: 'الترويسة الملوّنة', style: 'academic', art: 'ledger', fonts: { title: 'Simplified Arabic', body: 'Simplified Arabic' }, effect: 'flat',
    desc: 'ترويسة كاملة داخل شريط لوني علوي، وما تحتها أبيض صافٍ.', layout: L({ header: 'split', headerTop: 16, headerOnColor: true, titleTop: 112, titleSize: 53, fields: 'panel', preparerTop: 242, logoDefault: 'left' }), palettes: [P.navyGold, P.emerald, P.flag] },
  // ---------------- اقتصادي للطباعة
  { id: 'ink-saver', name: 'الحبر الموفّر', style: 'economy', art: 'ink', fonts: { title: 'Sakkal Majalla', body: 'Sakkal Majalla' }, effect: 'outline',
    desc: 'خطوط سوداء رفيعة وزخرفة صغيرة فقط — مثالي للطابعة المدرسية.', layout: L({ bounds: [22, 188], titleTop: 106 }), palettes: [P.ink, P.inkGrey] },
  { id: 'ink-staff', name: 'المدرج البسيط', style: 'economy', art: 'ink-staff', fonts: { title: 'Simplified Arabic', body: 'Simplified Arabic' }, effect: 'flat',
    desc: 'مدرجان رفيعان أعلى الصفحة وأسفلها، بلا أي تعبئة لونية.', layout: L({ header: 'split', headerTop: 24, titleTop: 108, logoDefault: 'left', brandTop: 258 }), palettes: [P.ink, P.inkGrey] },
  // ---------------- فني إبداعي
  { id: 'omani-drums', name: 'إيقاعات عُمانية', style: 'creative', art: 'drums', fonts: { title: 'Andalus', body: 'Sakkal Majalla' }, effect: 'deep3d',
    desc: 'دفوف وطبل ورقعة إيقاعية «دُم-تك» بروح الفنون العُمانية.', layout: L({ titleTop: 100 }), palettes: [P.coralTeal, P.sunset, P.sea] },
  { id: 'instruments-wreath', name: 'إكليل الآلات', style: 'creative', art: 'wreath', fonts: { title: 'Aldhabi', body: 'Sakkal Majalla' }, effect: 'emboss',
    desc: 'العود والناي والدف والطبل في إكليل دائري يحيط بالعنوان.', layout: L({ bounds: [32, 178], titleTop: 106, titleSize: 53, preparerTop: 240 }), palettes: [P.emerald, P.walnut, P.mauve] },
  // ---------------- مناسبات
  { id: 'celebration', name: 'الاحتفال الموسيقي', style: 'events', art: 'celebration', fonts: { title: 'Andalus', body: 'Sakkal Majalla' }, effect: 'deep3d',
    desc: 'أشعة ونجوم ونوتات متناثرة — لسجلات الفعاليات والمسابقات.', layout: L({ titleTop: 108, titleSize: 55 }), palettes: [P.festive, P.coralTeal, P.nightGold] },
  { id: 'national-day', name: 'ألوان الوطن', style: 'events', art: 'national', fonts: { title: 'Sakkal Majalla', body: 'Sakkal Majalla' }, effect: 'deep3d',
    desc: 'شريط متموج بألوان العلم الأحمر والأبيض والأخضر لفعاليات العيد الوطني.', layout: L({ titleTop: 100, preparerTop: 222, safeBottom: 240, brandTop: 276 }), palettes: [P.national] },
];

export const getDesign = (id) => DESIGNS.find((d) => d.id === id) || DESIGNS[0];
export const variantCount = DESIGNS.reduce((a, d) => a + d.palettes.length, 0);
