// voices.mjs — تعريف أصوات الأورج. كل صوت يذكر مصدره الحقيقي بأمانة: عينات مسجلة (مع الترخيص) أو نمذجة/تركيب برمجي.
//
// kind:  sample (عينات من مجلد samples/ أو _shared/samples/) | pluck (نمذجة فيزيائية) | synth (تركيب صوتي)
// modes: الأوضاع التي يظهر فيها الصوت أولًا (western = البيانو الغربي، eastern = الأورج الشرقي). كل الأصوات
//        متاحة في الوضعين عبر «كل الأصوات»، لكن كل وضع يعرض أصواته المناسبة أولًا.
// trim:  معايرة العلو بين الأصوات بالديسيبل (مقيسة في tests/browser: نغمة دو4 لكل صوت بالعلو نفسه تقريبًا)

export const LICENSES = Object.freeze({
  vcsl: { name: 'Versilian Community Sample Library (VCSL)', license: 'CC0 1.0 (ملكية عامة)', attribution: false, url: 'https://github.com/sgossner/VCSL' },
  vsco: { name: 'VSCO 2 Community Edition — Versilian Studios', license: 'CC0 1.0 (ملكية عامة)', attribution: false, url: 'https://github.com/sgossner/VSCO-2-CE' },
  fluid: { name: 'FluidR3_GM SoundFont — Frank Wen (عبر gleitz/midi-js-soundfonts)', license: 'MIT (حزمة Debian) / CC BY 3.0 (midi-js-soundfonts) — يلزم ذكر المصدر', attribution: true, url: 'https://github.com/gleitz/midi-js-soundfonts' },
  model: { name: 'نمذجة فيزيائية — برمجة MusiTeacher', license: 'من إنتاج المنصة', attribution: false },
  synth: { name: 'تركيب صوتي رقمي — برمجة MusiTeacher', license: 'من إنتاج المنصة', attribution: false },
});

