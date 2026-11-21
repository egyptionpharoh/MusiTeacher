// =====================================================================
//  توليد الأسئلة بالذكاء الاصطناعي — عبر خادم MusiTeacher فقط (/api/randomizer/generate).
//  لا مفاتيح في الواجهة. هوية المعلم: رمز Firebase تطلبه اللعبة من صفحة MusiTeacher الأم (نفس الموقع) عبر postMessage.
//  يُرسَل محتوى الدرس فقط — لا تُرسَل أسماء الطلاب أبدًا.
// =====================================================================
const API = '/api/randomizer';

function tokenFromParent(timeout = 2500) {
  return new Promise((resolve) => {
    if (window.parent === window) return resolve(null);
    const nonce = Math.random().toString(36).slice(2);
    const done = (v) => { window.removeEventListener('message', on); clearTimeout(t); resolve(v); };
    const on = (e) => { if (e.origin === location.origin && e.data && e.data.type === 'mt-token' && e.data.nonce === nonce) done(e.data.token || null); };
    const t = setTimeout(() => done(null), timeout);
    window.addEventListener('message', on);
    try { window.parent.postMessage({ type: 'mt-token-request', nonce }, location.origin); } catch { done(null); }
  });
}

async function call(action, body) {
  const token = await tokenFromParent();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  let r;
  try { r = await fetch(`${API}/${action}`, { method: body ? 'POST' : 'GET', headers, body: body ? JSON.stringify(body) : undefined, credentials: 'same-origin' }); }
  catch { return { ok: false, code: 'network', error: 'تعذّر الاتصال بخادم MusiTeacher. تحقق من الإنترنت ثم حاول مرة أخرى.' }; }
  let d = null; try { d = await r.json(); } catch { /* ignore */ }
  if (!d) return { ok: false, code: r.status === 404 ? 'no_server' : 'bad_response', error: r.status === 404 ? 'خدمة التوليد غير موجودة على هذا الخادم بعد (تحتاج نشر التحديث).' : 'استجابة غير متوقعة من الخادم.' };
  if (!token && (d.code === 'unauthenticated' || r.status === 401)) d.error = 'افتح اللعبة من داخل حسابك في MusiTeacher (بعد تسجيل الدخول) لتظهر الأنشطة الجاهزة ويعمل التوليد الذكي.';
  return d;
}

export const aiStatus = () => call('status');
/** الأنشطة الجاهزة (محتوى محمي بتسجيل الدخول) */
export const fetchBanks = () => call('banks');

/**
 * @param {{grade:number, lesson:string, count:number, types:string[], input:{kind:'text',text}|{kind:'pdf'|'image',mime,data}}} p
 * @returns {Promise<{ok:boolean, questions?:object[], insufficient?:boolean, message?:string, dropped?:number, error?:string, code?:string}>}
 */
export const generate = (p) => call('generate', p);
