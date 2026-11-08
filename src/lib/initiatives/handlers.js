// منطق الخادم لـ«مبادرات تعليمية» (قابل للاختبار بحقن الاعتماديات).
//   GET  status                → هل الذكاء الاصطناعي والمزامنة متاحان؟ (لا يكشف أي سر)
//   POST ideas | develop | section → توليد (مستخدم مسجّل ومشترك)
//   GET/POST/DELETE sync       → نسخة «مبادراتي» في حساب المعلم (اختيارية؛ مستند واحد لكل معلم في MongoDB)
import { entitlementOf, bearerOf, sameOrigin, makeLimiter } from '../virtual-games/guard.js';
import { SYSTEM, ideasPrompt, developPrompt, sectionPrompt, SECTIONS } from './prompts.js';
import { normalizeInitiative, normalizeProject, dedupe, str, list, int } from './schema.js';
import { libraryInitiatives } from './catalog.js';
import { TWEAKS } from './taxonomy.js';

const json = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
const fail = (error, status, extra = {}) => json({ ok: false, error, ...extra }, status);
const MAX_BODY = 96 * 1024;
const MAX_SYNC = 900 * 1024;
const AI_HTTP = { 'not-configured': 503, 'rate-limited': 429, timeout: 504, auth: 502, 'bad-output': 502, blocked: 422, upstream: 502, network: 502, 'bad-request': 502 };

function cleanOptions(o) {
  const r = o && typeof o === 'object' ? o : {};
  return { domain: str(r.domain, 20), stage: str(r.stage, 10), audience: str(r.audience, 120), size: str(r.size, 10), weeks: int(r.weeks, 0, 40, 0), cost: str(r.cost, 10), participants: int(r.participants, 0, 5000, 0), nature: str(r.nature, 20) };
}
/** الأسابيع في الخطة = مجموع المراحل (لا نثق بالنموذج في الحساب). */
function fixWeeks(i) { const w = i.phases.reduce((s, p) => s + p.w, 0); return w ? { ...i, weeks: w } : i; }

