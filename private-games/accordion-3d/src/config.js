// إعدادات المشروع — عدّلي هذا الملف فقط عند تغيير النموذج.
export const CONFIG = {
  // مسار نموذج العازفة (GLB/FBX) نسبةً إلى index.html
  modelUrl: './_shared/3d/models/character-girl.fbx',
  fallbackModelUrl: null,
  // الطول الكلي للعازفة واقفة (مع غطاء الرأس) بالمتر. يُستخدم لتوحيد الحجم إن كان النموذج
  // مُصدَّرًا بوحدات مختلفة (سنتيمتر مثلًا). ضعي autoScale: false إن كان المقياس صحيحًا أصلًا.
  height: 1.60,
  autoScale: true,

  // إن لم يتعرّف النظام على أسماء العظام تلقائيًا، اربطيها يدويًا هنا. المفتاح: "L.hand" أو "R.index1" أو "head".
  // مثال: boneMap: { 'L.hand': 'Wrist_Left', 'R.thumb1': 'Thumb_01_R' }
   // ربط أسماء هيكل MakeHuman "Default" بالأسماء اللي البرنامج بيفهمها
  boneMap: {
    hips: 'root', spine: 'spine05', chest: 'spine03', upperChest: 'spine01', neck: 'neck01', head: 'head',
    'L.shoulder': 'clavicleL', 'L.upperArm': 'upperarm01L', 'L.lowerArm': 'lowerarm01L', 'L.hand': 'wristL',
    'R.shoulder': 'clavicleR', 'R.upperArm': 'upperarm01R', 'R.lowerArm': 'lowerarm01R', 'R.hand': 'wristR',
    'L.upperLeg': 'upperleg01L', 'L.lowerLeg': 'lowerleg01L', 'L.foot': 'footL', 'L.toes': 'toe1-1L',
    'R.upperLeg': 'upperleg01R', 'R.lowerLeg': 'lowerleg01R', 'R.foot': 'footR', 'R.toes': 'toe1-1R',
    'L.thumb1': 'finger1-1L', 'L.thumb2': 'finger1-2L', 'L.thumb3': 'finger1-3L',
    'L.index1': 'finger2-1L', 'L.index2': 'finger2-2L', 'L.index3': 'finger2-3L',
    'L.middle1': 'finger3-1L', 'L.middle2': 'finger3-2L', 'L.middle3': 'finger3-3L',
    'L.ring1': 'finger4-1L', 'L.ring2': 'finger4-2L', 'L.ring3': 'finger4-3L',
    'L.little1': 'finger5-1L', 'L.little2': 'finger5-2L', 'L.little3': 'finger5-3L',
    'R.thumb1': 'finger1-1R', 'R.thumb2': 'finger1-2R', 'R.thumb3': 'finger1-3R',
    'R.index1': 'finger2-1R', 'R.index2': 'finger2-2R', 'R.index3': 'finger2-3R',
    'R.middle1': 'finger3-1R', 'R.middle2': 'finger3-2R', 'R.middle3': 'finger3-3R',
    'R.ring1': 'finger4-1R', 'R.ring2': 'finger4-2R', 'R.ring3': 'finger4-3R',
    'R.little1': 'finger5-1R', 'R.little2': 'finger5-2R', 'R.little3': 'finger5-3R',
  },

  // الزي العماني يُفصَّل آليًا على جسم النموذج (للنماذج غير المرتدية ملابس، مثل MakeHuman).
  // إن كان نموذجك يرتدي الدشداشة واللحاف أصلًا فاجعلي enabled: false. الألوان قابلة للتغيير.
  outfit: {
    enabled: true,            // يُفصَّل الزي من شبكات النموذج (انظر src/character/outfit.js)
    dishdasha: '#7a1f2e',     // لون الدشداشة
    embroidery: '#d8b25a',    // التطريز الذهبي
    embroidery2: '#2f6b5a',   // خيط التطريز الثاني
    sirwal: '#1f4a44',        // السروال
    lihaf: '#1e2a45',         // اللحاف
    lihafBorder: '#c9a14a',   // حافة اللحاف حول الوجه
  },
};
