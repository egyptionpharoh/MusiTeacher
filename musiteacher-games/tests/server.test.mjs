// اختبار خادم MusiTeacher Games بجسر وهمي (بلا إنترنت):  node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { makeHandlers } from '../lib/handlers.mjs';
import { normalizeCode, signSession, verifySession, resolveGameFile } from '../lib/core.mjs';

// لعبة تجريبية في مجلد مؤقت
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mtg-'));
fs.mkdirSync(path.join(dir, 'demo', 'js'), { recursive: true }); fs.mkdirSync(path.join(dir, '_shared'), { recursive: true });
fs.writeFileSync(path.join(dir, 'demo', 'index.html'), '<!doctype html><html><head><title>d</title></head><body>DEMO-GAME</body></html>');
fs.writeFileSync(path.join(dir, 'demo', 'js', 'app.js'), 'console.log(1)');
fs.writeFileSync(path.join(dir, 'demo', 'secret.md'), 'no');
fs.writeFileSync(path.join(dir, 'demo', 'app.js.map'), '{}');
fs.writeFileSync(path.join(dir, '_shared', 'lib.js'), 'export {}');
fs.writeFileSync(path.join(os.tmpdir(), 'outside.txt'), 'x'); try { fs.symlinkSync(path.join(os.tmpdir(), 'outside.txt'), path.join(dir, 'demo', 'link.txt')); } catch { /* */ }

const GAMES = { demo: { id: 'demo', title: 'Demo', status: 'published', entry: 'index.html', settings: { markCorner: 'bottom-left' } }, other: { id: 'other', title: 'O', status: 'published', entry: 'index.html' } };
const cfg = { release: '2026-S2', sessionSecret: 's'.repeat(32), musiteacherUrl: 'http://mt', bridgeSecret: 'b'.repeat(30), secure: false };
const calls = [];
const state = { revoked: false };
const bridge = {
  async verify(g, code, client) { calls.push(['verify', g, code, client]); return code === '482915' && g === 'demo' ? { ok: true, sid: 'S1', exp: Math.floor(Date.now() / 1000) + 3 * 86400 } : { ok: false, error: code === '111222' ? 'expired' : 'invalid' }; },
  async check(g, sid) { calls.push(['check', g, sid]); return state.revoked ? { ok: false, error: 'invalid' } : { ok: true, exp: Math.floor(Date.now() / 1000) + 86400 }; },
};
const h = makeHandlers({ config: cfg, bridge, gamesDir: dir, getGame: (id) => GAMES[id] || null });
const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname === '/api/enter') return h.enter(req, res);
  if (u.pathname === '/api/session') return h.session(req, res);
  const g = /^\/g\/([^/]+)\/(.*)$/.exec(u.pathname);
  if (g) { req.url = `/api/play?id=${g[1]}&p=${encodeURIComponent(g[2])}`; return h.play(req, res); }
  res.writeHead(404); res.end();
});
await new Promise((r) => server.listen(0, r));
const base = `http://127.0.0.1:${server.address().port}`;
test.after(() => server.close());

const enter = (game, code, headers = {}) => fetch(base + '/api/enter', { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify({ game, code }) });
const cookieOf = (r) => (r.headers.get('set-cookie') || '').split(';')[0];
const iframe = { 'sec-fetch-dest': 'iframe' };

test('الرمز: يقبل الأرقام العربية والمسافات، ويرفض غير ذلك', () => {
  assert.equal(normalizeCode(' ٤٨٢-٩١٥ '), '482915'); assert.equal(normalizeCode('۴۸۲۹۱۵'), '482915');
  assert.equal(normalizeCode('48291'), null); assert.equal(normalizeCode('abcdef'), null);
});

test('بدون رمز: لا تُفتح اللعبة ولا أي ملف منها', async () => {
  const r = await fetch(base + '/g/demo/', { redirect: 'manual', headers: iframe });
  assert.equal(r.status, 302); assert.equal(r.headers.get('location'), '/games/demo');
  assert.equal((await fetch(base + '/g/demo/js/app.js', { headers: iframe })).status, 401);
  assert.equal((await (await fetch(base + '/api/session?game=demo')).json()).ok, false);
});

test('رمز خاطئ ← رسالة لطيفة بلا تفاصيل تقنية؛ صيغة خاطئة لا تصل إلى MusiTeacher', async () => {
  const r = await enter('demo', '123987'); const d = await r.json();
  assert.equal(r.status, 401); assert.equal(d.ok, false); assert.match(d.message, /الرمز غير صحيح/);
  assert.ok(!/bridge|secret|mongo|api/i.test(JSON.stringify(d)));
  const n = calls.length; const f = await (await enter('demo', '12')).json();
  assert.equal(f.error, 'format'); assert.equal(calls.length, n);
  assert.match((await (await enter('demo', '111222')).json()).message, /انتهت صلاحية/);
});

