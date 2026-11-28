// =====================================================================
//  «رحلة عُمان»: نظام جغرافي واحد — محطات متتابعة من صلالة جنوبًا إلى دبا شمالًا.
//  المعلم يختار محطة الانطلاق ومحطة الوصول فقط، والرحلة تُبنى تلقائيًا من المحطات الواقعة بينهما بهذا الترتيب.
//  كل محطة = بيانات مستقلة (الجو والأرض والبحر والجبال والمباني والنباتات والمعالم وشكل الطريق والصوت مستقبلًا).
//  لإضافة محطة: أضف عنصرًا في STATIONS واسمها في موضعها من ORDER — لا حاجة لتعديل بقية العالم.
//
//  المسار المعتمد (والبحر عن يمين المتجه شمالًا في كل المحطات الساحلية):
//    صلالة ← مرباط ← الدقم ← الأشخرة ← صور ← قريات ← مطرح ← الخوير (وزارة التعليم، الجامع الأكبر) ← برج الصحوة (الموالح) ← السيب ← صحار ← شناص ← مدحاء ← دبا
//    • الطريق الساحلي من صلالة حتى مسقط، ثم طريق الباطنة (رقم ١) حتى صحار.
//    • برج الصحوة في الموالح (ولاية السيب) يسبق مركز السيب للقادم من مسقط.
//    • البريمي فرع داخلي من صحار عبر وادي الجزي: تدخل الرحلة فقط إذا كانت محطة انطلاق أو وصول.
//    • مدحاء ودبا يُوصل إليهما في الواقع عبر أراضي دولة الإمارات؛ اللعبة لا تصوّر ذلك الجزء (انتقال بين محطتين).
//    • «آدم» على الطريق الداخلي (صلالة – هيماء – آدم – نزوى) فليست على هذا المسار.
//
//  المعلم في marks: [النوع, البعد عن بداية المحطة بالمتر, الجهة (−1 يسار، 1 يمين، 0 على محور الطريق), الارتداد عن حافة الطريق,
//                    المقياس, الارتفاع, اللقطة السينمائية ('drone' | 'side' | null), خيارات]
//  road: [شدّة المنعطفات, شدّة الصعود والهبوط] — gate: أول مفترق أسئلة في المحطة يظهر على هيئة بوابة ولاية عُمانية
// =====================================================================
const RW = 13.6;                                   // عرض الطريق (4 حارات × 3.4)
const base = { omani: true, station: true, sun: '#fff3da', sunI: 2.7, hemi: ['#e6f2ff', '#7a6448', 1.22], side: 'pavers', audio: null, road: [1, 1] };
const BROWN = ['#6a5242', '#a48a70', '#4b3a2f'], DUNE = ['#d2a85e', '#efd596', '#b98c48'], DARK = ['#54433a', '#8d7461', '#3b2e28'];

