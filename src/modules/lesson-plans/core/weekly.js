// 🗓️ Weekly Lesson Scheduler — توزيع دروس الخطة على حصص الصف/الشعبة الفعلية (دالة نقية بلا React).
//
// المدخلات: مجموعة دروس متداخلة الفترات من خطة صفٍّ واحد (بترتيبها في الخطة) + حصص الشعبة الفعلية في تلك الفترة
// (بعد الإجازات والإلغاء والحصص الاستثنائية من «منبّه الحصص») + تصحيحات المعلم لكل حصة.
// المخرج: لكل حصة → درسها (أو دروسها) ورقم الحصة من الدرس، أو «يحتاج مراجعة» مع الأسباب. لا يُخترع درس، ولا يُتجاوز درس بصمت.
//
// القواعد (بالترتيب):
//  1) تصحيح المعلم لحصة يُحترم كما هو، ويُحتسب من حصص الدرس الذي اختاره.
//  2) عدد حصص كل درس معروف:
//     • حصص الشعبة تكفي أو تزيد ⇒ توزيع متسلسل بعدد حصص كل درس؛ ما يزيد بعد اكتمال الدروس = «استكمال» لآخر درس جارٍ في فترته.
//     • حصص الشعبة أقل من مجموع حصص الدروس ⇒ «ضغط» يحافظ على الترتيب: كل درس يأخذ حصة على الأقل والباقي بنسبة حصصه؛
//       وإن كانت الحصص أقل من عدد الدروس ⇒ تُجمع الدروس المتتالية في الحصة نفسها (لا يُسقط درس).
//  3) عدد الحصص غير مذكور لبعض الدروس:
//     • حصة لا يغطيها إلا درس واحد ⇒ ذلك الدرس يقينًا.
//     • حصص يغطيها أكثر من درس: إن كان عددها ≤ عدد الدروس التي لم تأخذ حصة بعد ⇒ درس لكل حصة بالترتيب (أو جمعها)،
//       وإلا ⇒ «يحتاج مراجعة» (لا نعرف كيف قسّمت الخطة هذه الحصص).
//  4) لا يبدأ درس قبل بداية فترته في الخطة؛ وأي توزيع يخالف ذلك ⇒ «يحتاج مراجعة».
import { planCalendar, weekOfDate, weekOrdinal } from './calendar.js';
import { gradeNum } from './model.js';

const covers = (w, d) => !!w.start && w.start <= d && d <= w.end;
const slotId = (o) => `${o.dateKey}|${o.slotKey}`;

/**
 * @param comp  [{ plan, lesson:{ id, title, sessions }, start, end, order }] بترتيب الخطة
 * @param occ   [{ dateKey, slotKey }] بترتيب الزمن
 * @param ovOf  (o) => تصحيح المعلم لهذه الحصة أو undefined ({ planId, lessonId:''|id })
 * @returns { bySlot: Map(slotId → Result), lessons: [{ index, target, given, short, missed }] }
 *   Result = { state:'sure', items:[i...], part, kind:'lesson'|'extra'|'combined', compressed } | { state:'review', reason, cand:[i...] }
 */
