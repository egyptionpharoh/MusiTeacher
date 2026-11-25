// خادم اختبار: يخدم التطبيق لأي مسار (مثل Next) حتى نختبر فتح الأداة مباشرة من الرابط.  PORT=5380 node tests/tools-nav/serve.cjs
const http = require('http'); const fs = require('fs'); const path = require('path');
const dist = path.join(__dirname, '_dist'); const T = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.woff': 'font/woff', '.json': 'application/json' };
http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname.startsWith('/api/')) { res.writeHead(404, { 'content-type': 'application/json' }); return res.end('{"ok":false,"code":"not-found"}'); }
  let f = path.join(dist, decodeURIComponent(u.pathname));
  if (!f.startsWith(dist) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(dist, 'index.html');
  fs.readFile(f, (e, b) => { if (e) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': T[path.extname(f)] || 'application/octet-stream' }); res.end(b); });
}).listen(+(process.env.PORT || 5380), () => console.log('serving'));
