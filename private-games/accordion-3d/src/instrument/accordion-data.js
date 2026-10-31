// =====================================================================
//  بيانات الأكورديون: أكورديون بيانو 34 مفتاحًا / 48 باص (ستراديلا) — حجم مناسب للمبتدئين والتعليم.
//  هذا الملف بيانات فقط (لا مشهد ولا صوت): ترتيب المفاتيح، أزرار الباص، النغمات، وأسماء الأجزاء وشرحها.
// =====================================================================

export const NOTE_AR = ['دو', 'دو♯', 'ري', 'ري♯', 'مي', 'فا', 'فا♯', 'صول', 'صول♯', 'لا', 'لا♯', 'سي'];
export const NOTE_EN = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
const BLACK = new Set([1, 3, 6, 8, 10]);
export const isBlack = (midi) => BLACK.has(((midi % 12) + 12) % 12);
export const noteName = (midi, lang = 'ar') => (lang === 'ar' ? NOTE_AR : NOTE_EN)[((midi % 12) + 12) % 12] + (lang === 'ar' ? '' : String(Math.floor(midi / 12) - 1));

// ---------- اليد اليمنى: 34 مفتاحًا من فا3 (53) إلى ري6 (86) ----------
export const TREBLE_LOW = 53, TREBLE_HIGH = 86;
export const TREBLE = (() => {
  const keys = []; let wi = 0;
  for (let m = TREBLE_LOW; m <= TREBLE_HIGH; m++) {
    const black = isBlack(m);
    if (!black) keys.push({ id: 'k' + m, midi: m, black: false, slot: wi++ });
    else keys.push({ id: 'k' + m, midi: m, black: true, slot: wi - 0.5 });    // يقع بين الأبيضين
  }
  return keys;
})();
export const WHITE_COUNT = TREBLE.filter((k) => !k.black).length;   // 20

// ---------- اليد اليسرى: 48 زرًا (ستراديلا) — 8 أعمدة × 6 صفوف ----------
// الأعمدة بدائرة الخامسات (من الأسفل إلى الأعلى)، والصفوف: كونترباص، باص، ماجور، مينور، سابع، منقوص.
export const BASS_COLUMNS = [3, 10, 5, 0, 7, 2, 9, 4];                   // مي♭ سي♭… (pitch classes): Eb Bb F C G D A E
export const BASS_ROWS = [
  { id: 'counter', ar: 'كونترباص', desc: 'نغمة الثلث الكبير فوق الجذر' },
  { id: 'bass', ar: 'باص أساسي', desc: 'نغمة الجذر' },
  { id: 'major', ar: 'وتر ماجور', desc: 'ثلاثي ماجور' },
  { id: 'minor', ar: 'وتر مينور', desc: 'ثلاثي مينور' },
  { id: 'seventh', ar: 'وتر سابع', desc: 'وتر السابعة السائدة' },
  { id: 'dim', ar: 'وتر منقوص', desc: 'ثلاثي منقوص' },
];
export const BASS = (() => {
  const out = [];
  BASS_COLUMNS.forEach((pc, col) => BASS_ROWS.forEach((row, r) => {
    let notes;
    const root = 36 + pc;                                    // الجذر في الأوكتاف الثاني (36..47)
    const ch = 48 + pc;                                      // الوتر في الأوكتاف الثالث
    if (row.id === 'bass') notes = [root];
    else if (row.id === 'counter') notes = [36 + ((pc + 4) % 12) + 12];   // الثلث الكبير (أعلى من الجذر)
    else if (row.id === 'major') notes = [ch, ch + 4, ch + 7];
    else if (row.id === 'minor') notes = [ch, ch + 3, ch + 7];
    else if (row.id === 'seventh') notes = [ch + 4, ch + 7, ch + 10];
    else notes = [ch, ch + 3, ch + 6];
    // نُنزل الأوتار التي تجاوزت سي4 (71) أوكتافًا
    notes = notes.map((n) => (n > 66 ? n - 12 : n));
    const pcName = NOTE_AR[pc];
    out.push({ id: `b${col}_${r}`, col, row: r, pc, kind: row.id, notes, label: row.id === 'major' || row.id === 'bass' || row.id === 'counter' ? pcName : row.id === 'minor' ? pcName + ' م' : row.id === 'seventh' ? pcName + '٧' : pcName + '°', title: `${row.ar} — ${pcName}` });
  }));
  return out;
})();
export const bassById = Object.fromEntries(BASS.map((b) => [b.id, b]));
export const keyByMidi = Object.fromEntries(TREBLE.map((k) => [k.midi, k]));
export const bassFor = (pc, kind) => BASS.find((b) => b.pc === ((pc % 12) + 12) % 12 && b.kind === kind);

// ---------- أجزاء الآلة (وضع التعرّف) ----------
export const PARTS = {
  keyboard: { ar: 'لوحة المفاتيح (اليد اليمنى)', text: '34 مفتاحًا (من فا٣ إلى ري٦) على الجانب الأيمن للآلة. تعزف بها اللحن، وكل مفتاح يفتح صمّامًا يُدخل الهواء إلى قصبة النغمة المطلوبة.' },
  whitekey: { ar: 'مفتاح أبيض', text: 'نغمة طبيعية (دو ري مي فا صول لا سي). لا يصدر صوت إلا والمنفاخ يتحرك.' },
  blackkey: { ar: 'مفتاح أسود', text: 'نغمة محوّلة (دييز أو بيمول). يقع أعلى قليلًا من الأبيض ويُضغط بطرف الإصبع.' },
  bass: { ar: 'أزرار الباص والمصاحبة (اليد اليسرى)', text: '48 زرًا بنظام ستراديلا: 8 أعمدة (بدائرة الخامسات) × 6 صفوف: كونترباص، باص أساسي، ثم أوتار ماجور ومينور وسابع ومنقوص. زر واحد يعطي وترًا كاملًا.' },
  bassbutton: { ar: 'زر باص', text: 'الصفان الأولان يعزفان نغمة واحدة، والصفوف الأربعة الأخرى تعزف وترًا من ثلاث نغمات.' },
  bellows: { ar: 'المنفاخ', text: 'مصدر الهواء. تحريكه للداخل أو للخارج يهزّ القصبات ويُصدر الصوت؛ قوة الصوت تتبع سرعة حركته، لا قوة ضغط المفتاح. يُبدَّل اتجاهه بين جملة وأخرى.' },
  rightbox: { ar: 'صندوق اليد اليمنى', text: 'يحوي قصبات النغمات العليا وآلية المفاتيح. أمامه شبكة تخرج منها الأصوات.' },
  leftbox: { ar: 'صندوق اليد اليسرى', text: 'يحوي قصبات الباص والأوتار. تثبّت اليد اليسرى الصندوق وتحرّك المنفاخ به.' },
  grille: { ar: 'الشبكة المعدنية', text: 'فتحات الصوت: يخرج منها الهواء والصوت من القصبات.' },
  strap: { ar: 'الأشرطة', text: 'شريطان على الكتفين يحملان وزن الآلة، فتبقى ثابتة على الصدر ويتحرر الذراعان للعزف.' },
  baseplate: { ar: 'جسم الآلة', text: 'هيكل خشبي مغطّى بالسيلولويد اللامع، يحمل الصندوقين والمنفاخ بينهما.' },
};
