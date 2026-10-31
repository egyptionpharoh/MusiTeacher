// rhythms.mjs — مكتبة الإيقاعات. بيانات خالصة (لا صوت ولا DOM) تختبرها tests/rhythms.test.mjs.
//
// الصيغة: كل إيقاع = دورة (beats وحدة × sub خطوة لكل وحدة)، وفيه مسارات (lanes):
//   dt  : الدربكة/الطبلة بالرموز المتعارفة   D = دُم (الضربة الغليظة في الوسط)   T = تَك (الحافة)   k = كا (تك خفيفة)   - = سكوت
//   kick / snare / hat / ohat / rim : طقم الطبول الغربي        x = ضربة   X = ضربة بنبر   - = سكوت
//   rah / kas / clap / tar / snj    : طبول الخليج (رحماني، كاسر، تصفيق، طار، صنوج) — تُستعمل في «إيقاعاتي» فقط
//
// مبدأ التوثيق: لا يدخل المكتبة إلا نمط اتفق عليه مصدران على الأقل في صيغته الأساسية:
//   [F] Michael Frishkopf, «Durub chart» (University of Alberta, rev. 2009) — sites.ualberta.ca/~michaelf/Theory/
//   [B] Baba Yaga Music, «Oriental dance rhythm diagrams and descriptions» — babayagamusic.com
//   [O] Iqa'at rhythm library — rythm.organology.net/rhythms
//   [W] Wikipedia, «Dumbek rhythms» (Ayyoub: D--kD-T-)
// الأنماط هنا الصيغة الأساسية للتعليم؛ العازف الحقيقي يزخرفها. «الحشوة» (fill) تنويع تعليمي من تأليف MusiTeacher.
//
// الفنون العُمانية والخليجية التراثية (الرزحة، العازي، العيالة، الرزفة…) لا تُختزل هنا في حلقة مختلَقة: لم نجد لها
// تدوينًا إيقاعيًا موثوقًا، والعازي نفسه شِعر منشَد بلا طبول. تُعرض بطاقات تعريفية موثّقة (HERITAGE)،
// ويستطيع المعلم إدخال نمط تحقق منه مع مختصين عبر «محرر الإيقاع» (طبول رحماني وكاسر وطار وتصفيق وصنوج).

export const GROUPS = Object.freeze([
  { id: 'egypt', ar: 'مصرية وعربية', icon: '🥁' },
  { id: 'classic', ar: 'عربية كلاسيكية', icon: '🎼' },
  { id: 'gulf', ar: 'خليجية', icon: '🌴' },
  { id: 'west', ar: 'غربية', icon: '🎹' },
  { id: 'mine', ar: 'إيقاعاتي', icon: '✍️' },
]);

const R = (o) => Object.freeze(o);

