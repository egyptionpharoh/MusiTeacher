// اختبارات استوديو فصل الصوت:  node --test tests/audio-separator.test.mjs
// تغطي: التحقق من الطلبات، فحص الملفات الصوتية الحقيقية (MP3/WAV/FLAC/M4A)، مزوّد Replicate، وواجهات API كاملة
// ببدائل في الذاكرة لقاعدة البيانات والتخزين والمزوّد (لا اتصال بأي خدمة خارجية ولا تكلفة).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { getLimits, getPreset, MODEL_PRESETS } from '../src/lib/audio-separator/config.js';
import { validateCreate, baseNameOf, outputFileName, contentDisposition, probeAudio, sniffContainer } from '../src/lib/audio-separator/validate.js';
import { makeReplicateProvider, pickStem, progressFromLogs } from '../src/lib/audio-separator/provider-replicate.js';
import { splitStream } from '../src/lib/audio-separator/streams.js';
import { updateFilter, purgeableFilter } from '../src/lib/audio-separator/store-mongo.js';
import { makeHandlers } from '../src/lib/audio-separator/handlers.js';
import { fakeStore, fakeStorage, fakeProvider } from './audio-separator/fakes.mjs';

const FIX = path.resolve('tests/audio-separator/fixtures');
const fx = (n) => fs.readFileSync(path.join(FIX, n));
const L = getLimits({});
const reader = (buf) => async (s, e) => Buffer.from(buf.subarray(s, e + 1));

// ---------------------------------------------------------------- التحقق من الطلب
const okBody = (o = {}) => ({ fileName: 'Song.mp3', size: 5_000_000, type: 'audio/mpeg', duration: 200, mode: 'instrumental', format: 'mp3', bitrate: 320, requestId: 'req-12345678', consent: true, ...o });

test('validateCreate: طلب سليم', () => {
  const v = validateCreate(okBody(), L);
  assert.equal(v.ok, true); assert.equal(v.value.ext, 'mp3'); assert.equal(v.value.bitrate, 320);
});
test('validateCreate: الرفض بأسباب واضحة', () => {
  const cases = [
    [{ fileName: 'virus.exe' }, 'unsupported-format'], [{ fileName: 'a.ogg' }, 'unsupported-format'],
    [{ type: 'video/mp4' }, 'unsupported-format'], [{ size: L.maxBytes + 1 }, 'too-large'], [{ size: 0 }, 'bad-size'],
    [{ duration: L.maxSeconds + 5 }, 'too-long'], [{ duration: 1 }, 'too-short'], [{ mode: 'drums' }, 'bad-mode'],
    [{ format: 'ogg' }, 'bad-output-format'], [{ bitrate: 999 }, 'bad-bitrate'], [{ consent: false }, 'consent-required'],
    [{ requestId: 'x' }, 'bad-request'], [{ fileName: '' }, 'bad-file-name'],
  ];
  for (const [o, err] of cases) assert.equal(validateCreate(okBody(o), L).error, err, JSON.stringify(o));
});
test('validateCreate: WAV بلا معدل بت · MIME فارغ مقبول', () => {
  const v = validateCreate(okBody({ fileName: 'x.WAV', type: '', format: 'wav' }), L);
  assert.equal(v.ok, true); assert.equal(v.value.bitrate, null); assert.equal(v.value.ext, 'wav');
});
test('أسماء الملفات الناتجة آمنة وواضحة', () => {
  assert.equal(baseNameOf('أغنية الوطن (Live).mp3'), 'أغنية_الوطن_(Live)');
  assert.equal(baseNameOf('../../etc/passwd.mp3'), 'etc_passwd');
  assert.equal(baseNameOf('<script>alert(1)</script>.wav'), 'script_alert(1)_script');
  assert.equal(baseNameOf('.mp3'), 'Song');
  assert.equal(outputFileName('Song', 'instrumental', 'mp3'), 'Song_Instrumental.mp3');
  assert.equal(outputFileName('Song', 'vocals', 'wav'), 'Song_Vocals.wav');
  const cd = contentDisposition('نشيد_Vocals.mp3');
  assert.match(cd, /^attachment; filename="Vocals\.mp3"; filename\*=UTF-8''%D9%86/);
});

