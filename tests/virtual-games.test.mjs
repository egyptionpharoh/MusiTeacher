// اختبارات طبقة حماية الألعاب:  node --test tests/virtual-games.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { makeSessionHandler, makePlayHandler } from '../src/lib/virtual-games/handlers.js';
import { signSession, cookieName } from '../src/lib/virtual-games/guard.js';

const SECRET = 'test-secret-test-secret-1234';
const future = new Date(Date.now() + 86400e3), past = new Date(Date.now() - 86400e3);
const USERS = {
  sub: { role: 'user', isSubscribed: true, subscriptionEndDate: future },
  expired: { role: 'user', isSubscribed: true, subscriptionEndDate: past },
  free: { role: 'user', isSubscribed: false, subscriptionEndDate: null },
  admin: { role: 'admin', isSubscribed: false, subscriptionEndDate: null },
};
const deps = {
  secret: () => SECRET,
  verifyIdToken: async (t) => { if (!t.startsWith('good-')) throw new Error('bad'); return { uid: t.slice(5) }; },
  findUser: async (uid) => USERS[uid] || null,
};
const HOST = 'musiteacher.test';
const post = (body, headers = {}) => new Request(`https://${HOST}/api/virtual-games/session`, {
  method: 'POST', headers: { host: HOST, 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
const session = makeSessionHandler(deps);
const ctx = (gameId, p) => ({ params: Promise.resolve({ gameId, path: p }) });

function cookieFor(gameId, over = {}) {
  const v = signSession({ g: gameId, u: 'sub', exp: Math.floor(Date.now() / 1000) + 600, ...over }, over.secret || SECRET);
  return `${cookieName(gameId)}=${v}`;
}
const get = (url, headers = {}) => new Request(`https://${HOST}${url}`, { headers: { host: HOST, 'sec-fetch-dest': 'iframe', 'sec-fetch-site': 'same-origin', ...headers } });
const ROOT = path.resolve('private-games');
const play = makePlayHandler({ secret: () => SECRET, root: ROOT });

test('session: بدون توكن → 401', async () => {
  assert.equal((await session(post({ gameId: 'xylophone' }))).status, 401);
});
test('session: توكن غير صالح → 401', async () => {
  assert.equal((await session(post({ gameId: 'xylophone' }, { authorization: 'Bearer nope' }))).status, 401);
});
test('session: مستخدم غير مشترك → 403 وبدون كوكي', async () => {
  const r = await session(post({ gameId: 'xylophone' }, { authorization: 'Bearer good-free' }));
  assert.equal(r.status, 403); assert.equal(r.headers.get('set-cookie'), null);
});
test('session: اشتراك منتهٍ → 403', async () => {
  assert.equal((await session(post({ gameId: 'xylophone' }, { authorization: 'Bearer good-expired' }))).status, 403);
});
test('session: مستخدم غير موجود في القاعدة → 403', async () => {
  assert.equal((await session(post({ gameId: 'xylophone' }, { authorization: 'Bearer good-ghost' }))).status, 403);
});
test('session: مشترك → 200 + كوكي HttpOnly/SameSite=Strict/Path صحيح', async () => {
  const r = await session(post({ gameId: 'xylophone' }, { authorization: 'Bearer good-sub' }));
  assert.equal(r.status, 200);
  const c = r.headers.get('set-cookie');
  assert.match(c, /HttpOnly/); assert.match(c, /SameSite=Strict/); assert.match(c, /Path=\/play\/xylophone\//);
  assert.equal((await r.json()).playUrl, '/play/xylophone/index.html');
});
test('session: أدمن → 200', async () => {
  assert.equal((await session(post({ gameId: 'xylophone' }, { authorization: 'Bearer good-admin' }))).status, 200);
});
test('session: لعبة غير موجودة / معرّف ملغوم → 404', async () => {
  assert.equal((await session(post({ gameId: 'nope' }, { authorization: 'Bearer good-sub' }))).status, 404);
  assert.equal((await session(post({ gameId: '../x' }, { authorization: 'Bearer good-sub' }))).status, 404);
});
test('session: Origin من موقع آخر → 403', async () => {
  const r = await session(post({ gameId: 'xylophone' }, { authorization: 'Bearer good-sub', origin: 'https://evil.example' }));
  assert.equal(r.status, 403);
});
test('session: بدون سر خادم → 503 (نفشل مغلقين)', async () => {
  const h = makeSessionHandler({ ...deps, secret: () => null });
  assert.equal((await h(post({ gameId: 'xylophone' }, { authorization: 'Bearer good-sub' }))).status, 503);
});

test('play: بدون كوكي → 401', async () => {
  assert.equal((await play(get('/play/xylophone/index.html'), ctx('xylophone', ['index.html']))).status, 401);
});
test('play: كوكي للعبة أخرى → 401', async () => {
  const r = await play(get('/play/xylophone/index.html', { cookie: cookieFor('piano-scales') }), ctx('xylophone', ['index.html']));
  assert.equal(r.status, 401);
});
test('play: كوكي مزوّر / موقّع بسر آخر / منتهٍ → 401', async () => {
  for (const c of [cookieFor('xylophone', { secret: 'another-secret-another-secret' }), cookieFor('xylophone', { exp: 5 }), cookieFor('xylophone') + 'x']) {
    assert.equal((await play(get('/play/xylophone/index.html', { cookie: c }), ctx('xylophone', ['index.html']))).status, 401);
  }
});
test('play: فتح مباشر في تبويب (Sec-Fetch-Dest: document) → 403 حتى مع كوكي صالح', async () => {
  const r = await play(get('/play/xylophone/index.html', { cookie: cookieFor('xylophone'), 'sec-fetch-dest': 'document', 'sec-fetch-site': 'none' }), ctx('xylophone', ['index.html']));
  assert.equal(r.status, 403);
});
test('play: طلب من موقع آخر → 403', async () => {
  const r = await play(get('/play/xylophone/index.html', { cookie: cookieFor('xylophone'), 'sec-fetch-site': 'cross-site' }), ctx('xylophone', ['index.html']));
  assert.equal(r.status, 403);
});
test('play: iframe + كوكي صالح → 200 مع علامة الملكية وترويسات الأمان', async () => {
  const r = await play(get('/play/xylophone/index.html', { cookie: cookieFor('xylophone') }), ctx('xylophone', ['index.html']));
  assert.equal(r.status, 200);
  const t = await r.text();
  assert.match(t, /© MusiTeacher – All Rights Reserved – 2026/);
  assert.match(t, /contextmenu/);
  assert.equal(r.headers.get('cache-control'), 'private, no-store');
  assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
  assert.match(r.headers.get('content-security-policy'), /frame-ancestors 'self'/);
  assert.match(r.headers.get('x-robots-tag'), /noindex/);
});
test('play: المسار الفارغ يخدم ملف التشغيل', async () => {
  const r = await play(get('/play/xylophone', { cookie: cookieFor('xylophone') }), ctx('xylophone', undefined));
  assert.equal(r.status, 200);
});
test('play: محاولات تسلّل المسارات كلها 404', async () => {
  const bad = [['..', 'oud-3d', 'index.html'], ['%2e%2e', 'oud-3d', 'index.html'], ['..%2foud-3d%2findex.html'], ['.env'], ['..%5c..%5cpackage.json'], ['index.html%00.png'], ['/etc/passwd'], ['C:', 'x'], ['a', '..', '..', 'package.json']];
  for (const p of bad) {
    const r = await play(get('/play/xylophone/' + p.join('/'), { cookie: cookieFor('xylophone') }), ctx('xylophone', p));
    assert.equal(r.status, 404, JSON.stringify(p));
  }
});
test('play: ملفات خارج القائمة البيضاء (.map/.md/.sh) → 404', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pg-'));
  fs.mkdirSync(path.join(dir, 'xylophone')); for (const f of ['index.html', 'a.map', 'b.md', 'c.sh']) fs.writeFileSync(path.join(dir, 'xylophone', f), 'x');
  const h = makePlayHandler({ secret: () => SECRET, root: dir });
  for (const f of ['a.map', 'b.md', 'c.sh']) assert.equal((await h(get('/play/xylophone/' + f, { cookie: cookieFor('xylophone') }), ctx('xylophone', [f]))).status, 404, f);
});
test('play: رابط رمزي يخرج من مجلد اللعبة → 404', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pg-'));
  fs.mkdirSync(path.join(dir, 'xylophone')); fs.writeFileSync(path.join(dir, 'secret.js'), 'secret');
  fs.symlinkSync(path.join(dir, 'secret.js'), path.join(dir, 'xylophone', 'leak.js'));
  const h = makePlayHandler({ secret: () => SECRET, root: dir });
  assert.equal((await h(get('/play/xylophone/leak.js', { cookie: cookieFor('xylophone') }), ctx('xylophone', ['leak.js']))).status, 404);
});
test('play: ملفات اللعبة الثانوية (js/png) بنوع MIME صحيح + Range', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pg-'));
  fs.mkdirSync(path.join(dir, 'xylophone', 'src'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'xylophone', 'src', 'm.js'), 'export const a=1;');
  fs.writeFileSync(path.join(dir, 'xylophone', 's.mp3'), Buffer.alloc(100, 7));
  const h = makePlayHandler({ secret: () => SECRET, root: dir });
  const c = cookieFor('xylophone');
  const js = await h(get('/play/xylophone/src/m.js', { cookie: c, 'sec-fetch-dest': 'script' }), ctx('xylophone', ['src', 'm.js']));
  assert.equal(js.status, 200); assert.match(js.headers.get('content-type'), /javascript/); assert.equal(await js.text(), 'export const a=1;');
  const r = await h(get('/play/xylophone/s.mp3', { cookie: c, range: 'bytes=10-19', 'sec-fetch-dest': 'audio' }), ctx('xylophone', ['s.mp3']));
  assert.equal(r.status, 206); assert.equal(r.headers.get('content-range'), 'bytes 10-19/100'); assert.equal((await r.arrayBuffer()).byteLength, 10);
});
test('play: لعبة غير موجودة → 404', async () => {
  assert.equal((await play(get('/play/zzz/index.html', { cookie: cookieFor('zzz') }), ctx('zzz', ['index.html']))).status, 404);
});

// ---------- المجلد المشترك _shared (محرك الصوت والعينات) ----------
test('_shared: يُخدم بكوكي لعبة صالح، ويُرفض بدونه', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pg-'));
  fs.mkdirSync(path.join(dir, 'xylophone')); fs.writeFileSync(path.join(dir, 'xylophone', 'index.html'), '<html></html>');
  fs.mkdirSync(path.join(dir, '_shared', 'samples', 'violin'), { recursive: true });
  fs.writeFileSync(path.join(dir, '_shared', 'mt-sampler.js'), 'window.X=1');
  fs.writeFileSync(path.join(dir, '_shared', 'samples', 'violin', 'A4.mp3'), Buffer.alloc(50, 1));
  const h = makePlayHandler({ secret: () => SECRET, root: dir });
  const ok = await h(get('/play/xylophone/_shared/mt-sampler.js', { cookie: cookieFor('xylophone'), 'sec-fetch-dest': 'script' }), ctx('xylophone', ['_shared', 'mt-sampler.js']));
  assert.equal(ok.status, 200); assert.match(ok.headers.get('content-type'), /javascript/);
  const mp3 = await h(get('/play/xylophone/_shared/samples/violin/A4.mp3', { cookie: cookieFor('xylophone'), 'sec-fetch-dest': 'empty' }), ctx('xylophone', ['_shared', 'samples', 'violin', 'A4.mp3']));
  assert.equal(mp3.status, 200); assert.equal(mp3.headers.get('content-type'), 'audio/mpeg');
  const no = await h(get('/play/xylophone/_shared/mt-sampler.js', { 'sec-fetch-dest': 'script' }), ctx('xylophone', ['_shared', 'mt-sampler.js']));
  assert.equal(no.status, 401);
});
test('_shared: تسلّل المسارات والرابط الرمزي والمسار الفارغ → 404', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pg-'));
  fs.mkdirSync(path.join(dir, 'xylophone')); fs.writeFileSync(path.join(dir, 'xylophone', 'index.html'), 'x');
  fs.mkdirSync(path.join(dir, '_shared')); fs.writeFileSync(path.join(dir, 'secret.js'), 'secret');
  fs.symlinkSync(path.join(dir, 'secret.js'), path.join(dir, '_shared', 'leak.js'));
  const h = makePlayHandler({ secret: () => SECRET, root: dir });
  const c = cookieFor('xylophone');
  for (const segs of [['_shared'], ['_shared', '..', 'secret.js'], ['_shared', 'leak.js'], ['_shared', '..%2Fsecret.js'], ['_shared', '.hidden']]) {
    assert.equal((await h(get('/play/xylophone/' + segs.join('/'), { cookie: c, 'sec-fetch-dest': 'script' }), ctx('xylophone', segs))).status, 404, segs.join('/'));
  }
});
test('_shared: لا يمكن تسجيل لعبة بمعرّف _shared', async () => {
  const { isValidGameId } = await import('../src/data/virtualGames.js');
  assert.equal(isValidGameId('_shared'), false);
});

