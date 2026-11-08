// منطق الخادم لمساعد الإنماء المهني (قابل للاختبار بحقن الاعتماديات).
// المسارات: GET status — POST ideas | build | section. كل توليد يتطلب مستخدمًا مشتركًا (نفس شرط بقية الأدوات).
import { entitlementOf, bearerOf, sameOrigin, makeLimiter } from '../virtual-games/guard.js';
import { SYSTEM, ideasPrompt, buildPrompt, sectionPrompt, SECTIONS } from './prompts.js';
import { normalizeIdea, normalizeSettings, normalizeWorkshop, dedupeIdeas, str, list } from './schema.js';
import { retime } from './compose.js';
import { libraryIdeas } from './library.js';

const json = (body, status = 200) =>
  Response.json(body, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
const fail = (error, status, extra = {}) => json({ ok: false, error, ...extra }, status);
const MAX_BODY = 64 * 1024;

const AI_HTTP = { 'not-configured': 503, 'rate-limited': 429, timeout: 504, auth: 502, 'bad-output': 502, blocked: 422, upstream: 502, network: 502, 'bad-request': 502 };

export function makeHandlers(deps) {
  const log = deps.log || ((where, e) => console.error('[pd-workshops]', where, e && e.message));
  const now = deps.now || (() => new Date());
  const burst = makeLimiter(deps.burstMax || 8, 60 * 1000, () => now().getTime());
  const hourly = makeLimiter(deps.hourlyMax || 60, 60 * 60 * 1000, () => now().getTime());

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
    try { user = await deps.findUser(decoded.uid); }
    catch (e) { log('db', e); return { res: fail('db-error', 500) }; }
    if (!entitlementOf(user, now()).ok) return { res: fail('forbidden', 403) };
    return { uid: decoded.uid };
  }

  async function readBody(request) {
    const len = Number(request.headers.get('content-length') || 0);
    if (len > MAX_BODY) return { res: fail('too-large', 413) };
    let text;
    try { text = await request.text(); } catch { return { res: fail('bad-request', 400) }; }
    if (text.length > MAX_BODY) return { res: fail('too-large', 413) };
    try { return { body: JSON.parse(text || '{}') }; } catch { return { res: fail('bad-request', 400) }; }
  }

  /** الهيكل المشترك لكل طلب توليد. */
  const generation = (where, fn) => async (request) => {
    try {
      if (!deps.ai || !deps.ai.configured()) return fail('ai-not-configured', 503);
      const a = await authenticate(request);
      if (a.res) return a.res;
      if (!burst(a.uid) || !hourly(a.uid)) return fail('rate-limited', 429);
      const b = await readBody(request);
      if (b.res) return b.res;
      return await fn(b.body || {}, a);
    } catch (e) {
      if (e && e.code && AI_HTTP[e.code]) { log(where, e); return fail(`ai-${e.code}`, AI_HTTP[e.code]); }
      log(where, e);
      return fail('server-error', 500);
    }
  };

  const ask = (prompt, temperature) => deps.ai.generateJSON({ system: SYSTEM, prompt, temperature });

  // ------------------------------------------------------------- الأفكار
  const ideas = generation('ideas', async (body) => {
    const f = body.filters && typeof body.filters === 'object' ? body.filters : {};
    const filters = {
      domain: str(f.domain, 30), spec: str(f.spec, 30), audience: str(f.audience, 30),
      format: str(f.format, 30), level: str(f.level, 30), duration: Number(f.duration) || 0,
    };
    const count = Math.min(4, Math.max(1, Math.round(Number(body.count) || 3)));
    const topic = str(body.topic, 300);
    const libTitles = libraryIdeas().map((i) => i.title);
    const exclude = [...list(body.exclude, 60, 160), ...libTitles];
    const { data, model } = await ask(ideasPrompt({ filters, topic, exclude, count }), body.surprise ? 1.1 : 0.9);
    const raw = Array.isArray(data) ? data : (data && Array.isArray(data.ideas) ? data.ideas : []);
    let out = raw.map((r) => normalizeIdea(r, 'ai')).filter(Boolean)
      .map((i, n) => ({ ...i, id: `ai-${now().getTime().toString(36)}-${n}`, featured: false }));
    out = dedupeIdeas(out, exclude);
    if (!out.length) return fail('ai-empty', 502);
    return json({ ok: true, ideas: out.slice(0, count), model });
  });

  // ------------------------------------------------------------- مشغل كامل
  const build = generation('build', async (body) => {
    const idea = normalizeIdea(body.idea, body.idea && body.idea.source === 'ai' ? 'ai' : 'library');
    if (!idea) return fail('bad-request', 400);
    const settings = normalizeSettings(body.settings);
    const { data, model } = await ask(buildPrompt({ idea, settings }), 0.7);
    const d = data && typeof data === 'object' ? data : {};
    const w = normalizeWorkshop({
      ...d,
      title: d.title || idea.title,
      ideaId: idea.id, domain: idea.domain, format: idea.format, level: idea.level,
      source: idea.source === 'ai' ? 'ai' : 'mixed',
      aiSections: ['all'],
      settings,
      refs: idea.source === 'library' ? idea.refs : [],        // المراجع من المكتبة الموثقة فقط
    });
    if (!w.axes.length || !w.objectives.length) return fail('ai-bad-output', 502);
    return json({ ok: true, workshop: retime(w, settings.duration, settings.style), model });
  });

  // ------------------------------------------------------------- جزء واحد
  const section = generation('section', async (body) => {
    const key = str(body.section, 20);
    if (!SECTIONS[key]) return fail('bad-section', 400);
    const w = normalizeWorkshop(body.workshop);
    const { data, model } = await ask(sectionPrompt({ workshop: w, section: key, instruction: str(body.instruction, 300) }), 0.9);
    const d = data && typeof data === 'object' ? data : {};
    const part = d[key] !== undefined ? d[key] : d;
    let patch;
    if (key === 'objectives') patch = { objectives: part };
    else if (key === 'axes') patch = { axes: Array.isArray(part) ? part : [] };
    else patch = { [key]: { ...w[key], ...(part && typeof part === 'object' && !Array.isArray(part) ? part : {}) } };
    // ندمج القسم الجديد في نسخة الميسّر الحالية ثم نطبّع ونعيد توزيع الوقت
    const timed = retime(normalizeWorkshop({ ...w, ...patch }), w.settings.duration, w.settings.style);
    if ((key === 'axes' || key === 'objectives') && !timed[key].length) return fail('ai-bad-output', 502);
    const aiSections = [...new Set([...timed.aiSections, key])];
    return json({ ok: true, section: key, workshop: { ...timed, aiSections, source: timed.source === 'library' ? 'mixed' : timed.source }, model });
  });

  // ------------------------------------------------------------- الحالة
  const status = async () => json({ ok: true, ai: !!(deps.ai && deps.ai.configured()), library: libraryIdeas().length });

  return { ideas, build, section, status };
}