export const RHYTHMS = Object.freeze([
  // ------------------------------------------------------------ مصرية وعربية شائعة
  R({ id: 'maqsum', ar: 'مقسوم', en: 'Maqsum', group: 'egypt', beats: 4, sub: 2, meter: '4/4', bpm: 100,
      lanes: { dt: 'DT-TD-T-' }, src: ['F', 'B', 'O'],
      info: 'أشهر إيقاعات الأغنية المصرية والعربية: دُم تك – تك دُم – تك. يسمّى أيضًا «وحدة ونص».' }),
  R({ id: 'baladi', ar: 'بلدي (مصمودي صغير)', en: 'Baladi', group: 'egypt', beats: 4, sub: 2, meter: '4/4', bpm: 96,
      lanes: { dt: 'DD-TD-T-' }, src: ['F', 'B', 'O'],
      info: 'مثل المقسوم لكن بدُمّين في البداية: دُم دُم – تك دُم – تك. إيقاع شعبي مصري ثقيل.' }),
  R({ id: 'saidi', ar: 'صعيدي', en: "Sa'idi", group: 'egypt', beats: 4, sub: 2, meter: '4/4', bpm: 104,
      lanes: { dt: 'DT-DD-T-' }, src: ['F', 'B', 'O'],
      info: 'إيقاع صعيد مصر ورقصة التحطيب: دُم تك – دُم دُم – تك (الدُّمان المتتاليان علامته).' }),
  R({ id: 'fallahi', ar: 'فلاحي', en: 'Fallahi', group: 'egypt', beats: 2, sub: 4, meter: '2/4', bpm: 112,
      lanes: { dt: 'DT-TD-T-' }, src: ['F', 'B'],
      info: 'إيقاع الريف المصري السريع، صيغة سريعة مضغوطة من المقسوم في ميزان ثنائي.' }),
  R({ id: 'malfuf', ar: 'ملفوف', en: 'Malfuf', group: 'egypt', beats: 2, sub: 4, meter: '2/4', bpm: 108,
      lanes: { dt: 'D--T--T-' }, src: ['F', 'B', 'O'],
      info: 'إيقاع ثنائي سريع للمداخل والانتقالات: دُم – – تك – – تك.' }),
  R({ id: 'ayyub', ar: 'أيوب', en: 'Ayyub', group: 'egypt', beats: 2, sub: 4, meter: '2/4', bpm: 100,
      lanes: { dt: 'D--kD-T-' }, src: ['F', 'W', 'B'],
      info: 'إيقاع الزار والحلقات: دُم – – كا دُم – تك، يتكرر بإحساس دائري.' }),
  R({ id: 'wahda', ar: 'وحدة', en: 'Wahda', group: 'egypt', beats: 4, sub: 2, meter: '4/4', bpm: 80,
      lanes: { dt: 'D--T--T-' }, src: ['F', 'O'],
      info: 'إيقاع بطيء بدُم واحدة في أول الدورة، والتكّات بعدها اختيارية (تُكتب بين قوسين في جدول فريشكوبف).' }),
  // ------------------------------------------------------------ عربية كلاسيكية (الموشحات والسماعيات)
  R({ id: 'samai', ar: 'سماعي ثقيل', en: "Sama'i thaqil", group: 'classic', beats: 10, sub: 1, meter: '10/8', bpm: 160,
      lanes: { dt: 'D--T-DDT--' }, src: ['F', 'B'],
      info: 'إيقاع السماعيات والموشحات في عشر وحدات: دُم – – تك – دُم دُم تك – –.' }),
  // ------------------------------------------------------------ خليجية
  R({ id: 'khaliji', ar: 'خليجي', en: 'Khaliji', group: 'gulf', beats: 2, sub: 4, meter: '2/4', bpm: 92,
      lanes: { dt: 'D--D--T-', clap: '---x---x' }, src: ['F', 'B'],
      info: 'الإيقاع الخليجي الشائع في الأغنية الحديثة: دُم – – دُم – – تك، ويصاحبه التصفيق عادة. الفنون التراثية (الرزحة، العيالة…) في بطاقات «التراث العُماني والخليجي».' }),
  // ------------------------------------------------------------ غربية
  R({ id: 'pop', ar: 'بوب', en: 'Pop 8-beat', group: 'west', beats: 4, sub: 2, meter: '4/4', bpm: 100,
      lanes: { kick: 'X---x---', snare: '--x---x-', hat: 'xxxxxxxx' }, src: ['G'],
      info: 'النمط الأساسي للأغاني الحديثة: الطبلة الكبيرة على 1 و3، والسنير على 2 و4.' }),
  R({ id: 'rock', ar: 'روك', en: 'Rock', group: 'west', beats: 4, sub: 2, meter: '4/4', bpm: 116,
      lanes: { kick: 'X---xx--', snare: '--X---X-', hat: 'xxxxxxxx' }, src: ['G'],
      info: 'مثل البوب مع ضربة إضافية للطبلة الكبيرة قبل الوحدة الثالثة ونبر أقوى للسنير.' }),
  R({ id: 'waltz', ar: 'فالس', en: 'Waltz', group: 'west', beats: 3, sub: 2, meter: '3/4', bpm: 120,
      lanes: { kick: 'X-----', snare: '--x-x-', hat: 'x-x-x-' }, src: ['G'],
      info: 'الميزان الثلاثي: قوي – ضعيف – ضعيف («أُم – با – با»).' }),
  R({ id: 'march', ar: 'مارش', en: 'March', group: 'west', beats: 2, sub: 4, meter: '2/4', bpm: 112,
      lanes: { kick: 'X---x---', snare: '--x-x-xx' }, src: ['G'],
      info: 'الميزان الثنائي للمارش العسكري: قوي – ضعيف، مع لفّات السنير.' }),
  R({ id: 'bossa', ar: 'بوسا نوفا', en: 'Bossa Nova', group: 'west', beats: 4, sub: 4, meter: '4/4', bpm: 120,
      lanes: { kick: 'x--xx--xx--xx--x', rim: 'x--x--x---x--x--', hat: 'x-x-x-x-x-x-x-x-' }, src: ['G'],
      info: 'إيقاع برازيلي هادئ؛ ضربات الحافة تتبع نمط «الكلافي» 3–2.' }),
]);
export const RHYTHM_BY_ID = Object.freeze(Object.fromEntries(RHYTHMS.map((r) => [r.id, r])));

