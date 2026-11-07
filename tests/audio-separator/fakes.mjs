// بدائل اختبار (في الذاكرة) لقاعدة البيانات والتخزين ومزوّد الفصل — تحاكي السلوك الموثق للخدمات الحقيقية.
// تُستخدم في الاختبارات فقط، ولا يستوردها كود المنصة إطلاقًا.
import { ACTIVE_STATUSES } from '../../src/lib/audio-separator/config.js';
import { pickStem } from '../../src/lib/audio-separator/provider-replicate.js';

export function fakeStore() {
  const rows = new Map();
  const matches = (j, cond = {}) => {
    if (!cond.statusIn) return true;
    if (!cond.statusIn.includes(j.status)) return false;
    if (j.status === 'finalizing' && cond.finalizingBefore) return !j.finalizingAt || new Date(j.finalizingAt) < cond.finalizingBefore;
    return true;
  };
  const FINAL = ['failed', 'canceled', 'expired', 'deleted'];
  return {
    rows,
    async create(doc) { if ([...rows.values()].some((r) => r.uid === doc.uid && r.requestId === doc.requestId)) throw new Error('dup'); rows.set(doc.id, { inputDeleted: false, outputDeleted: false, ...doc }); return { ...rows.get(doc.id) }; },
    async get(id) { const r = rows.get(id); return r ? { ...r } : null; },
    async update(id, patch, cond) { const r = rows.get(id); if (!r || !matches(r, cond)) return null; Object.assign(r, patch); return { ...r }; },
    async findByRequest(uid, requestId) { const r = [...rows.values()].find((x) => x.uid === uid && x.requestId === requestId); return r ? { ...r } : null; },
    async findActive({ uid, since }) { return [...rows.values()].filter((r) => ACTIVE_STATUSES.includes(r.status) && (!uid || r.uid === uid) && new Date(r.createdAt) >= since).map((r) => ({ ...r })); },
    async countActive({ since }) { return [...rows.values()].filter((r) => ACTIVE_STATUSES.includes(r.status) && new Date(r.createdAt) >= since).length; },
    async countStartedSince(uid, since) { return [...rows.values()].filter((r) => r.uid === uid && r.startedAt && new Date(r.startedAt) >= since && r.countsTowardQuota !== false).length; },
    async findPurgeable(now, limits, limit) {
      const t = now.getTime();
      return [...rows.values()].filter((r) =>
        (r.status === 'ready' && r.expiresAt && new Date(r.expiresAt) <= now)
        || (r.status === 'awaiting-upload' && t - new Date(r.createdAt).getTime() > limits.staleUploadMs)
        || (ACTIVE_STATUSES.includes(r.status) && t - new Date(r.createdAt).getTime() > limits.staleActiveMs)
        || (FINAL.includes(r.status) && (!r.inputDeleted || !r.outputDeleted))).slice(0, limit).map((r) => ({ ...r }));
    },
  };
}

export function fakeStorage({ configured = true } = {}) {
  const objects = new Map();
  const removed = [];
  return {
    objects, removed,
    configured: () => configured,
    async presignPut(key, { contentType, ttlSec }) { return `https://r2.test/${key}?put&ct=${encodeURIComponent(contentType)}&ttl=${ttlSec}`; },
    async presignGet(key, { ttlSec, disposition } = {}) { return `https://r2.test/${key}?get&ttl=${ttlSec}${disposition ? '&rcd=' + encodeURIComponent(disposition) : ''}`; },
    async head(key) { const o = objects.get(key); return o ? { size: o.length } : null; },
    async readRange(key, s, e) { const o = objects.get(key); if (!o) throw new Error('NoSuchKey'); return Buffer.from(o.subarray(s, e + 1)); },
    async putStream(key, body) { const chunks = []; const r = body.getReader(); for (;;) { const { done, value } = await r.read(); if (value) chunks.push(Buffer.from(value)); if (done) break; } objects.set(key, Buffer.concat(chunks)); },
    async remove(key) { removed.push(key); objects.delete(key); },
    async check() { return true; },
    put(key, buf) { objects.set(key, Buffer.from(buf)); },
  };
}

/** مزوّد مُحاكى بسلوك Replicate: starting → processing (سجل tqdm) → succeeded (روابط الملفات). */
export function fakeProvider({ configured = true, outputShape = 'demucs', fail = null, preset } = {}) {
  const preds = new Map();
  let n = 0;
  const calls = { create: [], get: 0, cancel: [], open: [] };
  const p = {
    calls, preds,
    preset: preset || { id: 'demucs-ft', label: 'Demucs v4 (htdemucs_ft)', progressPasses: 4 },
    configured: () => configured,
    async create(input) {
      calls.create.push(input);
      if (fail === 'create') { const e = new Error('provider-busy'); e.code = 'provider-busy'; throw e; }
      const id = 'pred' + (++n).toString().padStart(8, '0');
      preds.set(id, { status: 'queued', rawStatus: 'starting', logs: '', output: null, input });
      return { id, status: 'queued' };
    },
    async get(id) { calls.get++; if (fail === 'get') { const e = new Error('x'); e.code = 'provider-unreachable'; throw e; } return { ...preds.get(id) }; },
    async cancel(id) { calls.cancel.push(id); const x = preds.get(id); if (x) x.status = 'canceled'; },
    async openOutput(url) {
      calls.open.push(url);
      if (fail === 'open') { const e = new Error('x'); e.code = 'output-unavailable'; throw e; }
      const body = Buffer.alloc(4096, url.includes('no_vocals') || url.includes('instrumental') ? 0x11 : 0x22);
      return new Response(body, { headers: { 'content-length': String(body.length) } });
    },
    async check() { return true; },
    // أدوات التحكم في الاختبار
    advance(id, step) {
      const x = preds.get(id);
      if (step === 'processing') Object.assign(x, { status: 'processing', rawStatus: 'processing', logs: '  0%|          | 0/10\n 50%|█████     | 5/10\n100%|██████████| 10/10\n 25%|██▌       | 2.5/10' });
      if (step === 'succeeded') {
        const base = 'https://replicate.delivery/xezq/abc/';
        const output = outputShape === 'demucs' ? { vocals: base + 'vocals.mp3', no_vocals: base + 'no_vocals.mp3' }
          : outputShape === 'roformer' ? { vocals: base + 'vocals.mp3', instrumental: base + 'instrumental.mp3', drums: null }
            : outputShape === 'weird' ? { drums: base + 'drums.mp3', bass: base + 'bass.mp3', other: base + 'other.mp3', vocals: base + 'vocals.mp3' } : null;
        Object.assign(x, { status: 'succeeded', rawStatus: 'succeeded', output, predictTime: 31.2 });
      }
      if (step === 'failed') Object.assign(x, { status: 'failed', rawStatus: 'failed', error: 'CUDA out of memory' });
    },
    pickStem,
  };
  return p;
}
