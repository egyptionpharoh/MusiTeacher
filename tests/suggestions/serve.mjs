// خادم اختبار: الواجهة المبنية + /api/suggestions و /api/admin/suggestions بالمعالجات الحقيقية وتخزين في الذاكرة.
// يكشف /__store لفحص ما حُفظ فعلًا (لا يوجد في المنصة).
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { makeSuggestionHandlers } from '../../src/lib/suggestions/handlers.js';
const dir = path.dirname(fileURLToPath(import.meta.url)); const dist = path.join(dir, '_dist'); const port = +(process.env.PORT || 5360);
const docs = new Map(), guard = new Map(); let seq = 0; const days = new Map(); const seenHeaders = [];
const store = {
  async nextSeq() { return ++seq; }, async bumpDaily(d) { const n = (days.get(d) || 0) + 1; days.set(d, n); return n; },
  async claim(k, e) { if (guard.has(k)) return false; guard.set(k, e); return true; }, async insert(d) { docs.set(d._id, { ...d }); },
  async list({ archived, limit }) { return [...docs.values()].filter((d) => !!d.archived === !!archived).sort((a, b) => b.seq - a.seq).slice(0, limit); },
  async counts() { const o = { inbox: 0, archived: 0, new: 0, read: 0, review: 0, done: 0 }; for (const d of docs.values()) { if (d.archived) o.archived++; else { o.inbox++; o[d.status]++; } } return o; },
  async update(id, p) { const d = docs.get(id); if (!d) return false; Object.assign(d, p); return true; }, async remove(id) { return docs.delete(id); },
};
const users = { 'admin-uid': { role: 'admin' }, 'teacher-uid': { role: 'user' } };
const tokens = { 'tok-admin': { uid: 'admin-uid', email: 'hussien.elmalek@gmail.com' }, 'tok-teacher': { uid: 'teacher-uid', email: 'teacher@example.com' } };
const h = makeSuggestionHandlers({ store, env: { SUGGESTIONS_SECRET: 'test-secret-0123456789abcdef' }, verifyIdToken: async (t) => { if (!tokens[t]) throw new Error('bad'); return tokens[t]; }, findUser: async (u) => users[u] || null });
const T = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname.startsWith('/api/')) {
    if (url.pathname === '/api/suggestions' && req.method === 'POST') seenHeaders.push({ authorization: req.headers.authorization || null, cookie: req.headers.cookie || null });
    const chunks = []; for await (const c of req) chunks.push(c);
    const request = new Request(url, { method: req.method, headers: req.headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(chunks) });
    let r;
    if (url.pathname === '/api/suggestions') r = req.method === 'GET' ? await h.issueToken() : await h.submit(request);
    else if (url.pathname === '/api/admin/suggestions') r = req.method === 'GET' ? await h.adminList(request) : req.method === 'PATCH' ? await h.adminPatch(request) : await h.adminDelete(request);
    else r = new Response('nf', { status: 404 });
    res.writeHead(r.status, Object.fromEntries(r.headers)); return res.end(Buffer.from(await r.arrayBuffer()));
  }
  if (url.pathname === '/__store') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ docs: [...docs.values()], guard: [...guard.keys()], seenHeaders })); }
  let p = url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname);
  const file = path.join(dist, p);
  fs.readFile(file, (err, buf) => { if (err) { res.writeHead(404); return res.end('nf'); } res.writeHead(200, { 'content-type': T[path.extname(file)] || 'application/octet-stream' }); res.end(buf); });
}).listen(port, () => console.log('serving on', port));