export const SOURCES = Object.freeze({
  F: 'Michael Frishkopf, Durub chart, University of Alberta (rev. 2009)',
  B: 'Baba Yaga Music — Oriental dance rhythm diagrams and descriptions',
  O: "Iqa'at rhythm library (rythm.organology.net)",
  W: 'Wikipedia — Dumbek rhythms',
  G: 'أنماط أساسية عامة في تعليم الطبول الغربية (ليست مقتبسة من مصدر بعينه)',
});

// بطاقات التراث (توثيق لا أنماط): المصادر مذكورة في كل بطاقة
export const HERITAGE = Object.freeze([
  { id: 'razha', ar: 'الرزحة', where: 'سلطنة عُمان',
    text: 'من «فنون السيف»: يقفز المؤدون بالسيوف ويتبادلون الشعر. يقود الإيقاعَ طبل «الرحماني» الذي يضع الإطار الإيقاعي، ويزخرفه طبل «الكاسر». تمر الرزحة بمراحل (الهمبل، القصافي والعازي، رزحة اللال، الوداعية) يتغير فيها الإيقاع سرعةً لا ميزانًا.',
    src: 'عصام الملاح وكاي فيكنتشر، Yearbook for Traditional Music 22 (1990)؛ جريدة عُمان «عن الضروب الإيقاعية المركبة»؛ Wikipedia: Music of Oman' },
  { id: 'azi', ar: 'العازي', where: 'سلطنة عُمان (اليونسكو 2012)',
    text: 'مسابقة شعرية يتبادل فيها الشاعر المنشد والجوقة الأبيات مع حركات السيف والخطو. لا يُذكر فيه طبل ولا آلة: هو فن صوتي منشَد، فلا يصح تمثيله بإيقاع طبول.',
    src: 'UNESCO — Al ‘azi, elegy, processional march and poetry (00850)؛ الجزيرة نت 2018' },
  { id: 'ayyala', ar: 'العيالة', where: 'شمال غرب عُمان والإمارات (اليونسكو 2014)',
    text: 'صفان متقابلان من الرجال بعصيّ الخيزران يحاكيان مشهد معركة، يتحركون بالرؤوس والعصيّ مع الإيقاع. بين الصفين طبول كبيرة وصغيرة ودفوف وصنوج نحاسية تضبط الإيقاع.',
    src: 'UNESCO — Al-Ayyala (01012)' },
  { id: 'razfa', ar: 'الرزفة', where: 'عُمان والإمارات (اليونسكو 2015)',
    text: 'صفان يتبادلان الغناء بقيادة المغني الرئيس، والراقصون بينهما ببنادق خشبية؛ تصاحبها الطبول وآلات أخرى.',
    src: 'UNESCO — Al-Razfa (01078)' },
  { id: 'drums', ar: 'الرحماني والكاسر', where: 'عُمان',
    text: 'تسمية الطبل في عُمان بوظيفته: «الرحماني» هو الطبل الذي يضع الإطار الإيقاعي، و«الكاسر» يملأ ويزخرف. وقد يصير الكاسر رحمانيًا إن أُضيف كاسر أصغر منه.',
    src: 'El-Mallah & Fikentscher (1990)؛ مسلم الكثيري، جريدة عُمان «كلام فنون»' },
]);

export const LANES = Object.freeze({
  dt: { ar: 'دربكة', tokens: { D: 'dum', T: 'tak', k: 'ka' } },
  kick: { ar: 'طبل كبير', tokens: { x: 'kick', X: 'kick' } },
  snare: { ar: 'سنير', tokens: { x: 'snare', X: 'snare' } },
  hat: { ar: 'هاي هات', tokens: { x: 'hat', X: 'hat' } },
  ohat: { ar: 'هاي هات مفتوح', tokens: { x: 'ohat', X: 'ohat' } },
  rim: { ar: 'حافة', tokens: { x: 'rim', X: 'rim' } },
  rah: { ar: 'رحماني', tokens: { x: 'rahmani', X: 'rahmani' } },
  kas: { ar: 'كاسر', tokens: { x: 'kasir', X: 'kasir' } },
  tar: { ar: 'طار', tokens: { x: 'tar', X: 'tar' } },
  clap: { ar: 'تصفيق', tokens: { x: 'clap', X: 'clap' } },
  snj: { ar: 'صنوج', tokens: { x: 'snj', X: 'snj' } },
  riq: { ar: 'رق', tokens: { x: 'riq', X: 'riq' } },
});

