// معالجات المسارين: إنشاء جلسة اللعب + تقديم ملفات اللعبة. تستقبل deps كي يمكن اختبارها بدون Firebase/Mongo.
import { getGame } from '../../data/virtualGames.js';
import {
  SESSION_TTL_SEC, cookieName, getSecret, signSession, verifySession, readCookie, buildSetCookie,
  entitlementOf, bearerOf, sameOrigin, looksEmbedded, makeLimiter,
} from './guard.js';
import { gamesRoot, resolveGameFile, fileResponse, securityHeaders } from './serve.js';

const json = (body, status = 200, headers = {}) =>
  Response.json(body, { status, headers: { 'Cache-Control': 'no-store', ...headers } });

const denyPage = (status, msg) => new Response(
  `<!doctype html><meta charset="utf-8"><title>غير مصرح</title><body dir="rtl" style="font-family:sans-serif;padding:2rem;color:#334155">${msg}</body>`,
  { status, headers: securityHeaders({ 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }) });

const isProd = () => process.env.NODE_ENV === 'production';

/** POST /api/virtual-games/session  { gameId }  + Authorization: Bearer <Firebase ID token> */
export function makeSessionHandler(deps) {
  const limit = makeLimiter(30, 10 * 60 * 1000);
  return async function POST(request) {
    if (!sameOrigin(request)) return json({ ok: false, error: 'origin' }, 403);
    let body;
    try { body = await request.json(); } catch { return json({ ok: false, error: 'bad-request' }, 400); }
    const game = getGame(body && body.gameId);
    if (!game) return json({ ok: false, error: 'not-found' }, 404);

    const secret = deps.secret ? deps.secret() : getSecret();
    if (!secret) return json({ ok: false, error: 'server-not-configured' }, 503);

    const token = bearerOf(request);
    if (!token) return json({ ok: false, error: 'unauthenticated' }, 401);
    let decoded;
    try { decoded = await deps.verifyIdToken(token); } catch { return json({ ok: false, error: 'unauthenticated' }, 401); }
    if (!decoded || !decoded.uid) return json({ ok: false, error: 'unauthenticated' }, 401);

    if (!limit(decoded.uid)) return json({ ok: false, error: 'rate-limited' }, 429);

    let user;
    try { user = await deps.findUser(decoded.uid); } catch { return json({ ok: false, error: 'server-error' }, 500); }
    const ent = entitlementOf(user);
    if (!ent.ok) return json({ ok: false, error: 'forbidden' }, 403);
    if (game.status === 'unavailable' || (game.status === 'soon' && !ent.admin)) return json({ ok: false, error: 'unavailable' }, 403);

    const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SEC;
    const value = signSession({ g: game.id, u: decoded.uid, exp }, secret);
    return json({ ok: true, playUrl: `/play/${game.id}/${game.entry || 'index.html'}`, expiresIn: SESSION_TTL_SEC },
      200, { 'Set-Cookie': buildSetCookie(game.id, value, { secure: isProd() }) });
  };
}

/** GET /play/[gameId]/[[...path]] — لا يخدم شيئًا بدون كوكي جلسة صالح لنفس اللعبة. */
export function makePlayHandler(deps = {}) {
  const limit = makeLimiter(900, 60 * 1000);
  return async function GET(request, context) {
    const params = await context.params;
    const game = getGame(params.gameId);
    if (!game || game.status === 'unavailable') return denyPage(404, 'اللعبة غير موجودة.');

    const secret = deps.secret ? deps.secret() : getSecret();
    if (!secret) return denyPage(503, 'الخدمة غير مهيأة.');

    const sess = verifySession(readCookie(request.headers.get('cookie'), cookieName(game.id)), game.id, secret);
    if (!sess) return denyPage(401, 'يلزم تسجيل الدخول والاشتراك لتشغيل هذه اللعبة من داخل المنصة.');
    if (!looksEmbedded(request)) return denyPage(403, 'تُشغَّل هذه اللعبة من داخل منصة MusiTeacher فقط.');
    if (!limit(sess.u)) return denyPage(429, 'طلبات كثيرة جدًا، حاول بعد قليل.');

    const info = resolveGameFile(deps.root || gamesRoot(), game.id, params.path, game.entry || 'index.html');
    if (!info) return denyPage(404, 'الملف غير موجود.');
    return fileResponse(info, game, request);
  };
}
