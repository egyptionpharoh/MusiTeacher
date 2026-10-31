// ============================================================================
// theory.js — نظرية الموسيقى المستخدمة في اللعبة (دوال خالصة، بلا واجهة)
// • أسماء النغمات الصولفائية ومواضعها على المدرج (مفتاح صول)
// • السلالم وعلامات التحويل الأساسية
// • القيم الزمنية وأسماؤها، ومقاطع القراءة الإيقاعية بطريقة (إيمي باري)
// • أسماء الأشكال الإيقاعية كما في لعبة «مسابقة التدوين والإملاء الإيقاعي»
// ============================================================================
(function (MT) {
  'use strict';

  const STEPS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
  const STEP_SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const SOLFEGE = { C: 'دو', D: 'ري', E: 'مي', F: 'فا', G: 'صول', A: 'لا', B: 'سي' };
  const ACC_NAME = { '1': 'دييز', '-1': 'بيمول', '0': 'بيكار' };
  const ACC_SIGN = { '1': '♯', '-1': '♭', '0': '♮' };

  // السلالم المتاحة: دو الكبير هو سلم الدروس الأساسي، والبقية للتوسع
  const KEYS = {
    C: { name: 'دو الكبير', tonic: 'C', alters: {}, sig: [] },
    G: { name: 'صول الكبير', tonic: 'G', alters: { F: 1 }, sig: [{ step: 'F', octave: 5, alter: 1 }] },
    D: { name: 'ري الكبير', tonic: 'D', alters: { F: 1, C: 1 }, sig: [{ step: 'F', octave: 5, alter: 1 }, { step: 'C', octave: 5, alter: 1 }] },
    F: { name: 'فا الكبير', tonic: 'F', alters: { B: -1 }, sig: [{ step: 'B', octave: 4, alter: -1 }] },
    Bb: { name: 'سي بيمول الكبير', tonic: 'B', tonicAlter: -1, alters: { B: -1, E: -1 }, sig: [{ step: 'B', octave: 4, alter: -1 }, { step: 'E', octave: 5, alter: -1 }] },
  };

  // نطاق التدوين المسموح: من لا (A3) تحت المدرج حتى دو (C6) فوقه
  const MIN_POS = -4;  // A3
  const MAX_POS = 12;  // C6

  // ---- المواضع: pos = 0 هو الخط الأول (مي E4)، وكل درجة = نصف مسافة ----
  function diatonic(step, octave) { return octave * 7 + STEPS.indexOf(step); }
  function posOf(p) { return diatonic(p.step, p.octave) - 30; }
  function pitchAtPos(pos) {
    const d = pos + 30;
    return { step: STEPS[((d % 7) + 7) % 7], octave: Math.floor(d / 7) };
  }
  function midiOf(step, octave, alter) { return (octave + 1) * 12 + STEP_SEMI[step] + (alter || 0); }
  function freqOfMidi(m) { return 440 * Math.pow(2, (m - 69) / 12); }

  // وصف الموضع على المدرج بلغة الدرس (الخط/المسافة)
  function posDescription(pos) {
    const lineNames = ['الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس'];
    const spaceNames = ['الأولى', 'الثانية', 'الثالثة', 'الرابعة'];
    if (pos >= 0 && pos <= 8) {
      return pos % 2 === 0 ? 'على الخط ' + lineNames[pos / 2] : 'في المسافة ' + spaceNames[(pos - 1) / 2];
    }
    if (pos === -1) return 'تحت الخط الأول';
    if (pos === 9) return 'فوق الخط الخامس';
    const below = pos < 0;
    const k = below ? Math.floor((-pos) / 2) : Math.floor((pos - 8) / 2);
    const onLine = pos % 2 === 0;
    const ord = ['', 'الأول', 'الثاني', 'الثالث', 'الرابع'][k] || String(k);
    if (onLine) return 'على الخط الإضافي ' + ord + (below ? ' أسفل المدرج' : ' أعلى المدرج');
    return (below ? 'تحت' : 'فوق') + ' الخط الإضافي ' + ord + (below ? ' أسفل المدرج' : ' أعلى المدرج');
  }

  // ---- القيم الزمنية (بوحدة النوار = 1) ----
  const VALUES = [
    { base: 4, key: 'whole', name: 'روند', rest: 'سكتة روند' },
    { base: 2, key: 'half', name: 'بلانش', rest: 'سكتة بلانش' },
    { base: 1, key: 'quarter', name: 'نوار', rest: 'سكتة نوار' },
    { base: 0.5, key: 'eighth', name: 'كروش', rest: 'سكتة كروش' },
    { base: 0.25, key: '16th', name: 'دوبل كروش', rest: 'سكتة دوبل كروش' },
  ];
  const VALUE_BY_BASE = {}; const VALUE_BY_KEY = {};
  VALUES.forEach(v => { VALUE_BY_BASE[v.base] = v; VALUE_BY_KEY[v.key] = v; });

  function durationOf(rhythm) { return rhythm.base * (rhythm.dots ? 1.5 : 1); }
  function valueName(kind, rhythm) {
    const v = VALUE_BY_BASE[rhythm.base];
    if (!v) return '؟';
    return (kind === 'rest' ? v.rest : v.name) + (rhythm.dots ? ' بوانتيه' : '');
  }
  function beatsText(d) {
    const map = { 0.25: 'ربع زمن', 0.5: 'نصف زمن', 0.75: 'ثلاثة أرباع الزمن', 1: 'زمن واحد', 1.5: 'زمن ونصف', 2: 'زمنان', 3: 'ثلاثة أزمنة', 4: 'أربعة أزمنة' };
    if (map[d] !== undefined) return map[d];
    return String(+d.toFixed(2)) + ' زمن';
  }

  // ---- القراءة الإيقاعية بطريقة (إيمي باري) ----
  // المقطع يُحدَّد بموضع بداية العلامة داخل الوحدة الأساسية (النوار):
  //   بداية الوحدة = طا ، الربع = فا ، المنتصف = تي ، ثلاثة الأرباع = في
  // وكل وحدة إضافية تمتد فيها العلامة يُضاف لها «آ» (مثل: بلانش = طا-آ ، روند = طا-آ-آ-آ)
  const ONSET_SYL = { 0: 'طا', 0.25: 'فا', 0.5: 'تي', 0.75: 'في' };
  function q(x) { return Math.round(x * 1000) / 1000; }
  function syllableFor(start, dur, isRest, tiedFromPrev) {
    if (isRest) return '(سكتة)';
    const frac = q(start - Math.floor(start + 1e-9));
    let first = tiedFromPrev ? 'آ' : (ONSET_SYL[frac] || 'طا');
    // عدد حدود الوحدات التي تعبرها العلامة
    const end = q(start + dur);
    let crossings = 0;
    for (let b = Math.floor(start + 1e-9) + 1; b < end - 1e-9; b++) crossings++;
    const parts = [first];
    for (let i = 0; i < crossings; i++) parts.push('آ');
    return parts.join('-');
  }

  // أسماء الأشكال الإيقاعية (وحدة زمنية واحدة) — مطابقة لأسماء لعبة الإملاء الإيقاعي
  const SHAPES = {
    '0|0.5': 'طاتي',
    '0|0.25|0.5|0.75': 'طفاتيفي',
    '0|0.5|0.75': 'طاتيفي',
    '0|0.25|0.5': 'طفاتي',
    '0|0.25|0.75': 'طفافي',
    '0|0.75': 'طافي',
    '0|0.25': 'طافا',
  };
  function shapeNameForBeat(onsets) { return SHAPES[onsets.map(q).join('|')] || null; }

  MT.theory = {
    STEPS, SOLFEGE, ACC_NAME, ACC_SIGN, KEYS, MIN_POS, MAX_POS, VALUES, VALUE_BY_BASE, VALUE_BY_KEY,
    diatonic, posOf, pitchAtPos, midiOf, freqOfMidi, posDescription,
    durationOf, valueName, beatsText, syllableFor, shapeNameForBeat, q,
    solfegeName(step, alter) {
      const base = SOLFEGE[step];
      if (alter === 1) return base + ' دييز';
      if (alter === -1) return base + ' بيمول';
      return base;
    },
    shortName(step, alter) { // للعرض تحت النغمة
      const base = SOLFEGE[step];
      if (alter === 1) return base + '♯';
      if (alter === -1) return base + '♭';
      return base;
    },
  };
})(window.MT = window.MT || {});