export function makeHandlers(deps) {
  const log = deps.log || ((where, e) => console.error('[initiatives]', where, e && e.message));
  const now = deps.now || (() => new Date());
  const t = () => now().getTime();
  const burst = makeLimiter(deps.burstMax || 8, 60 * 1000, t);
  const hourly = makeLimiter(deps.hourlyMax || 60, 60 * 60 * 1000, t);
  const syncLimit = makeLimiter(deps.syncMax || 60, 10 * 60 * 1000, t);
  const syncOn = () => !!deps.store;

  async function authenticate(request) {
    if (!sameOrigin(request)) return { res: fail('origin', 403) };
    const token = bearerOf(request);
    if (!token) return { res: fail('unauthenticated', 401) };
    let decoded;
    try { decoded = await deps.verifyIdToken(token); }
    catch (e) {
      const m = e && e.message;
      if (m === 'no-project-id') return { res: fail('server-not-configured', 503) };
      if (m && m.startsWith('jwks')) { log('auth', e); return { res: fail('server-error', 502) }; }
      return { res: fail('unauthenticated', 401) };
    }
    if (!decoded || !decoded.uid) return { res: fail('unauthenticated', 401) };
    let user;
    try { user = await deps.findUser(decoded.uid); } catch (e) { log('db', e); return { res: fail('db-error', 503) }; }
    if (!entitlementOf(user, now()).ok) return { res: fail('forbidden', 403) };
    return { uid: decoded.uid };
  }
  async function readJSON(request, max = MAX_BODY) {
    if (Number(request.headers.get('content-length') || 0) > max) return { res: fail('too-large', 413) };
    let text; try { text = await request.text(); } catch { return { res: fail('bad-request', 400) }; }
    if (text.length > max) return { res: fail('too-large', 413) };
    try { return { body: JSON.parse(text || '{}') }; } catch { return { res: fail('bad-request', 400) }; }
  }
  const generation = (where, fn) => async (request) => {
    try {
      if (!deps.ai || !deps.ai.configured()) return fail('ai-not-configured', 503);
      const a = await authenticate(request); if (a.res) return a.res;
      if (!burst(a.uid) || !hourly(a.uid)) return fail('rate-limited', 429);
      const b = await readJSON(request); if (b.res) return b.res;
      return await fn(b.body || {}, a);
    } catch (e) {
      log(where, e);
      if (e && e.code && AI_HTTP[e.code]) return fail(`ai-${e.code}`, AI_HTTP[e.code]);
      return fail('server-error', 500);
    }
  };
  const ask = (prompt, temperature) => deps.ai.generateJSON({ system: SYSTEM, prompt, temperature });

  // ------------------------------------------------------------- ابتكر لي مبادرة
  const ideas = generation('ideas', async (body) => {
    const count = Math.min(4, Math.max(1, Math.round(Number(body.count) || 3)));
    const libTitles = libraryInitiatives().map((i) => i.title);
    const exclude = [...list(body.exclude, 80, 160), ...libTitles];
    const { data, model } = await ask(ideasPrompt({ request: str(body.request, 400), options: cleanOptions(body.options), exclude, count }), 1.0);
    const raw = Array.isArray(data) ? data : (data && Array.isArray(data.ideas) ? data.ideas : []);
    let out = raw.map((r) => normalizeInitiative({ ...r, phases: [], team: [], kpis: [] }, 'ai')).filter(Boolean)
      .map((i, n) => ({ ...i, id: `ai-${t().toString(36)}-${n}`, featured: false, brief: true }));
    out = dedupe(out, exclude);
    if (!out.length) return fail('ai-empty', 502);
    return json({ ok: true, ideas: out.slice(0, count), model });
  });

  // ------------------------------------------------------------- طوّر المبادرة
  const develop = generation('develop', async (body) => {
    const base = normalizeInitiative(body.initiative, 'mine');
    if (!base) return fail('bad-request', 400);
    const tweaks = list(body.tweaks, 9, 120).filter((x) => TWEAKS.includes(x));
    const { data, model } = await ask(developPrompt({ initiative: base, options: cleanOptions(body.options), tweaks, instruction: str(body.instruction, 400) }), 0.7);
    const plan = normalizeInitiative({ ...(data && typeof data === 'object' ? data : {}), id: base.id }, 'mine');
    if (!plan || plan.phases.length < 2 || !plan.objectives.length || !plan.kpis.length) return fail('ai-bad-output', 502);
    return json({ ok: true, plan: fixWeeks(plan), model });
  });

  // ------------------------------------------------------------- جزء واحد
  const section = generation('section', async (body) => {
    const key = str(body.section, 20);
    const spec = SECTIONS[key];
    if (!spec) return fail('bad-section', 400);
    const base = normalizeInitiative(body.initiative, 'mine');
    if (!base) return fail('bad-request', 400);
    const { data, model } = await ask(sectionPrompt({ initiative: base, section: key, instruction: str(body.instruction, 300) }), 0.9);
    const d = data && typeof data === 'object' ? data : {};
    const patch = {}; for (const k of spec.keys) if (d[k] !== undefined) patch[k] = d[k];
    if (!Object.keys(patch).length) return fail('ai-bad-output', 502);
    const merged = normalizeInitiative({ ...base, ...patch, id: base.id }, 'mine');
    for (const k of spec.keys) {
      const v = merged[k];
      if ((Array.isArray(v) && !v.length) || v === '') return fail('ai-bad-output', 502);
    }
    const plan = key === 'phases' || key === 'activities' ? fixWeeks(merged) : merged;
    return json({ ok: true, section: key, plan, model });
  });

  // ------------------------------------------------------------- المزامنة مع الحساب
  async function sync(request) {
    try {
      if (!syncOn()) return fail('sync-disabled', 503);
      const a = await authenticate(request); if (a.res) return a.res;
      if (!syncLimit(a.uid)) return fail('rate-limited', 429);
      if (request.method === 'GET') {
        const doc = await deps.store.get(a.uid);
        return json({ ok: true, data: doc ? doc.data : null, updatedAt: doc ? doc.updatedAt : 0 });
      }
      if (request.method === 'DELETE') { await deps.store.remove(a.uid); return json({ ok: true }); }
      if (request.method === 'POST') {
        const b = await readJSON(request, MAX_SYNC); if (b.res) return b.res;
        const d = b.body && b.body.data;
        if (!d || typeof d !== 'object' || !Array.isArray(d.projects) || d.projects.length > 300) return fail('bad-request', 400);
        // نخزن نسخة مطبّعة فقط (بلا شعارات المدارس: تبقى على الجهاز)
        const clean = {
          projects: d.projects.map((p) => normalizeProject(p)).map((p) => ({ ...p, meta: { ...p.meta, logo: '' } })),
          favs: list(d.favs, 300, 80),
          deleted: Object.fromEntries(Object.entries(d.deleted && typeof d.deleted === 'object' ? d.deleted : {}).slice(0, 500).map(([k, v]) => [str(k, 80), int(v, 0, 9e15, 0)])),
        };
        const updatedAt = t();
        await deps.store.put(a.uid, clean, updatedAt);
        return json({ ok: true, updatedAt });
      }
      return fail('method-not-allowed', 405);
    } catch (e) { log('sync', e); return fail('server-error', 500); }
  }

  const status = async () => json({ ok: true, ai: !!(deps.ai && deps.ai.configured()), sync: syncOn(), library: libraryInitiatives().length });
  return { status, ideas, develop, section, sync };
}
