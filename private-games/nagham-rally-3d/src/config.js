// =====================================================================
//  إعدادات الشخصية في «رالي النغم»: النموذج نفسه المستخدم في الأورج ثلاثي الأبعاد (_shared/3d)،
//  بالربط نفسه لعظام MakeHuman. لا يُعدَّل أي ملف مشترك: الزي العماني يُفصَّل كما هو ثم تُلبَس فوقه
//  بدلة القيادة والخوذة والقفازات من وحدة مستقلة (src/character/racewear.js).
// =====================================================================
export const CONFIG = {
  modelUrl: './_shared/3d/models/character-girl.fbx',
  height: 1.60,
  autoScale: true,
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
  // الزي العماني الأصلي يُفصَّل أولًا (بالألوان التي تتحول بعدها إلى بدلة القيادة) — انظر racewear.js
  outfit: {
    enabled: true,
    dishdasha: '#1d4f8f', embroidery: '#f2c14e', embroidery2: '#ffffff', sirwal: '#173f73',
    lihaf: '#24385f', lihafBorder: '#f2c14e',
  },
  male: {
    gender: 'male',
    height: 1.72,
    morphUrl: './_shared/3d/models/character-male-morph.json',
    outfit: { style: 'male', dishdasha: '#f1eee7', embroidery: '#d9cfb8', embroidery2: '#a99b7c', masar: ['#ece3cf', '#8b2d3a', '#2f6170'], tassel: '#ebe5d6' },
  },
};

// ألوان بدلة القيادة لكل شخصية (قابلة للتوسع لاحقًا إلى خزانة ملابس يختار منها الطالب)
export const SUITS = {
  female: { base: '#1f5fae', stripe: '#f2c14e', accent: '#ffffff', glove: '#26303f', helmet: '#f4f6fb', helmetStripe: '#1f5fae', visor: '#20324f' },
  male:   { base: '#c8323a', stripe: '#ffffff', accent: '#1f2a3a', glove: '#1f2a3a', helmet: '#ffffff', helmetStripe: '#c8323a', visor: '#2a2f3a' },
};