// ---------- لعبة الأكورديون ثلاثية الأبعاد ----------
import fsAcc from 'node:fs';
import pathAcc from 'node:path';
test('accordion-3d: مسجّلة في السجل المشترك ولها غلاف وصفحة دخول', async () => {
  const { VIRTUAL_GAMES } = await import('../src/data/virtualGames.js');
  const g = VIRTUAL_GAMES.find((x) => x.id === 'accordion-3d');
  assert.ok(g && g.status === 'available' && g.settings.threeD);
  assert.ok(fsAcc.existsSync(pathAcc.join(process.cwd(), 'public', g.cover)));
  assert.ok(fsAcc.existsSync(pathAcc.join(process.cwd(), 'private-games', 'accordion-3d', g.entry)));
});
test('accordion-3d: يخدم ملفاته والنموذج والعينات المشتركة ويرفض التسلل', async () => {
  const { resolveGameFile, gamesRoot } = await import('../src/lib/virtual-games/serve.js');
  const root = gamesRoot();
  assert.ok(resolveGameFile(root, 'accordion-3d', []));
  assert.ok(resolveGameFile(root, 'accordion-3d', ['src', 'main.js']));
  assert.ok(resolveGameFile(root, 'accordion-3d', ['_shared', '3d', 'models', 'character-girl.fbx']));
  assert.ok(resolveGameFile(root, 'accordion-3d', ['_shared', 'samples', 'accordion', 'A4.mp3']));
  assert.equal(resolveGameFile(root, 'accordion-3d', ['..', 'violinist-3d', 'index.html']), null);
  assert.equal(resolveGameFile(root, 'accordion-3d', ['_shared', '..', '..', 'package.json']), null);
  assert.equal(resolveGameFile(root, 'accordion-3d', ['src', 'nonexistent.js']), null);
});
