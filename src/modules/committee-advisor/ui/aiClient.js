// الاتصال الوحيد بالشبكة في الأداة: طلب إجابة مساعدة من خادم المنصة (/api/committee-advisor).
// لا مفاتيح هنا؛ الخادم وحده يتصل بـ Gemini. النتيجة تُحفظ في ذاكرة الصفحة حتى لا يُعاد الطلب نفسه.
const memo = new Map();

/** يعيد { ok, answer?, disclaimer?, outOfScope?, reason? } ولا يرمي أخطاء أبدًا */
export async function askAI({ question, exam, role, getToken, endpoint = '/api/committee-advisor' }) {
  const key = `${exam || ''}|${role || ''}|${question.trim()}`;
  if (memo.has(key)) return memo.get(key);
  let token = null;
  try { token = getToken ? await getToken() : null; } catch { token = null; }
  if (!token) return { ok: false, reason: 'login' };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 25000);
  try {
    const res = await fetch(endpoint, {
      method: 'POST', signal: ctrl.signal,
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ question: question.slice(0, 400), exam, role }),
    });
    const body = await res.json().catch(() => null);
    const out = body && typeof body === 'object' ? body : { ok: false, reason: 'unavailable' };
    if (out.ok) memo.set(key, out);
    return out;
  } catch {
    return { ok: false, reason: 'unavailable' };
  } finally { clearTimeout(timer); }
}
