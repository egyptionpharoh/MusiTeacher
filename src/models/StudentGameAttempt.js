import mongoose from 'mongoose';

// عدّاد المحاولات الخاطئة لكل جهاز (مفتاح مجهول الهوية: بصمة وليس عنوان IP) — يُحذف تلقائيًا
const schema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  fails: { type: Number, default: 0 },
  windowStart: { type: Date, required: true },
  expireAt: { type: Date, required: true },
});
schema.index({ expireAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.models.StudentGameAttempt || mongoose.model('StudentGameAttempt', schema);
