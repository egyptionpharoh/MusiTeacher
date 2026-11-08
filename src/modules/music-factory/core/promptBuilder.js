// =====================================================================
// 📝 مولّد البرومبت المحلي (فوري وبدون ذكاء اصطناعي ولا تكلفة)
// يحوّل مشروع المستخدم إلى أربع خانات متوافقة مع Suno (Custom Mode):
//   Style of Music · Lyrics (بوسوم الأقسام) · Title · Exclude Styles
// كلمات المستخدم تُنسخ حرفيًا؛ لا يضاف إليها أو يحذف منها أي حرف.
// =====================================================================
import {
  GENRE_BY_ID, LANGUAGE_BY_ID, MOOD_BY_ID, RHYTHM_BY_ID, MAQAM_BY_ID, VOCAL_BY_ID, TEMPO_BY_ID,
  INTRO_BY_ID, OUTRO_BY_ID, SUNO_LIMITS,
} from './catalog.js';
import { sectionLabels, partOf } from './project.js';

const ascii = (s) => String(s || '').replace(/[^\x20-\x7E]/g, ' ').replace(/\s{2,}/g, ' ').trim();
const ARABIC_RHYTHM_DIALECTS = ['egyptian', 'omani', 'gulf', 'levantine', 'msa'];

export function effectiveBpm(choices) {
  if (choices.bpm) return choices.bpm;
  if (choices.tempo !== 'auto' && TEMPO_BY_ID[choices.tempo]) return TEMPO_BY_ID[choices.tempo].bpm;
  return null;
}

/** اللهجة الفعلية: اختيار المستخدم، أو لهجة الإيقاع العربي إن ترك اللغة تلقائية */
export function effectiveLanguage(project) {
  const c = project.choices;
  if (c.language !== 'auto') return c.language;
  const r = RHYTHM_BY_ID[c.rhythm];
  if (r && ARABIC_RHYTHM_DIALECTS.includes(r.dialect)) return r.dialect;
  const text = project.sections.map((s) => s.text).join(' ');
  if (/[؀-ۿ]/.test(text)) return null; // عربي بلا لهجة محددة: نترك للمحرك
  return null;
}

function instrumentsOf(choices, part) {
  return (choices.instruments && choices.instruments[part]) || [];
}

export function buildStyle(project) {
  const c = project.choices;
  const inst = project.mode === 'instrumental';
  const out = [];
  if (inst) out.push(c.genre !== 'auto' ? GENRE_BY_ID[c.genre].tag : 'Cinematic Orchestral', 'instrumental film score');
  else if (c.genre !== 'auto') out.push(GENRE_BY_ID[c.genre].tag);
  if (c.rhythm !== 'auto') out.push(RHYTHM_BY_ID[c.rhythm].tag);
  if (!inst) {
    const lang = effectiveLanguage(project);
    if (lang && LANGUAGE_BY_ID[lang]) out.push(LANGUAGE_BY_ID[lang].tag);
  }
  if (c.maqam !== 'auto') out.push(MAQAM_BY_ID[c.maqam].tag);
  if (c.mood !== 'auto') out.push(MOOD_BY_ID[c.mood].tag);
  if (!inst && c.vocals !== 'auto') out.push(VOCAL_BY_ID[c.vocals].tag);
  const bpm = effectiveBpm(c);
  if (bpm) out.push(`${c.tempo !== 'auto' ? TEMPO_BY_ID[c.tempo].tag + ', ' : ''}${bpm} BPM`);
  const all = [...new Set(Object.values(c.instruments || {}).flat())];
  if (all.length) out.push('featuring ' + all.join(', '));
  // ملاحظات المستخدم تدخل البرومبت المحلي فقط إن كانت بالإنجليزية (وصف المحركات يجب أن يكون إنجليزيًا)
  const extra = String(c.extra || '').trim();
  if (extra && !/[^\x00-\x7F]/.test(extra)) out.push(ascii(extra));
  if (inst) out.push('no vocals');
  out.push('high-fidelity studio production, professional mix and master');
  return ascii(out.join(', ')).slice(0, SUNO_LIMITS.style);
}

/** وسم القسم: [Verse 1: oud, qanun] — الإشارة اختيارية */
const tag = (label, cue) => `[${label}${cue ? ': ' + ascii(cue).slice(0, 140) : ''}]`;

