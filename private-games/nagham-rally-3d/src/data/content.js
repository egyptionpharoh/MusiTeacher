// =====================================================================
//  مكتبة التحديات الموسيقية — «مصنع» يولّد تحديًا جديدًا في كل مرة من بيانات موثّقة داخل MusiTeacher:
//   • العلامات والأشكال الإيقاعية وأسماؤها (إيمي باري): src/data/figures.js — من «عالم الإيقاع ثلاثي الأبعاد» و«الإملاء الإيقاعي».
//   • الضروب العربية والتمارين: src/data/durub.js — من «عالم الآلات الإيقاعية الشرقية» بمصادرها.
//   • المقامات: كما تُدرَّس في لعبة «مقامات العود» (العجم والنهاوند والراست على دو، والكرد والبياتي والحجاز على ري).
//   • الآلات وتصنيفها: من «آلات الباند» (دليل معلم الصف الأول) و«عالم الآلات الإيقاعية الشرقية» وتصنيف الاستوديو.
//  لإضافة مجال جديد: أضف عنصرًا إلى DOMAINS فيه { id, name, icon, desc, levels, gen(level, R) } — لا شيء آخر.
//
//  شكل التحدي:
//   { domain, level, prompt, cue (ما يظهر في لوحة السؤال أو null), audio (المقطع الصوتي أو null),
//     options:[{ sign, label }], answer, explain }
//   sign/cue: { t:'text', text, sub } | { t:'svg', svg, w, h, sub } | { t:'icon', icon, text, sub } | { t:'meter', n, d }
// =====================================================================
import { FIG, TPB, valueText } from './figures.js';
import { DURUB, buildPiece } from './durub.js';
import { staffSVG, barsSVG, SOLFEGE, midiOf, noteName } from '../notation/staff.js';
import { figureSVG } from '../notation/svg.js';

// ---------------------------------------------------------------- أدوات عشوائية قابلة للتكرار
export function rng(seed) { let a = seed >>> 0 || 7; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const pick = (R, a) => a[Math.floor(R() * a.length)];
const shuffle = (R, a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const sample = (R, a, n) => shuffle(R, a).slice(0, n);
/** يبني الخيارات: الصحيح + مشتتات، بترتيب عشوائي */
function choose(R, correct, distractors, n) {
  const seen = new Set([correct.key]), uniq = [];
  for (const d of distractors) if (!seen.has(d.key)) { seen.add(d.key); uniq.push(d); }
  const opts = shuffle(R, [correct, ...sample(R, uniq, n - 1)]);
  return { options: opts, answer: opts.findIndex((o) => o.key === correct.key) };
}
const AR_NUM = (n) => String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]);
export const rhythmSign = (ids, sub) => { const f = figureSVG(ids, { k: 16, color: '#111', line: true }); return { t: 'svg', svg: f.svg, w: f.width, h: f.height, sub }; };
export const staffSign = (notes, o = {}) => { const f = staffSVG(notes, { S: o.S || 15, color: '#111', ...o }); return { t: 'svg', svg: f.svg, w: f.width, h: f.height, sub: o.sub }; };
const barsSign = (bars, o = {}) => { const f = barsSVG(bars, { k: o.k || 12, color: '#111', ...o }); return { t: 'svg', svg: f.svg, w: f.width, h: f.height, sub: o.sub }; };

export const LEVELS = [
  { id: 1, name: 'مبتدئ', hint: 'خياران أو ثلاثة متباعدة' },
  { id: 2, name: 'متوسط', hint: 'ثلاثة خيارات' },
  { id: 3, name: 'متقدم', hint: 'خيارات متقاربة' },
  { id: 4, name: 'خبير', hint: 'أربعة خيارات متشابهة' },
];

