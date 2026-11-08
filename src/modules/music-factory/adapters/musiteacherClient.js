// 🔑 ربط واجهة «مصنع الألحان» بحساب المعلم في MusiTeacher (Firebase).
// الواجهة نفسها لا تعرف Firebase؛ تستقبل getToken فقط، فيسهل نقلها لمشروع مستقل.
import { auth } from '@/lib/firebase';

export async function getIdToken() {
  if (!auth || typeof auth !== 'object') return null;
  // ننتظر استرجاع جلسة الدخول بعد تحديث الصفحة قبل طلب التوكن
  if (typeof auth.authStateReady === 'function') { try { await auth.authStateReady(); } catch { /* ignore */ } }
  const u = auth.currentUser;
  if (!u) return null;
  try { return await u.getIdToken(); } catch { return null; }
}
