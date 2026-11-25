// خادم ملفات ثابتة للاختبار فقط:  PORT=5370 node tests/excellence/serve.cjs
const http = require('http'); const fs = require('fs'); const path = require('path');
const dist = path.join(__dirname, '_dist'); const T = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.woff': 'font/woff' };
http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x'); const f = path.join(dist, u.pathname === '/' ? 'index.html' : decodeURIComponent(u.pathname));
  if (!f.startsWith(dist)) { res.writeHead(403); return res.end(); }
  fs.readFile(f, (e, b) => { if (e) { res.writeHead(404, { 'content-type': 'application/json' }); return res.end('{"ok":false,"code":"not-found"}'); } res.writeHead(200, { 'content-type': T[path.extname(f)] || 'application/octet-stream' }); res.end(b); });
}).listen(+(process.env.PORT || 5370), () => console.log('serving'));
