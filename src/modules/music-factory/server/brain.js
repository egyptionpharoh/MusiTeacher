// =====================================================================
// 🧠 «عقل المايسترو» — تحليل الكلمات + برومبت احترافي + تعديل محدد (نصوص فقط، لا صوت هنا)
// المزوّدون: Claude (Anthropic) ثم Gemini (Google) بالترتيب، ثم محرك محلي حتى لا تتوقف الأداة.
// قاعدة ذهبية: الذكاء الاصطناعي لا يكتب الكلمات أبدًا؛ يقترح وسوم الأداء فقط،
// والكلمات النهائية يركّبها buildLyrics من نص المستخدم حرفيًا، ثم نتحقق بـ lyricsPreserved.
// المفاتيح تُقرأ من متغيرات البيئة على الخادم فقط.
// =====================================================================
import crypto from 'node:crypto';
import { GENRES, LANGUAGES, MOODS, RHYTHMS, MAQAMS, VOCALS, TEMPOS, INTROS, OUTROS, INSTRUMENTS, ARRANGEMENT_PARTS, SUNO_LIMITS, ids } from '../core/catalog.js';
import { normalizeProject, sectionLabels } from '../core/project.js';
import { buildLyrics, buildLocalPrompt, lyricsPreserved } from '../core/promptBuilder.js';

const ENUMS = {
  genre: ids(GENRES), language: ids(LANGUAGES), mood: ids(MOODS), rhythm: ids(RHYTHMS), maqam: ids(MAQAMS),
  vocals: ids(VOCALS), tempo: ids(TEMPOS), intro: ids(INTROS).filter((x) => x !== 'auto'), outro: ids(OUTROS).filter((x) => x !== 'auto'),
  confidence: ['low', 'medium', 'high'],
};
const PARTS = ARRANGEMENT_PARTS.map((p) => p.id);

export const cfg = (env = process.env) => ({
  claudeKey: env.ANTHROPIC_API_KEY || '',
  claudeModel: env.MF_CLAUDE_MODEL || 'claude-sonnet-5-5',
  claudeBase: (env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com').replace(/\/$/, ''),
  geminiKey: env.GEMINI_API_KEY || '',
  geminiModel: env.MF_GEMINI_MODEL || 'gemini-2.5-flash',
  geminiBase: (env.MF_GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com').replace(/\/$/, ''),
  timeoutMs: Math.max(3000, parseInt(env.MF_AI_TIMEOUT_MS || '45000', 10) || 45000),
  order: (env.MF_AI_PROVIDER_ORDER || 'claude,gemini').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean),
});

const clip = (s, n) => (typeof s === 'string' ? s.trim().slice(0, n) : '');
const asciiTags = (s, n) => clip(String(s || '').replace(/[[\]{}]/g, '').replace(/[^\x20-\x7E]/g, ' ').replace(/\s{2,}/g, ' '), n);
const pickEnum = (v, list) => (typeof v === 'string' ? list.find((x) => x.toLowerCase() === v.trim().toLowerCase()) || null : null);

// ذاكرة مؤقتة صغيرة: نفس الطلب خلال ساعة لا يكلّف استدعاءً جديدًا
const cache = new Map();
const CACHE_MAX = 200, CACHE_TTL = 3600 * 1000;
const cacheKey = (task, payload) => crypto.createHash('sha256').update(task + '|' + JSON.stringify(payload)).digest('hex');
const cacheGet = (k) => { const e = cache.get(k); if (!e) return null; if (Date.now() - e.t > CACHE_TTL) { cache.delete(k); return null; } return e.v; };
const cacheSet = (k, v) => { if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value); cache.set(k, { t: Date.now(), v }); };