// =====================================================================
//  ١) الأشكال الإيقاعية
// =====================================================================
const FIG_POOL = {
  1: ['q', 'h', 'w', 'ee', 'rq', 'rh'],
  2: ['q', 'h', 'w', 'ee', 'ssss', 'e', 'rq', 'rh', 'rw', 're'],
  3: ['q', 'h', 'w', 'ee', 'ssss', 'e', 'ess', 'sse', 'ses', 'qd', 'hd', 'rq', 'rh', 'rw', 're'],
  4: ['q', 'h', 'w', 'ee', 'ssss', 'e', 's', 'ess', 'sse', 'ses', 'eds', 'sed', 'trip', 'qd', 'hd', 'rq', 'rh', 'rw', 're', 'rs'],
};
// ما يمكن سماعه بوضوح: أشكال تملأ المازورة الرباعية بتكرارها (السكتات والمنقوطة تُدرَّس بصريًا)
const AUDIBLE = ['q', 'h', 'w', 'ee', 'ssss', 'ess', 'sse', 'ses', 'eds', 'sed', 'trip'];
const figLabel = (id) => FIG[id].name;
function genRhythm(level, R) {
  const pool = FIG_POOL[level], n = level === 1 ? 3 : level === 4 ? 4 : 3;
  const variants = ['listen', 'name'].concat(level >= 2 ? ['symbol'] : []);
  const v = pick(R, variants);
  if (v === 'listen') {
    const aud = AUDIBLE.filter((id) => pool.includes(id));
    const id = pick(R, aud), reps = 48 / FIG[id].ticks;
    const ids = Array(reps).fill(id);
    // المشتتات: أشكال مسموعة أخرى، ويفضَّل المتقاربة في المستويات العليا
    const near = aud.filter((x) => x !== id && (level < 3 || FIG[x].ticks === FIG[id].ticks || FIG[x].kind === 'group'));
    const c = choose(R, { key: id, sign: rhythmSign([id]), label: figLabel(id) }, (near.length >= n - 1 ? near : aud).map((x) => ({ key: x, sign: rhythmSign([x]), label: figLabel(x) })), n);
    return { prompt: 'استمع إلى المقطع الإيقاعي، ثم اختر المسار الذي يحمل الشكل الذي سمعته', cue: { t: 'text', text: '🎧 استمع', sub: 'يتكرر الشكل نفسه في مازورة رباعية' },
      audio: { kind: 'rhythm', ids, bpm: 76, countIn: 4 }, ...c,
      explain: `سمعتَ ${figLabel(id)}${FIG[id].syl ? ' (ننطقه «' + FIG[id].syl + '»)' : ''}، ومدته ${valueText(FIG[id].ticks)}.` };
  }
  if (v === 'name') {
    const id = pick(R, pool);
    const near = pool.filter((x) => x !== id && (level < 3 || FIG[x].kind === FIG[id].kind));
    const c = choose(R, { key: id, sign: { t: 'text', text: figLabel(id), sub: FIG[id].kind === 'rest' ? 'سكتة' : FIG[id].kind === 'group' ? 'شكل إيقاعي' : 'علامة إيقاعية' }, label: figLabel(id) }, (near.length >= n - 1 ? near : pool).map((x) => ({ key: x, sign: { t: 'text', text: figLabel(x), sub: FIG[x].kind === 'rest' ? 'سكتة' : FIG[x].kind === 'group' ? 'شكل إيقاعي' : 'علامة إيقاعية' }, label: figLabel(x) })), n);
    return { prompt: 'ما اسم العلامة الإيقاعية الظاهرة أمامك؟ اختر المسار الذي يحمل اسمها', cue: rhythmSign([id]), audio: FIG[id].kind !== 'rest' ? { kind: 'rhythm', ids: [id], bpm: 76, countIn: 0 } : null, ...c,
      explain: `هذه ${figLabel(id)}، ومدتها ${valueText(FIG[id].ticks)}.` };
  }
  // symbol: الاسم على اللوحة والعلامات على المسارات
  const id = pick(R, pool.filter((x) => FIG[x].kind !== 'group' || level >= 3));
  const near = pool.filter((x) => x !== id);
  const c = choose(R, { key: id, sign: rhythmSign([id]), label: figLabel(id) }, near.map((x) => ({ key: x, sign: rhythmSign([x]), label: figLabel(x) })), n);
  return { prompt: `أيّ مسار يحمل رمز «${figLabel(id)}»؟`, cue: { t: 'text', text: figLabel(id), sub: 'أين رمزها؟' }, audio: null, ...c, explain: `رمز ${figLabel(id)} هو المرسوم في المسار الصحيح.` };
}