const V = (o) => Object.freeze(o);
export const VOICES = Object.freeze({
  // ---------------------------------------------------------------- غربية
  piano: V({ ar: 'بيانو كبير', icon: '🎹', cat: 'keys', modes: ['western', 'eastern'], kind: 'sample', set: 'vcsl-piano', lic: 'vcsl',
    decay: 'piano', trim: -0.8, rev: 0.16, info: 'تسجيلات بيانو Steinway حقيقية: يبدأ قويًا ثم يخفت حتى لو بقي المفتاح مضغوطًا.' }),
  epiano: V({ ar: 'بيانو كهربائي', icon: '🎹', cat: 'keys', modes: ['western'], kind: 'sample', set: 'fr3-epiano', lic: 'fluid',
    decay: 'natural', trim: 6.1, rev: 0.14, chorus: 0.35, info: 'صوت البيانو الكهربائي (رودز) الدافئ.' }),
  organ: V({ ar: 'أورج كلاسيكي', icon: '🎛️', cat: 'organ', modes: ['western'], kind: 'synth', synth: 'drawbar', lic: 'synth',
    trim: 3.2, rev: 0.18, release: 0.03, info: 'أورج كهربائي كلاسيكي بطريقة «الدرابار»: جمع موجات جيبية لطبقات 16 و8 و4 أقدام… مع نقرة المفتاح المميزة. الطبقة الأساسية (8 أقدام) هي الأقوى فيطابق الصوت اسم المفتاح.' }),
  strings: V({ ar: 'وتريات', icon: '🎻', cat: 'strings', modes: ['western', 'eastern'], kind: 'sample', set: 'vsco-strings', lic: 'vsco',
    trim: -2.3, rev: 0.24, attack: 0.03, release: 0.25, info: 'مجموعة كمان وفيولا وتشيلو تعزف بالقوس: صوت مستمر ناعم.' }),
  violin: V({ ar: 'كمان', icon: '🎻', cat: 'strings', modes: ['western'], kind: 'sample', set: 'vsco-violin', lic: 'vsco',
    trim: -3.4, rev: 0.2, attack: 0.015, release: 0.14, info: 'كمان منفرد بالقوس مع اهتزاز طبيعي. أخفض نغمة حقيقية صول3.' }),
  flute: V({ ar: 'فلوت', icon: '🪈', cat: 'winds', modes: ['western'], kind: 'sample', set: 'fr3-flute', lic: 'fluid',
    trim: 5.8, rev: 0.22, attack: 0.02, release: 0.1, info: 'الفلوت الغربي المستعرض.' }),
  clarinet: V({ ar: 'كلارينيت', icon: '🎷', cat: 'winds', modes: ['western'], kind: 'sample', set: 'fr3-clarinet', lic: 'fluid',
    trim: 4.9, rev: 0.18, attack: 0.015, release: 0.08, info: 'آلة نفخ خشبية بريشة واحدة، صوت دافئ.' }),
  trumpet: V({ ar: 'ترومبيت', icon: '🎺', cat: 'winds', modes: ['western'], kind: 'sample', set: 'fr3-trumpet', lic: 'fluid',
    trim: 9.6, rev: 0.18, attack: 0.012, release: 0.08, info: 'آلة نفخ نحاسية لامعة.' }),
  sax: V({ ar: 'ساكسفون', icon: '🎷', cat: 'winds', modes: ['western'], kind: 'sample', set: 'fr3-altosax', lic: 'fluid',
    trim: 5.9, rev: 0.18, attack: 0.012, release: 0.08, info: 'ساكسفون ألتو.' }),
  guitar: V({ ar: 'جيتار كلاسيكي', icon: '🎸', cat: 'plucked', modes: ['western'], kind: 'sample', set: 'fr3-nylon', lic: 'fluid',
    decay: 'natural', trim: 10.5, rev: 0.16, info: 'جيتار بأوتار نايلون يُعزف بالأصابع.' }),
  bass: V({ ar: 'باص', icon: '🎸', cat: 'plucked', modes: ['western', 'eastern'], kind: 'sample', set: 'fr3-bass', lic: 'fluid',
    decay: 'natural', trim: 5.8, rev: 0.05, info: 'جيتار باص يُعزف بالأصابع — مناسب للجزء الأيسر عند تقسيم لوحة المفاتيح.' }),
  choir: V({ ar: 'كورال', icon: '🎤', cat: 'ensemble', modes: ['western'], kind: 'sample', set: 'fr3-choir', lic: 'fluid',
    trim: 6.0, rev: 0.3, attack: 0.08, release: 0.3, info: 'جوقة تغني «آه». طبقتها مضبوطة بقياس كل عينة (تعدد المغنين يجعلها أقل حدة من الآلات).' }),
  pad: V({ ar: 'باد دافئ', icon: '🌫️', cat: 'ensemble', modes: ['western'], kind: 'sample', set: 'fr3-pad', lic: 'fluid',
    trim: 9.2, rev: 0.32, attack: 0.12, release: 0.5, info: 'خلفية صوتية ناعمة مستمرة للمصاحبة.' }),
  // ---------------------------------------------------------------- شرقية
  eorgan: V({ ar: 'أورج شرقي', icon: '🎹', cat: 'organ', modes: ['eastern'], kind: 'synth', synth: 'eorgan', lic: 'synth',
    trim: -6.4, rev: 0.12, release: 0.09, info: 'الصوت الأصلي للنسخة الأولى من Oriental Maestro: موجة سن المنشار مع رجفة «فيبراتو» سريعة، محسَّن ليستمر ما دام المفتاح مضغوطًا.' }),
  accordion: V({ ar: 'أكورديون', icon: '🪗', cat: 'organ', modes: ['eastern', 'western'], kind: 'sample', set: 'accordion', shared: true, lic: 'fluid',
    trim: 2.9, rev: 0.12, attack: 0.02, release: 0.06, info: 'عينات أكورديون حقيقية (المكتبة المشتركة في MusiTeacher)، مع تصحيح طبقة كل عينة بالقياس (كانت أعلى بـ 4–9 سنتات).',
    centsFix: Object.freeze({"36": 8.2, "37": 8.3, "38": 8.4, "39": 8.4, "40": 8.7, "41": 8.7, "42": 8.8, "43": 9, "44": 8.8, "45": 8.7, "46": 9, "47": 8.8, "48": 8.8, "49": 8.9, "50": 8.9, "51": 8.8, "52": 8.9, "53": 9, "54": 9, "55": 8.9, "56": 8.9, "57": 8.9, "58": 9, "59": 9, "60": 8.9, "61": 5.1, "62": 5.2, "63": 5.2, "64": 5.2, "65": 5.3, "66": 5, "67": 4.8, "68": 4.7, "69": 4.6, "70": 4.7, "71": 4.9, "72": 4.9, "73": 3.5, "74": 3.9, "75": 3.7, "76": 3.6, "77": 4.2, "78": 4, "79": 6.5, "80": 6.4, "81": 6.3, "82": 6.5, "83": 6.4, "84": 6.4, "85": 5.5, "86": 5.5, "87": 5.5, "88": 6.1, "89": 5.6, "90": 5.2, "91": 6.1, "92": 6, "93": 5.9, "94": 5.3, "95": 7.1, "96": 6}) }),
  musette: V({ ar: 'أكورديون شرقي (موزيت)', icon: '🪗', cat: 'organ', modes: ['eastern'], kind: 'synth', synth: 'musette', lic: 'synth',
    trim: 2.1, rev: 0.1, release: 0.035, info: 'تركيب صوتي: ثلاث ريشات بفارق ضبط بسيط (موزيت) تعطي الارتعاش المميز للأكورديون في الموسيقى المصرية.' }),
  qanun: V({ ar: 'قانون', icon: '🪕', cat: 'plucked', modes: ['eastern'], kind: 'pluck', model: 'qanun', lic: 'model',
    trim: 5.0, rev: 0.14, info: 'نمذجة فيزيائية (ليست تسجيلًا): ثلاثة أوتار لكل نغمة تُنقر بالريشة فوق صندوق خشبي ورقائق جلد. يرن ثم يخفت وحده.' }),
  oud: V({ ar: 'عود', icon: '🪕', cat: 'plucked', modes: ['eastern'], kind: 'pluck', model: 'oud', lic: 'model',
    trim: 0.9, rev: 0.12, release: 0.2, info: 'نمذجة فيزيائية (ليست تسجيلًا): أوتار مزدوجة تُنقر بالريشة فوق صندوق العود؛ أدفأ وأقصر رنينًا من القانون.' }),
  nay: V({ ar: 'ناي', icon: '🎶', cat: 'winds', modes: ['eastern'], kind: 'synth', synth: 'nay', lic: 'synth',
    trim: -14.5, rev: 0.26, release: 0.07, info: 'تركيب صوتي للناي: نغمة نقية مع صوت النفَس، وانزلاق خفيف في البداية ورجفة بطيئة تظهر بعد لحظة. (لم نجد عينات ناي حرة الترخيص بجودة كافية.)' }),
  ekaman: V({ ar: 'كمان شرقي', icon: '🎻', cat: 'strings', modes: ['eastern'], kind: 'sample', set: 'vsco-violin', lic: 'vsco',
    style: 'eastern', trim: -3.4, rev: 0.22, attack: 0.02, release: 0.16,
    info: 'عينات الكمان نفسها بأسلوب شرقي: انزلاق بين النغمات المتصلة (حين يُضغط مفتاح قبل رفع السابق) ورجفة أوسع وأبطأ.' }),
});

export const CATEGORIES = Object.freeze([
  ['keys', 'لوحات المفاتيح'], ['organ', 'أورج وأكورديون'], ['strings', 'وتريات'], ['plucked', 'آلات نقر'],
  ['winds', 'آلات نفخ'], ['ensemble', 'جوقة وخلفيات'],
]);

/** أصوات وضع ما أولًا ثم بقية الأصوات. */
export function voicesFor(mode) {
  const ids = Object.keys(VOICES);
  return { primary: ids.filter((id) => VOICES[id].modes[0] === mode || VOICES[id].modes.includes(mode)), other: ids.filter((id) => !VOICES[id].modes.includes(mode)) };
}

export const DEFAULT_VOICE = Object.freeze({ western: 'piano', eastern: 'eorgan' });
