// 🎙️ ElevenLabs Music — محرك رسمي: يغني الكلمات (بأي لغة) ويولد موسيقى بدون غناء.
// التوثيق: POST https://api.elevenlabs.io/v1/music  (composition_plan أو prompt) — المفتاح في الهيدر xi-api-key.
// الأغنية تُرسل «خطة أقسام»: كل قسم بكلماته الأصلية حرفيًا + إشارات الأداء + مدة محسوبة.
import { parseTaggedLyrics } from '../../core/tagParser.js';
import { fail, ascii, clip, splitStyles, readError, maxSeconds } from './util.js';

const MIN_CHUNK = 3000, MAX_CHUNK = 120000, MAX_CHUNKS = 30, MAX_LINES = 30, MAX_LINE = 200, MAX_STYLES = 50;

const cfg = (env) => ({
  key: env.ELEVENLABS_API_KEY || '',
  base: (env.ELEVENLABS_BASE_URL || 'https://api.elevenlabs.io').replace(/\/$/, ''),
  model: env.MF_ELEVENLABS_MODEL || 'music_v2_5',
  format: env.MF_ELEVENLABS_FORMAT || 'mp3_44100_128',
});

function secondsPerLine(choices = {}) {
  const bpm = Number.isFinite(+choices.bpm) && +choices.bpm > 0 ? +choices.bpm : null;
  if (bpm) return Math.max(3, Math.min(7, (2 * 4 * 60) / bpm)); // سطر ≈ مازورتان
  return choices.tempo === 'slow' ? 5.5 : choices.tempo === 'fast' ? 3.6 : 4.5;
}
const introSeconds = (choices = {}) => ({ long: 18, sudden: 3, build: 14, percussive: 10, vocal: 10, solo: 14 }[choices.intro] || 10);

function wrapLine(line) {
  if (line.length <= MAX_LINE) return [line];
  const out = []; let rest = line;
  while (rest.length > MAX_LINE) { let cut = rest.lastIndexOf(' ', MAX_LINE); if (cut < 40) cut = MAX_LINE; out.push(rest.slice(0, cut).trim()); rest = rest.slice(cut).trim(); }
  if (rest) out.push(rest);
  return out;
}

/** الأجزاء: اسم + سطور + إشارات + مدة، مع احترام كل حدود ElevenLabs والحد الأقصى للمنصة */
export function buildParts(req, env = {}) {
  const parsed = parseTaggedLyrics(req.output.lyrics);
  if (!parsed.some((s) => s.lines.length)) throw fail('لا توجد كلمات في البرومبت النهائي لتلحينها.', 'no_lyrics');
  const spl = secondsPerLine(req.choices);
  let parts = [];
  for (const s of parsed) {
    const lines = s.lines.flatMap(wrapLine);
    if (!lines.length) {
      const n = s.name.toLowerCase();
      const secs = /intro/.test(n) ? introSeconds(req.choices) : /outro|ending/.test(n) ? 10 : 8;
      parts.push({ name: s.name, lines: [], cues: s.cues, ms: secs * 1000, instrumental: true });
      continue;
    }
    for (let i = 0; i < lines.length; i += MAX_LINES) {
      const chunk = lines.slice(i, i + MAX_LINES);
      parts.push({ name: i ? `${s.name} (cont.)` : s.name, lines: chunk, cues: s.cues, ms: Math.round((chunk.length * spl + 2) * 1000), instrumental: false });
    }
  }
  while (parts.length > MAX_CHUNKS) {
    const i = parts.findIndex((p, k) => p.instrumental && k > 0 && k < parts.length - 1);
    if (i >= 0) parts.splice(i, 1); else parts = parts.slice(0, MAX_CHUNKS);
  }
  if (req.quality === 'preview') {
    // معاينة سريعة (~30 ثانية): أول الأقسام حتى نصل لنصف دقيقة تقريبًا
    const keep = []; let t = 0;
    for (const p of parts) { if (t >= 25000 && keep.some((x) => !x.instrumental)) break; keep.push(p); t += p.ms; }
    parts = keep;
  }
  parts.forEach((p) => { p.ms = Math.max(MIN_CHUNK, Math.min(MAX_CHUNK, p.ms)); });
  const cap = (req.quality === 'preview' ? 40 : maxSeconds(env)) * 1000;
  const total = parts.reduce((a, p) => a + p.ms, 0);
  if (total > cap) { const k = cap / total; parts.forEach((p) => { p.ms = Math.max(MIN_CHUNK, Math.floor(p.ms * k)); }); }
  return parts;
}

export function planV2(req, parts) {
  const global = splitStyles(req.output.style, MAX_STYLES);
  if (global.length < 3) global.push('high quality studio production', 'clear lead vocal', 'professional mix');
  const negative = splitStyles(req.output.exclude, 20);
  const compact = global.slice(0, 10);
  return {
    chunks: parts.map((p, i) => {
      const pos = [...new Set([...(i === 0 ? global : compact), ...p.cues])].slice(0, MAX_STYLES);
      const neg = [...negative];
      if (p.instrumental) {
        if (!neg.some((x) => /^vocals?$/i.test(x))) neg.push('vocals');
        return { text: `[${p.name}]` + (p.cues.length ? ` {${p.cues.join(', ').slice(0, 120)}}` : ' {instrumental}'), duration_ms: p.ms, positive_styles: pos, negative_styles: neg.slice(0, MAX_STYLES), context_adherence: 'high' };
      }
      return { text: `[${p.name}]\n${p.lines.join('\n')}`, duration_ms: p.ms, positive_styles: pos, negative_styles: neg.slice(0, MAX_STYLES), context_adherence: 'high' };
    }),
  };
}