// ---------- وصف المشروع للنموذج ----------
function projectToText(project) {
  const c = project.choices;
  const L = [];
  L.push(`MODE: ${project.mode === 'instrumental' ? 'Instrumental / soundtrack (no vocals)' : 'Vocal song'}`);
  if (project.title) L.push(`TITLE (user): ${project.title}`);
  L.push('USER CHOICES ("auto" = left to you; any other value is the USER\'S DECISION and must be honoured):');
  for (const k of ['genre', 'language', 'mood', 'rhythm', 'maqam', 'vocals', 'tempo', 'intro', 'outro']) L.push(`- ${k}: ${c[k]}`);
  L.push(`- bpm: ${c.bpm || 'auto'}`);
  if (project.mode === 'instrumental') L.push(`- target duration: ${c.durationSec} seconds`);
  const inst = PARTS.filter((p) => c.instruments[p].length).map((p) => `${p}: ${c.instruments[p].join(', ')}`);
  L.push(`- instruments: ${inst.length ? inst.join(' | ') : 'auto'}`);
  if (c.extra) L.push(`- extra notes from the user: ${c.extra}`);
  if (project.mode === 'song' && project.sections.length) {
    const labels = sectionLabels(project.sections);
    L.push('', 'LYRICS (in singing order; each section has an index):');
    project.sections.forEach((s, i) => {
      L.push(`<section index="${i}" type="${s.type}" label="${labels[i]}">`);
      L.push(s.text.trim() || '(instrumental / no lyrics)');
      L.push('</section>');
    });
  } else if (project.mode === 'instrumental') {
    L.push('', 'STRUCTURE (instrumental, indexes 0-4): 0 Intro, 1 Main Theme, 2 Climax, 3 Bridge, 4 Outro');
  }
  return L.join('\n');
}

const SYSTEM = `You are the music director of "Music Factory" inside MusiTeacher, an Arabic-first platform for music teachers that turns lyrics into songs.
You are an expert in Arabic music (maqamat, Egyptian / Gulf / Omani / Levantine / Iraqi / Maghrebi rhythms), in Western popular and film music, in orchestration, and in writing prompts for AI music generators (Suno, ElevenLabs Music, Google Lyria).
Rules you never break:
- Never rewrite, translate, correct or "improve" the user's lyrics in any output field except "lyric_notes", where you may suggest optional edits the user can accept or ignore.
- The user is the artistic decision maker. A choice that is not "auto" is the user's decision: in prompts you MUST honour it; in analysis you may suggest something else only with a short, respectful reason.
- Be honest about uncertainty. Maqam suggestions are educated guesses from mood and dialect, not detections; use "low" or "medium" confidence unless unmistakable.
- Style text: English only, comma-separated musical descriptors, no full sentences, no real artist, band or song names, no brackets.
- Content is for teachers and school settings: keep it family-friendly.
- Answer only with the requested JSON.`;

// ---------- مخططات JSON ----------
const S = (props, req = Object.keys(props)) => ({ type: 'object', properties: props, required: req, additionalProperties: false });
const str = { type: 'string' };
const SUG = (values) => S({ value: { type: 'string', enum: values }, reason_ar: str });
export const ANALYZE_SCHEMA = S({
  summary_ar: str,
  language_detected: { type: 'string', enum: [...ENUMS.language, 'unknown'] },
  themes_ar: { type: 'array', items: str },
  dramatic_arc_ar: str,
  suggestions: S({
    genre: SUG(ENUMS.genre), mood: SUG(ENUMS.mood), rhythm: SUG(ENUMS.rhythm), tempo: SUG(ENUMS.tempo),
    bpm: S({ value: { type: 'integer' }, reason_ar: str }),
    maqam: S({ value: { type: 'string', enum: ENUMS.maqam }, confidence: { type: 'string', enum: ENUMS.confidence }, reason_ar: str }),
    vocals: SUG(ENUMS.vocals), intro: SUG(ENUMS.intro), outro: SUG(ENUMS.outro),
    instruments: S(Object.fromEntries(PARTS.map((p) => [p, { type: 'array', items: { type: 'string', enum: INSTRUMENTS } }]))),
  }),
  arrangement_ar: { type: 'array', items: S({ part: str, idea: str }) },
  lyric_notes: { type: 'array', items: S({ line: str, note_ar: str, suggestion: str }) },
  structure_note_ar: str,
});
export const PROMPT_SCHEMA = S({
  styles: { type: 'array', items: str },
  title: str,
  exclude: str,
  section_cues: { type: 'array', items: S({ index: { type: 'integer' }, cue: str }) },
  intro_cue: str,
  outro_cue: str,
  notes_ar: str,
});

