// 🔑 ربط المنبه بحساب المعلم في MusiTeacher (Firebase) على جانب المتصفح.
// الواجهة لا تعرف Firebase؛ تستقبل getToken فقط. عند فصل الأداة يُستبدل هذا الملف وحده.
import { auth } from '@/lib/firebase';

export async function getIdToken() {
  if (!auth || typeof auth !== 'object') return null;
  if (typeof auth.authStateReady === 'function') { try { await auth.authStateReady(); } catch { /* ignore */ } }
  const u = auth.currentUser;
  if (!u) return null;
  try { return await u.getIdToken(); } catch { return null; }
}

/** معرّف الحساب الحالي (لفصل بيانات كل معلم على نفس الجهاز) */
export async function getUserId() {
  if (!auth || typeof auth !== 'object') return null;
  if (typeof auth.authStateReady === 'function') { try { await auth.authStateReady(); } catch { /* ignore */ } }
  return (auth.currentUser && auth.currentUser.uid) || null;
}
