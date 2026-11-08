// تطبيع المبادرات والمشروعات (مبادراتي) + المولدات المساعدة: الجدول الزمني، قائمة المتابعة، نموذج قياس الأثر.
// كل ما يأتي من الذكاء الاصطناعي أو من التخزين أو من المزامنة يمر من هنا قبل العرض أو التصدير.
import { DOMAINS, LEADS, COSTS, SIZES, STAGES, STATUSES } from './taxonomy.js';

const ids = (l) => new Set(l.map((x) => x.id));
const DOMAIN_IDS = ids(DOMAINS), LEAD_IDS = ids(LEADS), COST_IDS = ids(COSTS), SIZE_IDS = ids(SIZES), STAGE_IDS = ids(STAGES), STATUS_IDS = ids(STATUSES);

// eslint-disable-next-line no-control-regex
const CTRL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
/** نص آمن ومحدود. نطاق الأرقام بالشرطة القصيرة يتحول إلى شرطة عادية حتى لا ينقلب في النص العربي. */
export function str(v, max = 600) {
  if (v == null) return '';
  if (typeof v !== 'string') v = typeof v === 'number' ? String(v) : '';
  return v.replace(CTRL, '').replace(/(\d)\s*[–—]\s*(\d)/g, '$1-$2').replace(/[ \t]+/g, ' ').trim().slice(0, max);
}
export function list(v, maxItems = 12, maxLen = 400) {
  if (typeof v === 'string') v = v.split(/\n+/);
  if (!Array.isArray(v)) return [];
  return v.map((x) => str(typeof x === 'object' && x ? x.text || x.t || '' : x, maxLen).replace(/^[-•*\d.)\s]+(?=\S)/, ''))
    .filter(Boolean).slice(0, maxItems);
}
const pick = (v, set, d) => (set.has(v) ? v : d);
const picks = (v, set, d) => { const a = (Array.isArray(v) ? v : [v]).filter((x) => set.has(x)); return a.length ? [...new Set(a)] : d; };
export const int = (v, min, max, d) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : d; };
export const newId = (p = 'p') => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
export const slug = (s) => str(s, 80).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').slice(0, 48) || 'x';

/** مبادرة كاملة أو مختصرة (فكرة مولدة) بشكل مضمون. */
export function normalizeInitiative(raw, source = 'library') {
  const r = raw && typeof raw === 'object' ? raw : {};
  const title = str(r.title, 160);
  if (!title) return null;
  const team = (Array.isArray(r.team) ? r.team : []).map((t) => (typeof t === 'string' ? { r: str(t, 120), tasks: '' } : { r: str(t && (t.r || t.role), 120), tasks: str(t && (t.tasks || t.task), 300), name: str(t && t.name, 120) }))
    .filter((t) => t.r).slice(0, 10);
  const resources = (Array.isArray(r.resources) ? r.resources : []).map((x) => (typeof x === 'string' ? { i: str(x, 200), c: 'free', alt: '' } : { i: str(x && (x.i || x.item), 200), c: pick(x && (x.c || x.cost), COST_IDS, 'low'), alt: str(x && (x.alt || x.alternative), 200) }))
    .filter((x) => x.i).slice(0, 12);
  const phases = (Array.isArray(r.phases) ? r.phases : []).map((p) => ({
    t: str(p && (p.t || p.title), 140), w: int(p && (p.w || p.weeks), 1, 40, 1), by: str(p && (p.by || p.owner), 140), steps: list(p && (p.steps || p.activities), 10, 300),
  })).filter((p) => p.t).slice(0, 8);
  const kpis = (Array.isArray(r.kpis) ? r.kpis : []).map((k) => (typeof k === 'string' ? { k: str(k, 300), tool: '' } : {
    k: str(k && (k.k || k.indicator), 300), tool: str(k && (k.tool || k.measure), 200), base: str(k && k.base, 120), target: str(k && k.target, 120), result: str(k && k.result, 200),
  })).filter((k) => k.k).slice(0, 8);
  const weeksFromPhases = phases.reduce((s, p) => s + p.w, 0);
  const isLib = source === 'library';
  return {
    id: str(r.id, 80) || `${source === 'ai' ? 'ai' : 'x'}-${slug(title)}`,
    source: ['library', 'ai', 'mine'].includes(source) ? source : 'library',
    title,
    slogan: str(r.slogan, 160),
    domain: pick(r.domain, DOMAIN_IDS, 'academic'),
    topic: str(r.topic, 80),
    lead: pick(r.lead, LEAD_IDS, 'teacher'),
    cost: pick(r.cost, COST_IDS, 'low'),
    size: pick(r.size, SIZE_IDS, 'medium'),
    stages: picks(r.stages, STAGE_IDS, ['c1', 'c2', 'post']),
    weeks: int(r.weeks, 1, 52, weeksFromPhases || 4),
    featured: !!r.featured,
    brief: !phases.length,                                // فكرة مختصرة لم تُطوَّر بعد
    summary: str(r.summary, 1200),
    problem: str(r.problem, 900),
    rationale: list(r.rationale, 6, 300),
    goal: str(r.goal, 400),
    objectives: list(r.objectives, 8, 300),
    audience: str(r.audience, 300),
    beneficiaries: str(r.beneficiaries, 300),
    team, partners: list(r.partners, 8, 200), resources, phases, kpis,
    evaluation: list(r.evaluation, 8, 300),
    outputs: list(r.outputs, 8, 300),
    sustain: list(r.sustain, 8, 300),
    approvals: list(r.approvals, 8, 300),
    join: str(r.join, 400),
    why: str(r.why, 400),
    survey: list(r.survey, 6, 200),                                  // للأفكار المولدة: لماذا هي مختلفة
    refs: isLib ? list(r.refs, 6, 400) : [],
  };
}

