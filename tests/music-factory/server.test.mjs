import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultProject, splitPastedLyrics, normalizeProject, newSection } from '../../src/modules/music-factory/core/project.js';
import { buildLocalPrompt, lyricsPreserved } from '../../src/modules/music-factory/core/promptBuilder.js';
import { createMusicFactoryHandler } from '../../src/modules/music-factory/server/http.js';
import { makeMusiTeacherAuthorize } from '../../src/modules/music-factory/adapters/musiteacherAuth.js';

const LYR = `المذهب
يا مدرستي يا نور عيوني
فيكي تعلمت وكبرت ظنوني

الكوبليه الأول
كل صباح نغني سوا
للعلم وللوطن الهوا`;

function song() {
  const p = defaultProject('song');
  p.sections = splitPastedLyrics(LYR);
  p.choices.genre = 'school'; p.choices.mood = 'joyful'; p.choices.instruments.chorus = ['Violins', 'Darbuka'];
  return normalizeProject(p);
}

const auth = { ok: true, userId: 'u1' };
const req = (action, body, method = 'POST', headers = {}) => new Request(`http://localhost/api/music-factory/${action}`, {
  method, headers: { 'content-type': 'application/json', authorization: 'Bearer t', ...headers }, body: body ? JSON.stringify(body) : undefined,
});
const SECRET = 'sk_secret_ELEVEN_123456';

test('splits pasted lyrics into chorus + verse without altering words', () => {
  const p = song();
  assert.deepEqual(p.sections.map((s) => s.type), ['chorus', 'verse']);
  const out = buildLocalPrompt(p);
  assert.ok(lyricsPreserved(p, out.lyrics));
  assert.match(out.lyrics, /\[Chorus: Violins, Darbuka\]\nيا مدرستي يا نور عيوني/);
  assert.match(out.style, /School anthem/);
  assert.ok(/^[\x20-\x7E]*$/.test(out.style));
});

test('instrumental local prompt has no vocals and English notes only', () => {
  const p = defaultProject('instrumental'); p.choices.extra = 'وصف عربي'; p.choices.genre = 'cinematic';
  const out = buildLocalPrompt(normalizeProject(p));
  assert.match(out.style, /no vocals/); assert.match(out.exclude, /vocals/);
  assert.ok(!/[^\x00-\x7F]/.test(out.style));
});

test('status requires auth and never leaks keys', async () => {
  const h = createMusicFactoryHandler({ authorize: async () => ({ ok: false, status: 401, error: 'x' }), env: { ELEVENLABS_API_KEY: SECRET } });
  assert.equal((await h(req('status', null, 'GET'), 'status')).status, 401);
  const h2 = createMusicFactoryHandler({ authorize: async () => auth, env: { ELEVENLABS_API_KEY: SECRET, GEMINI_API_KEY: 'g_secret_999', MF_LYRIA_ENABLED: 'true' } });
  const r = await h2(req('status', null, 'GET'), 'status');
  const txt = await r.text();
  assert.equal(r.status, 200);
  assert.ok(!txt.includes(SECRET) && !txt.includes('g_secret_999'));
  const j = JSON.parse(txt);
  assert.equal(j.audio.ready.song, true);
  assert.deepEqual(j.audio.auto.song, ['elevenlabs', 'lyria']);
  assert.ok(!j.audio.auto.song.includes('suno_selfhosted'));
});

test('generate with no engines → 503 notConfigured, no fake audio', async () => {
  const h = createMusicFactoryHandler({ authorize: async () => auth, env: {} });
  const p = song();
  const r = await h(req('generate', { project: p, output: buildLocalPrompt(p) }), 'generate');
  assert.equal(r.status, 503);
  const j = await r.json();
  assert.equal(j.notConfigured, true);
  assert.match(r.headers.get('content-type'), /json/);
});

test('generate streams real engine bytes with meta header (ElevenLabs mock)', async () => {
  const calls = [];
  const audio = new Uint8Array(5000).fill(7);
  const fetchImpl = async (url, init) => {
    calls.push({ url: String(url), init });
    return new Response(audio, { status: 200, headers: { 'content-type': 'audio/mpeg' } });
  };
  const h = createMusicFactoryHandler({ authorize: async () => auth, env: { ELEVENLABS_API_KEY: SECRET }, fetchImpl });
  const p = song();
  const r = await h(req('generate', { project: p, output: buildLocalPrompt(p), quality: 'full' }), 'generate');
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('content-type'), 'audio/mpeg');
  const buf = new Uint8Array(await r.arrayBuffer());
  assert.equal(buf.length, 5000);
  const meta = JSON.parse(Buffer.from(r.headers.get('x-mf-meta'), 'base64url').toString());
  assert.equal(meta.engine, 'elevenlabs');
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /\/v1\/music/);
  const body = JSON.parse(calls[0].init.body);
  const lyricsSent = JSON.stringify(body);
  assert.ok(lyricsSent.includes('يا مدرستي يا نور عيوني'));
  // ترتيب الأقسام محفوظ: المذهب قبل الكوبليه
  assert.ok(lyricsSent.indexOf('يا مدرستي') < lyricsSent.indexOf('كل صباح'));
  for (const h of Object.values(r.headers)) assert.ok(!String(h).includes(SECRET));
});

