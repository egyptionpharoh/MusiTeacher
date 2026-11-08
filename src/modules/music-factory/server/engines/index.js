// =====================================================================
// 🎛️ سجل محركات التوليد الصوتي + قواعد الاختيار والبديل
// إضافة محرك جديد = ملف واحد بنفس الواجهة ثم سطر في ENGINES أدناه.
// قواعد مهمة:
//   • «تلقائي»: نجرب المحركات الرسمية المُعدّة بالترتيب، وعند فشل محرك ننتقل للتالي.
//   • محرك محدد يختاره المعلم: نستخدمه وحده (لا نرسل الكلمات لمزود آخر دون علمه).
//   • المحركات غير الرسمية (explicitOnly) لا تدخل في «تلقائي» أبدًا.
// =====================================================================
import elevenlabs from './elevenlabs.js';
import lyria from './lyria.js';
import replicate from './replicate.js';
import sunoSelfHosted from './sunoSelfHosted.js';
import { maxSeconds } from './util.js';

export const ENGINES = [elevenlabs, lyria, replicate, sunoSelfHosted];
const BY_ID = Object.fromEntries(ENGINES.map((e) => [e.id, e]));

const order = (env) => {
  const pref = (env.MF_AUDIO_ENGINE_ORDER || 'elevenlabs,lyria,replicate').split(',').map((s) => s.trim()).filter((x) => BY_ID[x]);
  return [...pref, ...ENGINES.map((e) => e.id).filter((id) => !pref.includes(id))].map((id) => BY_ID[id]);
};

export function audioStatus(env = process.env) {
  const list = order(env).map((e) => ({
    id: e.id, label: e.label, official: e.official, vocals: e.vocals, instrumental: e.instrumental, preview: e.preview,
    explicitOnly: !!e.explicitOnly, configured: e.configured(env), model: e.configured(env) ? e.model(env) : null, note_ar: e.note_ar,
  }));
  const auto = (mode) => list.filter((e) => e.configured && !e.explicitOnly && (mode === 'song' ? e.vocals : e.instrumental)).map((e) => e.id);
  return {
    engines: list,
    auto: { song: auto('song'), instrumental: auto('instrumental') },
    ready: { song: list.some((e) => e.configured && e.vocals), instrumental: list.some((e) => e.configured && e.instrumental) },
    maxSeconds: maxSeconds(env),
    suno: { official: 'partner_beta', note_ar: 'واجهة Suno الرسمية (platform.suno.com) ما زالت تجريبية لشركاء مختارين فقط؛ عند قبولكم يُضاف محرك رسمي هنا بملف واحد.' },
  };
}

/** يختار قائمة المحركات التي ستُجرَّب لهذا الطلب */
export function planEngines(req, env = process.env) {
  const capable = (e) => e.configured(env) && (req.mode === 'song' ? e.vocals : e.instrumental) && (req.quality !== 'preview' || e.preview);
  if (req.engine && req.engine !== 'auto') {
    const e = BY_ID[req.engine];
    if (!e) return { error: 'محرك غير معروف.' };
    if (!e.configured(env)) return { error: `${e.label} غير مُعد على الخادم.` };
    if (req.mode === 'song' && !e.vocals) return { error: `${e.label} لا يغني؛ اختر محركًا آخر أو «موسيقى تصويرية».` };
    if (req.quality === 'preview' && !e.preview) return { error: `${e.label} لا يدعم المعاينة القصيرة؛ اختر «نسخة كاملة».` };
    return { engines: [e] };
  }
  let engines = order(env).filter((e) => !e.explicitOnly && capable(e));
  // بدون موافقة المعلم على البديل: نرسل الطلب لأول محرك فقط
  if (req.allowFallback === false) engines = engines.slice(0, 1);
  if (!engines.length) return { error: req.mode === 'song' ? 'لا يوجد محرك توليد أغانٍ مُعد على الخادم بعد.' : 'لا يوجد محرك توليد موسيقى مُعد على الخادم بعد.', notConfigured: true };
  return { engines };
}

/** ينفذ التوليد مع البديل التلقائي ويعيد أول نتيجة ناجحة أو أسباب الفشل كلها */
export async function generateAudio(req, { env = process.env, fetchImpl = fetch, timeoutMs } = {}) {
  const plan = planEngines(req, env);
  if (plan.error) return { ok: false, status: plan.notConfigured ? 503 : 400, notConfigured: !!plan.notConfigured, error: plan.error };
  const limit = timeoutMs || Math.max(5000, parseInt(env.MF_AUDIO_TIMEOUT_MS || '280000', 10) || 280000);
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), limit);
  const attempts = [];
  try {
    for (const e of plan.engines) {
      try {
        const r = await e.generate(req, { env, fetch: fetchImpl, signal: ac.signal });
        attempts.push({ engine: e.id, ok: true });
        return { ok: true, engine: e.id, label: e.label, official: e.official, attempts, ...r };
      } catch (err) {
        const aborted = ac.signal.aborted || err.name === 'AbortError';
        attempts.push({ engine: e.id, label: e.label, ok: false, code: aborted ? 'timeout' : err.code || 'error', error: aborted ? 'انتهت المهلة' : err.message });
        console.warn(`[music-factory audio:${e.id}]`, err.message, err.detail ? '| ' + String(err.detail).slice(0, 200) : '');
        if (aborted) break;
        if (err.code === 'no_lyrics') break; // مشكلة في المدخلات نفسها لن يحلها محرك آخر
      }
    }
  } finally { clearTimeout(timer); }
  return { ok: false, status: 502, attempts, error: 'تعذر التوليد: ' + attempts.map((a) => `${a.label}: ${a.error}`).join(' — ') };
}
