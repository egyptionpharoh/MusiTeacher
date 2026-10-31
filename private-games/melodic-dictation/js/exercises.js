// ============================================================================
// exercises.js — مواد التدريب
// 1) نماذج منقولة من أدلة المعلم لمادة الفنون الموسيقية (وزارة التعليم – سلطنة عُمان)
//    مع بيان موضع كل نموذج: الصف، الدرس، رقم النموذج، رقم الصفحة في الدليل.
//    النص المقتبس من الدليل يُحفظ في task.text مع quoted: true،
//    والتحويل التفاعلي الذي صممته MusiTeacher يُحفظ في adapt (منفصلًا وواضحًا).
// 2) مولّد إملاء لحني بمستويات مبنية على تدرج الدروس.
// ============================================================================
(function (MT) {
  'use strict';
  const T = MT.theory, SC = MT.score;

  // ⚖️ مفتاح مركزي: أدلة المعلم تنص على أن «جميع حقوق التأليف والطبع والنشر محفوظة» للوزارة، وأنه لا يجوز
  // نسخها كاملة أو مجزأة «بهدف تجاري» إلا بإذن مسبق منها. إلى أن يُحسم وضع الإذن، يمكن إخفاء كل التمارين
  // المنقولة من الأدلة دفعة واحدة بجعل هذه القيمة false (يبقى المولّد والتأليف الحر والإملاء العشوائي يعملون).
  const GUIDE_CONTENT_ENABLED = true;

  // ------------------------------------------------ بيانات الأدلة (كما تظهر في الملفات المتاحة فقط)
  const GUIDES = {
    3: { title: 'دليل المعلم لمادة الفنون الموسيقية — الصف الثالث', publisher: 'وزارة التعليم – سلطنة عُمان', edition: null },
    4: { title: 'دليل المعلم لمادة الفنون الموسيقية — الصف الرابع', publisher: 'وزارة التعليم – سلطنة عُمان', edition: null },
    5: { title: 'دليل المعلم لمادة الفنون الموسيقية — الصف الخامس', publisher: 'وزارة التعليم – سلطنة عُمان', edition: null },
    6: { title: 'دليل المعلم لمادة الفنون الموسيقية — الصف السادس', publisher: 'وزارة التعليم – سلطنة عُمان', edition: null },
    7: { title: 'دليل المعلم لمادة الفنون الموسيقية — الصف السابع', publisher: 'وزارة التعليم – سلطنة عُمان', edition: null },
    8: { title: 'دليل المعلم لمادة الفنون الموسيقية — الصف الثامن', publisher: 'وزارة التعليم – سلطنة عُمان',
         edition: 'الطبعة التجريبية 1448هـ – 2026م', decree: 'أُلِّف وفق القرار الوزاري رقم 265/2025م' },
  };

  // صيغة مختصرة للنوتة:
  //   <نغمة><تحويل>?<أوكتاف><قيمة>[.][3][~]   مثل: E4q  F#5e.  Bn4s  G4h~  C5e3
  //   r<قيمة>[.]   سكتة        x<قيمة>[.][3][~]   نغمة إيقاعية بلا موضع (تمارين الإيقاع)
  //   القيم: w روند، h بلانش، q نوار، e كروش، s دوبل كروش · «.» بوانتيه · «3» تريوليه · «~» رباط · «|» فاصل للقراءة فقط
  const VAL = { w: 4, h: 2, q: 1, e: 0.5, s: 0.25 };
  function parse(str) {
    const notes = [];
    str.trim().split(/\s+/).forEach(tok => {
      if (tok === '|' || !tok) return;
      let m = tok.match(/^r([whqes])(\.?)$/);
      if (m) { notes.push(SC.makeNote('rest', null, { base: VAL[m[1]], dots: m[2] ? 1 : 0 })); return; }
      m = tok.match(/^x([whqes])(\.?)(3?)(~?)$/);
      if (m) {
        const n = SC.makeNote('note', null, { base: VAL[m[1]], dots: m[2] ? 1 : 0, tuplet: m[3] ? 3 : undefined });
        if (m[4]) n.tie = true;
        notes.push(n); return;
      }
      m = tok.match(/^([A-G])([#bn]?)(\d)([whqes])(\.?)(3?)(~?)$/);
      if (!m) throw new Error('صيغة غير صحيحة: ' + tok);
      const alter = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : m[2] === 'n' ? 0 : null;
      const n = SC.makeNote('note', { step: m[1], octave: +m[3], alter }, { base: VAL[m[4]], dots: m[5] ? 1 : 0, tuplet: m[6] ? 3 : undefined });
      if (m[7]) n.tie = true;
      notes.push(n);
    });
    return notes;
  }

  const BOTH = ['solfege', 'rhythm'];
  // ------------------------------------------------ النماذج
  // reads: طرق القراءة الصحيحة للتمرين · defaultRead: الطريقة التي يطلبها الدليل للنشاط
  // rhythmOnly: إيقاع فقط (لا قراءة صولفائية) · showSteps: إظهار الأبعاد (⌒ كامل / ∨ نصف) كما في الدليل
  // phrases: العبارات (من مازورة إلى مازورة، بدءًا من 0) لنشاط «أي عبارة سمعت؟»
  // activity: 'read' (قراءة/إملاء) | 'compose' (ابتكار لحن لإيقاع) | 'fix' (إكمال العناصر الناقصة)
  const ALL_LESSONS = [
    // ---------------------------------------------------------------- الصفوف 3–7 (من مقتطفات الأدلة المرفقة)
    {
      id: 'g3-xylophone', grade: 3, lesson: 'الدرس الثالث: عزف مقطوعة موسيقية على آلة الإكسيليفون', model: 'النموذج (2)',
      title: 'مقطوعة الإكسيليفون',
      key: 'C', beats: 2, tempo: 70, reads: BOTH,
      music: 'C4e C4e D4e D4e | E4e E4e F4e G4e | G4e F4e E4e D4e | E4e F4e G4q | C4e C4e D4e D4e | E4e E4e F4e G4e | G4e F4e E4e D4e | E4e D4e C4q',
    },
    {
      id: 'g4-beethoven', grade: 4, lesson: 'الدرس الثالث: عزف مقطوعة موسيقية على آلة الأورج', model: 'النموذج (3)',
      title: 'السيمفونية التاسعة — بيتهوفن (بتصرف)', credit: 'لودفيغ فان بيتهوفن (بتصرف كما ورد في الدليل)',
      key: 'C', beats: 2, tempo: 60, reads: BOTH,
      music: 'E4e E4e F4e G4e | G4e F4e E4e D4e | C4e C4e D4e E4e | E4q D4q | E4e E4e F4e G4e | G4e F4e E4e D4e | C4e C4e D4e E4e | D4q C4q',
    },
    {
      id: 'g5-mary', grade: 5, lesson: 'الدرس الثاني: قراءة إيقاعية وصولفيج غنائي', model: 'النموذج (2)',
      title: 'Mary Had a Little Lamb', credit: 'لحن شعبي',
      key: 'C', beats: 4, tempo: 100, reads: BOTH,
      music: 'E4q D4q C4q D4q | E4w | D4w | E4q G4q G4h | E4q D4q C4q D4q | E4w | D4h E4h | C4w',
    },
    {
      id: 'g6-sami', grade: 6, lesson: 'الدرس الثاني: قراءة إيقاعية وصولفيج غنائي', model: 'النموذج (1)',
      title: 'النموذج (1) — تأليف: محمد سامي محمد', credit: 'تأليف: محمد سامي محمد (كما ورد في الدليل)',
      key: 'C', beats: 4, tempo: 70, reads: BOTH,
      music: 'G4s G4e G4s G4q E4e C4e G4q | G4s G4e A4s G4e F4e E4e F4e D4q | F4s F4e F4s F4q E4e D4e F4q | G4s G4e A4s G4e F4e E4e F4e G4q | ' +
             'G4s G4e G4s G4q E4e C4e G4q | G4s G4e A4s G4e F4e E4e F4e D4q | F4s F4e F4s F4q E4e D4e F4q | G4s G4e G4s G4e G4e A4e B4e C5q',
    },
    {
      id: 'g7-mozart', grade: 7, lesson: 'الدرس الثاني: قراءة إيقاعية وصولفيج غنائي', model: 'النموذج (2)',
      title: 'Eine kleine Nachtmusik — موتسارت', credit: 'فولفغانغ أماديوس موتسارت',
      key: 'C', beats: 4, tempo: 100, marks: { 7: { repeatEnd: true } }, reads: BOTH,
      music: 'C5q. G4e C5q. G4e | C5e G4e C5e E5e G5q rq | F5q. D5e F5q. D5e | F5e D5e B4e D5e G4q rq | ' +
             'C5q C5q. E5e D5e C5e | C5e B4e B4q. D5e F5e B4e | D5e C5e C5q. E5e D5e C5e | C5e B4e B4e B4e C5h',
    },

    // ---------------------------------------------------------------- الصف الثامن (الطبعة التجريبية 2026م)
    // الوحدة الأولى — الدرس الثالث: ابتكارات لحنية (ص 31)
    {
      id: 'g8-u1-creation-m2', grade: 8, unit: 'الوحدة الأولى', lesson: 'الدرس الثالث: ابتكارات لحنية', model: 'النموذج (2)', page: 31,
      title: 'ابتكارات لحنية — جملة موسيقية (النموذج 2)',
      key: 'C', beats: 2, tempo: 80, reads: BOTH,
      task: { quoted: true, text: 'يعرض النموذج (2) على الطلبة ويعزفه، ويشرح من خلاله بعض الإرشادات التي يجب مراعاتها عند الابتكار اللحني.' },
      music: 'C4e D4e E4q | E4e D4e C4q | E4e F4e E4e F4e | G4h | G4e G4e C5q | B4e A4e G4q | G4e F4e E4e D4e | C4e C4e C4q',
    },
    {
      id: 'g8-u1-creation-m3', grade: 8, unit: 'الوحدة الأولى', lesson: 'الدرس الثالث: ابتكارات لحنية', model: 'النموذج (3)', page: 31,
      title: 'ابتكارات لحنية — النموذج الإيقاعي (3)',
      key: 'C', beats: 2, tempo: 80, reads: ['rhythm'], defaultRead: 'rhythm', rhythmOnly: true,
      task: { quoted: true, text: 'يعرض النموذج (3) على الطلبة، ويطلب إليهم تحليله من حيث (الميزان، عدد الموازير، الأشكال والعلامات الإيقاعية)، ثم يؤديه إيقاعيًا.' },
      music: 'xq xe xe | xs xs xs xs xq | xe xe xq | xh | xe. xs xe xe | xs xe xs rq | xe xe xq | xh',
    },
    {
      id: 'g8-u1-creation-m4', grade: 8, unit: 'الوحدة الأولى', lesson: 'الدرس الثالث: ابتكارات لحنية', model: 'النموذج (4)', page: 31,
      title: 'نشاط: ابتكر لحنًا لإيقاع النموذج (3)', activity: 'compose',
      key: 'C', beats: 2, tempo: 80, reads: BOTH, rhythmOnly: true,
      task: { quoted: true, text: 'يقسّم الطلبة إلى مجموعات، ويوزّع النموذج (4) عليهم، ثم يطلب إليهم ابتكار جملة موسيقية للنموذج (3) وتدوينها، مع مراعاة إرشادات الابتكار اللحني.' },
      adapt: 'في اللعبة: يُفتح إيقاع النموذج (3) في «التأليف» بنغمات بلا موضع (؟)، فيحدد الطالب موضع كل نغمة على المدرج ثم يستمع إلى لحنه ويحفظه.',
      music: 'xq xe xe | xs xs xs xs xq | xe xe xq | xh | xe. xs xe xe | xs xe xs rq | xe xe xq | xh',
    },
    // الوحدة الثانية — الدرس الأول: أبعاد سلم (دو) الكبير (ص 38–40)
    {
      id: 'g8-u2-scale-steps', grade: 8, unit: 'الوحدة الثانية', lesson: 'الدرس الأول: أبعاد سلّم (دو) الكبير', model: 'النموذجان (6) و(7)', page: 40,
      title: 'أبعاد سلم دو الكبير (البعد الكامل ونصف البعد)',
      key: 'C', beats: 4, tempo: 72, reads: ['solfege'], showSteps: true,
      task: { quoted: true, text: 'يعرض النموذج (6) على الطلبة، ويوضّح لهم أن البعد الكامل يُرمز له بالرمز (⌒)، والنصف بُعد يُرمز له بالرمز (∨)، ويطلب إليهم تدوين أبعاد سلّم (دو) الكبير على المدرج الموسيقي.' },
      adapt: 'كُتبت درجات السلم في اللعبة بالبلانش في ميزان 4/4 (الدليل يكتبها بالروند دون ميزان) لتظهر الدرجات الثماني على سطر واحد، وتُرسم رموز الأبعاد تلقائيًا بين الدرجات كما في النموذج (7).',
      music: 'C4h D4h | E4h F4h | G4h A4h | B4h C5h',
    },
    // الوحدة الثانية — الدرس الثاني: قراءة إيقاعية وصولفيج غنائي (ص 45–46)
    {
      id: 'g8-u2-reading-m1', grade: 8, unit: 'الوحدة الثانية', lesson: 'الدرس الثاني: قراءة إيقاعية وصولفيج غنائي', model: 'النموذج (1)', page: 45,
      title: 'تمهيد القراءة — النموذج (1)',
      key: 'C', beats: 2, tempo: 72, reads: BOTH,
      task: { quoted: true, text: 'قسّم الطلبة إلى مجموعتين، واعرض عليهم النموذج (1)، واطلب إلى المجموعة الأولى قراءته إيقاعيًا بطريقة (إيمي باري) مع التصفيق، ثم اطلب إلى المجموعة الثانية قراءته صولفائيًا مع التصفيق.' },
      music: 'C4q D4e E4e | F4s F4s F4e G4q | A4e. A4s B4s B4e B4s | C5h',
    },
    {
      id: 'g8-u2-bolero', grade: 8, unit: 'الوحدة الثانية', lesson: 'الدرس الثاني: قراءة إيقاعية وصولفيج غنائي', model: 'النموذجان (2) و(3)', page: 45,
      title: 'Bolero — موريس رافيل (مبسّط كما في الدليل)', credit: 'Maurice Ravel (موريس رافيل) — بالصيغة المبسطة الواردة في الدليل',
      key: 'C', beats: 3, tempo: 66, reads: BOTH, phrases: [[0, 3], [4, 7]],
      task: { quoted: true, text: 'يقرأ المقطوعة الموسيقية كاملةً صولفائيًا مع التصفيق، ثم يطلب إلى الطلبة الأداء من بعده، ويصاحبهم بأداء الوحدة الأساسية النُّوار.' },
      music: 'C5q~ C5e B4s C5s D5s C5s B4s A4s | C5e C5s A4s C5q~ C5e B4s C5s | A4s G4s E4s F4s G4h | G4s F4s E4s D4s E4s F4s G4s A4s G4q~ | ' +
             'G4q G4s A4s B4s A4s G4s F4s E4s D4s | E4s D4s C4e C4e C4s D4s E4e F4e | D4q G4h | G4s F4s E4s D4s C4h',
    },
    // الوحدة الثانية — الدرس الثالث: عزف مقطوعة موسيقية (ص 54): إيقاع البوليرو المصاحب
    {
      id: 'g8-u2-bolero-rhythm', grade: 8, unit: 'الوحدة الثانية', lesson: 'الدرس الثالث: عزف مقطوعة موسيقية', model: 'النموذج (3) — سطر الآلة الإيقاعية', page: 54,
      title: 'إيقاع Bolero المصاحب (الآلة الإيقاعية — تريوليه)', credit: 'Maurice Ravel (موريس رافيل)',
      key: 'C', beats: 3, tempo: 66, reads: ['rhythm'], defaultRead: 'rhythm', rhythmOnly: true,
      task: { quoted: true, text: 'يتخيّر طالبين يؤدي أحدهما الوحدة الأساسية النُّوار على آلة إيقاعية، والآخر يؤدّي إشارات اليد الدالة على الميزان الثلاثي، ويصاحبهم بأداء إيقاع (Bolero) المدرج في النموذج (3).' },
      adapt: 'مقاطع التريوليه في اللعبة (تري-يو-ليه) اصطلاح لتسهيل القراءة، وليست واردة في الدليل.',
      music: 'xe xs3 xs3 xs3 xe xs3 xs3 xs3 xe xe | xe xs3 xs3 xs3 xe xs3 xs3 xs3 xs3 xs3 xs3 xs3 xs3 xs3 | ' +
             'xe xs3 xs3 xs3 xe xs3 xs3 xs3 xe xe | xe xs3 xs3 xs3 xe xs3 xs3 xs3 xs3 xs3 xs3 xs3 xs3 xs3 | ' +
             'xe xs3 xs3 xs3 xe xs3 xs3 xs3 xe xe | xe xs3 xs3 xs3 xe xs3 xs3 xs3 xs3 xs3 xs3 xs3 xs3 xs3 | ' +
             'xe xs3 xs3 xs3 xe xs3 xs3 xs3 xe xe | xe xs3 xs3 xs3 xe xe xq',
    },
    // الوحدة الثالثة — الدرس الأول: علامات التحويل (ص 64–67)
    {
      id: 'g8-u3-accidentals', grade: 8, unit: 'الوحدة الثالثة', lesson: 'الدرس الأول: علامات التحويل (الدييز – البيمول – البيكار)', model: 'النماذج (4) و(7) و(12)', page: 64,
      title: 'علامات التحويل: الدييز والبيمول والبيكار',
      key: 'C', beats: 4, tempo: 66, reads: ['solfege'], showSteps: 'measure',
      task: { quoted: true, text: 'يعرض النموذج (12) على الطلبة، ويوضّح لهم من خلاله أن علامة التحويل البيكار وظيفتها إلغاء علامات الرفع أو الخفض التي طرأت على النغمات وإرجاعها إلى وضعها الطبيعي.' },
      adapt: 'جُمعت أمثلة النماذج (4) و(7) و(12) في تمرين واحد بالبلانش في ميزان 4/4: دو ← دو دييز، ري ← ري بيمول، فا دييز ← فا بيكار، سي بيمول ← سي بيكار، مع رمز نصف البعد بينها.',
      music: 'C4h C#4h | D4h Db4h | F#4h Fn4h | Bb4h Bn4h',
    },
    // الوحدة الثالثة — الدرس الثاني: قراءة إيقاعية وصولفيج غنائي (ص 74، 78، 79)
    {
      id: 'g8-u3-habanera', grade: 8, unit: 'الوحدة الثالثة', lesson: 'الدرس الثاني: قراءة إيقاعية وصولفيج غنائي', model: 'النموذج (2)', page: 74,
      title: 'Habanera — جورج بيزيه (بتصرّف: حسين الحسيني)', credit: 'Georges Bizet (جورج بيزيه) — بتصرّف: حسين الحسيني، كما ورد في الدليل',
      key: 'F', beats: 2, tempo: 70, reads: BOTH, phrases: [[0, 3], [4, 7], [8, 11], [12, 15]], aural: true,
      task: { quoted: true, text: 'يعرض النموذج (2) للمقطوعة الموسيقية على الطلبة، ويطلب إليهم تحليلها من حيث (الميزان – عدد الموازير – العلامات والأشكال الإيقاعية – علامات التحويل).' },
      auralTask: { quoted: true, text: 'اعزف إحدى العبارات الموسيقية مع غنائها صولفائيًا، واطلب إليهم تحديد العبارة الموسيقية التي استمعوا لها.', page: 79 },
      music: 'D5e C#5e Cn5e. C5s | Bn4e Bb4e A4e. A4s | G#4e Gn4e F4s G4s E4s F4s | G4e F4e E4q | ' +
             'D5e C#5e Cn5s C5e C5s | Bn4e Bb4e A4e. A4s | G#4e Gn4e E4s F4s D4s E4s | F4e E4e D4e. A4s | ' +
             'D4e E4e F#4e. A4s | F#4e E4e D4e. E4s | F#4e G4e A4s A4s A4s A4s | Bn4e A4e G4e. B4s | ' +
             'E4e F#4e G4e. Bn4s | G4e F#4e E4e. F4s | G4e A4e Bn4s B4s B4s B4s | C#5e Bn4e D5q',
    },
    // النشاط الأول (ص 78): أربع بطاقات، لكل بطاقة طريقة قراءة يحددها الدليل
    { id: 'g8-u3-card1', sliceOf: 'g8-u3-habanera', measures: [0, 4], grade: 8, unit: 'الوحدة الثالثة', lesson: 'الدرس الثاني: قراءة إيقاعية وصولفيج غنائي', model: 'النشاط الأول — البطاقة (1)', page: 78,
      title: 'Habanera — البطاقة (1): قراءة إيقاعية', reads: BOTH, defaultRead: 'rhythm',
      task: { quoted: true, text: 'اقرأ العبارة الموسيقية إيقاعيًّا بطريقة (إيمي باري).' } },
    { id: 'g8-u3-card2', sliceOf: 'g8-u3-habanera', measures: [4, 4], grade: 8, unit: 'الوحدة الثالثة', lesson: 'الدرس الثاني: قراءة إيقاعية وصولفيج غنائي', model: 'النشاط الأول — البطاقة (2)', page: 78,
      title: 'Habanera — البطاقة (2): قراءة صولفائية', reads: BOTH, defaultRead: 'solfege',
      task: { quoted: true, text: 'اقرأ العبارة الموسيقية صولفائيًّا.' } },
    { id: 'g8-u3-card3', sliceOf: 'g8-u3-habanera', measures: [8, 4], grade: 8, unit: 'الوحدة الثالثة', lesson: 'الدرس الثاني: قراءة إيقاعية وصولفيج غنائي', model: 'النشاط الأول — البطاقة (3)', page: 78,
      title: 'Habanera — البطاقة (3): قراءة إيقاعية', reads: BOTH, defaultRead: 'rhythm',
      task: { quoted: true, text: 'اقرأ العبارة الموسيقية إيقاعيًّا بطريقة (إيمي باري).' } },
    { id: 'g8-u3-card4', sliceOf: 'g8-u3-habanera', measures: [12, 4], grade: 8, unit: 'الوحدة الثالثة', lesson: 'الدرس الثاني: قراءة إيقاعية وصولفيج غنائي', model: 'النشاط الأول — البطاقة (4)', page: 78,
      title: 'Habanera — البطاقة (4): أداء إيقاعي', reads: BOTH, defaultRead: 'rhythm',
      task: { quoted: true, text: 'أدِّ العبارة الموسيقية إيقاعيًّا.' } },
    // الوحدة الرابعة — الدرس الثاني: إملاء إيقاعي (ص 98–100)
    {
      id: 'g8-u4-dict-m2', grade: 8, unit: 'الوحدة الرابعة', lesson: 'الدرس الثاني: إملاء إيقاعي', model: 'النموذج (2)', page: 98,
      title: 'إملاء إيقاعي — النموذج (2)', key: 'C', beats: 2, tempo: 72, reads: ['rhythm'], defaultRead: 'rhythm', rhythmOnly: true,
      task: { quoted: true, text: 'يعرض النموذج (2) على الطلبة، وينقره بالقلم مستخدمًا اليد اليمنى مع ضبط الوحدة الأساسية النُّوار باليد اليسرى عدة مرات، ثم يذكّرهم بكيفية استنتاج الميزان الموسيقي.' },
      music: 'xe. xs xe xe | xs xs xs xs xq | xe xe rq | xs xs xe xq',
    },
    {
      id: 'g8-u4-dict-m3', grade: 8, unit: 'الوحدة الرابعة', lesson: 'الدرس الثاني: إملاء إيقاعي', model: 'النموذج (3)', page: 99,
      title: 'إملاء إيقاعي — النموذج (3)', key: 'C', beats: 2, tempo: 72, reads: ['rhythm'], defaultRead: 'rhythm', rhythmOnly: true,
      task: { quoted: true, text: 'ينقر بالقلم المازورة الأولى من النموذج (3) باليد اليمنى، مع ضبط الوحدة الأساسية النُّوار باليد اليسرى، أكثر من مرة، ثم يطلب إلى الطلبة تدوينها، ويكرّر ذلك مع بقية الموازير.' },
      music: 'xs xe xs xe xe | xs xs xs xs xq | xe. xs xe xe | xs xe. xq',
    },
    {
      id: 'g8-u4-dict-m4', grade: 8, unit: 'الوحدة الرابعة', lesson: 'الدرس الثاني: إملاء إيقاعي', model: 'النموذج (4)', page: 99,
      title: 'إملاء إيقاعي — النموذج (4): لحن على إيقاع النموذج (3)', key: 'C', beats: 2, tempo: 72, reads: BOTH,
      task: { quoted: true, text: 'يعزف النموذج (4) المطابق لإيقاعات النموذج (3) أكثر من مرة، ثم يطلب إلى الطلبة غناءه بالمقطع اللفظي (لا) مع تصفيقه إيقاعيًا، ويصاحبهم بالعزف.' },
      music: 'C4s C4e C4s E4e G4e | A4s G4s F4s E4s D4q | D4e. D4s E4e F4e | G4s G4e. C4q',
    },
    {
      id: 'g8-u4-dict-m5', grade: 8, unit: 'الوحدة الرابعة', lesson: 'الدرس الثاني: إملاء إيقاعي', model: 'النموذج (5)', page: 99,
      title: 'إملاء إيقاعي — النموذج (5): بعد تغيير بعض الإيقاعات', key: 'C', beats: 2, tempo: 72, reads: BOTH, defaultRead: 'rhythm',
      task: { quoted: true, text: 'يعزف المازورة الأولى للنموذج (5) أكثر من مرة، ثم يطلب إلى الطلبة تدوينها إيقاعيًا، ويكرّر ذلك مع بقية الموازير.' },
      adapt: 'مناسب للإملاء: اختره في «الإملاء اللحني» مع القراءة الإيقاعية، واستمع لكل مازورة على حدة.',
      music: 'C4s C4e C4s G4q | A4s G4s F4s E4s D4q | D4e. D4s E4e G4e | C4h',
    },
    {
      id: 'g8-u4-dict-m6', grade: 8, unit: 'الوحدة الرابعة', lesson: 'الدرس الثاني: إملاء إيقاعي', model: 'النموذج (6)', page: 100,
      title: 'إملاء إيقاعي — النموذج (6): إيقاع النموذج (5)', key: 'C', beats: 2, tempo: 72, reads: ['rhythm'], defaultRead: 'rhythm', rhythmOnly: true,
      task: { quoted: true, text: 'يعرض نموذجي (3) و(6) على الطلبة، ويطلب إليهم تحديد العلامات والأشكال الإيقاعية التي تغيّرت في النموذج (6).' },
      music: 'xs xe xs xq | xs xs xs xs xq | xe. xs xe xe | xh',
    },
    // الوحدة الرابعة — الدرس الثالث: التدوين الموسيقي الرقمي (ص 106)
    {
      id: 'g8-u4-digital-fix', grade: 8, unit: 'الوحدة الرابعة', lesson: 'الدرس الثالث: التدوين الموسيقي الرقمي', model: 'النموذج (3)', page: 106,
      title: 'نشاط: أكمل العناصر الناقصة في المدونة', activity: 'fix',
      key: 'C', beats: 4, tempo: 100, reads: ['solfege'],
      task: { quoted: true, text: 'يدوّن العبارة الموسيقية في برنامج التدوين الرقمي، ويعرضها على الطلبة، ثم يتخيّر طالبًا لإضافة أحد العناصر الناقصة في المدونة الموسيقية.' },
      adapt: 'في اللعبة: تظهر المدونة الناقصة، والنغمات المحذوفة علامات «؟» بأزمنتها؛ يحدد الطالب موضع كل منها وعلامة تحويلها ثم يتحقق. (الميزان يظهر دائمًا في اللعبة، فلا يُطلب إكماله.)',
      prefill: 'C4q G4q xq G4q | G4e A4e xe xe G4h | C5e C5e G4q xe xe Eb4e D4e | G4q Eb4q xh',
      music: 'C4q G4q F#4q G4q | G4e A4e Bb4e A4e G4h | C5e C5e G4q G4e F#4e Eb4e D4e | G4q Eb4q C4h',
    },
  ];

  const LESSONS = GUIDE_CONTENT_ENABLED ? ALL_LESSONS : [];
  const byId = (id) => ALL_LESSONS.find(l => l.id === id);
  // الإدخالات المشتقة (بطاقات) ترث بيانات الأصل
  function resolve(L) {
    if (!L || !L.sliceOf) return L;
    const P = byId(L.sliceOf);
    return Object.assign({}, P, L, { music: P.music, credit: P.credit, phrases: null, aural: false });
  }

  function citation(L) {
    L = resolve(L);
    const g = GUIDES[L.grade];
    const parts = [g.title];
    if (L.unit) parts.push(L.unit);
    if (L.lesson) parts.push(L.lesson);
    if (L.model) parts.push(L.model);
    if (L.page) parts.push('ص ' + L.page);
    return parts.join('، ') + ' — ' + g.publisher + (g.edition ? '، ' + g.edition : '') + '.';
  }

  function lessonScore(id, opts) {
    const L0 = LESSONS.find(l => l.id === id);
    if (!L0) return null;
    const L = resolve(L0);
    const s = SC.emptyScore({ title: L.title, key: L.key, beats: L.beats, tempo: L.tempo, rhythmOnly: !!L.rhythmOnly });
    s.notes = parse(opts && opts.prefill && L.prefill ? L.prefill : L.music);
    s.marks = L.marks ? JSON.parse(JSON.stringify(L.marks)) : {};
    s.composer = citation(L0);
    if (L0.sliceOf) {
      const [from, count] = L0.measures;
      const lay = SC.layout(s);
      const keep = [];
      lay.measures.forEach(m => { if (m.index >= from && m.index < from + count) m.items.forEach(it => keep.push(it.note)); });
      if (keep.length) keep[keep.length - 1].tie = false;
      s.notes = keep; s.marks = {};
    }
    s.minMeasures = SC.layout(s).measures.length;
    return s;
  }

  // ------------------------------------------------ مولّد الإملاء اللحني
  // المستويات مبنية على تدرج الدروس:
  //  1: الصف 3–4 — النغمات الخمس الأولى من سلم دو (دو–صول)، حركة متصلة، نوار وكروش (طاتي)
  //  2: الصف 5–6 — من دو إلى دو الحادة، قفزات الثالثة، بلانش وروند
  //  3: الصف 7 — حتى صول أعلى المدرج، قفزات حتى الخامسة، نوار بوانتيه، وطفاتيفي
  //  4: الصف 8 — أشكال الدرس «إملاء إيقاعي» (النموذج 1): طافي، طافا، طفافي، طفاتي، طاتيفي
  const LEVELS = {
    1: { name: 'المستوى الأول — حركة متصلة (دو إلى صول)', low: -2, high: 2, maxLeap: 1,
         patterns: [[1], [1], [0.5, 0.5]], endLong: [1, 2] },
    2: { name: 'المستوى الثاني — قفزات صغيرة (دو إلى دو الحادة)', low: -2, high: 5, maxLeap: 2,
         patterns: [[1], [1], [0.5, 0.5], [2]], endLong: [2, 4] },
    3: { name: 'المستوى الثالث — مدى أوسع (دو إلى صول الحادة)', low: -2, high: 9, maxLeap: 4,
         patterns: [[1], [0.5, 0.5], [1.5, 0.5], [2], [0.25, 0.25, 0.25, 0.25]], endLong: [2, 4] },
    4: { name: 'المستوى الرابع — أشكال الصف الثامن (طافي، طافا، طفافي، طفاتي، طاتيفي)', low: -2, high: 7, maxLeap: 2,
         patterns: [[1], [0.5, 0.5], [0.75, 0.25], [0.25, 0.75], [0.25, 0.5, 0.25], [0.25, 0.25, 0.5], [0.5, 0.25, 0.25], [0.25, 0.25, 0.25, 0.25]], endLong: [1, 2] },
  };

  function rnd(a) { return a[Math.floor(Math.random() * a.length)]; }

  function generate(opts) {
    const level = LEVELS[opts.level] || LEVELS[1];
    const keyName = opts.key || 'C';
    const key = T.KEYS[keyName];
    const beats = opts.beats || 4;
    const measures = opts.measures || 2;
    const tonicPos0 = T.posOf({ step: key.tonic, octave: 4 });
    const shift = tonicPos0 - (-2);
    const low = level.low + shift, high = level.high + shift;

    const rhythm = [];
    const sum = (p) => p.reduce((a, b) => a + b, 0);
    for (let m = 0; m < measures; m++) {
      let left = beats;
      const isLast = m === measures - 1;
      const bucket = [];
      if (isLast) {
        const longOpts = level.endLong.filter(d => d <= beats);
        const endD = longOpts.length ? rnd(longOpts) : 1;
        left -= endD;
        while (left > 1e-9) { const p = rnd(level.patterns.filter(x => sum(x) <= left + 1e-9)); bucket.push(...p); left -= sum(p); }
        bucket.push(endD);
      } else {
        while (left > 1e-9) { const p = rnd(level.patterns.filter(x => sum(x) <= left + 1e-9)); bucket.push(...p); left -= sum(p); }
      }
      rhythm.push(...bucket);
    }
    const tonic = low;
    const tonicHigh = tonic + 7 <= high ? tonic + 7 : null;
    const starts = [tonic, tonic + 2, tonic + 4].filter(p => p <= high);
    let cur = rnd(starts);
    const poses = [cur];
    for (let i = 1; i < rhythm.length; i++) {
      const remaining = rhythm.length - 1 - i;
      if (remaining === 0) {
        const target = tonicHigh !== null && Math.abs(cur - tonicHigh) < Math.abs(cur - tonic) ? tonicHigh : tonic;
        poses.push(target); cur = target; continue;
      }
      if (remaining === 1) {
        const target = tonicHigh !== null && Math.abs(cur - tonicHigh) < Math.abs(cur - tonic) ? tonicHigh : tonic;
        const near = [target + 1, target - 1].filter(p => p >= low && p <= high);
        const nx = near.length ? near.reduce((a, b) => Math.abs(b - cur) < Math.abs(a - cur) ? b : a) : target;
        poses.push(nx); cur = nx; continue;
      }
      const steps = [];
      for (let d = -level.maxLeap; d <= level.maxLeap; d++) {
        const w = d === 0 ? 1 : Math.abs(d) === 1 ? 5 : Math.abs(d) === 2 ? 2 : 1;
        for (let k = 0; k < w; k++) steps.push(d);
      }
      let nx, tries = 0;
      do { nx = cur + rnd(steps); tries++; } while ((nx < low || nx > high) && tries < 50);
      if (nx < low || nx > high) nx = cur;
      poses.push(nx); cur = nx;
    }
    const s = SC.emptyScore({ title: 'إملاء لحني', key: keyName, beats, tempo: opts.tempo || 70, minMeasures: measures });
    const DOTTED = { 0.75: 0.5, 1.5: 1, 3: 2 };
    s.notes = rhythm.map((d, i) => {
      const p = T.pitchAtPos(poses[i]);
      const dk = Object.keys(DOTTED).find(k => Math.abs(+k - d) < 1e-6);
      const base = dk ? DOTTED[dk] : ([4, 2, 1, 0.5, 0.25].find(b => Math.abs(b - d) < 1e-6) || 1);
      return SC.makeNote('note', { step: p.step, octave: p.octave, alter: null }, { base, dots: dk ? 1 : 0 });
    });
    return s;
  }

  MT.exercises = { LESSONS, ALL_LESSONS, GUIDES, GUIDE_CONTENT_ENABLED, LEVELS, parse, lessonScore, generate, citation, resolve };
})(window.MT = window.MT || {});
