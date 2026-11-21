// =====================================================================
//  مكتبة الضروب والتمارين — بيانات فقط.
//  صيغة المدوّنة (كما في لعبة «إيقاعات الفنون العُمانية»): موازير يفصلها «|»، وكل علامة = حرف + مدتها بعدد الدوبل كروش (1/16):
//    D دُم (رأس سفلي وساق إلى أعلى) · T تك (رأس علوي وساق إلى أسفل) · K تك باليد اليسرى «كا» (تُكتب كالتك وتحتها «ك») · R سكتة
//    1 دوبل كروش · 2 كروش · 3 كروش منقوط · 4 نوار · 6 نوار منقوط
//    [ ... ] علامات موصولة بعارضة · > نبر · ~ رباط مع العلامة التالية (لا ضربة جديدة)
//  لا تُضاف هنا مدوّنة ضرب تقليدي إلا من مصدر مذكور في sources؛ والتمارين التعليمية مصنّفة «تمرين» بوضوح.
// =====================================================================

export const SOURCES = {
  frishkopf: { cite: 'M. Frishkopf — Arab Durub charts (University of Alberta, 2009)', url: 'https://sites.ualberta.ca/~michaelf/Theory/Durub%20chart%20rev%202009.pdf' },
  frishkopfEns: { cite: 'M. Frishkopf — UAlberta Middle Eastern and North African Music Ensemble: Percussion pieces (D/T/iss في 8 خانات)', url: 'https://www.artsrn.ualberta.ca/fwa_mediawiki/index.php/Percussion_pieces' },
  organology: { cite: 'Organology — Middle Eastern rhythms (Maqsum, Baladi, Saidi, Wahda, Wahda Kabira, Malfuf)' },
  wiki: { cite: 'Wikipedia — Maqsum / Baladi (Arabic rhythms)' },
  maqamworld: { cite: 'Maqam World — Iqaat: Maqsum 4/4، Wahda 4/4، Wahda Kabira 8/4، Sama‘i Darij 3/4، Malfuf 2/4 (الموازين فقط)' },
  babayaga: { cite: 'BabaYagaMusic — Middle Eastern rhythm diagrams (Valz / Darij)', url: 'https://www.babayagamusic.com/Music/oriental-dance-rhythm-diagrams-and-descriptions.htm' },
  g5: { cite: 'وزارة التربية والتعليم (2025). سلطنة عُمان. دليل المعلم: المهارات الموسيقية، الصف الخامس — الوحدة الثالثة، ص 74–78' },
  g6: { cite: 'وزارة التربية والتعليم (2025). سلطنة عُمان. دليل المعلم لمادة المهارات الموسيقية للصف السادس — الوحدة الثالثة، ص 14–17' },
  g7: { cite: 'وزارة التربية والتعليم (2026). سلطنة عُمان. دليل المعلم لمادة المهارات الموسيقية للصف السابع — الوحدة الثالثة، ص 70–74' },
  g8: { cite: 'وزارة التربية والتعليم (2026). سلطنة عُمان. دليل المعلم لمادة المهارات الموسيقية، الصف الثامن — الوحدة الأولى، ص 13–19' },
};

