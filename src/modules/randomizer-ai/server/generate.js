// 🤖 «من الدرس إلى النشاط»: توليد أسئلة لعجلة الاختيار من محتوى الدرس الذي يرسله المعلم فقط — على الخادم عبر الاستدعاء الموحّد.
// القاعدة الأساسية: لا معلومة من خارج المحتوى. كل سؤال يحمل «evidence» = جملة منقولة حرفيًا من المحتوى،
// وعند الإدخال النصي نتحقق على الخادم أن هذه الجملة موجودة فعلًا في النص، ونستبعد أي سؤال لا نجد دليله.
import { runStructured } from '../../shared/ai/structured.js';

const S = { type: 'string' };
export const QUIZ_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['questions', 'insufficient', 'message'],
  properties: {
    insufficient: { type: 'boolean' },
    message: S,
    questions: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['type', 'text', 'options', 'answer_index', 'answer_bool', 'answer_text', 'order', 'level', 'evidence'],
        properties: {
          type: { type: 'string', enum: ['MC', 'TF', 'FILL', 'ORDER', 'OPEN'] },
          text: S,
          options: { type: 'array', items: S },
          answer_index: { type: 'integer' },
          answer_bool: { type: 'boolean' },
          answer_text: S,
          order: { type: 'array', items: S },
          level: { type: 'string', enum: ['easy', 'medium', 'hard'] },
          evidence: S,
        },
      },
    },
  },
};

export const QUIZ_SYSTEM = `You write classroom quiz questions in Modern Standard Arabic for a music teacher in Oman, using ONLY the lesson content the teacher provides.
ABSOLUTE RULES:
- Every fact in a question, its correct answer, and its explanation MUST be stated in the provided content. Never use outside knowledge, never invent names, numbers, dates, definitions, instruments or musical facts.
- "evidence": copy, character for character, the shortest sentence or phrase from the content that proves the correct answer (no paraphrase, no ellipsis). If you cannot quote such evidence, do not write the question.
- Wrong options (distractors) must be plausible but must not be presented as facts; they may only come from other items mentioned in the content or be obviously wrong within it.
- If the content is too short or unrelated to produce the requested number of well-supported questions, produce fewer (even zero), set insufficient=true and explain briefly in Arabic in "message" what is missing. Never pad with unsupported questions.
- Types: MC = multiple choice (3–4 options, answer_index = index of the correct option). TF = true/false statement (answer_bool). FILL = sentence with the blank written as "…………" (answer_text = the missing words, copied from the content). ORDER = ordering task (order = items in the correct order as stated in the content, 3–6 items; ONLY if the content states a sequence). OPEN = short applied or thinking question answerable from the content (answer_text = model answer from the content).
- For fields that do not apply to a type, use: options [], answer_index 0, answer_bool false, answer_text "", order [].
- Mix the requested types and difficulty levels; age-appropriate language for the given grade; short, clear Arabic; no duplicates; do not repeat any question listed under "avoid".
- message: one short Arabic sentence for the teacher (e.g. how many questions were possible).`;

