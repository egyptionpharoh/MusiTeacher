// خادم الاختبار: ملفات الواجهة + محاكاة /api/lesson-plans و/api/class-alarm (بدون مفاتيح حقيقية ولا ذكاء اصطناعي فعلي)
// المزامنة مفصولة حسب الحساب (Bearer tok-<uid>) لاختبار عدم اطلاع معلم على بيانات آخر.
const http = require('http'); const fs = require('fs'); const path = require('path');
const dist = path.join(__dirname, '_dist'); const fx = path.join(__dirname, 'fixtures'); const port = +(process.env.PORT || 5340);
const T = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const db = { plans: new Map(), alarm: new Map() };
http.createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const send = (o, s = 200) => { res.writeHead(s, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)); };
  if (p.startsWith('/api/')) {
    const uid = ((req.headers.authorization || '').match(/^Bearer tok-(.+)$/) || [])[1];
    if (!uid) return send({ ok: false, error: 'سجّل الدخول' }, 401);
    const [, , tool, action] = p.split('/');
    let body = ''; req.on('data', (c) => { body += c; }); req.on('end', () => {
      if (action === 'status') return send({ ok: true, ai: process.env.AI !== '0', sync: true });
      const store = tool === 'lesson-plans' ? db.plans : db.alarm;
      if (action === 'sync') {
        if (req.method === 'GET') { const d = store.get(uid); return send({ ok: true, ws: d ? d.data : null, store: d ? d.data : null, updatedAt: d ? d.updatedAt : 0 }); }
        if (req.method === 'DELETE') { store.delete(uid); return send({ ok: true }); }
        const b = JSON.parse(body || '{}'); const cur = store.get(uid);
        if (b.baseUpdatedAt != null && cur && cur.updatedAt > b.baseUpdatedAt) return send({ ok: false, code: 'conflict', error: 'نسخة أحدث', updatedAt: cur.updatedAt }, 409);
        const updatedAt = Date.now(); store.set(uid, { data: b.ws || b.store, updatedAt }); return send({ ok: true, updatedAt });
      }
      if (action === 'extract' && tool === 'lesson-plans') {
        const b = JSON.parse(body || '{}');
        const file = b.kind === 'images' ? 'ai-grade10-docx-image.json' : 'ai-grade5-pdf.json';
        const r = JSON.parse(fs.readFileSync(path.join(fx, file), 'utf8'));
        return setTimeout(() => send({ ok: true, provider: 'محاكاة', result: { plans: r.plans, warnings: r.warnings } }), 400);
      }
      send({ ok: false, error: 'nf' }, 404);
    });
    return;
  }
  const f = path.join(dist, p === '/' ? 'index.html' : p);
  if (f.startsWith(dist) && fs.existsSync(f) && fs.statSync(f).isFile()) { res.writeHead(200, { 'content-type': T[path.extname(f)] || 'application/octet-stream' }); return res.end(fs.readFileSync(f)); }
  res.writeHead(404); res.end('nf');
}).listen(port, '127.0.0.1', () => console.log('lesson plans test on ' + port));
