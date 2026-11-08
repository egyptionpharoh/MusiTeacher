// المؤلف المحلي: يحوّل فكرة من المكتبة إلى مشغل تدريبي كامل دون أي اتصال خارجي.
// يوزّع الزمن حسب المدة والأسلوب، ويضبط مستوى التفصيل وتنظيم المجموعات حسب عدد المشاركين.
import { normalizeWorkshop, normalizeSettings, newId } from './schema.js';
import { SPECS, STAGES, AUDIENCES, label } from './taxonomy.js';

// أوزان الأقسام حسب الأسلوب (تُطبّع لاحقًا لتساوي المدة بالضبط)
const WEIGHTS = {
  mixed:       { opening: 5, hook: 10, axes: 33, activity: 30, discussion: 9, closing: 6, evaluation: 7 },
  practical:   { opening: 4, hook: 9, axes: 24, activity: 42, discussion: 8, closing: 6, evaluation: 7 },
  interactive: { opening: 5, hook: 12, axes: 24, activity: 32, discussion: 15, closing: 5, evaluation: 7 },
  knowledge:   { opening: 5, hook: 8, axes: 47, activity: 20, discussion: 9, closing: 5, evaluation: 6 },
};
// الحد الأدنى لكل قسم بالدقائق (إن وُجد القسم)
const MIN_STD = { opening: 1, hook: 2, axes: 3, activity: 4, discussion: 2, closing: 1, evaluation: 2 };
const MIN_TINY = { opening: 1, hook: 1, axes: 2, activity: 3, discussion: 1, closing: 1, evaluation: 1 };   // لمشاغل أقل من 15 دقيقة

/** توزيع المدة الكلية على الأقسام بأعداد صحيحة مجموعها = المدة تمامًا. */
export function allocate(total, style = 'mixed', { discussion = true } = {}) {
  const T = Math.max(10, Math.round(total));
  const MIN = T < 15 ? MIN_TINY : MIN_STD;
  const w = { ...(WEIGHTS[style] || WEIGHTS.mixed) };
  if (!discussion || T <= 20) { w.activity += w.discussion * 0.6; w.closing += w.discussion * 0.4; w.discussion = 0; }
  const keys = Object.keys(w).filter((k) => w[k] > 0);
  const sumW = keys.reduce((s, k) => s + w[k], 0);
  const out = {};
  for (const k of keys) out[k] = Math.max(MIN[k], Math.floor((T * w[k]) / sumW));
  let diff = T - keys.reduce((s, k) => s + out[k], 0);
  // نوزّع الفرق على الأقسام الأكبر وزنًا (أو نسحب منها) حتى يتطابق المجموع
  const order = [...keys].sort((a, b) => w[b] - w[a]);
  let guard = 0;
  while (diff !== 0 && guard++ < 500) {
    for (const k of order) {
      if (diff === 0) break;
      if (diff > 0) { out[k]++; diff--; } else if (out[k] > MIN[k]) { out[k]--; diff++; }
    }
  }
  if (!out.discussion) out.discussion = 0;
  return out;
}

/** عدد المحاور المناسب للمدة والتفصيل. */
export function axesCount(total, depth, available) {
  let n = total <= 20 ? 2 : total <= 45 ? 3 : 4;
  if (depth === 'brief') n = Math.min(n, 2);
  if (depth === 'detailed' && total >= 30) n += 1;
  return Math.max(1, Math.min(n, available));
}

/** يقسم دقائق المحاور بينها بالتساوي تقريبًا (الأول يأخذ الباقي). */
export function splitMinutes(total, n) {
  if (n <= 0) return [];
  const base = Math.floor(total / n), rest = total - base * n;
  return Array.from({ length: n }, (_, i) => base + (i < rest ? 1 : 0));
}

