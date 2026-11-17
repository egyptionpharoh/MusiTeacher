// =====================================================================
//  تمارين العود: الأوتار المطلقة، مقامات في الوضع الأول (مطابقة لبيانات «مقامات العود» في المنصة)، ولحنان قصيران
//  من تأليف MusiTeacher لهذا التمرين (ليست ألحانًا منشورة لأحد). كل حدث: نغمة + مدة (بالضربات) + اتجاه الريشة.
//  اتجاه الريشة: متناوب ↓↑ للنغمات القصيرة، ونازل ↓ للنغمة الطويلة (ضربتان فأكثر) وبعدها — كما يُدرَّس المبتدئ.
// =====================================================================
import { noteName, COURSES, FINGER_AR, intervalAr } from '../instrument/oud-data.js';
import { planPositions } from './position-engine.js';

const STEP = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
// 'E½b3' → midi (يدعم b و # و ½b)
export function m(n) {
  const r = /^([A-G])(½b|½#|b|#)?(\d)$/.exec(n); if (!r) throw new Error('bad note ' + n);
  const acc = { 'b': -1, '#': 1, '½b': -0.5, '½#': 0.5 }[r[2]] || 0;
  return 12 * (+r[3] + 1) + STEP[r[1]] + acc;
}
function seq(list, defBeats = 1, opt = {}) {
  // list: "C3 D3:2 E½b3 F3:0.5~" ← نغمة[:ضربات][~]   (~ = حلية موصولة: تُعزف باليد اليسرى وحدها دون ضربة ريشة)
  // الوتر والإصبع ووضع اليد يختارها «محرّك المواضع» للجملة كلها (لا لكل نغمة منفردة).
  const raw = [];
  for (let tok of list.trim().split(/\s+/)) {
    if (tok === '|') continue;
    const slur = tok.endsWith('~'); if (slur) tok = tok.slice(0, -1);
    const [n, b] = tok.split(':'); raw.push({ midi: m(n), beats: b ? +b : defBeats, slur });
  }
  const path = planPositions(raw, opt);
  const evs = []; let t = 0, dir = 'down';
  raw.forEach((r, i) => {
    const longN = r.beats >= 2, risha = r.slur ? null : (longN ? 'down' : dir);
    evs.push({ midi: r.midi, beats: r.beats, start: t, risha, slur: r.slur, ...path[i] });
    t += r.beats; if (!r.slur) dir = longN ? 'down' : (risha === 'down' ? 'up' : 'down');
  });
  return evs;
}
export const EXERCISES = [
  { id: 'open', title: 'الأوتار المطلقة', level: 'مبتدئ', bpm: 66,
    about: 'اضرب كل وتر مطلقًا (دون ضغط) نزولًا ثم صعودًا: كردان، نوى، دوكاه، عشيران — ثم عودة.',
    events: seq('C4 C4 G3 G3 D3 D3 A2 A2 D3 D3 G3 G3 C4:2') },
  { id: 'ajam', title: 'مقام العجم على دو (صعودًا وهبوطًا)', level: 'مبتدئ', bpm: 72,
    about: 'العجم: بُعدان كاملان ثم نصف درجة، يشبه السلم الكبير. من الراست (دو٣) إلى الكردان (دو٤) ثم العودة.',
    events: seq('C3 D3 E3 F3 G3 A3 B3 C4 B3 A3 G3 F3 E3 D3 C3:2') },
  { id: 'rast', title: 'مقام الراست على دو (بأرباع التون)', level: 'متوسط', bpm: 66,
    about: 'الراست: مي نصف بيمول (سيكاه) وسي نصف بيمول (أوج). يوضع الإصبع بين البيمول والطبيعية.',
    events: seq('C3 D3 E½b3 F3 G3 A3 B½b3 C4 B½b3 A3 G3 F3 E½b3 D3 C3:2') },
  { id: 'kurd', title: 'مقام الكرد على ري', level: 'متوسط', bpm: 70,
    about: 'الكرد على ري (الدوكاه): مي بيمول وسي بيمول، والركوز على الدوكاه.',
    events: seq('D3 Eb3 F3 G3 A3 Bb3 C4 D4 C4 Bb3 A3 G3 F3 Eb3 D3:2') },
  { id: 'tune1', title: 'لحن قصير على العجم (تأليف MusiTeacher)', level: 'مبتدئ', bpm: 76,
    about: 'لحن تعليمي قصير من ثماني مازورات على مقام العجم، صُمم لتدريب الانتقال بين الأوتار والريشة المتناوبة.',
    events: seq('G3 E3 F3 G3 A3 G3 F3 E3 D3 E3 F3 D3 E3:2 C3:2 C4 B3 A3 G3 A3 F3 G3 E3 F3 D3 E3 D3 C3:4') },
  { id: 'tune2', title: 'لحن قصير على الراست (تأليف MusiTeacher)', level: 'متوسط', bpm: 70,
    about: 'لحن تعليمي قصير على مقام الراست يستعمل السيكاه (مي نصف بيمول) والأوج (سي نصف بيمول).',
    events: seq('C3 D3 E½b3 F3 G3:2 F3 E½b3 D3 E½b3 F3 D3 C3:2 G3 A3 B½b3 C4 B½b3 A3 G3:2 F3 E½b3 D3 C3:4') },
  // ---------- مقامات وجمل شرقية (وضع «تركيز الأصابع») ----------
  { id: 'bayati', title: 'مقام البياتي على ري (الدوكاه)', level: 'متوسط', bpm: 66, group: 'شرقي',
    about: 'البياتي: مي نصف بيمول (سيكاه) ثم فا — ثلاثة أرباع الدرجة مرتين. سي بيمول في الجنس الثاني. الركوز على الدوكاه.',
    events: seq('D3 E½b3 F3 G3 A3 Bb3 C4 D4 C4 Bb3 A3 G3 F3 E½b3 D3:2') },
  { id: 'hijaz', title: 'مقام الحجاز على ري', level: 'متوسط', bpm: 66, group: 'شرقي',
    about: 'الحجاز: مي بيمول ثم فا دييز — بُعد زائد (درجة ونصف) بين الثانية والثالثة يعطيه لونه المميز.',
    events: seq('D3 Eb3 F#3 G3 A3 Bb3 C4 D4 C4 Bb3 A3 G3 F#3 Eb3 D3:2') },
  { id: 'nahawand', title: 'مقام النهاوند على دو', level: 'متوسط', bpm: 68, group: 'شرقي',
    about: 'النهاوند: مي بيمول ولا بيمول. الصعود هنا بسي بيمول (كردي) والهبوط بسي طبيعية (حسّاس) كما في إعداد المنصة.',
    events: seq('C3 D3 Eb3 F3 G3 Ab3 Bb3 C4 B3 Ab3 G3 F3 Eb3 D3 C3:2') },
  { id: 'saba', title: 'مقام الصبا على ري', level: 'متقدم', bpm: 60, group: 'شرقي',
    about: 'الصبا: مي نصف بيمول، فا، ثم صول بيمول — الرابعة ناقصة، وهي سر حزنه. لاحظ تقارب الوسطى والبنصر.',
    events: seq('D3 E½b3 F3 Gb3 A3 Bb3 C4 Bb3 A3 Gb3 F3 E½b3 D3:2') },
  { id: 'cross', title: 'تمرين الانتقال بين الأوتار', level: 'متوسط', bpm: 72, group: 'شرقي',
    about: 'نغمة الدوكاه المطلقة تتكرر (قرار ثابت) بينما يتنقل اللحن على النوى والكردان: تدريب على عبور الريشة للأوتار وثبات اليد اليسرى.',
    events: seq('D3 G3 D3 A3 D3 Bb3 D3 C4 D3 D4 D3 C4 D3 Bb3 D3 A3 D3 G3 D3:2') },
  { id: 'bayati-phrase', title: 'جملة بياتي بحليات (تأليف MusiTeacher)', level: 'متقدم', bpm: 60, group: 'شرقي',
    about: 'جملة تعليمية على البياتي فيها حليات موصولة (تُعزف باليد اليسرى دون ريشة) ونغمات مكررة — راقب الإصبع الذي ينقر الوتر ويرتفع سريعًا.',
    events: seq('D3 E½b3 F3 G3:2 | A3:0.5 G3:0.5~ F3 E½b3 D3:2 | F3 G3 A3 Bb3:0.5 A3:0.5~ G3:2 | G3:0.5 G3:0.5 F3:0.25 G3:0.25~ F3:0.5 E½b3 F3:0.5 E½b3:0.5 D3:4') },
  { id: 'rast-rep', title: 'جملة راست بنغمات متكررة (تأليف MusiTeacher)', level: 'متوسط', bpm: 76, group: 'شرقي',
    about: 'ريشة متناوبة سريعة ↓↑ على النغمة نفسها ثم انتقال: الإصبع يبقى ضاغطًا ولا يرتفع بين الضربتين.',
    events: seq('C3:0.5 C3:0.5 D3:0.5 D3:0.5 E½b3:0.5 E½b3:0.5 F3:0.5 F3:0.5 G3:0.5 G3:0.5 F3:0.5 E½b3:0.5 D3:0.5 E½b3:0.5 C3:2') },
  { id: 'jawab', title: 'تغيير وضع اليد: صعود إلى الجواب على الكردان', level: 'متقدم', bpm: 60, group: 'شرقي',
    about: 'اللحن يتجاوز مدى الوضع الأول على وتر الكردان، فتنتقل اليد كلها صعودًا على الزند ثم تعود — لاحظ أن الانتقال يجري لحظة الوتر المطلق.',
    events: seq('G3 A3 B3 C4 D4 E4 F4 G4:2 F4 G4 F4 E4 D4 C4:2 B3 A3 G3:2') },
];
export const exById = (id) => EXERCISES.find((e) => e.id === id);

/** وصف خطوة في التعليم الموجّه */
export function stepText(ev, prev, names = 'solfege') {
  const c = COURSES[ev.course], nm = noteName(ev.midi, names === 'latin' ? 'latin' : 'both', true);
  const lines = [];
  lines.push(`النغمة: ${nm}`);
  if (ev.finger === 0) lines.push(`وتر ${c.ar} مطلقًا — دون ضغط أي إصبع.`);
  else lines.push(`${FINGER_AR[ev.finger]} على وتر ${c.ar}، على بعد ${intervalAr(ev.semis) || (ev.semis / 2) + ' درجة'} من الأنف.` + (ev.pos ? ' (اليد في وضع أعلى على الزند)' : ''));
  if (ev.semis % 1) lines.push('ربع تون: ضع الإصبع في منتصف المسافة بين البيمول والطبيعية.');
  if (ev.slur) lines.push('حلية موصولة: اليد اليسرى وحدها — دون ضربة ريشة.'); else lines.push(ev.risha === 'down' ? 'الريشة: نازلة ↓ (من أعلى الوتر إلى أسفله)' : 'الريشة: صاعدة ↑ (من أسفل الوتر إلى أعلاه)');
  if (prev && prev.course !== ev.course) lines.push(`انتقل بالريشة إلى وتر ${c.ar}.`);
  return lines;
}