// ---------------------------------------------------------------- فحص الملفات الحقيقية
const expectDur = { 'tone.wav': 4, 'tone-cbr.mp3': 4.05, 'tone-vbr.mp3': 4.05, 'tone-noxing.mp3': 4.05, 'tone-mpeg2.mp3': 4.07, 'tone.flac': 4, 'tone.m4a': 4, 'tone-faststart.m4a': 4, 'short.wav': 2 };
const expectCont = { wav: 'wav', mp3: 'mp3', flac: 'flac', m4a: 'mp4' };
for (const [name, d] of Object.entries(expectDur)) {
  test(`probeAudio: ${name} → النوع والمدة الحقيقية`, async () => {
    const buf = fx(name);
    const r = await probeAudio(reader(buf), buf.length);
    assert.equal(r.error, undefined);
    assert.equal(r.container, expectCont[name.split('.').pop()]);
    assert.ok(Math.abs(r.duration - d) < 0.2, `${name}: ${r.duration}`);
  });
}
test('probeAudio: معدل البت التقريبي لملف MP3 (لإبلاغ المعلم بجودة المصدر)', async () => {
  const b = fx('tone-cbr.mp3');
  const r = await probeAudio(reader(b), b.length);
  assert.ok(Math.abs(r.kbps - 64) <= 3, String(r.kbps));
});
test('probeAudio: ملف ليس صوتًا رغم امتداده .mp3 → مرفوض', async () => {
  const b = fx('fake.mp3');
  assert.equal((await probeAudio(reader(b), b.length)).error, 'unsupported-format');
  assert.equal(sniffContainer(Buffer.from('%PDF-1.7 aaaaaaaaaaaaaaaa')), null);
});
test('probeAudio: وسم ID3 ضخم (صورة غلاف 300KB) قبل الصوت', async () => {
  const mp3 = fx('tone-cbr.mp3');
  const inner = 300 * 1024;
  const hdr = Buffer.from([0x49, 0x44, 0x33, 3, 0, 0, (inner >> 21) & 0x7f, (inner >> 14) & 0x7f, (inner >> 7) & 0x7f, inner & 0x7f]);
  const strip = mp3.subarray(10 + ((mp3[6] << 21) | (mp3[7] << 14) | (mp3[8] << 7) | mp3[9]));
  const buf = Buffer.concat([hdr, Buffer.alloc(inner, 0), strip]);
  const r = await probeAudio(reader(buf), buf.length);
  assert.equal(r.container, 'mp3'); assert.ok(Math.abs(r.duration - 4.05) < 0.2, String(r.duration));
});
test('probeAudio: M4A كبير وصندوق moov في نهاية الملف', async () => {
  const box = (type, body) => { const b = Buffer.alloc(8 + body.length); b.writeUInt32BE(8 + body.length, 0); b.write(type, 4, 'latin1'); body.copy(b, 8); return b; };
  const mvhd = Buffer.alloc(100); mvhd[0] = 0; mvhd.writeUInt32BE(1000, 12); mvhd.writeUInt32BE(605_000, 16); // 605s
  const buf = Buffer.concat([box('ftyp', Buffer.from('M4A \0\0\0\0isomM4A ', 'latin1')), box('mdat', Buffer.alloc(900 * 1024)), box('moov', box('mvhd', mvhd))]);
  const r = await probeAudio(reader(buf), buf.length);
  assert.equal(r.container, 'mp4'); assert.equal(r.duration, 605);
});
test('probeAudio: WAV فيه مقطع LIST قبل البيانات', async () => {
  const w = fx('tone.wav');
  const list = Buffer.concat([Buffer.from('LIST', 'latin1'), Buffer.from([10, 0, 0, 0]), Buffer.from('INFOabcdef', 'latin1')]);
  const buf = Buffer.concat([w.subarray(0, 36), list, w.subarray(36)]);
  const r = await probeAudio(reader(buf), buf.length);
  assert.ok(Math.abs(r.duration - 4) < 0.01);
});

