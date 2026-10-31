// =====================================================================
//  سجل الألعاب الافتراضية (Virtual Music Lab) — المصدر الوحيد لبيانات الألعاب
//  لإضافة لعبة جديدة: ضع ملفاتها في  private-games/<id>/  ثم أضف عنصرًا هنا.
//  (الدليل الكامل: docs/ADD_VIRTUAL_GAME.md)
//
//  الحقول:
//    id          معرّف لاتيني فريد = اسم مجلد اللعبة داخل private-games
//    title       اسم اللعبة (عربي)
//    description وصف مختصر
//    category    أحد مفاتيح GAME_CATEGORIES
//    grade       المرحلة/الصف المستهدف (نص) أو null = كل المراحل
//    status      'available' متاحة | 'soon' قيد التطوير (للمدير فقط) | 'unavailable' غير متاحة
//    entry       ملف التشغيل داخل المجلد (الافتراضي index.html)
//    cover       مسار صورة الغلاف داخل public (غير حساسة) أو null
//    tags        كلمات مفتاحية للبحث
//    settings    إعدادات خاصة: { threeD: true|false, needsAudio: true|false, markCorner: 'top-left'|'top-right'|'bottom-left'|'bottom-right'|'none', allowDownloads: true (للألعاب التي فيها زر تصدير صورة) }
// =====================================================================

export const GAME_CATEGORIES = {
  strings: { label: 'الآلات الوترية', icon: '🎻' },
  keys: { label: 'آلات المفاتيح', icon: '🎹' },
  percussion: { label: 'الآلات الإيقاعية', icon: '🥁' },
  scales: { label: 'السلالم والمقامات', icon: '🎼' },
};

