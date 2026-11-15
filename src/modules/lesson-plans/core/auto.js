// 🤝 الربط التلقائي بين «خطة الصف» و«جدول الحصص في المنبّه» — يُحسب لحظيًا ولا يُخزَّن، فيتبع أي تعديل في الخطة أو الجدول دون تكرار.
//
// الخطة تحدد: أي درس، وفي أي أسابيع/تواريخ، وكم حصة (إن ذُكر).  المنبّه يحدد: الحصص الفعلية لكل صف/شعبة (بعد الإجازات والإلغاء والحصص الاستثنائية).
// لكل حصة فعلية: نجمع دروس خطة صفها المتداخلة الفترات حول تاريخها، ثم يوزّعها «Weekly Lesson Scheduler» (core/weekly.js)
// على حصص الشعبة الفعلية في تلك الفترة: بترتيب الخطة، وبعدد حصص كل درس، دون اختراع درس ولا إسقاط درس بصمت.
//   • لا درس في هذا التاريخ ⇒ «لا يوجد درس مخطط» • لا خطة لهذا الصف ⇒ «لا توجد خطة لهذا الصف» • غموض حقيقي ⇒ «يحتاج مراجعة».
// تصحيحات المعلم (overrides) تُطبَّق على الحصة المعنية فقط، وتُحتسب عند ترقيم بقية الحصص؛ وتصحيحٌ صار لصف آخر بعد تعديل الجدول يُتجاهل.
import { gradeNum, classKeyOf, overrideKey } from './model.js';
import { lessonTiming, maxWeekOf, planCalendar, weekOfDate, weekOrdinal } from './calendar.js';
import { allocate } from './weekly.js';
import { occurrences } from './track.js';

