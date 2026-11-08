// عميل Gemini عبر REST (على الخادم فقط). المفتاح من متغير البيئة ولا يصل إلى المتصفح أبدًا.
// يجرب النماذج بالترتيب: إن فشل نموذج لسبب مؤقت أو لعدم توفره، ينتقل للتالي.

export const DEFAULT_MODELS = ['gemini-3.8-flash', 'gemini-2.5-flash'];
const ENDPOINT = (m) => `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m)}:generateContent`;

export class AIError extends Error {
  constructor(code, message, status) { super(message || code); this.code = code; this.status = status; }
}

export function modelsFrom(env = process.env) {
  const own = (env.PD_WORKSHOPS_MODEL || '').split(',').map((s) => s.trim()).filter(Boolean);
  return [...new Set([...own, ...DEFAULT_MODELS])];
}

/** يستخرج أول كائن JSON من نص (احتياطًا إن أضاف النموذج سياجًا أو كلامًا). */
export function parseJSON(text) {
  if (typeof text !== 'string') throw new AIError('bad-output', 'empty');
  const t = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '');
  try { return JSON.parse(t); } catch { /* نحاول الاستخراج */ }
  const a = t.indexOf('{'), b = t.lastIndexOf('}');
  if (a >= 0 && b > a) { try { return JSON.parse(t.slice(a, b + 1)); } catch { /* */ } }
  throw new AIError('bad-output', 'not json');
}

/**
 * @param {{apiKey:string|null, models?:string[], fetchImpl?:typeof fetch, timeoutMs?:number}} o
 */
export function makeGemini({ apiKey, models = DEFAULT_MODELS, fetchImpl = fetch, timeoutMs = 45000 } = {}) {
  const key = (apiKey || '').trim() || null;
  return {
    configured: () => !!key,
    models: () => [...models],
    /** @returns {Promise<{data:any, model:string}>} */
    async generateJSON({ system, prompt, temperature = 0.8, maxTokens = 8192 }) {
      if (!key) throw new AIError('not-configured', 'GEMINI_API_KEY missing', 503);
      let last = null;
      for (const model of models) {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), timeoutMs);
        try {
          const res = await fetchImpl(ENDPOINT(model), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: system }] },
              contents: [{ role: 'user', parts: [{ text: prompt }] }],
              generationConfig: { temperature, maxOutputTokens: maxTokens, responseMimeType: 'application/json' },
            }),
            signal: ctrl.signal,
          });
          if (!res.ok) {
            const st = res.status;
            last = new AIError(st === 429 ? 'rate-limited' : st === 400 ? 'bad-request' : st === 401 || st === 403 ? 'auth' : 'upstream', `HTTP ${st}`, st);
            if (st === 401 || st === 403) throw last;               // مفتاح غير صالح: لا فائدة من نموذج آخر
            continue;                                               // 404 نموذج غير متوفر، 429، 5xx → التالي
          }
          const body = await res.json();
          const cand = body && body.candidates && body.candidates[0];
          if (!cand) { last = new AIError('blocked', 'no candidate'); continue; }
          const text = (cand.content && cand.content.parts || []).map((p) => p.text || '').join('');
          try { return { data: parseJSON(text), model }; } catch (e) { last = e; continue; }
        } catch (e) {
          if (e instanceof AIError && e.code === 'auth') throw e;
          last = e && e.name === 'AbortError' ? new AIError('timeout', 'timeout') : (e instanceof AIError ? e : new AIError('network', e && e.message));
        } finally { clearTimeout(timer); }
      }
      throw last || new AIError('upstream', 'all models failed');
    },
  };
}
