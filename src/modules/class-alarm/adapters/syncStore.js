// ☁️ مخزن المزامنة الاختيارية في MongoDB: مستند واحد لكل معلم (uid) يحتوي نسخة جداوله وإعداداته فقط.
// لا يحتوي النغمات الخاصة ولا أي ملفات صوتية. يحذفه المعلم من تبويب «البيانات» متى شاء.
import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  _id: { type: String },                 // = Firebase uid (مستند واحد لكل معلم)
  data: { type: mongoose.Schema.Types.Mixed, required: true },
  updatedAt: { type: Number, required: true },
}, { versionKey: false, minimize: false });

const ClassAlarmSync = mongoose.models.ClassAlarmSync || mongoose.model('ClassAlarmSync', schema, 'class_alarm_sync');

export function makeSyncStore(connectDB) {
  return {
    async get(uid) { await connectDB(); return ClassAlarmSync.findById(uid).lean(); },
    async put(uid, data, updatedAt) { await connectDB(); await ClassAlarmSync.updateOne({ _id: uid }, { $set: { data, updatedAt } }, { upsert: true }); },
    async remove(uid) { await connectDB(); await ClassAlarmSync.deleteOne({ _id: uid }); },
  };
}