// ---------------------------------------------------------------- المزوّد
test('pickStem: أشكال المخرجات المختلفة', () => {
  const b = 'https://replicate.delivery/x/';
  assert.equal(pickStem({ vocals: b + 'v.mp3', no_vocals: b + 'nv.mp3' }, 'instrumental'), b + 'nv.mp3');
  assert.equal(pickStem({ vocals: b + 'v.mp3', no_vocals: b + 'nv.mp3' }, 'vocals'), b + 'v.mp3');
  assert.equal(pickStem({ vocals: b + 'v.mp3', instrumental: b + 'i.mp3', drums: null }, 'instrumental'), b + 'i.mp3');
  assert.equal(pickStem({ vocals: b + 'v.mp3', accompaniment: b + 'a.mp3' }, 'instrumental'), b + 'a.mp3');
  assert.equal(pickStem([b + 'song/vocals.mp3', b + 'song/no_vocals.mp3'], 'instrumental'), b + 'song/no_vocals.mp3');
  assert.equal(pickStem([b + 'song/vocals.mp3', b + 'song/no_vocals.mp3'], 'vocals'), b + 'song/vocals.mp3');
  // فصل رباعي (طبول/باص/أخرى) لا يعطي «موسيقى كاملة» → لا نخمّن
  assert.equal(pickStem({ drums: b + 'd', bass: b + 'b', other: b + 'o', vocals: b + 'v' }, 'instrumental'), null);
  assert.equal(pickStem({ vocals: b + 'v', drums: b + 'd' }, 'instrumental'), null);
  assert.equal(pickStem('nope', 'vocals'), null); assert.equal(pickStem({ vocals: 'http://insecure/v' }, 'vocals'), null);
});
test('progressFromLogs: نسبة حقيقية من سجل النموذج أو لا شيء', () => {
  assert.equal(progressFromLogs('', 4), null);
  assert.equal(progressFromLogs('Separating...', 4), null);
  assert.equal(progressFromLogs(' 50%|█████', 4), 13);
  assert.equal(progressFromLogs(' 0%|\n 50%|\n100%|\n 25%|', 4), 31);
  assert.equal(progressFromLogs('0%|\n100%|\n0%|\n100%|\n0%|\n100%|\n0%|\n100%|', 4), 99);
  assert.equal(progressFromLogs('100%|\n0%|\n100%|\n0%|\n100%|\n0%|\n100%|\n0%|\n100%|\n10%|', 4), null); // بنية غير متوقعة
  assert.equal(progressFromLogs(' 50%|', 0), null);
});
test('Replicate: الطلب يحمل الإصدار المثبّت والمدخلات الصحيحة، والمفتاح في الترويسة فقط', async () => {
  const calls = [];
  const fetchImpl = async (url, init) => { calls.push({ url, init }); return new Response(JSON.stringify({ id: 'abc123def456', status: 'starting' }), { status: 201 }); };
  const preset = getPreset({});
  const p = makeReplicateProvider({ token: 'r8_secret', preset, fetchImpl });
  const r = await p.create({ audioUrl: 'https://r2.test/in.mp3?sig', format: 'mp3', bitrate: 320 });
  assert.deepEqual(r, { id: 'abc123def456', status: 'queued' });
  const body = JSON.parse(calls[0].init.body);
  assert.equal(calls[0].url, 'https://api.replicate.com/v1/predictions');
  assert.equal(calls[0].init.headers.Authorization, 'Bearer r8_secret');
  assert.equal(body.version, MODEL_PRESETS['demucs-ft'].defaultVersion);
  assert.deepEqual([body.input.audio, body.input.model, body.input.stem, body.input.output_format, body.input.mp3_bitrate, body.input.clip_mode],
    ['https://r2.test/in.mp3?sig', 'htdemucs_ft', 'vocals', 'mp3', 320, 'rescale']);
  assert.ok(!calls[0].init.body.includes('r8_secret'));
});
test('Replicate: أخطاء الخدمة تُترجم لرموز واضحة', async () => {
  for (const [status, code] of [[401, 'provider-auth'], [402, 'provider-billing'], [429, 'provider-busy'], [500, 'provider-error']]) {
    const p = makeReplicateProvider({ token: 't', preset: getPreset({}), fetchImpl: async () => new Response('{}', { status }) });
    await assert.rejects(p.create({ audioUrl: 'https://x', format: 'mp3', bitrate: 320 }), (e) => e.code === code);
  }
  const down = makeReplicateProvider({ token: 't', preset: getPreset({}), fetchImpl: async () => { throw new TypeError('fetch failed'); } });
  await assert.rejects(down.get('abc12345'), (e) => e.code === 'provider-unreachable');
  const none = makeReplicateProvider({ token: null, preset: getPreset({}) });
  assert.equal(none.configured(), false);
  await assert.rejects(none.create({}), (e) => e.code === 'provider-not-configured');
});
test('Replicate: الحالات تُنقل كما هي · لا نفتح روابط خارج replicate.delivery', async () => {
  const p = makeReplicateProvider({ token: 't', preset: getPreset({}), fetchImpl: async () => new Response(JSON.stringify({ id: 'a', status: 'processing', logs: ' 10%|', output: null, metrics: {} })) });
  const g = await p.get('abcdef12');
  assert.equal(g.status, 'processing'); assert.equal(g.logs, ' 10%|');
  await assert.rejects(p.openOutput('https://evil.example/x.mp3'), (e) => e.code === 'unexpected-output');
  await assert.rejects(p.get('../../x'), (e) => e.code === 'provider-error');
});
test('getPreset: النموذج الافتراضي Demucs، والتجريبي بالاختيار فقط', () => {
  assert.equal(getPreset({}).id, 'demucs-ft');
  assert.equal(getPreset({ SEPARATOR_MODEL: 'bs-roformer' }).id, 'bs-roformer');
  assert.equal(getPreset({ SEPARATOR_MODEL: 'rm -rf' }).id, 'demucs-ft');
  assert.equal(getPreset({ REPLICATE_DEMUCS_VERSION: ' abc ' }).version, 'abc');
});

