// ☁️ مزامنة «الخطط الفصلية» مع حساب المعلم في MongoDB (اختيارية): مستند واحد لكل uid، لا يصل إليه غيره.
// لا يحتوي الملفات الأصلية المرفوعة؛ فقط البيانات المنظمة التي اعتمدها المعلم + التوزيع + سجل التنفيذ.
import mongoose from 'mongoose';

const schema = new mongoose.Schema({ _id: { type: String }, data: { type: mongoose.Schema.Types.Mixed, required: true }, updatedAt: { type: Number, required: true } }, { versionKey: false, minimize: false });
const LessonPlansSync = mongoose.models.LessonPlansSync || mongoose.model('LessonPlansSync', schema, 'lesson_plans_sync');

export function makePlansSyncStore(connectDB) {
  return {
    async get(uid) { await connectDB(); return LessonPlansSync.findById(uid).lean(); },
    async put(uid, data, updatedAt) { await connectDB(); await LessonPlansSync.updateOne({ _id: uid }, { $set: { data, updatedAt } }, { upsert: true }); },
    async remove(uid) { await connectDB(); await LessonPlansSync.deleteOne({ _id: uid }); },
  };
}
