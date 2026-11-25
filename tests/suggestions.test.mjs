// اختبارات «صندوق الاقتراحات السرية»: الخصوصية، الحماية من الإرسال الآلي، وصلاحيات الأدمن.
//   node --test tests/suggestions.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeSuggestionHandlers } from '../src/lib/suggestions/handlers.js';
import { makeFormToken, checkFormToken, cleanBody, validateMessage, dayStamp, coarseExpiry, LIMITS, adminEmails } from '../src/lib/suggestions/core.js';

const SECRET = 'test-secret-0123456789abcdef';
const env = { SUGGESTIONS_SECRET: SECRET };
const HOST = 'musi-teacher.vercel.app';

function memoryStore() {
  const docs = new Map(), guard = new Map(); let seq = 0; const days = new Map();
  return {
    docs, guard,
    async nextSeq() { return ++seq; },
    async bumpDaily(day) { const n = (days.get(day) || 0) + 1; days.set(day, n); return n; },
    async claim(key, expireAt) { if (guard.has(key)) return false; guard.set(key, expireAt); return true; },
    async insert(doc) { docs.set(doc._id, { ...doc }); },
    async list({ archived, limit }) { return [...docs.values()].filter((d) => !!d.archived === !!archived).sort((a, b) => b.seq - a.seq).slice(0, limit); },
    async counts() { const o = { inbox: 0, archived: 0, new: 0, read: 0, review: 0, done: 0 }; for (const d of docs.values()) { if (d.archived) o.archived++; else { o.inbox++; o[d.status]++; } } return o; },
    async update(id, patch) { const d = docs.get(id); if (!d) return false; Object.assign(d, patch); return true; },
    async remove(id) { return docs.delete(id); },
  };
}

const users = { 'admin-uid': { role: 'admin' }, 'teacher-uid': { role: 'user' }, 'rogue-uid': { role: 'admin' } };
const tokens = {
  'tok-admin': { uid: 'admin-uid', email: 'Hussien.Elmalek@gmail.com' },
  'tok-teacher': { uid: 'teacher-uid', email: 'teacher@example.com' },
  // حساب حصل على role=admin في قاعدة البيانات بطريقة ما، لكن بريده ليس بريد المدير
  'tok-rogue': { uid: 'rogue-uid', email: 'attacker@example.com' },
};

