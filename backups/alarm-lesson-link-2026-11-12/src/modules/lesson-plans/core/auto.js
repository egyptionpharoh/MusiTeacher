// 🤝 الربط التلقائي بين «خطة الصف» و«جدول الحصص في المنبّه» — يُحسب لحظيًا ولا يُخزَّن، فيتبع أي تعديل في الخطة أو الجدول دون تكرار.
//
// الخطة تحدد: أي درس، وفي أي أسابيع/تواريخ، وكم حصة (إن ذُكر).  المنبّه يحدد: الحصص الفعلية لكل صف/شعبة (بعد الإجازات والإلغاء والحصص الاستثنائية).
// القاعدة: لكل حصة فعلية نبحث عن دروس خطة صفها التي تقع فترتها في تاريخ الحصة:
//   • درس واحد فقط ⇒ ربط مؤكد، ورقم الحصة = ترتيبها بين حصص الشعبة داخل فترة الدرس.
//       - إن تجاوز ترتيبها عدد حصص الدرس المكتوب في الخطة ⇒ «يحتاج مراجعة» (لا نفترض أي درس بعده).
//   • عدة دروس في نفس التاريخ ⇒ إن كان عدد حصص كل درس معروفًا نوزعها بالترتيب على الحصص الفعلية،
//       وإلا ⇒ «يحتاج مراجعة» مع الدروس المحتملة (لا نخمّن).
//   • لا درس في هذا التاريخ ⇒ «لا يوجد درس مخطط» • لا خطة لهذا الصف ⇒ «لا توجد خطة لهذا الصف».
// تصحيحات المعلم (overrides) تُطبَّق على الحصة المعنية فقط، وتُحتسب عند ترقيم بقية الحصص.
import { gradeNum, classKeyOf, overrideKey } from './model.js';
import { lessonTiming, maxWeekOf } from './calendar.js';
import { occurrences } from './track.js';

const winCache = new WeakMap();
/** فترات دروس خطة (بترتيبها في الخطة) */
export function planWindows(plan) {
  if (winCache.has(plan)) return winCache.get(plan);
  const lessons = plan.units.flatMap((u) => u.lessons.map((l) => ({ ...l, unitTitle: u.title })));
  const mx = maxWeekOf(lessons.map((l) => l.weeks));
  const out = lessons.map((l, order) => {
    let start = '', end = '';
    if (l.start) { start = l.start; end = l.end && l.end >= l.start ? l.end : l.start; } else {
      const t = lessonTiming({ weeks: l.weeks, year: plan.year, semester: plan.semester, maxWeek: mx });
      if (t.state === 'ok') { start = t.start; end = t.end; }
    }
    return { plan, lesson: l, order, start, end };
  });
  winCache.set(plan, out);
  return out;
}

const cand = (w) => ({ planId: w.plan.id, lessonId: w.lesson.id, title: w.lesson.title, unitTitle: w.lesson.unitTitle || '', sessions: w.lesson.sessions });
const teachingEvent = (e) => !e.cancelled && (e.type === 'lesson' || (e.type === 'extra' && e.kind === 'lesson'));

/** خطط صفٍّ (برقمه 1–12) */
export const plansOfGrade = (ws, g) => ws.plans.filter((p) => gradeNum(p.grade) === g);

/**
 * ربط حصة واحدة (event من resolveDay) بدرس من خطة صفها.
 * يعيد: { state: 'sure'|'review'|'none'|'no-plan'|'no-grade'|'hidden', lesson?, part, sessions, inWindow, candidates, reason, overridden }
 */
