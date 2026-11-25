// محرك «مستشار المعلم في اللجان والامتحانات»: استرجاع محلي من قاعدة المعرفة.
// لا ذكاء اصطناعي توليدي، ولا طلبات شبكة، ولا مفاتيح API — مجرد بحث موزون بالكلمات والمرادفات.
// إن لم يجد إجابة موثوقة يقول ذلك صراحة ويوجّه إلى الجهة المختصة.
import { normalizeArabic, tokenize, buildSynonyms } from './normalize.js';

export const EXAMS = [
  { id: 'transfer', label: 'امتحانات النقل' },
  { id: 'certificate', label: 'امتحانات الشهادة' },
  { id: 'diploma', label: 'امتحانات الدبلوم العام' },
  { id: 'general', label: 'استفسار عام' },
];
export const ROLES = [
  { id: 'invigilator', label: 'مراقب لجنة' },
  { id: 'control', label: 'عضو كنترول' },
  { id: 'monitoring', label: 'عضو مراقبة' },
  { id: 'other', label: 'تكليف آخر' },
  { id: 'unknown', label: 'غير محدد بعد' },
];
export const examLabel = (id) => (EXAMS.find((e) => e.id === id) || {}).label || '';
export const roleLabel = (id) => (ROLES.find((r) => r.id === id) || {}).label || '';

export const FALLBACK = 'لا تتوفر لدي معلومات موثقة كافية للإجابة عن هذا الاستفسار بدقة. أنصحك بالرجوع إلى رئيس اللجان (رئيس مركز الامتحانات) أو المراقب الأول للحصول على التوجيه الصحيح وفق طبيعة تكليفك.';

// عتبات الثقة (اختُبرت في tests/committee-advisor.test.mjs)
export const THRESHOLDS = { answer: 0.5, suggest: 0.3, tie: 0.06 };
const W = { q: 3, alt: 2.6, key: 2, body: 0.6 };

const partsText = (e) => (e.parts || []).map((p) => [p.text || '', ...(p.list || [])].join(' ')).join(' ');
const EXAM_WORDS = { نقل: 'transfer', شهاده: 'certificate', دبلوم: 'diploma' };

