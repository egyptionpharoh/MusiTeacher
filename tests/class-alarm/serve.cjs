// خادم ملفات ثابت للاختبار + محاكاة /api/class-alarm (بدون مفاتيح حقيقية)
const http = require('http'); const fs = require('fs'); const path = require('path');
const dist = path.join(__dirname, '_dist'); const port = +(process.env.PORT || 5330);
const T = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
let synced = null;
http.createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.startsWith('/api/class-alarm/')) {
    const action = p.split('/').pop(); let body = '';
    req.on('data', (c) => { body += c; }); req.on('end', () => {
      const send = (o, s = 200) => { res.writeHead(s, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)); };
      if (action === 'status') return send({ ok: true, ai: process.env.AI === '1', sync: true });
      if (action === 'sync' && req.method === 'GET') return send({ ok: true, store: synced ? synced.store : null, updatedAt: synced ? synced.updatedAt : 0 });
      if (action === 'sync' && req.method === 'POST') { synced = { store: JSON.parse(body).store, updatedAt: Date.now() }; return send({ ok: true, updatedAt: synced.updatedAt }); }
      if (action === 'sync' && req.method === 'DELETE') { synced = null; return send({ ok: true }); }
      if (action === 'extract') return send({ ok: true, provider: 'Gemini', schedule: { found: true, teacher: 'أ. منى', school: 'مدرسة الأمل', subject: '', days: ['الأحد', 'الاثنين'], periods: [{ no: 1, kind: 'lesson', name: '', start: '07:30', end: '08:10', uncertain: false }, { no: 2, kind: 'lesson', name: '', start: '08:10', end: '', uncertain: true }], lessons: [{ day: 'الأحد', period: 1, subject: '', grade: '5', section: '1', room: '', raw: '5/1', uncertain: false }, { day: 'الاثنين', period: 2, subject: '', grade: '', section: '', room: '', raw: '6/?', uncertain: true }], warnings: ['خانة الاثنين الحصة الثانية غير واضحة'] } });
      send({ ok: false, error: 'nf' }, 404);
    });
    return;
  }
  const f = path.join(dist, p === '/' ? 'index.html' : p);
  if (f.startsWith(dist) && fs.existsSync(f) && fs.statSync(f).isFile()) { res.writeHead(200, { 'content-type': T[path.extname(f)] || 'application/octet-stream' }); return res.end(fs.readFileSync(f)); }
  res.writeHead(404); res.end('nf');
}).listen(port, '127.0.0.1', () => console.log('class alarm on ' + port));
