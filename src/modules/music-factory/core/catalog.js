// =====================================================================
// 🎼 كتالوج «مصنع الألحان»: كل الاختيارات الفنية في مكان واحد
// (تسميات عربية للواجهة + وصف إنجليزي لمحركات التوليد مثل Suno / ElevenLabs / Lyria)
// ملف نقي بلا اعتماديات: تستخدمه الواجهة والخادم معًا، ويُنقل كما هو إذا استقلت الأداة.
// المعرفة الموسيقية (الإيقاعات والمقامات والمشاعر) منقولة من مشروع Music Factory الأصلي.
// =====================================================================

export const SECTION_TYPES = [
  { id: 'intro', ar: 'المقدمة', en: 'Intro', hint: 'آهات أو سطر افتتاحي قبل الكوبليه الأول (اختياري)' },
  { id: 'verse', ar: 'كوبليه', en: 'Verse', hint: 'مقطع يحكي القصة ويتغير كلامه في كل مرة' },
  { id: 'pre_chorus', ar: 'تمهيد للمذهب', en: 'Pre-Chorus', hint: 'سطران يرفعان الإحساس قبل المذهب' },
  { id: 'chorus', ar: 'المذهب / اللازمة', en: 'Chorus', hint: 'الجزء الذي يتكرر ويُحفظ' },
  { id: 'bridge', ar: 'الجسر', en: 'Bridge', hint: 'مقطع مختلف لحنيًا قبل المذهب الأخير' },
  { id: 'interlude', ar: 'فاصل موسيقي', en: 'Instrumental Break', hint: 'عزف بدون غناء بين الأقسام' },
  { id: 'outro', ar: 'الخاتمة', en: 'Outro', hint: 'نهاية الأغنية (كلمات اختيارية)' },
];
export const SECTION_BY_ID = Object.fromEntries(SECTION_TYPES.map((s) => [s.id, s]));

export const MODES = [
  { id: 'song', ar: 'أغنية بغناء', icon: '🎤', desc: 'تلحين وغناء كلماتك مع توزيع موسيقي' },
  { id: 'instrumental', ar: 'موسيقى تصويرية', icon: '🎻', desc: 'موسيقى آلية بدون غناء (لمشهد أو فيديو أو نشاط)' },
];

export const GENRES = [
  { id: 'arabic_pop', ar: 'بوب عربي', group: 'عربي', tag: 'Modern Arabic Pop' },
  { id: 'tarab', ar: 'طرب كلاسيكي', group: 'عربي', tag: 'Classical Arabic Tarab, takht ensemble feel' },
  { id: 'shaabi', ar: 'شعبي', group: 'عربي', tag: 'Egyptian Shaabi folk-pop' },
  { id: 'khaleeji', ar: 'خليجي', group: 'عربي', tag: 'Khaleeji Gulf music' },
  { id: 'omani_folk', ar: 'فن عماني', group: 'عربي', tag: 'Omani traditional folk music, Omani percussion ensemble' },
  { id: 'ballad', ar: 'رومانسي هادئ', group: 'عربي', tag: 'Romantic Arabic Ballad' },
  { id: 'patriotic', ar: 'وطني', group: 'عربي', tag: 'Patriotic National Song, anthemic' },
  { id: 'children', ar: 'أغنية أطفال', group: 'عربي', tag: "Children's Song, simple catchy melody, playful" },
  { id: 'school', ar: 'نشيد مدرسي', group: 'عربي', tag: 'School anthem, bright choir, clear educational song' },
  { id: 'religious', ar: 'ديني / إنشاد', group: 'عربي', tag: 'Islamic Nasheed style, vocals and frame drums only' },
  { id: 'western_pop', ar: 'بوب غربي', group: 'عالمي', tag: 'Western Pop' },
  { id: 'rock', ar: 'روك', group: 'عالمي', tag: 'Rock' },
  { id: 'hiphop', ar: 'هيب هوب / راب', group: 'عالمي', tag: 'Hip-Hop' },
  { id: 'rnb', ar: 'آر أند بي', group: 'عالمي', tag: 'R&B' },
  { id: 'jazz', ar: 'جاز', group: 'عالمي', tag: 'Jazz' },
  { id: 'folk', ar: 'فولك / أكوستيك', group: 'عالمي', tag: 'Acoustic Folk' },
  { id: 'lofi', ar: 'لو-فاي', group: 'عالمي', tag: 'Lo-fi' },
  { id: 'edm', ar: 'إلكتروني', group: 'عالمي', tag: 'EDM, electronic dance' },
  { id: 'cinematic', ar: 'سينمائي', group: 'عالمي', tag: 'Cinematic Orchestral' },
];

