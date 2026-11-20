import mongoose from 'mongoose';

// مشاركة لعبة مع الطلاب: رمز دخول واحد نشط لكل معلم ولكل لعبة.
// الرمز لا يُحفظ نصًّا صريحًا: lookup (بصمة HMAC للبحث) + enc (نسخة مشفّرة AES-GCM تُعرض للمعلم صاحبها فقط).
const schema = new mongoose.Schema({
  teacherUid: { type: String, required: true, index: true },
  gameId: { type: String, required: true, index: true },
  lookup: { type: String, required: true, unique: true },
  enc: { type: String, required: true },
  expiresAt: { type: Date, required: true },
  revokedAt: { type: Date, default: null },
  uses: { type: Number, default: 0 },
  lastUsedAt: { type: Date, default: null },
  purgeAt: { type: Date, required: true },          // حذف تلقائي للسجل بعد 30 يومًا من انتهائه
}, { timestamps: { createdAt: 'createdAt', updatedAt: false } });
schema.index({ purgeAt: 1 }, { expireAfterSeconds: 0 });
schema.index({ teacherUid: 1, gameId: 1, revokedAt: 1 });

export default mongoose.models.StudentGameShare || mongoose.model('StudentGameShare', schema);