test('fallback: ElevenLabs fails → Lyria used; disabled fallback → only one engine called', async () => {
  const b64 = Buffer.alloc(4000, 3).toString('base64');
  const mk = (log) => async (url) => {
    log.push(String(url));
    if (/elevenlabs/.test(url)) return new Response(JSON.stringify({ detail: 'boom' }), { status: 500 });
    return Response.json({ steps: [{ type: 'model_output', content: [{ type: 'audio', mime_type: 'audio/mpeg', data: b64 }] }] });
  };
  const env = { ELEVENLABS_API_KEY: SECRET, GEMINI_API_KEY: 'g', MF_LYRIA_ENABLED: 'true' };
  const p = song();
  const log1 = [];
  const h = createMusicFactoryHandler({ authorize: async () => auth, env, fetchImpl: mk(log1) });
  const r = await h(req('generate', { project: p, output: buildLocalPrompt(p) }), 'generate');
  assert.equal(r.status, 200);
  const meta = JSON.parse(Buffer.from(r.headers.get('x-mf-meta'), 'base64url').toString());
  assert.equal(meta.engine, 'lyria');
  assert.equal(meta.attempts[0].ok, false);
  const log2 = [];
  const h2 = createMusicFactoryHandler({ authorize: async () => auth, env, fetchImpl: mk(log2) });
  const r2 = await h2(req('generate', { project: p, output: buildLocalPrompt(p), allowFallback: false }), 'generate');
  assert.equal(r2.status, 502);
  assert.ok(log2.every((u) => /elevenlabs/.test(u)), 'lyrics must not reach a second provider');
  const j = await r2.json();
  assert.ok(j.error.length > 5);
});

test('unofficial Suno is never used automatically', async () => {
  const env = { MF_SUNO_SELFHOSTED_URL: 'http://suno.local', MF_SUNO_UNOFFICIAL_ACK: 'I_ACCEPT_THE_RISK' };
  const log = [];
  const h = createMusicFactoryHandler({ authorize: async () => auth, env, fetchImpl: async (u) => { log.push(u); return new Response('x'); } });
  const p = song();
  const r = await h(req('generate', { project: p, output: buildLocalPrompt(p) }), 'generate');
  assert.equal(r.status, 503); assert.equal(log.length, 0);
});

test('prompt without AI keys returns local fallback (not an error page)', async () => {
  const h = createMusicFactoryHandler({ authorize: async () => auth, env: {} });
  const r = await h(req('prompt', { project: song() }), 'prompt');
  const j = await r.json();
  assert.equal(r.status, 503); assert.ok(j.fallback && j.fallback.style);
  const a = await (await h(req('analyze', { project: song() }), 'analyze')).json();
  assert.equal(a.provider, 'local');
});

test('MusiTeacher auth adapter: missing token 401, unsubscribed 403, cross-origin 403, subscriber ok', async () => {
  const deps = (user) => ({ verifyIdToken: async (t) => (t === 'good' ? { uid: 'u9' } : null), findUser: async () => user });
  const mk = (headers) => new Request('http://localhost/api/music-factory/status', { headers: { host: 'localhost', ...headers } });
  const sub = { isSubscribed: true, subscriptionEndDate: new Date(Date.now() + 1e9) };
  assert.equal((await makeMusiTeacherAuthorize(deps(sub))(mk({}))).status, 401);
  assert.equal((await makeMusiTeacherAuthorize(deps({ isSubscribed: false }))(mk({ authorization: 'Bearer good' }))).status, 403);
  assert.equal((await makeMusiTeacherAuthorize(deps(sub))(mk({ authorization: 'Bearer good', origin: 'https://evil.com' }))).status, 403);
  assert.equal((await makeMusiTeacherAuthorize(deps(sub))(mk({ authorization: 'Bearer bad' }))).status, 401);
  const ok = await makeMusiTeacherAuthorize(deps(sub))(mk({ authorization: 'Bearer good' }));
  assert.equal(ok.ok, true); assert.equal(ok.userId, 'u9');
  assert.equal((await makeMusiTeacherAuthorize(deps({ role: 'admin' }))(mk({ authorization: 'Bearer good' }))).ok, true);
});

test('rate limit on generate', async () => {
  const h = createMusicFactoryHandler({ authorize: async () => auth, env: { MF_AUDIO_RATE_LIMIT: '2' } });
  const p = song(); const body = { project: p, output: buildLocalPrompt(p) };
  await h(req('generate', body), 'generate'); await h(req('generate', body), 'generate');
  assert.equal((await h(req('generate', body), 'generate')).status, 429);
});

test('existing platform keys do not silently enable paid audio engines', async () => {
  const h = createMusicFactoryHandler({ authorize: async () => auth, env: { GEMINI_API_KEY: 'g', REPLICATE_API_TOKEN: 'r' } });
  const j = await (await h(req('status', null, 'GET'), 'status')).json();
  assert.equal(j.audio.ready.song, false); assert.equal(j.audio.ready.instrumental, false);
  assert.equal(j.brain.providers.find((p) => p.name === 'gemini').configured, true);
});