export const LANGUAGES = [
  { id: 'egyptian', ar: 'مصري', tag: 'Egyptian Arabic vocals, Cairo accent' },
  { id: 'gulf', ar: 'خليجي', tag: 'Khaleeji Gulf Arabic vocals' },
  { id: 'omani', ar: 'عماني', tag: 'Omani Arabic dialect vocals' },
  { id: 'levantine', ar: 'شامي', tag: 'Levantine Arabic vocals' },
  { id: 'iraqi', ar: 'عراقي', tag: 'Iraqi Arabic vocals' },
  { id: 'maghrebi', ar: 'مغاربي', tag: 'Maghrebi Darija Arabic vocals' },
  { id: 'msa', ar: 'فصحى', tag: 'Modern Standard Arabic vocals, clear classical diction' },
  { id: 'english', ar: 'إنجليزي', tag: 'English vocals' },
  { id: 'french', ar: 'فرنسي', tag: 'French vocals' },
];

export const MOODS = [
  { id: 'joyful', ar: 'مبهج', icon: '😄', tag: 'Major key, Bright tonality, energetic atmosphere' },
  { id: 'danceable', ar: 'راقص', icon: '💃', tag: 'Upbeat groove, driving rhythm, festive vibe' },
  { id: 'festive', ar: 'احتفالي', icon: '🎉', tag: 'Celebratory mood, bright instruments' },
  { id: 'uplifting', ar: 'ملهم', icon: '🌅', tag: 'Motivational progression, inspiring melodies' },
  { id: 'romantic', ar: 'رومانسي', icon: '💗', tag: 'Soft emotional delivery, intimate acoustic phrasing' },
  { id: 'sad', ar: 'حزين', icon: '🌧️', tag: 'Minor key, Emotional depth, sorrowful strings' },
  { id: 'tragic', ar: 'مأساوي', icon: '🖤', tag: 'Dark cinematic tension, heavy emotional weight' },
  { id: 'nostalgic', ar: 'حنين', icon: '🕰️', tag: 'Vintage warmth, sentimental melodies' },
  { id: 'proud', ar: 'فخر واعتزاز', icon: '🏳️', tag: 'Epic orchestration, Intense delivery, grand scale' },
  { id: 'powerful', ar: 'قوي وحماسي', icon: '⚡', tag: 'Aggressive attack, loud brass/synth stabs' },
  { id: 'epic', ar: 'ملحمي', icon: '🏔️', tag: 'Massive soundscape, cinematic hits, triumphant' },
  { id: 'calm', ar: 'هادئ ومريح', icon: '🍃', tag: 'Calm and soothing, gentle dynamics, warm soft textures' },
];

// الإيقاعات بدون وسوم اللهجة (اللهجة تأتي من اختيار «اللغة» حتى لا تتعارض)
export const RHYTHMS = [
  { id: 'maqsum', ar: 'مقسوم', group: 'مصري', tag: 'Arabic Maqsum rhythm, authentic darbuka percussion, 4/4 groove', dialect: 'egyptian' },
  { id: 'saidi', ar: 'صعيدي', group: 'مصري', tag: 'Energetic Upper Egyptian Saidi beat, mizmar and heavy bass tabla', dialect: 'egyptian' },
  { id: 'fallahi', ar: 'فلاحي', group: 'مصري', tag: 'Fast Fellahi rhythm, rapid sharp tek accents', dialect: 'egyptian' },
  { id: 'baladi', ar: 'بلدي', group: 'مصري', tag: 'Traditional Baladi rhythm, double doum accents, warm accordion', dialect: 'egyptian' },
  { id: 'ayoub', ar: 'أيوب', group: 'مصري', tag: 'Fast Ayoub rhythm, zar percussion, frame drums', dialect: 'egyptian' },
  { id: 'mahraganat', ar: 'مهرجانات', group: 'مصري', tag: 'Mahraganat electro-shaabi style, distorted synth bass, autotuned street vocals', dialect: 'egyptian' },
  { id: 'fox', ar: 'فوكس', group: 'مصري', tag: 'Fox rhythm, steady 2/4 percussion, modern Arabic pop groove', dialect: 'egyptian' },
  { id: 'malfuf', ar: 'ملفوف', group: 'مصري', tag: 'Fast Malfuf rhythm, syncopated 2/4 beat', dialect: 'egyptian' },
  { id: 'razha', ar: 'رزحة', group: 'عماني', tag: 'Omani Razha celebration rhythm, Rahmani and Kaser drums, tribal call-and-response', dialect: 'omani' },
  { id: 'bara', ar: 'برعة', group: 'عماني', tag: "Dhofari Bar'a rhythm, synchronized Rahmani and Kaser drums", dialect: 'omani' },
  { id: 'pop_khaliji', ar: 'بوب خليجي / بندري', group: 'خليجي', tag: 'Khaleeji pop, Bandari rhythm, merwas clapping beat', dialect: 'gulf' },
  { id: 'samri', ar: 'سامري', group: 'خليجي', tag: 'Classic Khaleeji Samri rhythm, heavy frame drums, group clapping', dialect: 'gulf' },
  { id: 'dabke', ar: 'دبكة', group: 'شامي', tag: 'Levantine Dabke beat, mijwiz and tabl, stomp-heavy', dialect: 'levantine' },
  { id: 'wahda_kabira', ar: 'وحدة كبيرة', group: 'كلاسيكي', tag: 'Masmudi Kabir rhythm, wahda kabira beat, symphonic Arabic', dialect: 'msa' },
  { id: 'waltz', ar: 'فالس عربي', group: 'كلاسيكي', tag: 'Arabic waltz, 3/4 time, elegant swing', dialect: null },
  { id: 'school_march', ar: 'مارش مدرسي', group: 'كلاسيكي', tag: 'Heroic march, powerful choir, sharp trumpets, snare rolls', dialect: 'msa' },
  { id: 'military_march', ar: 'مارش عسكري', group: 'كلاسيكي', tag: 'Grand military march, majestic orchestra, snare drum rolls', dialect: 'msa' },
  { id: 'trap', ar: 'تراب', group: 'حديث', tag: 'Modern trap, 808 bass, dark synths, rap delivery', dialect: null },
  { id: 'none', ar: 'بدون إيقاع', group: 'حديث', tag: 'Free timing, ambient flow, no explicit percussion', dialect: null },
];