// ---------------------------------------------------------------- التقسيم والمرشحات
const streamOf = (sizes) => new ReadableStream({ start(c) { for (const s of sizes) c.enqueue(new Uint8Array(s).fill(7)); c.close(); } });
test('splitStream: أجزاء متساوية بالضبط (شرط R2) والأخير أصغر', async () => {
  const run = async (sizes) => { const out = []; await splitStream(streamOf(sizes), 100, async (b, i, last) => out.push([b.length, i, last])); return out; };
  assert.deepEqual(await run([]), [[0, 0, true]]);
  assert.deepEqual(await run([30, 30]), [[60, 0, true]]);
  assert.deepEqual(await run([100]), [[100, 0, true]]);
  assert.deepEqual(await run([70, 70, 70, 40]), [[100, 0, false], [100, 1, false], [50, 2, true]]);
  assert.deepEqual(await run([250]), [[100, 0, false], [100, 1, false], [50, 2, true]]);
  assert.deepEqual(await run([200]), [[100, 0, false], [100, 1, true]]);
});
test('مرشحات MongoDB: التحديث الذرّي والتنظيف', () => {
  assert.deepEqual(updateFilter('a'), { _id: 'a' });
  assert.deepEqual(updateFilter('a', { statusIn: ['awaiting-upload'] }), { _id: 'a', status: { $in: ['awaiting-upload'] } });
  const d = new Date(1000);
  const f = updateFilter('a', { statusIn: ['queued', 'processing', 'finalizing'], finalizingBefore: d });
  assert.deepEqual(f.$or[0], { status: { $in: ['queued', 'processing'] } });
  assert.equal(f.$or[1].status, 'finalizing');
  assert.equal(purgeableFilter(new Date(), L).$or.length, 4);
});

// ---------------------------------------------------------------- واجهات API (كاملة ببدائل)
const HOST = 'musiteacher.test';
const future = new Date(Date.now() + 365 * 864e5);
const USERS = { sub: { role: 'user', isSubscribed: true, subscriptionEndDate: future }, sub2: { role: 'user', isSubscribed: true, subscriptionEndDate: future }, free: { role: 'user', isSubscribed: false }, admin: { role: 'admin' } };

