// الاعتماديات الحقيقية للإنتاج: التحقق من هوية Firebase + MongoDB عبر نموذج User الحالي.
// ملاحظة: لم نعد نستورد firebase-admin هنا؛ تحميلها كان يُسقط هذا المسار على Vercel (خطأ 500 قبل أي كود).
// التحقق الآن عبر node:crypto ومفاتيح Google العامة (firebase-token.js) — نفس الضمان الأمني بلا مكتبة ثقيلة.
import mongoose from 'mongoose';
import User from '../../models/User.js';
import { verifyFirebaseIdToken, getGoogleKeys } from './firebase-token.js';

async function connectDB() {
  const c = mongoose.connection;
  if (c.readyState === 1) return;
  if (c.readyState === 2) { await c.asPromise(); return; }        // اتصال جارٍ من طلب آخر
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI missing');
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
}

export const realDeps = {
  verifyIdToken(token) {
    return verifyFirebaseIdToken(token);
  },
  async findUser(uid) {
    await connectDB();
    return User.findOne({ uid }).select('role isSubscribed subscriptionEndDate').lean();
  },
  connectDB,
  checkKeys: () => getGoogleKeys(),
};