// ----------------------------------------------------------------- مبادراتي (مشروع قيد العمل)
export const DEFAULT_META = Object.freeze({ school: '', presenter: '', year: '', startDate: '', logo: '' });

export function defaultYear(now = new Date()) {
  const y = now.getFullYear(); const start = now.getMonth() >= 7 ? y : y - 1;
  return `${start}-${start + 1}`;
}

/** مشروع: نسخة قابلة للتعديل من مبادرة + بيانات التنفيذ والمتابعة. */
export function normalizeProject(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const plan = normalizeInitiative({ ...(r.plan || {}), id: (r.plan && r.plan.id) || 'plan' }, 'mine') || normalizeInitiative({ title: 'مبادرة بلا عنوان' }, 'mine');
  const m = r.meta || {};
  const logo = typeof m.logo === 'string' && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(m.logo) && m.logo.length < 400000 ? m.logo : '';
  return {
    v: 1,
    id: str(r.id, 80) || newId('p'),
    sourceId: str(r.sourceId, 80),
    origin: ['library', 'ai', 'mixed', 'manual'].includes(r.origin) ? r.origin : 'library',
    status: pick(r.status, STATUS_IDS, 'idea'),
    createdAt: int(r.createdAt, 0, 9e15, Date.now()),
    updatedAt: int(r.updatedAt, 0, 9e15, Date.now()),
    plan,
    meta: { school: str(m.school, 160), presenter: str(m.presenter, 200), year: str(m.year, 40), startDate: /^\d{4}-\d{2}-\d{2}$/.test(m.startDate || '') ? m.startDate : '', logo },
    tasks: (Array.isArray(r.tasks) ? r.tasks : []).map((t) => ({ id: str(t && t.id, 40) || newId('t'), phase: int(t && t.phase, 0, 20, 0), text: str(t && t.text, 300), done: !!(t && t.done), doneAt: int(t && t.doneAt, 0, 9e15, 0) })).filter((t) => t.text).slice(0, 120),
    log: (Array.isArray(r.log) ? r.log : []).map((e) => ({
      id: str(e && e.id, 40) || newId('l'), date: /^\d{4}-\d{2}-\d{2}$/.test((e && e.date) || '') ? e.date : '', activity: str(e && e.activity, 200),
      notes: str(e && e.notes, 1500), results: str(e && e.results, 800), photos: list(e && e.photos, 6, 60),
    })).filter((e) => e.activity || e.notes).slice(0, 200),
    results: { summary: str(r.results && r.results.summary, 2000), lessons: str(r.results && r.results.lessons, 1500) },
    notes: str(r.notes, 3000),
    aiSections: list(r.aiSections, 20, 30),
  };
}