// ---------- المزوّدون ----------
const withTimeout = (ms) => { const ac = new AbortController(); const t = setTimeout(() => ac.abort(), ms); return { signal: ac.signal, done: () => clearTimeout(t) }; };
const err = (message, code) => Object.assign(new Error(message), { code });

async function callClaude(c, system, user, schema, maxTokens) {
  if (!c.claudeKey) throw err('Claude غير مُعد (ANTHROPIC_API_KEY)', 'not_configured');
  const t = withTimeout(c.timeoutMs);
  try {
    const res = await fetch(`${c.claudeBase}/v1/messages`, {
      method: 'POST', signal: t.signal,
      headers: { 'content-type': 'application/json', 'x-api-key': c.claudeKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: c.claudeModel, max_tokens: maxTokens, system, messages: [{ role: 'user', content: user }], output_config: { format: { type: 'json_schema', schema } } }),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) throw err(`Claude HTTP ${res.status}: ${body && body.error ? body.error.message : ''}`, 'http_' + res.status);
    if (body.stop_reason === 'refusal') throw err('Claude رفض الطلب', 'refusal');
    if (body.stop_reason === 'max_tokens') throw err('Claude: الرد انقطع قبل اكتماله', 'truncated');
    const block = (body.content || []).find((b) => b.type === 'text');
    if (!block) throw err('Claude: رد بدون نص', 'bad_response');
    return { data: JSON.parse(block.text), model: c.claudeModel };
  } finally { t.done(); }
}

async function callGemini(c, system, user, schema, maxTokens) {
  if (!c.geminiKey) throw err('Gemini غير مُعد (GEMINI_API_KEY)', 'not_configured');
  const t = withTimeout(c.timeoutMs);
  try {
    const res = await fetch(`${c.geminiBase}/v1beta/models/${encodeURIComponent(c.geminiModel)}:generateContent`, {
      method: 'POST', signal: t.signal,
      headers: { 'content-type': 'application/json', 'x-goog-api-key': c.geminiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: `${user}\n\nReturn ONLY a JSON object matching this JSON schema exactly (same keys, enums respected):\n${JSON.stringify(schema)}` }] }],
        generationConfig: { responseMimeType: 'application/json', maxOutputTokens: maxTokens, temperature: 0.8 },
      }),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) throw err(`Gemini HTTP ${res.status}: ${body && body.error ? body.error.message : ''}`, 'http_' + res.status);
    const text = (body?.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('').trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
    if (!text) throw err('Gemini: رد فارغ', 'bad_response');
    return { data: JSON.parse(text), model: c.geminiModel };
  } finally { t.done(); }
}

const PROVIDERS = { claude: callClaude, gemini: callGemini };

export function brainStatus(env = process.env) {
  const c = cfg(env);
  return { order: c.order.filter((n) => PROVIDERS[n]), providers: [{ name: 'claude', label: 'Claude', configured: !!c.claudeKey }, { name: 'gemini', label: 'Gemini', configured: !!c.geminiKey }] };
}

async function runWithFallback(task, user, schema, maxTokens, validate, env) {
  const c = cfg(env);
  const errors = [];
  for (const name of c.order) {
    const fn = PROVIDERS[name];
    if (!fn) continue;
    try {
      const r = await fn(c, SYSTEM, user, schema, maxTokens);
      return { provider: name, model: r.model, data: validate(r.data), errors };
    } catch (e) {
      const code = e.code || (e.name === 'AbortError' ? 'timeout' : 'error');
      errors.push({ provider: name, code, message: String(e.message || e).slice(0, 200) });
      if (code !== 'not_configured') console.warn(`[music-factory brain:${task}] ${name} failed:`, e.message);
    }
  }
  return { provider: null, data: null, errors };
}

