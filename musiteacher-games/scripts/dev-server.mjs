#!/usr/bin/env node
// خادم تجربة محلي يحاكي Vercel بدقة: نفس المعالجات الحقيقية + نفس قواعد vercel.json (إعادة التوجيه، الملفات الثابتة، rewrites، headers):
//   node scripts/dev-server.mjs            ← http://localhost:5400
// الإعدادات من ملف .env.local داخل مجلد musiteacher-games (انظر README-ar.md).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, MIME } from '../lib/core.mjs';

const envFile = path.join(ROOT, '.env.local');
if (fs.existsSync(envFile)) for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
  const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line); if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const { makeHandlers } = await import('../lib/handlers.mjs');
const { makeRouter } = await import('./vercel-router.mjs');
const h = makeHandlers();
const PORT = +(process.env.PORT || 5400);
const router = makeRouter(ROOT);   // يقرأ vercel.json ويطبّق قواعده كما يفعل Vercel

http.createServer(async (req, res) => {
  try {
    const u = new URL(req.url, 'http://x');
    const r = router.route(u.pathname, u.search);
    if (r.redirect) { res.writeHead(r.status, { Location: r.redirect }); return res.end(); }
    if (r.fn) {
      for (const [k, v] of Object.entries(r.headers)) res.setHeader(k, v);
      req.url = `/api/${r.fn}?${r.query.toString()}`;
      if (typeof h[r.fn] !== 'function') { res.writeHead(404); return res.end('غير موجود'); }
      return await h[r.fn](req, res);
    }
    if (r.file) {
      res.writeHead(200, { ...r.headers, 'Content-Type': MIME[path.extname(r.file)] || 'application/octet-stream' });
      return res.end(fs.readFileSync(r.file));
    }
    res.writeHead(404, { ...r.headers, 'Content-Type': 'text/plain; charset=utf-8' }); res.end('غير موجود');
  } catch (e) { console.error(e); res.writeHead(500); res.end('خطأ'); }
}).listen(PORT, () => console.log(`MusiTeacher Games (محلي، بنفس قواعد vercel.json) على http://localhost:${PORT}`));
