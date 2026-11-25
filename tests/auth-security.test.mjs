// اختبارات أمان تسجيل الدخول وصلاحيات المدير — بتوكنات Firebase موقّعة فعلًا (RSA) ومزوّرة.
// تغطي: /api/auth/sync (src/lib/auth/sync.js) و /api/admin/subscriptions (src/lib/auth/admin-subscriptions.js)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { verifyFirebaseIdToken } from '../src/lib/virtual-games/firebase-token.js';
import { makeSyncHandler } from '../src/lib/auth/sync.js';
import { makeAdminSubscriptionsHandler } from '../src/lib/auth/admin-subscriptions.js';
import { adminEmails, isAdminClaims, DEFAULT_ADMIN_EMAILS } from '../src/lib/auth/admins.js';

const PROJECT = 'musiteacher-test';
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const evil = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const ADMIN = DEFAULT_ADMIN_EMAILS[1];
const now = () => Math.floor(Date.now() / 1000);
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
function sign(claims, { key = privateKey, kid = 'k1', alg = 'RS256' } = {}) {
  const h = b64({ alg, kid, typ: 'JWT' });
  const p = b64({ aud: PROJECT, iss: `https://securetoken.google.com/${PROJECT}`, iat: now() - 10, exp: now() + 3600, auth_time: now() - 10, ...claims });
  return `${h}.${p}.${crypto.sign('RSA-SHA256', Buffer.from(`${h}.${p}`), key).toString('base64url')}`;
}
const verifyIdToken = (t) => verifyFirebaseIdToken(t, { projectId: PROJECT, keys: { k1: publicKey } });

function memDB(seed = []) {
  const rows = seed.map((r) => ({ ...r }));
  return {
    rows,
    connect: async () => {},
    findByUid: async (uid) => rows.find((r) => r.uid === uid) || null,
    findByEmail: async (email) => rows.find((r) => r.email === email) || null,
    create: async (d) => { if (rows.some((r) => r.email === d.email || r.uid === d.uid)) throw Object.assign(new Error('dup'), { code: 11000 }); const r = { ...d }; rows.push(r); return r; },
    save: async () => {},
  };
}
const req = (url, { token, body, raw } = {}) => new Request('https://musiteacher.test' + url, {
  method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
  body: raw !== undefined ? raw : JSON.stringify(body || {}),
});
const call = async (h, r) => { const res = await h(r); return { status: res.status, body: await res.json() }; };

const seed = () => [
  { uid: 'uid-admin', email: ADMIN, username: 'المدير', role: 'admin', isSubscribed: false },
  { uid: 'uid-teacher', email: 'teacher@school.om', username: 'معلمة', role: 'user', isSubscribed: true, subscriptionEndDate: new Date(Date.now() + 9e9) },
  { uid: 'uid-old', email: 'old@school.om', username: 'قديم', role: 'user', isSubscribed: true, subscriptionEndDate: new Date(Date.now() + 9e9) },
];

test('الثغرة 1 (sync): بلا توكن أو بتوكن مزوّر → 401 ولا يتغير شيء', async () => {
  const db = memDB(seed()); const sync = makeSyncHandler({ ...db, verifyIdToken, env: {} });
  // الهجوم القديم بالضبط: جسم الطلب فيه uid المهاجم + بريد المدير
  let r = await call(sync, req('/api/auth/sync', { body: { uid: 'uid-attacker', email: ADMIN } }));
  assert.equal(r.status, 401);
  r = await call(sync, req('/api/auth/sync', { token: sign({ sub: 'uid-attacker', email: ADMIN, email_verified: true }, { key: evil.privateKey }), body: { uid: 'uid-attacker', email: ADMIN } }));
  assert.equal(r.status, 401, 'توقيع بمفتاح غير مفتاح Google');
  r = await call(sync, req('/api/auth/sync', { token: sign({ sub: 'uid-attacker', email: ADMIN, email_verified: true, exp: now() - 4000 }) }));
  assert.equal(r.status, 401, 'توكن منتهي');
  r = await call(sync, req('/api/auth/sync', { token: sign({ sub: 'uid-attacker', email: ADMIN, email_verified: true, aud: 'other-project' }) }));
  assert.equal(r.status, 401, 'توكن لمشروع Firebase آخر');
  const none = Buffer.from('{"alg":"none","kid":"k1"}').toString('base64url') + '.' + b64({ sub: 'x', email: ADMIN, aud: PROJECT }) + '.';
  r = await call(sync, req('/api/auth/sync', { token: none })); assert.equal(r.status, 401, 'alg=none');
  assert.equal(db.rows.find((x) => x.email === ADMIN).uid, 'uid-admin', 'سجل المدير لم يُنقل');
});