// ---------- التحقق من الردود ----------
function validateAnalysis(d) {
  if (!d || typeof d !== 'object' || !d.suggestions) throw new Error('رد تحليل غير صالح');
  const sg = d.suggestions;
  const e = (o, list) => { const v = o && pickEnum(o.value, list); return v ? { value: v, reason_ar: clip(o.reason_ar, 300) } : null; };
  const inst = {};
  for (const p of PARTS) inst[p] = ((sg.instruments && sg.instruments[p]) || []).filter((i) => INSTRUMENTS.includes(i)).slice(0, 6);
  const bpm = sg.bpm && Number.isFinite(+sg.bpm.value) ? Math.max(40, Math.min(220, Math.round(+sg.bpm.value))) : null;
  return {
    summary_ar: clip(d.summary_ar, 600),
    language_detected: pickEnum(d.language_detected, [...ENUMS.language, 'unknown']) || 'unknown',
    themes_ar: (Array.isArray(d.themes_ar) ? d.themes_ar : []).map((t) => clip(t, 60)).filter(Boolean).slice(0, 6),
    dramatic_arc_ar: clip(d.dramatic_arc_ar, 500),
    suggestions: {
      genre: e(sg.genre, ENUMS.genre), mood: e(sg.mood, ENUMS.mood), rhythm: e(sg.rhythm, ENUMS.rhythm), tempo: e(sg.tempo, ENUMS.tempo),
      bpm: bpm ? { value: bpm, reason_ar: clip(sg.bpm.reason_ar, 300) } : null,
      maqam: sg.maqam && pickEnum(sg.maqam.value, ENUMS.maqam) ? { value: pickEnum(sg.maqam.value, ENUMS.maqam), confidence: pickEnum(sg.maqam.confidence, ENUMS.confidence) || 'low', reason_ar: clip(sg.maqam.reason_ar, 300) } : null,
      vocals: e(sg.vocals, ENUMS.vocals), intro: e(sg.intro, ENUMS.intro), outro: e(sg.outro, ENUMS.outro), instruments: inst,
    },
    arrangement_ar: (Array.isArray(d.arrangement_ar) ? d.arrangement_ar : []).slice(0, 8).map((a) => ({ part: clip(a.part, 40), idea: clip(a.idea, 300) })).filter((a) => a.idea),
    lyric_notes: (Array.isArray(d.lyric_notes) ? d.lyric_notes : []).slice(0, 6).map((n) => ({ line: clip(n.line, 200), note_ar: clip(n.note_ar, 300), suggestion: clip(n.suggestion, 200) })).filter((n) => n.note_ar),
    structure_note_ar: clip(d.structure_note_ar, 400),
  };
}

function validatePrompt(d, project) {
  if (!d || typeof d !== 'object') throw new Error('رد برومبت غير صالح');
  const styles = (Array.isArray(d.styles) ? d.styles : []).map((s) => asciiTags(s, SUNO_LIMITS.style)).filter((s) => s.length >= 20).slice(0, 3);
  if (!styles.length) throw new Error('لا يوجد وصف Style صالح');
  const n = project.mode === 'instrumental' ? 5 : project.sections.length;
  const cues = {};
  for (const c of Array.isArray(d.section_cues) ? d.section_cues : []) {
    if (Number.isInteger(c.index) && c.index >= 0 && c.index < n) {
      const key = project.mode === 'instrumental' ? c.index : project.sections[c.index].id;
      const cue = asciiTags(c.cue, 140);
      if (cue) cues[key] = cue;
    }
  }
  if (project.mode === 'song') {
    if (asciiTags(d.intro_cue, 140)) cues.intro = asciiTags(d.intro_cue, 140);
    if (asciiTags(d.outro_cue, 140)) cues.outro = asciiTags(d.outro_cue, 140);
  }
  return { styles, title: clip(String(d.title || '').replace(/[[\]\n]/g, ' '), SUNO_LIMITS.title), exclude: asciiTags(d.exclude, SUNO_LIMITS.exclude), cues, notes_ar: clip(d.notes_ar, 600) };
}

