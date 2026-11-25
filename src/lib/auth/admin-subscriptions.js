// منطق /api/admin/subscriptions — تفعيل اشتراك معلم بواسطة المدير.
// الإصلاح الأمني: هوية المدير من Firebase ID token المُتحقَّق منه على الخادم (لا من adminUid في الطلب)،
// ويلزم الشرطان معًا: بريد مُتحقَّق منه ضمن قائمة المديرين + دور admin في قاعدة البيانات.
import { normEmail, isAdminClaims, authenticate, json } from './admins.js';

export const PLAN_DAYS = { semester: 120, annual: 365 };
const deny = () => json(403, { success: false, code: 'forbidden', message: 'صلاحيات غير كافية! هذا الإجراء مسموح للمدير فقط.' });

/**
 * deps: { verifyIdToken, connect, findByUid, findByEmail, save, env, now? }
 */
export function makeAdminSubscriptionsHandler(deps) {
  return async function post(request) {
    const auth = await authenticate(request, deps.verifyIdToken);
    if (auth.res) return auth.res;
    if (!isAdminClaims(auth.claims, deps.env)) return deny();

    let body;
    try { body = await request.json(); } catch { body = null; }
    const targetEmail = normEmail(body && body.targetEmail);
    const planType = body && body.planType;
    if (!targetEmail || !targetEmail.includes('@') || !planType) {
      return json(400, { success: false, message: 'يجب إرسال جميع البيانات المطلوبة.' });
    }
    if (!Object.prototype.hasOwnProperty.call(PLAN_DAYS, planType)) {
      return json(400, { success: false, message: 'نوع الباقة غير معروف.' });
    }

    try {
      await deps.connect();
      const admin = await deps.findByUid(auth.claims.uid);
      if (!admin || admin.role !== 'admin') return deny();

      const target = await deps.findByEmail(targetEmail);
      if (!target) return json(404, { success: false, message: 'لم يتم العثور على مستخدم بهذا البريد الإلكتروني في المنصة.' });

      const now = deps.now ? deps.now() : new Date();
      if (target.isSubscribed && target.subscriptionEndDate && new Date(target.subscriptionEndDate) > now) {
        return json(200, { success: true, alreadyActive: true, message: 'المستخدم مشترك بالفعل', endDate: target.subscriptionEndDate });
      }
      const end = new Date(now);
      end.setDate(now.getDate() + PLAN_DAYS[planType]);
      target.isSubscribed = true;
      target.subscriptionEndDate = end;
      await deps.save(target);
      return json(200, { success: true, message: 'تم تفعيل الاشتراك بنجاح يا ملك!', endDate: end });
    } catch (e) {
      console.error('admin subscriptions failed:', e && (e.code || e.name || 'error'));
      return json(500, { success: false, message: 'حدث خطأ في الخادم أثناء معالجة التفعيل.' });
    }
  };
}