test('الثغرة 1 (sync): الهوية من التوكن فقط — uid والبريد في جسم الطلب يُتجاهلان', async () => {
  const db = memDB(seed()); const sync = makeSyncHandler({ ...db, verifyIdToken, env: {} });
  const r = await call(sync, req('/api/auth/sync', { token: sign({ sub: 'uid-attacker', email: 'attacker@x.com', email_verified: true }), body: { uid: 'uid-admin', email: ADMIN, displayName: 'هاكر' } }));
  assert.equal(r.status, 200);
  assert.equal(r.body.isAdmin, false); assert.equal(r.body.user.role, 'user');
  assert.equal(r.body.user.email, 'attacker@x.com'); assert.equal(r.body.user.uid, 'uid-attacker');
  assert.equal(db.rows.find((x) => x.email === ADMIN).uid, 'uid-admin');
  assert.equal(db.rows.find((x) => x.email === ADMIN).username, 'المدير');
});

test('sync: بريد المدير غير المُتحقَّق منه لا يمنح صلاحية ولا ينقل سجل المدير', async () => {
  const db = memDB(seed()); const sync = makeSyncHandler({ ...db, verifyIdToken, env: {} });
  const r = await call(sync, req('/api/auth/sync', { token: sign({ sub: 'uid-attacker', email: ADMIN, email_verified: false }) }));
  assert.equal(r.status, 409); assert.equal(r.body.code, 'email-unverified');
  assert.equal(db.rows.find((x) => x.email === ADMIN).uid, 'uid-admin');
  assert.ok(!db.rows.some((x) => x.uid === 'uid-attacker'));
});

test('sync: الحالات المشروعة ما زالت تعمل (المدير، معلم موجود، نقل حساب قديم ببريد مُتحقَّق، معلم جديد)', async () => {
  const db = memDB(seed()); const sync = makeSyncHandler({ ...db, verifyIdToken, env: {} });
  let r = await call(sync, req('/api/auth/sync', { token: sign({ sub: 'uid-admin', email: ADMIN.toUpperCase(), email_verified: true }) }));
  assert.equal(r.status, 200); assert.equal(r.body.isAdmin, true); assert.equal(r.body.user.role, 'admin');
  r = await call(sync, req('/api/auth/sync', { token: sign({ sub: 'uid-teacher', email: 'teacher@school.om', email_verified: false }), body: { displayName: 'أ. منى' } }));
  assert.equal(r.status, 200); assert.equal(r.body.isAdmin, false); assert.equal(r.body.user.isSubscribed, true);
  assert.equal(db.rows.find((x) => x.uid === 'uid-teacher').username, 'أ. منى');
  r = await call(sync, req('/api/auth/sync', { token: sign({ sub: 'uid-new-google', email: 'old@school.om', email_verified: true }) }));
  assert.equal(r.status, 200); assert.equal(r.body.user.isSubscribed, true, 'الاشتراك القديم لم يضع');
  assert.equal(db.rows.find((x) => x.email === 'old@school.om').uid, 'uid-new-google');
  r = await call(sync, req('/api/auth/sync', { token: sign({ sub: 'uid-fresh', email: 'New@School.om', email_verified: false, name: 'معلم جديد' }) }));
  assert.equal(r.status, 200); assert.equal(r.body.user.role, 'user');
  const fresh = db.rows.find((x) => x.uid === 'uid-fresh'); assert.equal(fresh.email, 'new@school.om'); assert.equal(fresh.username, 'معلم جديد');
  assert.equal(Object.keys(r.body.user).includes('_id'), false, 'لا تُعاد حقول داخلية');
});

test('sync: سجل دوره admin في قاعدة البيانات لكن بريده خارج القائمة لا يُعامل كمدير', async () => {
  const db = memDB([{ uid: 'uid-x', email: 'x@x.com', username: 'x', role: 'admin' }]); const sync = makeSyncHandler({ ...db, verifyIdToken, env: {} });
  const r = await call(sync, req('/api/auth/sync', { token: sign({ sub: 'uid-x', email: 'x@x.com', email_verified: true }) }));
  assert.equal(r.body.isAdmin, false); assert.equal(r.body.user.role, 'user');
  assert.equal(db.rows[0].role, 'admin', 'لم نحذف أو نعدّل بيانات المستخدم');
});