// =====================================================================
//  ٢) الضروب: دُم وتك، وتمييز الضروب العربية بالسمع
// =====================================================================
const DT_AR = { D: 'دُم', T: 'تك' };
export const PIECES = DURUB.map(buildPiece);
function genDurub(level, R) {
  if (level === 1) {
    const k = pick(R, ['D', 'T']);
    const c = choose(R, { key: k, sign: { t: 'text', text: DT_AR[k], sub: k === 'D' ? 'صوت عميق من وسط الجلد' : 'صوت حادّ من حافة الجلد' }, label: DT_AR[k] }, [{ key: k === 'D' ? 'T' : 'D', sign: { t: 'text', text: DT_AR[k === 'D' ? 'T' : 'D'], sub: k === 'D' ? 'صوت حادّ من حافة الجلد' : 'صوت عميق من وسط الجلد' }, label: DT_AR[k === 'D' ? 'T' : 'D'] }], 2);
    return { prompt: 'استمع إلى ضربة الطبلة: هل هي دُم أم تك؟', cue: { t: 'text', text: '🥁 دُم أم تك؟', sub: 'تُعاد الضربة مرتين' }, audio: { kind: 'perc', inst: 'tabla', hits: [{ t: 0, k }, { t: 0.9, k }] }, ...c,
      explain: k === 'D' ? 'الدُّم صوت عميق (غليظ) نضربه في وسط جلد الطبلة.' : 'التك صوت حادّ قصير نضربه على حافة الجلد.' };
  }
  if (level === 2) {
    const seq = Array.from({ length: 4 }, () => pick(R, ['D', 'T'])); seq[0] = 'D';
    const key = seq.join('');
    const variants = new Set();
    while (variants.size < 4) { const v = seq.slice(); const i = 1 + Math.floor(R() * 3); v[i] = v[i] === 'D' ? 'T' : 'D'; if (R() < 0.4) { const j = 1 + Math.floor(R() * 3); v[j] = v[j] === 'D' ? 'T' : 'D'; } if (v.join('') !== key) variants.add(v.join('')); }
    const txt = (s) => [...s].map((c) => DT_AR[c]).join(' ');
    const c = choose(R, { key, sign: { t: 'text', text: txt(key), sub: 'من اليمين إلى اليسار' }, label: txt(key) }, [...variants].map((v) => ({ key: v, sign: { t: 'text', text: txt(v), sub: 'من اليمين إلى اليسار' }, label: txt(v) })), 3);
    return { prompt: 'استمع إلى أربع ضربات بالنوار، ثم اختر ترتيبها الصحيح', cue: { t: 'text', text: '🥁 رتّب الضربات', sub: 'أربع ضربات · نوار' }, audio: { kind: 'perc', inst: 'tabla', hits: seq.map((k, i) => ({ t: i * 0.7, k, acc: i === 0 })) }, ...c,
      explain: `الترتيب: ${txt(key)}.` };
  }
  // المستوى ٣ و٤: تمييز الضرب
  const pool = PIECES.filter((p) => p.id !== 'wahda_kabira');
  const d = pick(R, pool);
  const same = pool.filter((p) => p.id !== d.id && p.meter.join('/') === d.meter.join('/'));
  const other = pool.filter((p) => p.id !== d.id && !same.includes(p));
  const n = level === 3 ? 3 : 4;
  const dist = (same.length >= n - 1 || level === 4 ? same.concat(level === 4 ? other : []) : same.concat(other));
  const mk = (p) => ({ key: p.id, sign: { t: 'text', text: p.name, sub: `الميزان ${p.meter[0]}/${p.meter[1]}` }, label: p.name });
  const c = choose(R, mk(d), dist.map(mk), n);
  const cycles = d.barsN >= 2 ? 1 : 2;
  return { prompt: 'استمع إلى الضرب على الطبلة. ما اسمه؟', cue: { t: 'text', text: '🥁 أيّ ضرب هذا؟', sub: 'استمع إلى الدُّم والتك ومواضعهما' }, audio: { kind: 'durub', piece: d.id, cycles: level === 3 ? cycles + 1 : cycles + 1 }, ...c,
    explain: `هذا ضرب ${d.name} (${d.meter[0]}/${d.meter[1]}): ${d.note.split('.')[0]}.` };
}

// =====================================================================
//  ٣) الموازين
// =====================================================================
const METERS = { '2/4': [2, 4], '3/4': [3, 4], '4/4': [4, 4], '6/8': [6, 8] };
const meterSign = (m, sub) => ({ t: 'meter', n: METERS[m][0], d: METERS[m][1], sub });
const METER_EXPLAIN = { '2/4': 'الميزان الثنائي 2/4: ضربة قوية ثم ضعيفة.', '3/4': 'الميزان الثلاثي 3/4: قوية ثم ضعيفتان.', '4/4': 'الميزان الرباعي 4/4: قوية، ضعيفة، متوسطة، ضعيفة.', '6/8': 'الميزان المركب 6/8: ست كروشات في مجموعتين، النبر على الأولى والرابعة.' };
function barFill(R, beats, pool) {
  // يملأ مازورة من beats زمنًا بعلامات من pool (بالتِك)
  for (let tries = 0; tries < 200; tries++) {
    let left = beats * TPB; const out = [];
    while (left > 0) {
      const cand = pool.filter((id) => FIG[id].ticks <= left && (FIG[id].ticks % 6 === 0 || left % TPB !== 0 || FIG[id].ticks === TPB));
      if (!cand.length) break;
      const id = pick(R, cand); out.push(id); left -= FIG[id].ticks;
    }
    if (left === 0 && out.length) return out;
  }
  return Array(beats).fill('q');
}
function genMeter(level, R) {
  const keys = level === 1 ? ['2/4', '3/4'] : level === 2 ? ['2/4', '3/4', '4/4'] : ['2/4', '3/4', '4/4', '6/8'];
  const visual = level >= 3 && R() < 0.45;
  if (visual) {
    const m = pick(R, ['2/4', '3/4', '4/4']), beats = METERS[m][0];
    const pool = level === 3 ? ['q', 'h', 'ee', 'rq', 'hd'] : ['q', 'h', 'ee', 'ssss', 'rq', 'hd', 'qd', 'e'];
    const bars = [barFill(R, beats, pool), barFill(R, beats, pool)];
    const c = choose(R, { key: m, sign: meterSign(m), label: m }, ['2/4', '3/4', '4/4'].map((k) => ({ key: k, sign: meterSign(k), label: k })), 3);
    return { prompt: 'عُدّ الأزمنة في كل مازورة، ثم اختر الميزان المناسب لها', cue: barsSign(bars, { k: 11, sub: 'ما الميزان المفقود؟' }), audio: { kind: 'rhythm', ids: bars.flat(), bpm: 80, countIn: beats, beatsPerBar: beats }, ...c,
      explain: `في كل مازورة ${beats === 2 ? 'زمنان' : AR_NUM(beats) + ' أزمنة'}، فالميزان ${m}.` };
  }
  const m = pick(R, keys);
  const c = choose(R, { key: m, sign: meterSign(m), label: m }, keys.map((k) => ({ key: k, sign: meterSign(k), label: k })), level === 1 ? 2 : level === 4 ? 4 : 3);
  return { prompt: 'استمع إلى النبض: أين تقع الضربة القوية؟ عُدّ، ثم اختر الميزان', cue: { t: 'text', text: '👂 عُدّ النبضات', sub: 'الضربة القوية = أول المازورة' }, audio: { kind: 'meter', meter: METERS[m], bars: m === '6/8' ? 2 : 3, bpm: m === '6/8' ? 150 : 96 }, ...c, explain: METER_EXPLAIN[m] };
}

