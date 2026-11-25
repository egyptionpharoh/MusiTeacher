// قائمة مديري المنصة — مصدر واحد يستخدمه الخادم فقط.
// يمكن تغييرها دون تعديل الكود بمتغير البيئة ADMIN_EMAILS (بريد أو أكثر مفصولة بفواصل).
// المدير = بريد موجود في القائمة + مُتحقَّق منه في Firebase (email_verified) — لا يكفي أن يكتبه أحد في الطلب.
export const DEFAULT_ADMIN_EMAILS = ['egyptionpharoh5@gmail.com', 'hussien.elmalek@gmail.com'];

export const normEmail = (e) => (typeof e === 'string' ? e.trim().toLowerCase().slice(0, 254) : '');

export function adminEmails(env = process.env) {
  const raw = env && typeof env.ADMIN_EMAILS === 'string' ? env.ADMIN_EMAILS : '';
  const list = raw.split(/[,;\s]+/).map(normEmail).filter((e) => e.includes('@'));
  return list.length ? list : DEFAULT_ADMIN_EMAILS;
}

/** claims: ناتج التحقق من Firebase ID token على الخادم */
export function isAdminClaims(claims, env = process.env) {
  if (!claims || claims.email_verified !== true) return false;
  const email = normEmail(claims.email);
  return !!email && adminEmails(env).includes(email);
}

export function bearerOf(request) {
  const h = request.headers.get('authorization') || '';
  const m = /^Bearer\s+([A-Za-z0-9._\-]+)$/.exec(h.trim());
  return m ? m[1] : null;
}

export const json = (status, body) => new Response(JSON.stringify(body), {
  status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
});

/** يتحقق من التوكن ويعيد { claims } أو { res } جاهزًا للإرجاع */
export async function authenticate(request, verifyIdToken) {
  const token = bearerOf(request);
  if (!token) return { res: json(401, { success: false, code: 'unauthenticated', error: 'يلزم تسجيل الدخول.', message: 'يلزم تسجيل الدخول.' }) };
  try {
    const claims = await verifyIdToken(token);
    if (!claims || !claims.uid) throw new Error('bad-token');
    return { claims };
  } catch (e) {
    const cfg = e && (e.message === 'no-project-id' || String(e.message || '').startsWith('jwks'));
    if (cfg) console.error('auth: token verification unavailable:', e.message);
    return { res: json(cfg ? 503 : 401, { success: false, code: cfg ? 'auth-unavailable' : 'bad-token',
      error: cfg ? 'تعذر التحقق من تسجيل الدخول الآن. أعد المحاولة بعد قليل.' : 'انتهت جلسة الدخول. سجّل الدخول من جديد.',
      message: cfg ? 'تعذر التحقق من تسجيل الدخول الآن.' : 'انتهت جلسة الدخول. سجّل الدخول من جديد.' }) };
  }
}
