// تكامل «طريقة أداء الموازين الإيقاعية» مع طبقة حماية الألعاب (المعالجات الحقيقية):
//   node --test tests/time-signatures.integration.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
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
const G = 'time-signatures';

test('التسجيل: في سجل الألعاب المحمية (ثلاثية الأبعاد)، وبطاقتها بالمعرّف نفسه تفتح المشغّل المحمي (labId)', () => {
  const g = getGame(G);
  assert.ok(g); assert.equal(g.status, 'available'); assert.equal(g.listInLab, false); assert.equal(g.settings.threeD, true);
  assert.equal(publicGameInfo(g).allowDownloads, false);
  const card = gamesConfig.find((x) => x.id === G);
  assert.equal(card.title, 'طريقة أداء الموازين الإيقاعية'); assert.equal(card.labId, G); assert.equal(card.path, undefined);
  // الألعاب الأخرى كما هي
  assert.equal(gamesConfig.find((x) => x.id === 'rhythm-dictation').labId, 'rhythm-dictation');
  assert.equal(gamesConfig.find((x) => x.id === 'melodic-dictation').labId, 'melodic-dictation');
  assert.ok(getGame('accordion-3d'));
});

test('الجلسة: بدون توكن 401 · غير مشترك 403 · منتهٍ 403 · مشترك 200 بكوكي خاص باللعبة', async () => {
  assert.equal((await session(post({ gameId: G }))).status, 401);
  assert.equal((await session(post({ gameId: G }, { authorization: 'Bearer good-free' }))).status, 403);
  assert.equal((await session(post({ gameId: G }, { authorization: 'Bearer good-expired' }))).status, 403);
  const r = await session(post({ gameId: G }, { authorization: 'Bearer good-sub' }));
  assert.equal(r.status, 200);
  assert.match(r.headers.get('set-cookie'), /Path=\/play\/time-signatures\//);
  assert.equal((await r.json()).playUrl, '/play/time-signatures/index.html');
});

test('الملفات: بدون كوكي 401 (بما فيها النموذج المشترك)، والفتح المباشر في تبويب 403', async () => {
  assert.equal((await play(get('/play/time-signatures/index.html'), ctx(G, ['index.html']))).status, 401);
  assert.equal((await play(get('/play/time-signatures/src/conductor.js'), ctx(G, ['src', 'conductor.js']))).status, 401);
  assert.equal((await play(get('/play/time-signatures/_shared/3d/models/character-girl.fbx'), ctx(G, ['_shared', '3d', 'models', 'character-girl.fbx']))).status, 401);
  const direct = get('/play/time-signatures/index.html', { cookie: cookie(G), 'sec-fetch-dest': 'document' });
  assert.equal((await play(direct, ctx(G, ['index.html']))).status, 403);
  // كوكي لعبة أخرى لا يفتحها
  const other = cookie('accordion-3d').replace(cookieName('accordion-3d'), cookieName(G));
  assert.equal((await play(get('/play/time-signatures/index.html', { cookie: other }), ctx(G, ['index.html']))).status, 401);
});

test('الملفات: مع كوكي صالح داخل الإطار تُخدم كل ملفات اللعبة والشخصية المشتركة وthree.js، مع علامة الملكية', async () => {
  const r = await play(get('/play/time-signatures/index.html', { cookie: cookie(G) }), ctx(G, undefined));
  assert.equal(r.status, 200);
  const html = await r.text();
  assert.match(html, /mt-ip-mark/); assert.match(html, /طريقة أداء الموازين الإيقاعية/);
  assert.match(html, /"three": "\.\/_shared\/3d\/vendor\/three\/three\.module\.js"/);
  const files = [['src', 'main.js'], ['src', 'conductor.js'], ['src', 'life.js'], ['src', 'patterns.js'], ['src', 'transport.js'], ['src', 'audio.js'], ['src', 'ui.js'], ['src', 'config.js'], ['css', 'style.css'],
    ['audio', 'wood-a.mp3'], ['audio', 'wood-1.mp3'], ['audio', 'claves-a.mp3'], ['audio', 'claves-1.mp3'],
    ['_shared', '3d', 'character', 'seated-player.js'], ['_shared', '3d', 'character', 'face.js'], ['_shared', '3d', 'models', 'character-girl.fbx'], ['_shared', '3d', 'vendor', 'three', 'three.module.js']];
  for (const f of files) {
    const x = await play(get('/play/time-signatures/' + f.join('/'), { cookie: cookie(G) }), ctx(G, f));
    assert.equal(x.status, 200, f.join('/'));
    if (f[0] === 'audio') assert.equal(x.headers.get('content-type'), 'audio/mpeg');
  }
});

test('الملفات: محاولات التسلل مرفوضة، ولا يمكن الوصول إلى ملفات الأكورديون من هذه اللعبة', async () => {
  for (const p of [['..', 'accordion-3d', 'index.html'], ['..', 'accordion-3d', 'src', 'main.js'], ['%2e%2e', 'x'], ['src', '..', '..', 'secret.txt'], ['.env']]) {
    const x = await play(get('/play/time-signatures/' + p.join('/'), { cookie: cookie(G) }), ctx(G, p));
    assert.equal(x.status, 404, p.join('/'));
  }
});

test('الاستقلال: اللعبة لا تستورد شيئًا من مجلد الأكورديون، وتستورد الأساس المشترك فقط', () => {
  const dir = path.resolve('private-games/time-signatures/src');
  for (const f of fs.readdirSync(dir)) {
    const src = fs.readFileSync(path.join(dir, f), 'utf8');
    assert.doesNotMatch(src, /accordion-3d|\/character\/accordionist|\/character\/life\.js'|performer\.js|instrument\//, f);
    for (const m of src.matchAll(/from\s+'([^']+)'/g)) assert.ok(/^(three|three\/addons\/|\.\/|\.\.\/_shared\/3d\/)/.test(m[1]), f + ' → ' + m[1]);
  }
});

test('الأكورديون ما زال يُخدم كما كان', async () => {
  const r = await play(get('/play/accordion-3d/index.html', { cookie: cookie('accordion-3d') }), ctx('accordion-3d', undefined));
  assert.equal(r.status, 200);
  assert.match(await r.text(), /src\/main\.js/);
});

test('المسار العام القديم صار صفحة تحويل إلى المشغّل المحمي (لا نسخة مكشوفة من اللعبة)', () => {
  const f = path.resolve('public/games/time-signatures/index.html');
  if (!fs.existsSync(f)) return;
  const html = fs.readFileSync(f, 'utf8');
  assert.match(html, /url=\/dashboard\/resources\/lab\/time-signatures/);
  assert.ok(html.length < 1200);
});