// حجم المجموعة المقترح في الفكرة (إن ذُكر) أو حسب عدد المشاركين
function sizeOf(suggested, p) {
  const t = suggested || '';
  if (/فردي/.test(t) && !/ثم/.test(t)) return 1;
  if (/أزواج|زوج/.test(t)) return 2;
  if (/ثلاثي/.test(t)) return 3;
  if (/رباعي/.test(t)) return 4;
  if (/خماسي/.test(t)) return 5;
  return p <= 8 ? 2 : p <= 24 ? 3 : 4;
}
/** عدّ عربي مبسط: 1 مجموعة، 2 مجموعتان، 3–10 مجموعات، 11+ مجموعة. */
export function countAr(n, one, two, few, many) {
  if (n === 1) return one;
  if (n === 2) return two;
  return `${n} ${n <= 10 ? few : many}`;
}
export function groupsCount(participants, suggested) {
  return Math.max(1, Math.ceil(participants / sizeOf(suggested, participants)));
}
export function groupingFor(participants, suggested) {
  const p = participants;
  if (p <= 3) return 'عمل فردي ثم مشاركة مع الميسّر';
  const size = sizeOf(suggested, p);
  if (size === 1) return suggested || 'عمل فردي';
  const n = Math.ceil(p / size);
  const count = size === 2 ? countAr(n, 'زوج واحد', 'زوجان', 'أزواج', 'زوجًا') : countAr(n, 'مجموعة واحدة', 'مجموعتان', 'مجموعات', 'مجموعة');
  const base = suggested || (size === 2 ? 'أزواج' : `مجموعات من ${size} مشاركين`);
  return `${base} — ${count} تقريبًا`;
}

function axisExplain(a, depth) {
  const pts = a.p || [];
  if (!pts.length) return a.ex ? `مثال للتوضيح: ${a.ex}` : '';
  if (depth === 'brief') return pts[0];
  const first = `يبدأ الميسّر بطرح الفكرة: ${pts[0]}`;
  const rest = pts.slice(1).map((p) => p.replace(/\.$/, '')).join('، ثم ');
  const tail = a.ex ? ` ويعرض مثالًا من الواقع المدرسي: ${a.ex}` : '';
  return `${first.replace(/\.$/, '')}${rest ? `، ثم ${rest}.` : '.'}${depth === 'detailed' ? tail : ''}`;
}

const AGREEMENTS = ['الهواتف على الوضع الصامت إلا عند استخدامها في النشاط.', 'كل الآراء مرحب بها، والنقد للفكرة لا للشخص.', 'نلتزم بالوقت المحدد لكل نشاط.', 'لا نذكر أسماء طلبة أو بيانات تعريفية في الأمثلة.'];
const FEEDBACK = ['ما أهم فكرة خرجت بها من هذا المشغل؟', 'ما الذي ستطبقه في صفك خلال الأسبوع القادم؟', 'ما الذي تحتاجه من دعم لتطبيقه؟', 'قيّم المشغل من 1 إلى 5 من حيث الفائدة العملية.'];

function audienceText(idea, s) {
  const parts = [];
  const aud = (idea.audience || ['all']).filter((x) => x !== 'all').map((x) => label(AUDIENCES, x)).filter(Boolean);
  parts.push(aud.length ? aud.join('، ') : 'المعلمون من مختلف التخصصات');
  if (s.spec && s.spec !== 'all') parts.push(`مع التركيز على ${label(SPECS, s.spec)}`);
  if (s.stage && s.stage !== 'all') parts.push(`(${label(STAGES, s.stage)})`);
  return parts.join(' ');
}

/**
 * يبني مشغلًا كاملًا من فكرة مطبّعة وإعدادات.
 * @returns {object} مشغل مطبّع (normalizeWorkshop)
 */
