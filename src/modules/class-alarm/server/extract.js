// 🤖 قراءة جدول المدرسة من صورة أو PDF (أو نص جدول غير مرتب) بالذكاء الاصطناعي — على الخادم فقط.
// المفاتيح لا تصل للمتصفح. الملف يُرسل للمزوّد لحظيًا ولا يُحفظ على خادمنا.
// الخدمة معطلة افتراضيًا ولا تعمل إلا بـ CA_AI_ENABLED=true حتى لا يُستهلك رصيد أي مزوّد دون قرار صاحب المنصة.

export const cfg = (env = process.env) => ({
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

export function aiStatus(env = process.env) {
  const c = cfg(env);
  const configured = c.order.filter((n) => (n === 'gemini' && c.geminiKey) || (n === 'claude' && c.claudeKey));
  return { enabled: c.enabled && configured.length > 0, providers: configured };
}

const str = { type: 'string' };
export const SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['found', 'teacher', 'school', 'subject', 'days', 'periods', 'lessons', 'warnings'],
  properties: {
    found: { type: 'boolean' },
    teacher: str, school: str, subject: str,
    days: { type: 'array', items: str },
    periods: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['no', 'kind', 'name', 'start', 'end', 'uncertain'], properties: { no: { type: 'integer' }, kind: { type: 'string', enum: ['lesson', 'break'] }, name: str, start: str, end: str, uncertain: { type: 'boolean' } } } },
    lessons: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['day', 'period', 'subject', 'grade', 'section', 'room', 'raw', 'uncertain'], properties: { day: str, period: { type: 'integer' }, subject: str, grade: str, section: str, room: str, raw: str, uncertain: { type: 'boolean' } } } },
    warnings: { type: 'array', items: str },
  },
};

export const SYSTEM = `You extract a teacher's weekly school timetable (Arabic schools, often Oman) from an image, PDF, or messy table text.
Rules:
- Return ONLY data visibly present. NEVER invent times, classes, or days. If something is unreadable, leave it empty and set "uncertain": true.
- days: Arabic day names exactly as used (الأحد، الاثنين، الثلاثاء، الأربعاء، الخميس، الجمعة، السبت) for days that appear in the timetable.
- periods: each teaching period with its number (1..12) and start/end times as "HH:MM" 24h (school hours: a time like 1:10 after noon is 13:10). Breaks (فسحة/استراحة) get kind "break", no 0. If times are not shown, use empty strings and uncertain=true.
- lessons: one item per NON-EMPTY cell: day (Arabic name), period number, and what is written: grade (e.g. "5" or "الصف الخامس"), section/شعبة (e.g. "1"), subject if written, room if written, and raw = the exact cell text. Common cell formats: "5/1" means grade 5 section 1; "٦-٢" means grade 6 section 2.
- Convert Arabic-Indic digits to Latin digits.
- teacher/school/subject: only if written on the document, else "".
- warnings: short Arabic notes about anything ambiguous (e.g. "خانة الأربعاء الحصة 3 غير واضحة").
- If no timetable is present, set found=false and explain in warnings (Arabic).`;

const withTimeout = (ms) => { const ac = new AbortController(); const t = setTimeout(() => ac.abort(), ms); return { signal: ac.signal, done: () => clearTimeout(t) }; };
const err = (message, code) => Object.assign(new Error(message), { code });

