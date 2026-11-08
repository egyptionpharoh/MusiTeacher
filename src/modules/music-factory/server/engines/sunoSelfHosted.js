// ⚠️ Suno عبر خادم «suno-api» ذاتي الاستضافة (مشروع مفتوح غير رسمي يعمل بكوكي حساب Suno).
// معطل افتراضيًا. لا يعمل إلا إذا فعّله المسؤول صراحة في متغيرات البيئة:
//   MF_SUNO_SELFHOSTED_URL=https://...   و   MF_SUNO_UNOFFICIAL_ACK=I_ACCEPT_THE_RISK
// ولا يُستخدم أبدًا تلقائيًا كبديل؛ يجب أن يختاره المعلم بنفسه من قائمة المحركات.
// السبب: Suno لا يوفّر API عامًا حتى الآن (برنامج الشركاء في مرحلة تجريبية)، وشروط Suno تمنع الأدوات الآلية
// (robots/scraping)، فاستخدام هذا الخادم قد يعرّض الحساب المستخدم للإيقاف.
import { fail, ascii, clip, readError, sleep } from './util.js';

const ACK = 'I_ACCEPT_THE_RISK';
const cfg = (env) => ({
  url: (env.MF_SUNO_SELFHOSTED_URL || '').replace(/\/$/, ''),
  ack: env.MF_SUNO_UNOFFICIAL_ACK === ACK,
  pollMs: Math.max(200, parseInt(env.MF_SUNO_POLL_MS || '5000', 10) || 5000),
});

export default {
  id: 'suno_selfhosted',
  label: 'Suno (خادم غير رسمي)',
  official: false,
  vocals: true,
  instrumental: true,
  preview: false,
  explicitOnly: true,
  note_ar: 'غير رسمي: يعمل بكوكي حساب Suno عبر خادم suno-api، وقد يخالف شروط Suno ويعرّض الحساب للإيقاف. يُستخدم فقط إذا اخترته بنفسك.',
  configured: (env) => { const c = cfg(env); return !!(c.url && c.ack); },
  model: () => 'suno-api',
  async generate(req, ctx) {
    const c = cfg(ctx.env);
    const instrumental = req.mode === 'instrumental';
    const payload = {
      prompt: instrumental ? '' : String(req.output.lyrics || '').slice(0, 5000),
      tags: ascii(req.output.style).slice(0, 1000),
      negative_tags: ascii(req.output.exclude).slice(0, 250),
      title: clip(req.output.title, 100) || 'MusiTeacher',
      make_instrumental: instrumental,
      wait_audio: false,
    };
    const res = await ctx.fetch(`${c.url}/api/custom_generate`, { method: 'POST', signal: ctx.signal, headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
    if (!res.ok) {
      const d = await readError(res);
      if (res.status === 402 || /credit|quota|limit/i.test(d)) throw fail('رصيد حساب Suno انتهى.', 'quota');
      throw fail(`خادم suno-api رفض الطلب (${res.status}) — ربما انتهت صلاحية الكوكي.`, 'http_' + res.status, { detail: d });
    }
    const clips = await res.json().catch(() => null);
    const ids = (Array.isArray(clips) ? clips : []).map((x) => x && x.id).filter(Boolean);
    if (!ids.length) throw fail('خادم suno-api لم يُرجع أي مقطع.', 'bad_response');
    for (let i = 0; i < 200; i++) {
      await sleep(c.pollMs, ctx.signal);
      const g = await ctx.fetch(`${c.url}/api/get?ids=${ids.join(',')}`, { signal: ctx.signal }).catch(() => null);
      const info = g && g.ok ? await g.json().catch(() => null) : null;
      if (!Array.isArray(info)) continue;
      const bad = info.find((x) => x.status === 'error');
      if (bad) throw fail('Suno فشل في توليد المقطع.', 'provider_error', { detail: bad.error_message });
      if (info.length && info.every((x) => x.status === 'complete' && x.audio_url)) {
        return { kind: 'urls', tracks: info.map((x) => ({ url: x.audio_url, ext: 'mp3', title: x.title || '', image: x.image_url || null })), model: info[0].model_name || 'suno' };
      }
    }
    throw fail('تأخر Suno أكثر من المهلة.', 'timeout');
  },
};