/** الضروب العربية: الهيكل الأساسي لكل ضرب كما تتفق عليه المصادر المذكورة (بلا زخارف) */
export const DURUB = [
  { id: 'maqsum', name: 'المقسوم', meter: [4, 4], bpm: 96, p: '[D2> T2] R2 T2 D2 R2 T2 R2', src: ['frishkopf', 'frishkopfEns', 'wiki', 'organology', 'maqamworld'],
    note: 'دُم تك – تك دُم – تك – (بالكروش). يورد جدول Frishkopf لهذا الضرب أسماءً أخرى منها «دويك» و«واحدة ونص»، وتختلف التسميات بين البلدان.' },
  { id: 'baladi', name: 'البلدي (المصمودي الصغير)', meter: [4, 4], bpm: 92, p: '[D2> D2] R2 T2 D2 R2 T2 R2', src: ['frishkopf', 'frishkopfEns', 'wiki', 'organology'], note: 'دُم دُم – تك دُم – تك –.' },
  { id: 'saidi', name: 'الصعيدي', meter: [4, 4], bpm: 100, p: '[D2> T2] R2 D2 D2 R2 T2 R2', src: ['frishkopf', 'frishkopfEns', 'organology'], note: 'دُم تك – دُم دُم – تك –.' },
  { id: 'wahda', name: 'الوحدة', meter: [4, 4], bpm: 84, p: 'D6> T2 R4 T2 R2', src: ['frishkopfEns', 'organology', 'maqamworld'], note: 'دُم – – تك – – تك – (بالكروش).' },
  { id: 'wahda_kabira', name: 'الوحدة الكبيرة', meter: [8, 4], bpm: 80, p: 'D6> T2 R4 T2 R2 D4 R4 T4 R4', src: ['organology', 'maqamworld'],
    note: 'امتداد لضرب «الوحدة» على ميزان 8/4 كما في Maqam World وOrganology: دُم – – تك – – تك – دُم – – – تك – – –. تنبيه: يستخدم جدول Frishkopf الاسم نفسه لصيغة من أربع نبضات.' },
  { id: 'malfuf', name: 'الملفوف', meter: [2, 4], bpm: 104, p: '[D3> T3 T2] | [D3> T3 T2]', src: ['frishkopfEns', 'organology', 'maqamworld'], note: 'دُم – – تك – – تك – (بالدوبل كروش).' },
  { id: 'ayyub', name: 'أيوب', meter: [2, 4], bpm: 100, p: '[D3> T1 D2 T2] | [D3> T1 D2 T2]', src: ['frishkopf', 'frishkopfEns'], note: 'دُم – – تك دُم – تك – (بالدوبل كروش) كما في Frishkopf.' },
  { id: 'waltz', name: 'الفالس / السماعي الدارج', meter: [3, 4], bpm: 108, p: 'D4> T4 T4 | D4> T4 T4', src: ['frishkopf', 'babayaga', 'maqamworld'],
    note: 'الهيكل الأساسي: دُم تك تك (التك الأولى اختيارية في جدول Frishkopf). يذكر Frishkopf صيغة مزخرفة للسماعي الدارج لم نعتمدها لعدم وضوح توزيعها في الجدول.' },
];

/** أسماء مطلوبة لم يتوفر لها تدوين مستقل موثّق (تظهر في القائمة معطّلة بشفافية) */
export const PENDING = [
  { name: 'دويك', why: 'لم نجد له تدوينًا مستقلًا متفقًا عليه؛ ويذكره Frishkopf اسمًا آخر للمقسوم.' },
];