export function buildLyrics(project, aiCues = {}) {
  const c = project.choices;
  const lines = [];
  if (project.mode === 'instrumental') {
    const parts = [
      ['Intro', 'intro', INTRO_BY_ID[c.intro]?.cue], ['Main Theme', 'verse'], ['Climax', 'chorus'], ['Bridge', 'bridge'],
      ['Outro', 'outro', OUTRO_BY_ID[c.outro]?.cue],
    ];
    parts.forEach(([label, part, extra], i) => {
      const cue = aiCues[i] || [instrumentsOf(c, part).join(', '), extra].filter(Boolean).join(', ');
      lines.push(tag(label, cue));
    });
    lines.push('[End]');
    return lines.join('\n\n');
  }
  const labels = sectionLabels(project.sections);
  const introCue = INTRO_BY_ID[c.intro]?.cue || '';
  const firstIsIntro = project.sections[0] && project.sections[0].type === 'intro';
  if (!firstIsIntro && c.intro !== 'sudden') {
    lines.push(tag('Intro', aiCues.intro || [instrumentsOf(c, 'intro').join(', '), introCue].filter(Boolean).join(', ')));
  }
  project.sections.forEach((s, i) => {
    const text = s.text.trim();
    if (s.type !== 'interlude' && s.type !== 'intro' && s.type !== 'outro' && !text) return;
    const part = partOf(s.type);
    let cue = aiCues[s.id];
    if (!cue) {
      const extra = s.type === 'intro' ? introCue : s.type === 'outro' ? (OUTRO_BY_ID[c.outro]?.cue || '') : '';
      cue = [instrumentsOf(c, part).join(', '), extra].filter(Boolean).join(', ');
      if (s.type === 'interlude' && !cue) cue = 'instrumental solo';
    }
    lines.push(tag(labels[i], cue) + (text && s.type !== 'interlude' ? '\n' + text : ''));
  });
  const last = project.sections[project.sections.length - 1];
  if (!last || last.type !== 'outro') {
    const oc = aiCues.outro || [instrumentsOf(c, 'outro').join(', '), OUTRO_BY_ID[c.outro]?.cue].filter(Boolean).join(', ');
    lines.push(tag('Outro', oc));
  }
  lines.push('[End]');
  return lines.join('\n\n');
}

export function buildTitle(project) {
  if (project.title.trim()) return project.title.trim().slice(0, SUNO_LIMITS.title);
  if (project.mode === 'instrumental') {
    const g = project.choices.genre !== 'auto' ? GENRE_BY_ID[project.choices.genre].tag.split(',')[0] : 'Cinematic';
    return `${g} Theme`;
  }
  const src = project.sections.find((s) => s.type === 'chorus' && s.text.trim()) || project.sections.find((s) => s.text.trim());
  const first = src ? src.text.trim().split('\n')[0] : '';
  return first.replace(/[.،,!?؟:;"«»()[\]…]+/g, ' ').replace(/\s+/g, ' ').trim().split(' ').slice(0, 6).join(' ');
}

export function buildExclude(project) {
  const c = project.choices;
  const ex = [];
  if (project.mode === 'instrumental') ex.push('vocals', 'singing', 'spoken word');
  if (c.rhythm === 'none') ex.push('drums', 'heavy percussion');
  if (c.genre === 'religious') ex.push('electric guitar', 'synth bass', 'drum kit');
  if (c.genre === 'children' || c.genre === 'school') ex.push('explicit lyrics', 'aggressive vocals', 'heavy distortion');
  if (c.genre === 'tarab') ex.push('autotune', '808 bass');
  return [...new Set(ex)].join(', ').slice(0, SUNO_LIMITS.exclude);
}

export function buildLocalPrompt(project) {
  return { style: buildStyle(project), lyrics: buildLyrics(project), title: buildTitle(project), exclude: buildExclude(project), source: 'local' };
}

/** نص كامل جاهز للصق في أي مولد يقبل خانة واحدة */
export function fullPromptText(out) {
  return [`--- STYLE ---\n${out.style}`, out.title ? `--- TITLE ---\n${out.title}` : '', out.exclude ? `--- EXCLUDE ---\n${out.exclude}` : '', `--- LYRICS ---\n${out.lyrics}`].filter(Boolean).join('\n\n');
}

/** هل كل سطر كتبه المستخدم موجود كما هو وبالترتيب نفسه داخل كلمات البرومبت؟ */
export function lyricsPreserved(project, lyrics) {
  if (project.mode === 'instrumental') return true;
  const original = project.sections.filter((s) => s.type !== 'interlude').flatMap((s) => s.text.split('\n').map((l) => l.trim()).filter(Boolean));
  const outLines = String(lyrics || '').split('\n').map((l) => l.trim()).filter((l) => l && !/^\[.*\]$/.test(l));
  return original.length === outLines.length && original.every((l, i) => l === outLines[i]);
}
