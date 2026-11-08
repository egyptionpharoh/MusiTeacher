// 🎹 Google Lyria (عبر Gemini API) — محرك رسمي يستخدم مفتاح GEMINI_API_KEY الموجود أصلًا في MusiTeacher.
// يعمل فقط عند ضبط MF_LYRIA_ENABLED=true (حتى لا يُستهلك رصيد Gemini دون قرار من مدير المنصة).
// التوثيق: POST https://generativelanguage.googleapis.com/v1beta/interactions  { model, input, response_format:{type:'audio'} }
//   • lyria-3.5            : أغنية كاملة (حتى ~3 دقائق) بغناء وكلمات مخصصة بوسوم [Verse]/[Chorus]، أو موسيقى بلا غناء
//   • lyria-3-clip-preview : مقطع 30 ثانية (معاينة سريعة أرخص)
// الصوت يعود base64 داخل steps[].content[] (type: "audio")، ويحمل علامة SynthID غير مسموعة.
import { parseTaggedLyrics } from '../../core/tagParser.js';
import { fail, readError, directionText, sleep, mmss, maxSeconds } from './util.js';

const cfg = (env) => ({
  key: env.GEMINI_API_KEY || '',
  base: (env.MF_GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com').replace(/\/$/, ''),
  full: env.MF_LYRIA_MODEL || 'lyria-3.5',
  clip: env.MF_LYRIA_CLIP_MODEL || 'lyria-3-clip-preview',
  // مفتاح Gemini موجود أصلًا للمعلم الذكي؛ لذلك لا نصرف منه على الصوت إلا بموافقة صريحة
  enabled: env.MF_LYRIA_ENABLED === 'true',
});

function estimateSeconds(req) {
  const parts = parseTaggedLyrics(req.output.lyrics);
  const lines = parts.reduce((a, p) => a + p.lines.length, 0);
  const instr = parts.filter((p) => !p.lines.length).length;
  return Math.round(lines * 4.5 + instr * 8 + 6);
}

/** نص الطلب: التوجيه الموسيقي منفصل بوضوح عن الكلمات (كما توصي Google) */
export function lyriaInput(req, env = {}) {
  const { style, avoid } = directionText(req);
  if (req.mode === 'instrumental') {
    const sec = req.quality === 'preview' ? 30 : Math.min(req.durationSec || 60, 180, maxSeconds(env));
    const structure = parseTaggedLyrics(req.output.lyrics).map((s) => (s.cues.length ? `${s.name} (${s.cues.join(', ')})` : s.name));
    return [
      'Instrumental only, no vocals.',
      `Create an instrumental piece of about ${mmss(sec)} (${sec} seconds).`,
      `Musical direction: ${style}.`,
      structure.length ? `Structure: ${structure.join(' -> ')}.` : '',
      avoid ? `Avoid: ${avoid}.` : '',
    ].filter(Boolean).join('\n');
  }
  const sec = Math.min(180, Math.max(45, estimateSeconds(req)));
  const lyrics = String(req.output.lyrics || '').replace(/^\s*\[End\]\s*$/gim, '').trim();
  return [
    `Create a complete song of about ${mmss(sec)}.`,
    `Musical direction: ${style}.`,
    avoid ? `Avoid: ${avoid}.` : '',
    'Sing exactly these lyrics, in this order, following the section tags. Do not change, translate or add words:',
    '',
    lyrics,
  ].filter((x) => x !== '').join('\n');
}

/** يبحث عن أول كتلة صوت في الرد مهما اختلف شكلها قليلًا */
export function extractAudio(json) {
  const found = [];
  const walk = (o, depth = 0) => {
    if (!o || typeof o !== 'object' || depth > 8 || found.length) return;
    if (Array.isArray(o)) { o.forEach((x) => walk(x, depth + 1)); return; }
    if ((o.type === 'audio' || /^audio\//.test(o.mime_type || o.mimeType || '')) && typeof o.data === 'string' && o.data.length > 100) {
      found.push({ data: o.data, mime: o.mime_type || o.mimeType || 'audio/mpeg' }); return;
    }
    for (const k of ['output_audio', 'steps', 'content', 'outputs', 'inlineData', 'inline_data', 'parts']) if (o[k]) walk(o[k], depth + 1);
  };
  walk(json);
  return found[0] || null;
}

function lyriaError(status, detail) {
  if (status === 400 && /safety|blocked|copyright|artist|policy/i.test(detail)) return fail('رفض Lyria الطلب بسبب فلاتر الأمان (أسماء فنانين أو كلمات محمية مثلًا). عدّل الكلمات أو الوصف.', 'rejected', { detail });
  if (status === 400 || status === 404) return fail('نموذج Lyria غير متاح لهذا المفتاح أو الطلب غير مقبول: ' + String(detail).slice(0, 160), 'invalid', { detail });
  if (status === 401 || status === 403) return fail('مفتاح Gemini لا يملك صلاحية Lyria (قد يحتاج حسابًا مدفوعًا).', 'auth', { detail });
  if (status === 429) return fail('حد الاستخدام في Gemini/Lyria تم تجاوزه. حاول لاحقًا.', 'quota', { detail });
  return fail(`خطأ من Lyria (${status}).`, 'http_' + status, { detail });
}

export default {
  id: 'lyria',
  label: 'Google Lyria',
  official: true,
  vocals: true,
  instrumental: true,
  preview: true,
  note_ar: 'محرك Google الرسمي عبر مفتاح Gemini نفسه؛ الأغنية حتى 3 دقائق تقريبًا، والمعاينة 30 ثانية.',
  configured: (env) => { const c = cfg(env); return !!c.key && c.enabled; },
  model: (env) => cfg(env).full,
  async generate(req, ctx) {
    const c = cfg(ctx.env);
    if (req.mode === 'song' && !parseTaggedLyrics(req.output.lyrics).some((s) => s.lines.length)) throw fail('لا توجد كلمات في البرومبت النهائي لتلحينها.', 'no_lyrics');
    const model = req.quality === 'preview' ? c.clip : c.full;
    const headers = { 'content-type': 'application/json', 'x-goog-api-key': c.key };
    const res = await ctx.fetch(`${c.base}/v1beta/interactions`, {
      method: 'POST', signal: ctx.signal, headers,
      body: JSON.stringify({ model, input: lyriaInput(req, ctx.env), response_format: { type: 'audio' } }),
    });
    if (!res.ok) throw lyriaError(res.status, await readError(res));
    let json = await res.json().catch(() => null);
    let audio = extractAudio(json);
    // إن رجعت المهمة قيد التنفيذ نتابعها (احتياطًا لو كان التوليد غير متزامن)
    for (let i = 0; !audio && json && json.id && /progress|running|pending|queued/i.test(String(json.status || json.state || '')) && i < 80; i++) {
      await sleep(3000, ctx.signal);
      const g = await ctx.fetch(`${c.base}/v1beta/interactions/${encodeURIComponent(json.id)}`, { headers, signal: ctx.signal });
      if (!g.ok) throw lyriaError(g.status, await readError(g));
      json = await g.json().catch(() => null);
      audio = extractAudio(json);
    }
    if (!audio) throw fail('Lyria لم يُرجع ملفًا صوتيًا.', 'bad_response');
    const buf = Buffer.from(audio.data, 'base64');
    if (buf.length < 1000) throw fail('ملف Lyria فارغ أو تالف.', 'bad_response');
    const wav = /wav/i.test(audio.mime);
    return { kind: 'audio', body: buf, mime: wav ? 'audio/wav' : 'audio/mpeg', ext: wav ? 'wav' : 'mp3', model };
  },
};
