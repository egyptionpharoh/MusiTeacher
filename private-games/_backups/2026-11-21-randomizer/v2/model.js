// =====================================================================
//  نموذج السؤال في «مكتبة الدروس التفاعلية» + التحويل من/إلى صيغة العجلة الكلاسيكية (edu_questions).
//  Q = { id, type, text, options?, answer, level, src?, sym?, image?, audio?, note? }
//    type: MC اختيار من متعدد · TF صح/خطأ · FILL أكمل الفراغ · ORDER رتّب · OPEN تطبيقي/تفكيري
//    sym: رموز إيقاعية تُرسم مع السؤال (أسئلة «تعرّف الرمز») · image/audio: مرفق (صورة/صوت) للسؤال
// =====================================================================
import { figureSVG } from '../notation/svg.js';

export const TYPES = {
  MC: { label: 'اختيار من متعدد', icon: '🔘' },
  TF: { label: 'صح أو خطأ', icon: '✔️' },
  FILL: { label: 'أكمل الفراغ', icon: '✏️' },
  ORDER: { label: 'ترتيب', icon: '🔢' },
  OPEN: { label: 'تطبيقي / تفكيري', icon: '💡' },
};
export const LEVELS = { easy: 'سهل', medium: 'متوسط', hard: 'صعب' };

export const uid = (p = 'q') => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
export const clone = (x) => JSON.parse(JSON.stringify(x));

/** تنظيف سؤال وضمان صلاحيته (يُستخدم بعد التوليد وقبل الحفظ) */
export function normalize(q) {
  const t = TYPES[q.type] ? q.type : 'MC';
  const s = (v, n = 600) => (typeof v === 'string' ? v.trim().slice(0, n) : '');
  const o = { id: q.id || uid(), type: t, text: s(q.text, 800), level: LEVELS[q.level] ? q.level : 'medium' };
  if (q.src) o.src = s(q.src, 400);
  if (Array.isArray(q.sym) && q.sym.length) o.sym = q.sym.filter((x) => typeof x === 'string').slice(0, 12);
  if (typeof q.image === 'string' && q.image.startsWith('data:image/')) o.image = q.image;
  if (typeof q.audio === 'string' && (q.audio.startsWith('data:audio/') || q.audio.startsWith('/'))) o.audio = q.audio;
  if (q.origin) o.origin = q.origin;
  if (typeof q.bankRef === 'string') o.bankRef = q.bankRef;     // صلة السؤال بأصله في النشاط الجاهز (لدمج التحديثات دون تكرار)
  if (t === 'MC') {
    o.options = (Array.isArray(q.options) ? q.options : []).map((x) => s(String(x ?? ''), 200)).slice(0, 6);
    while (o.options.length < 2) o.options.push('');
    o.answer = Number.isInteger(q.answer) && q.answer >= 0 && q.answer < o.options.length ? q.answer : 0;
  } else if (t === 'TF') o.answer = q.answer === true || q.answer === 'true' || q.answer === 'صح';
  else if (t === 'ORDER') o.answer = (Array.isArray(q.answer) ? q.answer : String(q.answer || '').split(/\n|،|,/)).map((x) => s(String(x), 160)).filter(Boolean).slice(0, 8);
  else o.answer = s(String(q.answer ?? ''), 600);
  return o;
}

/** المشكلات التي تمنع اعتماد السؤال */
export function problems(q) {
  const p = [];
  if (!q.text || !q.text.trim()) p.push('نص السؤال فارغ');
  if (q.type === 'MC') {
    const filled = q.options.filter((x) => x.trim());
    if (filled.length < 2) p.push('يحتاج خيارين على الأقل');
    if (!q.options[q.answer] || !q.options[q.answer].trim()) p.push('حدّد الإجابة الصحيحة');
    if (new Set(filled).size !== filled.length) p.push('خيارات مكررة');
  }
  if (q.type === 'ORDER' && q.answer.length < 2) p.push('أدخل عنصرين على الأقل للترتيب');
  if ((q.type === 'FILL') && !String(q.answer).trim()) p.push('أدخل الإجابة الصحيحة');
  return p;
}

export const answerText = (q) => {
  if (q.type === 'MC') return q.options[q.answer] || '';
  if (q.type === 'TF') return q.answer ? 'صح' : 'خطأ';
  if (q.type === 'ORDER') return q.answer.join(' ← ');
  return q.answer || '';
};