// =====================================================================
//  ٤) الموازير: عددها، والمازورة الصحيحة، وإكمال المازورة
// =====================================================================
function genBars(level, R) {
  const v = level === 1 ? 'count' : level === 2 ? pick(R, ['count', 'valid']) : pick(R, ['valid', 'complete']);
  const poolBy = { 1: ['q', 'h', 'w', 'rq'], 2: ['q', 'h', 'ee', 'rq', 'rh'], 3: ['q', 'h', 'ee', 'ssss', 'rq', 'hd'], 4: ['q', 'h', 'ee', 'ssss', 'ess', 'sse', 'rq', 'qd', 'e', 'hd'] };
  const pool = poolBy[level];
  if (v === 'count') {
    const m = pick(R, level === 1 ? ['4/4', '2/4'] : ['2/4', '3/4', '4/4']), beats = METERS[m][0];
    const N = 2 + Math.floor(R() * (level === 1 ? 2 : 3));
    const bars = Array.from({ length: N }, () => barFill(R, beats, pool.filter((id) => FIG[id].ticks <= beats * TPB)));
    const mk = (k) => ({ key: k, sign: { t: 'text', text: `${AR_NUM(k)} ${k <= 2 ? (k === 1 ? 'مازورة' : 'مازورتان') : 'موازير'}`, sub: 'عدد الموازير' }, label: String(k) });
    const c = choose(R, mk(N), [N - 1, N + 1, N + 2, Math.max(1, N - 2)].filter((k) => k !== N && k > 0).map(mk), 3);
    return { prompt: 'كم مازورة في السطر الموسيقي الظاهر أمامك؟', cue: barsSign(bars, { meter: METERS[m], k: 10 }), audio: null, ...c, explain: `الخطوط العمودية (خطوط الموازير) تقسم السطر إلى ${N === 2 ? 'مازورتين' : AR_NUM(N) + ' موازير'}.` };
  }
  const m = pick(R, level <= 2 ? ['2/4', '3/4', '4/4'] : ['2/4', '3/4', '4/4']), beats = METERS[m][0];
  if (v === 'valid') {
    const good = barFill(R, beats, pool);
    const bad = [];
    for (let k = 0; k < 6 && bad.length < 3; k++) {
      const delta = pick(R, [-1, 1, 2, -0.5, 0.5].filter((d) => level >= 3 || Number.isInteger(d)));
      const b = Math.max(0.5, beats + delta);
      if (b === beats) continue;
      const tks = b * TPB;
      const bb = tks % TPB ? barFill(R, Math.floor(b), pool).concat(['e']) : barFill(R, b, pool);
      bad.push(bb);
    }
    const mk = (bars, i) => ({ key: 'b' + i, sign: barsSign([bars], { meter: METERS[m], k: 10, final: false }), label: '' });
    const correct = mk(good, 0);
    const c = choose(R, correct, bad.map((b, i) => mk(b, i + 1)), level === 4 ? 4 : 3);
    return { prompt: `أيّ مازورة كاملة في الميزان ${m}؟ اجمع أزمنة كل لافتة`, cue: meterSign(m, `${beats === 2 ? 'زمنان' : AR_NUM(beats) + ' أزمنة'} في المازورة`), audio: null, ...c, explain: `المازورة الصحيحة مجموع أزمنتها ${beats === 2 ? 'زمنان' : AR_NUM(beats) + ' أزمنة'} تمامًا كما يطلب الميزان ${m}.` };
  }
  // complete
  const missing = pick(R, (level === 3 ? [1, 2] : [1, 2, 0.5, 1.5]).filter((x) => x < beats));
  const head = barFill(R, beats - Math.ceil(missing), pool).concat(missing % 1 ? ['e'] : []);
  const fill = { 0.5: ['e', 're'], 1: ['q', 'rq', 'ee'], 1.5: ['qd'], 2: ['h', 'rh'] }[missing];
  const ans = pick(R, fill.filter((id) => pool.includes(id) || level >= 3));
  const others = ['q', 'h', 'e', 'qd', 'hd', 'w', 'ee', 'rq', 'rh'].filter((id) => FIG[id].ticks !== missing * TPB);
  const c = choose(R, { key: ans, sign: rhythmSign([ans]), label: FIG[ans].name }, others.map((id) => ({ key: id, sign: rhythmSign([id]), label: FIG[id].name })), level === 4 ? 4 : 3);
  return { prompt: 'أكمل المازورة: أيّ علامة تملأ المكان الفارغ تمامًا؟', cue: barsSign([head], { meter: METERS[m], k: 10, missing: Math.max(1, Math.ceil(missing)) }), audio: null, ...c,
    explain: `ينقص المازورة ${missing === 0.5 ? 'نصف زمن' : missing === 1.5 ? 'زمن ونصف' : missing === 1 ? 'زمن واحد' : 'زمنان'}، و${FIG[ans].name} تملؤه.` };
}

