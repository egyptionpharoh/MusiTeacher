// 🧪 Replicate MusicGen (Meta) — موسيقى قصيرة بدون غناء فقط (حتى 30 ثانية). محرك تجريبي اختياري.
// REST: POST https://api.replicate.com/v1/predictions  (Authorization: Bearer REPLICATE_API_TOKEN, Prefer: wait)
import { fail, readError, sleep, directionText } from './util.js';

const cfg = (env) => ({
  token: env.REPLICATE_API_TOKEN || '',
  base: (env.MF_REPLICATE_BASE_URL || 'https://api.replicate.com').replace(/\/$/, ''),
  version: env.MF_REPLICATE_MUSICGEN_VERSION || '7a76a8258b299f66db533097c0f2c2663f7e52997f62ae939a3f338f0c39f04d',
});

export default {
  id: 'replicate',
  label: 'MusicGen (Replicate)',
  official: true,
  vocals: false,
  instrumental: true,
  preview: true,
  note_ar: 'تجريبي: موسيقى بدون غناء حتى 30 ثانية، وجودته أقل من ElevenLabs وLyria.',
  // التوكن نفسه يستخدمه استوديو فصل الصوت؛ MusicGen يحتاج تفعيلًا صريحًا
  configured: (env) => !!cfg(env).token && env.MF_MUSICGEN_ENABLED === 'true',
  model: () => 'MusicGen melody',
  async generate(req, ctx) {
    if (req.mode !== 'instrumental') throw fail('MusicGen لا يغني؛ يُستخدم للموسيقى التصويرية فقط.', 'unsupported');
    const c = cfg(ctx.env);
    const { style } = directionText(req);
    const headers = { 'content-type': 'application/json', authorization: `Bearer ${c.token}`, prefer: 'wait=60' };
    const res = await ctx.fetch(`${c.base}/v1/predictions`, {
      method: 'POST', signal: ctx.signal, headers,
      body: JSON.stringify({ version: c.version, input: { prompt: style.slice(0, 500), duration: Math.max(5, Math.min(30, Math.round(req.quality === 'preview' ? 15 : req.durationSec || 30))), model_version: 'melody', output_format: 'mp3' } }),
    });
    if (res.status === 401) throw fail('مفتاح Replicate غير صالح.', 'auth');
    if (res.status === 402) throw fail('رصيد Replicate لا يكفي.', 'quota');
    if (!res.ok) throw fail(`خطأ من Replicate (${res.status}).`, 'http_' + res.status, { detail: await readError(res) });
    let p = await res.json();
    for (let i = 0; p && !['succeeded', 'failed', 'canceled'].includes(p.status) && p.urls && p.urls.get && i < 100; i++) {
      await sleep(2500, ctx.signal);
      const g = await ctx.fetch(p.urls.get, { headers: { authorization: `Bearer ${c.token}` }, signal: ctx.signal });
      p = await g.json();
    }
    if (!p || p.status !== 'succeeded') throw fail('فشل MusicGen في التوليد.', 'provider_error', { detail: p && p.error });
    const url = typeof p.output === 'string' ? p.output : Array.isArray(p.output) ? p.output[0] : null;
    if (!url) throw fail('Replicate لم يُرجع رابطًا صوتيًا.', 'bad_response');
    return { kind: 'urls', tracks: [{ url: String(url), ext: 'mp3' }], model: 'MusicGen melody' };
  },
};
