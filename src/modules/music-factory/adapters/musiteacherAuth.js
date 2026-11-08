// 🔐 ربط «مصنع الألحان» بنظام الدخول في MusiTeacher (الملف الوحيد الذي يعرف المنصة على جانب الخادم).
// نفس شرط بقية الأدوات: مستخدم Firebase مسجّل + مشترك ساري أو أدمن (من MongoDB).
// عند فصل الأداة لاحقًا يُستبدل هذا الملف فقط بطريقة الدخول في المشروع الجديد.
import { bearerOf, sameOrigin, entitlementOf } from '../../../lib/virtual-games/guard.js';

export function makeMusiTeacherAuthorize(deps) {
  return async function authorize(request) {
    if (!sameOrigin(request)) return { ok: false, status: 403, code: 'forbidden', error: 'طلب من مصدر غير مسموح.' };
    const token = bearerOf(request);
    if (!token) return { ok: false, status: 401, code: 'unauthenticated', error: 'سجّل الدخول أولًا.' };
    let decoded;
    try { decoded = await deps.verifyIdToken(token); } catch { return { ok: false, status: 401, code: 'unauthenticated', error: 'انتهت جلسة الدخول. حدّث الصفحة وسجّل الدخول من جديد.' }; }
    if (!decoded || !decoded.uid) return { ok: false, status: 401, code: 'unauthenticated', error: 'سجّل الدخول أولًا.' };
    let user;
    try { user = await deps.findUser(decoded.uid); } catch (e) {
      console.error('[music-factory auth] db:', e && e.message);
      return { ok: false, status: 503, code: 'server-not-configured', error: 'تعذر الاتصال بقاعدة البيانات حاليًا.' };
    }
    const ent = entitlementOf(user);
    if (!ent.ok) return { ok: false, status: 403, code: 'forbidden', error: 'هذه الأداة متاحة للمشتركين فقط.' };
    return { ok: true, userId: decoded.uid, admin: !!ent.admin };
  };
}