/** فنون عُمانية: مسار الكاسر أو الرحماني منقولًا كما ورد في نماذج أدلة المعلم */
export const OMANI = [
  { id: 'razha', name: 'الرزحة', meter: [2, 4], bpm: 96, src: ['g5'], tracks: { rahmani: 'D4 T4 | [D2 D2] T4', kasir: '[D3 T1] [D3 T1] | [D3 T1] [D3 T1]' } },
  { id: 'kitha', name: 'الكيذا (الكاذي)', meter: [2, 4], bpm: 92, src: ['g5'], tracks: { rahmani: '[D3 T1~] [T2 T2] | [D3 T1~] [T2 T2]', kasir: '[D2 T1 T1] [D2 T1 T1] | [D2 T1 T1] [D2 T1 T1]' } },
  { id: 'madima', name: 'المديمة', meter: [6, 8], bpm: 76, src: ['g6'], tracks: { rahmani: 'D6 T6 | D6 T6', kasir: 'R2 T2 D2 R2 T2 D2 | R2 T2 D2 R2 T2 D2' } },
  { id: 'hambura', name: 'الحمبورة', meter: [4, 4], bpm: 110, src: ['g6'], tracks: { kasir: 'D4 [T2 T2] D4 [T2 T2] | D4 [T2 T2] D4 [T2 T2]', rahmani: 'D6 T2 D4 T4 | [D2 T2] [D2 T2] D4 T4' },
    note: 'السرعة في الدليل ♩ = 220؛ الافتراضي هنا أبطأ للتعلّم ويُرفع من شريط السرعة.' },
  { id: 'ayyala', name: 'العيالة', meter: [3, 4], bpm: 126, src: ['g7'], tracks: { rahmani: 'D4 T4 T4 | D4 T4 R4 | D4 T4 T4 | D4 T4 R4', kasir: 'D4 T4 T4 | D4 T4 R2 T2 | D4 T4 T4 | D4 T4 R2 T2' } },
  { id: 'wailiya', name: 'الوِيلية', meter: [2, 4], bpm: 84, src: ['g7'], tracks: { rahmani: 'D2 [T1 T1>] [T2 T2>] | D2 [T1 T1>] [T2 T2>]', kasir: 'R2 [D1 D1] D4 | R1 [D2 D1] D4' } },
  { id: 'baraa', name: 'البرعة', meter: [2, 4], bpm: 88, src: ['g8'], tracks: { rahmani: 'D3 T1 R2 T2', kasir: 'R2 T2 D3 T1' } },
  { id: 'tabl_nisa', name: 'طبل النساء', meter: [2, 4], bpm: 96, src: ['g8'], tracks: { rahmani: 'D2 T2 T2 T2', kasir: 'D2 T2 T2 T2' } },
];

/** تمارين تعليمية متدرجة (من تصميم اللعبة، وليست ضروبًا تقليدية): level 1–3 */
export const EXERCISES = [
  { id: 'ex24a', name: 'دُم وتك بالنوار', meter: [2, 4], level: 1, bpm: 80, p: 'D4> T4 | D4> T4', skills: 'دُم · تك · نبر أول الميزان' },
  { id: 'ex24b', name: 'سكتة في الضغط الضعيف', meter: [2, 4], level: 1, bpm: 80, p: 'D4> R4 | D4> T4', skills: 'سكتة نوار' },
  { id: 'ex24c', name: 'كروش متتالية', meter: [2, 4], level: 2, bpm: 84, p: '[D2> T2] [T2 T2] | [D2> T2] T4', skills: 'كروش · عوارض' },
  { id: 'ex34a', name: 'ميزان ثلاثي', meter: [3, 4], level: 1, bpm: 88, p: 'D4> T4 T4 | D4> T4 R4', skills: 'قوية – ضعيفة – ضعيفة · سكتة' },
  { id: 'ex34b', name: 'ثلاثي بالكروش', meter: [3, 4], level: 2, bpm: 88, p: 'D4> [T2 T2] [T2 T2] | D4> R4 [T2 T2]', skills: 'كروش · سكتة' },
  { id: 'ex44a', name: 'رباعي بالنوار', meter: [4, 4], level: 1, bpm: 84, p: 'D4> T4 D4 T4', skills: 'نبر قوي ونبر متوسط' },
  { id: 'ex44b', name: 'رباعي مع سكتات', meter: [4, 4], level: 2, bpm: 84, p: 'D4> R4 T4 T4 | [D2 D2] R4 T4 R4', skills: 'سكتات · دُم مزدوجة' },
  { id: 'ex44c', name: 'نبر على التك', meter: [4, 4], level: 3, bpm: 80, p: '[D2> T2] [T2 T2>] [D2 T2] [T2 T2>]', skills: 'نبر في غير أول الميزان' },
  { id: 'ex44k', name: 'تك باليدين', meter: [4, 4], level: 3, bpm: 76, p: '[D2> K2] [T2 K2] [D2 K2] [T2 K2]', skills: 'تك اليمنى وتك اليسرى (كا)', needsKa: true },
  { id: 'ex68a', name: 'ميزان مركّب 6/8', meter: [6, 8], level: 2, bpm: 66, p: '[D2> T2 T2] [D2 T2 T2] | [D2> T2 T2] D4 R2', skills: 'نبضة النوار المنقوط' },
];
export const LEVEL_AR = { 1: 'مبتدئ', 2: 'متوسط', 3: 'متقدم' };

