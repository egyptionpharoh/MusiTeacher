// معالجات «مشاركة الألعاب مع الطلاب». تستقبل deps (هوية Firebase + المستخدم + المخزن) لتُختبر بلا Firebase/Mongo.
import { getGame } from '../../data/virtualGames.js';
import { bearerOf, sameOrigin, makeLimiter } from '../virtual-games/guard.js';
import {
  secretOf, bridgeSecretOf, generateCode, normalizeCode, lookupOf, seal, unseal, teacherEntitlement, expiryFor,
  normalizeConfig, currentRelease, releaseAccepts, validateConfig, bridgeAuthorized, linkFor, FAIL_MAX, FAIL_WINDOW_MS,
} from './core.js';

const json = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } });
const nowOf = (deps) => (deps.now ? deps.now() : new Date());
const secs = (d) => Math.floor(new Date(d).getTime() / 1000);
const shareable = (g) => !!g && g.status === 'available';

async function teacherOf(request, deps) {
  const token = bearerOf(request);
  if (!token) return { error: json({ ok: false, error: 'unauthenticated' }, 401) };
  let decoded;
  try { decoded = await deps.verifyIdToken(token); } catch { return { error: json({ ok: false, error: 'unauthenticated' }, 401) }; }
  if (!decoded || !decoded.uid) return { error: json({ ok: false, error: 'unauthenticated' }, 401) };
  const user = await deps.findUser(decoded.uid);
  return { uid: decoded.uid, user, ent: teacherEntitlement(user, nowOf(deps)) };
}

async function configOf(deps) { return normalizeConfig(await deps.store.config.get()); }

/** كتالوج الإصدار الحالي (ما المنشور فعلًا في MusiTeacher Games؟) — يُخزَّن 5 دقائق */
const catalogCache = new Map();
async function catalogOf(release, deps) {
  if (!release) return null;
  const hit = catalogCache.get(release.url);
  if (hit && Date.now() - hit.t < 5 * 60 * 1000) return hit.v;
  let v = null;
  try {
    const f = deps.fetch || globalThis.fetch;
    const r = await f(`${release.url}/catalog.json`, { signal: AbortSignal.timeout ? AbortSignal.timeout(5000) : undefined });
    if (r.ok) v = await r.json();
  } catch { v = null; }
  catalogCache.set(release.url, { t: Date.now(), v });
  return v;
}

function shareView(doc, secret, release, catalog) {
  if (!doc) return null;
  const inCat = catalog && Array.isArray(catalog.games) ? catalog.games.find((g) => g.id === doc.gameId) : undefined;
  return {
    id: String(doc._id), gameId: doc.gameId, code: unseal(doc.enc, secret), createdAt: doc.createdAt, expiresAt: doc.expiresAt,
    uses: doc.uses || 0, lastUsedAt: doc.lastUsedAt || null, link: linkFor(release, doc.gameId),
    studentVersion: inCat ? { version: inCat.version, updatedAt: inCat.updatedAt } : null,
    studentReady: catalog ? !!inCat : null,
  };
}