export const STATIONS = {
  salalah: { ...base, name: 'صلالة', en: 'Salalah', sky: ['#6f93b5', '#c9d9e2', '#e6ebe4'], fog: '#dde6e2', ground: '#86a25c', sunI: 2.25, hemi: ['#eef4f2', '#5f7048', 1.32], road: [1.3, 1.5],
    env: { sea: { side: 1, color: 0x3a9bb5, edge: 17, sand: '#e6dab8' }, mount: ['#4f6f47', '#7c9c66', '#3f6038', '#6f9358'], fogFar: 0.8,
      ridges: [[-1, RW / 2 + 40, 20, 46, 11, ['#3f6a35', '#7da35c', '#2f5229']]],
      build: { sides: [-1], stone: 0, white: 5, every: 92 }, palms: { count: 34, sc: 1.25 }, bushes: { sides: [-1], n: 46, color: '#4d8a3c' }, beds: [],
      C: 760, marks: [['bbQ', 150, -1, 9, 1, 0, 'portrait'], ['kiosk', 330, -1, 6.5], ['kiosk', 560, 1, 6.5]] } },
  // مرباط: البحر عن اليمين وجبل سمحان عن اليسار، وقلعة مرباط التاريخية
  mirbat: { ...base, gate: true, name: 'مرباط', en: 'Mirbat', sky: ['#5c8fc0', '#bcd6e6', '#e8e6da'], fog: '#dbe3e2', ground: '#a7a07a', sunI: 2.4, hemi: ['#eef3f2', '#6a6a4c', 1.28], road: [1.1, 1.0],
    env: { sea: { side: 1, color: 0x2f8fb0, edge: 17, sand: '#e2d6b4' }, mount: ['#6f6a52', '#8f8a6c', '#5d5944', '#7e7a5e'], mountK: 1.1,
      ridges: [[-1, RW / 2 + 70, 34, 80, 15, ['#5f6248', '#8e8c68', '#4b4d39']]],
      build: { sides: [-1], stone: 3, white: 7, every: 70 }, palms: { count: 18 }, bushes: { sides: [-1], n: 18, color: '#6b8a4a' }, beds: [],
      C: 800, marks: [['castle', 200, -1, 14, 1, 0, 'drone'], ['dhow', 430, 1, 44, 1, -0.6], ['kiosk', 560, -1, 6.5]] } },
  duqm: { ...base, gate: true, name: 'الدقم', en: 'Duqm', sky: ['#3c86cf', '#aad3f2', '#efe3c8'], fog: '#dfe6e6', ground: '#d8c8a6', sunI: 2.9, road: [0.5, 0.5],
    env: { sea: { side: 1, color: 0x2478b0, edge: 20, sand: '#dccfae' }, mount: ['#a89678', '#c2b294', '#9a8669', '#b8a583'], mountK: 0.42,
      ridges: [[-1, RW / 2 + 130, 9, 22, 5, ['#a8946f', '#cdbb98', '#8d7a5a']]],
      build: { sides: [-1], stone: 0, white: 5, every: 92 }, palms: { count: 8, sc: 0.9 }, rocks: { sides: [-1, 1], n: 20 }, beds: [],
      C: 800, marks: [['port', 250, 1, 58, 1, 0, 'drone'], ['kiosk', 520, -1, 6.5]] } },
  ashkharah: { ...base, name: 'الأشخرة', en: 'Al Ashkharah', sky: ['#3a8ad4', '#b4dbf6', '#f3e4c0'], fog: '#e6e2cf', ground: '#e2c891', sunI: 2.95, road: [0.9, 1.6],
    env: { sea: { side: 1, color: 0x2a8fb8, edge: 19, sand: '#ecd9a6' }, mount: ['#d2b477', '#e6cf99', '#c9a565', '#e0c488'], mountK: 0.35,
      ridges: [[-1, RW / 2 + 34, 8, 22, 21, DUNE], [-1, RW / 2 + 120, 14, 30, 23, DUNE]],
      build: { sides: [-1], stone: 0, white: 4, every: 115 }, palms: { count: 10 }, beds: [],
      C: 800, marks: [['dhow', 180, 1, 42, 1, -0.6, 'drone'], ['kiosk', 330, -1, 6.5], ['dhow', 560, 1, 60, 1.1, -0.6]] } },
  sur: { ...base, gate: true, name: 'صور', en: 'Sur', sky: ['#2f84d6', '#a6d6f5', '#efe5cc'], fog: '#d5e6ef', ground: '#dcc9a0', road: [0.8, 0.6],
    env: { sea: { side: 1, color: 0x1f9fb4, edge: 18, sand: '#e6d7b2' }, mount: ['#8b7a68', '#a8957f', '#7a6a58', '#9d8a72'], mountK: 0.6,
      ridges: [[-1, RW / 2 + 170, 16, 38, 9, BROWN]],
      build: { sides: [-1], stone: 6, white: 12, every: 38 }, palms: { count: 20 }, beds: [-1],
      street: [-1], C: 1100, marks: [['dhowYard', 70, 1, 9], ['bridge', 290, 0, 0, 1, 0, 'drone', { zone: 180 }], ['bbH', 520, -1, 9, 1, 0, 'portrait'], ['dhow', 640, 1, 46, 1, -0.6], ['castle', 760, -1, 14], ['lighthouse', 860, 1, 11], ['kiosk', 960, -1, 6.5]] } },
  quriyat: { ...base, gate: true, name: 'قريات', en: 'Quriyat', sky: ['#2f80d2', '#a3d0f3', '#e9dcc6'], fog: '#cfdfec', ground: '#c7ad88', road: [1.6, 1.7],
    env: { sea: { side: 1, color: 0x1b5f9c, edge: 15, sand: '#d8c7a4' }, mount: ['#6b574a', '#8a7361', '#54433a', '#7d6756'], mountK: 1.25,
      ridges: [[-1, RW / 2 + 44, 34, 78, 31, DARK], [-1, RW / 2 + 150, 50, 95, 33, DARK]],
      build: { sides: [-1], stone: 0, white: 5, every: 92 }, palms: { count: 16 }, rocks: { sides: [1], n: 14 }, beds: [],
      C: 800, marks: [['dhow', 200, 1, 44, 1, -0.6, 'drone'], ['kiosk', 360, -1, 6.5]] } },
  muttrah: { ...base, name: 'مسقط – مطرح', en: 'Muttrah', sky: ['#2a7fd6', '#9fd1f6', '#eadfca'], fog: '#cde2f2', ground: '#c9ae86', road: [1.1, 0.7],
    env: { sea: { side: 1, color: 0x1d62a8, edge: 13.5, prom: true }, ridges: [[-1, RW / 2 + 62, 36, 72, 7, BROWN]],
      build: { sides: [-1], stone: 12, white: 12, every: 36 }, palms: { count: 22 }, beds: [-1],
      street: [-1], C: 1100, marks: [['gate', 110, 0, 0, 1, 0, 'drone'], ['fort', 260, -1, 34], ['twin', 380, -1, 9, 1, 0, 'portrait'], ['cruise', 520, 1, 50, 1, -0.6, 'drone'], ['souq', 640, -1, 9], ['ship', 760, 1, 78, 1, -0.6], ['blueMosque', 840, -1, 10], ['kiosk', 960, -1, 6.5]] } },
  oman: { ...base, name: 'مسقط – الخوير', en: 'Al Khuwair', sky: ['#2f7fd0', '#a8d4f5', '#f4e6c8'], fog: '#cfe3f2', ground: '#cdb48a', road: [0.6, 0.5],
    env: { ridges: [[-1, RW / 2 + 190, 28, 66, 5, BROWN]], mount: null,
      build: { sides: [-1, 1], stone: 12, white: 12, every: 36 }, palms: { count: 28 }, beds: [-1, 1],
      // وزارة التعليم (مقرّها في مسقط) ثم جامع السلطان قابوس الأكبر (بوشر) عن يسار المتجه غربًا
      street: [-1, 1], C: 1100, marks: [['ministry', 150, -1, 13, 1, 0, 'drone', { zone: 100 }], ['kiosk', 330, 1, 6.5], ['mosque', 470, -1, 42, 0.8, 0, 'drone'], ['flagpole', 700, 1, 9], ['kiosk', 860, -1, 6.5]] } },
  seeb: { ...base, name: 'السيب', en: 'Al Seeb', sky: ['#2f7fd0', '#a8d4f5', '#f4e6c8'], fog: '#cfe3f2', ground: '#cdb690', road: [0.5, 0.4],
    env: { ridges: [[-1, RW / 2 + 215, 26, 62, 45, BROWN]],
      build: { sides: [-1, 1], stone: 6, white: 8, every: 58 }, palms: { count: 34 }, beds: [-1, 1],
      // تقاطع علوي على الطريق السريع: السيارة تعبر الجسر وحركة المرور (حافلات مواصلات وسيارات الأجرة) تمر من تحته
      street: [-1, 1], C: 1000, marks: [['flyover', 240, 0, 0, 1, 0, 'drone', { zone: 96 }], ['kiosk', 470, 1, 6.5], ['kiosk', 760, -1, 6.5]] } },
  sahwa: { ...base, name: 'برج الصحوة', en: 'Burj Al Sahwa', sky: ['#2f7fd0', '#a8d4f5', '#f4e6c8'], fog: '#cfe3f2', ground: '#7fa253', road: [0.4, 0.3],
    env: { ridges: [[-1, RW / 2 + 210, 26, 60, 4, BROWN]],
      build: { sides: [-1, 1], stone: 3, white: 3, every: 150 }, palms: { count: 46, x0: 7, spread: 9 }, beds: [-1, 1],
      C: 1000, marks: [['sahwa', 235, 0, 0, 1, 0, 'drone', { slide: RW / 2 + 6 + 38.5, zone: 95 }], ['kiosk', 560, 1, 6.5], ['kiosk', 800, -1, 6.5]] } },
  sohar: { ...base, gate: true, name: 'صحار', en: 'Sohar', sky: ['#3585d2', '#aad5f5', '#f0e6cc'], fog: '#d6e5ee', ground: '#cdb98f', road: [0.4, 0.3],
    env: { sea: { side: 1, color: 0x1f6aa8, edge: 19, sand: '#e2d3ae' }, mount: ['#8a7767', '#a5917e', '#786656', '#978370'], mountK: 0.7,
      ridges: [[-1, RW / 2 + 220, 22, 52, 41, BROWN]],
      build: { sides: [-1], stone: 5, white: 10, every: 46 }, palms: { count: 44, sides: [-1], x0: 5, spread: 7 }, beds: [-1],
      street: [-1], C: 900, marks: [['port', 220, 1, 58, 1, 0, 'drone'], ['bbQ', 450, -1, 9, 1, 0, 'portrait'], ['kiosk', 620, -1, 6.5]] } },
  buraimi: { ...base, gate: true, name: 'البريمي', en: 'Al Buraimi', sky: ['#3888d6', '#b2d9f6', '#f2dfba'], fog: '#e3dccb', ground: '#d6b184', sunI: 2.95, road: [1.2, 1.3],
    env: { mount: ['#9c8168', '#b89c80', '#86694f', '#ad9072'], mountK: 0.9,
      ridges: [[-1, RW / 2 + 120, 22, 56, 51, ['#8a6c50', '#c4a47f', '#6a5038']], [1, RW / 2 + 150, 20, 50, 53, ['#8a6c50', '#c4a47f', '#6a5038']]],
      build: { sides: [-1, 1], stone: 4, white: 8, every: 58 }, palms: { count: 30 }, beds: [-1, 1],
      street: [-1, 1], C: 900, marks: [['castle', 200, -1, 14, 1, 0, 'drone'], ['bbH', 420, 1, 9, 1, 0, 'portrait'], ['kiosk', 600, 1, 6.5]] } },
  shinas: { ...base, name: 'شناص', en: 'Shinas', sky: ['#3585d2', '#aad5f5', '#eee6cf'], fog: '#d4e6ee', ground: '#cdbb92', road: [0.6, 0.4],
    env: { sea: { side: 1, color: 0x2a86a8, edge: 16, sand: '#e4d6b2' }, mount: ['#877565', '#a28e7b', '#756353', '#948070'], mountK: 0.8,
      ridges: [[-1, RW / 2 + 200, 24, 58, 61, BROWN]],
      build: { sides: [-1], stone: 0, white: 8, every: 58 }, palms: { count: 40, sides: [-1], x0: 5, spread: 8 }, bushes: { sides: [1], n: 30, color: '#3f7f4a', near: 6 }, beds: [],
      C: 800, marks: [['dhow', 190, 1, 42, 1, -0.6], ['kiosk', 340, -1, 6.5], ['dhow', 600, 1, 52, 0.9, -0.6]] } },
  madha: { ...base, name: 'مدحاء', en: 'Madha', sky: ['#2f80d2', '#a3d0f3', '#e9dcc6'], fog: '#d3dde3', ground: '#bfa583', road: [1.8, 1.8],
    env: { mount: ['#5f4f45', '#7f6a5b', '#4a3c34', '#6f5c4e'], mountK: 1.4,
      ridges: [[-1, RW / 2 + 46, 36, 80, 71, DARK], [1, RW / 2 + 54, 34, 76, 73, DARK]],
      build: { sides: [-1, 1], stone: 0, white: 5, every: 92 }, palms: { count: 40, x0: 5, spread: 6 }, beds: [],
      C: 800, marks: [['kiosk', 300, -1, 6.5]] } },
  diba: { ...base, gate: true, name: 'دبا', en: 'Dibba', sky: ['#2b7ed4', '#9fd0f5', '#e6dccb'], fog: '#cbdcea', ground: '#c6ae8a', road: [1.3, 1.2],
    env: { sea: { side: 1, color: 0x1a5fa6, edge: 15, sand: '#dccaa4' }, mount: ['#5a4b42', '#7a6657', '#463a33', '#6c5a4d'], mountK: 1.6,
      ridges: [[-1, RW / 2 + 58, 46, 100, 81, DARK], [-1, RW / 2 + 170, 60, 110, 83, DARK]],
      build: { sides: [-1], stone: 4, white: 10, every: 46 }, palms: { count: 24 }, beds: [-1],
      C: 900, marks: [['dhow', 200, 1, 42, 1, -0.6, 'drone'], ['twin', 420, -1, 9, 1, 0, 'portrait'], ['kiosk', 580, -1, 6.5], ['dhow', 700, 1, 56, 1.1, -0.6]] } },
};
/** الترتيب الجغرافي المعتمد من الجنوب إلى الشمال */
export const ORDER = ['salalah', 'mirbat', 'duqm', 'ashkharah', 'sur', 'quriyat', 'muttrah', 'oman', 'sahwa', 'seeb', 'sohar', 'buraimi', 'shinas', 'madha', 'diba'];
/** محطات فرعية خارج الطريق الساحلي: لا تُمرّ بها الرحلة إلا إذا كانت محطة انطلاق أو وصول */
const BRANCH = { buraimi: true };
/** عناوين اللقطات السينمائية (معلومات موثوقة فقط: اسم المعلم وولايته) */
const CAPTIONS = {
  'salalah:bbQ': 'السلطان قابوس بن سعيد – طيّب الله ثراه', 'sohar:bbQ': 'السلطان قابوس بن سعيد – طيّب الله ثراه',
  'sur:bbH': 'حضرة صاحب الجلالة السلطان هيثم بن طارق المعظم', 'buraimi:bbH': 'حضرة صاحب الجلالة السلطان هيثم بن طارق المعظم',
  'muttrah:twin': 'صاحبا الجلالة – السلطان قابوس بن سعيد (طيّب الله ثراه) والسلطان هيثم بن طارق المعظم', 'diba:twin': 'صاحبا الجلالة – السلطان قابوس بن سعيد (طيّب الله ثراه) والسلطان هيثم بن طارق المعظم',
  'mirbat:castle': 'قلعة مرباط – ولاية مرباط', 'duqm:port': 'ميناء الدقم – محافظة الوسطى',
  'sur:bridge': 'جسر خور البطح (العيجة) – ولاية صور', 'muttrah:gate': 'بوابة مسقط – الطريق إلى كورنيش مطرح',
  'muttrah:cruise': 'ميناء السلطان قابوس – ولاية مطرح', 'oman:ministry': 'وزارة التعليم – مسقط',
  'oman:mosque': 'جامع السلطان قابوس الأكبر – ولاية بوشر', 'sahwa:sahwa': 'برج الصحوة – الموالح، ولاية السيب',
  'seeb:flyover': 'تقاطع علوي على الطريق السريع – ولاية السيب', 'sohar:port': 'ميناء صحار – ولاية صحار',
  'buraimi:castle': 'حصن عُماني – محافظة البريمي', 'diba:dhow': 'ساحل دبا – محافظة مسندم',
};
export const captionFor = (station, key) => CAPTIONS[`${station}:${key}`] || '';
export const DEFAULT_FROM = 'salalah', DEFAULT_TO = 'diba';