test('رمز صحيح ← جلسة؛ اللعبة وملفاتها تُفتح داخل الصفحة، والتحديث لا يطلب الرمز', async () => {
  const r = await enter('demo', '٤٨٢٩١٥'); const d = await r.json();
  assert.equal(d.ok, true); assert.equal(d.play, '/g/demo/index.html');   // اسم الملف صريح: المسارات النسبية تُحسب من مجلد اللعبة
  const c = cookieOf(r); assert.match(c, /^mtg_demo=/);
  assert.match(r.headers.get('set-cookie'), /HttpOnly/); assert.match(r.headers.get('set-cookie'), /SameSite=Lax/);
  const s = await (await fetch(base + '/api/session?game=demo', { headers: { cookie: c } })).json();
  assert.equal(s.ok, true); assert.ok(s.expiresIn > 7 * 3600 && s.expiresIn <= 8 * 3600);   // جلسة حتى 8 ساعات
  // طلب اللعبة بلا اسم ملف داخل الإطار ← تحويل للرابط الصريح
  const bare = await fetch(base + '/g/demo/', { redirect: 'manual', headers: { cookie: c, ...iframe } });
  assert.equal(bare.status, 302); assert.equal(bare.headers.get('location'), '/g/demo/index.html');
  const page = await fetch(base + '/g/demo/index.html', { headers: { cookie: c, ...iframe } });
  const html = await page.text();
  assert.equal(page.status, 200); assert.match(html, /DEMO-GAME/); assert.match(html, /mt-ip-mark/); assert.match(html, /noindex/);
  assert.equal(page.headers.get('content-security-policy'), "frame-ancestors 'self'");
  assert.equal((await fetch(base + '/g/demo/js/app.js', { headers: { cookie: c } })).status, 200);
  assert.equal((await fetch(base + '/g/demo/_shared/lib.js', { headers: { cookie: c } })).status, 200);
  // فتح ملف اللعبة مباشرة في تبويب ← يعود إلى صفحة اللعبة (لا تُعرض خارج غلافها)
  assert.equal((await fetch(base + '/g/demo/', { redirect: 'manual', headers: { cookie: c, 'sec-fetch-dest': 'document' } })).status, 302);
});

test('الحماية: جلسة لعبة لا تفتح لعبة أخرى، ولا ملفات مخفية/.md/.map، ولا تسلل للمسارات أو الروابط الرمزية', async () => {
  const c = cookieOf(await enter('demo', '482915'));
  assert.equal((await fetch(base + '/g/other/', { redirect: 'manual', headers: { cookie: c, ...iframe } })).status, 302);
  for (const p of ['secret.md', 'app.js.map', '..%2F..%2Fetc%2Fpasswd', '%2e%2e/x', 'link.txt', '.env']) {
    assert.equal((await fetch(base + '/g/demo/' + p, { headers: { cookie: c } })).status, 404, p);
  }
  assert.equal(resolveGameFile(dir, 'demo', '../other/index.html'), null);
});

test('الجلسة الموقّعة: التلاعب أو تغيير الإصدار أو اللعبة يبطلها', () => {
  const t = signSession({ g: 'demo', s: 'S1', r: '2026-S2', exp: Math.floor(Date.now() / 1000) + 60 }, cfg.sessionSecret);
  assert.ok(verifySession(t, 'demo', '2026-S2', cfg.sessionSecret));
  assert.equal(verifySession(t, 'demo', '2027-S1', cfg.sessionSecret), null);   // إصدار فصلي جديد = جلسة جديدة
  assert.equal(verifySession(t, 'other', '2026-S2', cfg.sessionSecret), null);
  assert.equal(verifySession(t.slice(0, -2) + 'xx', 'demo', '2026-S2', cfg.sessionSecret), null);
  assert.equal(verifySession(t, 'demo', '2026-S2', 'x'.repeat(32)), null);
});

