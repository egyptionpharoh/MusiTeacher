// اختبار «مشاركة الألعاب مع الطلاب» في MusiTeacher (بلا Firebase ولا MongoDB):  node --test tests/student-games.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeShareHandlers, makeBridgeHandlers, makeConfigHandlers } from '../src/lib/student-games/handlers.js';
import { generateCode, isWeak, normalizeCode, seal, unseal, lookupOf, expiryFor, teacherEntitlement, releaseAccepts, normalizeConfig, validateConfig } from '../src/lib/student-games/core.js';
import { memoryStore } from './student-games/memory-store.mjs';

const SECRET = 'test-secret-test-secret-123456', BRIDGE = 'bridge-secret-bridge-secret-99';
const env = { STUDENT_GAMES_SECRET: SECRET, STUDENT_GAMES_BRIDGE_SECRET: BRIDGE };
let clock = new Date('2026-11-20T08:00:00Z');
const day = 864e5;
const USERS = {
  sem: { role: 'user', isSubscribed: true, subscriptionEndDate: new Date('2027-01-31T00:00:00Z') },   // اشتراك فصلي
  year: { role: 'user', isSubscribed: true, subscriptionEndDate: new Date('2027-06-30T00:00:00Z') },  // اشتراك سنوي
  free: { role: 'user', isSubscribed: false },
  admin: { role: 'admin' },
};
function setup() {
  const store = memoryStore();
  const deps = { env, store, now: () => clock, fetch: async () => ({ ok: true, json: async () => ({ games: [{ id: 'virtual-violin', version: 3, updatedAt: '2026-11-19' }] }) }),
    verifyIdToken: async (t) => { if (!t.startsWith('tok-')) throw new Error('bad'); return { uid: t.slice(4) }; }, findUser: async (uid) => USERS[uid] || null };
  return { store, deps, share: makeShareHandlers(deps), bridge: makeBridgeHandlers(deps), cfg: makeConfigHandlers(deps) };
}
const req = (url, body, headers = {}) => new Request('http://mt.local' + url, { method: body ? 'POST' : 'GET', headers: { 'content-type': 'application/json', host: 'mt.local', ...headers }, body: body ? JSON.stringify(body) : undefined });
const teacher = (uid, body) => req('/api/student-games/share', body, { authorization: `Bearer tok-${uid}` });
const fromGames = (path, body, key = BRIDGE) => req(path, body, { 'x-mtg-bridge': key });
const J = async (r) => ({ status: r.status, ...(await r.json()) });
async function withRelease(t) { await t.store.config.set({ releases: [{ id: '2026-S2', url: 'https://games-s2.example', status: 'active' }] }); }

test('الرمز: 6 أرقام، لا رموز سهلة، يقبل الأرقام العربية، تشفير قابل للعكس للمعلم فقط', () => {
  for (let i = 0; i < 500; i++) { const c = generateCode(); assert.match(c, /^\d{6}$/); assert.ok(!isWeak(c)); }
  assert.ok(isWeak('111111') && isWeak('123456') && isWeak('121212'));
  assert.equal(normalizeCode('٤٨٢ ٩١٥'), '482915');
  assert.equal(normalizeCode('12345'), null);
  const enc = seal('482915', SECRET); assert.notEqual(enc, '482915'); assert.equal(unseal(enc, SECRET), '482915'); assert.equal(unseal(enc, 'another-secret-another-secret'), null);
  assert.notEqual(lookupOf('a', '482915', SECRET), lookupOf('b', '482915', SECRET));      // الرمز مرتبط بلعبة محددة
});

test('الصلاحية: لا تتجاوز نهاية اشتراك المعلم (فصلي/سنوي) والافتراضي حتى نهايته', () => {
  const sem = teacherEntitlement(USERS.sem, clock), year = teacherEntitlement(USERS.year, clock);
  assert.equal(+expiryFor(sem, 0, clock), +USERS.sem.subscriptionEndDate);
  assert.equal(+expiryFor(year, 0, clock), +USERS.year.subscriptionEndDate);
  assert.equal(+expiryFor(sem, 7, clock), +clock + 7 * day);
  assert.equal(+expiryFor({ ok: true, end: new Date(+clock + 2 * day) }, 30, clock), +clock + 2 * day);   // الشهر يُقصّ إلى نهاية الاشتراك
  assert.equal(teacherEntitlement(USERS.free, clock).ok, false);
  assert.equal(teacherEntitlement({ ...USERS.year, status: 'suspended' }, clock).ok, false);
});