export const VIRTUAL_GAMES = [
  {
    id: 'accordion-3d',
    title: 'عازفة الأكورديون ثلاثية الأبعاد',
    description: 'أكورديون بيانو (34 مفتاحًا / 48 باص) تعزف عليه عازفة ثلاثية الأبعاد بصوت أكورديون حقيقي: منفاخ يتمدد مع الأداء، ويد يمنى على المفاتيح ويسرى على أزرار الباص، مع وضع التعرّف على الأجزاء والعزف الحر والتدريبات ووضع المعلم.',
    category: 'keys', grade: null, status: 'available', entry: 'index.html',
    cover: '/lab-covers/accordion-3d.jpg',
    tags: ['أكورديون', 'منفاخ', 'باص', 'عازفة', 'آلة مفاتيح'],
    settings: { threeD: true, needsAudio: true, markCorner: 'top-left' },
  },
  {
    id: 'violinist-3d',
    title: 'عازفة الكمان ثلاثية الأبعاد',
    description: 'عازفة ثلاثية الأبعاد تؤدي سلالم دو وفا وصول على الكمان بصوت حقيقي، مع التحكم في الكاميرا وعرض وضعية الجلوس والإمساك بالقوس وأصابع اليد اليسرى.',
    category: 'strings', grade: null, status: 'available', entry: 'index.html',
    cover: '/lab-covers/violinist-3d.jpg',
    tags: ['كمان', 'سلالم', 'قوس', 'عازفة', 'وضعية العزف'],
    settings: { threeD: true, needsAudio: true, markCorner: 'top-left' },
  },
  {
    id: 'virtual-violin',
    title: 'آلة الكمان الافتراضية',
    description: 'كمان تعليمي بتسجيلات كمان حقيقية: تسميات النغمات وأرقام الأصابع وأشرطة المبتدئين ومواضع ثابتة وتنغيم حر، بثلاث شدّات للقوس.',
    category: 'strings', grade: null, status: 'available', entry: 'index.html',
    cover: '/lab-covers/virtual-violin.jpg',
    tags: ['كمان', 'أوتار', 'آلة وترية'],
    settings: { threeD: true, needsAudio: true, markCorner: 'top-left' },
  },
  {
    id: 'violin-scales',
    title: 'سُلّم صول الكبير على الكمان',
    description: 'لعبة ثلاثية الأبعاد تربط النوتة على المدرج برقم الإصبع وموضعه على زند الكمان وبالصوت: سلم صول الكبير في الوضع الأول، أوكتاف أو أوكتافان.',
    category: 'scales', grade: null, status: 'available', entry: 'index.html',
    cover: '/lab-covers/violin-scales.jpg',
    tags: ['كمان', 'سلم صول', 'سلالم'],
    settings: { threeD: true, needsAudio: true, markCorner: 'top-left' },
  },
  {
    id: 'virtual-oud',
    title: 'العود الافتراضي',
    description: 'عود عربي تعليمي بستة أوتار مزدوجة، يدعم أرباع التون والمقامات، مع أسماء النغمات وأرقام الأصابع وقوة الريشة.',
    category: 'strings', grade: null, status: 'available', entry: 'index.html',
    cover: '/lab-covers/virtual-oud.jpg',
    tags: ['عود', 'آلة شرقية', 'أوتار'],
    settings: { threeD: true, needsAudio: true, markCorner: 'top-left' },
  },
  {
    id: 'oud-3d',
    title: 'آلة العود — مجسم تعليمي',
    description: 'مجسم ثلاثي الأبعاد لآلة العود بتسمية الأجزاء، مع تدوير وتكبير وحفظ صورة عالية الدقة.',
    category: 'strings', grade: null, status: 'available', entry: 'index.html',
    cover: '/lab-covers/oud-3d.jpg',
    tags: ['عود', 'أجزاء الآلة', 'مجسم'],
    settings: { threeD: true, needsAudio: false, allowDownloads: true, markCorner: 'bottom-left' },
  },
  {
    id: 'oud-maqamat',
    title: 'مقامات العود ثلاثية الأبعاد',
    description: 'لعبة ثلاثية الأبعاد على زند العود: مقامات العجم والنهاوند والراست والكرد وحجاز كار كرد، مع النوتة والوتر والإصبع واتجاه الريشة والصوت.',
    category: 'scales', grade: null, status: 'available', entry: 'index.html',
    cover: '/lab-covers/oud-maqamat.jpg',
    tags: ['عود', 'مقامات', 'راست', 'عجم', 'نهاوند', 'كرد'],
    settings: { threeD: true, needsAudio: true, markCorner: 'top-left' },
  },
  {
    id: 'virtual-qanun',
    title: 'القانون الافتراضي',
    description: 'قانون عربي تعليمي: 26 درجة بأوتار ثلاثية، وعُرَب بأرباع التون، وضبط العُرَب على المقام.',
    category: 'strings', grade: null, status: 'available', entry: 'index.html',
    cover: '/lab-covers/virtual-qanun.jpg',
    tags: ['قانون', 'آلة شرقية'],
    settings: { threeD: true, needsAudio: true, markCorner: 'top-left' },
  },
  {
    id: 'qanun-3d',
    title: 'آلة القانون — مجسم تعليمي',
    description: 'مجسم تعليمي ثلاثي الأبعاد لآلة القانون: تدوير وتكبير وتسمية الأجزاء وتنزيل صورة PNG.',
    category: 'strings', grade: null, status: 'available', entry: 'index.html',
    cover: '/lab-covers/qanun-3d.jpg',
    tags: ['قانون', 'أجزاء الآلة', 'مجسم'],
    settings: { threeD: true, needsAudio: false, allowDownloads: true, markCorner: 'bottom-left' },
  },
  {
    id: 'guitar-3d',
    title: 'الجيتار الكلاسيكي — مجسم تعليمي',
    description: 'جيتار كلاسيكي ثلاثي الأبعاد بتسمية أجزائه (مفتاح الضبط، الأنف، الدساتين، فتحة الصوت، الفرس).',
    category: 'strings', grade: 'الصف الحادي عشر', status: 'available', entry: 'index.html',
    cover: '/lab-covers/guitar-3d.jpg',
    tags: ['جيتار', 'أجزاء الآلة', 'مجسم'],
    settings: { threeD: true, needsAudio: false, allowDownloads: true, markCorner: 'bottom-left' },
  },
  {
    id: 'piano-scales',
    title: 'سلالم البيانو ثلاثية الأبعاد',
    description: 'لعبة ثلاثية الأبعاد على لوحة مفاتيح البيانو: سلالم دو وصول وفا الكبيرة باليد اليمنى أو اليسرى أو باليدين، مع أرقام الأصابع والنوتة والصوت.',
    category: 'scales', grade: null, status: 'available', entry: 'index.html',
    cover: '/lab-covers/piano-scales.jpg',
    tags: ['بيانو', 'سلالم', 'مفاتيح'],
    settings: { threeD: true, needsAudio: true, markCorner: 'top-left' },
  },
  {
    id: 'accordion-scales',
    title: 'سلالم الأكورديون ثلاثية الأبعاد',
    description: 'لعبة ثلاثية الأبعاد للأكورديون: سلالم دو وصول وفا الكبيرة باليد اليمنى، مع باص اليسرى على أزرار ستراديلا واتجاه المنفاخ والنوتة والصوت.',
    category: 'scales', grade: 'الصف الخامس', status: 'available', entry: 'index.html',
    cover: '/lab-covers/accordion-scales.jpg',
    tags: ['أكورديون', 'سلالم', 'مفاتيح'],
    settings: { threeD: true, needsAudio: true, markCorner: 'top-left' },
  },
  {
    id: 'xylophone',
    title: 'الإكسليفون ثلاثي الأبعاد',
    description: 'لعبة ثلاثية الأبعاد للإكسليفون: سلم دو الكبير بمطرقتين متحركتين مع النوتة والصوت، ووضع عزف حر يكتب نغمات الطالب على المدرج.',
    category: 'percussion', grade: 'الصف الثالث', status: 'available', entry: 'index.html',
    cover: '/lab-covers/xylophone.jpg',
    tags: ['إكسليفون', 'سلالم', 'آلة إيقاعية'],
    settings: { threeD: true, needsAudio: true, markCorner: 'top-left' },
  },
  {
    id: 'oriental-organ-piano',
    title: 'الأورج الشرقي والبيانو الغربي (Oriental Maestro)',
    description: 'أورج شرقي وبيانو غربي في أداة واحدة: اضغط أي مفتاح لترى اسم النغمة وترددها، مع نظام تسمية عربي ودعم المقامات الشرقية.',
    category: 'keys', grade: 'الصف الرابع', status: 'available', entry: 'index.html',
    cover: '/lab-covers/oriental-organ-piano.jpg',
    tags: ['أورج', 'بيانو', 'مقامات', 'ربع تون'],
    settings: { threeD: false, needsAudio: true, markCorner: 'bottom-left' },
  },
];

// ---------- دوال مساعدة (تُستعمل في الخادم والواجهة) ----------
const ID_RE = /^[a-z0-9][a-z0-9-]{0,62}$/;

export function isValidGameId(id) {
  return typeof id === 'string' && ID_RE.test(id);
}

export function getGame(id) {
  if (!isValidGameId(id)) return null;
  return VIRTUAL_GAMES.find((g) => g.id === id) || null;
}

/** نسخة آمنة للعرض في المتصفح: لا مسارات داخلية ولا إعدادات خادم. */
export function publicGameInfo(g) {
  return {
    id: g.id, title: g.title, description: g.description, category: g.category,
    grade: g.grade || null, status: g.status, cover: g.cover || null, tags: g.tags || [],
    threeD: !!(g.settings && g.settings.threeD),
    allowDownloads: !!(g.settings && g.settings.allowDownloads),
  };
}