export function autoLinkEvent(ws, profile, dateKey, e, memo = new Map()) {
  const l = e.lesson || {};
  const g = gradeNum(l.grade);
  if (!g) return { state: 'no-grade', reason: 'لم يُحدَّد صف هذه الحصة في جدول المنبّه' };
  const grades = ws.settings ? ws.settings.grades : [];
  if (grades.length && !grades.includes(g)) return { state: 'hidden', reason: 'هذا الصف غير مختار في صفوفك' };
  const ck = classKeyOf(l.grade, l.section);
  const ovMap = memo.get('ov') || new Map((ws.overrides || []).map((o) => [overrideKey(o), o]));
  memo.set('ov', ovMap);
  const ov = ovMap.get(`${profile.id}|${dateKey}|${e.key}`);
  const plans = plansOfGrade(ws, g);
  const windows = plans.flatMap(planWindows);
  if (ov) {
    if (!ov.lessonId) return { state: 'none', overridden: true, reason: 'حددتَ أنه لا يوجد درس من الخطة في هذه الحصة' };
    const w = windows.find((x) => x.plan.id === ov.planId && x.lesson.id === ov.lessonId);
    if (w) return { state: 'sure', overridden: true, ...cand(w), lessonTitle: w.lesson.title, part: null, sessions: w.lesson.sessions, candidates: [] };
    // الدرس المصحَّح لم يعد في الخطة: نعود للحساب التلقائي ونُعلِم المعلم
  }
  if (!plans.length) return { state: 'no-plan', reason: 'لا توجد خطة لهذا الصف' };
  const covering = windows.filter((w) => w.start && w.start <= dateKey && dateKey <= w.end);
  if (!covering.length) {
    const any = windows.some((w) => w.start);
    return { state: 'none', reason: any ? 'لا يوجد درس مخطط لهذا التاريخ في خطة الصف' : 'دروس خطة هذا الصف بلا أسابيع أو تواريخ، فلا يمكن ربطها تلقائيًا' };
  }
  const planIds = new Set(covering.map((w) => w.plan.id));
  if (planIds.size > 1) return { state: 'review', reason: 'أكثر من خطة لهذا الصف تغطي هذا التاريخ', candidates: covering.map(cand) };

  // مجموعة الدروس المتداخلة (تتوسع حتى لا يبقى درس يتداخل مع المدى)
  const pw = windows.filter((w) => w.plan.id === covering[0].plan.id && w.start);
  let comp = covering.slice(), from = comp.reduce((m, w) => (w.start < m ? w.start : m), comp[0].start), to = comp.reduce((m, w) => (w.end > m ? w.end : m), comp[0].end);
  for (let grown = true; grown;) {
    grown = false;
    for (const w of pw) if (!comp.includes(w) && w.start <= to && w.end >= from) { comp.push(w); from = w.start < from ? w.start : from; to = w.end > to ? w.end : to; grown = true; }
  }
  comp.sort((a, b) => a.order - b.order);

  const ok = `${profile.id}|${ck}|${from}|${to}`;
  if (!memo.has(ok)) memo.set(ok, occurrences(profile, ck, from, to));
  const occ = memo.get(ok);
  const idx = occ.findIndex((o) => o.dateKey === dateKey && o.slotKey === e.key);
  if (idx < 0) return { state: 'review', reason: 'تعذر تحديد ترتيب هذه الحصة بين حصص الشعبة', candidates: covering.map(cand) };

  // ترقيم الحصص بعد استبعاد ما صحّحه المعلم
  const ovOf = (o) => ovMap.get(`${profile.id}|${o.dateKey}|${o.slotKey}`);
  // درس واحد فقط مخطط لهذا التاريخ ⇒ هو درس الحصة يقينًا؛ ترقيمها بين حصص الشعبة داخل فترة ذلك الدرس
  if (covering.length === 1) {
    const w = covering[0];
    const own = occ.filter((o) => { if (o.dateKey < w.start || o.dateKey > w.end) return false; const x = ovOf(o); return !x || (x.lessonId === w.lesson.id && x.planId === w.plan.id); });
    const part = own.findIndex((o) => o.dateKey === dateKey && o.slotKey === e.key) + 1;
    const n = w.lesson.sessions;
    if (n && part > n) return { state: 'review', reason: `حصص الشعبة في فترة الدرس أكثر من عدد حصصه في الخطة (${n})`, candidates: [cand(w), ...nextOf(pw, w)], part, inWindow: own.length };
    return { state: 'sure', ...cand(w), lessonTitle: w.lesson.title, part, sessions: n || null, inWindow: own.length, short: !!(n && own.length < n) };
  }
  if (comp.some((w) => !w.lesson.sessions)) return { state: 'review', reason: 'عدة دروس في نفس الفترة ولم يُحدَّد عدد حصص كل منها في الخطة', candidates: covering.map(cand) };
  // توزيع متسلسل حسب عدد الحصص، دون أن يبدأ درس قبل بداية فترته
  let i = 0, used = 0;
  const usedBy = new Map();
  for (let k = 0; k < occ.length; k++) {
    const o = occ[k];
    const x = ovOf(o);
    if (x) {
      if (x.lessonId) { const j = comp.findIndex((w) => w.lesson.id === x.lessonId && w.plan.id === x.planId); if (j >= 0) usedBy.set(j, (usedBy.get(j) || 0) + 1); }
      continue;
    }
    while (i < comp.length && used + (usedBy.get(i) || 0) >= comp[i].lesson.sessions) { i++; used = 0; }
    const here = k === idx;
    if (i >= comp.length) { if (here) return { state: 'review', reason: 'حصص الشعبة في هذه الفترة أكثر من مجموع حصص دروسها في الخطة', candidates: covering.map(cand) }; continue; }
    const w = comp[i];
    if (o.dateKey < w.start || o.dateKey > w.end) {
      if (here) return { state: 'review', reason: 'ترتيب الحصص لا يطابق فترات الدروس في الخطة', candidates: [...new Set([...covering, w])].map(cand) };
      continue;
    }
    used++;
    if (here) return { state: 'sure', ...cand(w), lessonTitle: w.lesson.title, part: used + (usedBy.get(i) || 0), sessions: w.lesson.sessions, inWindow: null };
  }
  return { state: 'review', reason: 'تعذر تحديد الدرس', candidates: covering.map(cand) };
}
function nextOf(pw, w) { const n = pw.filter((x) => x.order > w.order).sort((a, b) => a.order - b.order)[0]; return n ? [cand(n)] : []; }