// =====================================================================
//  ٥) المقامات (سلالم صاعدة كما تُدرَّس على العود)
// =====================================================================
const N = (step, oct, acc = 0) => ({ step, oct, acc });
export const MAQAMAT = {
  ajam: { name: 'العجم', on: 'دو', notes: [N('C', 4), N('D', 4), N('E', 4), N('F', 4), N('G', 4), N('A', 4), N('B', 4), N('C', 5)], tip: 'مثل السلم الكبير: بلا علامات تحويل على دو.' },
  nahawand: { name: 'النهاوند', on: 'دو', notes: [N('C', 4), N('D', 4), N('E', 4, -1), N('F', 4), N('G', 4), N('A', 4, -1), N('B', 4, -1), N('C', 5)], tip: 'مي بيمول تميّزه عن العجم (جنس نهاوند على دو).' },
  rast: { name: 'الراست', on: 'دو', notes: [N('C', 4), N('D', 4), N('E', 4, -0.5), N('F', 4), N('G', 4), N('A', 4), N('B', 4, -0.5), N('C', 5)], tip: 'مي وسي نصف بيمول (ربع تون) هما بصمة الراست.' },
  kurd: { name: 'الكرد', on: 'ري', notes: [N('D', 4), N('E', 4, -1), N('F', 4), N('G', 4), N('A', 4), N('B', 4, -1), N('C', 5), N('D', 5)], tip: 'نصف تون مباشرة بعد القرار (ري – مي بيمول).' },
  bayati: { name: 'البياتي', on: 'ري', notes: [N('D', 4), N('E', 4, -0.5), N('F', 4), N('G', 4), N('A', 4), N('B', 4, -1), N('C', 5), N('D', 5)], tip: 'مي نصف بيمول بعد القرار ري.' },
  hijaz: { name: 'الحجاز', on: 'ري', notes: [N('D', 4), N('E', 4, -1), N('F', 4, 1), N('G', 4), N('A', 4), N('B', 4, -1), N('C', 5), N('D', 5)], tip: 'المسافة الواسعة بين مي بيمول وفا دييز تمنحه طابعه.' },
};
function genMaqam(level, R) {
  const pool = level === 1 ? ['ajam', 'nahawand'] : level === 2 ? ['ajam', 'nahawand', 'rast', 'hijaz'] : Object.keys(MAQAMAT);
  const id = pick(R, pool), M = MAQAMAT[id];
  const n = level === 1 ? 2 : level === 4 ? 4 : 3;
  const mk = (k) => ({ key: k, sign: { t: 'text', text: MAQAMAT[k].name, sub: `على ${MAQAMAT[k].on}` }, label: MAQAMAT[k].name });
  const c = choose(R, mk(id), pool.map(mk), n);
  const visual = level === 3;
  const audio = { kind: 'scale', set: 'violin', notes: M.notes.map((x) => ({ midi: midiOf(x.step, x.oct, Math.trunc(x.acc)), cents: x.acc === -0.5 ? -50 : 0 })), step: 0.42 };
  return { prompt: visual ? 'اقرأ السلم الظاهر أمامك (انتبه لعلامات التحويل)، ثم اختر المسار الذي يحمل اسم المقام' : 'استمع إلى السلم على الكمان، ثم اختر المسار الذي يحمل اسم المقام',
    cue: visual ? staffSign(M.notes, { S: 11, stems: false, gap: 25 }) : { t: 'text', text: '🎻 أيّ مقام؟', sub: 'سلم صاعد من القرار' },
    audio, ...c, explain: `مقام ${M.name} على ${M.on}: ${M.notes.map(noteName).join(' – ')}. ${M.tip}` };
}

