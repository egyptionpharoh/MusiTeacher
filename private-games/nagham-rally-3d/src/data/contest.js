// =====================================================================
//  المسابقة: نموذج أسئلة المعلم، تحويلها إلى تحديات اللعبة، ربط الدرس بالتحديات، التخزين لكل معلم، والمشاركة.
//
//  سؤال المسابقة (يحفظه المعلم ويعدّله):
//   { id, src: 'gen'|'bank'|'ai'|'manual', kind: 'text'|'image'|'audio'|'rhythm'|'staff'|'instrument'|'gen',
//     prompt, explain, cue?: Sign, options: [Sign], answer, listen?: boolean, audio?: string(dataURL), gen?: {domain, level, seed} }
//   Sign = { t:'text', text } | { t:'rhythm', ids:[figure…] } | { t:'staff', notes:[{step,oct,acc}] } | { t:'inst', id }
//        | { t:'image', src } | { t:'meter', n, d }
//  أسئلة «gen» تحفظ بذرة التوليد فقط وتُعاد بناؤها نفسها في كل مرة (مع تعديلات المعلم على النص والشرح).
//
//  التخزين: localStorage على جهاز المعلم، مفصول لكل حساب MusiTeacher (uid من رمز الدخول) — كما في «عجلة الاختيار».
//  المحتوى الأساسي (الأنشطة الجاهزة على الخادم، مكتبة التحديات) للقراءة فقط: التعديل يقع على نسخة المعلم وحدها.
// =====================================================================
import { DOMAIN, DOMAINS, INSTRUMENTS, rng, rhythmSign, staffSign } from './content.js';
import { FIG } from './figures.js';
import { LESSONS } from './lessons.js';
import { noteName, midiOf } from '../notation/staff.js';

