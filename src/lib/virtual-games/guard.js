// طبقة الحماية — دوال نقية (لا تعتمد على Next ولا قاعدة البيانات) لسهولة الاختبار.
// الفكرة: المتصفح يرسل Firebase ID token إلى /api/virtual-games/session، فيتحقق الخادم من التوكن ومن
// اشتراك المستخدم في MongoDB (نفس منطق AuthContext)، ثم يمنحه كوكي موقّعًا (HttpOnly) صالحًا للعبة واحدة.
// مسار /play/... لا يخدم أي ملف بدون هذا الكوكي.
import crypto from 'node:crypto';

export const SESSION_TTL_SEC = 30 * 60;
export const COOKIE_PREFIX = 'mt_pg_';

export function cookieName(gameId) { return COOKIE_PREFIX + gameId.replace(/-/g, '_'); }

/** السر: GAME_SESSION_SECRET أو مشتق من مفتاح Firebase الخاص (لا يصل للمتصفح أبدًا). null = لا يوجد سر → نرفض كل شيء. */
export function getSecret(env = process.env) {
  const s = env.GAME_SESSION_SECRET;
  if (s && s.length >= 16) return s;
  const k = env.FIREBASE_PRIVATE_KEY;
  if (k && k.length > 32) return crypto.createHash('sha256').update('musiteacher-games:' + k).digest('hex');
  return null;
}

const b64u = (buf) => Buffer.from(buf).toString('base64url');

export function signSession(payload, secret) {
  const body = b64u(JSON.stringify(payload));
  const mac = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${mac}`;
}

/** يعيد الـ payload إن كان التوقيع سليمًا والكوكي لنفس اللعبة وغير منتهٍ، وإلا null. */
export function verifySession(token, gameId, secret, nowSec = Math.floor(Date.now() / 1000)) {
  if (!token || !secret || typeof token !== 'string') return null;
  const i = token.indexOf('.');
  if (i < 1) return null;
  const body = token.slice(0, i), mac = token.slice(i + 1);
  const good = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  const a = Buffer.from(mac), b = Buffer.from(good);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  let p;
  try { p = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')); } catch { return null; }
  if (!p || p.g !== gameId || typeof p.exp !== 'number' || p.exp <= nowSec) return null;
  return p;
}

export function readCookie(header, name) {
  if (!header) return null;
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    if (part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return null;
}

export function buildSetCookie(gameId, value, { secure, maxAge = SESSION_TTL_SEC }) {
  return [
    `${cookieName(gameId)}=${value}`,
    `Path=/play/${gameId}/`,
    'HttpOnly', 'SameSite=Strict', `Max-Age=${maxAge}`,
    ...(secure ? ['Secure'] : []),
  ].join('; ');
}

/** نفس شرط AuthContext: الأدمن دائمًا، والمشترك إن لم ينتهِ اشتراكه. */
export function entitlementOf(user, now = new Date()) {
  if (!user) return { ok: false, reason: 'no-user' };
  if (user.role === 'admin') return { ok: true, admin: true };
  const end = user.subscriptionEndDate ? new Date(user.subscriptionEndDate) : null;
  if (user.isSubscribed && end && end > now) return { ok: true, admin: false };
  return { ok: false, reason: 'not-subscribed' };
}

export function bearerOf(request) {
  const h = request.headers.get('authorization') || '';
  return h.startsWith('Bearer ') ? h.slice(7).trim() : null;
}

/** حماية CSRF بسيطة: إن وُجد Origin يجب أن يطابق المضيف. */
export function sameOrigin(request) {
  const origin = request.headers.get('origin');
  if (!origin) return true; // طلبات نفس المصدر بدون Origin (GET) أو أدوات الخادم
  try { return new URL(origin).host === (request.headers.get('x-forwarded-host') || request.headers.get('host')); } catch { return false; }
}

/** هل الطلب قادم من iframe داخل منصتنا (وليس فتحًا مباشرًا للرابط)؟ */
export function looksEmbedded(request) {
  const dest = request.headers.get('sec-fetch-dest');
  const site = request.headers.get('sec-fetch-site');
  if (dest) {
    if (dest === 'document') return false;                  // فتح مباشر للرابط في تبويب
    if (site && site !== 'same-origin') return false;
    return true;
  }
  // متصفح قديم بلا Sec-Fetch: نكتفي بمطابقة الـ Referer
  const ref = request.headers.get('referer');
  if (!ref) return false;
  try { return new URL(ref).host === (request.headers.get('x-forwarded-host') || request.headers.get('host')); } catch { return false; }
}

/** محدّد معدل بسيط في الذاكرة (تثبيط التحميل الآلي). */
export function makeLimiter(max, windowMs, now = () => Date.now()) {
  const hits = new Map();
  return (key) => {
    const t = now(), arr = (hits.get(key) || []).filter((x) => t - x < windowMs);
    arr.push(t); hits.set(key, arr);
    if (hits.size > 5000) for (const [k, v] of hits) if (!v.length || t - v[v.length - 1] > windowMs) hits.delete(k);
    return arr.length <= max;
  };
}
