// 🔐 ربط خدمات «منبّه الحصص» بنظام الدخول في MusiTeacher (الملف الوحيد على الخادم الذي يعرف المنصة، مع syncStore.js).
// نفس شرط بقية الأدوات: مستخدم Firebase مسجّل + مشترك ساري أو أدمن (من MongoDB).
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
      console.error('[class-alarm auth] db:', e && e.message);
      return { ok: false, status: 503, code: 'server-not-configured', error: 'تعذر الاتصال بقاعدة البيانات حاليًا.' };
    }
    const ent = entitlementOf(user);
    if (!ent.ok) return { ok: false, status: 403, code: 'forbidden', error: 'هذه الخدمة متاحة لحسابات المنصة المفعّلة فقط.' };
    return { ok: true, userId: decoded.uid, admin: !!ent.admin };
  };
}
