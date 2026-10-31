// ============================================================================
// exercises.js — مواد التدريب
// 1) نماذج منقولة حرفيًا من أدلة المعلم المرفقة (مع ذكر الصف والدرس والنموذج)
// 2) مولّد إملاء لحني بمستويات مبنية على ما تتدرج فيه الدروس (المدى النغمي والأشكال الإيقاعية)
// ============================================================================
(function (MT) {
  'use strict';
  const T = MT.theory, SC = MT.score;

  // صيغة مختصرة: <نغمة><تحويل اختياري><أوكتاف><قيمة>[.][~]   مثل: E4q  F#5e.  r.q (سكتة)  G4h~
  // القيم: w روند، h بلانش، q نوار، e كروش، s دوبل كروش. «|» فاصل موازير للقراءة فقط.
  const VAL = { w: 4, h: 2, q: 1, e: 0.5, s: 0.25 };
  function parse(str) {
    const notes = [];
    str.trim().split(/\s+/).forEach(tok => {
      if (tok === '|') return;
      let m = tok.match(/^r([whqes])(\.?)$/);
      if (m) { notes.push(SC.makeNote('rest', null, { base: VAL[m[1]], dots: m[2] ? 1 : 0 })); return; }
      m = tok.match(/^([A-G])([#bn]?)(\d)([whqes])(\.?)(~?)$/);
      if (!m) throw new Error('صيغة غير صحيحة: ' + tok);
      const alter = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : m[2] === 'n' ? 0 : null;
      const n = SC.makeNote('note', { step: m[1], octave: +m[3], alter }, { base: VAL[m[4]], dots: m[5] ? 1 : 0 });
      if (m[6]) n.tie = true;
      notes.push(n);
    });
    return notes;
  }

  // ------------------------------------------------ نماذج من أدلة المعلم المرفقة
  const LESSONS = [
    {
      id: 'g3-xylophone', grade: 3,
      title: 'مقطوعة الإكسيليفون',
      source: 'دليل المعلم — الصف الثالث، الدرس الثالث «عزف مقطوعة موسيقية على آلة الإكسيليفون»، النموذج (2)',
      key: 'C', beats: 2, tempo: 70,
      music: 'C4e C4e D4e D4e | E4e E4e F4e G4e | G4e F4e E4e D4e | E4e F4e G4q | C4e C4e D4e D4e | E4e E4e F4e G4e | G4e F4e E4e D4e | E4e D4e C4q',
    },
    {
      id: 'g4-beethoven', grade: 4,
      title: 'السيمفونية التاسعة — بيتهوفن (بتصرف)',
      source: 'دليل المعلم — الصف الرابع، الدرس الثالث «عزف مقطوعة موسيقية على آلة الأورج»، النموذج (3)',
      key: 'C', beats: 2, tempo: 60,
      music: 'E4e E4e F4e G4e | G4e F4e E4e D4e | C4e C4e D4e E4e | E4q D4q | E4e E4e F4e G4e | G4e F4e E4e D4e | C4e C4e D4e E4e | D4q C4q',
    },
    {
      id: 'g5-mary', grade: 5,
      title: 'Mary Had a Little Lamb',
      source: 'دليل المعلم — الصف الخامس، الدرس الثاني «قراءة إيقاعية وصولفيج غنائي»، النموذج (2)',
      key: 'C', beats: 4, tempo: 100,
      music: 'E4q D4q C4q D4q | E4w | D4w | E4q G4q G4h | E4q D4q C4q D4q | E4w | D4h E4h | C4w',
    },
    {
      id: 'g6-sami', grade: 6,
      title: 'النموذج (1) — تأليف: محمد سامي محمد',
      source: 'دليل المعلم — الصف السادس، الدرس الثاني «قراءة إيقاعية وصولفيج غنائي»، النموذج (1)',
      key: 'C', beats: 4, tempo: 70,
      music: 'G4s G4e G4s G4q E4e C4e G4q | G4s G4e A4s G4e F4e E4e F4e D4q | F4s F4e F4s F4q E4e D4e F4q | G4s G4e A4s G4e F4e E4e F4e G4q | ' +
             'G4s G4e G4s G4q E4e C4e G4q | G4s G4e A4s G4e F4e E4e F4e D4q | F4s F4e F4s F4q E4e D4e F4q | G4s G4e G4s G4e G4e A4e B4e C5q',
    },
    {
      id: 'g7-mozart', grade: 7,
      title: 'Eine kleine Nachtmusik — موتسارت',
      source: 'دليل المعلم — الصف السابع، الدرس الثاني «قراءة إيقاعية وصولفيج غنائي»، النموذج (2)',
      key: 'C', beats: 4, tempo: 100, marks: { 7: { repeatEnd: true } },
      music: 'C5q. G4e C5q. G4e | C5e G4e C5e E5e G5q rq | F5q. D5e F5q. D5e | F5e D5e B4e D5e G4q rq | ' +
             'C5q C5q. E5e D5e C5e | C5e B4e B4q. D5e F5e B4e | D5e C5e C5q. E5e D5e C5e | C5e B4e B4e B4e C5h',
    },
  ];

  function lessonScore(id) {
    const L = LESSONS.find(l => l.id === id);
    if (!L) return null;
    const s = SC.emptyScore({ title: L.title, key: L.key, beats: L.beats, tempo: L.tempo });
    s.notes = parse(L.music);
    s.marks = L.marks ? JSON.parse(JSON.stringify(L.marks)) : {};
    s.composer = L.source;
    s.minMeasures = SC.layout(s).measures.length;
    return s;
  }

  // ------------------------------------------------ مولّد الإملاء اللحني
  // المستويات مبنية على تدرج الدروس:
  //  1: الصف 3–4 — النغمات الخمس الأولى من سلم دو (دو–صول)، حركة متصلة، نوار وكروش (طاتي)
  //  2: الصف 5–6 — من دو إلى دو الحادة، قفزات الثالثة، بلانش وروند
  //  3: الصف 7–8 — حتى صول أعلى المدرج، قفزات حتى الخامسة، نوار بوانتيه، وطفاتيفي
  const LEVELS = {
    1: { name: 'المستوى الأول — حركة متصلة (دو إلى صول)', low: -2, high: 2, maxLeap: 1,
         patterns: [[1], [1], [0.5, 0.5]], endLong: [1, 2] },
    2: { name: 'المستوى الثاني — قفزات صغيرة (دو إلى دو الحادة)', low: -2, high: 5, maxLeap: 2,
         patterns: [[1], [1], [0.5, 0.5], [2]], endLong: [2, 4] },
    3: { name: 'المستوى الثالث — مدى أوسع (دو إلى صول الحادة)', low: -2, high: 9, maxLeap: 4,
         patterns: [[1], [0.5, 0.5], [1.5, 0.5], [2], [0.25, 0.25, 0.25, 0.25]], endLong: [2, 4] },
  };

  function rnd(a) { return a[Math.floor(Math.random() * a.length)]; }

  function generate(opts) {
    const level = LEVELS[opts.level] || LEVELS[1];
    const keyName = opts.key || 'C';
    const key = T.KEYS[keyName];
    const beats = opts.beats || 4;
    const measures = opts.measures || 2;
    // درجات السلم داخل المدى: نجعل القرار عند أقرب موضع للمدى المطلوب
    const tonicPos0 = T.posOf({ step: key.tonic, octave: 4 });
    const shift = tonicPos0 - (-2); // نقيس المدى نسبةً لقرار السلم
    const low = level.low + shift, high = level.high + shift;
    // النغمات المسموحة (مواضع على المدرج)
    const allowed = []; for (let p = low; p <= high; p++) allowed.push(p);

    // 1) الإيقاع: نملأ كل مازورة بأنماط تبدأ على الوحدة
    const rhythm = [];
    for (let m = 0; m < measures; m++) {
      let left = beats;
      const isLast = m === measures - 1;
      const bucket = [];
      if (isLast) {
        const longOpts = level.endLong.filter(d => d <= beats);
        const endD = longOpts.length ? rnd(longOpts) : 1;
        left -= endD;
        while (left > 0) {
          const opt = level.patterns.filter(p => p.reduce((a, b) => a + b, 0) <= left);
          const p = rnd(opt); bucket.push(...p); left -= p.reduce((a, b) => a + b, 0);
        }
        bucket.push(endD);
      } else {
        while (left > 0) {
          const opt = level.patterns.filter(p => p.reduce((a, b) => a + b, 0) <= left);
          const p = rnd(opt); bucket.push(...p); left -= p.reduce((a, b) => a + b, 0);
        }
      }
      rhythm.push(...bucket);
    }
    // 2) اللحن: مسار يبدأ بالقرار أو الثالثة أو الخامسة، وينتهي بالقرار مقتربًا منه بدرجة متصلة
    const tonic = low; // القرار عند أسفل المدى
    const tonicHigh = tonic + 7 <= high ? tonic + 7 : null;
    const starts = [tonic, tonic + 2, tonic + 4].filter(p => p <= high);
    let cur = rnd(starts);
    const poses = [cur];
    for (let i = 1; i < rhythm.length; i++) {
      const remaining = rhythm.length - 1 - i;
      if (remaining === 0) {
        // الأخير: القرار الأقرب
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
    s.notes = rhythm.map((d, i) => {
      const p = T.pitchAtPos(poses[i]);
      const base = [4, 2, 1, 0.5, 0.25].find(b => Math.abs(b - d) < 1e-6) || (d === 1.5 ? 1 : d === 3 ? 2 : 1);
      const dots = (d === 1.5 || d === 3) ? 1 : 0;
      return SC.makeNote('note', { step: p.step, octave: p.octave, alter: null }, { base, dots });
    });
    return s;
  }

  MT.exercises = { LESSONS, LEVELS, parse, lessonScore, generate };
})(window.MT = window.MT || {});
