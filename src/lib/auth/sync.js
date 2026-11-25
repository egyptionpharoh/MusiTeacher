// منطق /api/auth/sync — ربط حساب Firebase بسجل المستخدم في MongoDB.
// الإصلاح الأمني: الهوية (uid والبريد) تُؤخذ من Firebase ID token بعد التحقق من توقيعه على الخادم،
// ولا يُقبل أي uid أو بريد مكتوب في جسم الطلب. صلاحية المدير لا تُمنح إلا لبريد مُتحقَّق منه في القائمة.
import { normEmail, isAdminClaims, authenticate, json } from './admins.js';

const cleanName = (v) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 80) : '');

/** ما يعود للمتصفح: بيانات الحساب نفسه فقط. role «admin» فقط لمن تحقق شرط المدير الآن. */
function publicUser(u, isAdmin) {
  return {
    uid: u.uid, email: u.email, username: u.username,
    role: isAdmin ? 'admin' : 'user',
    isSubscribed: !!u.isSubscribed, subscriptionEndDate: u.subscriptionEndDate || null,
    status: u.status || 'active',
  };
}

/**
 * deps: { verifyIdToken, connect, findByUid, findByEmail, create, save, env }
 */
export function makeSyncHandler(deps) {
  return async function sync(request) {
    const auth = await authenticate(request, deps.verifyIdToken);
    if (auth.res) return auth.res;
    const { claims } = auth;
    const uid = claims.uid;
    const email = normEmail(claims.email);
    const verified = claims.email_verified === true;
    if (!email) return json(400, { success: false, code: 'no-email', error: 'حساب الدخول لا يحتوي بريدًا إلكترونيًا.' });

    let body = {};
    try { body = await request.json(); } catch { body = {}; }
    const displayName = cleanName(body && body.displayName) || cleanName(claims.name);
    const isAdmin = isAdminClaims(claims, deps.env);

    try {
      await deps.connect();
      let user = await deps.findByUid(uid);
      if (!user) {
        const byEmail = await deps.findByEmail(email);
        if (byEmail) {
          // نقل سجل قديم (قد يحمل اشتراكًا مفعّلًا) إلى uid جديد — فقط إن أثبت Firebase ملكية البريد.
          if (!verified) {
            return json(409, { success: false, code: 'email-unverified',
              error: 'هذا البريد مرتبط بحساب سابق في المنصة. فعّل بريدك من رسالة التحقق ثم سجّل الدخول مجددًا، أو تواصل مع إدارة المنصة.' });
          }
          byEmail.uid = uid;
          user = byEmail;
        } else {
          user = await deps.create({
            uid, email, username: displayName || email.split('@')[0],
            role: isAdmin ? 'admin' : 'user', isSubscribed: false, subscriptionEndDate: null,
          });
          return json(200, { success: true, user: publicUser(user, isAdmin), isAdmin });
        }
      }
      user.username = displayName || user.username || 'معلم موسيقى';
      if (isAdmin) user.role = 'admin';
      else if (user.role !== 'admin' && user.role !== 'user') user.role = 'user';   // تنظيف قيم قديمة مثل teacher
      await deps.save(user);
      return json(200, { success: true, user: publicUser(user, isAdmin), isAdmin });
    } catch (e) {
      console.error('auth sync failed:', e && (e.code || e.name || 'error'));
      return json(500, { success: false, code: 'server-error', error: 'حدث خطأ في الخادم' });
    }
  };
}
