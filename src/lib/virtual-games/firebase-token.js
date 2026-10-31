// التحقق من Firebase ID token بدون مكتبة firebase-admin — باستخدام node:crypto فقط.
// السبب: تحميل firebase-admin (الإصدار 14 يتطلب Node 22+) يُسقط الدالة على Vercel قبل تنفيذ أي سطر،
// فكانت /api/virtual-games/session تعيد 500 (صفحة HTML) فتظهر رسالة «تعذّر تشغيل اللعبة الآن».
// هذه هي الطريقة الموثقة من Firebase للتحقق عبر مكتبة JWT خارجية:
//   - التوقيع RS256 بمفتاح عام من مفاتيح Google (حسب kid)
//   - aud = معرّف مشروع Firebase ، iss = https://securetoken.google.com/<projectId>
//   - exp في المستقبل، iat و auth_time في الماضي، sub (uid) نص غير فارغ
import crypto from 'node:crypto';

export const JWKS_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
const SKEW = 300; // سماحية فرق الساعة بالثواني

export function getProjectId(env = process.env) {
  return env.FIREBASE_PROJECT_ID || env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || null;
}

let cache = { keys: null, until: 0 };

/** يجلب مفاتيح Google العامة ويحفظها حسب Cache-Control. fetchImpl قابل للاستبدال في الاختبارات. */
export async function getGoogleKeys(fetchImpl = fetch, now = Date.now()) {
  if (cache.keys && now < cache.until) return cache.keys;
  const res = await fetchImpl(JWKS_URL);
  if (!res.ok) throw new Error('jwks-http-' + res.status);
  const data = await res.json();
  if (!data || !Array.isArray(data.keys)) throw new Error('jwks-bad');
  const keys = {};
  for (const k of data.keys) if (k && k.kid && k.kty === 'RSA') keys[k.kid] = crypto.createPublicKey({ key: k, format: 'jwk' });
  const m = /max-age=(\d+)/.exec(res.headers.get('cache-control') || '');
  cache = { keys, until: now + Math.min(6 * 3600, m ? +m[1] : 3600) * 1000 };
  return keys;
}
export function _resetKeyCache() { cache = { keys: null, until: 0 }; }

const b64json = (s) => JSON.parse(Buffer.from(s, 'base64url').toString('utf8'));

/**
 * يتحقق من التوكن ويعيد { uid, ...claims } أو يرمي خطأ.
 * opts: { projectId, keys (كائن kid→KeyObject) أو getKeys(), nowSec }
 */
export async function verifyFirebaseIdToken(token, opts = {}) {
  const projectId = opts.projectId || getProjectId();
  if (!projectId) throw new Error('no-project-id');
  if (typeof token !== 'string' || token.length > 4096) throw new Error('bad-token');
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('bad-token');
  let header, payload;
  try { header = b64json(parts[0]); payload = b64json(parts[1]); } catch { throw new Error('bad-token'); }
  if (!header || header.alg !== 'RS256' || typeof header.kid !== 'string') throw new Error('bad-alg');

  const keys = opts.keys || await (opts.getKeys ? opts.getKeys() : getGoogleKeys());
  let key = keys[header.kid];
  if (!key && !opts.keys && !opts.getKeys) { _resetKeyCache(); key = (await getGoogleKeys())[header.kid]; } // دوران المفاتيح
  if (!key) throw new Error('unknown-kid');

  const ok = crypto.verify('RSA-SHA256', Buffer.from(parts[0] + '.' + parts[1]), key, Buffer.from(parts[2], 'base64url'));
  if (!ok) throw new Error('bad-signature');

  const now = opts.nowSec || Math.floor(Date.now() / 1000);
  if (payload.aud !== projectId) throw new Error('bad-aud');
  if (payload.iss !== `https://securetoken.google.com/${projectId}`) throw new Error('bad-iss');
  if (typeof payload.exp !== 'number' || payload.exp <= now - SKEW) throw new Error('expired');
  if (typeof payload.iat !== 'number' || payload.iat > now + SKEW) throw new Error('bad-iat');
  if (payload.auth_time !== undefined && payload.auth_time > now + SKEW) throw new Error('bad-auth-time');
  if (typeof payload.sub !== 'string' || !payload.sub || payload.sub.length > 128) throw new Error('bad-sub');
  return { ...payload, uid: payload.sub };
}
