// 🔁 تحديث/استبدال خطة قائمة بنسخة جديدة دون فقد التوزيع وسجل التنفيذ:
// نطابق الدروس الجديدة بالقديمة (نفس الاسم داخل نفس الوحدة، ثم نفس الاسم في أي وحدة) فتحتفظ بمعرّفاتها،
// فيبقى كل توزيع وسجل مرتبطًا بدرسه. الدروس القديمة غير الموجودة في النسخة الجديدة لا تُحذف من السجل؛
// تظهر للمعلم في تقرير المقارنة قبل الاعتماد، وتبقى سجلاتها محفوظة ويمكن ربطها بدرس آخر لاحقًا.
import { uid } from './model.js';

const key = (s) => String(s || '').replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/[^\p{L}\p{N}]+/gu, '').toLowerCase();

export function matchUnits(oldUnits, newUnits) {
  const olds = oldUnits.flatMap((u) => u.lessons.map((l) => ({ u, l })));
  const used = new Set();
  const take = (pred) => { const f = olds.find((o) => !used.has(o.l.id) && pred(o)); if (f) used.add(f.l.id); return f; };
  const kept = [], added = [];
  const units = newUnits.map((nu) => {
    const ou = oldUnits.find((u) => key(u.title) && key(u.title) === key(nu.title));
    return {
      id: ou ? ou.id : nu.id || uid('u'), title: nu.title,
      lessons: nu.lessons.map((nl) => {
        const k = key(nl.title);
        const m = (k && (take((o) => key(o.l.title) === k && key(o.u.title) === key(nu.title)) || take((o) => key(o.l.title) === k))) || null;
        if (m) { kept.push({ id: m.l.id, title: nl.title, changes: diffLesson(m.l, nl) }); return { ...nl, id: m.l.id }; }
        const fresh = { ...nl, id: uid('l') };
        added.push({ id: fresh.id, title: nl.title });
        return fresh;
      }),
    };
  });
  const removed = olds.filter((o) => !used.has(o.l.id)).map((o) => ({ id: o.l.id, title: o.l.title, unit: o.u.title }));
  return { units, report: { kept, added, removed } };
}

function diffLesson(a, b) {
  const out = [];
  if ((a.sessions || null) !== (b.sessions || null)) out.push(`عدد الحصص ${a.sessions ?? '—'} ← ${b.sessions ?? '—'}`);
  if (a.start !== b.start || a.end !== b.end) out.push('الفترة الزمنية');
  if ((a.outcomes || '') !== (b.outcomes || '')) out.push('المخرجات');
  return out;
}

/** يطبّق الاستبدال: النسخة الحالية تُحفظ في السجل (versions) ثم تُستبدل */
export function replacePlanUnits(plan, newUnits, reason = 'استبدال بملف جديد', now = Date.now()) {
  const { units, report } = matchUnits(plan.units, newUnits);
  const versions = [...plan.versions, { id: uid('v'), at: now, reason, units: plan.units }].slice(-10);
  return { plan: { ...plan, units, versions, updatedAt: now }, report };
}

/** استرجاع نسخة سابقة (والنسخة الحالية تُحفظ أولًا) */
export function restoreVersion(plan, versionId, now = Date.now()) {
  const v = plan.versions.find((x) => x.id === versionId);
  if (!v) return plan;
  const { plan: p } = replacePlanUnits(plan, v.units, 'قبل استرجاع نسخة سابقة', now);
  return p;
}