test('المعلم المشترك: فتح النافذة يُنشئ رابطًا ورمزًا تلقائيًا، وفتحها مجددًا يعيد الرمز نفسه', async () => {
  const t = setup(); await withRelease(t);
  const a = await J(await t.share.POST(teacher('sem', { gameId: 'virtual-violin', action: 'get' })));
  assert.equal(a.ok, true); assert.match(a.share.code, /^\d{6}$/);
  assert.equal(a.link, 'https://games-s2.example/games/virtual-violin'); assert.equal(a.share.link, a.link);
  assert.equal(a.share.studentReady, true); assert.equal(a.share.studentVersion.version, 3);
  const b = await J(await t.share.POST(teacher('sem', { gameId: 'virtual-violin', action: 'get' })));
  assert.equal(b.share.code, a.share.code);
  const stored = [...t.store._shares.values()][0];
  assert.ok(!JSON.stringify(stored).includes(a.share.code), 'الرمز لا يُخزَّن نصًّا صريحًا');
});

test('غير المشترك أو بلا تسجيل دخول: لا رموز', async () => {
  const t = setup(); await withRelease(t);
  assert.equal((await t.share.POST(teacher('free', { gameId: 'virtual-violin' }))).status, 403);
  assert.equal((await t.share.POST(req('/api/student-games/share', { gameId: 'virtual-violin' }))).status, 401);
  assert.equal((await t.share.POST(teacher('sem', { gameId: 'no-such-game' }))).status, 404);
});

test('الطالب (عبر خادم الألعاب): رمز صحيح ← دخول؛ خاطئ ← رفض؛ رمز لعبة أخرى ← رفض', async () => {
  const t = setup(); await withRelease(t);
  const { share } = await J(await t.share.POST(teacher('sem', { gameId: 'virtual-violin' })));
  const ok = await J(await t.bridge.verify(fromGames('/api/student-games/verify', { gameId: 'virtual-violin', code: share.code, client: 'c1', release: '2026-S2' })));
  assert.equal(ok.ok, true); assert.ok(ok.sid); assert.equal(ok.exp, Math.floor(+USERS.sem.subscriptionEndDate / 1000));
  const bad = await J(await t.bridge.verify(fromGames('/api/student-games/verify', { gameId: 'virtual-violin', code: '000123', client: 'c1', release: '2026-S2' })));
  assert.deepEqual([bad.ok, bad.error], [false, 'invalid']);
  const other = await J(await t.bridge.verify(fromGames('/api/student-games/verify', { gameId: 'virtual-oud', code: share.code, client: 'c1', release: '2026-S2' })));
  assert.equal(other.ok, false);
  const chk = await J(await t.bridge.check(fromGames('/api/student-games/check', { gameId: 'virtual-violin', sid: ok.sid, release: '2026-S2' })));
  assert.equal(chk.ok, true);
});

test('الجسر محمي بسرّ مشترك: بدون السر أو بسر خاطئ ← 401', async () => {
  const t = setup(); await withRelease(t);
  assert.equal((await t.bridge.verify(req('/api/student-games/verify', { gameId: 'virtual-violin', code: '482915', release: '2026-S2' }))).status, 401);
  assert.equal((await t.bridge.verify(fromGames('/api/student-games/verify', { gameId: 'virtual-violin', code: '482915', release: '2026-S2' }, 'x'.repeat(30)))).status, 401);
});

test('الحد من التخمين: بعد 10 محاولات خاطئة من الجهاز نفسه يُرفض حتى الرمز الصحيح لمدة 15 دقيقة', async () => {
  const t = setup(); await withRelease(t);
  const { share } = await J(await t.share.POST(teacher('sem', { gameId: 'virtual-violin' })));
  for (let i = 0; i < 10; i++) await t.bridge.verify(fromGames('/api/student-games/verify', { gameId: 'virtual-violin', code: String(100000 + i * 7919), client: 'evil', release: '2026-S2' }));
  const r = await J(await t.bridge.verify(fromGames('/api/student-games/verify', { gameId: 'virtual-violin', code: share.code, client: 'evil', release: '2026-S2' })));
  assert.equal(r.error, 'rate-limited');
  const other = await J(await t.bridge.verify(fromGames('/api/student-games/verify', { gameId: 'virtual-violin', code: share.code, client: 'good', release: '2026-S2' })));
  assert.equal(other.ok, true);                                                     // جهاز آخر لا يتأثر
  clock = new Date(+clock + 16 * 60 * 1000);
  assert.equal((await J(await t.bridge.verify(fromGames('/api/student-games/verify', { gameId: 'virtual-violin', code: share.code, client: 'evil', release: '2026-S2' })))).ok, true);
});