// ---------------------------------------------------------------------
//  التحليل: موازير، علامات، ضربات
// ---------------------------------------------------------------------
export function unitsPerBeat(meter) { return meter[1] === 8 ? 6 : 4; }
export function unitsPerBar(meter) { return meter[1] === 8 ? meter[0] * 2 : meter[0] * 4; }

/** { bars:[[note]], hits:[{u,k,acc}], total } — u بالدوبل كروش من البداية */
export function parsePattern(p, meter) {
  const upbar = unitsPerBar(meter);
  let u = 0, beamId = 0, inBeam = 0, tiedNext = false;
  const hits = [];
  const bars = p.split('|').map((barStr, bi) => {
    const notes = [];
    for (let tok of barStr.trim().split(/\s+/)) {
      if (!tok) continue;
      if (tok[0] === '[') { inBeam = ++beamId; tok = tok.slice(1); }
      let close = false;
      if (tok.endsWith(']')) { close = true; tok = tok.slice(0, -1); }
      const m = /^([DTKR])(\d+)(>?)(~?)$/.exec(tok);
      if (!m) throw new Error(`علامة غير مفهومة: ${tok}`);
      const n = { k: m[1], d: +m[2], acc: !!m[3], tie: !!m[4], tied: tiedNext, beam: inBeam, u, bar: bi };
      if (n.k !== 'R' && !n.tied) hits.push({ u, k: n.k, acc: n.acc, ni: notes.length, bar: bi });
      tiedNext = n.tie; u += n.d; notes.push(n);
      if (close) inBeam = 0;
    }
    const len = notes.reduce((s, n) => s + n.d, 0);
    if (len !== upbar) throw new Error(`مازورة ${bi + 1} طولها ${len} والمطلوب ${upbar}: ${barStr}`);
    return notes;
  });
  return { bars, hits, total: u };
}
export const strokeOfK = (k) => (k === 'D' ? 'dum' : k === 'K' ? 'ka' : 'tak');

/** يبني «قطعة» قابلة للعزف والرسم */
export function buildPiece(def) {
  const parsed = parsePattern(def.p, def.meter);
  return { ...def, ...parsed, upb: unitsPerBeat(def.meter), upbar: unitsPerBar(def.meter), barsN: parsed.total / unitsPerBar(def.meter) };
}

/** القائمة المتاحة لآلة: مجموعات للقائمة المنسدلة */
export function catalog(inst, hasKa, mine = []) {
  const g = [];
  g.push({ label: 'ضروب عربية (هيكل الضرب من مصادر موثّقة)', items: DURUB.map((d) => ({ ...d, kind: 'durub' })) });
  const om = OMANI.filter((a) => a.tracks[inst.id]).map((a) => ({ id: 'om_' + a.id, name: `${a.name} — مسار ${inst.name}`, meter: a.meter, bpm: a.bpm, p: a.tracks[inst.id], src: a.src, note: a.note || '', kind: 'omani' }));
  if (om.length) g.push({ label: 'فنون عُمانية (من نماذج أدلة المعلم)', items: om });
  for (const lv of [1, 2, 3]) {
    const items = EXERCISES.filter((e) => e.level === lv && (!e.needsKa || hasKa)).map((e) => ({ ...e, kind: 'exercise' }));
    if (items.length) g.push({ label: `تمارين متدرجة — ${LEVEL_AR[lv]}`, items });
  }
  if (mine.length) g.push({ label: 'تماريني', items: mine.map((m) => ({ ...m, kind: 'mine' })) });
  return g;
}
