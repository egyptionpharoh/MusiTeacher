// تكامل لعبة الإملاء الإيقاعي مع طبقة حماية الألعاب (المعالجات الحقيقية):
//   node --test tests/rhythm-dictation.integration.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { makeSessionHandler, makePlayHandler } from '../src/lib/virtual-games/handlers.js';
import { signSession, cookieName } from '../src/lib/virtual-games/guard.js';
import { getGame, publicGameInfo } from '../src/data/virtualGames.js';
import { gamesConfig } from '../src/lib/gamesConfig.js';

const SECRET = 'test-secret-test-secret-1234';
const future = new Date(Date.now() + 86400e3), past = new Date(Date.now() - 86400e3);
const USERS = { sub: { role: 'user', isSubscribed: true, subscriptionEndDate: future }, expired: { role: 'user', isSubscribed: true, subscriptionEndDate: past }, free: { role: 'user', isSubscribed: false } };
const deps = { secret: () => SECRET, verifyIdToken: async (t) => { if (!t.startsWith('good-')) throw new Error('bad'); return { uid: t.slice(5) }; }, findUser: async (u) => USERS[u] || null };
const HOST = 'musiteacher.test';
const session = makeSessionHandler(deps);
const play = makePlayHandler({ secret: () => SECRET, root: path.resolve('private-games') });
const post = (body, headers = {}) => new Request(`https://${HOST}/api/virtual-games/session`, { method: 'POST', headers: { host: HOST, 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
const ctx = (gameId, p) => ({ params: Promise.resolve({ gameId, path: p }) });
const cookie = (g) => `${cookieName(g)}=${signSession({ g, u: 'sub', exp: Math.floor(Date.now() / 1000) + 600 }, SECRET)}`;
const get = (url, headers = {}) => new Request(`https://${HOST}${url}`, { headers: { host: HOST, 'sec-fetch-dest': 'iframe', 'sec-fetch-site': 'same-origin', ...headers } });
const G = 'rhythm-dictation';

test('التسجيل: اللعبة في سجل الألعاب المحمية، وبطاقتها تفتح المشغّل المحمي (labId) لا المسار العام', () => {
  const g = getGame(G);
  assert.ok(g); assert.equal(g.status, 'available'); assert.equal(g.listInLab, false); assert.equal(g.category, 'notation');
  const info = publicGameInfo(g); assert.equal(info.allowDownloads, false);
  const card = gamesConfig.find((x) => x.id === G);
  assert.equal(card.labId, G); assert.equal(card.path, undefined);
  // اللعبة اللحنية كما هي
  assert.equal(gamesConfig.find((x) => x.id === 'melodic-dictation').labId, 'melodic-dictation');
  assert.ok(getGame('melodic-dictation'));
});

test('الجلسة: بدون توكن 401 · غير مشترك 403 · اشتراك منتهٍ 403 · مشترك 200 بكوكي خاص باللعبة', async () => {
  assert.equal((await session(post({ gameId: G }))).status, 401);
  assert.equal((await session(post({ gameId: G }, { authorization: 'Bearer good-free' }))).status, 403);
  assert.equal((await session(post({ gameId: G }, { authorization: 'Bearer good-expired' }))).status, 403);
  const r = await session(post({ gameId: G }, { authorization: 'Bearer good-sub' }));
  assert.equal(r.status, 200);
  assert.match(r.headers.get('set-cookie'), /Path=\/play\/rhythm-dictation\//);
  assert.match(r.headers.get('set-cookie'), /HttpOnly/);
  assert.equal((await r.json()).playUrl, '/play/rhythm-dictation/index.html');
});

test('الملفات: لا تُخدم بدون كوكي (401)، ولا بفتح الرابط مباشرة في تبويب (403)', async () => {
  assert.equal((await play(get('/play/rhythm-dictation/index.html'), ctx(G, ['index.html']))).status, 401);
  assert.equal((await play(get('/play/rhythm-dictation/js/rhythm.js'), ctx(G, ['js', 'rhythm.js']))).status, 401);
  const direct = get('/play/rhythm-dictation/index.html', { cookie: cookie(G), 'sec-fetch-dest': 'document' });
  assert.equal((await play(direct, ctx(G, ['index.html']))).status, 403);
});

test('الملفات: كوكي لعبة أخرى لا يفتح هذه اللعبة', async () => {
  const r = await play(get('/play/rhythm-dictation/index.html', { cookie: cookie('melodic-dictation').replace(cookieName('melodic-dictation'), cookieName(G)) }), ctx(G, ['index.html']));
  assert.equal(r.status, 401);
});

test('الملفات: داخل الإطار مع كوكي صالح تُخدم كل ملفات اللعبة، مع علامة الملكية ومنع الطباعة', async () => {
  const r = await play(get('/play/rhythm-dictation/index.html', { cookie: cookie(G) }), ctx(G, undefined));
  assert.equal(r.status, 200);
  const html = await r.text();
  assert.match(html, /mt-ip-mark/); assert.match(html, /@media print\{html\{display:none/);
  assert.match(html, /مسابقة التدوين والإملاء الإيقاعي/);
  assert.equal(r.headers.get('content-security-policy'), "frame-ancestors 'self'");
  for (const f of [['js', 'rhythm.js'], ['js', 'content.js'], ['js', 'glyphs.js'], ['js', 'audio.js'], ['js', 'app.js'], ['css', 'style.css']]) {
    const x = await play(get('/play/rhythm-dictation/' + f.join('/'), { cookie: cookie(G) }), ctx(G, f));
    assert.equal(x.status, 200, f.join('/'));
  }
});

test('الملفات: محاولات التسلل خارج المجلد مرفوضة', async () => {
  for (const p of [['..', 'melodic-dictation', 'index.html'], ['%2e%2e', 'x'], ['js', '..', '..', 'secret.txt'], ['.env']]) {
    const x = await play(get('/play/rhythm-dictation/' + p.join('/'), { cookie: cookie(G) }), ctx(G, p));
    assert.equal(x.status, 404, p.join('/'));
  }
});

test('اللعبة اللحنية ما زالت تُخدم كما كانت', async () => {
  const r = await play(get('/play/melodic-dictation/index.html', { cookie: cookie('melodic-dictation') }), ctx('melodic-dictation', undefined));
  assert.equal(r.status, 200);
  assert.match(await r.text(), /js\/app\.js/);
});