test('إلغاء المعلم للرمز: يسري عند إعادة التحقق الدورية، دون قطع ملفات اللعب الجارية فورًا', async () => {
  const stale = signSession({ g: 'demo', s: 'S1', r: '2026-S2', exp: Math.floor(Date.now() / 1000) + 3600, chk: 0 }, cfg.sessionSecret);
  const c = `mtg_demo=${stale}`;
  state.revoked = true;
  const s = await (await fetch(base + '/api/session?game=demo', { headers: { cookie: c } })).json();
  assert.equal(s.ok, false); assert.equal(s.ended, true); assert.match(s.message, /انتهت صلاحية/);
  assert.equal((await fetch(base + '/g/demo/js/app.js', { headers: { cookie: c } })).status, 200);   // ما زالت الجلسة الجارية تكمل
  state.revoked = false;
});

test('الحد المحلي من المحاولات: أكثر من 12 محاولة في 10 دقائق ← انتظار', async () => {
  let last;
  for (let i = 0; i < 14; i++) last = await enter('demo', '999' + String(100 + i), { 'x-real-ip': '10.9.9.9' });
  assert.equal(last.status, 429); assert.match((await last.json()).message, /انتظر/);
});

test('تقوية: أي ملف يُفتح مباشرة في تبويب ← صفحة اللعبة؛ طلب من موقع آخر ← مرفوض', async () => {
  const c = cookieOf(await enter('demo', '482915'));
  const d = await fetch(base + '/g/demo/js/app.js', { redirect: 'manual', headers: { cookie: c, 'sec-fetch-dest': 'document', 'sec-fetch-site': 'none' } });
  assert.equal(d.status, 302); assert.equal(d.headers.get('location'), '/games/demo');
  const x = await fetch(base + '/g/demo/js/app.js', { headers: { cookie: c, 'sec-fetch-dest': 'script', 'sec-fetch-site': 'cross-site' } });
  assert.equal(x.status, 403);
  const ok = await fetch(base + '/g/demo/js/app.js', { headers: { cookie: c, 'sec-fetch-dest': 'script', 'sec-fetch-site': 'same-origin' } });
  assert.equal(ok.status, 200);
});

test('تقوية: صفحة اللعبة تحمل قفل النطاق أولًا + بصمة تتبّع للجلسة', async () => {
  const c = cookieOf(await enter('demo', '482915'));
  const html = await (await fetch(base + '/g/demo/index.html', { headers: { cookie: c, ...iframe } })).text();
  const guard = html.indexOf('mtg-guard'), game = html.indexOf('DEMO-GAME');
  assert.ok(guard > 0 && guard < game, 'قفل النطاق قبل أي محتوى للعبة');
  assert.match(html, /<meta name="mtg-t" content="[0-9a-f]{10}">/);
  assert.match(html, /data-t="[0-9a-f]{10}"/);
});

test('الجلسة لا تنقطع بعطل تقني مؤقت في MusiTeacher، وتنتهي فقط بجواب قاطع', async () => {
  const { makeHandlers: mk } = await import('../lib/handlers.mjs');
  const mkCfg = { ...cfg };
  let answer = { ok: false, error: 'server-error', detail: 'mt-server-error' };
  const hb = mk({ config: mkCfg, bridge: { verify: async () => ({ ok: true, sid: 'sid-9', exp: Math.floor(Date.now() / 1000) + 3600 }), check: async () => answer }, gamesDir: dir, getGame: (id) => GAMES[id] || null });
  const srv = http.createServer((q, s) => { const u = new URL(q.url, 'http://x'); if (u.pathname === '/api/enter') return hb.enter(q, s); if (u.pathname === '/api/session') return hb.session(q, s); s.end(); });
  await new Promise((r) => srv.listen(0, r)); const b2 = `http://localhost:${srv.address().port}`;
  const e = await fetch(b2 + '/api/enter', { method: 'POST', headers: { 'content-type': 'application/json', origin: b2 }, body: JSON.stringify({ game: 'demo', code: '482915' }) });
  const c = e.headers.get('set-cookie').split(';')[0];
  const { signSession, verifySession, readCookie, cookieName } = await import('../lib/core.mjs');
  const p = verifySession(readCookie(c, cookieName('demo')), 'demo', cfg.release, cfg.sessionSecret);
  const old = `${cookieName('demo')}=` + signSession({ ...p, chk: 0 }, cfg.sessionSecret);   // إجبار إعادة الفحص
  const s1 = await (await fetch(b2 + '/api/session?game=demo', { headers: { cookie: old } })).json();
  assert.equal(s1.ok, true, 'عطل تقني ← الطالب يكمل');
  answer = { ok: false, error: 'invalid' };
  const s2 = await (await fetch(b2 + '/api/session?game=demo', { headers: { cookie: old } })).json();
  assert.equal(s2.ok, false); assert.equal(s2.ended, true, 'رمز أُلغي ← تنتهي الجلسة');
  srv.close();
});