// =====================================================================
//  ٦) الآلات الموسيقية
// =====================================================================
export const INSTRUMENTS = {
  piano: { name: 'البيانو', icon: '🎹', fam: 'keys', play: { kind: 'melody', set: 'piano' } },
  accordion: { name: 'الأكورديون', icon: '🪗', fam: 'keys', play: { kind: 'melody', set: 'accordion' } },
  violin: { name: 'الكمان', icon: '🎻', fam: 'strings', play: { kind: 'melody', set: 'violin' } },
  xylophone: { name: 'الإكسيليفون', icon: '🎼', fam: 'pitched', play: { kind: 'melody', set: 'xylophone' } },
  glock: { name: 'الإكسيليفون المعدني', icon: '✨', fam: 'pitched', play: { kind: 'hits', file: 'band/glock_medium_C5', alt: 'band/glock_medium_G5' } },
  triangle: { name: 'المثلث', icon: '🔺', fam: 'unpitched', play: { kind: 'hits', file: 'band/triangle_open1' } },
  snare: { name: 'الطبل الصغير', icon: '🥁', fam: 'unpitched', play: { kind: 'hits', file: 'band/snare_s1', alt: 'band/snare_s2' } },
  bass: { name: 'الطبل الكبير', icon: '🛢️', fam: 'unpitched', play: { kind: 'hits', file: 'band/bass_s1', alt: 'band/bass_s2' } },
  tamb: { name: 'الدف ذو الجلاجل', icon: '🪘', fam: 'unpitched', play: { kind: 'hits', file: 'band/tamb_hit1', alt: 'band/tamb_shake1' } },
  cymbals: { name: 'الصنوج', icon: '🥏', fam: 'unpitched', play: { kind: 'hits', file: 'band/cymbals_short1', slow: true } },
  maracas: { name: 'الماراكاس', icon: '🪇', fam: 'unpitched', play: { kind: 'hits', file: 'band/maracas_hit1' } },
  castanets: { name: 'الكاستنيت', icon: '🌰', fam: 'unpitched', play: { kind: 'hits', file: 'band/cast_hit1' } },
  claves: { name: 'الكلافس', icon: '🥢', fam: 'unpitched', play: { kind: 'hits', file: 'band/claves_hit1' } },
  wood: { name: 'القالب الخشبي', icon: '🪵', fam: 'unpitched', play: { kind: 'hits', file: 'band/wood_s1' } },
  jingles: { name: 'الجلاجل', icon: '🔔', fam: 'unpitched', play: { kind: 'hits', file: 'band/jingles_shake1', slow: true } },
  tabla: { name: 'الطبلة', icon: '🪘', fam: 'unpitched', play: { kind: 'perc', inst: 'tabla' } },
  riq: { name: 'الرق', icon: '🪘', fam: 'unpitched', play: { kind: 'perc', inst: 'riq' } },
};
const FAMILIES = { strings: 'الآلات الوترية', keys: 'آلات المفاتيح', pitched: 'الإيقاعية النغمية', unpitched: 'الإيقاعية غير النغمية' };
const INST_POOL = {
  1: ['piano', 'violin', 'snare', 'triangle', 'accordion', 'bass'],
  2: ['piano', 'violin', 'accordion', 'xylophone', 'triangle', 'snare', 'bass', 'tamb', 'maracas', 'tabla'],
  3: Object.keys(INSTRUMENTS),
};
const SIMILAR = [['snare', 'bass', 'tabla'], ['triangle', 'glock', 'jingles'], ['tamb', 'riq', 'jingles'], ['claves', 'wood', 'castanets'], ['piano', 'accordion', 'xylophone'], ['violin', 'accordion'], ['maracas', 'tamb'], ['cymbals', 'triangle']];
function genInstrument(level, R) {
  const instSign = (k) => ({ t: 'icon', icon: INSTRUMENTS[k].icon, text: INSTRUMENTS[k].name, sub: '' });
  if (level === 4 && R() < 0.5) {
    const k = pick(R, Object.keys(INSTRUMENTS)), f = INSTRUMENTS[k].fam;
    const mk = (fk) => ({ key: fk, sign: { t: 'text', text: FAMILIES[fk], sub: 'الفصيلة' }, label: FAMILIES[fk] });
    const c = choose(R, mk(f), Object.keys(FAMILIES).map(mk), 4);
    return { prompt: 'إلى أيّ فصيلة تنتمي الآلة التي تسمعها؟', cue: { t: 'text', text: '🎧 فصيلة الآلة', sub: 'وترية؟ مفاتيح؟ إيقاعية؟' }, audio: { kind: 'inst', inst: k }, ...c, explain: `هذا صوت ${INSTRUMENTS[k].name}، وهي من ${FAMILIES[f]}.` };
  }
  const pool = INST_POOL[Math.min(level, 3)];
  const k = pick(R, pool);
  let dist = pool.filter((x) => x !== k && INSTRUMENTS[x].icon !== INSTRUMENTS[k].icon);
  if (level >= 3) { const grp = SIMILAR.find((g) => g.includes(k)); if (grp) dist = grp.filter((x) => x !== k).concat(sample(R, dist, 2)); }
  const n = level === 1 ? 3 : level === 4 ? 4 : 3;
  const c = choose(R, { key: k, sign: instSign(k), label: INSTRUMENTS[k].name }, dist.map((x) => ({ key: x, sign: instSign(x), label: INSTRUMENTS[x].name })), n);
  return { prompt: 'استمع إلى المقطع الصوتي: أيّ آلة تعزف؟ اختر المسار الذي يحمل صورتها', cue: { t: 'text', text: '🎧 من يعزف؟', sub: 'استمع جيدًا إلى لون الصوت' }, audio: { kind: 'inst', inst: k }, ...c, explain: `هذا صوت ${INSTRUMENTS[k].name} (${FAMILIES[INSTRUMENTS[k].fam]}).` };
}

