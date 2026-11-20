// =====================================================================
//  مشاركة الألعاب مع الطلاب (MusiTeacher Games) — المنطق الصافي بلا قاعدة بيانات (مختبَر في tests/student-games.test.mjs)
//  - الرمز: 6 أرقام عشوائية آمنة، فريد لكل لعبة، لا يُخزَّن نصًّا صريحًا:
//      lookup = HMAC(السر، لعبة:رمز) للبحث  +  enc = AES-256-GCM لعرضه للمعلم صاحبه فقط
//  - صلاحية الرمز لا تتجاوز نهاية اشتراك المعلم (الفصلي ينتهي مع فصله، والسنوي مع سنته) تلقائيًا
// =====================================================================
import crypto from 'node:crypto';

export const CODE_RE = /^\d{6}$/;
export const DAY_CHOICES = [0, 1, 7, 30];          // 0 = حتى نهاية اشتراك المعلم (الافتراضي)
export const ADMIN_DEFAULT_DAYS = 180;              // للمدير (لا تاريخ انتهاء اشتراك له)
export const FAIL_MAX = 10, FAIL_WINDOW_MS = 15 * 60 * 1000;   // حدّ التخمين لكل جهاز

export function secretOf(env = process.env) {
  const s = env.STUDENT_GAMES_SECRET || '';
  return s.length >= 24 ? s : '';
}
export function bridgeSecretOf(env = process.env) {
  const s = env.STUDENT_GAMES_BRIDGE_SECRET || '';
  return s.length >= 24 ? s : '';
}

// رموز سهلة التخمين لا تُعطى أبدًا
const WEAK = new Set(['123456', '654321', '012345', '543210', '123123', '112233', '121212', '000001', '999999']);
export function isWeak(code) { return WEAK.has(code) || /^(\d)\1{5}$/.test(code) || /^(\d\d)\1\1$/.test(code); }
export function generateCode(rand = crypto.randomInt) {
  for (;;) { const c = String(rand(0, 1000000)).padStart(6, '0'); if (!isWeak(c)) return c; }
}
export function normalizeCode(raw) {
  const s = String(raw ?? '').replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06F0)).replace(/\s/g, '');
  return CODE_RE.test(s) ? s : null;
}
export function lookupOf(gameId, code, secret) {
  return crypto.createHmac('sha256', secret).update(`lk:${gameId}:${code}`).digest('hex');
}
const keyOf = (secret) => crypto.createHash('sha256').update('enc:' + secret).digest();
export function seal(code, secret) {
  const iv = crypto.randomBytes(12), c = crypto.createCipheriv('aes-256-gcm', keyOf(secret), iv);
  const ct = Buffer.concat([c.update(code, 'utf8'), c.final()]);
  return [iv, ct, c.getAuthTag()].map((b) => b.toString('base64url')).join('.');
}
export function unseal(enc, secret) {
  try {
    const [iv, ct, tag] = String(enc).split('.').map((s) => Buffer.from(s, 'base64url'));
    const d = crypto.createDecipheriv('aes-256-gcm', keyOf(secret), iv); d.setAuthTag(tag);
    return Buffer.concat([d.update(ct), d.final()]).toString('utf8');
  } catch { return null; }
}

/** صلاحية المعلم في إنشاء الرموز (نفس قاعدة الاشتراك في الألعاب الأصلية) */
export function teacherEntitlement(user, now = new Date()) {
  if (!user) return { ok: false };
  if (user.status === 'suspended') return { ok: false };
  if (user.role === 'admin') return { ok: true, admin: true, end: null };
  const end = user.subscriptionEndDate ? new Date(user.subscriptionEndDate) : null;
  if (user.isSubscribed && end && end > now) return { ok: true, admin: false, end };
  return { ok: false };
}
/** انتهاء الرمز: الافتراضي حتى نهاية الاشتراك؛ أو يوم/أسبوع/شهر — دون تجاوز نهاية الاشتراك أبدًا */
export function expiryFor(ent, days, now = new Date()) {
  const cap = ent.admin ? new Date(now.getTime() + ADMIN_DEFAULT_DAYS * 864e5) : ent.end;
  const d = DAY_CHOICES.includes(Number(days)) ? Number(days) : 0;
  if (!d) return cap;
  const want = new Date(now.getTime() + d * 864e5);
  return want < cap ? want : cap;
}

// ---------------------------------------------------------------------
//  الإصدارات الفصلية لمشروع MusiTeacher Games (عنوان مركزي واحد)
//  releases: [{ id: '2026-S2', url: 'https://…', status: 'active'|'transition'|'stopped', until: ISO|null }]
// ---------------------------------------------------------------------
export function normalizeConfig(cfg, env = process.env) {
  let releases = Array.isArray(cfg && cfg.releases) ? cfg.releases.filter((r) => r && r.id && r.url) : [];
  if (!releases.length && env.STUDENT_GAMES_URL && env.STUDENT_GAMES_RELEASE) {
    releases = [{ id: env.STUDENT_GAMES_RELEASE, url: env.STUDENT_GAMES_URL, status: 'active', until: null }];
  }
  return { releases: releases.map((r) => ({ id: String(r.id).trim(), url: String(r.url).trim().replace(/\/+$/, ''), status: ['active', 'transition', 'stopped'].includes(r.status) ? r.status : 'stopped', until: r.until || null, note: r.note || '' })) };
}
export function currentRelease(cfg) { return cfg.releases.find((r) => r.status === 'active') || null; }
/** هل يقبل الخادم طلبات من هذا الإصدار؟ الحالي دائمًا، والانتقالي حتى تاريخه، والموقوف أبدًا */
export function releaseAccepts(cfg, id, now = new Date()) {
  const r = cfg.releases.find((x) => x.id === id);
  if (!r) return false;
  if (r.status === 'active') return true;
  if (r.status === 'transition') return !r.until || new Date(r.until) > now;
  return false;
}
const ID_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,40}$/;
export function validateConfig(input) {
  const list = Array.isArray(input && input.releases) ? input.releases : null;
  if (!list) return { ok: false, error: 'bad-config' };
  const seen = new Set(); let active = 0;
  for (const r of list) {
    if (!r || !ID_RE.test(String(r.id || ''))) return { ok: false, error: 'bad-id' };
    if (seen.has(r.id)) return { ok: false, error: 'dup-id' }; seen.add(r.id);
    let u; try { u = new URL(r.url); } catch { return { ok: false, error: 'bad-url' }; }
    if (!/^https?:$/.test(u.protocol)) return { ok: false, error: 'bad-url' };
    if (!['active', 'transition', 'stopped'].includes(r.status)) return { ok: false, error: 'bad-status' };
    if (r.status === 'active') active += 1;
  }
  if (active > 1) return { ok: false, error: 'one-active' };
  return { ok: true, config: { releases: list.map((r) => ({ id: r.id, url: String(r.url).replace(/\/+$/, ''), status: r.status, until: r.until || null, note: String(r.note || '').slice(0, 120) })) } };
}

/** مقارنة سرّ الجسر بزمن ثابت */
export function bridgeAuthorized(headerValue, secret) {
  if (!secret || !headerValue) return false;
  const a = Buffer.from(String(headerValue)), b = Buffer.from(secret);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
export function linkFor(release, gameId) { return release ? `${release.url}/games/${gameId}` : null; }
