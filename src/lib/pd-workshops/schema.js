// تطبيع البيانات: كل ما يأتي من الذكاء الاصطناعي أو من التخزين المحلي يمر من هنا قبل العرض أو التصدير.
// الهدف: ألا تنكسر الواجهة أو المصدّرات بسبب حقل ناقص أو نوع خاطئ، وألا يدخل نص غير محدود الطول.
import { DOMAINS, SPECS, AUDIENCES, FORMATS, LEVELS, DEPTHS, STYLES, STAGES, DURATIONS } from './taxonomy.js';

const ids = (list) => new Set(list.map((x) => x.id));
const DOMAIN_IDS = ids(DOMAINS), SPEC_IDS = ids(SPECS), AUD_IDS = ids(AUDIENCES), FORMAT_IDS = ids(FORMATS);
const LEVEL_IDS = ids(LEVELS), DEPTH_IDS = ids(DEPTHS), STYLE_IDS = ids(STYLES), STAGE_IDS = ids(STAGES);

// eslint-disable-next-line no-control-regex
const CTRL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
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
const int = (v, min, max, d) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : d; };

export const slug = (s) => str(s, 80).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').slice(0, 48) || 'idea';
export const newId = (p = 'w') => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

/** فكرة مشغل (من المكتبة أو من الذكاء الاصطناعي) بشكل مضمون. */
export function normalizeIdea(raw, source = 'library') {
  const r = raw && typeof raw === 'object' ? raw : {};
  const title = str(r.title, 160);
  if (!title) return null;
  const axes = (Array.isArray(r.axes) ? r.axes : []).map((a) => (typeof a === 'string'
    ? { t: str(a, 160), p: [], ex: '' }
    : { t: str(a && (a.t || a.title), 160), p: list(a && (a.p || a.points), 6), ex: str(a && (a.ex || a.example), 400) }))
    .filter((a) => a.t).slice(0, 6);
  const w = r.warmup || {}, act = r.activity || {}, ev = r.evaluation || {};
  return {
    id: str(r.id, 80) || `${source === 'ai' ? 'ai' : 'x'}-${slug(title)}`,
    source,
    title,
    domain: pick(r.domain, DOMAIN_IDS, 'strategies'),
    specs: picks(r.specs, SPEC_IDS, ['all']),
    audience: picks(r.audience, AUD_IDS, ['all']),
    duration: int(r.duration, 10, 180, 45),
    format: pick(r.format, FORMAT_IDS, 'workshop'),
    level: pick(r.level, LEVEL_IDS, 'beginner'),
    featured: !!r.featured,
    tag: str(r.tag, 200),
    summary: str(r.summary, 900),
    importance: str(r.importance, 900),
    goal: str(r.goal, 400),
    objectives: list(r.objectives, 8, 300),
    axes,
    materials: list(r.materials, 10, 200),
    strategies: list(r.strategies, 8, 120),
    warmup: { t: str(w.t || w.title, 160), s: list(w.s || w.steps, 6, 300) },
    activity: { t: str(act.t || act.title, 160), g: str(act.g || act.grouping, 160), s: list(act.s || act.steps, 8, 300), out: str(act.out || act.output, 300) },
    discussion: list(r.discussion, 6, 300),
    evaluation: { m: str(ev.m || ev.method, 200), items: list(ev.items, 8, 300) },
    outcomes: list(r.outcomes, 6, 300),
    recs: list(r.recs || r.recommendations, 6, 300),
    refs: source === 'library' ? list(r.refs, 6, 400) : [],   // مراجع الذكاء الاصطناعي لا تُقبل (لا يمكن ضمان وجودها)
  };
}

export const DEFAULT_SETTINGS = Object.freeze({
  duration: 45, participants: 20, spec: 'all', stage: 'all', depth: 'standard', style: 'mixed',
  presenter: '', school: '', date: '', venue: '',
});

export function normalizeSettings(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  return {
    duration: int(r.duration, 10, 180, 45),
    participants: int(r.participants, 2, 300, 20),
    spec: pick(r.spec, SPEC_IDS, 'all'),
    stage: pick(r.stage, STAGE_IDS, 'all'),
    depth: pick(r.depth, DEPTH_IDS, 'standard'),
    style: pick(r.style, STYLE_IDS, 'mixed'),
    presenter: str(r.presenter, 120),
    school: str(r.school, 160),
    date: str(r.date, 60),
    venue: str(r.venue, 120),
  };
}
export const durationChoices = DURATIONS;

const minutes = (v) => int(v, 0, 180, 0);
const steps = (v, n = 8) => list(v, n, 400);