test('التجديد والإلغاء: الرمز القديم يتوقف فورًا للدخول الجديد وللجلسات عند إعادة التحقق', async () => {
  const t = setup(); await withRelease(t);
  const a = await J(await t.share.POST(teacher('year', { gameId: 'virtual-violin' })));
  const s1 = await J(await t.bridge.verify(fromGames('/api/student-games/verify', { gameId: 'virtual-violin', code: a.share.code, client: 'k', release: '2026-S2' })));
  const b = await J(await t.share.POST(teacher('year', { gameId: 'virtual-violin', action: 'renew', days: 7 })));
  assert.notEqual(b.share.code, a.share.code);
  assert.equal(+new Date(b.share.expiresAt), +clock + 7 * day);
  assert.equal((await J(await t.bridge.verify(fromGames('/api/student-games/verify', { gameId: 'virtual-violin', code: a.share.code, client: 'k', release: '2026-S2' })))).ok, false);
  assert.equal((await J(await t.bridge.check(fromGames('/api/student-games/check', { gameId: 'virtual-violin', sid: s1.sid, release: '2026-S2' })))).ok, false);
  const c = await J(await t.share.POST(teacher('year', { gameId: 'virtual-violin', action: 'revoke' })));
  assert.equal(c.share, null);
  assert.equal((await J(await t.bridge.verify(fromGames('/api/student-games/verify', { gameId: 'virtual-violin', code: b.share.code, client: 'k', release: '2026-S2' })))).ok, false);
});

test('انتهاء اشتراك المعلم الفصلي يُنهي رموزه تلقائيًا دون المساس ببياناته', async () => {
  const t = setup(); await withRelease(t);
  const a = await J(await t.share.POST(teacher('sem', { gameId: 'virtual-violin' })));
  const saved = clock; clock = new Date('2027-02-01T00:00:00Z');
  const r = await J(await t.bridge.verify(fromGames('/api/student-games/verify', { gameId: 'virtual-violin', code: a.share.code, client: 'z', release: '2026-S2' })));
  assert.deepEqual([r.ok, r.error], [false, 'expired']);
  clock = saved;
});

test('الإصدارات الفصلية: الحالي يعمل، الانتقالي حتى تاريخه، الموقوف ← «release-stopped»، والرمز نفسه يعمل في الإصدار الجديد', async () => {
  const t = setup();
  await t.store.config.set({ releases: [
    { id: '2026-S2', url: 'https://games-s2.example', status: 'transition', until: '2027-02-15T00:00:00Z' },
    { id: '2027-S1', url: 'https://games-2027-s1.example', status: 'active' },
    { id: '2026-S1', url: 'https://games-s1.example', status: 'stopped' }] });
  const a = await J(await t.share.POST(teacher('year', { gameId: 'virtual-violin' })));
  assert.equal(a.link, 'https://games-2027-s1.example/games/virtual-violin');      // روابط المشاركة تتبع الإصدار الحالي
  const v = (rel) => t.bridge.verify(fromGames('/api/student-games/verify', { gameId: 'virtual-violin', code: a.share.code, client: 'r', release: rel })).then(J);
  assert.equal((await v('2027-S1')).ok, true);
  assert.equal((await v('2026-S2')).ok, true);
  assert.equal((await v('2026-S1')).error, 'release-stopped');
  assert.equal((await v('unknown')).error, 'release-stopped');
  const cfg = normalizeConfig(await t.store.config.get());
  assert.equal(releaseAccepts(cfg, '2026-S2', new Date('2027-03-01')), false);    // انتهت الفترة الانتقالية
});

test('إعداد الإصدارات: للمدير فقط، ويرفض أكثر من إصدار «حالي» أو عنوانًا غير صالح', async () => {
  const t = setup();
  const body = { releases: [{ id: '2027-S1', url: 'https://g.example/', status: 'active' }] };
  assert.equal((await t.cfg.POST(req('/api/student-games/config', body, { authorization: 'Bearer tok-year' }))).status, 403);
  const ok = await J(await t.cfg.POST(req('/api/student-games/config', body, { authorization: 'Bearer tok-admin' })));
  assert.equal(ok.ok, true); assert.equal(ok.config.releases[0].url, 'https://g.example');
  assert.equal(validateConfig({ releases: [{ id: 'a', url: 'https://a.x', status: 'active' }, { id: 'b', url: 'https://b.x', status: 'active' }] }).error, 'one-active');
  assert.equal(validateConfig({ releases: [{ id: 'a', url: 'javascript:alert(1)', status: 'active' }] }).error, 'bad-url');
});

test('قائمة رموزي: تعرض الرموز النشطة فقط مع روابطها', async () => {
  const t = setup(); await withRelease(t);
  await t.share.POST(teacher('year', { gameId: 'virtual-violin' }));
  await t.share.POST(teacher('year', { gameId: 'omani-rhythms' }));
  await t.share.POST(teacher('year', { gameId: 'omani-rhythms', action: 'revoke' }));
  const l = await J(await t.share.GET(teacher('year')));
  assert.equal(l.shares.length, 1); assert.equal(l.shares[0].gameId, 'virtual-violin'); assert.match(l.shares[0].code, /^\d{6}$/);
});
