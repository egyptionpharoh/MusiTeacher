// =====================================================================
//  الأنماط الإيقاعية — بيانات فقط. لإضافة إيقاع لاحقًا (ضروب، فنون شعبية…): أضف عنصرًا هنا ولا شيء غيره.
//  steps: خانة لكل جزء من النبضة. D = دُم، T = تك، - = سكوت. الحرف الكبير المتبوع بـ ! = ضربة قوية (نبر)، وبدونها خفيفة.
//  meter: [عدد النبضات، قيمة النبضة] · div: عدد الخانات في النبضة · level: مستوى الصعوبة (1 أسهل)
//  هذه النسخة التأسيسية فيها أنماط تدريب بسيطة فقط؛ لا إيقاعات مقررات بعد.
// =====================================================================
export const RHYTHMS = [
  { id: 'duo', name: 'تبادل الدُم والتك', meter: [2, 4], div: 1, bpm: 80, level: 1, steps: 'D! T',
    about: 'ميزان ثنائي: النبضة الأولى قوية (دُم) والثانية خفيفة (تك).' },
  { id: 'trio', name: 'نبر ثلاثي', meter: [3, 4], div: 1, bpm: 96, level: 1, steps: 'D! T T',
    about: 'ميزان ثلاثي: نبضة قوية تليها نبضتان خفيفتان.' },
  { id: 'simple', name: 'النمط البسيط', meter: [4, 4], div: 2, bpm: 84, level: 2, steps: 'D! T T D T! - D T',
    about: 'ميزان رباعي بثماني خانات: النبر الأقوى على النبضة الأولى، ونبر أخفّ منه على الثالثة.' },
];
export function parseRhythm(r) {
  const steps = r.steps.trim().split(/\s+/).map((tok, i) => {
    if (tok === '-') return null;
    return { i, stroke: tok[0] === 'D' ? 'dum' : 'tak', level: tok.endsWith('!') ? 's' : 'w' };
  });
  return { ...r, cells: steps, beats: r.meter[0], total: steps.length };
}
export const rhythmById = (id) => parseRhythm(RHYTHMS.find((r) => r.id === id) || RHYTHMS[0]);