export function planV1(req, parts) {
  const global = splitStyles(req.output.style, MAX_STYLES);
  return {
    positive_global_styles: global.length ? global : ['high quality studio production'],
    negative_global_styles: splitStyles(req.output.exclude, 20),
    sections: parts.map((p) => ({ section_name: p.name.slice(0, 100), positive_local_styles: p.cues.slice(0, MAX_STYLES), negative_local_styles: p.instrumental ? ['vocals'] : [], duration_ms: p.ms, lines: p.lines })),
  };
}

export function instrumentalPrompt(req) {
  const style = ascii(req.output.style).replace(/^-+\s*STYLE\s*-+/i, '').trim();
  const parts = parseTaggedLyrics(req.output.lyrics).map((s) => (s.cues.length ? `${s.name}: ${s.cues.join(', ')}` : s.name));
  let p = `Instrumental film score / soundtrack, no vocals. ${style}`;
  if (parts.length) p += `. Structure: ${parts.join(' -> ')}`;
  const ex = splitStyles(req.output.exclude, 20);
  if (ex.length) p += `. Avoid: ${ex.join(', ')}`;
  return p.slice(0, 2000);
}

function elevenError(status, detail) {
  if (status === 401) return fail('مفتاح ElevenLabs غير صالح أو منتهي.', 'auth');
  if (status === 402 || (status === 403 && /quota|credit|limit|plan|subscription/i.test(detail))) return fail('رصيد ElevenLabs لا يكفي أو خطتك لا تشمل توليد الموسيقى.', 'quota');
  if (status === 429) return fail('ElevenLabs مشغول الآن (طلبات كثيرة). حاول بعد قليل.', 'busy');
  if (status === 400 || status === 422) {
    if (/copyright|artist|protected|bad_prompt|rejected|violat/i.test(detail)) return fail('رفض ElevenLabs الطلب (ربما يحتوي الوصف على اسم فنان أو عمل محمي). عدّل البرومبت وحاول.', 'rejected', { detail });
    return fail('بيانات غير مقبولة لدى ElevenLabs: ' + String(detail).slice(0, 200), 'invalid', { detail });
  }
  return fail(`خطأ من ElevenLabs (${status}).`, 'http_' + status, { detail });
}

async function call(c, body, ctx) {
  const res = await ctx.fetch(`${c.base}/v1/music?output_format=${encodeURIComponent(c.format)}`, {
    method: 'POST', signal: ctx.signal,
    headers: { 'content-type': 'application/json', 'xi-api-key': c.key, accept: 'audio/mpeg' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw elevenError(res.status, await readError(res));
  const type = res.headers.get('content-type') || '';
  if (!/audio|octet-stream/i.test(type)) throw fail('رد ElevenLabs ليس ملفًا صوتيًا.', 'bad_response');
  return res;
}

export default {
  id: 'elevenlabs',
  label: 'ElevenLabs Music',
  official: true,
  vocals: true,
  instrumental: true,
  preview: true,
  note_ar: 'محرك رسمي يغني الكلمات بأي لغة ويولد موسيقى تصويرية؛ يحتاج خطة مدفوعة تتيح Music API.',
  configured: (env) => !!cfg(env).key,
  model: (env) => cfg(env).model,
  async generate(req, ctx) {
    const c = cfg(ctx.env);
    const isV2 = /^music_v2/.test(c.model);
    let body, plannedSec = null;
    if (req.mode === 'instrumental') {
      const sec = req.quality === 'preview' ? 30 : Math.min(req.durationSec || 60, maxSeconds(ctx.env));
      body = { prompt: instrumentalPrompt(req), music_length_ms: Math.max(3000, Math.round(sec * 1000)), model_id: c.model, force_instrumental: true };
      plannedSec = sec;
    } else {
      const parts = buildParts(req, ctx.env);
      plannedSec = Math.round(parts.reduce((a, p) => a + p.ms, 0) / 1000);
      body = { composition_plan: isV2 ? planV2(req, parts) : planV1(req, parts), model_id: c.model };
    }
    let res, model = c.model;
    try {
      res = await call(c, body, ctx);
    } catch (e) {
      // بعض الحسابات لا تتيح نسخ v2: إعادة محاولة واحدة بصيغة v1 الموثقة
      if (isV2 && e.code === 'invalid' && /model/i.test(e.detail || '') && req.mode !== 'instrumental') {
        model = 'music_v1';
        res = await call(c, { composition_plan: planV1(req, buildParts(req, ctx.env)), model_id: 'music_v1' }, ctx);
      } else throw e;
    }
    return { kind: 'audio', body: res.body, mime: 'audio/mpeg', ext: 'mp3', model, plannedSec };
  },
};

export const _internal = { buildParts, planV1, planV2, instrumentalPrompt, clip };
