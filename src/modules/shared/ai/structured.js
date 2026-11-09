// 🤖 استدعاء موحّد لنماذج الذكاء الاصطناعي لاستخراج بيانات منظمة (JSON بمخطط ثابت) من صور/PDF/نص — على الخادم فقط.
// تستخدمه أداتا «منبّه الحصص» و«الخطط الفصلية» بدل تكرار الكود. المفاتيح لا تصل للمتصفح، والملفات لا تُحفظ لدينا.
// معطل افتراضيًا: لا يعمل إلا بـ CA_AI_ENABLED=true حتى لا يُستهلك رصيد أي مزوّد دون قرار صاحب المنصة.

export const aiConfig = (env = process.env) => ({
  enabled: String(env.CA_AI_ENABLED || '').toLowerCase() === 'true',
  order: (env.CA_AI_PROVIDER_ORDER || 'gemini,claude').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean),
  geminiKey: env.GEMINI_API_KEY || '',
  geminiModel: env.CA_GEMINI_MODEL || 'gemini-2.5-flash',
  geminiBase: (env.CA_GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com').replace(/\/$/, ''),
  claudeKey: env.ANTHROPIC_API_KEY || '',
  claudeModel: env.CA_CLAUDE_MODEL || 'claude-sonnet-5-5',
  claudeBase: (env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com').replace(/\/$/, ''),
  timeoutMs: Math.max(5000, parseInt(env.CA_AI_TIMEOUT_MS || '60000', 10) || 60000),
});

export function aiStatusOf(env = process.env) {
  const c = aiConfig(env);
  const configured = c.order.filter((n) => (n === 'gemini' && c.geminiKey) || (n === 'claude' && c.claudeKey));
  return { enabled: c.enabled && configured.length > 0, providers: configured };
}

const withTimeout = (ms) => { const ac = new AbortController(); const t = setTimeout(() => ac.abort(), ms); return { signal: ac.signal, done: () => clearTimeout(t) }; };
const err = (message, code) => Object.assign(new Error(message), { code });

/** input: { kind:'text', text } | { kind:'image'|'pdf', mime, data } | { kind:'images', images:[{mime,data}] } */
function attachments(input) {
  if (input.kind === 'images') return input.images;
  if (input.kind === 'image' || input.kind === 'pdf') return [{ mime: input.mime, data: input.data }];
  return [];
}

async function callGemini(c, input, task, fetchImpl) {
  if (!c.geminiKey) throw err('Gemini غير مُعد', 'not_configured');
  const parts = attachments(input).map((a) => ({ inline_data: { mime_type: a.mime, data: a.data } }));
  if (input.kind === 'text') parts.push({ text: `${task.textIntro}\n${input.text}` });
  parts.push({ text: `${task.instruction} Return ONLY JSON matching this schema:\n${JSON.stringify(task.schema)}` });
  const t = withTimeout(c.timeoutMs);
  try {
    const res = await fetchImpl(`${c.geminiBase}/v1beta/models/${encodeURIComponent(c.geminiModel)}:generateContent`, {
      method: 'POST', signal: t.signal, headers: { 'content-type': 'application/json', 'x-goog-api-key': c.geminiKey },
      body: JSON.stringify({ systemInstruction: { parts: [{ text: task.system }] }, contents: [{ role: 'user', parts }], generationConfig: { responseMimeType: 'application/json', temperature: 0.1, maxOutputTokens: task.maxTokens || 8192 } }),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) throw err(`Gemini HTTP ${res.status}: ${body && body.error ? body.error.message : ''}`, 'http_' + res.status);
    const text = (body?.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('').trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
    if (!text) throw err('Gemini: رد فارغ', 'bad_response');
    return { data: JSON.parse(text), model: c.geminiModel };
  } finally { t.done(); }
}

async function callClaude(c, input, task, fetchImpl) {
  if (!c.claudeKey) throw err('Claude غير مُعد', 'not_configured');
  const content = attachments(input).map((a) => (a.mime === 'application/pdf'
    ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: a.data } }
    : { type: 'image', source: { type: 'base64', media_type: a.mime, data: a.data } }));
  if (input.kind === 'text') content.push({ type: 'text', text: `${task.textIntro}\n${input.text}` });
  content.push({ type: 'text', text: task.instruction });
  const t = withTimeout(c.timeoutMs);
  try {
    const res = await fetchImpl(`${c.claudeBase}/v1/messages`, {
      method: 'POST', signal: t.signal, headers: { 'content-type': 'application/json', 'x-api-key': c.claudeKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: c.claudeModel, max_tokens: task.maxTokens || 8000, system: task.system, messages: [{ role: 'user', content }], output_config: { format: { type: 'json_schema', schema: task.schema } } }),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) throw err(`Claude HTTP ${res.status}: ${body && body.error ? body.error.message : ''}`, 'http_' + res.status);
    if (body.stop_reason === 'refusal') throw err('Claude رفض الطلب', 'refusal');
    const block = (body.content || []).find((b) => b.type === 'text');
    if (!block) throw err('Claude: رد بدون نص', 'bad_response');
    return { data: JSON.parse(block.text), model: c.claudeModel };
  } finally { t.done(); }
}
const PROVIDERS = { gemini: callGemini, claude: callClaude };

/**
 * task: { system, schema, instruction, textIntro, maxTokens, tag }
 * يعيد { ok:true, provider, model, data } أو { ok:false, status, code, error }
 */
export async function runStructured(input, task, { env = process.env, fetchImpl = fetch, disabledError } = {}) {
  const c = aiConfig(env);
  if (!c.enabled) return { ok: false, status: 503, code: 'disabled', error: disabledError || 'القراءة الذكية غير مفعّلة على المنصة حاليًا.' };
  const errors = [];
  for (const name of c.order) {
    const fn = PROVIDERS[name];
    if (!fn) continue;
    try {
      const r = await fn(c, input, task, fetchImpl);
      return { ok: true, provider: name === 'gemini' ? 'Gemini' : 'Claude', model: r.model, data: r.data };
    } catch (e) {
      const code = e.code || (e.name === 'AbortError' ? 'timeout' : 'error');
      errors.push({ provider: name, code });
      if (code !== 'not_configured') console.warn(`[${task.tag || 'ai'}] ${name} failed:`, String(e.message || e).slice(0, 200));
    }
  }
  const allMissing = errors.length && errors.every((e) => e.code === 'not_configured');
  return { ok: false, status: 503, code: allMissing ? 'not_configured' : 'failed', error: allMissing ? 'لا يوجد مفتاح ذكاء اصطناعي مُعد على الخادم.' : 'تعذرت قراءة الملف حاليًا. حاول بعد قليل أو استخدم ملف Excel/Word.' };
}

/** فحص مدخلات الطلب القادم من المتصفح (أنواع وأحجام) */
const B64 = /^[A-Za-z0-9+/=]+$/;
export function validateInput(b, { maxB64 = 4.4 * 1024 * 1024 * 1.34, maxImages = 4, maxText = 30000 } = {}) {
  const kind = b && b.kind;
  const okImg = (m) => ['image/jpeg', 'image/png', 'image/webp'].includes(m);
  if (kind === 'text') { const text = typeof b.text === 'string' ? b.text.slice(0, maxText) : ''; return text.trim() ? { input: { kind, text } } : { error: 'لا يوجد نص لقراءته.' }; }
  if (kind === 'image' || kind === 'pdf') {
    const mime = kind === 'pdf' ? 'application/pdf' : okImg(b.mime) ? b.mime : null;
    const data = typeof b.data === 'string' ? b.data : '';
    if (!mime || !data || !B64.test(data.slice(0, 200))) return { error: 'نوع الملف غير مدعوم.' };
    if (data.length > maxB64) return { error: 'الملف كبير جدًا.', status: 413 };
    return { input: { kind, mime, data } };
  }
  if (kind === 'images') {
    const imgs = Array.isArray(b.images) ? b.images.slice(0, maxImages) : [];
    if (!imgs.length || imgs.some((i) => !i || !okImg(i.mime) || typeof i.data !== 'string' || !B64.test(i.data.slice(0, 200)))) return { error: 'صور غير صالحة.' };
    if (imgs.reduce((a, i) => a + i.data.length, 0) > maxB64) return { error: 'الصور كبيرة جدًا.', status: 413 };
    return { input: { kind, images: imgs.map((i) => ({ mime: i.mime, data: i.data })) } };
  }
  return { error: 'نوع الطلب غير معروف.' };
}