export const MAQAMS = [
  { id: 'Bayati', ar: 'بياتي', tag: 'Bayati maqam, microtonal oriental warmth, quarter-tone inflections', feel: 'دافئ وشعبي قريب من الناس' },
  { id: 'Rast', ar: 'راست', tag: 'Rast maqam, majestic Arabic scale, resonant quarter tones', feel: 'وقور وفخم' },
  { id: 'Ajam', ar: 'عجم', tag: 'Ajam maqam, bright major-scale energy, triumphant', feel: 'مشرق ومبهج' },
  { id: 'Nahawand', ar: 'نهاوند', tag: 'Nahawand maqam, romantic minor, smooth cinematic flow', feel: 'رومانسي حالم' },
  { id: 'Kurd', ar: 'كرد', tag: 'Kurd maqam, Phrygian minor, soft emotional oriental color', feel: 'عاطفي رقيق' },
  { id: 'Hijaz', ar: 'حجاز', tag: 'Hijaz maqam, exotic harmonic minor, spiritual desert tension', feel: 'روحاني وصحراوي' },
  { id: 'Saba', ar: 'صبا', tag: 'Saba maqam, lamenting microtonal tension, deep sorrow', feel: 'شجن وحزن عميق' },
  { id: 'Sikah', ar: 'سيكاه', tag: 'Sikah maqam, quarter-tone tonic, authentic Tarab color', feel: 'طربي أصيل' },
];

export const VOCALS = [
  { id: 'male', ar: 'صوت رجالي', tag: 'Male vocal' },
  { id: 'female', ar: 'صوت نسائي', tag: 'Female vocal' },
  { id: 'duet', ar: 'دويتو (رجل وامرأة)', tag: 'Male and female duet vocals' },
  { id: 'boy', ar: 'صوت طفل', tag: 'Young boy vocal' },
  { id: 'girl', ar: 'صوت طفلة', tag: 'Young girl vocal' },
  { id: 'kids_choir', ar: 'كورال أطفال', tag: 'Children choir' },
  { id: 'group', ar: 'كورال جماعي', tag: 'Group vocal harmony, choir' },
  { id: 'male_choir', ar: 'كورال رجالي', tag: 'Male choir' },
  { id: 'tarab_singer', ar: 'مطرب طربي', tag: 'Expressive tarab vocalist, melismatic ornaments' },
  { id: 'soft', ar: 'غناء هامس ناعم', tag: 'Soft breathy intimate vocal' },
];

export const TEMPOS = [
  { id: 'slow', ar: 'بطيء', bpm: 72, tag: 'Slow tempo' },
  { id: 'medium', ar: 'متوسط', bpm: 100, tag: 'Mid-tempo' },
  { id: 'fast', ar: 'سريع', bpm: 126, tag: 'Fast tempo' },
];

