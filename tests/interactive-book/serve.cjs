// خادم الاختبار: ملفات الواجهة + /vendor/pdfjs من public (نفس ما تقدمه Next في المنصة)
const http = require('http'); const fs = require('fs'); const path = require('path');
const dist = path.join(__dirname, '_dist'); const pub = path.resolve(__dirname, '../../public'); const port = +(process.env.PORT || 5350);
const T = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.wasm': 'application/wasm', '.bcmap': 'application/octet-stream', '.pfb': 'application/octet-stream', '.ttf': 'font/ttf', '.icc': 'application/octet-stream' };
http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/') p = '/index.html';
  const file = p.startsWith('/vendor/') ? path.join(pub, p) : path.join(dist, p);
  if (!file.startsWith(pub) && !file.startsWith(dist)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404); return res.end('nf'); }
    res.writeHead(200, { 'content-type': T[path.extname(file)] || 'application/octet-stream' }); res.end(buf);
  });
}).listen(port, () => console.log('serving on', port));