// ---------- محرك محلي احتياطي ----------
const MOOD_WORDS = {
  sad: ['دموع', 'دمعة', 'حزن', 'حزين', 'وجع', 'جرح', 'فراق', 'غياب', 'وداع', 'بكا', 'ألم', 'tears', 'cry', 'pain', 'goodbye'],
  romantic: ['حب', 'حبيب', 'عشق', 'قلبي', 'عيونك', 'غرام', 'هوى', 'شوق', 'أحبك', 'بحبك', 'love', 'heart'],
  joyful: ['فرح', 'فرحة', 'عيد', 'ضحك', 'سعادة', 'يلا', 'نرقص', 'happy', 'smile', 'dance'],
  proud: ['وطن', 'بلادي', 'عمان', 'عُمان', 'مصر', 'علم', 'مجد', 'فخر', 'نفدي', 'سلطان', 'homeland', 'glory'],
  nostalgic: ['ذكرى', 'ذكريات', 'زمان', 'أيام', 'حنين', 'رجعت', 'memories'],
  uplifting: ['أمل', 'بكرة', 'حلم', 'نجاح', 'نقدر', 'مدرسة', 'علم', 'نتعلم', 'hope', 'dream'],
};
const MOOD_DEFAULTS = {
  sad: { tempo: 'slow', bpm: 72, maqam: 'Saba', rhythm: 'waltz', inst: { intro: ['Cello', 'Qanun'], verse: ['Oud', 'Grand Piano'], chorus: ['Violins', 'Cello'], bridge: ['Ney'], outro: ['Violins'] } },
  romantic: { tempo: 'slow', bpm: 80, maqam: 'Nahawand', rhythm: 'maqsum', inst: { intro: ['Grand Piano'], verse: ['Oud', 'Acoustic Guitar'], chorus: ['Violins', 'Darbuka'], bridge: ['Qanun'], outro: ['Grand Piano'] } },
  joyful: { tempo: 'fast', bpm: 118, maqam: 'Ajam', rhythm: 'fox', inst: { intro: ['Accordion', 'Darbuka'], verse: ['Darbuka', 'Electric Piano'], chorus: ['Violins', 'Riq', 'Synthesizer'], bridge: ['Accordion'], outro: ['Darbuka'] } },
  proud: { tempo: 'medium', bpm: 100, maqam: 'Rast', rhythm: 'school_march', inst: { intro: ['Trumpet', 'Timpani'], verse: ['Violins', 'Drum Kit'], chorus: ['Brass Section', 'Violins'], bridge: ['Timpani'], outro: ['Trumpet'] } },
  nostalgic: { tempo: 'medium', bpm: 90, maqam: 'Kurd', rhythm: 'maqsum', inst: { intro: ['Oud'], verse: ['Oud', 'Qanun'], chorus: ['Violins', 'Darbuka'], bridge: ['Ney'], outro: ['Oud'] } },
  uplifting: { tempo: 'medium', bpm: 104, maqam: 'Ajam', rhythm: 'fox', inst: { intro: ['Grand Piano'], verse: ['Acoustic Guitar', 'Drum Kit'], chorus: ['Violins', 'Synthesizer', 'Drum Kit'], bridge: ['Grand Piano'], outro: ['Violins'] } },
};
export function localAnalyze(project) {
  const text = project.sections.map((s) => s.text).join(' ').toLowerCase();
  let best = 'romantic', score = 0;
  for (const [mood, words] of Object.entries(MOOD_WORDS)) {
    const n = words.reduce((a, w) => a + (text.split(w.toLowerCase()).length - 1), 0);
    if (n > score) { best = mood; score = n; }
  }
  const d = MOOD_DEFAULTS[best];
  const why = score ? 'بناءً على كلمات متكررة في النص (تحليل محلي مبسط)' : 'لم تظهر كلمات دالة واضحة؛ هذا اقتراح عام (تحليل محلي مبسط)';
  return {
    summary_ar: 'تحليل محلي سريع بدون ذكاء اصطناعي: يعتمد على كلمات مفتاحية فقط، فتعامل معه كنقطة بداية.',
    language_detected: /[؀-ۿ]/.test(text) ? 'unknown' : 'english', themes_ar: [], dramatic_arc_ar: '',
    suggestions: {
      genre: null, mood: { value: best, reason_ar: why }, rhythm: { value: d.rhythm, reason_ar: 'إيقاع شائع مع هذا المزاج' },
      tempo: { value: d.tempo, reason_ar: 'سرعة مناسبة للمزاج المقترح' }, bpm: { value: d.bpm, reason_ar: 'قيمة تقريبية' },
      maqam: { value: d.maqam, confidence: 'low', reason_ar: 'اقتراح عام مرتبط بالمزاج وليس تحليلًا للحن' },
      vocals: null, intro: null, outro: null, instruments: d.inst,
    },
    arrangement_ar: [], lyric_notes: [], structure_note_ar: '',
  };
}