export const INTROS = [
  { id: 'auto', ar: 'تلقائي (حسب اللحن)', cue: '' },
  { id: 'long', ar: 'مقدمة موسيقية طويلة', cue: 'long instrumental intro, extended build-up' },
  { id: 'sudden', ar: 'دخول مباشر بالغناء', cue: 'no intro, vocals start immediately' },
  { id: 'build', ar: 'بناء تدريجي', cue: 'gradual crescendo intro' },
  { id: 'percussive', ar: 'مقدمة إيقاعية', cue: 'percussive intro, drum groove start' },
  { id: 'vocal', ar: 'آهات / كورال', cue: 'vocal intro, choir ad-libs' },
  { id: 'solo', ar: 'تقسيم منفرد', cue: 'solo instrumental taqsim intro' },
];

export const OUTROS = [
  { id: 'auto', ar: 'تلقائي', cue: '' },
  { id: 'fade', ar: 'انسحاب هادئ (تلاشي)', cue: 'smooth fade out' },
  { id: 'stop', ar: 'قفلة حاسمة', cue: 'sudden stop, decisive ending' },
  { id: 'epic', ar: 'نهاية فخمة', cue: 'grand epic finale' },
  { id: 'soft', ar: 'نهاية ناعمة', cue: 'soft gentle landing' },
  { id: 'crescendo', ar: 'تصاعد حماسي', cue: 'building intensity to a final peak' },
  { id: 'vocal', ar: 'ارتجال غنائي', cue: 'vocal ad-libs fade out' },
  { id: 'solo', ar: 'عزف منفرد', cue: 'instrumental solo coda' },
];

export const INSTRUMENT_GROUPS = [
  { id: 'arabic', ar: 'آلات عربية', items: [['Oud', 'عود'], ['Qanun', 'قانون'], ['Ney', 'ناي'], ['Kawala', 'كولة'], ['Buzuq', 'بزق'], ['Arabic Violin', 'كمان شرقي']] },
  { id: 'strings', ar: 'وتريات', items: [['Violins', 'كمانات'], ['Cello', 'تشيلو'], ['Double Bass', 'كونترباص'], ['Harp', 'هارب'], ['String Orchestra', 'أوركسترا وتريات']] },
  { id: 'keys', ar: 'مفاتيح', items: [['Grand Piano', 'بيانو'], ['Electric Piano', 'بيانو كهربائي'], ['Accordion', 'أكورديون'], ['Oriental Organ', 'أورج شرقي'], ['Synthesizer', 'سنثسايزر'], ['Pads', 'خلفيات صوتية']] },
  { id: 'guitars', ar: 'جيتار وباص', items: [['Acoustic Guitar', 'جيتار أكوستيك'], ['Electric Guitar', 'جيتار كهربائي'], ['Bass Guitar', 'باص جيتار']] },
  { id: 'winds', ar: 'نفخ', items: [['Flute', 'فلوت'], ['Clarinet', 'كلارينيت'], ['Saxophone', 'ساكسفون'], ['Trumpet', 'ترومبيت'], ['French Horn', 'هورن'], ['Brass Section', 'نحاسيات']] },
  { id: 'percussion', ar: 'إيقاعات', items: [['Darbuka', 'دربكة'], ['Riq', 'رق'], ['Daf', 'دف'], ['Rahmani Drum', 'رحماني'], ['Kaser Drum', 'كاسر'], ['Hand Claps', 'تصفيق'], ['Drum Kit', 'درامز'], ['Timpani', 'تيمباني'], ['808 Bass', 'باص 808']] },
];
export const INSTRUMENTS = INSTRUMENT_GROUPS.flatMap((g) => g.items.map(([en]) => en));
export const INSTRUMENT_AR = Object.fromEntries(INSTRUMENT_GROUPS.flatMap((g) => g.items));
// أجزاء التوزيع (لكل جزء آلاته)
export const ARRANGEMENT_PARTS = [
  { id: 'intro', ar: 'المقدمة' },
  { id: 'verse', ar: 'الكوبليهات' },
  { id: 'chorus', ar: 'المذهب' },
  { id: 'bridge', ar: 'الجسر والفواصل' },
  { id: 'outro', ar: 'الخاتمة' },
];

// قيود Suno الحالية (لعدادات الواجهة)
export const SUNO_LIMITS = { style: 1000, lyrics: 5000, title: 100, exclude: 250 };

const byId = (list) => Object.fromEntries(list.map((x) => [x.id, x]));
export const GENRE_BY_ID = byId(GENRES);
export const LANGUAGE_BY_ID = byId(LANGUAGES);
export const MOOD_BY_ID = byId(MOODS);
export const RHYTHM_BY_ID = byId(RHYTHMS);
export const MAQAM_BY_ID = byId(MAQAMS);
export const VOCAL_BY_ID = byId(VOCALS);
export const TEMPO_BY_ID = byId(TEMPOS);
export const INTRO_BY_ID = byId(INTROS);
export const OUTRO_BY_ID = byId(OUTROS);
export const ids = (list) => list.map((x) => x.id);