test('الثغرة 2 (admin/subscriptions): adminUid في الطلب لا يمنح أي صلاحية', async () => {
  const db = memDB(seed()); const h = makeAdminSubscriptionsHandler({ ...db, verifyIdToken, env: {} });
  const body = { adminUid: 'uid-admin', targetEmail: 'attacker@x.com', planType: 'annual' };
  let r = await call(h, req('/api/admin/subscriptions', { body }));
  assert.equal(r.status, 401, 'بلا توكن');
  r = await call(h, req('/api/admin/subscriptions', { token: sign({ sub: 'uid-teacher', email: 'teacher@school.om', email_verified: true }), body }));
  assert.equal(r.status, 403, 'معلم عادي يرسل uid المدير');
  r = await call(h, req('/api/admin/subscriptions', { token: sign({ sub: 'uid-admin', email: ADMIN, email_verified: true }, { key: evil.privateKey }), body }));
  assert.equal(r.status, 401, 'توكن مزوّر يدّعي أنه المدير');
  r = await call(h, req('/api/admin/subscriptions', { token: sign({ sub: 'uid-attacker', email: ADMIN, email_verified: false }), body }));
  assert.equal(r.status, 403, 'بريد المدير غير مُتحقَّق منه');
  r = await call(h, req('/api/admin/subscriptions', { token: sign({ sub: 'uid-attacker', email: ADMIN, email_verified: true }), body }));
  assert.equal(r.status, 403, 'بريد صحيح لكن uid غير مسجل كمدير في قاعدة البيانات');
  const db2 = memDB([{ uid: 'uid-x', email: 'x@x.com', role: 'admin' }, { uid: 't', email: 'attacker@x.com', role: 'user' }]);
  r = await call(makeAdminSubscriptionsHandler({ ...db2, verifyIdToken, env: {} }), req('/api/admin/subscriptions', { token: sign({ sub: 'uid-x', email: 'x@x.com', email_verified: true }), body }));
  assert.equal(r.status, 403, 'دور admin في القاعدة وحده لا يكفي');
  assert.ok(!db2.rows[1].isSubscribed);
});

test('admin/subscriptions: المدير الحقيقي يفعّل الاشتراك كما كان', async () => {
  const db = memDB([...seed(), { uid: 'uid-t2', email: 'pay@school.om', username: 't', role: 'user', isSubscribed: false }]);
  const fixed = new Date('2026-11-25T08:00:00Z');
  const h = makeAdminSubscriptionsHandler({ ...db, verifyIdToken, env: {}, now: () => fixed });
  const tok = sign({ sub: 'uid-admin', email: ADMIN, email_verified: true });
  let r = await call(h, req('/api/admin/subscriptions', { token: tok, body: { targetEmail: ' PAY@school.om ', planType: 'semester' } }));
  assert.equal(r.status, 200); assert.equal(r.body.success, true);
  assert.equal(new Date(r.body.endDate).toISOString().slice(0, 10), '2027-03-25');
  assert.equal(db.rows.find((x) => x.email === 'pay@school.om').isSubscribed, true);
  r = await call(h, req('/api/admin/subscriptions', { token: tok, body: { targetEmail: 'pay@school.om', planType: 'annual' } }));
  assert.equal(r.body.alreadyActive, true);
  r = await call(h, req('/api/admin/subscriptions', { token: tok, body: { targetEmail: 'nobody@x.com', planType: 'annual' } })); assert.equal(r.status, 404);
  r = await call(h, req('/api/admin/subscriptions', { token: tok, body: { targetEmail: 'pay@school.om', planType: 'forever' } })); assert.equal(r.status, 400);
  r = await call(h, req('/api/admin/subscriptions', { token: tok, body: { targetEmail: 'pay@school.om', planType: '__proto__' } })); assert.equal(r.status, 400);
  r = await call(h, req('/api/admin/subscriptions', { token: tok, raw: '{bad json' })); assert.equal(r.status, 400);
});

test('قائمة المديرين: الافتراضية، ومتغير البيئة ADMIN_EMAILS، والتحقق من البريد شرط', () => {
  assert.deepEqual(adminEmails({}), DEFAULT_ADMIN_EMAILS);
  assert.deepEqual(adminEmails({ ADMIN_EMAILS: ' A@x.com, b@y.com ' }), ['a@x.com', 'b@y.com']);
  assert.equal(isAdminClaims({ email: ADMIN, email_verified: true }, {}), true);
  assert.equal(isAdminClaims({ email: ADMIN }, {}), false);
  assert.equal(isAdminClaims({ email: ADMIN, email_verified: true }, { ADMIN_EMAILS: 'other@x.com' }), false);
});