// =====================================================================
//  ٧) النغمات على المدرج (مفتاح صول)
// =====================================================================
const STAFF_POOL = {
  1: [N('C', 4), N('D', 4), N('E', 4), N('F', 4), N('G', 4)],
  2: [N('C', 4), N('D', 4), N('E', 4), N('F', 4), N('G', 4), N('A', 4), N('B', 4), N('C', 5)],
  3: [N('C', 4), N('D', 4), N('E', 4), N('F', 4), N('G', 4), N('A', 4), N('B', 4), N('C', 5), N('D', 5), N('E', 5), N('F', 5), N('G', 5), N('A', 5)],
  4: [N('C', 4), N('D', 4), N('E', 4), N('F', 4), N('F', 4, 1), N('G', 4), N('A', 4), N('B', 4, -1), N('B', 4), N('C', 5), N('C', 5, 1), N('D', 5), N('E', 5, -1), N('E', 5), N('F', 5), N('G', 5), N('A', 5)],
};
const nKey = (x) => x.step + x.oct + (x.acc || 0);
function staffPos(x) { const pos = (x.oct * 7 + 'CDEFGAB'.indexOf(x.step) - 30); if (pos === -2) return 'على الخط الإضافي الأول أسفل المدرج'; if (pos === -1) return 'تحت الخط الأول'; if (pos >= 0 && pos <= 8) return pos % 2 === 0 ? `على الخط ${['الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس'][pos / 2]}` : `في المسافة ${['الأولى', 'الثانية', 'الثالثة', 'الرابعة'][(pos - 1) / 2]}`; if (pos === 9) return 'فوق الخط الخامس'; return 'على خط إضافي أعلى المدرج'; }
function genStaff(level, R) {
  const pool = STAFF_POOL[level], x = pick(R, pool);
  const n = level === 1 ? 3 : level === 4 ? 4 : 3;
  const near = pool.filter((y) => nKey(y) !== nKey(x) && (level < 3 || Math.abs((y.oct * 7 + 'CDEFGAB'.indexOf(y.step)) - (x.oct * 7 + 'CDEFGAB'.indexOf(x.step))) <= 2));
  const dist = near.length >= n - 1 ? near : pool.filter((y) => nKey(y) !== nKey(x));
  const audio = { kind: 'notes', set: 'piano', notes: [{ midi: midiOf(x.step, x.oct, x.acc || 0), t: 0, d: 1.4 }] };
  if (R() < 0.55) {
    const mk = (y) => ({ key: nKey(y), sign: { t: 'text', text: noteName(y), sub: '' }, label: noteName(y) });
    const c = choose(R, mk(x), dist.map(mk), n);
    return { prompt: 'ما اسم النغمة المكتوبة على المدرج الظاهر أمامك؟', cue: staffSign([{ ...x, hl: true }], { S: 13 }), audio: level <= 2 ? audio : null, ...c, explain: `${noteName(x)} تُكتب ${staffPos(x)} في مفتاح صول.` };
  }
  const mk = (y) => ({ key: nKey(y), sign: staffSign([y], { S: 14 }), label: noteName(y) });
  const c = choose(R, mk(x), dist.map(mk), n);
  return { prompt: `أين تُكتب النغمة «${noteName(x)}»؟ اختر المسار الذي يحمل موضعها الصحيح على المدرج`, cue: { t: 'text', text: noteName(x), sub: 'مفتاح صول' }, audio, ...c, explain: `${noteName(x)} تُكتب ${staffPos(x)}.` };
}