export function composeWorkshop(idea, rawSettings) {
  const s = normalizeSettings({ duration: idea.duration, ...rawSettings });
  const T = s.duration;
  const hasDiscussion = (idea.discussion || []).length > 0;
  const m = allocate(T, s.style, { discussion: hasDiscussion });
  const nAxes = axesCount(T, s.depth, Math.max(1, (idea.axes || []).length));
  const axesSrc = (idea.axes || []).slice(0, nAxes);
  const axMin = splitMinutes(m.axes, axesSrc.length || 1);
  const ptsMax = s.depth === 'brief' ? 2 : s.depth === 'detailed' ? 6 : 3;
  const specNote = s.spec !== 'all' ? `يختار المشاركون أمثلتهم من ${label(SPECS, s.spec)}.` : '';

  const steps = [...(idea.activity.s || [])];
  if (s.participants > 30) steps.push('يعيّن الميسّر ميسّرًا من كل مجموعة لإدارة الوقت وجمع المخرجات، ويعرض عدد محدود من المجموعات فقط.');
  const tips = [];
  if (specNote) tips.push(specNote);
  if (T <= 20) tips.push('في المشغل القصير: يُكتفى بعرض مجموعة أو مجموعتين فقط.');

  const materials = [...(idea.materials || [])];
  const g = groupsCount(s.participants, idea.activity.g);
  if (s.participants > 3) materials.push(`ورقة العمل مطبوعة (${s.participants} نسخة)، وأقلام وأوراق لاصقة لـ${g > 1 ? countAr(g, 'مجموعة واحدة', 'مجموعتين', 'مجموعات', 'مجموعة') : 'كل مشارك'}`);

  const warm = idea.warmup || { t: '', s: [] };
  const w = {
    id: newId(),
    ideaId: idea.id,
    source: idea.source === 'ai' ? 'ai' : 'library',
    aiSections: idea.source === 'ai' ? ['all'] : [],
    createdAt: new Date().toISOString(),
    title: idea.title,
    tagline: idea.tag || '',
    domain: idea.domain,
    format: idea.format,
    level: idea.level,
    settings: s,
    audienceText: audienceText(idea, s),
    summary: idea.summary,
    importance: idea.importance,
    goal: idea.goal,
    objectives: (idea.objectives || []).slice(0, s.depth === 'brief' ? 3 : 6),
    materials,
    strategies: idea.strategies || [],
    outcomes: idea.outcomes || [],
    opening: {
      minutes: m.opening,
      welcome: `ترحيب بالمشاركين وتعريف موجز بالمشغل «${idea.title}»، وبيان الهدف منه: ${(idea.goal || '').replace(/\.$/, '')}.`,
      agreements: T <= 20 ? AGREEMENTS.slice(0, 2) : AGREEMENTS,
    },
    hook: { minutes: m.hook, title: warm.t, steps: warm.s, purpose: 'إثارة الاهتمام وربط موضوع المشغل بخبرات المشاركين قبل عرض المحتوى.' },
    axes: axesSrc.map((a, i) => ({
      minutes: axMin[i] || 0,
      title: a.t,
      explain: axisExplain(a, s.depth),
      points: (a.p || []).slice(0, ptsMax),
      example: a.ex || '',
    })),
    activity: {
      minutes: m.activity,
      title: idea.activity.t,
      grouping: groupingFor(s.participants, idea.activity.g),
      steps,
      output: idea.activity.out,
      tips,
    },
    discussion: { minutes: m.discussion || 0, questions: m.discussion ? (idea.discussion || []) : [] },
    closing: {
      minutes: m.closing,
      takeaway: (idea.outcomes || [])[0] || '',
      recs: (idea.recs || []).slice(0, s.depth === 'brief' ? 2 : 5),
    },
    evaluation: {
      minutes: m.evaluation,
      method: (idea.evaluation && idea.evaluation.m) || 'بطاقة خروج',
      items: (idea.evaluation && idea.evaluation.items) || [],
      feedback: T <= 20 ? FEEDBACK.slice(0, 2) : FEEDBACK,
    },
    refs: idea.source === 'library' ? (idea.refs || []) : [],
  };
  // إن لم تُدرج المحاور كلها، نضيف ملخّص البقية إلى ملاحظات الميسر
  const rest = (idea.axes || []).slice(nAxes);
  if (rest.length) w.notes = `محاور إضافية يمكن تناولها إن سمح الوقت: ${rest.map((a) => a.t).join('؛ ')}.`;
  return normalizeWorkshop(w);
}

/** يعيد توزيع الدقائق بعد تغيير مدة المشغل مع الإبقاء على المحتوى كما هو. */
export function retime(workshop, duration, style) {
  const w = normalizeWorkshop(workshop);
  const s = normalizeSettings({ ...w.settings, duration, style: style || w.settings.style });
  const m = allocate(s.duration, s.style, { discussion: w.discussion.questions.length > 0 });
  const ax = splitMinutes(m.axes, w.axes.length || 1);
  return normalizeWorkshop({
    ...w, settings: s,
    opening: { ...w.opening, minutes: m.opening },
    hook: { ...w.hook, minutes: m.hook },
    axes: w.axes.map((a, i) => ({ ...a, minutes: ax[i] || 0 })),
    activity: { ...w.activity, minutes: m.activity },
    discussion: { ...w.discussion, minutes: m.discussion || 0 },
    closing: { ...w.closing, minutes: m.closing },
    evaluation: { ...w.evaluation, minutes: m.evaluation },
  });
}
