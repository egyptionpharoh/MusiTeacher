// تفعيل اشتراك معلم — للمدير فقط.
// الأمان: هوية المدير من Firebase ID token المُتحقَّق منه على الخادم (adminUid في الطلب يُتجاهل)،
// ويلزم بريد مُتحقَّق منه ضمن قائمة المديرين + دور admin في قاعدة البيانات.
// المنطق كله في src/lib/auth/admin-subscriptions.js (مختبر في tests/auth-security.test.mjs).
import User from '@/models/User';
import { realDeps } from '@/lib/virtual-games/deps';
import { makeAdminSubscriptionsHandler } from '@/lib/auth/admin-subscriptions';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const handler = makeAdminSubscriptionsHandler({
  verifyIdToken: (t) => realDeps.verifyIdToken(t),
  connect: () => realDeps.connectDB(),
  findByUid: (uid) => User.findOne({ uid }),
  findByEmail: (email) => User.findOne({ email }),
  save: (doc) => doc.save(),
  env: process.env,
});

export async function POST(request) {
  return handler(request);
}
