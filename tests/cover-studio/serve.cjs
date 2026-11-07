// خادم ملفات ثابت للاختبار. EMBLEM=<مسار صورة> يحاكي وجود الشعار الرسمي في public/brand/oman-emblem.png
const http = require('http'); const fs = require('fs'); const path = require('path');
const dist = path.join(__dirname, '_dist'); const port = +(process.env.PORT || 5320);
const T = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
http.createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/brand/oman-emblem.png') { if (process.env.EMBLEM && fs.existsSync(process.env.EMBLEM)) { res.writeHead(200, { 'content-type': 'image/png' }); return res.end(req.method === 'HEAD' ? undefined : fs.readFileSync(process.env.EMBLEM)); } res.writeHead(404, { 'content-type': 'text/html' }); return res.end('nf'); }
  const f = path.join(dist, p === '/' ? 'index.html' : p);
  if (f.startsWith(dist) && fs.existsSync(f) && fs.statSync(f).isFile()) { res.writeHead(200, { 'content-type': T[path.extname(f)] || 'application/octet-stream' }); return res.end(fs.readFileSync(f)); }
  res.writeHead(404); res.end('nf');
}).listen(port, '127.0.0.1', () => console.log('cover studio on ' + port));