export function allocate(comp, occ, ovOf = () => undefined) {
  const n = comp.length;
  const res = new Map();
  const consumed = new Array(n).fill(0);
  const free = [];
  for (const o of occ) {
    const x = ovOf(o);
    if (x) {
      if (x.lessonId) { const j = comp.findIndex((w) => w.lesson.id === x.lessonId && w.plan.id === x.planId); if (j >= 0) consumed[j]++; }
      continue;
    }
    if (comp.some((w) => covers(w, o.dateKey))) free.push(o);
  }
  const given = consumed.slice();
  const coveringIdx = (o) => comp.map((w, i) => (covers(w, o.dateKey) ? i : -1)).filter((i) => i >= 0);
  const review = (o, reason, cand = coveringIdx(o)) => res.set(slotId(o), { state: 'review', reason, cand });
  const sure = (o, items, kind = 'lesson', compressed = false) => {
    let part = null;
    if (kind !== 'combined') { given[items[0]]++; part = given[items[0]]; } else for (const i of items) given[i]++;
    res.set(slotId(o), { state: 'sure', items, part, kind, compressed });
  };
  const lastCovering = (d, below = n) => { for (let j = Math.min(below, n) - 1; j >= 0; j--) if (covers(comp[j], d)) return j; return -1; };

  /** توزيع دروس على حصص أقل منها عددًا: مجموعات متتالية بالترتيب، مع احترام فترات الدروس */
  const groupLessons = (idxs, occs) => {
    const groups = [];
    let rest = idxs.slice();
    for (let k = 0; k < occs.length; k++) {
      const d = occs[k].dateKey, nextD = occs[k + 1] ? occs[k + 1].dateKey : null;
      let take = nextD ? Math.ceil(rest.length / (occs.length - k)) : rest.length;
      if (nextD) for (let t = 0; t < rest.length; t++) if (comp[rest[t]].end < nextD) take = Math.max(take, t + 1);
      const g = rest.slice(0, take);
      if (!g.length || g.some((i) => !covers(comp[i], d))) return null;
      groups.push(g); rest = rest.slice(take);
    }
    return rest.length ? null : groups;
  };

  const known = comp.every((w) => w.lesson.sessions);
  if (!known) {
    const amb = [];
    for (const o of free) {
      const cv = coveringIdx(o);
      if (cv.length === 1) sure(o, cv);
      else amb.push(o);
    }
    if (amb.length) {
      const need = [...new Set(amb.flatMap(coveringIdx))].sort((a, b) => a - b).filter((i) => given[i] === 0);
      const groups = need.length && amb.length <= need.length ? groupLessons(need, amb) : null;
      if (groups) amb.forEach((o, k) => sure(o, groups[k], groups[k].length > 1 ? 'combined' : 'lesson'));
      else for (const o of amb) review(o, 'عدة دروس في نفس الفترة ولم يُحدَّد عدد حصص كل منها في الخطة');
    }
  } else {
    const tgt = comp.map((w, i) => Math.max(0, w.lesson.sessions - consumed[i]));
    const T = tgt.reduce((a, b) => a + b, 0);
    const F = free.length;
    let compressed = false, combined = null;
    if (T > F && F > 0) {
      compressed = true;
      const need = tgt.map((t, i) => (t > 0 ? i : -1)).filter((i) => i >= 0);
      if (F >= need.length) {
        // كل درس حصة على الأقل، والباقي بنسبة (حصصه − 1) بطريقة «أكبر باقٍ» مع أولوية ترتيب الخطة عند التساوي
        const spare = F - need.length, weights = need.map((i) => tgt[i] - 1), W = weights.reduce((a, b) => a + b, 0);
        const share = need.map((_, k) => (W ? (spare * weights[k]) / W : 0));
        const base = share.map(Math.floor);
        let left = spare - base.reduce((a, b) => a + b, 0);
        const order = need.map((_, k) => k).sort((a, b) => (share[b] - base[b]) - (share[a] - base[a]) || a - b);
        for (const k of order) { if (left <= 0) break; base[k]++; left--; }
        need.forEach((i, k) => { tgt[i] = 1 + base[k]; });
      } else combined = groupLessons(need, free);
    }
    if (combined) free.forEach((o, k) => sure(o, combined[k], combined[k].length > 1 ? 'combined' : 'lesson', true));
    else if (T > F && F > 0 && compressed && !combined && tgt.reduce((a, b) => a + b, 0) !== F) {
      for (const o of free) review(o, 'حصص الشعبة أقل من دروس الفترة ولا يمكن توزيعها بترتيب الخطة');
    } else {
      // التصحيحات اليدوية تُحتسب في موضعها الزمني: اختيار المعلم درسًا يوم الخميس لا «يستهلك» حصة الأربعاء التي قبله
      const fin = comp.map((w, k) => (compressed ? tgt[k] + consumed[k] : w.lesson.sessions));
      const got = new Array(n).fill(0);
      const freeSet = new Set(free);
      let i = 0;
      for (const o of occ) {
        const x = ovOf(o);
        if (x) { if (x.lessonId) { const j = comp.findIndex((w) => w.lesson.id === x.lessonId && w.plan.id === x.planId); if (j >= 0) got[j]++; } continue; }
        if (!freeSet.has(o)) continue;
        const d = o.dateKey;
        while (i < n && (got[i] >= fin[i] || comp[i].end < d)) i++;
        if (i >= n) {
          const j = lastCovering(d);
          if (j >= 0) sure(o, [j], 'extra');
          else review(o, 'حصص الشعبة في هذه الفترة أكثر من مجموع حصص دروسها في الخطة');
          continue;
        }
        if (d < comp[i].start) {
          const j = lastCovering(d, i);
          if (j >= 0) sure(o, [j], 'extra');
          else review(o, 'ترتيب الحصص لا يطابق فترات الدروس في الخطة', [...new Set([...coveringIdx(o), i])]);
          continue;
        }
        got[i]++;
        sure(o, [i], 'lesson', compressed);
      }
    }
  }
  // ترقيم «الحصة كذا من الدرس» بالترتيب الزمني الفعلي، شاملًا الحصص التي اختار لها المعلم هذا الدرس يدويًا
  const seen = new Array(n).fill(0);
  for (const o of occ) {
    const x = ovOf(o);
    if (x) { if (x.lessonId) { const j = comp.findIndex((w) => w.lesson.id === x.lessonId && w.plan.id === x.planId); if (j >= 0) seen[j]++; } continue; }
    const r = res.get(slotId(o));
    if (!r || r.state !== 'sure') continue;
    if (r.kind === 'combined') { for (const i of r.items) seen[i]++; continue; }
    seen[r.items[0]]++;
    r.part = seen[r.items[0]];
  }
  const lessons = comp.map((w, i) => ({ index: i, target: w.lesson.sessions || null, given: given[i], short: !!(w.lesson.sessions && given[i] < w.lesson.sessions), missed: given[i] === 0 }));
  return { bySlot: res, lessons };
}

/** الأسبوع الدراسي لتاريخ من تقويم خطط المعلم (خطط الصف أولًا إن حُدد) — null إن لم يُعرف (لا نخمّن) */
export function schoolWeekOf(ws, dateKey, grade = 0) {
  if (!ws || !Array.isArray(ws.plans)) return null;
  const g = grade ? gradeNum(grade) || +grade || 0 : 0;
  const plans = g ? [...ws.plans.filter((p) => gradeNum(p.grade) === g), ...ws.plans.filter((p) => gradeNum(p.grade) !== g)] : ws.plans;
  for (const p of plans) {
    const n = weekOfDate(planCalendar(p), dateKey);
    if (n) return { week: n, text: `الأسبوع ${weekOrdinal(n)}`, ordinal: weekOrdinal(n), semester: p.semester || '', year: p.year || '' };
  }
  return null;
}