async function callGemini(c, input, fetchImpl) {
  if (!c.geminiKey) throw err('Gemini غير مُعد', 'not_configured');
  const parts = [];
  if (input.kind === 'text') parts.push({ text: `Timetable cells (rows separated by newlines, cells by " | "):\n${input.text}` });
  else parts.push({ inline_data: { mime_type: input.mime, data: input.data } });
  parts.push({ text: `Extract the timetable. Return ONLY JSON matching this schema:\n${JSON.stringify(SCHEMA)}` });
  const t = withTimeout(c.timeoutMs);
  try {
    const res = await fetchImpl(`${c.geminiBase}/v1beta/models/${encodeURIComponent(c.geminiModel)}:generateContent`, {
      method: 'POST', signal: t.signal, headers: { 'content-type': 'application/json', 'x-goog-api-key': c.geminiKey },
      body: JSON.stringify({ systemInstruction: { parts: [{ text: SYSTEM }] }, contents: [{ role: 'user', parts }], generationConfig: { responseMimeType: 'application/json', temperature: 0.1, maxOutputTokens: 8192 } }),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) throw err(`Gemini HTTP ${res.status}: ${body && body.error ? body.error.message : ''}`, 'http_' + res.status);
    const text = (body?.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('').trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
    if (!text) throw err('Gemini: رد فارغ', 'bad_response');
    return { data: JSON.parse(text), model: c.geminiModel };
  } finally { t.done(); }
}

async function callClaude(c, input, fetchImpl) {
  if (!c.claudeKey) throw err('Claude غير مُعد', 'not_configured');
  const content = [];
  if (input.kind === 'image') content.push({ type: 'image', source: { type: 'base64', media_type: input.mime, data: input.data } });
  else if (input.kind === 'pdf') content.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: input.data } });
  else content.push({ type: 'text', text: `Timetable cells (rows separated by newlines, cells by " | "):\n${input.text}` });
  content.push({ type: 'text', text: 'Extract the timetable as JSON.' });
  const t = withTimeout(c.timeoutMs);
  try {
    const res = await fetchImpl(`${c.claudeBase}/v1/messages`, {
      method: 'POST', signal: t.signal, headers: { 'content-type': 'application/json', 'x-api-key': c.claudeKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: c.claudeModel, max_tokens: 8000, system: SYSTEM, messages: [{ role: 'user', content }], output_config: { format: { type: 'json_schema', schema: SCHEMA } } }),
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

/** تنظيف رد النموذج: أنواع ثابتة وحدود أطوال (لا نثق بالرد كما هو) */
export function sanitize(d) {
  const s = (v, n = 80) => (typeof v === 'string' ? v.trim().slice(0, n) : typeof v === 'number' ? String(v) : '');
  const o = d && typeof d === 'object' ? d : {};
  return {
    found: o.found !== false,
    teacher: s(o.teacher), school: s(o.school, 120), subject: s(o.subject),
    days: (Array.isArray(o.days) ? o.days : []).map((x) => s(x, 20)).filter(Boolean).slice(0, 7),
    periods: (Array.isArray(o.periods) ? o.periods : []).slice(0, 24).map((p) => ({ no: Math.max(0, Math.min(12, Math.round(+p.no) || 0)), kind: p.kind === 'break' ? 'break' : 'lesson', name: s(p.name, 40), start: s(p.start, 8), end: s(p.end, 8), uncertain: !!p.uncertain })),
    lessons: (Array.isArray(o.lessons) ? o.lessons : []).slice(0, 120).map((l) => ({ day: s(l.day, 20), period: Math.max(0, Math.min(12, Math.round(+l.period) || 0)), subject: s(l.subject), grade: s(l.grade, 40), section: s(l.section, 20), room: s(l.room, 60), raw: s(l.raw, 80), uncertain: !!l.uncertain })),
    warnings: (Array.isArray(o.warnings) ? o.warnings : []).map((w) => s(w, 200)).filter(Boolean).slice(0, 6),
  };
}

export async function extractSchedule(input, { env = process.env, fetchImpl = fetch } = {}) {
  const c = cfg(env);
  if (!c.enabled) return { ok: false, status: 503, code: 'disabled', error: 'القراءة الذكية للصور وملفات PDF غير مفعّلة على المنصة حاليًا. استخدم Excel أو Word أو الإدخال اليدوي.' };
  const errors = [];
  for (const name of c.order) {
    const fn = PROVIDERS[name];
    if (!fn) continue;
    try {
      const r = await fn(c, input, fetchImpl);
      const data = sanitize(r.data);
      if (!data.found && !data.lessons.length) return { ok: false, status: 422, code: 'not_found', error: data.warnings[0] || 'لم نجد جدولًا واضحًا في الملف. تأكد أن الصورة تحتوي الجدول بوضوح.' };
      return { ok: true, provider: name === 'gemini' ? 'Gemini' : 'Claude', model: r.model, schedule: data };
    } catch (e) {
      const code = e.code || (e.name === 'AbortError' ? 'timeout' : 'error');
      errors.push({ provider: name, code });
      if (code !== 'not_configured') console.warn(`[class-alarm extract] ${name} failed:`, String(e.message || e).slice(0, 200));
    }
  }
  const allMissing = errors.length && errors.every((e) => e.code === 'not_configured');
  return { ok: false, status: 503, code: allMissing ? 'not_configured' : 'failed', error: allMissing ? 'لا يوجد مفتاح ذكاء اصطناعي مُعد على الخادم.' : 'تعذرت قراءة الملف حاليًا. حاول بعد قليل أو استخدم ملف Excel/Word.' };
}