/** المشغل الكامل: يُستخدم للعرض والتحرير والتصدير. */
export function normalizeWorkshop(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const o = r.opening || {}, h = r.hook || {}, a = r.activity || {}, d = r.discussion || {}, c = r.closing || {}, e = r.evaluation || {};
  const w = {
    v: 1,
    id: str(r.id, 80) || newId(),
    ideaId: str(r.ideaId, 80),
    source: ['library', 'ai', 'mixed'].includes(r.source) ? r.source : 'library',
    aiSections: list(r.aiSections, 12, 30),
    createdAt: str(r.createdAt, 40) || new Date().toISOString(),
    updatedAt: str(r.updatedAt, 40) || '',
    title: str(r.title, 160) || 'مشغل تدريبي',
    tagline: str(r.tagline, 200),
    domain: pick(r.domain, DOMAIN_IDS, 'strategies'),
    format: pick(r.format, FORMAT_IDS, 'workshop'),
    level: pick(r.level, LEVEL_IDS, 'beginner'),
    settings: normalizeSettings(r.settings),
    audienceText: str(r.audienceText, 300),
    summary: str(r.summary, 1200),
    importance: str(r.importance, 1200),
    goal: str(r.goal, 400),
    objectives: list(r.objectives, 8, 300),
    materials: list(r.materials, 12, 200),
    strategies: list(r.strategies, 10, 120),
    outcomes: list(r.outcomes, 8, 300),
    opening: { minutes: minutes(o.minutes), welcome: str(o.welcome, 800), agreements: steps(o.agreements, 6) },
    hook: { minutes: minutes(h.minutes), title: str(h.title, 160), steps: steps(h.steps, 6), purpose: str(h.purpose, 400) },
    axes: (Array.isArray(r.axes) ? r.axes : []).map((x) => ({
      minutes: minutes(x && x.minutes),
      title: str(x && x.title, 160),
      explain: str(x && x.explain, 1200),
      points: steps(x && x.points, 8),
      example: str(x && x.example, 600),
    })).filter((x) => x.title).slice(0, 6),
    activity: { minutes: minutes(a.minutes), title: str(a.title, 160), grouping: str(a.grouping, 200), steps: steps(a.steps, 10), output: str(a.output, 400), tips: steps(a.tips, 4) },
    discussion: { minutes: minutes(d.minutes), questions: steps(d.questions, 8) },
    closing: { minutes: minutes(c.minutes), takeaway: str(c.takeaway, 500), recs: steps(c.recs, 8) },
    evaluation: { minutes: minutes(e.minutes), method: str(e.method, 200), items: steps(e.items, 10), feedback: steps(e.feedback, 8) },
    refs: list(r.refs, 8, 400),
    notes: str(r.notes, 2000),
  };
  return w;
}

/** جدول المشغل (يُحسب من دقائق الأقسام، فيبقى صحيحًا بعد أي تعديل). */
export function agendaOf(w) {
  const rows = [];
  const add = (key, title, m) => { if (m > 0) rows.push({ key, title, minutes: m }); };
  add('opening', 'الافتتاح والترحيب', w.opening.minutes);
  add('hook', w.hook.title ? `نشاط تمهيدي: ${w.hook.title}` : 'نشاط تمهيدي', w.hook.minutes);
  w.axes.forEach((x, i) => add(`axis-${i}`, `المحور ${ordinal(i + 1)}: ${x.title}`, x.minutes));
  add('activity', w.activity.title ? `النشاط التطبيقي: ${w.activity.title}` : 'النشاط التطبيقي', w.activity.minutes);
  add('discussion', 'النقاش وتبادل الخبرات', w.discussion.minutes);
  add('closing', 'الخلاصة والتوصيات', w.closing.minutes);
  add('evaluation', 'التقويم والتغذية الراجعة', w.evaluation.minutes);
  let t = 0;
  for (const r of rows) { r.from = t; t += r.minutes; r.to = t; }
  return rows;
}
export const totalMinutes = (w) => agendaOf(w).reduce((s, r) => s + r.minutes, 0);

const ORD = ['الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس', 'السابع', 'الثامن'];
export const ordinal = (n) => ORD[n - 1] || String(n);

/** إزالة التكرار بين الأفكار (عناوين متقاربة جدًا). */
export function normTitle(t) {
  return str(t, 200).replace(/[ً-ْـ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
}
function overlap(a, b) {
  const A = new Set(normTitle(a).split(' ').filter((x) => x.length > 2));
  const B = new Set(normTitle(b).split(' ').filter((x) => x.length > 2));
  if (!A.size || !B.size) return 0;
  let n = 0; for (const x of A) if (B.has(x)) n++;
  return n / Math.min(A.size, B.size);
}
export function dedupeIdeas(ideas, existingTitles = []) {
  const seen = [...existingTitles];
  const out = [];
  for (const i of ideas) {
    if (!i) continue;
    if (seen.some((t) => normTitle(t) === normTitle(i.title) || overlap(t, i.title) >= 0.8)) continue;
    seen.push(i.title); out.push(i);
  }
  return out;
}