function setup(opts = {}) {
  let t = opts.start || Date.UTC(2026, 10, 25, 6, 0, 0);
  const store = opts.store === null ? null : memoryStore();
  let n = 0;
  const h = makeSuggestionHandlers({
    store, env, now: () => new Date(t), uuid: () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`,
    limiter: opts.limiter,
    verifyIdToken: async (tok) => { if (!tokens[tok]) throw new Error('bad'); return tokens[tok]; },
    findUser: async (uid) => users[uid] || null,
  });
  return { h, store, advance: (ms) => { t += ms; }, now: () => t };
}

const req = (url, { method = 'GET', body, headers = {} } = {}) => new Request(`https://${HOST}${url}`, {
  method, body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  headers: { host: HOST, origin: `https://${HOST}`, 'content-type': 'application/json', ...headers },
});

async function freshToken(ctx) { const r = await ctx.h.issueToken(); const j = await r.json(); ctx.advance(LIMITS.minFillMs + 500); return j.token; }

test('إرسال ناجح بلا تسجيل دخول، والرسالة المحفوظة لا تحمل أي هوية أو وقت دقيق', async () => {
  const ctx = setup();
  const token = await freshToken(ctx);
  const r = await ctx.h.submit(req('/api/suggestions', { method: 'POST', body: { body: '  أقترح إضافة تمارين للصولفيج  ', category: 'idea', token },
    headers: { authorization: 'Bearer tok-teacher', cookie: 'session=abc', 'x-forwarded-for': '10.1.2.3', 'user-agent': 'Mozilla/5.0 Test' } }));
  assert.equal(r.status, 201);
  assert.equal(r.headers.get('cache-control').includes('no-store'), true);
  const docs = [...ctx.store.docs.values()];
  assert.equal(docs.length, 1);
  assert.deepEqual(Object.keys(docs[0]).sort(), ['_id', 'archived', 'body', 'category', 'day', 'seq', 'status']);
  assert.equal(docs[0].body, 'أقترح إضافة تمارين للصولفيج');
  assert.equal(docs[0].day, '2026-11-25');
  const flat = JSON.stringify(docs[0]) + JSON.stringify([...ctx.store.guard.keys()]);
  for (const leak of ['teacher-uid', 'teacher@example.com', '10.1.2.3', 'Mozilla', 'session=abc', 'tok-teacher']) assert.equal(flat.includes(leak), false, `تسرّب: ${leak}`);
  // سجلات الحماية المؤقتة تنتهي «نهاية يوم» لا بعد مدة دقيقة من الإرسال
  for (const exp of ctx.store.guard.values()) assert.equal(exp.getUTCHours() + exp.getUTCMinutes() + exp.getUTCSeconds(), 0);
});

test('رفض الرسائل الفارغة/القصيرة/الطويلة، وتنظيف محارف التحكم', async () => {
  assert.equal(validateMessage({ body: '   ' }).ok, false);
  assert.equal(validateMessage({ body: 'abc' }).code, 'too-short');
  assert.equal(validateMessage({ body: 'ا'.repeat(LIMITS.maxChars + 1) }).code, 'too-long');
  assert.equal(validateMessage({ body: 'رسالة جيدة', category: 'hack' }).category, 'other');
  assert.equal(cleanBody('سطر\u0000​ أول\r\n\r\n\r\n\r\n\r\nسطر'), 'سطر أول\n\n\nسطر');
});

test('الحماية من الإرسال الآلي: حقل الفخ، الإرسال السريع جدًا، والنموذج المنتهي أو المزوّر', async () => {
  const ctx = setup();
  const r0 = await ctx.h.issueToken(); const { token } = await r0.json();
  let r = await ctx.h.submit(req('/api/suggestions', { method: 'POST', body: { body: 'رسالة سريعة جدًا', token } }));
  assert.equal(r.status, 429);
  ctx.advance(LIMITS.minFillMs + 10);
  r = await ctx.h.submit(req('/api/suggestions', { method: 'POST', body: { body: 'رسالة من برنامج آلي', token, website: 'http://spam' } }));
  assert.equal(r.status, 201); assert.equal(ctx.store.docs.size, 0, 'حقل الفخ: لا حفظ');
  r = await ctx.h.submit(req('/api/suggestions', { method: 'POST', body: { body: 'رسالة بنموذج مزور', token: token.slice(0, -3) + 'abc' } }));
  assert.equal(r.status, 400);
  ctx.advance(LIMITS.tokenTtlMs + 1000);
  r = await ctx.h.submit(req('/api/suggestions', { method: 'POST', body: { body: 'رسالة بنموذج قديم', token } }));
  assert.equal(r.status, 400); assert.equal((await r.json()).code, 'expired-form');
  const forged = makeFormToken('another-secret-xxxxxxxxxxxx', ctx.now() - 5000);
  assert.equal(checkFormToken(forged, SECRET, ctx.now()).ok, false);
});

test('منع الإرسال المزدوج (نفس النموذج) وتكرار الرسالة نفسها', async () => {
  const ctx = setup();
  const t1 = await freshToken(ctx);
  const send = (token, body = 'المنصة رائعة لكن أتمنى وضعًا ليليًا أوضح') => ctx.h.submit(req('/api/suggestions', { method: 'POST', body: { body, token } }));
  assert.equal((await send(t1)).status, 201);
  assert.equal((await send(t1)).status, 409, 'النموذج نفسه مرة ثانية');
  const t2 = await freshToken(ctx);
  const r = await send(t2, '  المنصة رائعة لكن   أتمنى وضعًا ليليًا أوضح ');
  assert.equal(r.status, 409); assert.equal((await r.json()).code, 'duplicate');
  assert.equal(ctx.store.docs.size, 1);
});

test('محدد المعدل يرفض الإغراق (429) دون حفظ أي عنوان', async () => {
  let calls = 0;
  const ctx = setup({ limiter: () => (++calls <= 2) });
  for (let i = 0; i < 3; i++) {
    const t = await freshToken(ctx);
    const r = await ctx.h.submit(req('/api/suggestions', { method: 'POST', body: { body: `رسالة رقم ${i} مختلفة`, token: t } }));
    assert.equal(r.status, i < 2 ? 201 : 429);
  }
});

test('رفض الطلبات من مصدر خارجي، والطلب الضخم، وغياب قاعدة البيانات', async () => {
  const ctx = setup();
  const t = await freshToken(ctx);
  let r = await ctx.h.submit(req('/api/suggestions', { method: 'POST', body: { body: 'رسالة من موقع آخر', token: t }, headers: { origin: 'https://evil.example' } }));
  assert.equal(r.status, 403);
  r = await ctx.h.submit(req('/api/suggestions', { method: 'POST', body: 'x'.repeat(LIMITS.maxRequestBytes + 10) }));
  assert.equal(r.status, 413);
  const c2 = setup({ store: null });
  r = await c2.h.submit(req('/api/suggestions', { method: 'POST', body: { body: 'رسالة' } }));
  assert.equal(r.status, 503);
});

test('لوحة الأدمن: المدير فقط (توكن + بريد المدير + role=admin)، والقائمة من الأحدث، وبلا بيانات مرسل', async () => {
  const ctx = setup();
  for (const [i, body] of ['الأولى: مشكلة في التحميل', 'الثانية: شكرًا جزيلًا', 'الثالثة: فكرة لعبة جديدة'].entries()) {
    const t = await freshToken(ctx);
    assert.equal((await ctx.h.submit(req('/api/suggestions', { method: 'POST', body: { body, token: t, category: ['problem', 'thanks', 'idea'][i] } }))).status, 201);
  }
  const list = (auth, view = '') => ctx.h.adminList(req('/api/admin/suggestions' + view, { headers: auth ? { authorization: `Bearer ${auth}` } : {} }));
  assert.equal((await list(null)).status, 401, 'بلا توكن');
  assert.equal((await list('tok-forged')).status, 401, 'توكن غير صالح');
  assert.equal((await list('tok-teacher')).status, 403, 'معلم عادي');
  assert.equal((await list('tok-rogue')).status, 403, 'role=admin في القاعدة وحده لا يكفي');
  const r = await list('tok-admin');
  assert.equal(r.status, 200);
  const j = await r.json();
  assert.deepEqual(j.items.map((x) => x.body.split(':')[0]), ['الثالثة', 'الثانية', 'الأولى']);
  assert.deepEqual(Object.keys(j.items[0]).sort(), ['archived', 'body', 'category', 'day', 'id', 'seq', 'status']);
  assert.equal(j.counts.new, 3);
  // تغيير الحالة، الأرشفة، الحذف
  const id = j.items[0].id;
  const patch = (body, auth = 'tok-admin') => ctx.h.adminPatch(req('/api/admin/suggestions', { method: 'PATCH', body, headers: { authorization: `Bearer ${auth}` } }));
  assert.equal((await patch({ id, status: 'review' }, 'tok-teacher')).status, 403);
  assert.equal((await patch({ id, status: 'hacked' })).status, 400);
  assert.equal((await patch({ id, status: 'review' })).status, 200);
  assert.equal(ctx.store.docs.get(id).status, 'review');
  assert.equal((await patch({ id, archived: true })).status, 200);
  const arch = await (await list('tok-admin', '?view=archived')).json();
  assert.equal(arch.items.length, 1); assert.equal(arch.counts.archived, 1);
  const del = (body, auth = 'tok-admin') => ctx.h.adminDelete(req('/api/admin/suggestions', { method: 'DELETE', body, headers: { authorization: `Bearer ${auth}` } }));
  assert.equal((await del({ id }, 'tok-teacher')).status, 403);
  assert.equal((await del({ id })).status, 200);
  assert.equal(ctx.store.docs.has(id), false);
  assert.equal((await del({ id })).status, 404);
  assert.equal((await del({ id: "{'$ne':1}" })).status, 400, 'معرّف غير صالح');
});

test('يوم الاستلام بتوقيت مسقط، وقائمة بريد المدير من المتغيرات', () => {
  assert.equal(dayStamp(new Date(Date.UTC(2026, 10, 24, 21, 30))), '2026-11-25');  // 01:30 في مسقط
  assert.equal(dayStamp(new Date(Date.UTC(2026, 10, 24, 19, 59))), '2026-11-24');
  const e = coarseExpiry(new Date(Date.UTC(2026, 10, 25, 13, 47, 12)));
  assert.equal(e.toISOString(), '2026-11-27T00:00:00.000Z');
  assert.deepEqual(adminEmails({ SUGGESTIONS_ADMIN_EMAILS: 'A@x.com, b@y.com' }), ['a@x.com', 'b@y.com']);
  assert.ok(adminEmails({}).includes('hussien.elmalek@gmail.com'));
});