// ---------- المهام ----------
const analyzeText = (p) => `${projectToText(p)}

TASK: Analyse this project as a music director, then suggest settings.
- summary_ar: 2-3 Arabic sentences: what the song is about and how it should feel.
- themes_ar: up to 5 short Arabic themes. dramatic_arc_ar: how the emotion moves across sections.
- suggestions: values MUST come from the enums. instruments: 2-4 per arrangement part (intro / verse / chorus / bridge / outro), only from the list. bpm: approximate integer.
- maqam: explain briefly why; keep confidence honest.
- arrangement_ar: 3-6 concrete Arabic arrangement ideas (intro, accompaniment under vocals, fills, breaks, ending).
- lyric_notes: at most 5 OPTIONAL notes on singability or section balance; "line" quotes the user's line exactly.
- structure_note_ar: one sentence on whether the structure works.
All reasons in Arabic, short and practical.`;

const promptText = (p, analysis, variants) => `${projectToText(p)}
${analysis ? `\nPREVIOUS ANALYSIS SHOWN TO THE USER (user choices come first):\n${JSON.stringify({ summary: analysis.summary_ar, suggestions: analysis.suggestions })}\n` : ''}
TASK: Write a professional, detailed music-generation prompt for this project (compatible with Suno Custom Mode, ElevenLabs Music and Google Lyria).
- styles: ${variants} alternative "Style of Music" texts, each 300-900 characters, English, comma-separated descriptors: genre and sub-genre, regional flavour and vocal dialect, mood, tempo/BPM, maqam/key colour, lead instruments, accompaniment texture, vocal type and delivery, production and mix. Each alternative takes a clearly different artistic angle while respecting every non-auto choice.
- section_cues: for each section index, a short English performance/arrangement cue (max 12 words), e.g. "soft oud and qanun, intimate vocal" or "full band, darbuka groove, choir answers". No section names, no lyrics.
- intro_cue / outro_cue: short English cues for the instrumental intro and the ending (may be empty).
- title: short title in the language of the lyrics (English for instrumentals).
- exclude: short English list of things to avoid (may be empty).
- notes_ar: 1-3 short Arabic tips for getting the best result.`;

const refineText = (p, current, instruction) => `${projectToText(p)}

CURRENT PROMPT:
STYLE: ${current.style}
TITLE: ${current.title || ''}
EXCLUDE: ${current.exclude || ''}

USER'S REQUESTED CHANGE (Arabic or English): """${instruction}"""

TASK: Apply ONLY the requested change and keep everything else as close as possible. Return styles with exactly 1 item (the revised style), section_cues for every section (revised where needed), intro_cue, outro_cue, title, exclude, and in notes_ar one Arabic sentence describing what you changed. Lyrics are never changed.`;