/** يبدأ مشروعًا من مبادرة (من المكتبة أو مولدة أو نسخة). */
export function projectFromInitiative(init, { origin, meta } = {}) {
  const plan = normalizeInitiative(init, 'mine');
  const now = Date.now();
  return normalizeProject({
    id: newId('p'), sourceId: init.id, origin: origin || (init.source === 'ai' ? 'ai' : 'library'), status: plan.brief ? 'idea' : 'planning',
    createdAt: now, updatedAt: now, plan: { ...plan, featured: false }, meta: { year: defaultYear(), ...(meta || {}) }, tasks: tasksFromPhases(plan.phases),
  });
}

/** نسخة جديدة مستقلة من مشروع (للتعديل دون المساس بالأصل). */
export function duplicateProject(p) {
  const now = Date.now();
  return normalizeProject({ ...p, id: newId('p'), createdAt: now, updatedAt: now, status: p.status === 'idea' ? 'idea' : 'planning', plan: { ...p.plan, title: `${p.plan.title} (نسخة)` }, log: [], results: {}, tasks: p.tasks.map((t) => ({ ...t, id: newId('t'), done: false, doneAt: 0 })) });
}

// ----------------------------------------------------------------- مولد قائمة المتابعة
export function tasksFromPhases(phases) {
  const out = [];
  (phases || []).forEach((ph, i) => (ph.steps || []).forEach((s) => out.push({ id: newId('t'), phase: i, text: s, done: false, doneAt: 0 })));
  return out;
}
/** يدمج خطوات الخطة الحالية مع القائمة: يبقي الإنجاز للخطوات الموجودة ويضيف الجديدة. */
export function syncTasks(tasks, phases) {
  const done = new Map(tasks.filter((t) => t.done).map((t) => [`${t.phase}|${t.text}`, t]));
  const fresh = tasksFromPhases(phases).map((t) => { const d = done.get(`${t.phase}|${t.text}`); return d ? { ...t, id: d.id, done: true, doneAt: d.doneAt } : t; });
  const custom = tasks.filter((t) => t.phase >= (phases || []).length);   // مهام أضافها المعلم خارج المراحل
  return [...fresh, ...custom];
}
export function progressOf(p) {
  const n = p.tasks.length; const d = p.tasks.filter((t) => t.done).length;
  return { done: d, total: n, pct: n ? Math.round((d / n) * 100) : 0 };
}

// ----------------------------------------------------------------- مولد الجدول الزمني
const DAY = 864e5;
const iso = (d) => new Date(d).toISOString().slice(0, 10);
export function parseDate(s) { if (!/^\d{4}-\d{2}-\d{2}$/.test(s || '')) return null; const t = Date.parse(`${s}T00:00:00Z`); return Number.isFinite(t) ? t : null; }
/** يحوّل المراحل إلى فترات متتابعة. إن وُجد تاريخ بداية تُحسب التواريخ (الأسبوع الدراسي من الأحد إلى الخميس). */
export function timelineOf(phases, startDate) {
  const start = parseDate(startDate);
  let w = 0;
  return (phases || []).map((p, i) => {
    const fromW = w + 1; w += p.w; const toW = w;
    const row = { i, title: p.t, by: p.by, weeks: p.w, fromWeek: fromW, toWeek: toW };
    if (start != null) {
      // نبدأ من الأحد التالي/الحالي لتاريخ البداية
      const d0 = new Date(start); const dow = d0.getUTCDay();            // 0 = الأحد
      const sunday = start + (((7 - dow) % 7) * DAY);
      const from = sunday + (fromW - 1) * 7 * DAY; const to = sunday + ((toW - 1) * 7 + 4) * DAY;   // الخميس
      row.from = iso(from); row.to = iso(to);
    }
    return row;
  });
}
export function fmtDate(s) {
  const t = parseDate(s); if (t == null) return '';
  try { return new Intl.DateTimeFormat('ar-OM-u-nu-latn', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(t)); } catch { return s; }
}