/** كل حصص يوم معيّن مع حالة ربطها التلقائي (للعرض والمراجعة) */
export function autoLinksForDay(ws, profile, dateKey, day, memo = new Map()) {
  const out = new Map();
  if (!ws || !profile || !day) return out;
  for (const e of day.events) if (teachingEvent(e)) out.set(e.key, autoLinkEvent(ws, profile, dateKey, e, memo));
  return out;
}

/**
 * تصحيح المعلم لحصة واحدة: lessonId = درس محدد، '' = لا درس من الخطة في هذه الحصة، null = إلغاء التصحيح والعودة للتلقائي.
 * يعيد workspace جديدًا (تصحيح واحد فقط لكل حصة؛ لا تكرار).
 */
export function withOverride(ws, { profileId, dateKey, slotKey, classKey = '', planId = '', lessonId }) {
  const k = `${profileId}|${dateKey}|${slotKey}`;
  const rest = (ws.overrides || []).filter((o) => overrideKey(o) !== k);
  if (lessonId === null || lessonId === undefined) return { ...ws, overrides: rest };
  return { ...ws, overrides: [...rest, { id: `o${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, profileId, dateKey, slotKey, classKey, planId: lessonId ? planId : '', lessonId, at: Date.now() }] };
}

/** كل الدروس التي يمكن اختيارها لحصة صفٍّ ما (خطط ذلك الصف مرتبة) */
export function lessonChoices(ws, grade) {
  const g = gradeNum(grade);
  return plansOfGrade(ws, g).map((p) => ({ plan: p, lessons: planWindows(p).map((w) => ({ planId: p.id, lessonId: w.lesson.id, title: w.lesson.title, unitTitle: w.lesson.unitTitle, start: w.start, end: w.end })) }));
}