export const uid = (p = 'q') => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
export const clone = (x) => JSON.parse(JSON.stringify(x));
export const plain = (s) => String(s || '').replace(/[ً-ْـ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').toLowerCase();
const GN = ['الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس', 'السابع', 'الثامن', 'التاسع', 'العاشر', 'الحادي عشر', 'الثاني عشر'];
export const GRADE_NAME = (g) => (g >= 1 && g <= 12 ? `الصف ${GN[g - 1]}` : 'بدون صف');
export const lessonsOf = (grade) => LESSONS.filter((l) => l.grade === grade).sort((a, b) => a.sem - b.sem || a.n - b.n);
export const lessonById = (id) => LESSONS.find((l) => l.id === id) || null;

export const KINDS = {
  text: { label: 'سؤال نصي', icon: '📝', hint: 'سؤال وخيارات نصية' },
  image: { label: 'سؤال بصورة', icon: '🖼️', hint: 'صورة تظهر مع السؤال وخيارات نصية' },
  audio: { label: 'سؤال بملف صوتي', icon: '🔊', hint: 'مقطع صوتي يُسمع مع السؤال وخيارات نصية' },
  rhythm: { label: 'شكل إيقاعي', icon: '♩', hint: 'الخيارات علامات أو أشكال إيقاعية (ويمكن سماع الصحيح)' },
  staff: { label: 'نوتة على المدرج', icon: '🎼', hint: 'نغمة على مفتاح صول: سمِّها أو حدّد موضعها' },
  instrument: { label: 'تعرّف الآلة', icon: '🎻', hint: 'يُسمع صوت الآلة والخيارات صور/أسماء آلات' },
};
export const MODES = {
  turns: { name: 'بالأدوار (الخطأ يُنهي الجولة)', short: 'بالأدوار', desc: 'الإجابة الخاطئة ارتطام وتنتهي جولة المتسابق، ثم يبدأ التالي في القائمة' },
  training: { name: 'التدريب', short: 'التدريب', desc: 'الخطأ يُبطئ المركبة ويظهر الشرح ثم يكمل المتسابق أسئلته' },
  points: { name: 'النقاط', short: 'النقاط', desc: 'يكمل كل متسابق أسئلته حتى النهاية ويُحسب مجموع الإجابات الصحيحة' },
};
export const POINTS = 10;                        // درجة كل سؤال

// ---------------------------------------------------------------- ربط عنوان الدرس بمجالات التحديات الموسيقية
// قواعد محافظة: لا يُقترح مجال إلا إذا ذكر عنوان الدرس موضوعه صراحة (لا اقتراح لنشيد أو درس تاريخي مثلًا)
const RULES = [
  [['الميزان', 'الموازين'], ['meters', 'bars']],
  [['مازوره', 'الموازير'], ['bars']],
  [['العلامه الايقاعيه', 'الشكل الايقاعي', 'الشكلان الايقاعيان', 'النوار', 'البلانش', 'الروند', 'الكروش', 'السكته', 'الازمنه الاساسيه', 'الرباط الزمني', 'النقطه الزمنيه', 'قراه ايقاعيه', 'قراءه ايقاعيه', 'عنصر الايقاع'], ['rhythm']],
  [['مقام', 'بياتي', 'راست', 'حجاز', 'نهاوند'], ['maqamat']],
  [['ضرب', 'الات الايقاعيه العربيه', 'اللات الايقاعيه العربيه'], ['durub']],
  [['اكسيلوفون', 'الاورج', 'اكورديون', 'اوكورديون', 'الات الباند'], ['instruments']],
  [['المدرج', 'مفتاح صول', 'صولفيج', 'سلم دو'], ['staff']],
  [['الحده والغلظه', 'التمييز السمعي'], ['pitch']],
];
export function domainsForLesson(lesson) {
  if (!lesson) return [];
  const t = ' ' + plain(lesson.title).replace(/[-_(),.«»"']+/g, ' ').replace(/\s+/g, ' ') + ' ';
  const out = [];
  for (const [keys, ds] of RULES) if (keys.some((k) => t.includes(k))) ds.forEach((d) => { if (!out.includes(d)) out.push(d); });
  return out;
}
export const levelForGrade = (g) => (g <= 6 ? 1 : g <= 8 ? 2 : g <= 10 ? 3 : 4);

// ---------------------------------------------------------------- إنشاء أسئلة
export function genQuestion(domain, level, seed) {
  const q = { id: uid(), src: 'gen', kind: 'gen', gen: { domain, level, seed: seed >>> 0 }, prompt: '', explain: '', options: [], answer: 0 };
  const ch = runtimeOf(q); q.prompt = ch.prompt; q.explain = ch.explain || '';
  q.preview = { options: ch.options.map((o) => o.label), answer: ch.answer };
  return q;
}
export function suggestFromLesson(lesson, { count = 8, level } = {}) {
  const ds = domainsForLesson(lesson); if (!ds.length) return [];
  const lv = level || levelForGrade(lesson.grade);
  const out = []; let seed = (Date.now() & 0xffffff) ^ (lesson.grade * 7919);
  for (let i = 0; i < count; i++) out.push(genQuestion(ds[i % ds.length], lv, seed + i * 101));
  return out;
}
const BAND_IMG = /\/games\/musiteacher-randomizer\/img\/band\/([a-z]+)\.jpg$/;
/** سؤال من «الأنشطة الجاهزة» (خادم MusiTeacher) → سؤال مسابقة. MC وTF فقط تصلح لمسارات الطريق */
export function fromBank(b, bankQ) {
  const base = { id: uid(), src: 'bank', explain: bankQ.src ? `من الدليل: «${bankQ.src}»` : '', bankRef: `${b.lessonId}:${b.version}:${plain(bankQ.text).slice(0, 40)}` };
  let cue;
  if (Array.isArray(bankQ.sym) && bankQ.sym.every((s) => FIG[s])) cue = { t: 'rhythm', ids: bankQ.sym };
  if (typeof bankQ.image === 'string') { const m = bankQ.image.match(BAND_IMG); if (m) cue = { t: 'image', src: `./assets/img/band/${m[1]}.jpg` }; }
  const kind = cue ? (cue.t === 'image' ? 'image' : 'rhythm') : 'text';
  if (bankQ.type === 'MC' && Array.isArray(bankQ.options)) return normalize({ ...base, kind, cueOnly: !!cue, prompt: bankQ.text, cue, options: bankQ.options.slice(0, 4).map((o) => ({ t: 'text', text: o })), answer: bankQ.answer < 4 ? bankQ.answer : 0 });
  if (bankQ.type === 'TF') return normalize({ ...base, kind, cueOnly: !!cue, prompt: bankQ.text, cue, options: [{ t: 'text', text: 'صح ✔' }, { t: 'text', text: 'خطأ ✘' }], answer: bankQ.answer ? 0 : 1 });
  return null;
}
/** سؤال مولّد من محتوى الدرس (خادم التوليد مع التحقق من الدليل) */
export function fromAI(q) {
  const base = { id: uid(), src: 'ai', kind: 'text', explain: q.src ? `من محتوى الدرس: «${q.src}»` : '' };
  if (q.type === 'MC' && Array.isArray(q.options)) return normalize({ ...base, prompt: q.text, options: q.options.slice(0, 4).map((o) => ({ t: 'text', text: o })), answer: q.answer < 4 ? q.answer : 0 });
  if (q.type === 'TF') return normalize({ ...base, prompt: q.text, options: [{ t: 'text', text: 'صح ✔' }, { t: 'text', text: 'خطأ ✘' }], answer: q.answer ? 0 : 1 });
  return null;
}
export function blankQuestion(kind) {
  const q = { id: uid(), src: 'manual', kind, prompt: '', explain: '', options: [], answer: 0 };
  if (kind === 'text' || kind === 'image' || kind === 'audio') q.options = [{ t: 'text', text: '' }, { t: 'text', text: '' }, { t: 'text', text: '' }];
  if (kind === 'rhythm') { q.options = [{ t: 'rhythm', ids: ['q'] }, { t: 'rhythm', ids: ['h'] }, { t: 'rhythm', ids: ['ee'] }]; q.listen = true; q.prompt = 'استمع إلى المقطع الإيقاعي، ثم اختر المسار الذي يحمل الشكل الذي سمعته'; }
  if (kind === 'staff') { q.mode = 'name'; q.target = { step: 'G', oct: 4, acc: 0 }; q.choices = [{ step: 'G', oct: 4, acc: 0 }, { step: 'A', oct: 4, acc: 0 }, { step: 'F', oct: 4, acc: 0 }]; q.prompt = 'ما اسم النغمة المكتوبة على المدرج الظاهر أمامك؟'; }
  if (kind === 'instrument') { q.options = [{ t: 'inst', id: 'violin' }, { t: 'inst', id: 'piano' }, { t: 'inst', id: 'snare' }]; q.prompt = 'استمع إلى المقطع الصوتي: أيّ آلة تعزف؟ اختر المسار الذي يحمل صورتها'; }
  return q;
}

// ---------------------------------------------------------------- التنظيف والتحقق
// صياغات قديمة كانت تشير إلى لوحة القيادة أو الراديو (غير ظاهرين في المشهد) — تُستبدل تلقائيًا حتى في المسابقات المحفوظة
const LEGACY = {
  'استمع إلى الإيقاع من الراديو، ثم ادخل مسار الشكل الإيقاعي الذي سمعته': 'استمع إلى المقطع الإيقاعي، ثم اختر المسار الذي يحمل الشكل الذي سمعته',
  'استمع إلى الإيقاع، ثم ادخل مسار الشكل الإيقاعي الذي سمعته': 'استمع إلى المقطع الإيقاعي، ثم اختر المسار الذي يحمل الشكل الذي سمعته',
  'ما اسم العلامة الظاهرة على لوحة القيادة؟ ادخل المسار الذي يحمل اسمها': 'ما اسم العلامة الإيقاعية الظاهرة أمامك؟ اختر المسار الذي يحمل اسمها',
  'كم مازورة في السطر الظاهر على لوحة القيادة؟': 'كم مازورة في السطر الموسيقي الظاهر أمامك؟',
  'اقرأ السلم على لوحة القيادة (انتبه لعلامات التحويل)، ثم اختر المقام': 'اقرأ السلم الظاهر أمامك (انتبه لعلامات التحويل)، ثم اختر المسار الذي يحمل اسم المقام',
  'استمع إلى السلم على الكمان، ثم اختر المقام': 'استمع إلى السلم على الكمان، ثم اختر المسار الذي يحمل اسم المقام',
  'أيّ آلة تعزف في الراديو؟ ادخل مسار صورتها': 'استمع إلى المقطع الصوتي: أيّ آلة تعزف؟ اختر المسار الذي يحمل صورتها',
  'ما اسم النغمة المكتوبة على المدرج في لوحة القيادة؟': 'ما اسم النغمة المكتوبة على المدرج الظاهر أمامك؟',
  'أين تُكتب النغمة الظاهرة على اللوحة؟ ادخل المسار الذي يحمل موضعها الصحيح': 'أين تُكتب النغمة المكتوبة أمامك؟ اختر المسار الذي يحمل موضعها الصحيح على المدرج',
};
export const modernPrompt = (t) => {
  if (!t) return t;
  if (LEGACY[t]) return LEGACY[t];
  let m = /^ابحث عن «(.+)» على لافتات المسارات وادخل مسارها$/.exec(t); if (m) return `أيّ مسار يحمل رمز «${m[1]}»؟`;
  m = /^أين تُكتب النغمة «(.+)»؟ ادخل المسار الذي يحمل موضعها الصحيح$/.exec(t); if (m) return `أين تُكتب النغمة «${m[1]}»؟ اختر المسار الذي يحمل موضعها الصحيح على المدرج`;
  return t;
};
const str = (v, n = 300) => (typeof v === 'string' ? v.trim().slice(0, n) : '');
function normSign(s) {
  if (!s || typeof s !== 'object') return null;
  if (s.t === 'text') return { t: 'text', text: str(s.text, 120) };
  if (s.t === 'rhythm') { const ids = (s.ids || []).filter((x) => FIG[x]).slice(0, 12); return ids.length ? { t: 'rhythm', ids } : null; }
  if (s.t === 'staff') { const notes = (s.notes || []).filter((n) => n && 'CDEFGAB'.includes(n.step) && n.oct >= 3 && n.oct <= 6).slice(0, 10).map((n) => ({ step: n.step, oct: n.oct | 0, acc: [0, 1, -1, -0.5].includes(n.acc) ? n.acc : 0 })); return notes.length ? { t: 'staff', notes } : null; }
  if (s.t === 'inst') return INSTRUMENTS[s.id] ? { t: 'inst', id: s.id } : null;
  if (s.t === 'image') return typeof s.src === 'string' && (s.src.startsWith('data:image/') || s.src.startsWith('./assets/img/')) ? { t: 'image', src: s.src } : null;
  if (s.t === 'meter') return { t: 'meter', n: s.n | 0, d: s.d | 0 };
  return null;
}
export function normalize(q) {
  const o = { id: q.id || uid(), src: ['gen', 'bank', 'ai', 'manual', 'curr', 'mine'].includes(q.src) ? q.src : 'manual', kind: KINDS[q.kind] || q.kind === 'gen' ? q.kind : 'text', prompt: modernPrompt(str(q.prompt, 400)), explain: str(q.explain, 500), answer: Number.isInteger(q.answer) ? q.answer : 0 };
  if (q.bankRef) o.bankRef = q.bankRef;
  if (q.currRef) o.currRef = String(q.currRef).slice(0, 80);
  if (q.noLabel) o.noLabel = true;            // لا يُكتب اسم العلامة تحت رسمها (حين يكون الاسم هو المطلوب)
  if (q.mineRef) o.mineRef = String(q.mineRef).slice(0, 80);
  if (o.kind === 'gen') { if (q.currRef) o.currRef = String(q.currRef).slice(0, 80); o.gen = { domain: DOMAIN[q.gen && q.gen.domain] ? q.gen.domain : 'rhythm', level: Math.min(4, Math.max(1, (q.gen && q.gen.level) | 0 || 1)), seed: (q.gen && q.gen.seed) >>> 0 }; if (q.preview) o.preview = q.preview; o.options = []; return o; }
  if (o.kind === 'staff') {
    o.mode = q.mode === 'where' ? 'where' : 'name';
    const nn = (n) => normSign({ t: 'staff', notes: [n] });
    o.choices = (q.choices || []).map((n) => nn(n)).filter(Boolean).map((s) => s.notes[0]).slice(0, 4);
    o.answer = Math.min(Math.max(0, o.answer), Math.max(0, o.choices.length - 1));
    o.listen = !!q.listen;
    return o;
  }
  o.options = (q.options || []).map(normSign).filter(Boolean).slice(0, 4);
  o.answer = Math.min(Math.max(0, o.answer), Math.max(0, o.options.length - 1));
  const cue = normSign(q.cue); if (cue) o.cue = cue;
  if (o.kind === 'audio' && typeof q.audio === 'string' && q.audio.startsWith('data:audio/')) o.audio = q.audio;
  if (o.kind === 'rhythm' || o.kind === 'instrument') o.listen = q.listen !== false;
  return o;
}
const sigOf = (s) => JSON.stringify(s);
export function problems(q) {
  const p = [];
  if (q.kind === 'gen') return p;
  if (!q.prompt) p.push('نص السؤال فارغ');
  if (q.kind === 'staff') {
    if (q.choices.length < 2) p.push('اختر نغمتين على الأقل');
    if (new Set(q.choices.map(sigOf)).size !== q.choices.length) p.push('نغمات مكررة');
    return p;
  }
  const opts = q.options.filter((o) => o.t !== 'text' || o.text);
  if (opts.length < 2 || opts.length !== q.options.length) p.push('يحتاج خيارين مكتملين على الأقل (والخيار الفارغ يُحذف)');
  if (new Set(q.options.map((o) => (o.t === 'text' ? plain(o.text) : sigOf(o)))).size !== q.options.length) p.push('خيارات مكررة');
  if (q.answer < 0 || q.answer >= q.options.length) p.push('حدّد الإجابة الصحيحة');
  if (q.kind === 'image' && !(q.cue && q.cue.t === 'image')) p.push('أضف الصورة');
  if (q.kind === 'audio' && !q.audio) p.push('أضف الملف الصوتي');
  if (q.kind === 'rhythm' && q.listen && q.options[q.answer] && q.options[q.answer].t === 'rhythm' && q.options[q.answer].ids.every((i) => FIG[i].kind === 'rest')) p.push('السكتة لا تُسمع: ألغِ خيار السماع أو اختر علامة صوتية صحيحة');
  return p;
}
export const playable = (q) => problems(q).length === 0;

// ---------------------------------------------------------------- إلى تحدٍّ في اللعبة
const label = (s) => (s.t === 'text' ? s.text : s.t === 'rhythm' ? s.ids.map((i) => FIG[i].name).join(' + ') : s.t === 'staff' ? s.notes.map(noteName).join(' ') : s.t === 'inst' ? INSTRUMENTS[s.id].name : s.t === 'meter' ? `${s.n}/${s.d}` : 'صورة');
const INST_IMG = { bass: 'bass', castanets: 'castanets', cymbals: 'cymbals', glock: 'glock', jingles: 'jingles', tamb: 'tamb', triangle: 'triangle' };
/** مواصفة رسم (signs.js) من Sign */
export function drawSpec(s) {
  if (s.t === 'text') return { t: 'text', text: s.text || '—' };
  if (s.t === 'rhythm') return rhythmSign(s.ids, s.ids.length === 1 ? FIG[s.ids[0]].name : '');
  if (s.t === 'staff') return staffSign(s.notes, { S: s.notes.length > 1 ? 11 : 14, stems: s.notes.length === 1 });
  if (s.t === 'inst') { const I = INSTRUMENTS[s.id]; return INST_IMG[s.id] ? { t: 'img', src: `./assets/img/band/${INST_IMG[s.id]}.jpg`, text: I.name } : { t: 'icon', icon: I.icon, text: I.name }; }
  if (s.t === 'image') return { t: 'img', src: s.src, text: '' };
  if (s.t === 'meter') return { t: 'meter', n: s.n, d: s.d };
  return { t: 'text', text: '—' };
}
const SRC_NAME = { curr: { name: 'من المنهج', icon: '📗' }, mine: { name: 'من أسئلتي', icon: '⭐' }, bank: { name: 'من نشاط الدرس', icon: '📘' }, ai: { name: 'من محتوى الدرس', icon: '📄' }, manual: { name: 'سؤال المعلم', icon: '✍️' } };
/** يعيد تحديًا جاهزًا للعب: { prompt, cue, audio, options:[{key,label,sign}], answer, explain, domainName, domainIcon } أو null */
export function runtimeOf(q) {
  if (q.kind === 'gen') {
    const d = DOMAIN[q.gen.domain]; if (!d) return null;
    const ch = d.gen(q.gen.level, rng(q.gen.seed || 1));
    return { ...ch, prompt: q.prompt || ch.prompt, explain: q.explain || ch.explain, domain: q.gen.domain, domainName: d.name, domainIcon: d.icon, qid: q.id };
  }
  if (!playable(q)) return null;
  const meta = SRC_NAME[q.src] || SRC_NAME.manual;
  let options, cue = q.cue ? drawSpec(q.cue) : null, audio = null, answer = q.answer;
  if (q.kind === 'staff') {
    const t = q.choices[q.answer];
    if (q.mode === 'name') { cue = staffSign([{ ...t, hl: true }], { S: 13 }); options = q.choices.map((n, i) => ({ key: 'n' + i, label: noteName(n), sign: { t: 'text', text: noteName(n) } })); }
    else { cue = { t: 'text', text: noteName(t), sub: 'مفتاح صول' }; options = q.choices.map((n, i) => ({ key: 'n' + i, label: noteName(n), sign: staffSign([n], { S: 14 }) })); }
    if (q.listen) audio = { kind: 'notes', set: 'piano', notes: [{ midi: midiOf(t.step, t.oct, Math.trunc(t.acc)), cents: t.acc === -0.5 ? -50 : 0, t: 0, d: 1.4 }] };
  } else {
    options = q.options.map((s, i) => ({ key: 'o' + i, label: label(s), sign: q.noLabel && s.t === 'rhythm' ? rhythmSign(s.ids, '') : drawSpec(s) }));
    if (q.kind === 'audio') audio = { kind: 'url', url: q.audio };
    if (q.kind === 'rhythm' && q.listen) { const ids = q.options[answer].ids, ticks = ids.reduce((a, x) => a + FIG[x].ticks, 0); const reps = ticks && 48 % ticks === 0 ? 48 / ticks : 1; audio = { kind: 'rhythm', ids: Array(reps).fill(ids).flat(), bpm: 76, countIn: 4 }; }
    if (q.kind === 'instrument' && q.listen) audio = { kind: 'inst', inst: q.options[answer].id };
    if (!cue && audio) cue = { t: 'text', text: q.kind === 'instrument' ? '🎧 من يعزف؟' : '🎧 استمع', sub: 'إلى المقطع الصوتي' };
  }
  const right = options[answer];
  return { prompt: q.prompt, cue, audio, options, answer, explain: q.explain || `الإجابة الصحيحة: ${right.label}.`, domain: q.src, domainName: meta.name, domainIcon: meta.icon, qid: q.id };
}

// ---------------------------------------------------------------- المسابقة والتخزين
export const DEFAULT_SETTINGS = {
  mode: 'turns', perTurn: 5, answerTime: 14, replays: 2, theme: 'journey', from: 'salalah', to: 'diba', tod: 'day', cine: true, flag: true, plate: true,
  vehicle: 'car', lockVehicle: false, driver: 'female', camera: 'chase', allowCamera: true, level: 1,
  radio: true, radioVol: 0.7,
};
export function newContest(o = {}) {
  return { id: uid('race'), title: o.title || 'مسابقة جديدة', grade: o.grade || 0, sem: o.sem || 1, lessonId: o.lessonId || '', lessonTitle: o.lessonTitle || '', questions: [], names: [], settings: { ...DEFAULT_SETTINGS }, createdAt: Date.now(), updatedAt: Date.now() };
}
/** مسابقة تجريبية جاهزة (أول تشغيل): تحديات موسيقية متنوعة من المكتبة */
export function demoContest() {
  const c = newContest({ title: 'سباق تجريبي متنوّع' });
  const ds = ['rhythm', 'instruments', 'staff', 'pitch', 'meters'];
  c.questions = Array.from({ length: 8 }, (_, i) => genQuestion(ds[i % ds.length], 1, 9100 + i * 37));
  c.settings.perTurn = 5; c.demo = true;
  return c;
}

let OWNER = 'local';
const KEY = () => `nagham-rally.v2.${OWNER}`;
export function setOwner(id) { OWNER = String(id || 'local').replace(/[^\w-]/g, '').slice(0, 64) || 'local'; }
export function loadAll() {
  try { const d = JSON.parse(localStorage.getItem(KEY())); if (d && Array.isArray(d.contests)) return d; } catch (e) { /* */ }
  return { contests: [], activeId: null };
}
export function saveAll(d) {
  try { localStorage.setItem(KEY(), JSON.stringify(d)); return true; }
  catch (e) { console.warn('[rally] storage', e); return false; }
}
export function saveContest(c) {
  const d = loadAll(); const i = d.contests.findIndex((x) => x.id === c.id);
  const next = { ...clone(c), questions: c.questions.map(normalize), updatedAt: Date.now() };
  delete next.demo;
  if (i >= 0) d.contests[i] = next; else d.contests.unshift(next);
  d.activeId = next.id;
  return saveAll(d) ? next : null;
}
export function deleteContest(id) { const d = loadAll(); d.contests = d.contests.filter((c) => c.id !== id); if (d.activeId === id) d.activeId = d.contests[0] ? d.contests[0].id : null; saveAll(d); }
export function setActive(id) { const d = loadAll(); d.activeId = id; saveAll(d); }
export function activeContest() { const d = loadAll(); return d.contests.find((c) => c.id === d.activeId) || d.contests[0] || null; }

// ---------------------------------------------------------------- بنك أسئلة المنهج (ثابت داخل اللعبة — للقراءة فقط)
// assets/curriculum/s{الفصل}/index.json  ←  { "<lessonId>": { "file": "g01/<lessonId>.json", "n": عدد الأسئلة } }
// كل ملف درس: { lessonId, grade, sem, title, source, outcomes:[{id,text}], questions:[سؤال بصيغة اللعبة + meta], review:[ملاحظات] }
// المعلم ينسخ ما يريده إلى مسابقته؛ تعديلاته تبقى في مسابقته وفي «أسئلتي» ولا تمس هذا البنك ولا بقية المعلمين.
const CURR = {};
async function currIndex(sem) {
  if (!CURR[sem]) CURR[sem] = fetch(`./assets/curriculum/s${sem}/index.json`, { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : {})).catch(() => ({}));
  return CURR[sem];
}
export async function curriculumFor(lesson) {
  if (!lesson) return null;
  const idx = await currIndex(lesson.sem || 1), e = idx[lesson.id]; if (!e) return null;
  try { const r = await fetch(`./assets/curriculum/s${lesson.sem || 1}/${e.file}`, { cache: 'no-cache' }); return r.ok ? await r.json() : null; } catch (err) { return null; }
}
/** بصمة أسئلة المسابقة: لمعرفة هل عدّل المعلم أسئلة الدرس المحمّلة تلقائيًا أم لا */
export function qHash(qs) { const t = JSON.stringify((qs || []).map(normalize)); let h = 5381; for (let i = 0; i < t.length; i++) h = ((h * 33) ^ t.charCodeAt(i)) >>> 0; return `${h.toString(36)}:${(qs || []).length}`; }
/** آخر مسابقة محفوظة لدرس ما */
export function savedForLesson(lessonId) { return loadAll().contests.filter((c) => c.lessonId === lessonId).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))[0] || null; }
/** مسابقة درس عدّل المعلم أسئلتها (حذف/إضافة/تعديل/ترتيب) — تُحترم ولا تُستبدل تلقائيًا */
export const isCustomized = (c) => !!(c && c.lessonId && !(c.auto && c.autoHash === qHash(c.questions)));
/** مسابقة الدرس الجاهزة للعب مباشرة:
 *  - إن عدّل المعلم أسئلة هذا الدرس سابقًا ← نسخته المعدّلة كما هي.
 *  - وإلا ← أحدث أسئلة الدرس من بنك المنهج + «أسئلتي» (نسخ مستقلة؛ البنك لا يتأثر)، مع الإبقاء على إعدادات المعلم وأسماء المتسابقين. */
export async function lessonContest(lesson, base, { fresh = false } = {}) {
  const old = savedForLesson(lesson.id);
  if (old && !fresh && isCustomized(old)) return { c: clone(old), custom: true };
  const qs = (await lessonQuestions(lesson)).map(normalize);
  const c = old ? clone(old) : newContest({});
  if (!old && base) { c.settings = { ...c.settings, ...clone(base.settings || {}) }; c.names = clone(base.names || []); }
  Object.assign(c, { grade: lesson.grade, sem: lesson.sem || 1, lessonId: lesson.id, lessonTitle: lesson.title });
  if (!c.titleCustom) c.title = `مسابقة درس ${lesson.title}`;
  c.questions = qs; c.auto = true; c.autoHash = qHash(qs); delete c.demo;
  return { c, custom: false };
}
/** معرّفات الدروس التي لها أسئلة مُسكَّنة فعلًا في بنك فصلٍ ما (لا دروس وهمية) */
export async function curriculumLessonIds(sem) { const idx = await currIndex(sem || 1); return new Set(Object.keys(idx).filter((k) => idx[k] && idx[k].n > 0)); }
/** كل أسئلة الدرس جاهزة للمسابقة: بنك المنهج (نسخ مستقلة) + «أسئلتي» لهذا الدرس — بلا تكرار */
export async function lessonQuestions(lesson) {
  if (!lesson) return [];
  const doc = await curriculumFor(lesson);
  const out = doc ? doc.questions.map((q) => fromCurriculum(doc, q)) : [];
  const seen = new Set();
  mineFor(lesson.id).forEach((m) => { if (m.mineRef && seen.has(m.mineRef)) return; seen.add(m.mineRef); out.push({ ...clone(m), id: uid(), src: 'mine' }); });
  return out;
}
export async function curriculumCount(lesson) { if (!lesson) return 0; const idx = await currIndex(lesson.sem || 1); return (idx[lesson.id] && idx[lesson.id].n) || 0; }
/** سؤال من بنك المنهج → نسخة مستقلة في مسابقة المعلم (يبقى المرجع للتعرّف على التكرار) */
export function fromCurriculum(doc, q) {
  const x = clone(q); delete x.meta;
  const n = normalize({ ...x, id: uid(), src: 'curr', currRef: `${doc.lessonId}:${q.id}`, explain: x.explain || '' });
  if (n.kind === 'gen') { const ch = runtimeOf(n); if (ch) { n.preview = { options: ch.options.map((o) => o.label), answer: ch.answer }; if (!n.explain) n.explain = ch.explain || ''; } }
  n.src = 'curr'; return n;
}

// ---------------------------------------------------------------- «أسئلتي»: أسئلة المعلم الخاصة لكل درس (في حسابه فقط)
const MINE = () => `nagham-rally.mine.${OWNER}`;
function loadMine() { try { const d = JSON.parse(localStorage.getItem(MINE())); return d && typeof d === 'object' ? d : {}; } catch (e) { return {}; } }
export function mineFor(lessonId) { return (loadMine()[lessonId || '_'] || []).map(normalize); }
export function saveMine(lessonId, q) {
  const d = loadMine(), k = lessonId || '_', list = d[k] || []; const n = normalize({ ...clone(q), src: 'mine' });
  n.mineRef = n.mineRef || uid('mine'); const i = list.findIndex((x) => x.mineRef === n.mineRef);
  if (i >= 0) list[i] = n; else list.push(n); d[k] = list;
  try { localStorage.setItem(MINE(), JSON.stringify(d)); return n; } catch (e) { return null; }
}
export function deleteMine(lessonId, mineRef) { const d = loadMine(), k = lessonId || '_'; d[k] = (d[k] || []).filter((x) => x.mineRef !== mineRef); try { localStorage.setItem(MINE(), JSON.stringify(d)); } catch (e) { /* */ } }

// ---------------------------------------------------------------- الاتصال بخادم MusiTeacher (نفس خدمات «عجلة الاختيار»)
export function tokenFromParent(timeout = 2500) {
  return new Promise((resolve) => {
    if (window.parent === window) return resolve(null);
    const nonce = Math.random().toString(36).slice(2);
    const done = (v) => { window.removeEventListener('message', on); clearTimeout(t); resolve(v); };
    const on = (e) => { if (e.origin === location.origin && e.data && e.data.type === 'mt-token' && e.data.nonce === nonce) done(e.data.token || null); };
    const t = setTimeout(() => done(null), timeout);
    window.addEventListener('message', on);
    try { window.parent.postMessage({ type: 'mt-token-request', nonce }, location.origin); } catch (e) { done(null); }
  });
}
/** هوية المعلم لفصل تخزينه: من رمز الدخول (يكفي القراءة دون تحقق لأن الغرض فصل البيانات على الجهاز فقط) */
export async function identify() {
  // في النسخة الطلابية (MusiTeacher Games) لا توجد صفحة معلم أم: لا ننتظر ردًّا لن يأتي
  try { if (window.parent === window || !/\/dashboard\//.test(window.parent.location.pathname)) return null; } catch (e) { return null; }
  const tk = await tokenFromParent(1800);
  if (!tk) return null;
  try { const p = JSON.parse(decodeURIComponent(escape(atob(tk.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))))); return p.user_id || p.sub || null; } catch (e) { return null; }
}
async function api(action, body) {
  const token = await tokenFromParent();
  const headers = { 'Content-Type': 'application/json' }; if (token) headers.Authorization = `Bearer ${token}`;
  let r; try { r = await fetch(`/api/randomizer/${action}`, { method: body ? 'POST' : 'GET', headers, body: body ? JSON.stringify(body) : undefined, credentials: 'same-origin' }); }
  catch (e) { return { ok: false, error: 'تعذّر الاتصال بخادم MusiTeacher. تحقق من الإنترنت.' }; }
  let d = null; try { d = await r.json(); } catch (e) { /* */ }
  if (!d) return { ok: false, error: r.status === 404 ? 'الخدمة غير متاحة هنا (افتح اللعبة من داخل حسابك في MusiTeacher).' : 'استجابة غير متوقعة من الخادم.' };
  if (!token && (d.code === 'unauthenticated' || r.status === 401)) d.error = 'افتح اللعبة من داخل حسابك في MusiTeacher لتظهر أنشطة الدروس ويعمل التوليد.';
  return d;
}
let BANKS = null;
export async function bankFor(lessonId) {
  if (!BANKS) { const r = await api('banks'); if (!r.ok) return { error: r.error }; BANKS = r.banks || []; }
  return { bank: BANKS.find((b) => b.lessonId === lessonId) || null };
}
export const aiStatus = () => api('status');
export const aiGenerate = (p) => api('generate', p);

// ---------------------------------------------------------------- المشاركة: المسابقة تُرفق برابط الطلاب (بلا أسماء ولا مرفقات كبيرة)
const b64u = (buf) => { let s = ''; const b = new Uint8Array(buf); for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const unb64u = (s) => { const t = atob(s.replace(/-/g, '+').replace(/_/g, '/')); const b = new Uint8Array(t.length); for (let i = 0; i < t.length; i++) b[i] = t.charCodeAt(i); return b; };
async function deflate(str) {
  if (typeof CompressionStream === 'undefined') return 'j' + b64u(new TextEncoder().encode(str));
  const cs = new Blob([str]).stream().pipeThrough(new CompressionStream('deflate-raw'));
  return 'z' + b64u(await new Response(cs).arrayBuffer());
}
async function inflate(s) {
  if (s[0] === 'j') return new TextDecoder().decode(unb64u(s.slice(1)));
  const ds = new Blob([unb64u(s.slice(1))]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return await new Response(ds).text();
}
/** سؤال يعتمد على ملف رفعه المعلم من جهازه (صورة/تسجيل): يبقى على جهاز المعلم ولا يُرسل في رابط الطلاب */
export const localMedia = (q) => q.kind === 'audio' || !!(q.cue && q.cue.t === 'image' && String(q.cue.src).startsWith('data:'));
/** ما يُرسل للطلاب: العنوان والإعدادات والأسئلة القابلة للعب؛ تُستبعد الأسماء والتسجيلات/الصور المرفوعة (حجمها كبير للرابط) */
export async function packForStudents(c) {
  const qs = []; let dropped = 0; const droppedList = [];
  for (const q of c.questions.map(normalize)) {
    if (!playable(q)) { dropped++; droppedList.push({ prompt: q.prompt || '(بلا نص)', why: 'غير مكتمل' }); continue; }
    if (localMedia(q)) { dropped++; droppedList.push({ prompt: q.prompt, why: q.kind === 'audio' ? 'تسجيل صوتي من جهازك' : 'صورة من جهازك' }); continue; }
    const x = { ...q }; delete x.preview; delete x.bankRef; qs.push(x);
  }
  const s = c.settings, pack = { v: 1, t: c.title, l: c.lessonTitle || '', q: qs, s: { mode: s.mode, perTurn: s.perTurn, answerTime: s.answerTime, replays: s.replays, theme: s.theme, from: s.from, to: s.to, tod: s.tod, cine: s.cine, flag: s.flag, plate: s.plate, vehicle: s.vehicle, lockVehicle: s.lockVehicle, driver: s.driver, camera: s.camera, allowCamera: s.allowCamera, radio: s.radio, radioVol: s.radioVol } };
  return { hash: `rally=${await deflate(JSON.stringify(pack))}`, dropped, droppedList, count: qs.length };
}
export async function unpackFromHash(hash) {
  const m = /(?:^|[#&])rally=([\w-]+)/.exec(hash || ''); if (!m) return null;
  try {
    const p = JSON.parse(await inflate(m[1])); if (!p || !Array.isArray(p.q)) return null;
    const c = newContest({ title: p.t, lessonTitle: p.l });
    c.questions = p.q.map(normalize); c.settings = { ...DEFAULT_SETTINGS, ...(p.s || {}) }; c.shared = true;
    return c;
  } catch (e) { console.warn('[rally] share decode', e); return null; }
}
export { DOMAINS };