const winCache = new WeakMap();
/** فترات دروس خطة (بترتيبها في الخطة) */
export function planWindows(plan) {
  if (winCache.has(plan)) return winCache.get(plan);
  const lessons = plan.units.flatMap((u) => u.lessons.map((l) => ({ ...l, unitTitle: u.title })));
  const mx = maxWeekOf(lessons.map((l) => l.weeks));
  const cal = planCalendar(plan); // الرسمي المعروف، أو المستنتج من دروس الخطة نفسها
  const out = lessons.map((l, order) => {
    let start = '', end = '';
    if (l.start) { start = l.start; end = l.end && l.end >= l.start ? l.end : l.start; } else {
      const t = lessonTiming({ weeks: l.weeks, year: plan.year, semester: plan.semester, maxWeek: mx, cal });
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
  // تصحيح محفوظ لصف آخر (تغيّر صف هذه الحصة في الجدول بعد التصحيح) لا يُطبَّق على الصف الجديد
  const ovFor = (dk, slot, cls) => { const o = ovMap.get(`${profile.id}|${dk}|${slot}`); return o && (!o.classKey || o.classKey === cls) ? o : undefined; };
  const raw = ovMap.get(`${profile.id}|${dateKey}|${e.key}`);
  const ov = ovFor(dateKey, e.key, ck);
  const stale = !!(raw && !ov);
  const plans = plansOfGrade(ws, g);
  const windows = plans.flatMap(planWindows);
  const wk = weekInfo(plans, dateKey);
  if (ov) {
    if (!ov.lessonId) return { state: 'none', overridden: true, ...wk, reason: 'حددتَ أنه لا يوجد درس من الخطة في هذه الحصة' };
    const w = windows.find((x) => x.plan.id === ov.planId && x.lesson.id === ov.lessonId);
    if (w) return { state: 'sure', overridden: true, ...cand(w), lessonTitle: w.lesson.title, lessons: [cand(w)], part: null, sessions: w.lesson.sessions, candidates: [], ...wk };
    // الدرس المصحَّح لم يعد في الخطة (استُبدلت): نعود للحساب التلقائي
  }
  if (!plans.length) return { state: 'no-plan', reason: 'لا توجد خطة لهذا الصف' };
  const covering = windows.filter((w) => w.start && w.start <= dateKey && dateKey <= w.end);
  if (!covering.length) {
    const any = windows.some((w) => w.start);
    return { state: 'none', ...wk, staleOverride: stale, reason: any ? 'لا يوجد درس مخطط لهذا التاريخ في خطة الصف' : 'دروس خطة هذا الصف بلا أسابيع أو تواريخ، فلا يمكن ربطها تلقائيًا' };
  }
  const planIds = new Set(covering.map((w) => w.plan.id));
  if (planIds.size > 1) return { state: 'review', ...wk, reason: 'لديك أكثر من خطة لهذا الصف تغطي هذا التاريخ؛ احذف المكررة أو استبدلها', candidates: covering.map(cand) };

  // مجموعة الدروس المتداخلة (تتوسع حتى لا يبقى درس يتداخل مع المدى)
  const pw = windows.filter((w) => w.plan.id === covering[0].plan.id && w.start);
  const comp = covering.slice();
  let from = comp.reduce((m, w) => (w.start < m ? w.start : m), comp[0].start), to = comp.reduce((m, w) => (w.end > m ? w.end : m), comp[0].end);
  for (let grown = true; grown;) {
    grown = false;
    for (const w of pw) if (!comp.includes(w) && w.start <= to && w.end >= from) { comp.push(w); from = w.start < from ? w.start : from; to = w.end > to ? w.end : to; grown = true; }
  }
  comp.sort((a, b) => a.order - b.order);

  const ok = `${profile.id}|${ck}|${from}|${to}`;
  if (!memo.has(ok)) memo.set(ok, occurrences(profile, ck, from, to));
  const occ = memo.get(ok);
  const ak = `alloc|${ok}|${comp.map((w) => `${w.plan.id}:${w.lesson.id}`).join(',')}`;
  if (!memo.has(ak)) memo.set(ak, allocate(comp, occ, (o) => ovFor(o.dateKey, o.slotKey, ck)));
  const al = memo.get(ak);
  const r = al.bySlot.get(`${dateKey}|${e.key}`);
  if (!r) return { state: 'review', ...wk, reason: 'تعذر تحديد ترتيب هذه الحصة بين حصص الشعبة', candidates: covering.map(cand) };
  if (r.state === 'review') {
    const cs = r.cand.map((i) => comp[i]);
    const extra = r.reason.startsWith('حصص الشعبة في هذه الفترة أكثر') ? nextOf(pw, comp[comp.length - 1]) : [];
    return { state: 'review', ...wk, staleOverride: stale, reason: r.reason, candidates: [...cs.map(cand), ...extra] };
  }
  const ls = r.items.map((i) => comp[i]);
  const w = ls[0];
  const stat = al.lessons[r.items[0]];
  const inWindow = occ.filter((o) => covers(w, o.dateKey)).length;
  return {
    state: 'sure', ...cand(w), ...wk, staleOverride: stale,
    lessonTitle: ls.map((x) => x.lesson.title).join(' + '), lessons: ls.map(cand),
    part: r.kind === 'combined' || (!w.lesson.sessions && inWindow <= 1) ? null : r.part, sessions: r.kind === 'combined' ? null : w.lesson.sessions || null,
    extra: r.kind === 'extra', combined: r.kind === 'combined', compressed: !!r.compressed,
    short: r.kind === 'lesson' && !!stat.short, inWindow,
    note: r.kind === 'extra' ? `استكمال وتثبيت: حصص الدرس في الخطة (${w.lesson.sessions || '—'}) اكتملت ولم يبدأ الدرس التالي بعد`
      : r.kind === 'combined' ? 'دروس هذه الفترة أكثر من حصص الشعبة فيها، فجُمعت في هذه الحصة بترتيب الخطة'
        : r.compressed ? `حصص الشعبة في هذه الفترة أقل مما تخصصه الخطة؛ وُزّعت الدروس بترتيبها (أخذ هذا الدرس ${stat.given} من ${w.lesson.sessions})`
          : stat.short ? `الخطة تخصص ${w.lesson.sessions} حصص لهذا الدرس، وفي جدولك ${stat.given} فقط في فترته` : '',
  };
}
const covers = (w, d) => !!w.start && w.start <= d && d <= w.end;
/** رقم الأسبوع الدراسي للتاريخ وفق تقويم خطط الصف (يُعرض في التنبيه) */
function weekInfo(plans, dateKey) {
  for (const p of plans) { const n = weekOfDate(planCalendar(p), dateKey); if (n) return { week: n, weekText: `الأسبوع ${weekOrdinal(n)}`, semester: p.semester || '' }; }
  return { week: 0, weekText: '', semester: '' };
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