export const stepsOf = (r) => r.beats * r.sub;

/** أحداث الدورة: [{step, sound, vel}] مرتبة. accent للحرف الكبير في المسارات الغربية. */
export function eventsOf(r, { riq = false, variant = 'main' } = {}) {
  const n = stepsOf(r);
  const lanes = variant === 'fill' ? fillLanes(r) : r.lanes;
  const out = [];
  for (const [lane, str] of Object.entries(lanes)) {
    const L = LANES[lane];
    if (!L) throw new Error(`مسار غير معروف: ${lane}`);
    if (str.length !== n) throw new Error(`${r.id}/${lane}: طول ${str.length} لا يساوي ${n}`);
    [...str].forEach((ch, step) => {
      if (ch === '-') return;
      const sound = L.tokens[ch];
      if (!sound) throw new Error(`${r.id}/${lane}: رمز غير معروف «${ch}»`);
      const vel = ch === 'X' ? 1 : ch === 'k' ? 0.5 : lane === 'hat' ? 0.55 : 0.85;
      out.push({ step, sound, vel });
    });
  }
  // الرق المصاحب (اختياري): خشخشة على كل ثُمن، أقوى حيث تقع ضربة الدربكة
  if (riq && lanes.dt) {
    const per8 = Math.max(1, r.sub / 2);
    for (let s = 0; s < n; s += per8) out.push({ step: s, sound: 'riq', vel: lanes.dt[s] !== '-' ? 0.6 : 0.35 });
  }
  return out.sort((a, b) => a.step - b.step);
}

/** الحشوة: آخر وحدتين في الدورة تمتلئان بتكّات خفيفة (k) أو ضربات سنير — تنويع تعليمي من تأليف MusiTeacher. */
export function fillLanes(r) {
  const n = stepsOf(r), lastBeat = n - r.sub, fillFrom = Math.max(1, n - 2 * r.sub);
  const out = {};
  for (const [lane, str] of Object.entries(r.lanes)) {
    const a = [...str];
    if (lane === 'dt') for (let s = fillFrom; s < n; s++) if (a[s] === '-') a[s] = 'k';
    if (lane === 'snare') for (let s = lastBeat; s < n; s++) a[s] = 'x';
    if (lane === 'hat' || lane === 'clap') for (let s = lastBeat; s < n; s++) a[s] = '-';
    out[lane] = a.join('');
  }
  if (r.lanes.dt && r.sub >= 2) { const a = [...out.dt]; a[n - 1] = 'T'; out.dt = a.join(''); }
  return out;
}

/** التحقق من إيقاع يحرره المستخدم (محرر الإيقاع). يرجع نسخة نظيفة أو يرمي خطأ بالعربية. */
export function validateCustom(o) {
  if (!o || typeof o !== 'object') throw new Error('بيانات الإيقاع غير صالحة');
  const name = String(o.ar || '').trim().slice(0, 40);
  if (!name) throw new Error('اكتب اسمًا للإيقاع');
  const beats = Number(o.beats), sub = Number(o.sub);
  if (!Number.isInteger(beats) || beats < 2 || beats > 16) throw new Error('عدد الوحدات من 2 إلى 16');
  if (![1, 2, 3, 4].includes(sub)) throw new Error('التقسيم 1 أو 2 أو 3 أو 4');
  const lanes = {};
  for (const [lane, str] of Object.entries(o.lanes || {})) {
    if (!LANES[lane]) throw new Error(`مسار غير معروف: ${lane}`);
    const s = String(str);
    if (s.length !== beats * sub) throw new Error(`مسار ${LANES[lane].ar}: الطول يجب أن يكون ${beats * sub}`);
    const allowed = new Set(['-', ...Object.keys(LANES[lane].tokens)]);
    for (const ch of s) if (!allowed.has(ch)) throw new Error(`مسار ${LANES[lane].ar}: رمز غير مسموح «${ch}»`);
    if (/[^-]/.test(s)) lanes[lane] = s;
  }
  if (!Object.keys(lanes).length) throw new Error('الإيقاع فارغ');
  const bpm = Math.round(Number(o.bpm) || 90);
  return {
    id: 'u-' + (o.id && /^u-[a-z0-9]+$/.test(o.id) ? o.id.slice(2) : Date.now().toString(36)),
    ar: name, en: '', group: 'mine', beats, sub, meter: `${beats}/${sub === 1 ? 8 : 4}`,
    bpm: Math.min(240, Math.max(40, bpm)), lanes, src: [], info: String(o.info || '').slice(0, 200), custom: true,
  };
}
