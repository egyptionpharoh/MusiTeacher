// ربط حساب Firebase بسجل المستخدم في MongoDB.
// الأمان: الهوية من Firebase ID token (ترويسة Authorization) بعد التحقق من توقيعه على الخادم — لا من جسم الطلب.
// المنطق كله في src/lib/auth/sync.js (مختبر في tests/auth-security.test.mjs).
import User from '@/models/User';
import { realDeps } from '@/lib/virtual-games/deps';
import { makeSyncHandler } from '@/lib/auth/sync';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const handler = makeSyncHandler({
  verifyIdToken: (t) => realDeps.verifyIdToken(t),
  connect: () => realDeps.connectDB(),
  findByUid: (uid) => User.findOne({ uid }),
  findByEmail: (email) => User.findOne({ email }),
  create: (doc) => User.create(doc),
  save: (doc) => doc.save(),
  env: process.env,
});

export async function POST(request) {
  return handler(request);
}