// =====================================================================
//  المعلم: POST /api/student-games/share  { gameId, action: 'get'|'create'|'renew'|'revoke', days? }
//          GET  /api/student-games/share   → كل رموزي النشطة
// =====================================================================
export function makeShareHandlers(deps) {
  const limit = makeLimiter(40, 10 * 60 * 1000);
  async function create(uid, ent, gameId, days, secret) {
    const now = nowOf(deps);
    await deps.store.shares.revokeActive(uid, gameId, now);
    for (let i = 0; i < 12; i++) {                         // رمز فريد لكل لعبة (تكرار نادر جدًا → نعيد التوليد)
      const code = generateCode();
      const doc = { teacherUid: uid, gameId, lookup: lookupOf(gameId, code, secret), enc: seal(code, secret), createdAt: now,
        expiresAt: expiryFor(ent, days, now), revokedAt: null, uses: 0, lastUsedAt: null };
      doc.purgeAt = new Date(doc.expiresAt.getTime() + 30 * 864e5);
      const saved = await deps.store.shares.insert(doc);
      if (saved) return saved;
    }
    throw new Error('code-space');
  }
  async function POST(request) {
    try {
      if (!sameOrigin(request)) return json({ ok: false, error: 'origin' }, 403);
      const secret = secretOf(deps.env); if (!secret) return json({ ok: false, error: 'server-not-configured' }, 503);
      const t = await teacherOf(request, deps); if (t.error) return t.error;
      if (!t.ent.ok) return json({ ok: false, error: 'forbidden' }, 403);
      if (!limit(t.uid)) return json({ ok: false, error: 'rate-limited' }, 429);
      let body; try { body = await request.json(); } catch { return json({ ok: false, error: 'bad-request' }, 400); }
      const game = getGame(body && body.gameId);
      if (!shareable(game)) return json({ ok: false, error: 'not-found' }, 404);
      const cfg = await configOf(deps), release = currentRelease(cfg);
      const action = body.action || 'get';
      const now = nowOf(deps);
      let doc = await deps.store.shares.active(t.uid, game.id, now);
      if (action === 'revoke') { if (doc) await deps.store.shares.revoke(doc._id, t.uid, now); doc = null; }
      else if (action === 'create' || action === 'renew' || (action === 'get' && !doc && body.autoCreate !== false)) {
        doc = await create(t.uid, t.ent, game.id, body.days, secret);
      }
      const catalog = await catalogOf(release, deps);
      return json({ ok: true, game: { id: game.id, title: game.title }, release: release ? { id: release.id, url: release.url } : null,
        link: linkFor(release, game.id), share: shareView(doc, secret, release, catalog),
        subscriptionEnd: t.ent.end || null });
    } catch (e) {
      console.error('[student-games/share]', e && e.message);
      return json({ ok: false, error: 'server-error' }, 500);
    }
  }
  async function GET(request) {
    try {
      const secret = secretOf(deps.env); if (!secret) return json({ ok: false, error: 'server-not-configured' }, 503);
      const t = await teacherOf(request, deps); if (t.error) return t.error;
      if (!t.ent.ok) return json({ ok: false, error: 'forbidden' }, 403);
      const cfg = await configOf(deps), release = currentRelease(cfg), catalog = await catalogOf(release, deps);
      const list = await deps.store.shares.list(t.uid, nowOf(deps));
      return json({ ok: true, release: release ? { id: release.id, url: release.url } : null, admin: !!t.ent.admin,
        shares: list.map((d) => ({ ...shareView(d, secret, release, catalog), title: (getGame(d.gameId) || {}).title || d.gameId })),
        catalog: catalog ? catalog.games : null });
    } catch (e) {
      console.error('[student-games/share:list]', e && e.message);
      return json({ ok: false, error: 'server-error' }, 500);
    }
  }
  return { GET, POST };
}

