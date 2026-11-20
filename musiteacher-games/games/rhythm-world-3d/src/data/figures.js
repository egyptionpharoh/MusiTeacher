// =====================================================================
//  العلامات والسكتات والأشكال الإيقاعية — المصدر الوحيد لبيانات «عالم الإيقاع».
//  نموذج الزمن نفسه المستخدم في لعبة «التدوين والإملاء الإيقاعي»: النوار = 12 «تِك»
//  (يقبل القسمة على 4 للدوبل كروش وعلى 3 للتريوليه) فلا أخطاء تقريب.
//  ترتيب الظهور حسب الصف منقول من مستويات لعبة الإملاء الإيقاعي (rhythm-dictation/js/content.js).
//
//  لإضافة علامة جديدة: أضف عنصرًا في FIGURES (والأجزاء parts تكفي لرسمها ثنائيًا وثلاثيًا وسماعها)،
//  ثم أضف معرّفها إلى مستوى الصف المناسب في GRADE_ORDER، ونص التعريف في speech.js.
// =====================================================================

export const TPB = 12;                                     // تِك لكل وحدة (نوار)
export const BASE = { w: 48, h: 24, q: 12, e: 6, s: 3 };   // روند، بلانش، نوار، كروش، دوبل كروش

const p = (b, o) => Object.assign({ b, dot: 0, tup: 0, rest: false }, o || {});
export const partTicks = (x) => { let t = BASE[x.b]; if (x.dot) t = t * 3 / 2; if (x.tup === 3) t = t * 2 / 3; return t; };

// kind: note | rest | group · pair: السكتة المقابلة / العلامة المقابلة · hue: لون الشخصية
export const FIGURES = [
  { id: 'w',  name: 'الروند',        en: 'Whole note',      kind: 'note', parts: [p('w')], pair: 'rw', hue: '#e0574f', syl: 'تا-آ-آ-آ' },
  { id: 'h',  name: 'البلانش',       en: 'Half note',       kind: 'note', parts: [p('h')], pair: 'rh', hue: '#f08a2c', syl: 'تا-آ' },
  { id: 'q',  name: 'النوار',        en: 'Quarter note',    kind: 'note', parts: [p('q')], pair: 'rq', hue: '#2c9be0', syl: 'تا' },
  { id: 'e',  name: 'الكروش',        en: 'Eighth note',     kind: 'note', parts: [p('e')], pair: 're', hue: '#30b57a', syl: 'تي' },
  { id: 's',  name: 'الدوبل كروش',   en: 'Sixteenth note',  kind: 'note', parts: [p('s')], pair: 'rs', hue: '#8e5bd6', syl: 'تِف' },
  { id: 'hd', name: 'البلانش بوانتيه', en: 'Dotted half note', kind: 'note', parts: [p('h', { dot: 1 })], hue: '#d4632a', syl: 'تا-آ-آ' },
  { id: 'qd', name: 'النوار بوانتيه',  en: 'Dotted quarter note', kind: 'note', parts: [p('q', { dot: 1 })], hue: '#1f7fbf', syl: 'تا-آي' },
  { id: 'rw', name: 'سكتة الروند',      en: 'Whole rest',     kind: 'rest', parts: [p('w', { rest: true })], pair: 'w', hue: '#9c4a45' },
  { id: 'rh', name: 'سكتة البلانش',     en: 'Half rest',      kind: 'rest', parts: [p('h', { rest: true })], pair: 'h', hue: '#a8682c' },
  { id: 'rq', name: 'سكتة النوار',      en: 'Quarter rest',   kind: 'rest', parts: [p('q', { rest: true })], pair: 'q', hue: '#2b6f9e' },
  { id: 're', name: 'سكتة الكروش',      en: 'Eighth rest',    kind: 'rest', parts: [p('e', { rest: true })], pair: 'e', hue: '#2c7f5a' },
  { id: 'rs', name: 'سكتة الدوبل كروش', en: 'Sixteenth rest', kind: 'rest', parts: [p('s', { rest: true })], pair: 's', hue: '#6a4a9c' },
  // أشكال مركّبة (بأسماء إيمي باري كما في لعبة الإملاء الإيقاعي وأدلة المعلم)
  { id: 'ee',   name: 'تاتي',     en: 'Two eighths',          kind: 'group', parts: [p('e'), p('e')], hue: '#30b57a', syl: 'تا-تي' },
  { id: 'ssss', name: 'تفاتيفي',  en: 'Four sixteenths',      kind: 'group', parts: [p('s'), p('s'), p('s'), p('s')], hue: '#8e5bd6', syl: 'تفا-تيفي' },
  { id: 'ss',   name: 'تيفي',     en: 'Two sixteenths',       kind: 'group', parts: [p('s'), p('s')], hue: '#8e5bd6', syl: 'تيفي' },
  { id: 'ess',  name: 'تاتيفي',   en: 'Eighth + two 16ths',   kind: 'group', parts: [p('e'), p('s'), p('s')], hue: '#2a9d8f', syl: 'تا-تيفي' },
  { id: 'sse',  name: 'تفاتي',    en: 'Two 16ths + eighth',   kind: 'group', parts: [p('s'), p('s'), p('e')], hue: '#2a9d8f', syl: 'تفا-تي' },
  { id: 'ses',  name: 'تفافي',    en: '16th + eighth + 16th', kind: 'group', parts: [p('s'), p('e'), p('s')], hue: '#2a9d8f', syl: 'تفا-في' },
  { id: 'eds',  name: 'تافي',     en: 'Dotted eighth + 16th', kind: 'group', parts: [p('e', { dot: 1 }), p('s')], hue: '#c0507a', syl: 'تا-في' },
  { id: 'sed',  name: 'تفا',      en: '16th + dotted eighth', kind: 'group', parts: [p('s'), p('e', { dot: 1 })], hue: '#c0507a', syl: 'تفا' },
  { id: 'trip', name: 'تريوليه',  en: 'Eighth-note triplet',  kind: 'group', parts: [p('e', { tup: 3 }), p('e', { tup: 3 }), p('e', { tup: 3 })], hue: '#b5862c', syl: 'تري-يو-ليه' },
];
export const FIG = {};
FIGURES.forEach((f) => { f.ticks = f.parts.reduce((a, x) => a + partTicks(x), 0); f.beats = f.ticks / TPB; FIG[f.id] = f; });

