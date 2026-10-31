// الاعتماديات الحقيقية للإنتاج: Firebase Admin (التحقق من الهوية) + MongoDB عبر نموذج User الحالي.
import mongoose from 'mongoose';
import { adminAuth } from '../firebase-Admin.js';
import User from '../../models/User.js';

async function connectDB() {
  if (mongoose.connection.readyState >= 1) return;
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/musiteacher';
  await mongoose.connect(uri);
}

export const realDeps = {
  async verifyIdToken(token) {
    if (!adminAuth) throw new Error('firebase-admin not configured');   // نفشل بإغلاق الباب، لا بفتحه
    return adminAuth.verifyIdToken(token);
  },
  async findUser(uid) {
    await connectDB();
    return User.findOne({ uid }).select('role isSubscribed subscriptionEndDate').lean();
  },
};
