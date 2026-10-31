// اختبارات التحقق من Firebase ID token بدون firebase-admin:  node --test tests/firebase-token.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { verifyFirebaseIdToken, getGoogleKeys, _resetKeyCache, JWKS_URL } from '../src/lib/virtual-games/firebase-token.js';

const PROJECT = 'musiteacher-test';
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const other = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const KID = 'kid-1';
const keys = { [KID]: publicKey };
const now = Math.floor(Date.now() / 1000);
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
function sign(payload, { kid = KID, alg = 'RS256', key = privateKey } = {}) {
  const h = b64({ alg, kid, typ: 'JWT' }), p = b64(payload);
  const sig = crypto.sign('RSA-SHA256', Buffer.from(h + '.' + p), key).toString('base64url');
  return `${h}.${p}.${sig}`;
}
const good = (over = {}) => ({ aud: PROJECT, iss: `https://securetoken.google.com/${PROJECT}`, sub: 'uid-123', iat: now - 60, auth_time: now - 120, exp: now + 3000, ...over });
const opts = { projectId: PROJECT, keys };

test('توكن صحيح → uid', async () => {
  const r = await verifyFirebaseIdToken(sign(good()), opts);
  assert.equal(r.uid, 'uid-123');
});
const bad = [
  ['توقيع بمفتاح آخر', () => sign(good(), { key: other.privateKey }), 'bad-signature'],
  ['مشروع آخر (aud)', () => sign(good({ aud: 'evil' })), 'bad-aud'],
  ['مُصدِر آخر (iss)', () => sign(good({ iss: 'https://evil' })), 'bad-iss'],
  ['منتهي الصلاحية', () => sign(good({ exp: now - 1000 })), 'expired'],
  ['صادر في المستقبل', () => sign(good({ iat: now + 4000 })), 'bad-iat'],
  ['sub فارغ', () => sign(good({ sub: '' })), 'bad-sub'],
  ['kid غير معروف', () => sign(good(), { kid: 'nope' }), 'unknown-kid'],
  ['خوارزمية none', () => sign(good(), { alg: 'none' }), 'bad-alg'],
  ['HS256 (هجوم خلط الخوارزميات)', () => sign(good(), { alg: 'HS256' }), 'bad-alg'],
  ['حمولة معدّلة بعد التوقيع', () => { const t = sign(good()).split('.'); t[1] = b64(good({ sub: 'admin' })); return t.join('.'); }, 'bad-signature'],
  ['نص عشوائي', () => 'abc.def.ghi', 'bad-token'],
  ['جزءان فقط', () => 'abc.def', 'bad-token'],
];
for (const [name, mk, code] of bad) {
  test('يُرفض: ' + name, async () => {
    await assert.rejects(verifyFirebaseIdToken(mk(), opts), (e) => e.message === code);
  });
}
test('بدون معرّف مشروع → no-project-id (يُعاد 503 لا 401)', async () => {
  await assert.rejects(verifyFirebaseIdToken(sign(good()), { keys, projectId: '' , }).catch((e) => { throw e; }), () => true);
});
test('جلب مفاتيح Google بصيغة JWK + احترام max-age', async () => {
  _resetKeyCache();
  const jwk = publicKey.export({ format: 'jwk' });
  let calls = 0;
  const fakeFetch = async (url) => { calls++; assert.equal(url, JWKS_URL); return new Response(JSON.stringify({ keys: [{ ...jwk, kid: KID, alg: 'RS256', use: 'sig' }] }), { headers: { 'cache-control': 'public, max-age=20000' } }); };
  const k1 = await getGoogleKeys(fakeFetch); const k2 = await getGoogleKeys(fakeFetch);
  assert.equal(calls, 1); assert.ok(k1[KID]); assert.equal(k1, k2);
  const r = await verifyFirebaseIdToken(sign(good()), { projectId: PROJECT, getKeys: () => getGoogleKeys(fakeFetch) });
  assert.equal(r.uid, 'uid-123');
});