// =====================================================================
//  خادم MusiTeacher Games ← هنا فقط (بسرّ مشترك). المتصفح لا يصل إلى هذين المسارين أبدًا.
//  POST /api/student-games/verify { gameId, code, client, release }
//  POST /api/student-games/check  { gameId, sid, release }
// =====================================================================
export function makeBridgeHandlers(deps) {
  async function guard(request) {
    const bs = bridgeSecretOf(deps.env), secret = secretOf(deps.env);
    if (!bs || !secret) return { error: json({ ok: false, error: 'not-configured' }, 503) };
    if (!bridgeAuthorized(request.headers.get('x-mtg-bridge'), bs)) return { error: json({ ok: false, error: 'forbidden' }, 401) };
    let body; try { body = await request.json(); } catch { return { error: json({ ok: false, error: 'bad-request' }, 400) }; }
    const cfg = await configOf(deps);
    if (!releaseAccepts(cfg, String(body.release || ''), nowOf(deps))) return { error: json({ ok: false, error: 'release-stopped' }) };
    return { body, secret };
  }
  /** هل المشاركة ما زالت صالحة الآن؟ (لم تُلغَ، لم تنتهِ، والمعلم ما زال مشتركًا) */
  async function validity(doc, gameId) {
    const now = nowOf(deps);
    if (!doc || doc.gameId !== gameId || doc.revokedAt) return { ok: false, error: 'invalid' };
    if (new Date(doc.expiresAt) <= now) return { ok: false, error: 'expired' };
    const ent = teacherEntitlement(await deps.findUser(doc.teacherUid), now);
    if (!ent.ok) return { ok: false, error: 'expired' };
    const exp = ent.end && ent.end < new Date(doc.expiresAt) ? ent.end : new Date(doc.expiresAt);
    return { ok: true, exp: secs(exp) };
  }
  async function verify(request) {
    try {
      const g = await guard(request); if (g.error) return g.error;
      const { body, secret } = g, now = nowOf(deps);
      const game = getGame(body.gameId);
      if (!shareable(game)) return json({ ok: false, error: 'unavailable' });
      const client = String(body.client || 'unknown').slice(0, 64);
      if ((await deps.store.attempts.fails(client, now, FAIL_WINDOW_MS)) >= FAIL_MAX) return json({ ok: false, error: 'rate-limited' });
      const code = normalizeCode(body.code);
      const doc = code ? await deps.store.shares.byLookup(lookupOf(game.id, code, secret)) : null;
      const v = await validity(doc, game.id);
      if (!v.ok) { if (v.error === 'invalid') await deps.store.attempts.fail(client, now, FAIL_WINDOW_MS); return json({ ok: false, error: v.error }); }
      await deps.store.shares.touch(doc._id, now);
      return json({ ok: true, sid: String(doc._id), exp: v.exp });
    } catch (e) {
      console.error('[student-games/verify]', e && e.message);
      return json({ ok: false, error: 'server-error' }, 500);
    }
  }
  async function check(request) {
    try {
      const g = await guard(request); if (g.error) return g.error;
      const doc = await deps.store.shares.byId(String(g.body.sid || ''));
      return json(await validity(doc, String(g.body.gameId || '')));
    } catch (e) {
      console.error('[student-games/check]', e && e.message);
      return json({ ok: false, error: 'server-error' }, 500);
    }
  }
  return { verify, check };
}

// =====================================================================
//  المدير: GET/POST /api/student-games/config — الإصدارات الفصلية والعنوان الحالي (إعداد مركزي واحد)
// =====================================================================
export function makeConfigHandlers(deps) {
  async function admin(request) {
    const t = await teacherOf(request, deps); if (t.error) return t;
    if (!t.ent.ok || !t.ent.admin) return { error: json({ ok: false, error: 'forbidden' }, 403) };
    return t;
  }
  async function GET(request) {
    try { const a = await admin(request); if (a.error) return a.error; return json({ ok: true, config: await configOf(deps) }); }
    catch (e) { console.error('[student-games/config]', e && e.message); return json({ ok: false, error: 'server-error' }, 500); }
  }
  async function POST(request) {
    try {
      if (!sameOrigin(request)) return json({ ok: false, error: 'origin' }, 403);
      const a = await admin(request); if (a.error) return a.error;
      let body; try { body = await request.json(); } catch { return json({ ok: false, error: 'bad-request' }, 400); }
      const v = validateConfig(body);
      if (!v.ok) return json({ ok: false, error: v.error }, 400);
      await deps.store.config.set(v.config);
      catalogCache.clear();
      return json({ ok: true, config: normalizeConfig(v.config) });
    } catch (e) { console.error('[student-games/config:set]', e && e.message); return json({ ok: false, error: 'server-error' }, 500); }
  }
  return { GET, POST };
}
