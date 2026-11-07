// خادم اختبار محلي لاستوديو فصل الصوت: معالجات الإنتاج الحقيقية + بدائل في الذاكرة للتخزين والمزوّد.
// لا يتصل بأي خدمة خارجية. التشغيل:  node tests/audio-separator/harness.mjs  (يتطلب بناء الواجهة أولًا: انظر ui.cjs)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { makeHandlers } from '../../src/lib/audio-separator/handlers.js';
import { getLimits } from '../../src/lib/audio-separator/config.js';
import { fakeStore, fakeStorage, fakeProvider } from './fakes.mjs';

const PORT = +(process.env.PORT || 5310);
const ORIGIN = `http://127.0.0.1:${PORT}`;
const DIST = path.resolve(process.env.STATIC_DIR || 'tests/audio-separator/_dist');
const OUTPUT_AUDIO = fs.readFileSync(process.env.OUTPUT_AUDIO || 'tests/audio-separator/fixtures/tone-cbr.mp3');
const MODE = process.env.HARNESS_MODE || 'ok'; // ok | unconfigured | fail
const SPEED = +(process.env.HARNESS_SPEED || 1);

const store = fakeStore();
const storage = fakeStorage({});
storage.presignPut = async (key) => `${ORIGIN}/__r2/${key}`;
storage.presignGet = async (key, { disposition } = {}) => `http://localhost:${PORT}/__r2/${key}?d=${encodeURIComponent(disposition || '')}`;
const provider = fakeProvider({ configured: MODE !== 'unconfigured' });
const born = new Map();
const origCreate = provider.create.bind(provider);
provider.create = async (input) => { const r = await origCreate(input); born.set(r.id, Date.now()); return r; };
provider.get = async (id) => {
  const x = provider.preds.get(id); const t = (Date.now() - born.get(id)) * SPEED;
  if (x.status === 'canceled') return { ...x };
  if (t < 2500) return { ...x, status: 'queued', rawStatus: 'starting' };
  if (t < 10500) {
    const p = (t - 2500) / 8000 * 4; const done = Math.floor(p); const cur = Math.round((p - done) * 100);
    const logs = Array.from({ length: done }, () => '  0%|\n100%|').join('\n') + `\n${cur}%|`;
    return { ...x, status: 'processing', rawStatus: 'processing', logs };
  }
  if (MODE === 'fail') return { ...x, status: 'failed', rawStatus: 'failed', error: 'boom' };
  const base = 'https://replicate.delivery/xezq/test/';
  return { ...x, status: 'succeeded', rawStatus: 'succeeded', output: { vocals: base + 'vocals.mp3', no_vocals: base + 'no_vocals.mp3' } };
};
provider.openOutput = async () => new Response(OUTPUT_AUDIO, { headers: { 'content-length': String(OUTPUT_AUDIO.length) } });

const USERS = { sub: { role: 'user', isSubscribed: true, subscriptionEndDate: new Date(Date.now() + 864e5 * 30) } };
const limits = { ...getLimits({}), ...(process.env.DAILY ? { dailyPerUser: +process.env.DAILY } : {}) };
const h = makeHandlers({
  verifyIdToken: async (t) => { if (!t.startsWith('good-')) throw new Error('bad'); return { uid: t.slice(5) }; },
  findUser: async (uid) => USERS[uid] || (uid.startsWith('sub') ? USERS.sub : null),
  jobs: store, storage, provider, limits,
});

const toReq = async (req) => {
  const chunks = []; for await (const c of req) chunks.push(c);
  const hd = new Headers(); for (const [k, v] of Object.entries(req.headers)) hd.set(k, Array.isArray(v) ? v.join(', ') : v);
  return new Request(`http://${req.headers.host}${req.url}`, { method: req.method, headers: hd, body: ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(chunks) });
};
const send = async (res, r) => { const hd = {}; r.headers.forEach((v, k) => { hd[k] = v; }); res.writeHead(r.status, hd); res.end(Buffer.from(await r.arrayBuffer())); };
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.mp3': 'audio/mpeg', '.wav': 'audio/wav' };

http.createServer(async (req, res) => {
  try {
    const u = new URL(req.url, ORIGIN);
    const p = u.pathname;
    if (p === '/__state') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ jobs: [...store.rows.values()], objects: [...storage.objects.keys()], removed: storage.removed, creates: provider.calls.create.length, cancels: provider.calls.cancel })); }
    if (p.startsWith('/__r2/')) {
      const key = decodeURIComponent(p.slice(6));
      if (req.method === 'PUT') {
        if (process.env.FAIL_UPLOAD) { res.writeHead(403); return res.end('denied'); }
        const chunks = []; for await (const c of req) chunks.push(c);
        storage.put(key, Buffer.concat(chunks)); res.writeHead(200); return res.end();
      }
      const obj = storage.objects.get(key);
      if (!obj) { res.writeHead(404); return res.end(); }
      const hd = { 'content-type': key.endsWith('.wav') ? 'audio/wav' : 'audio/mpeg', 'accept-ranges': 'bytes' };
      const d = u.searchParams.get('d'); if (d) hd['content-disposition'] = d;
      const m = /bytes=(\d+)-(\d*)/.exec(req.headers.range || '');
      if (m) { const s = +m[1], e = m[2] ? +m[2] : obj.length - 1; res.writeHead(206, { ...hd, 'content-range': `bytes ${s}-${e}/${obj.length}`, 'content-length': e - s + 1 }); return res.end(obj.subarray(s, e + 1)); }
      res.writeHead(200, { ...hd, 'content-length': obj.length }); return res.end(obj);
    }
    if (p === '/api/audio-separator/jobs') return send(res, await h.createJob(await toReq(req)));
    if (p === '/api/audio-separator/limits') return send(res, await h.limitsInfo(await toReq(req)));
    if (p === '/api/audio-separator/health') return send(res, await h.health());
    const jm = /^\/api\/audio-separator\/jobs\/([^/]+)$/.exec(p);
    if (jm) {
      const ctx = { params: Promise.resolve({ jobId: jm[1] }) }; const r = await toReq(req);
      const fn = req.method === 'GET' ? h.getJob : req.method === 'POST' ? h.jobAction : h.deleteJob;
      return send(res, await fn(r, ctx));
    }
    const f = path.join(DIST, p === '/' ? 'index.html' : p);
    if (f.startsWith(DIST) && fs.existsSync(f) && fs.statSync(f).isFile()) { res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); return res.end(fs.readFileSync(f)); }
    res.writeHead(404); res.end('nf');
  } catch (e) { console.error(e); res.writeHead(500); res.end(String(e)); }
}).listen(PORT, '127.0.0.1', () => console.log('audio-separator harness on ' + ORIGIN + ' mode=' + MODE));