function setup(opts = {}) {
  let clock = opts.start || Date.now();
  const store = fakeStore(), storage = fakeStorage(opts.storage), provider = fakeProvider(opts.provider);
  const limits = { ...getLimits({}), ...(opts.limits || {}) };
  const h = makeHandlers({
    verifyIdToken: async (t) => { if (!t.startsWith('good-')) throw new Error('bad'); return { uid: t.slice(5) }; },
    findUser: async (uid) => USERS[uid] || null,
    jobs: store, storage, provider, limits, now: () => new Date(clock),
  });
  const req = (method, url, { body, user = 'sub', headers = {} } = {}) => new Request(`https://${HOST}${url}`, {
    method, headers: { host: HOST, 'content-type': 'application/json', ...(user ? { authorization: `Bearer good-${user}` } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  const ctx = (jobId) => ({ params: Promise.resolve({ jobId }) });
  const api = {
    create: async (b = {}, o) => { const r = await h.createJob(req('POST', '/api/audio-separator/jobs', { body: okBody({ requestId: 'r' + Math.random().toString(36).slice(2, 12), ...b }), ...o })); return { status: r.status, data: await r.json() }; },
    start: async (id, o) => { const r = await h.jobAction(req('POST', `/api/audio-separator/jobs/${id}`, { body: { action: 'start' }, ...o }), ctx(id)); return { status: r.status, data: await r.json() }; },
    get: async (id, o) => { clock += 2000; const r = await h.getJob(req('GET', `/api/audio-separator/jobs/${id}`, o), ctx(id)); return { status: r.status, data: await r.json() }; },
    del: async (id, o) => { const r = await h.deleteJob(req('DELETE', `/api/audio-separator/jobs/${id}`, o), ctx(id)); return { status: r.status, data: await r.json() }; },
  };
  const upload = (job, buf) => storage.put(store.rows.get(job.id).inputKey, buf);
  return { h, api, store, storage, provider, limits, upload, tick: (ms) => { clock += ms; }, req };
}

const mp3 = fx('tone-cbr.mp3');
const body4 = (o = {}) => ({ size: mp3.length, duration: 4.05, ...o });

test('API: بدون دخول 401 · غير مشترك 403 · مصدر خارجي 403', async () => {
  const { api } = setup();
  assert.equal((await api.create(body4(), { user: null })).status, 401);
  assert.equal((await api.create(body4(), { user: 'free' })).status, 403);
  assert.equal((await api.create(body4(), { headers: { origin: 'https://evil.example' } })).status, 403);
});
test('API: الخدمة غير مهيأة (بلا مفتاح Replicate) → 503 صريح وبلا أي نتيجة وهمية', async () => {
  const { api, store } = setup({ provider: { configured: false } });
  const r = await api.create(body4());
  assert.equal(r.status, 503); assert.equal(r.data.error, 'service-not-configured'); assert.equal(store.rows.size, 0);
  const s = setup({ storage: { configured: false } });
  assert.equal((await s.api.create(body4())).data.detail, 'storage-not-configured');
});
test('API: الدورة الكاملة — موسيقى فقط (Instrumental)', async () => {
  const { api, storage, provider, store } = setup();
  const c = await api.create(body4({ fileName: 'نشيد الصباح.mp3' }));
  assert.equal(c.status, 201);
  assert.equal(c.data.job.status, 'awaiting-upload');
  assert.equal(c.data.job.outputFileName, 'نشيد_الصباح_Instrumental.mp3');
  assert.equal(c.data.upload.method, 'PUT'); assert.equal(c.data.upload.headers['Content-Type'], 'audio/mpeg');
  assert.ok(!JSON.stringify(c.data.job).includes('audio-separator/'), 'مفاتيح التخزين لا تُكشف في بيانات المهمة');
  const id = c.data.job.id;

  assert.equal((await api.start(id)).data.error, 'upload-missing');
  storage.put(store.rows.get(id).inputKey, mp3);
  const s = await api.start(id);
  assert.equal(s.status, 200); assert.equal(s.data.job.status, 'queued'); assert.equal(s.data.job.stage, 'starting');
  assert.ok(Math.abs(s.data.job.duration - 4.05) < 0.2);
  assert.equal(provider.calls.create.length, 1);
  assert.match(provider.calls.create[0].audioUrl, /input\.mp3\?get&ttl=7200/);
  assert.equal((await api.start(id)).data.job.status, 'queued');
  assert.equal(provider.calls.create.length, 1, 'لا تبدأ المعالجة مرتين');

  const predId = store.rows.get(id).predictionId;
  provider.advance(predId, 'processing');
  store.rows.get(id).lastPolledAt = new Date(0);
  const g1 = await api.get(id);
  assert.equal(g1.data.job.stage, 'separating'); assert.equal(g1.data.job.progress, 31);

  provider.advance(predId, 'succeeded');
  store.rows.get(id).lastPolledAt = new Date(0);
  const g2 = await api.get(id);
  assert.equal(g2.data.job.status, 'ready');
  assert.match(provider.calls.open[0], /no_vocals\.mp3$/);
  const row = store.rows.get(id);
  assert.equal(storage.objects.get(row.outputKey)[0], 0x11, 'المحفوظ هو مسار المصاحبة');
  assert.equal(storage.objects.has(row.inputKey), false, 'الملف الأصلي يُحذف من التخزين فور انتهاء المعالجة');
  assert.match(g2.data.job.downloadUrl, /rcd=attachment/); assert.match(decodeURIComponent(decodeURIComponent(g2.data.job.downloadUrl)), /نشيد_الصباح_Instrumental\.mp3/);
  assert.match(g2.data.job.playUrl, /rcd=inline/);
  assert.ok(g2.data.job.expiresAt);
});
test('API: الصوت البشري فقط (Vocals) بصيغة WAV', async () => {
  const { api, storage, provider, store } = setup();
  const c = await api.create(body4({ mode: 'vocals', format: 'wav', bitrate: undefined }));
  const id = c.data.job.id;
  assert.equal(c.data.job.outputFileName, 'Song_Vocals.wav');
  storage.put(store.rows.get(id).inputKey, mp3);
  await api.start(id);
  assert.equal(provider.calls.create[0].format, 'wav');
  provider.advance(store.rows.get(id).predictionId, 'succeeded');
  const g = await api.get(id);
  assert.equal(g.data.job.status, 'ready');
  assert.match(provider.calls.open[0], /\/vocals\.mp3$/);
  assert.equal(storage.objects.get(store.rows.get(id).outputKey)[0], 0x22);
});
test('API: إعادة إرسال الطلب نفسه لا تنشئ مهمة ثانية · مهمة نشطة واحدة لكل مستخدم', async () => {
  const { api, store } = setup();
  const a = await api.create(body4({ requestId: 'same-request-1' }));
  const b = await api.create(body4({ requestId: 'same-request-1' }));
  assert.equal(b.status, 200); assert.equal(b.data.job.id, a.data.job.id); assert.ok(b.data.upload.url);
  assert.equal(store.rows.size, 1);
  const c = await api.create(body4());
  assert.equal(c.status, 409); assert.equal(c.data.error, 'busy'); assert.equal(c.data.activeJobId, a.data.job.id);
});
test('API: ملف مزيّف بامتداد mp3 → مرفوض قبل أي إرسال للمزوّد، ويُحذف، ولا يُحتسب من الحصة', async () => {
  const { api, storage, provider, store } = setup();
  const fake = fx('fake.mp3');
  const c = await api.create(body4({ size: fake.length }));
  storage.put(store.rows.get(c.data.job.id).inputKey, fake);
  const s = await api.start(c.data.job.id);
  assert.equal(s.status, 400); assert.equal(s.data.error, 'unsupported-format');
  assert.equal(provider.calls.create.length, 0);
  assert.equal(storage.objects.size, 0);
  assert.equal(await store.countStartedSince('sub', new Date(0)), 0);
  assert.equal((await api.create(body4())).status, 201, 'المستخدم يستطيع المحاولة بملف آخر فورًا');
});
test('API: حجم مختلف عن المعلن · امتداد لا يطابق المحتوى · مدة أطول من الحد', async () => {
  const s1 = setup();
  let c = await s1.api.create(body4({ size: mp3.length + 10 }));
  s1.upload(c.data.job, mp3);
  assert.equal((await s1.api.start(c.data.job.id)).data.error, 'upload-mismatch');

  const s2 = setup();
  const wav = fx('tone.wav');
  c = await s2.api.create(body4({ size: wav.length }));
  s2.upload(c.data.job, wav);
  assert.equal((await s2.api.start(c.data.job.id)).data.error, 'format-mismatch');

  const s3 = setup({ limits: { maxSeconds: 2 } });
  c = await s3.api.create(body4({ fileName: 'x.wav', type: 'audio/wav', size: wav.length, duration: undefined, format: 'mp3' }));
  s3.upload(c.data.job, wav);
  const r = await s3.api.start(c.data.job.id);
  assert.equal(r.data.error, 'too-long'); assert.equal(s3.provider.calls.create.length, 0);

  const s4 = setup();
  const sh = fx('short.wav');
  c = await s4.api.create(body4({ fileName: 'x.wav', type: 'audio/wav', size: sh.length, duration: undefined }));
  s4.upload(c.data.job, sh);
  assert.equal((await s4.api.start(c.data.job.id)).data.error, 'too-short');
});
test('API: فشل المعالجة لدى المزوّد → رسالة واضحة وحذف الملف', async () => {
  const { api, storage, provider, store } = setup();
  const c = await api.create(body4()); const id = c.data.job.id;
  storage.put(store.rows.get(id).inputKey, mp3); await api.start(id);
  provider.advance(store.rows.get(id).predictionId, 'failed');
  const g = await api.get(id);
  assert.equal(g.data.job.status, 'failed'); assert.equal(g.data.job.error, 'separation-failed');
  assert.ok(!JSON.stringify(g.data).includes('CUDA'), 'تفاصيل الخادم الداخلية لا تُعرض');
  assert.equal(storage.objects.size, 0);
});
test('API: انقطاع مؤقت مع المزوّد لا يُفشل المهمة · المزوّد مشغول عند البدء → 503 دون احتساب الحصة', async () => {
  const s = setup();
  const c = await s.api.create(body4()); const id = c.data.job.id;
  s.storage.put(s.store.rows.get(id).inputKey, mp3); await s.api.start(id);
  s.provider.calls.get = 0;
  const realGet = s.provider.get; s.provider.get = async () => { const e = new Error('x'); e.code = 'provider-unreachable'; throw e; };
  s.store.rows.get(id).lastPolledAt = new Date(0);
  const g = await s.api.get(id);
  assert.equal(g.status, 200); assert.equal(g.data.job.status, 'queued');
  s.provider.get = realGet;

  const b = setup({ provider: { fail: 'create' } });
  const c2 = await b.api.create(body4()); b.upload(c2.data.job, mp3);
  const r = await b.api.start(c2.data.job.id);
  assert.equal(r.status, 503); assert.equal(r.data.error, 'provider-busy');
  assert.equal(await b.store.countStartedSince('sub', new Date(0)), 0);
  assert.equal(b.storage.objects.size, 0);
});
test('API: مخرجات بشكل غير متوقع → فشل واضح بدل تسليم ملف خاطئ', async () => {
  const { api, storage, provider, store } = setup({ provider: { outputShape: 'weird' } });
  const c = await api.create(body4()); const id = c.data.job.id;
  storage.put(store.rows.get(id).inputKey, mp3); await api.start(id);
  provider.advance(store.rows.get(id).predictionId, 'succeeded');
  assert.equal((await api.get(id)).data.job.error, 'unexpected-output');
});
test('API: تعذّر تنزيل الناتج من المزوّد → finalize-failed', async () => {
  const { api, storage, provider, store } = setup({ provider: { fail: 'open' } });
  const c = await api.create(body4()); const id = c.data.job.id;
  storage.put(store.rows.get(id).inputKey, mp3); await api.start(id);
  provider.advance(store.rows.get(id).predictionId, 'succeeded');
  assert.equal((await api.get(id)).data.job.error, 'finalize-failed');
});
test('API: الإلغاء أثناء المعالجة يوقف المزوّد ويحذف الملفات · الحذف بعد الانتهاء', async () => {
  const { api, storage, provider, store } = setup();
  let c = await api.create(body4()); let id = c.data.job.id;
  storage.put(store.rows.get(id).inputKey, mp3); await api.start(id);
  const d = await api.del(id);
  assert.equal(d.data.job.status, 'canceled'); assert.equal(provider.calls.cancel.length, 1); assert.equal(storage.objects.size, 0);

  c = await api.create(body4()); id = c.data.job.id;
  storage.put(store.rows.get(id).inputKey, mp3); await api.start(id);
  provider.advance(store.rows.get(id).predictionId, 'succeeded'); await api.get(id);
  assert.equal(storage.objects.size, 1);
  assert.equal((await api.del(id)).data.job.status, 'deleted');
  assert.equal(storage.objects.size, 0);
  const g = await api.get(id);
  assert.equal(g.data.job.playUrl, undefined);
});
test('API: مهمة مستخدم آخر غير مرئية · معرّف ملغوم → 404', async () => {
  const { api } = setup();
  const c = await api.create(body4());
  assert.equal((await api.get(c.data.job.id, { user: 'sub2' })).status, 404);
  assert.equal((await api.del(c.data.job.id, { user: 'sub2' })).status, 404);
  assert.equal((await api.get('../../etc')).status, 404);
});
test('API: الحصة اليومية · السعة القصوى للخدمة · الأدمن معفى من الحصة', async () => {
  const s = setup({ limits: { dailyPerUser: 1 } });
  const c = await s.api.create(body4()); s.upload(c.data.job, mp3); await s.api.start(c.data.job.id);
  s.provider.advance(s.store.rows.get(c.data.job.id).predictionId, 'succeeded'); await s.api.get(c.data.job.id);
  const r = await s.api.create(body4());
  assert.equal(r.status, 429); assert.equal(r.data.error, 'daily-limit');
  assert.equal((await s.api.create(body4(), { user: 'admin' })).status, 201);

  const g = setup({ limits: { activeGlobal: 1 } });
  await g.api.create(body4());
  const r2 = await g.api.create(body4(), { user: 'sub2' });
  assert.equal(r2.status, 503); assert.equal(r2.data.error, 'capacity');
});
test('API: انتهاء صلاحية النتيجة → تُحذف تلقائيًا · مهمة عالقة → تُلغى ولا تحجز المستخدم', async () => {
  const s = setup();
  const c = await s.api.create(body4()); const id = c.data.job.id;
  s.upload(c.data.job, mp3); await s.api.start(id);
  s.provider.advance(s.store.rows.get(id).predictionId, 'succeeded'); await s.api.get(id);
  s.tick(s.limits.resultTtlHours * 3600e3 + 1000);
  const g = await s.api.get(id);
  assert.equal(g.data.job.status, 'expired'); assert.equal(s.storage.objects.size, 0);

  const t = setup();
  const c2 = await t.api.create(body4()); t.upload(c2.data.job, mp3); await t.api.start(c2.data.job.id);
  t.tick(t.limits.staleActiveMs + 1000);
  const n = await t.api.create(body4());
  assert.equal(n.status, 201, 'المهمة العالقة لا تمنع المستخدم من البدء من جديد');
  assert.equal(t.store.rows.get(c2.data.job.id).error, 'timeout');
  assert.equal(t.provider.calls.cancel.length, 1);
});
test('API: رفع لم يكتمل خلال المهلة → يُنظَّف', async () => {
  const s = setup();
  const c = await s.api.create(body4()); s.upload(c.data.job, mp3);
  s.tick(s.limits.staleUploadMs + 1000);
  assert.equal((await s.api.get(c.data.job.id)).data.job.error, 'upload-timeout');
  assert.equal(s.storage.objects.size, 0);
});
test('API: health و limits لا يكشفان أي سر', async () => {
  const s = setup();
  const r = await s.h.health();
  const d = await r.json();
  assert.equal(d.ok, true); assert.equal(d.checks.provider, 'ok'); assert.equal(d.limits.maxMinutes, 10);
  const li = await (await s.h.limitsInfo(s.req('GET', '/api/audio-separator/limits'))).json();
  assert.equal(li.configured, true); assert.equal(li.usage.dailyLimit, 10); assert.equal(li.activeJobId, null);
  assert.equal((await s.h.limitsInfo(s.req('GET', '/api/audio-separator/limits', { user: null }))).status, 401);
});