export function createAdvisor({ entries, synonyms }) {
  const syn = buildSynonyms(synonyms || []);
  const byId = new Map(entries.map((e) => [e.id, e]));
  const index = entries.map((e) => {
    const w = new Map();
    const add = (text, weight) => { for (const t of tokenize(text, syn)) if ((w.get(t) || 0) < weight) w.set(t, weight); };
    add(partsText(e), W.body); add((e.keys || []).join(' '), W.key); add((e.alts || []).join(' '), W.alt); add(e.q, W.q);
    return { e, w };
  });
  const df = new Map();
  for (const { w } of index) for (const t of w.keys()) df.set(t, (df.get(t) || 0) + 1);
  const N = index.length;
  const vocab = new Set(df.keys());
  // كلمات «المجال» (من الأسئلة والكلمات المفتاحية فقط): تحدد هل السؤال عن اللجان والامتحانات أصلًا
  const domain = new Set();
  for (const e of entries) for (const t of tokenize([e.q, ...(e.keys || [])].join(' '), syn)) domain.add(t);
  const suggestable = (e) => e && e.suggest !== false;
  // كلمات عامة (الامتحان ونوعه) تحدد السياق ولا تكفي وحدها لاعتبار السؤال مطابقًا لمدخل
  const generic = new Set(tokenize('امتحان امتحانات الامتحان الامتحانات اختبار اختبارات دبلوم الدبلوم نقل النقل شهادة الشهادة', syn, null));
  const idf = (t) => Math.log(1 + N / (df.get(t) || 0.5));

  function rank(text, ctx = {}) {
    const toks = [...new Set(tokenize(text, syn, vocab))];
    if (!toks.length) return { toks, ranked: [] };
    // الكلمات غير الموجودة في القاعدة (حشو أو عامية) تُحسب بوزن أقل في المقام
    const max = toks.reduce((n, t) => n + idf(t) * W.q * (vocab.has(t) ? 1 : 0.4), 0);
    const ranked = index.map(({ e, w }) => {
      let s = 0; let strong = 0; let hit = 0; let specific = 0;
      for (const t of toks) {
        const v = w.get(t) || 0; s += idf(t) * v;
        if (generic.has(t)) continue;
        specific++; if (v >= W.key) strong++; if (v > 0) hit++;
      }
      let cov = s / max;
      if (ctx.exam && ctx.exam !== 'general' && !e.exams.includes('all')) cov += e.exams.includes(ctx.exam) ? 0.04 : -0.04;
      if (e.cat === 'about') cov -= 0.03; // أسئلة «عن المستشار» لا تتقدم إلا بسؤال صريح
      return { e, cov: +cov.toFixed(4), strong, hit: specific ? hit / specific : 0 };
    }).filter((r) => r.cov > 0).sort((a, b) => b.cov - a.cov);
    return { toks, ranked };
  }

  /** يطبّق شروط السياق على مدخل محدد (نوع الامتحان وطبيعة التكليف) */
  function resolve(entry, ctx = {}, { force } = {}) {
    const notes = [];
    const examSpecific = !entry.exams.includes('all');
    if (examSpecific && !force) {
      if (!ctx.exam) return { type: 'need-exam', entry, text: 'تختلف الإجابة عن هذا الموضوع بحسب نوع الامتحان. حتى أقدم لك إجابة مناسبة، أخبرني عن نوع الامتحان الذي تستفسر بشأنه:' };
      if (ctx.exam !== 'general' && !entry.exams.includes(ctx.exam)) {
        const only = entry.exams.map(examLabel).join(' و');
        const alts = (entry.next || []).map((id) => byId.get(id)).filter((x) => suggestable(x) && (x.exams.includes('all') || x.exams.includes(ctx.exam))).slice(0, 3);
        return { type: 'mismatch', entry, exam: ctx.exam, related: alts, text: `المعلومات المتوفرة لدي عن هذا الموضوع تخص ${only} فقط، ولا تتوفر لدي معلومات موثقة عن ${examLabel(ctx.exam)} في هذا الشأن.`, refer: 'رئيس اللجان (رئيس مركز الامتحانات) أو الجهة المسؤولة عن الامتحانات في مدرستك' };
      }
    }
    if (examSpecific && (ctx.exam === 'general' || force)) notes.push(`هذه الإجابة تخص ${entry.exams.map(examLabel).join(' و')}.`);
    if (entry.cat === 'examday' && (ctx.role === 'control' || ctx.role === 'other')) {
      notes.push('هذه تعليمات موجهة للملاحظين (مراقبي اللجان) داخل القاعات؛ إن كان تكليفك في الكنترول أو عمل آخر فاسأل رئيس المركز عن مواعيدك ومهامك.');
    }
    const related = (entry.next || []).map((id) => byId.get(id)).filter(suggestable).slice(0, 3);
    return { type: 'answer', entry, notes, related };
  }

  /** سؤال مكتوب بحرية */
  function ask(text, ctx = {}) {
    const raw = String(text || '').trim();
    const n = normalizeArabic(raw);
    if (!n) return { type: 'clarify', text: 'اكتب سؤالك، أو اختر أحد الأسئلة المقترحة.' };
    if (/\d{8,}/.test(raw.replace(/[\s-]/g, '')) || /\bom\d{2}/i.test(raw)) {
      return { type: 'private', text: 'يبدو أن رسالتك تحتوي أرقامًا قد تكون بيانات شخصية (رقم مدني أو حساب بنكي). لا يحتاج المستشار إلى أي بيانات شخصية، ولم يُحفظ شيء منها. أعد كتابة سؤالك دون هذه الأرقام.' };
    }
    if (/^(السلام عليكم|سلام|مرحبا|اهلا|هلا|صباح الخير|مساء الخير)( .*)?$/.test(n) && n.split(' ').length <= 4) {
      return { type: 'smalltalk', text: 'وعليكم السلام ومرحبًا بك. اسألني عن مهامك في اللجان والامتحانات، أو اختر سؤالًا مقترحًا.' };
    }
    if (/^(شكرا|شكرا لك|جزاك الله خير|مشكور|تسلم|يعطيك العافيه)( .*)?$/.test(n) && n.split(' ').length <= 5) {
      return { type: 'smalltalk', text: 'العفو، بالتوفيق في تكليفك. أنا هنا متى احتجت.' };
    }
    // تعرّف نوع الامتحان من نص السؤال نفسه
    const local = { ...ctx };
    const { toks, ranked } = rank(raw, local);
    const examFromText = toks.map((t) => EXAM_WORDS[t]).find(Boolean);
    if (examFromText) local.exam = examFromText;
    if (!toks.length || (toks.length === 1 && !ranked.length)) return { type: 'clarify', text: 'لم يتضح لي المقصود من سؤالك. أضف تفاصيل أكثر — مثلًا: ماذا يحدث في اجتماع المراقبين؟ أو: ماذا أفعل إذا لاحظت مخالفة؟' };
    const rr = examFromText ? rank(raw, local).ranked : ranked;
    const [a, b] = rr;
    if (!a || a.cov < THRESHOLDS.suggest || a.strong === 0) return { type: 'unknown', text: FALLBACK, examFromText };
    const close = rr.filter((r) => r.cov >= THRESHOLDS.suggest && a.cov - r.cov <= THRESHOLDS.tie).slice(0, 3);
    // إجابة مباشرة فقط عند تطابق واضح: نسبة كافية من كلمات السؤال موجودة في المدخل نفسه
    if (a.cov < THRESHOLDS.answer || a.hit < 0.5 || (close.length > 1 && (a.cov < 0.9 || toks.length === 1))) {
      const opts = (close.length > 1 ? close : rr.filter((r) => r.cov >= THRESHOLDS.suggest).slice(0, 3)).map((r) => r.e);
      if (opts.length === 1 && a.cov >= THRESHOLDS.answer && a.hit >= 0.5) return { ...resolve(a.e, local), examFromText };
      return { type: 'choices', options: opts, text: 'هل تقصد أحد هذه الأسئلة؟', examFromText };
    }
    return { ...resolve(a.e, local), examFromText, score: a.cov };
  }

  /** سؤال مختار بالضغط */
  function answerEntry(id, ctx = {}, opts) {
    const e = byId.get(id);
    return e ? resolve(e, ctx, opts) : { type: 'unknown', text: FALLBACK };
  }

  /** هل السؤال عن اللجان والامتحانات؟ (يمنع إرسال أسئلة خارج المجال إلى أي خدمة) */
  function inDomain(text) {
    return tokenize(text, syn, vocab).some((t) => domain.has(t));
  }

  /** أقرب المدخلات لسؤال (حتى لو دون عتبة الإجابة) — سياق موثق يُرفق مع الاستعانة بالذكاء الاصطناعي */
  function contextFor(text, ctx = {}, n = 4) {
    return rank(text, ctx).ranked.filter((r) => r.cov >= 0.12).slice(0, n).map((r) => r.e);
  }

  return { ask, answerEntry, rank, inDomain, contextFor, entryById: (id) => byId.get(id), entries };
}
