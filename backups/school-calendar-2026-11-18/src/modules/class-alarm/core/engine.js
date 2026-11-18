// 🧠 محرك قرار التنبيه — دالة نقية: «ما الذي يجب أن يرن الآن؟»
// لا يعتمد على المؤقتات: في كل نبضة يقارن ساعة الحائط بالمواعيد، لذلك لا يضيع تنبيه إن تأخرت النبضة
// (تبويب في الخلفية، جهاز كان نائمًا لثوانٍ...) ما دام التأخير داخل «فترة السماح».
// • لا يتكرر تنبيه: كل تنبيه له معرّف ثابت يُسجَّل في سجل الإطلاق (fired).
// • لا تنبيه متأخر: إن تجاوز التأخير فترة السماح، أو بدأت الحصة فعلًا (لتنبيهات «قبل»)، يُسجَّل «فائتًا» بصمت.

export function decide(now, alerts, fired, graceMs = 90000) {
  const fire = [], miss = [];
  for (const a of alerts) {
    if (!a || fired[a.id]) continue;
    if (a.due > now) continue;
    const late = now - a.due;
    const tooLate = late > graceMs
      || (a.type === 'before' && Number.isFinite(a.startMs) && now >= a.startMs)
      || (a.type === 'start' && Number.isFinite(a.endMs) && now >= a.endMs)
      || (a.type === 'end' && Number.isFinite(a.endMs) && now >= a.endMs + 30000);
    (tooLate ? miss : fire).push(a);
  }
  fire.sort((x, y) => x.due - y.due);
  return { fire, miss };
}

/** أقرب موعد قادم لم يُطلق بعد (لجدولة النبضة التالية بدقة) */
export function nextDue(alerts, fired, now) {
  let best = Infinity;
  for (const a of alerts) if (!fired[a.id] && a.due > now && a.due < best) best = a.due;
  return best === Infinity ? null : best;
}

/** يسجل نتيجة القرار ويحذف ما مضى عليه أكثر من 3 أيام */
export function record(fired, decision, now) {
  const out = {};
  for (const [k, v] of Object.entries(fired || {})) if (v && now - (v.at || 0) < 3 * 86400000) out[k] = v;
  for (const a of decision.fire) out[a.id] = { at: now, s: 'fired' };
  for (const a of decision.miss) out[a.id] = { at: now, s: 'missed', due: a.due };
  return out;
}