/** القيمة الزمنية نصًا عربيًا: «زمن واحد»، «نصف زمن»، «زمن ونصف»… (بالنسبة إلى النوار) */
export function valueText(ticks) {
  const MAP = { 48: 'أربعة أزمنة', 36: 'ثلاثة أزمنة', 24: 'زمنان', 18: 'زمن ونصف', 12: 'زمن واحد', 9: 'ثلاثة أرباع الزمن', 8: 'ثلثا الزمن', 6: 'نصف زمن', 4: 'ثلث زمن', 3: 'ربع زمن' };
  return MAP[ticks] || beatsNum(ticks) + ' زمن';
}
/** القيمة رقمًا مختصرًا: 4 ، 2 ، 1 ، ½ ، ¼ ، 1½ */
export function beatsNum(ticks) {
  const whole = Math.floor(ticks / TPB), rem = ticks % TPB; const FR = { 3: '¼', 4: '⅓', 6: '½', 8: '⅔', 9: '¾' };
  if (!rem) return String(whole); const fr = FR[rem] || rem + '/12'; return whole ? whole + fr : fr;
}

// ---------------------------------------------------------------- الصفوف
// المستويات 1–8 منقولة كما هي من لعبة الإملاء الإيقاعي (مرتبطة بالصفوف 1–8 ودروس الأدلة).
// الصفوف 9–12: لا يوجد لها توزيع خاص في لعبة الإملاء، فتُفتح لها كل العلامات مع عرض متقدّم.
export const GRADE_ORDER = [
  { grade: 1, add: ['q', 'rq'], lesson: 'العلامة الإيقاعية النوار والسكتة المقابلة لها' },
  { grade: 2, add: ['h', 'rh'], lesson: 'العلامة الإيقاعية البلانش والسكتة المقابلة لها' },
  { grade: 3, add: ['ee', 'ssss', 'ss'], lesson: 'الشكل الإيقاعي (طفاتيفي)' },
  { grade: 4, add: ['ess', 'sse'], lesson: 'الشكل الإيقاعي (طفاتي)' },
  { grade: 5, add: ['w', 'rw'], lesson: 'العلامة الإيقاعية (الروند) والسكتة المقابلة لها · الميزان الرباعي' },
  { grade: 6, add: ['e', 're', 's', 'rs', 'ses'], lesson: 'الأزمنة الأساسية وتقسيماتها · الشكل الإيقاعي (طفافي)' },
  { grade: 7, add: ['qd', 'hd', 'eds', 'sed'], lesson: 'الرباط الزمني والنقطة الزمنية · الشكلان الإيقاعيان (تافي & تافا)' },
  { grade: 8, add: ['trip'], lesson: 'إيقاع التريوليه · الإملاء الإيقاعي' },
];
export const GRADES = Array.from({ length: 12 }, (_, i) => i + 1);
export const GRADE_NAMES = ['الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس', 'السابع', 'الثامن', 'التاسع', 'العاشر', 'الحادي عشر', 'الثاني عشر'];
/** المرحلة: young (1–3) · mid (4–7) · upper (8–12) — تحدد طول الشرح وعمقه */
export const band = (g) => (g <= 3 ? 'young' : g <= 7 ? 'mid' : 'upper');
/** كل ما يُسمح به للصف (تراكمي) */
export function allowedFor(grade) { const out = []; GRADE_ORDER.forEach((L) => { if (L.grade <= grade) out.push(...L.add); }); return out; }
/** الجديد في الصف */
export function newIn(grade) { const L = GRADE_ORDER.find((x) => x.grade === grade); return L ? L.add : []; }
export function gradeIntroduced(id) { const L = GRADE_ORDER.find((x) => x.add.includes(id)); return L ? L.grade : null; }

/** العلامات المفردة (شخصيات) مرتبة من الأطول للأقصر، والسكتات بعدها */
export const SINGLE_NOTES = ['w', 'h', 'q', 'e', 's', 'hd', 'qd'];
export const RESTS = ['rw', 'rh', 'rq', 're', 'rs'];
export const GROUPS = ['ee', 'ssss', 'ss', 'ess', 'sse', 'ses', 'eds', 'sed', 'trip'];

/** الشخصيات المتاحة للصف بترتيب العرض: العلامات المفردة، ثم الأشكال المركّبة، ثم السكتات */
export function charactersFor(grade) {
  const al = new Set(allowedFor(grade));
  return [...SINGLE_NOTES, ...GROUPS, ...RESTS].filter((id) => al.has(id));
}

// ---------------------------------------------------------------- الخط الزمني المسموع
/** [{t, d, rest, fig, part}] بالتِك لتسلسل معرّفات */
export function timeline(ids) {
  const out = []; let t = 0;
  ids.forEach((id, fi) => { const f = FIG[id]; if (!f) return; f.parts.forEach((x, pi) => { const d = partTicks(x); out.push({ t, d, rest: !!x.rest, fi, pi }); t += d; }); });
  return out;
}
export const seqTicks = (ids) => ids.reduce((a, id) => a + (FIG[id] ? FIG[id].ticks : 0), 0);