/** المحطات الواقعة بين الانطلاق والوصول بالترتيب الجغرافي. flip: الرحلة من الشمال إلى الجنوب (تنعكس الجهات: البحر عن اليسار) */
export function routeBetween(from, to) {
  let a = ORDER.indexOf(from), b = ORDER.indexOf(to);
  if (a < 0) a = 0; if (b < 0) b = ORDER.length - 1;
  const flip = a > b, ends = [ORDER[a], ORDER[b]];
  const ids = (flip ? ORDER.slice(b, a + 1).reverse() : ORDER.slice(a, b + 1)).filter((id) => !BRANCH[id] || ends.includes(id));
  return { ids, flip };
}
/** أولوية المحطة عند اختصار الرحلة (الأعلى يبقى): المحطات ذات المعالم البارزة أولًا */
const PRI = { sur: 5, muttrah: 5, sahwa: 5, oman: 5, seeb: 4, sohar: 4, duqm: 3, mirbat: 3, quriyat: 2, buraimi: 2, shinas: 1, ashkharah: 1, madha: 1, salalah: 3, diba: 3 };
/** إن كانت الرحلة أقصر من أن تتسع لكل المحطات: تبقى محطتا الانطلاق والوصول ثم أبرز المحطات بينهما، بالترتيب الجغرافي نفسه */
export function planStops(ids, count) {
  const n = Math.max(1, Math.min(ids.length, count | 0 || ids.length));
  if (n >= ids.length) return ids.slice();
  if (n === 1) return [ids[0]];
  const mid = ids.slice(1, -1).map((id, k) => ({ id, k })).sort((a, b) => (PRI[b.id] || 0) - (PRI[a.id] || 0) || a.k - b.k).slice(0, n - 2).sort((a, b) => a.k - b.k).map((x) => x.id);
  return [ids[0], ...mid, ids[ids.length - 1]];
}
/** بيانات المحطة كما تُبنى: نسخة معكوسة الجهات عند السير جنوبًا */
export function stationData(id, flip) {
  const T = STATIONS[id]; if (!flip) return T;
  const E = JSON.parse(JSON.stringify(T.env)), neg = (a) => a.map((s) => -s);
  if (E.sea) E.sea.side *= -1;
  for (const r of E.ridges || []) r[0] *= -1;
  for (const k of ['build', 'bushes', 'rocks', 'palms']) if (E[k] && E[k].sides) E[k].sides = neg(E[k].sides);
  if (E.beds) E.beds = neg(E.beds);
  if (E.street) E.street = neg(E.street);
  for (const m of E.marks || []) m[2] *= -1;
  return { ...T, env: E };
}
