// =====================================================================
//  تمارين العود: الأوتار المطلقة، مقامات في الوضع الأول (مطابقة لبيانات «مقامات العود» في المنصة)، ولحنان قصيران
//  من تأليف MusiTeacher لهذا التمرين (ليست ألحانًا منشورة لأحد). كل حدث: نغمة + مدة (بالضربات) + اتجاه الريشة.
//  اتجاه الريشة: متناوب ↓↑ للنغمات القصيرة، ونازل ↓ للنغمة الطويلة (ضربتان فأكثر) وبعدها — كما يُدرَّس المبتدئ.
// =====================================================================
import { placeNote, noteName, COURSES, FINGER_AR, intervalAr } from '../instrument/oud-data.js';

const STEP = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
// 'E½b3' → midi (يدعم b و # و ½b)
export function m(n) {
  const r = /^([A-G])(½b|½#|b|#)?(\d)$/.exec(n); if (!r) throw new Error('bad note ' + n);
  const acc = { 'b': -1, '#': 1, '½b': -0.5, '½#': 0.5 }[r[2]] || 0;
  return 12 * (+r[3] + 1) + STEP[r[1]] + acc;
}
function seq(list, defBeats = 1) {
  // list: "C3 D3:2 E½b3" ← نغمة[:ضربات]
  const evs = []; let t = 0, dir = 'down';
  for (const tok of list.trim().split(/\s+/)) {
    const [n, b] = tok.split(':'), beats = b ? +b : defBeats, midi = m(n), pl = placeNote(midi);
    if (!pl) throw new Error('out of first position ' + n);
    const longN = beats >= 2;
    const risha = longN ? 'down' : dir;
    evs.push({ midi, beats, start: t, risha, ...pl });
    t += beats; dir = longN ? 'down' : (risha === 'down' ? 'up' : 'down');
  }
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
];
export const exById = (id) => EXERCISES.find((e) => e.id === id);

/** وصف خطوة في التعليم الموجّه */
export function stepText(ev, prev, names = 'solfege') {
  const c = COURSES[ev.course], nm = noteName(ev.midi, names === 'latin' ? 'latin' : 'both', true);
  const lines = [];
  lines.push(`النغمة: ${nm}`);
  if (ev.finger === 0) lines.push(`وتر ${c.ar} مطلقًا — دون ضغط أي إصبع.`);
  else lines.push(`${FINGER_AR[ev.finger]} على وتر ${c.ar}، على بعد ${intervalAr(ev.semis)} من الأنف.`);
  if (ev.semis % 1) lines.push('ربع تون: ضع الإصبع في منتصف المسافة بين البيمول والطبيعية.');
  lines.push(ev.risha === 'down' ? 'الريشة: نازلة ↓ (من أعلى الوتر إلى أسفله)' : 'الريشة: صاعدة ↑ (من أسفل الوتر إلى أعلاه)');
  if (prev && prev.course !== ev.course) lines.push(`انتقل بالريشة إلى وتر ${c.ar}.`);
  return lines;
}
