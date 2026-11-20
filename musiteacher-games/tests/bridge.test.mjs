// اختبارات الجسر مع MusiTeacher: كل سبب فشل يُشخَّص بدقة، والطالب لا يرى أي تفاصيل تقنية
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeBridge } from '../lib/bridge.mjs';
import { config } from '../lib/core.mjs';

const env = { GAMES_RELEASE: '2026-S2', GAMES_SESSION_SECRET: 's'.repeat(40), MUSITEACHER_URL: 'https://musi-teacher.vercel.app', STUDENT_GAMES_BRIDGE_SECRET: 'b'.repeat(40), VERCEL: '1' };
const reply = (status, body) => async () => ({ status, json: async () => { if (typeof body === 'string') throw new Error('not json'); return body; } });

test('تشخيص دقيق لكل سبب فشل في الاتصال بـ MusiTeacher', async () => {
  const cases = [
    [{}, reply(404, '<html>'), 'mt-endpoint-missing'],                                  // MusiTeacher المنشور بلا ميزة الألعاب الطلابية
    [{}, reply(401, { ok: false, error: 'forbidden' }), 'bridge-secret-mismatch'],
    [{}, reply(503, { ok: false, error: 'not-configured' }), 'mt-env-missing'],
    [{}, reply(500, { ok: false, error: 'server-error' }), 'mt-server-error'],
    [{}, async () => { throw new TypeError('fetch failed'); }, 'mt-unreachable'],
    [{ MUSITEACHER_URL: 'http://localhost:3000' }, null, 'mt-url-local'],
    [{ MUSITEACHER_URL: 'https://musi-teacher.vercel.app/' + '' , STUDENT_GAMES_BRIDGE_SECRET: 'short' }, null, 'bridge-secret-short'],
    [{ MUSITEACHER_URL: '' }, null, 'games-env-missing'],
  ];
  for (const [over, f, want] of cases) {
    const r = await makeBridge(config({ ...env, ...over }), f || (async () => { throw new Error('يجب ألا يتصل'); })).verify('g', '123456', 'c');
    assert.equal(r.ok, false); assert.equal(r.detail, want, JSON.stringify(over));
  }
  // الردود الطبيعية تمر كما هي بلا تشخيص
  const ok = await makeBridge(config(env), reply(200, { ok: true, sid: 'x', exp: 1 })).verify('g', '1', 'c');
  assert.deepEqual(ok, { ok: true, sid: 'x', exp: 1 });
  const inv = await makeBridge(config(env), reply(200, { ok: false, error: 'invalid' })).verify('g', '1', 'c');
  assert.equal(inv.error, 'invalid'); assert.equal(inv.detail, undefined);
});