export async function analyze(raw, env = process.env) {
  const project = normalizeProject(raw);
  if (project.mode === 'song' && !project.sections.some((s) => s.text.trim())) return { ok: false, status: 400, error: 'اكتب الكلمات أولًا حتى يستطيع المايسترو تحليلها.' };
  const key = cacheKey('analyze', project);
  const hit = cacheGet(key);
  if (hit) return { ...hit, cached: true };
  const r = await runWithFallback('analyze', analyzeText(project), ANALYZE_SCHEMA, 2500, validateAnalysis, env);
  const result = r.data
    ? { ok: true, provider: r.provider, model: r.model, analysis: r.data }
    : { ok: true, provider: 'local', analysis: localAnalyze(project), warning: 'تعذر الوصول لخدمات الذكاء الاصطناعي الآن، فاستخدمنا تحليلًا محليًا مبسطًا.' };
  if (r.data) cacheSet(key, result);
  return result;
}

export async function buildPrompt(raw, analysis, variants = 3, env = process.env) {
  const project = normalizeProject(raw);
  if (project.mode === 'song' && !project.sections.some((s) => s.text.trim())) return { ok: false, status: 400, error: 'لا توجد كلمات لبناء البرومبت.' };
  variants = Math.max(1, Math.min(3, parseInt(variants, 10) || 1));
  const key = cacheKey('prompt', { project, a: analysis ? analysis.suggestions : null, variants });
  const hit = cacheGet(key);
  if (hit) return { ...hit, cached: true };
  const r = await runWithFallback('prompt', promptText(project, analysis, variants), PROMPT_SCHEMA, 3000, (d) => validatePrompt(d, project), env);
  if (!r.data) return { ok: false, status: 503, fallback: buildLocalPrompt(project), error: 'خدمات الذكاء الاصطناعي غير متاحة الآن؛ عرضنا البرومبت المحلي بدلًا منه.' };
  const lyrics = buildLyrics(project, r.data.cues);
  if (!lyricsPreserved(project, lyrics)) return { ok: false, status: 500, fallback: buildLocalPrompt(project), error: 'تم رفض الناتج لأنه لم يحافظ على الكلمات الأصلية.' };
  const result = { ok: true, provider: r.provider, model: r.model, styles: r.data.styles, title: project.title || r.data.title, exclude: r.data.exclude, lyrics, cues: r.data.cues, notes_ar: r.data.notes_ar };
  cacheSet(key, result);
  return result;
}

export async function refine(raw, current, instruction, env = process.env) {
  const project = normalizeProject(raw);
  const ins = clip(instruction, 500);
  if (!ins) return { ok: false, status: 400, error: 'اكتب التعديل المطلوب.' };
  const cur = { style: asciiTags(current && current.style, SUNO_LIMITS.style), title: clip(current && current.title, SUNO_LIMITS.title), exclude: asciiTags(current && current.exclude, SUNO_LIMITS.exclude) };
  if (!cur.style) return { ok: false, status: 400, error: 'لا يوجد برومبت حالي لتعديله.' };
  const r = await runWithFallback('refine', refineText(project, cur, ins), PROMPT_SCHEMA, 2500, (d) => validatePrompt(d, project), env);
  if (!r.data) return { ok: false, status: 503, error: 'تعذر تنفيذ التعديل الآن (خدمات الذكاء الاصطناعي غير متاحة). البرومبت الحالي لم يتغير.' };
  const lyrics = buildLyrics(project, r.data.cues);
  if (!lyricsPreserved(project, lyrics)) return { ok: false, status: 500, error: 'تم رفض التعديل لأنه لم يحافظ على الكلمات الأصلية.' };
  return { ok: true, provider: r.provider, model: r.model, styles: r.data.styles, title: r.data.title || cur.title, exclude: r.data.exclude, lyrics, cues: r.data.cues, notes_ar: r.data.notes_ar };
}

export const _internal = { cache, projectToText, validateAnalysis, validatePrompt, ENUMS };