const norm = (s) => String(s || '')
  .replace(/[ً-ْـ‌-‏‪-‮]/g, '')
  .replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه')
  .replace(/[«»"'“”‘’()[\]{}:؛،,.!?؟\-–—_…]/g, ' ')
  .replace(/\s+/g, ' ').trim().toLowerCase();

/** هل الدليل موجود في النص؟ (بعد إزالة التشكيل وعلامات الترقيم؛ ويقبل دليلًا طويلًا إذا وُجد 85٪ من كلماته متتالية) */
export function evidenceFound(evidence, content) {
  const e = norm(evidence), c = norm(content);
  if (e.length < 4) return false;
  if (c.includes(e)) return true;
  const w = e.split(' ');
  if (w.length < 6) return false;
  const need = Math.ceil(w.length * 0.85);
  for (let i = 0; i + need <= w.length; i++) if (c.includes(w.slice(i, i + need).join(' '))) return true;
  return false;
}

const s = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : '');

/** تحويل رد النموذج إلى أسئلة صالحة لواجهة العجلة (مع التحقق من الأدلة عند النص) */
export function shapeQuestions(data, { content = '', types = [], count = 10, verify = true } = {}) {
  const raw = Array.isArray(data && data.questions) ? data.questions : [];
  const out = []; let dropped = 0; const seen = new Set();
  for (const q of raw) {
    if (out.length >= count) break;
    const type = ['MC', 'TF', 'FILL', 'ORDER', 'OPEN'].includes(q && q.type) ? q.type : null;
    const text = s(q && q.text, 600); const evidence = s(q && q.evidence, 500);
    if (!type || !text || (types.length && !types.includes(type))) { dropped++; continue; }
    if (verify && !evidenceFound(evidence, content)) { dropped++; continue; }
    const key = norm(text); if (seen.has(key)) { dropped++; continue; } seen.add(key);
    const base = { type, text, level: ['easy', 'medium', 'hard'].includes(q.level) ? q.level : 'medium', src: evidence };
    if (type === 'MC') {
      const options = (Array.isArray(q.options) ? q.options : []).map((o) => s(o, 200)).filter(Boolean).slice(0, 6);
      const ai = Number.isInteger(q.answer_index) ? q.answer_index : -1;
      if (options.length < 2 || ai < 0 || ai >= options.length || new Set(options).size !== options.length) { dropped++; continue; }
      out.push({ ...base, options, answer: ai });
    } else if (type === 'TF') out.push({ ...base, answer: q.answer_bool === true });
    else if (type === 'ORDER') {
      const order = (Array.isArray(q.order) ? q.order : []).map((o) => s(o, 160)).filter(Boolean).slice(0, 8);
      if (order.length < 2) { dropped++; continue; }
      out.push({ ...base, answer: order });
    } else {
      const a = s(q.answer_text, 600);
      if (type === 'FILL' && !a) { dropped++; continue; }
      out.push({ ...base, answer: a });
    }
  }
  return { questions: out, dropped };
}

const TYPE_AR = { MC: 'اختيار من متعدد', TF: 'صح أو خطأ', FILL: 'أكمل الفراغ', ORDER: 'ترتيب', OPEN: 'تطبيقي/تفكيري' };

/**
 * p: { grade, lesson, count, types, avoid, input }
 * يعيد { ok, questions, insufficient, message, dropped, provider } أو { ok:false, status, code, error }
 */
export async function generateQuiz(p, { env = process.env, fetchImpl = fetch } = {}) {
  const count = Math.max(1, Math.min(30, parseInt(p.count, 10) || 10));
  const types = (Array.isArray(p.types) ? p.types : []).filter((t) => TYPE_AR[t]);
  const avoid = (Array.isArray(p.avoid) ? p.avoid : []).map((x) => s(x, 200)).filter(Boolean).slice(0, 40);
  const isText = p.input.kind === 'text';
  // نطلب أكثر قليلًا لأن التحقق قد يستبعد بعض الأسئلة
  const ask = Math.min(30, count + Math.ceil(count * 0.3));
  const header = `Grade: ${s(String(p.grade || ''), 10)} (Omani basic education). Lesson title: ${s(p.lesson, 200)}.\nRequested: ${ask} questions. Allowed types: ${(types.length ? types : Object.keys(TYPE_AR)).join(', ')}.${avoid.length ? `\nAvoid (already used):\n- ${avoid.join('\n- ')}` : ''}`;
  const r = await runStructured(p.input, {
    system: QUIZ_SYSTEM, schema: QUIZ_SCHEMA, tag: 'randomizer generate', maxTokens: 12000,
    instruction: `${header}\nWrite the questions as JSON. Use only the lesson content above${isText ? '' : ' (from the attached pages)'}.`,
    textIntro: 'Lesson content (the ONLY allowed source):',
  }, { env, fetchImpl, disabledError: 'التوليد الذكي غير مفعّل على المنصة حاليًا. استخدم النشاط الجاهز إن وُجد، أو أنشئ الأسئلة يدويًا.' });
  if (!r.ok) return r.code === 'failed' ? { ...r, error: 'تعذر إنشاء الأسئلة الآن (خدمة الذكاء الاصطناعي لم تستجب). حاول بعد قليل، أو أنشئ الأسئلة يدويًا.' } : r;
  const d = r.data && typeof r.data === 'object' ? r.data : {};
  // للصور وملفات PDF الممسوحة لا يوجد نص نتحقق منه على الخادم: نُبقي الدليل ظاهرًا للمعلم ليتأكد منه في المراجعة
  const { questions, dropped } = shapeQuestions(d, { content: isText ? p.input.text : '', types, count, verify: isText });
  let message = s(d.message, 300);
  const insufficient = d.insufficient === true || questions.length < count;
  if (!questions.length) message = message || 'لم نتمكن من إنشاء أسئلة مدعومة بمحتوى الدرس. أضف نصًا أوضح أو أطول للدرس، أو أنشئ الأسئلة يدويًا.';
  else if (questions.length < count) message = `أُنشئ ${questions.length} سؤال من ${count} مطلوبة؛ المحتوى المتوفر لا يكفي لأكثر من ذلك دون اختلاق معلومات.${message ? ` ${message}` : ''}`;
  return { ok: true, questions, insufficient, message, dropped, provider: r.provider, verified: isText };
}
