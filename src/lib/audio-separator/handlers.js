// معالجات واجهات API لاستوديو فصل الصوت. تستقبل deps (هوية، قاعدة بيانات، تخزين، مزوّد) كي تُختبر بدونها.
// دورة المهمة:
//   1) POST /jobs            → تحقق + حصص + رابط رفع مؤقت مباشر إلى التخزين (الملف لا يمر عبر Vercel)
//   2) POST /jobs/:id start  → فحص الملف الحقيقي (النوع والمدة) ثم بدء الفصل لدى المزوّد
//   3) GET  /jobs/:id        → حالة حقيقية من المزوّد؛ عند الانتهاء يُنسخ الناتج إلى التخزين ويُحذف الأصل
//   4) DELETE /jobs/:id      → إلغاء/حذف فوري للملفات
import crypto from 'node:crypto';
import { entitlementOf, bearerOf, sameOrigin, makeLimiter } from '../virtual-games/guard.js';
import { ACTIVE_STATUSES, INPUT_FORMATS, OUTPUT_FORMATS, STORAGE_PREFIX, getLimits } from './config.js';
import { validateCreate, baseNameOf, outputFileName, contentDisposition, probeAudio } from './validate.js';
import { pickStem, progressFromLogs } from './provider-replicate.js';

const json = (body, status = 200) =>
  Response.json(body, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
const fail = (error, status, extra = {}) => json({ ok: false, error, ...extra }, status);

const PROVIDER_HTTP = {
  'provider-not-configured': 503, 'provider-auth': 503, 'provider-billing': 503, 'provider-busy': 503,
  'provider-unreachable': 502, 'provider-error': 502, 'provider-not-found': 503,
};
const UPLOAD_MIME = { mp3: 'audio/mpeg', wav: 'audio/wav', flac: 'audio/flac', m4a: 'audio/mp4' };

const newId = () => crypto.randomBytes(16).toString('hex');
const log = (where, e) => console.error(`[audio-separator/${where}]`, e && (e.code || e.message) ? `${e.code || ''} ${e.message || ''} ${e.detail || ''}`.trim() : e);

/** ما يُرسل للمتصفح عن المهمة (بلا مفاتيح تخزين أو معرّفات المزوّد). */
export function publicJob(j) {
  return {
    id: j.id, status: j.status, stage: stageOf(j), progress: typeof j.progress === 'number' ? j.progress : null,
    mode: j.mode, format: j.format, bitrate: j.bitrate, fileName: j.fileName, size: j.inputSize,
    duration: j.serverDuration ?? j.clientDuration ?? null, sourceKbps: j.sourceKbps ?? null,
    outputFileName: j.outputFileName, outputSize: j.outputSize ?? null, error: j.error || null,
    model: j.modelLabel || null, createdAt: j.createdAt, startedAt: j.startedAt || null,
    completedAt: j.completedAt || null, expiresAt: j.expiresAt || null,
  };
}

export function stageOf(j) {
  switch (j.status) {
    case 'awaiting-upload': return 'upload';
    case 'queued': return 'starting';
    case 'processing': return 'separating';
    case 'finalizing': return 'finalizing';
    default: return j.status;
  }
}

export function makeHandlers(deps) {
  const limits = deps.limits || getLimits();
  const now = deps.now || (() => new Date());
  const createLimit = makeLimiter(20, 10 * 60 * 1000);
  const pollLimit = makeLimiter(240, 60 * 1000);
  const actionLimit = makeLimiter(30, 60 * 1000);

  // ---------- الهوية والاشتراك (نفس منطق الألعاب المحمية) ----------
  async function authenticate(request) {
    if (!sameOrigin(request)) return { res: fail('origin', 403) };
    const token = bearerOf(request);
    if (!token) return { res: fail('unauthenticated', 401) };
    let decoded;
    try { decoded = await deps.verifyIdToken(token); }
    catch (e) {
      const m = e && e.message;
      if (m === 'no-project-id') return { res: fail('server-not-configured', 503) };
      if (m && m.startsWith('jwks')) { log('auth', e); return { res: fail('server-error', 502) }; }
      return { res: fail('unauthenticated', 401) };
    }
    if (!decoded || !decoded.uid) return { res: fail('unauthenticated', 401) };
    let user;
    try { user = await deps.findUser(decoded.uid); }
    catch (e) { log('db', e); return { res: fail('db-error', 500) }; }
    const ent = entitlementOf(user, now());
    if (!ent.ok) return { res: fail('forbidden', 403) };
    return { uid: decoded.uid, admin: !!ent.admin };
  }

  const guarded = (where, fn) => async (request, context) => {
    try { return await fn(request, context); }
    catch (e) { log(where, e); return fail('server-error', 500); }
  };

  const serviceReady = () => {
    if (!deps.storage || !deps.storage.configured()) return 'storage-not-configured';
    if (!deps.provider || !deps.provider.configured()) return 'provider-not-configured';
    return null;
  };

  async function removeObjects(j, which = ['input', 'output']) {
    const patch = {};
    for (const w of which) {
      const key = w === 'input' ? j.inputKey : j.outputKey;
      const flag = w === 'input' ? 'inputDeleted' : 'outputDeleted';
      if (!key || j[flag]) continue;
      try { await deps.storage.remove(key); patch[flag] = true; } catch (e) { log('storage-remove', e); }
    }
    return patch;
  }

  async function failJob(j, error, extra = {}) {
    const patch = { status: 'failed', error, progress: null, completedAt: now(), ...extra, ...(await removeObjects(j)) };
    return (await deps.jobs.update(j.id, patch)) || { ...j, ...patch };
  }

  /** تنظيف: المهام العالقة والنتائج المنتهية (يعمل بأفضل جهد، لا يعطّل الطلب). */
  async function sweep(limit = 10) {
    try {
      const list = await deps.jobs.findPurgeable(now(), limits, limit);
      for (const j of list) await expireJob(j);
    } catch (e) { log('sweep', e); }
  }

  async function expireJob(j) {
    const t = now().getTime();
    if (j.status === 'ready' || ['failed', 'canceled', 'expired', 'deleted'].includes(j.status)) {
      const patch = await removeObjects(j);
      if (j.status === 'ready') patch.status = 'expired';
      return (await deps.jobs.update(j.id, patch)) || { ...j, ...patch };
    }
    // مهمة نشطة تجاوزت المهلة
    if (j.predictionId && deps.provider) await deps.provider.cancel(j.predictionId);
    const age = t - new Date(j.createdAt).getTime();
    return failJob(j, j.status === 'awaiting-upload' ? 'upload-timeout' : 'timeout', { stale: true, ageMs: age });
  }

  function isStale(j) {
    const age = now().getTime() - new Date(j.createdAt).getTime();
    if (j.status === 'awaiting-upload') return age > limits.staleUploadMs;
    return ACTIVE_STATUSES.includes(j.status) && age > limits.staleActiveMs;
  }

  async function withLinks(j) {
    const out = publicJob(j);
    if (j.status === 'ready' && j.outputKey && !j.outputDeleted) {
      const ct = OUTPUT_FORMATS[j.format].contentType;
      const ttl = Math.max(60, Math.min(limits.playUrlTtlSec, Math.floor((new Date(j.expiresAt).getTime() - now().getTime()) / 1000)));
      out.playUrl = await deps.storage.presignGet(j.outputKey, { ttlSec: ttl, contentType: ct, disposition: contentDisposition(j.outputFileName, 'inline') });
      out.downloadUrl = await deps.storage.presignGet(j.outputKey, { ttlSec: ttl, contentType: ct, disposition: contentDisposition(j.outputFileName, 'attachment') });
      out.linksExpireIn = ttl;
    }
    return out;
  }

  // ======================================================================================
  // POST /api/audio-separator/jobs
  // ======================================================================================
  const createJob = guarded('create', async (request) => {
    const a = await authenticate(request);
    if (a.res) return a.res;
    if (!createLimit(a.uid)) return fail('rate-limited', 429);
    const notReady = serviceReady();
    if (notReady) return fail('service-not-configured', 503, { detail: notReady });

    let body;
    try { body = await request.json(); } catch { return fail('bad-request', 400); }
    const v = validateCreate(body, limits);
    if (!v.ok) return fail(v.error, v.error === 'too-large' ? 413 : 400, { limits: publicLimits(limits) });
    const req = v.value;

    // نفس الطلب أُرسل مرتين (نقر مزدوج/إعادة إرسال) → نعيد المهمة نفسها
    const existing = await deps.jobs.findByRequest(a.uid, req.requestId);
    if (existing) {
      const out = { ok: true, job: await withLinks(existing) };
      if (existing.status === 'awaiting-upload') out.upload = await uploadInfo(existing);
      return json(out, 200);
    }

    await sweep(10);

    const active = await deps.jobs.findActive({ uid: a.uid, since: new Date(now().getTime() - limits.staleActiveMs) });
    const live = [];
    for (const j of active) { if (isStale(j)) await expireJob(j); else live.push(j); }
    if (live.length >= limits.activePerUser) return fail('busy', 409, { activeJobId: live[0].id });

    const globalActive = await deps.jobs.countActive({ since: new Date(now().getTime() - limits.staleActiveMs) });
    if (globalActive >= limits.activeGlobal) return fail('capacity', 503);

    if (!a.admin) {
      const used = await deps.jobs.countStartedSince(a.uid, new Date(now().getTime() - 24 * 3600 * 1000));
      if (used >= limits.dailyPerUser) return fail('daily-limit', 429, { limit: limits.dailyPerUser });
    }

    const id = newId();
    const baseName = baseNameOf(req.fileName);
    const preset = deps.provider.preset || {};
    const bitrate = req.format === 'mp3' && preset.fixedMp3Bitrate ? preset.fixedMp3Bitrate : req.bitrate;
    const job = await deps.jobs.create({
      id, uid: a.uid, requestId: req.requestId, status: 'awaiting-upload',
      mode: req.mode, format: req.format, bitrate, fileName: req.fileName, baseName,
      inputExt: req.ext, container: req.container, inputSize: req.size, inputType: req.type,
      clientDuration: req.clientDuration, inputKey: `${STORAGE_PREFIX}${id}/input.${req.ext}`,
      outputKey: `${STORAGE_PREFIX}${id}/output.${OUTPUT_FORMATS[req.format].ext}`,
      outputFileName: outputFileName(baseName, req.mode, req.format),
      modelId: preset.id || null, modelLabel: preset.label || null,
      createdAt: now(), progress: null,
    });
    return json({ ok: true, job: publicJob(job), upload: await uploadInfo(job) }, 201);
  });

  async function uploadInfo(j) {
    const contentType = UPLOAD_MIME[j.inputExt] || 'application/octet-stream';
    const url = await deps.storage.presignPut(j.inputKey, { contentType, ttlSec: limits.uploadUrlTtlSec });
    return { url, method: 'PUT', headers: { 'Content-Type': contentType }, expiresIn: limits.uploadUrlTtlSec };
  }

  // ======================================================================================
  // POST /api/audio-separator/jobs/:id  { action: 'start' }
  // ======================================================================================
  const jobAction = guarded('action', async (request, context) => {
    const a = await authenticate(request);
    if (a.res) return a.res;
    if (!actionLimit(a.uid)) return fail('rate-limited', 429);
    const { jobId } = await context.params;
    const j = await loadJob(jobId, a.uid);
    if (!j) return fail('not-found', 404);
    let body;
    try { body = await request.json(); } catch { return fail('bad-request', 400); }
    if (!body || body.action !== 'start') return fail('bad-request', 400);
    if (j.status !== 'awaiting-upload') return json({ ok: true, job: await withLinks(j) }); // بدأت مسبقًا
    const notReady = serviceReady();
    if (notReady) return fail('service-not-configured', 503, { detail: notReady });

    // 1) الملف موجود فعلًا وبالحجم المعلن
    const head = await deps.storage.head(j.inputKey);
    if (!head) return fail('upload-missing', 409);
    if (head.size !== j.inputSize || head.size > limits.maxBytes) {
      const f = await failJob(j, 'upload-mismatch');
      return fail('upload-mismatch', 400, { job: publicJob(f) });
    }

    // 2) نوعه الحقيقي ومدته من بايتاته (لا نثق بالامتداد ولا بما يقوله المتصفح)
    let probe;
    try { probe = await probeAudio((s, e) => deps.storage.readRange(j.inputKey, s, e), head.size); }
    catch (e) { log('probe', e); probe = { error: 'unreadable' }; }
    const expected = INPUT_FORMATS[j.inputExt].container;
    let bad = probe.error || (probe.container !== expected ? 'format-mismatch' : null);
    if (!bad && probe.duration > limits.maxSeconds + 1) bad = 'too-long';
    if (!bad && probe.duration < limits.minSeconds) bad = 'too-short';
    if (bad) {
      const f = await failJob(j, bad, { serverDuration: probe.duration || null });
      return fail(bad, 400, { job: publicJob(f), limits: publicLimits(limits) });
    }

    // 3) حجز ذرّي يمنع بدء المعالجة مرتين لنفس المهمة
    const claimed = await deps.jobs.update(j.id, { status: 'queued', startedAt: now(), serverDuration: probe.duration, sourceKbps: probe.kbps || null },
      { statusIn: ['awaiting-upload'] });
    if (!claimed) return json({ ok: true, job: await withLinks(await deps.jobs.get(j.id)) });

    // 4) بدء الفصل لدى المزوّد برابط قراءة مؤقت للملف
    try {
      const audioUrl = await deps.storage.presignGet(j.inputKey, { ttlSec: limits.providerInputUrlTtlSec });
      const p = await deps.provider.create({ audioUrl, mode: j.mode, format: j.format, bitrate: j.bitrate });
      const upd = await deps.jobs.update(j.id, { predictionId: p.id, providerStatus: p.status, lastPolledAt: now() });
      return json({ ok: true, job: publicJob(upd || claimed) });
    } catch (e) {
      log('provider-create', e);
      const code = e && e.code && PROVIDER_HTTP[e.code] ? e.code : 'provider-error';
      const f = await failJob(claimed, code, { countsTowardQuota: false });
      return fail(code, PROVIDER_HTTP[code] || 502, { job: publicJob(f) });
    }
  });

  // ======================================================================================
  // GET /api/audio-separator/jobs/:id
  // ======================================================================================
  const getJob = guarded('status', async (request, context) => {
    const a = await authenticate(request);
    if (a.res) return a.res;
    if (!pollLimit(a.uid)) return fail('rate-limited', 429);
    const { jobId } = await context.params;
    let j = await loadJob(jobId, a.uid);
    if (!j) return fail('not-found', 404);
    j = await sync(j);
    return json({ ok: true, job: await withLinks(j) });
  });

  async function loadJob(id, uid) {
    if (typeof id !== 'string' || !/^[a-f0-9]{32}$/.test(id)) return null;
    const j = await deps.jobs.get(id);
    return j && j.uid === uid ? j : null; // المهمة لصاحبها فقط
  }

  async function sync(j) {
    const t = now().getTime();
    if (j.status === 'ready' && j.expiresAt && new Date(j.expiresAt).getTime() <= t) return expireJob(j);
    if (isStale(j)) return expireJob(j);
    if (!['queued', 'processing', 'finalizing'].includes(j.status) || !j.predictionId) return j;
    if (j.status === 'finalizing' && j.finalizingAt && t - new Date(j.finalizingAt).getTime() < limits.finalizeLeaseMs) return j;
    // لا نستدعي المزوّد أكثر من مرة كل 1.5 ثانية لنفس المهمة
    if (j.status !== 'finalizing' && j.lastPolledAt && t - new Date(j.lastPolledAt).getTime() < 1500) return j;

    let p;
    try { p = await deps.provider.get(j.predictionId); }
    catch (e) {
      log('provider-get', e);
      // انقطاع مؤقت لدى المزوّد: لا نفشل المهمة، نعيد آخر حالة معروفة مع تنبيه
      return { ...j, transientError: e.code || 'provider-unreachable' };
    }
    if (p.status === 'queued' || p.status === 'processing') {
      const progress = p.status === 'processing' ? progressFromLogs(p.logs, (deps.provider.preset || {}).progressPasses) : null;
      return (await deps.jobs.update(j.id, { status: p.status, providerStatus: p.rawStatus, progress, lastPolledAt: now() },
        { statusIn: ['queued', 'processing'] })) || (await deps.jobs.get(j.id));
    }
    if (p.status === 'failed' || p.status === 'canceled') {
      if (p.error) log('provider-failed', { message: p.error });
      return failJob(j, 'separation-failed');
    }
    if (p.status === 'succeeded') return finalize(j, p);
    return j;
  }

  async function finalize(j, p) {
    const t = now();
    const claimed = await deps.jobs.update(j.id, { status: 'finalizing', finalizingAt: t, progress: null, predictTime: p.predictTime },
      { statusIn: ['queued', 'processing', 'finalizing'], finalizingBefore: new Date(t.getTime() - limits.finalizeLeaseMs) });
    if (!claimed) return (await deps.jobs.get(j.id)) || j;

    const url = pickStem(p.output, j.mode);
    if (!url) { log('output', { message: 'unexpected output shape: ' + JSON.stringify(p.output).slice(0, 300) }); return failJob(claimed, 'unexpected-output'); }
    try {
      const res = await deps.provider.openOutput(url);
      const len = parseInt(res.headers.get('content-length') || '', 10);
      await deps.storage.putStream(j.outputKey, res.body, { contentType: OUTPUT_FORMATS[j.format].contentType, length: Number.isFinite(len) ? len : null });
      const head = await deps.storage.head(j.outputKey);
      if (!head || head.size < 1024) return failJob(claimed, 'empty-output');
      const patch = {
        status: 'ready', outputSize: head.size, completedAt: now(), progress: 100,
        expiresAt: new Date(now().getTime() + limits.resultTtlHours * 3600 * 1000),
        ...(await removeObjects(claimed, ['input'])), // الأصل لم يعد لازمًا: يُحذف فورًا
      };
      return (await deps.jobs.update(j.id, patch)) || { ...claimed, ...patch };
    } catch (e) {
      log('finalize', e);
      const attempts = (claimed.finalizeAttempts || 0) + 1;
      if (e.code === 'output-unavailable' || attempts >= 3) return failJob(claimed, 'finalize-failed');
      // نحرر الحجز لتُعاد المحاولة في الاستعلام التالي
      return (await deps.jobs.update(j.id, { finalizingAt: new Date(0), finalizeAttempts: attempts })) || claimed;
    }
  }

  // ======================================================================================
  // DELETE /api/audio-separator/jobs/:id
  // ======================================================================================
  const deleteJob = guarded('delete', async (request, context) => {
    const a = await authenticate(request);
    if (a.res) return a.res;
    if (!actionLimit(a.uid)) return fail('rate-limited', 429);
    const { jobId } = await context.params;
    const j = await loadJob(jobId, a.uid);
    if (!j) return fail('not-found', 404);
    const wasActive = ACTIVE_STATUSES.includes(j.status);
    if (wasActive && j.predictionId && deps.provider) await deps.provider.cancel(j.predictionId);
    const patch = { ...(await removeObjects(j)), status: wasActive ? 'canceled' : (j.status === 'ready' ? 'deleted' : j.status), progress: null };
    if (wasActive && !j.predictionId) patch.countsTowardQuota = false;
    const upd = (await deps.jobs.update(j.id, patch)) || { ...j, ...patch };
    return json({ ok: true, job: publicJob(upd) });
  });

  // ======================================================================================
  // GET /api/audio-separator/health — نعم/لا فقط، بلا أي قيمة سرية
  // ======================================================================================
  const healthLimit = makeLimiter(20, 60 * 1000);
  const health = async () => {
    if (!healthLimit('all')) return fail('rate-limited', 429);
    const checks = {
      storageConfigured: !!(deps.storage && deps.storage.configured()),
      providerConfigured: !!(deps.provider && deps.provider.configured()),
      model: deps.provider && deps.provider.preset ? deps.provider.preset.label : null,
      database: 'unknown', storage: 'unknown', provider: 'unknown',
    };
    try { if (deps.connectDB) { await deps.connectDB(); checks.database = 'ok'; } } catch { checks.database = 'fail'; }
    try { if (checks.storageConfigured) { await deps.storage.check(); checks.storage = 'ok'; } } catch { checks.storage = 'fail'; }
    try { if (checks.providerConfigured) { await deps.provider.check(); checks.provider = 'ok'; } } catch { checks.provider = 'fail'; }
    const ok = checks.storageConfigured && checks.providerConfigured && checks.database !== 'fail' && checks.storage !== 'fail' && checks.provider !== 'fail';
    return json({ ok, checks, limits: publicLimits(limits) });
  };

  /** الحدود العامة تُعرض للمتصفح ليتحقق قبل الرفع. */
  const limitsInfo = guarded('limits', async (request) => {
    const a = await authenticate(request);
    if (a.res) return a.res;
    const active = await deps.jobs.findActive({ uid: a.uid, since: new Date(now().getTime() - limits.staleActiveMs) });
    const live = active.filter((j) => !isStale(j));
    const used = a.admin ? 0 : await deps.jobs.countStartedSince(a.uid, new Date(now().getTime() - 24 * 3600 * 1000));
    const notReady = serviceReady();
    return json({
      ok: true, configured: !notReady, limits: publicLimits(limits),
      model: deps.provider && deps.provider.preset ? deps.provider.preset.label : null,
      fixedMp3Bitrate: (deps.provider && deps.provider.preset && deps.provider.preset.fixedMp3Bitrate) || null,
      usage: { usedToday: used, dailyLimit: a.admin ? null : limits.dailyPerUser },
      activeJobId: live[0] ? live[0].id : null,
    });
  });

  return { createJob, jobAction, getJob, deleteJob, health, limitsInfo };
}

export function publicLimits(l) {
  return { maxMB: Math.round(l.maxBytes / 1024 / 1024), maxMinutes: Math.round(l.maxSeconds / 60), minSeconds: l.minSeconds, dailyPerUser: l.dailyPerUser, resultTtlHours: l.resultTtlHours, formats: Object.keys(INPUT_FORMATS) };
}
