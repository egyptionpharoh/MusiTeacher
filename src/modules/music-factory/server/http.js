// =====================================================================
// 🌐 معالج HTTP واحد لكل مسارات «مصنع الألحان» (بمعايير Web Request/Response)
// لا يعرف شيئًا عن MusiTeacher: التحقق من المستخدم يُمرَّر من الخارج (authorize)،
// لذلك يمكن تشغيله لاحقًا في موقع مستقل أو خادم Express بدون تعديل.
//   GET  status    → المحركات المُعدّة (نعم/لا فقط، بدون أي مفتاح)
//   POST analyze   → تحليل الكلمات واقتراح الإعدادات
//   POST prompt    → برومبت احترافي (3 بدائل)
//   POST refine    → تعديل محدد على البرومبت
//   POST generate  → توليد الصوت الفعلي (يعيد ملف الصوت نفسه أو روابط)
// =====================================================================
import { analyze, buildPrompt, refine, brainStatus } from './brain.js';
import { audioStatus, generateAudio } from './engines/index.js';
import { normalizeProject } from '../core/project.js';

const json = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

function makeLimiter(max, windowMs) {
  const hits = new Map();
  return (key) => {
    const t = Date.now(), arr = (hits.get(key) || []).filter((x) => t - x < windowMs);
    arr.push(t); hits.set(key, arr);
    if (hits.size > 5000) for (const [k, v] of hits) if (!v.length || t - v[v.length - 1] > windowMs) hits.delete(k);
    return arr.length <= max;
  };
}

function normalizeGenerate(body) {
  const b = body && typeof body === 'object' ? body : {};
  const o = b.output && typeof b.output === 'object' ? b.output : {};
  const project = normalizeProject(b.project);
  const s = (v, n) => (typeof v === 'string' ? v.slice(0, n) : '');
  return {
    mode: b.mode === 'instrumental' || project.mode === 'instrumental' ? 'instrumental' : 'song',
    engine: typeof b.engine === 'string' ? b.engine.slice(0, 40) : 'auto',
    quality: b.quality === 'preview' ? 'preview' : 'full',
    allowFallback: b.allowFallback !== false,
    output: { style: s(o.style, 2000), lyrics: s(o.lyrics, 12000), title: s(o.title, 120), exclude: s(o.exclude, 400) },
    choices: { bpm: project.choices.bpm, tempo: project.choices.tempo, intro: project.choices.intro, outro: project.choices.outro },
    durationSec: Math.max(10, Math.min(600, Math.round(+b.durationSec || project.choices.durationSec || 60))),
  };
}

function validateGenerate(req) {
  const style = String(req.output.style || '').replace(/[^\x20-\x7E]/g, ' ').trim();
  if (style.length < 10) return 'لا يوجد وصف أسلوب (Style) صالح. ولّد البرومبت أولًا.';
  if (req.mode === 'song' && !String(req.output.lyrics || '').split('\n').some((l) => l.trim() && !/^\s*\[.*\]\s*$/.test(l))) return 'لا توجد كلمات في البرومبت النهائي لتلحينها.';
  return null;
}

const safeName = (t, ext) => (String(t || 'music-factory').replace(/[\\/:*?"<>|\r\n]+/g, ' ').trim().slice(0, 60) || 'music-factory') + '.' + ext;

/**
 * deps: {
 *   authorize(request) → { ok:true, userId } | { ok:false, status, error }
 *   env?: object (افتراضيًا process.env)
 *   fetchImpl?: fetch
 * }
 */
export function createMusicFactoryHandler(deps) {
  const env = deps.env || process.env;
  const brainLimit = makeLimiter(parseInt(env.MF_BRAIN_RATE_LIMIT || '30', 10) || 30, 10 * 60 * 1000);
  const audioLimit = makeLimiter(parseInt(env.MF_AUDIO_RATE_LIMIT || '6', 10) || 6, 10 * 60 * 1000);
  let running = 0;

  async function guarded(request, limiter) {
    const a = await deps.authorize(request);
    if (!a || !a.ok) return { res: json({ ok: false, error: (a && a.error) || 'غير مصرح.', code: (a && a.code) || 'unauthenticated' }, (a && a.status) || 401) };
    if (limiter && !limiter(a.userId)) return { res: json({ ok: false, error: 'طلبات كثيرة في وقت قصير. انتظر بضع دقائق ثم حاول.', code: 'rate-limited' }, 429) };
    let body;
    try { body = await request.json(); } catch { return { res: json({ ok: false, error: 'طلب غير صالح.' }, 400) }; }
    return { user: a, body };
  }

  return async function handle(request, action) {
    try {
      if (request.method === 'GET' && action === 'status') {
        const a = await deps.authorize(request);
        if (!a || !a.ok) return json({ ok: false, error: (a && a.error) || 'غير مصرح.', code: (a && a.code) || 'unauthenticated' }, (a && a.status) || 401);
        return json({ ok: true, audio: audioStatus(env), brain: brainStatus(env) });
      }
      if (request.method !== 'POST') return json({ ok: false, error: 'المسار غير موجود.' }, 404);

      if (action === 'analyze' || action === 'prompt' || action === 'refine') {
        const g = await guarded(request, brainLimit);
        if (g.res) return g.res;
        const b = g.body;
        const out = action === 'analyze' ? await analyze(b.project, env)
          : action === 'prompt' ? await buildPrompt(b.project, b.analysis || null, b.variants, env)
            : await refine(b.project, b.current, b.instruction, env);
        return json(out, out.ok === false ? out.status || 500 : 200);
      }

      if (action === 'generate') {
        const g = await guarded(request, audioLimit);
        if (g.res) return g.res;
        const req = normalizeGenerate(g.body);
        const bad = validateGenerate(req);
        if (bad) return json({ ok: false, error: bad }, 400);
        const maxConc = parseInt(env.MF_AUDIO_MAX_CONCURRENT || '3', 10) || 3;
        if (running >= maxConc) return json({ ok: false, error: 'الخادم يولّد مقاطع أخرى الآن. انتظر دقيقة ثم حاول.', code: 'busy' }, 429);
        running++;
        let r;
        try { r = await generateAudio(req, { env, fetchImpl: deps.fetchImpl || fetch }); } finally { running--; }
        if (!r.ok) return json({ ok: false, error: r.error, attempts: r.attempts || [], notConfigured: !!r.notConfigured }, r.status || 502);
        const meta = { engine: r.engine, label: r.label, model: r.model, official: r.official, plannedSec: r.plannedSec || null, attempts: r.attempts, mode: req.mode, quality: req.quality, title: req.output.title };
        if (r.kind === 'audio') {
          return new Response(r.body, {
            status: 200,
            headers: {
              'Content-Type': r.mime,
              'Cache-Control': 'no-store',
              'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(safeName(req.output.title, r.ext))}`,
              'X-MF-Meta': Buffer.from(JSON.stringify(meta)).toString('base64url'),
            },
          });
        }
        return json({ ok: true, ...meta, tracks: r.tracks });
      }
      return json({ ok: false, error: 'المسار غير موجود.' }, 404);
    } catch (e) {
      console.error('[music-factory] unexpected error:', e && e.message ? e.message : e);
      return json({ ok: false, error: 'حدث خطأ داخلي في مصنع الألحان.' }, 500);
    }
  };
}

export const _internal = { normalizeGenerate, validateGenerate };