// =====================================================================
//  ٨) الحادّ والغليظ واتجاه اللحن
// =====================================================================
function genPitch(level, R) {
  if (level <= 2) {
    const base = 55 + Math.floor(R() * 14);
    const gap = level === 1 ? 12 + Math.floor(R() * 6) : 2 + Math.floor(R() * 5);
    const dir = level === 2 && R() < 0.2 ? 0 : (R() < 0.5 ? 1 : -1);
    const second = base + dir * gap;
    const opts = [{ key: 'up', sign: { t: 'text', text: '⬆ أحدّ', sub: 'الصوت الثاني أعلى' }, label: 'أحدّ' }, { key: 'down', sign: { t: 'text', text: '⬇ أغلظ', sub: 'الصوت الثاني أخفض' }, label: 'أغلظ' }];
    if (level === 2) opts.push({ key: 'same', sign: { t: 'text', text: '= مثله', sub: 'الصوتان متساويان' }, label: 'مثله' });
    const key = dir > 0 ? 'up' : dir < 0 ? 'down' : 'same';
    const c = choose(R, opts.find((o) => o.key === key), opts, opts.length);
    return { prompt: 'استمع إلى صوتين: هل الصوت الثاني أحدّ أم أغلظ من الأول؟', cue: { t: 'text', text: '🎹 الأول ← الثاني', sub: 'حادّ أم غليظ؟' }, audio: { kind: 'notes', set: 'piano', notes: [{ midi: base, t: 0, d: 1.0 }, { midi: second, t: 1.2, d: 1.2 }] }, ...c,
      explain: key === 'up' ? 'الصوت الثاني أعلى (أحدّ) من الأول.' : key === 'down' ? 'الصوت الثاني أخفض (أغلظ) من الأول.' : 'الصوتان على الطبقة نفسها.' };
  }
  const len = level === 3 ? 3 : 4;
  const notes = [60 + Math.floor(R() * 8)]; const dirs = [];
  for (let i = 1; i < len; i++) { const d = R() < 0.5 ? 1 : -1; dirs.push(d); notes.push(notes[i - 1] + d * (level === 3 ? 3 + Math.floor(R() * 3) : 2 + Math.floor(R() * 2))); }
  const txt = (ds) => ds.map((d) => (d > 0 ? '⬆' : '⬇')).join(' ');
  const key = dirs.join(',');
  const all = []; const total = 1 << (len - 1);
  for (let m = 0; m < total; m++) { const ds = []; for (let i = 0; i < len - 1; i++) ds.push(m & (1 << i) ? 1 : -1); all.push(ds); }
  const mk = (ds) => ({ key: ds.join(','), sign: { t: 'text', text: txt(ds), sub: 'اتجاه اللحن' }, label: txt(ds) });
  const c = choose(R, mk(dirs), all.map(mk), level === 3 ? 3 : 4);
  return { prompt: 'استمع إلى اللحن القصير: كيف تتحرك نغماته؟ صعودًا أم هبوطًا؟', cue: { t: 'text', text: '🎵 اتجاه اللحن', sub: `${AR_NUM(len)} نغمات` }, audio: { kind: 'notes', set: 'piano', notes: notes.map((m, i) => ({ midi: m, t: i * 0.7, d: 0.8 })) }, ...c, explain: `اتجاه اللحن: ${txt(dirs)} (من اليمين إلى اليسار).` };
}

// =====================================================================
export const DOMAINS = [
  { id: 'rhythm', name: 'الأشكال الإيقاعية', icon: '♩', desc: 'تمييز العلامات والأشكال الإيقاعية والسكتات سمعًا وبصرًا', gen: genRhythm },
  { id: 'durub', name: 'الضروب والإيقاعات', icon: '🥁', desc: 'الدُّم والتك وترتيبهما، وتمييز الضروب العربية', gen: genDurub },
  { id: 'meters', name: 'الموازين', icon: '⅔', desc: 'الثنائي والثلاثي والرباعي والمركب بالسمع والقراءة', gen: genMeter },
  { id: 'bars', name: 'الموازير', icon: '🎼', desc: 'عدّ الموازير، والمازورة الكاملة، وإكمال المازورة', gen: genBars },
  { id: 'maqamat', name: 'المقامات', icon: '🎻', desc: 'العجم والنهاوند والراست والكرد والبياتي والحجاز', gen: genMaqam },
  { id: 'instruments', name: 'الآلات الموسيقية', icon: '🎹', desc: 'تمييز الآلة من صوتها، وتصنيف فصيلتها', gen: genInstrument },
  { id: 'staff', name: 'النغمات على المدرج', icon: '🎵', desc: 'أسماء النغمات ومواضعها في مفتاح صول', gen: genStaff },
  { id: 'pitch', name: 'الحادّ والغليظ', icon: '↕', desc: 'مقارنة الأصوات واتجاه حركة اللحن', gen: genPitch },
];
export const DOMAIN = Object.fromEntries(DOMAINS.map((d) => [d.id, d]));

/** يولّد قائمة تحديات لسباق: domains[], level, count, seed. يتجنب تكرار التحدي نفسه متتاليًا */
export function makeRace({ domains, level, count, seed }) {
  const R = rng(seed || Date.now());
  const out = []; const seen = new Set();
  for (let i = 0; i < count; i++) {
    const dom = domains[i % domains.length];
    let ch = null;
    for (let t = 0; t < 8; t++) {
      ch = DOMAIN[dom].gen(level, R);
      const sig = dom + ':' + ch.options.map((o) => o.key).join('|') + ':' + ch.answer + ':' + (ch.prompt || '');
      if (!seen.has(sig)) { seen.add(sig); break; }
    }
    out.push({ ...ch, domain: dom, level, n: i + 1 });
  }
  // ترتيب المجالات بالتناوب العشوائي
  return out;
}
