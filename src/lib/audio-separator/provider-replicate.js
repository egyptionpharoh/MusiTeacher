// مزوّد الفصل: Replicate (تشغيل النموذج على GPU سحابي). لا يُستدعى إلا من الخادم؛ المفتاح لا يصل للمتصفح أبدًا.
// fetchImpl قابل للاستبدال في الاختبارات.
const API = 'https://api.replicate.com/v1';

const STATUS = { starting: 'queued', processing: 'processing', succeeded: 'succeeded', failed: 'failed', canceled: 'canceled', aborted: 'failed' };

export class ProviderError extends Error {
  constructor(code, detail) { super(code); this.code = code; this.detail = detail; }
}

export function makeReplicateProvider({ token, preset, fetchImpl = fetch, timeoutMs = 20000 }) {
  const call = async (path, init = {}) => {
    if (!token) throw new ProviderError('provider-not-configured');
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    let res;
    try {
      res = await fetchImpl(path.startsWith('http') ? path : API + path, {
        ...init, signal: ctrl.signal,
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
      });
    } catch (e) {
      throw new ProviderError('provider-unreachable', e && e.name === 'AbortError' ? 'timeout' : (e && e.message));
    } finally { clearTimeout(t); }
    if (res.status === 401 || res.status === 403) throw new ProviderError('provider-auth', res.status);
    if (res.status === 402) throw new ProviderError('provider-billing', res.status);
    if (res.status === 429) throw new ProviderError('provider-busy', res.status);
    if (res.status === 404) throw new ProviderError('provider-not-found', res.status);
    if (!res.ok) throw new ProviderError('provider-error', res.status);
    return res.json();
  };

  return {
    name: 'replicate',
    preset,
    configured: () => !!token,

    /** يبدأ المعالجة ويعيد { id, status } */
    async create({ audioUrl, format, bitrate }) {
      const body = { version: preset.version, input: preset.buildInput({ audioUrl, format, bitrate }) };
      const p = await call('/predictions', { method: 'POST', body: JSON.stringify(body) });
      if (!p || typeof p.id !== 'string') throw new ProviderError('provider-error', 'no-id');
      return { id: p.id, status: STATUS[p.status] || 'queued' };
    },

    /** حالة المعالجة الحقيقية كما يبلغ عنها المزود */
    async get(id) {
      if (!/^[a-z0-9]{8,64}$/i.test(id)) throw new ProviderError('provider-error', 'bad-id');
      const p = await call(`/predictions/${id}`);
      return {
        status: STATUS[p.status] || 'processing',
        rawStatus: p.status,
        output: p.output ?? null,
        error: p.error ? String(p.error).slice(0, 500) : null,
        logs: typeof p.logs === 'string' ? p.logs.slice(-4000) : '',
        predictTime: p.metrics && typeof p.metrics.predict_time === 'number' ? p.metrics.predict_time : null,
      };
    },

    async cancel(id) {
      if (!/^[a-z0-9]{8,64}$/i.test(id)) return;
      try { await call(`/predictions/${id}/cancel`, { method: 'POST' }); } catch { /* أفضل محاولة */ }
    },

    /** يفتح ملف الناتج (يتطلب ملفات replicate.delivery ترويسة التفويض) ويعيد Response قابلًا للبث */
    async openOutput(url) {
      let u;
      try { u = new URL(url); } catch { throw new ProviderError('unexpected-output', 'bad-url'); }
      if (u.protocol !== 'https:' || !/(^|\.)replicate\.(delivery|com)$/.test(u.hostname)) throw new ProviderError('unexpected-output', 'host');
      let res;
      try { res = await fetchImpl(u.toString(), { headers: { Authorization: `Bearer ${token}` } }); }
      catch (e) { throw new ProviderError('provider-unreachable', e && e.message); }
      if (!res.ok || !res.body) throw new ProviderError('output-unavailable', res.status);
      return res;
    },

    /** يحسب ما إذا كان الحساب مضبوطًا (بلا تكلفة: قراءة بيانات الحساب فقط) */
    async check() { await call('/account'); return true; },
  };
}

/**
 * يختار رابط المسار المطلوب من مخرجات النموذج. يدعم شكلين:
 *   - كائن بمفاتيح (vocals / no_vocals / instrumental / ...)
 *   - مصفوفة روابط تُميَّز بأسماء الملفات
 * أي شكل غير متوقع → null (فشل واضح بدل تسليم ملف خاطئ).
 */
export function pickStem(output, mode) {
  const isUrl = (v) => typeof v === 'string' && /^https:\/\//.test(v);
  const INSTR = ['no_vocals', 'instrumental', 'accompaniment', 'karaoke'];
  if (Array.isArray(output)) {
    const urls = output.filter(isUrl);
    const name = (u) => decodeURIComponent(new URL(u).pathname.split('/').pop() || '').toLowerCase();
    const instr = urls.find((u) => INSTR.some((k) => name(u).includes(k)));
    const voc = urls.find((u) => /vocals?/.test(name(u)) && !INSTR.some((k) => name(u).includes(k)));
    return (mode === 'vocals' ? voc : instr) || null;
  }
  if (output && typeof output === 'object') {
    const entries = Object.entries(output).filter(([, v]) => isUrl(v));
    const get = (k) => (entries.find(([key]) => key.toLowerCase() === k) || [])[1];
    if (mode === 'vocals') return get('vocals') || null;
    for (const k of INSTR) { const v = get(k); if (v) return v; }
    // فصل ثنائي بمفتاحين فقط: الآخر غير «vocals» هو المصاحبة
    if (entries.length === 2 && get('vocals')) {
      const other = entries.find(([key]) => key.toLowerCase() !== 'vocals');
      if (other && !['drums', 'bass', 'piano', 'guitar'].includes(other[0].toLowerCase())) return other[1];
    }
    return null;
  }
  return null;
}

/**
 * نسبة تقدم حقيقية مستخرجة من سجل النموذج (أشرطة tqdm مثل « 45%|████ »).
 * passes = عدد الأشرطة المتوقعة (4 في htdemucs_ft). إن لم نتأكد من البنية نعيد null (لا نسبة وهمية).
 */
export function progressFromLogs(logs, passes) {
  if (!logs || !passes) return null;
  const re = /(\d{1,3})%\|/g;
  let m, last = -1, done = 0;
  while ((m = re.exec(logs))) {
    const p = Math.min(100, parseInt(m[1], 10));
    if (p === 100) { if (last !== 100) done++; }                 // اكتمل شريط
    else if (last >= 0 && last !== 100 && p < last) done++;      // بدأ شريط جديد دون ظهور 100
    last = p;
  }
  if (last < 0) return null;
  const cur = last === 100 ? 0 : last;
  if (done > passes || (done === passes && cur > 0)) return null; // بنية غير متوقعة → حالة فقط
  const value = Math.round(((done + cur / 100) / passes) * 100);
  return Math.max(0, Math.min(99, value));
}
