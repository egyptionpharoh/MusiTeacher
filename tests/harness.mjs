// خادم اختبار محلي يستعمل معالجات الإنتاج الحقيقية (بدون Next) + صفحات اختبار.   node tests/harness.mjs
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { makeSessionHandler, makePlayHandler } from '../src/lib/virtual-games/handlers.js';

const SECRET = 'harness-secret-harness-secret';
const USERS = { sub: { role: 'user', isSubscribed: true, subscriptionEndDate: new Date(Date.now() + 864e5) }, free: { role: 'user', isSubscribed: false } };
const deps = { secret: () => SECRET, verifyIdToken: async (t) => { if (!t.startsWith('good-')) throw new Error('x'); return { uid: t.slice(5) }; }, findUser: async (u) => USERS[u] || null };
const session = makeSessionHandler(deps), play = makePlayHandler({ secret: () => SECRET });
const toReq = async (req) => {
  const chunks = []; for await (const c of req) chunks.push(c);
  const h = new Headers(); for (const [k, v] of Object.entries(req.headers)) h.set(k, Array.isArray(v) ? v.join(', ') : v);
  return new Request(`http://${req.headers.host}${req.url}`, { method: req.method, headers: h, body: ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(chunks) });
};
const send = async (res, r) => {
  const h = {}; r.headers.forEach((v, k) => { h[k] = v; });
  const sc = r.headers.getSetCookie ? r.headers.getSetCookie() : []; if (sc.length) h['set-cookie'] = sc;
  res.writeHead(r.status, h); res.end(Buffer.from(await r.arrayBuffer()));
};
const STATIC = path.resolve(process.env.STATIC_DIR || '/home/claude/mt/_dist');
http.createServer(async (req, res) => {
  try {
    const u = new URL(req.url, 'http://x');
    if (u.pathname === '/api/virtual-games/session') return send(res, await session(await toReq(req)));
    const m = /^\/play\/([^/]+)(?:\/(.*))?$/.exec(u.pathname);
    if (m) return send(res, await play(await toReq(req), { params: Promise.resolve({ gameId: m[1], path: m[2] ? m[2].split('/') : undefined }) }));
    const f = path.join(STATIC, u.pathname === '/' ? 'index.html' : u.pathname);
    if (f.startsWith(STATIC) && fs.existsSync(f) && fs.statSync(f).isFile()) {
      const ext = path.extname(f); const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.jpg': 'image/jpeg', '.png': 'image/png', '.json': 'application/json' };
      res.writeHead(200, { 'content-type': types[ext] || 'application/octet-stream' }); return res.end(fs.readFileSync(f));
    }
    res.writeHead(404); res.end('nf');
  } catch (e) { res.writeHead(500); res.end(String(e)); }
}).listen(5300, () => console.log('harness on 5300'));