/** خلط عناصر الترتيب للعرض على الطلاب (ثابت لكل سؤال حتى تتطابق الشاشة والورقة المطبوعة) */
export function scrambled(q) {
  const a = q.answer.map((x, i) => ({ x, i }));
  let seed = [...q.id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
  for (let i = a.length - 1; i > 0; i--) { seed = (seed * 1103515245 + 12345) >>> 0; const j = seed % (i + 1); [a[i], a[j]] = [a[j], a[i]]; }
  if (a.every((e, i) => e.i === i) && a.length > 1) a.push(a.shift());
  return a.map((e) => e.x);
}

/** خلط ثابت لخيارات سؤال الاختيار من متعدد (بذرة من معرّف السؤال) حتى لا تكون الإجابة الصحيحة دائمًا الخيار الأول */
export function shuffleOptions(q) {
  if (q.type !== 'MC' || q.options.length < 2) return q;
  let seed = [...q.id].reduce((h, c) => (h * 33 + c.charCodeAt(0)) >>> 0, 11);
  const idx = q.options.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) { seed = (seed * 1664525 + 1013904223) >>> 0; const j = seed % (i + 1); [idx[i], idx[j]] = [idx[j], idx[i]]; }
  return { ...q, options: idx.map((i) => q.options[i]), answer: idx.indexOf(q.answer) };
}

export const symSVG = (sym, k = 16, color) => (sym && sym.length ? figureSVG(sym, { k, color, padX: 0.6 }).svg : '');

// ------------------------------------------------ التوافق مع العجلة الكلاسيكية
const svgDataUrl = (svg) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.replace('<svg ', '<svg style="background:#fff" '))}`;

/** Q → سؤال edu_questions (لتشغيل النشاط في العجلة الكلاسيكية بكل مزاياها) */
export function toClassic(q, libraryId = 'rz_library') {
  const opt = (text, isCorrect) => ({ id: uid('o'), text, isCorrect });
  const base = { id: `rzq_${q.id}`, libraryId, text: q.text, difficulty: { easy: 'EASY', medium: 'MEDIUM', hard: 'HARD' }[q.level] || 'MEDIUM', timeLimit: 30 };
  if (q.image) base.mediaUrl = q.image;
  else if (q.sym && q.sym.length) base.mediaUrl = svgDataUrl(figureSVG(q.sym, { k: 28, color: '#111', padX: 0.8 }).svg);
  if (q.type === 'MC') return { ...base, type: 'MULTIPLE_CHOICE', options: q.options.map((t, i) => opt(t, i === q.answer)) };
  if (q.type === 'TF') return { ...base, type: 'TRUE_FALSE', options: [opt('صح', q.answer === true), opt('خطأ', q.answer === false)] };
  if (q.type === 'FILL') return { ...base, type: 'FILL_BLANK', options: [opt(q.answer, true)] };
  if (q.type === 'ORDER') return { ...base, text: `${q.text}\n(${scrambled(q).join(' – ')})`, type: 'ORDERING', options: [opt(q.answer.join(' ← '), true)] };
  return { ...base, type: 'ESSAY', options: [opt(q.answer || '—', true)] };
}

/** سؤال edu_questions → Q (لاستيراد قوالب المعلم القديمة إلى المكتبة الجديدة دون حذفها) */
export function fromClassic(c) {
  const opts = Array.isArray(c.options) ? c.options : [];
  const correct = opts.find((o) => o.isCorrect) || opts[0] || { text: '' };
  const q = { id: uid(), text: c.text || '', level: { EASY: 'easy', HARD: 'hard' }[c.difficulty] || 'medium', origin: 'classic' };
  if (typeof c.mediaUrl === 'string' && c.mediaUrl.startsWith('data:image/') && !c.mediaUrl.startsWith('data:image/svg')) q.image = c.mediaUrl;
  switch (c.type) {
    case 'MULTIPLE_CHOICE': return normalize({ ...q, type: 'MC', options: opts.map((o) => o.text || ''), answer: Math.max(0, opts.findIndex((o) => o.isCorrect)) });
    case 'TRUE_FALSE': return normalize({ ...q, type: 'TF', answer: (correct.text || '').trim() === 'صح' });
    case 'FILL_BLANK': return normalize({ ...q, type: 'FILL', answer: correct.text });
    case 'ORDERING': return normalize({ ...q, type: 'ORDER', answer: String(correct.text || '').split(/\s*(?:←|-|–|،|,|\n)\s*/) });
    case 'MATCHING': {
      const pairs = opts.map((o) => { try { return JSON.parse(o.text); } catch { return null; } }).filter(Boolean);
      return normalize({ ...q, type: 'OPEN', answer: pairs.map((p) => `${p.left || ''} ↔ ${p.right || ''}`).join(' · '), text: `${q.text || 'صِل كل عنصر بما يناسبه'}` });
    }
    default: return normalize({ ...q, type: 'OPEN', answer: correct.text });
  }
}
