// =====================================================================
// 🗂️ نموذج «مشروع الأغنية» في مصنع الألحان + أدوات الأقسام
// ملف نقي (بدون React أو Next) يستخدمه المتصفح والخادم.
// =====================================================================
import { SECTION_BY_ID, ARRANGEMENT_PARTS, INSTRUMENTS, ids, GENRES, LANGUAGES, MOODS, RHYTHMS, MAQAMS, VOCALS, TEMPOS, INTROS, OUTROS } from './catalog.js';

export const PROJECT_VERSION = 1;
export const LIMITS = { sections: 24, sectionText: 2000, title: 100, extra: 400, lines: 200 };

let seq = 0;
export const uid = () => `s${Date.now().toString(36)}${(seq++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export function newSection(type = 'verse', text = '', label = '') {
  return { id: uid(), type: SECTION_BY_ID[type] ? type : 'verse', label: String(label || '').slice(0, 40), text: String(text || '') };
}

export function defaultChoices() {
  return {
    genre: 'auto', language: 'auto', mood: 'auto', rhythm: 'auto', maqam: 'auto', vocals: 'auto',
    tempo: 'auto', bpm: null, intro: 'auto', outro: 'auto',
    instruments: Object.fromEntries(ARRANGEMENT_PARTS.map((p) => [p.id, []])),
    durationSec: 60, extra: '',
  };
}

export function defaultProject(mode = 'song') {
  return {
    version: PROJECT_VERSION,
    mode: mode === 'instrumental' ? 'instrumental' : 'song',
    title: '',
    sections: [newSection('verse'), newSection('chorus'), newSection('verse')],
    choices: defaultChoices(),
  };
}

const pick = (v, list) => (typeof v === 'string' && list.includes(v) ? v : 'auto');

/** تنظيف أي مشروع قادم من التخزين المحلي أو من الشبكة (لا يثق بأي حقل) */
export function normalizeProject(raw) {
  const p = raw && typeof raw === 'object' ? raw : {};
  const c = p.choices && typeof p.choices === 'object' ? p.choices : {};
  const base = defaultChoices();
  const inst = {};
  for (const part of ARRANGEMENT_PARTS) {
    const arr = c.instruments && Array.isArray(c.instruments[part.id]) ? c.instruments[part.id] : [];
    inst[part.id] = [...new Set(arr.filter((x) => INSTRUMENTS.includes(x)))].slice(0, 8);
  }
  const bpm = Number.isFinite(+c.bpm) && +c.bpm >= 40 && +c.bpm <= 220 ? Math.round(+c.bpm) : null;
  const dur = Number.isFinite(+c.durationSec) ? Math.max(10, Math.min(600, Math.round(+c.durationSec))) : base.durationSec;
  const sections = (Array.isArray(p.sections) ? p.sections : []).slice(0, LIMITS.sections).map((s) => ({
    id: typeof s?.id === 'string' && s.id.length < 40 ? s.id : uid(),
    type: SECTION_BY_ID[s?.type] ? s.type : 'verse',
    label: typeof s?.label === 'string' ? s.label.slice(0, 40) : '',
    text: typeof s?.text === 'string' ? s.text.replace(/\r\n?/g, '\n').slice(0, LIMITS.sectionText) : '',
  }));
  return {
    version: PROJECT_VERSION,
    mode: p.mode === 'instrumental' ? 'instrumental' : 'song',
    title: typeof p.title === 'string' ? p.title.slice(0, LIMITS.title) : '',
    sections,
    choices: {
      genre: pick(c.genre, ids(GENRES)), language: pick(c.language, ids(LANGUAGES)), mood: pick(c.mood, ids(MOODS)),
      rhythm: pick(c.rhythm, ids(RHYTHMS)), maqam: pick(c.maqam, ids(MAQAMS)), vocals: pick(c.vocals, ids(VOCALS)),
      tempo: pick(c.tempo, ids(TEMPOS)), bpm, intro: pick(c.intro, ids(INTROS)), outro: pick(c.outro, ids(OUTROS)),
      instruments: inst, durationSec: dur, extra: typeof c.extra === 'string' ? c.extra.slice(0, LIMITS.extra) : '',
    },
  };
}

/** الجزء الذي تتبعه آلات القسم في التوزيع */
export function partOf(type) {
  if (type === 'intro') return 'intro';
  if (type === 'chorus' || type === 'pre_chorus') return 'chorus';
  if (type === 'bridge' || type === 'interlude') return 'bridge';
  if (type === 'outro') return 'outro';
  return 'verse';
}

/** اسم القسم بالإنجليزية كما سيُكتب في وسوم Suno: Verse 1 / Verse 2 / Chorus / Final Chorus... */
export function sectionLabels(sections) {
  const counts = {};
  const totals = {};
  sections.forEach((s) => { totals[s.type] = (totals[s.type] || 0) + 1; });
  let chorusSeen = 0;
  return sections.map((s, i) => {
    if (s.label && /^[\x20-\x7E]+$/.test(s.label)) return s.label;
    counts[s.type] = (counts[s.type] || 0) + 1;
    const en = SECTION_BY_ID[s.type].en;
    if (s.type === 'verse') return totals.verse > 1 ? `Verse ${counts.verse}` : 'Verse';
    if (s.type === 'chorus') {
      chorusSeen++;
      const later = sections.slice(i + 1).some((x) => x.type === 'chorus');
      return chorusSeen > 1 && !later && totals.chorus > 2 ? 'Final Chorus' : 'Chorus';
    }
    return en;
  });
}

/** اسم القسم بالعربية للواجهة */
export function sectionLabelAr(s, sections) {
  if (s.label && !/^[\x20-\x7E]+$/.test(s.label)) return s.label;
  const base = SECTION_BY_ID[s.type].ar;
  if (s.type !== 'verse') return base;
  const verses = sections.filter((x) => x.type === 'verse');
  if (verses.length < 2) return base;
  const n = verses.indexOf(s) + 1;
  return `${base} ${['الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس'][n - 1] || n}`;
}

export const hasLyrics = (project) => project.sections.some((s) => s.text.trim() && s.type !== 'interlude');
export const lyricLineCount = (project) => project.sections.reduce((a, s) => a + s.text.split('\n').filter((l) => l.trim()).length, 0);

// ---------------------------------------------------------------------
// تقسيم أغنية ملصوقة كاملة إلى أقسام (نفس منطق Music Factory مع تعميمه)
// ---------------------------------------------------------------------
const HEADERS = [
  { type: 'chorus', re: /^(المذهب|مذهب|اللازمة|لازمة|الكورس|كورس|المطلع|القرار|chorus|hook|refrain)$/i },
  { type: 'pre_chorus', re: /^(تمهيد|ما قبل المذهب|pre[\s-]?chorus)$/i },
  { type: 'verse', re: /^((ال)?كوبليه|(ال)?كوبلية|(ال)?مقطع|(ال)?دور|verse)(\s*(ال)?(أول|الأول|اول|ثاني|الثاني|ثانى|ثالث|الثالث|رابع|الرابع|[0-9١-٩]+))?$/i },
  { type: 'intro', re: /^((ال)?مقدمة|(ال)?افتتاحية|(ال)?استهلال|intro)$/i },
  { type: 'bridge', re: /^((ال)?جسر|(ال)?انتقال|(ال)?قنطرة|bridge)$/i },
  { type: 'interlude', re: /^((ال)?فاصل( موسيقي)?|interlude|instrumental( break)?|solo)$/i },
  { type: 'outro', re: /^((ال)?خاتمة|(ال)?قفلة|(ال)?ختام|outro|ending)$/i },
];
function headerOf(line) {
  const t = line.trim().replace(/^[\[(【]\s*|\s*[\])】]$/g, '').replace(/\s*[:：\-–—]+\s*$/, '').trim();
  if (!t || t.length > 30) return null;
  // «[Verse 1: soft oud]» → نأخذ ما قبل النقطتين
  const head = t.split(/[:：]/)[0].trim();
  const h = HEADERS.find((x) => x.re.test(head));
  return h ? h.type : null;
}

export function splitPastedLyrics(text) {
  const clean = String(text || '').replace(/\r\n?/g, '\n');
  const lines = clean.split('\n');
  const out = [];
  if (lines.some((l) => headerOf(l))) {
    let cur = null;
    for (const raw of lines) {
      const line = raw.trim();
      const type = headerOf(raw);
      if (type) { cur = newSection(type); out.push(cur); continue; }
      if (!line) continue;
      if (/^\[[^\]]*\]$/.test(line)) continue; // وسوم أخرى غير مفهومة
      if (!cur) { cur = newSection('verse'); out.push(cur); }
      cur.text = cur.text ? cur.text + '\n' + line : line;
    }
    return out.filter((s) => s.text.trim() || ['intro', 'interlude', 'outro'].includes(s.type));
  }
  const blocks = clean.split(/\n\s*\n/).map((b) => b.split('\n').map((l) => l.trim()).filter(Boolean)).filter((b) => b.length);
  if (!blocks.length) return [];
  if (blocks.length === 1) {
    // كتلة واحدة: نقسمها مقطعين (كوبليه + مذهب) إن كانت طويلة
    const b = blocks[0];
    if (b.length < 6) return [newSection('verse', b.join('\n'))];
    const half = Math.ceil(b.length / 2);
    return [newSection('verse', b.slice(0, half).join('\n')), newSection('chorus', b.slice(half).join('\n'))];
  }
  const key = (b) => b.join('\n');
  const counts = {};
  blocks.forEach((b) => { counts[key(b)] = (counts[key(b)] || 0) + 1; });
  const repeated = blocks.find((b) => counts[key(b)] > 1);
  const chorusKey = repeated ? key(repeated) : key(blocks[1]);
  return blocks.map((b) => newSection(key(b) === chorusKey ? 'chorus' : 'verse', key(b)));
}