// ----------------------------------------------------------------- مولد نموذج قياس الأثر
const SURVEY_ITEMS = {
  academic: ['أصبحت أفهم المهارة المستهدفة أفضل من قبل.', 'شعرت أن الأنشطة تناسب مستواي.', 'أستطيع الاستمرار في التدرب وحدي.'],
  digital: ['أضافت المبادرة لي مهارة رقمية جديدة.', 'أستطيع تطبيق ما تعلمته دون مساعدة.', 'أستخدم التقنية الآن بوعي أكبر بالأمان والمسؤولية.'],
  culture: ['أتاحت لي المبادرة التعبير عن موهبتي أو اهتمامي.', 'تعرفت على جانب ثقافي أو فني جديد.', 'أشعر بالفخر بما أنجزناه.'],
  values: ['أصبحت أكثر وعيًا بأثر سلوكي في الآخرين.', 'لاحظت تحسنًا في الأجواء داخل صفي أو مدرستي.', 'أشعر بمسؤولية أكبر تجاه مدرستي وزملائي.'],
  health: ['تعلمت عادة صحية أو بيئية جديدة.', 'أطبق ما تعلمته في المدرسة أو المنزل.', 'لاحظت تحسنًا في البيئة المدرسية.'],
  community: ['شعرت أن المدرسة والمجتمع يتعاونان.', 'أصبحت أعرف احتياجات مجتمعي أكثر.', 'أرغب في التطوع مرة أخرى.'],
  professional: ['استفدت من ممارسة يمكن تطبيقها في صفي.', 'كان الوقت المخصص مناسبًا لطبيعة عملي.', 'سأستمر في المشاركة.'],
  leadership: ['نمت لدي مهارة قيادية أو تواصلية.', 'شعرت أن صوتي مسموع في المدرسة.', 'تحملت مسؤولية حقيقية.'],
  occasions: ['شاركت بفاعلية في الفعالية.', 'تعلمت شيئًا جديدًا عن المناسبة.', 'كانت الفعالية منظمة.'],
};
/** استبانة مختصرة للمستفيدين (بلا أسماء ولا أسئلة شخصية): بنود المجال + بند عام + أسئلة مفتوحة. */
export function surveyOf(plan) {
  const young = plan.stages.length === 1 && plan.stages[0] === 'c1' && plan.domain !== 'professional';
  if (young) {
    return { title: `رأيي في المبادرة: ${plan.title}`, intro: 'لوّن الوجه الذي يعبّر عنك.', scale: ['😟', '😐', '😊'],
      items: ['استمتعت بالمشاركة.', 'تعلمت شيئًا جديدًا.', 'أريد أن نكررها.'], open: ['ما أكثر شيء أعجبك؟'] };
  }
  const items = [...(plan.survey && plan.survey.length ? plan.survey : (SURVEY_ITEMS[plan.domain] || SURVEY_ITEMS.academic)), 'كانت أنشطة المبادرة واضحة ومنظمة.', 'أنصح بتكرار المبادرة.'];
  return { title: `استبانة قياس أثر: ${plan.title}`, intro: 'استبانة قصيرة بلا اسم. إجابتك تساعدنا على تحسين المبادرة.',
    scale: ['لا أوافق', 'أوافق إلى حد ما', 'أوافق', 'أوافق بشدة'], items, open: ['ما أكثر ما استفدت منه؟', 'ما الذي تقترح تحسينه؟'] };
}

// ----------------------------------------------------------------- منع التكرار
export function normTitle(t) {
  return str(t, 200).replace(/[ً-ْـ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
}
const STOP = new Set(['مبادره', 'مبادرة', 'المدرسه', 'مدرسي', 'مدرسيه', 'الطلبه', 'لطلبه', 'برنامج']);
function words(t) { return new Set(normTitle(t).split(' ').filter((x) => x.length > 2 && !STOP.has(x))); }
export function similarity(a, b) {
  const A = words(a), B = words(b); if (!A.size || !B.size) return 0;
  let n = 0; for (const x of A) if (B.has(x)) n++;
  return n / Math.min(A.size, B.size);
}
export function dedupe(items, existing = [], key = (x) => x.title) {
  const seen = [...existing]; const out = [];
  for (const it of items) {
    if (!it) continue; const t = key(it);
    if (seen.some((s) => normTitle(s) === normTitle(t) || similarity(s, t) >= 0.75)) continue;
    seen.push(t); out.push(it);
  }
  return out;
}
