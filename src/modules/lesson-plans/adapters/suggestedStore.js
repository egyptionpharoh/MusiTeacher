// 📚 تخزين «الخطط الدراسية المقترحة» (يرفعها الأدمن) + «صفوفي» لكل معلم — في MongoDB.
// مجموعتان جديدتان مستقلتان تمامًا عن خطط المعلمين (lesson_plans_sync)؛ لا تغيير في أي مجموعة قائمة.
import mongoose from 'mongoose';

const sSchema = new mongoose.Schema({
  _id: { type: String }, grade: { type: Number, index: true }, semester: String, year: String, subject: String, title: String, note: String,
  lessons: Number, fileName: String, mime: String, size: Number, data: Buffer, uploadedBy: String, createdAt: Number, updatedAt: Number,
}, { versionKey: false });
const Suggested = mongoose.models.LessonPlansSuggested || mongoose.model('LessonPlansSuggested', sSchema, 'lesson_plans_suggested');

const pSchema = new mongoose.Schema({ _id: { type: String }, grades: [Number], updatedAt: Number }, { versionKey: false });
const Prefs = mongoose.models.LessonPlansPrefs || mongoose.model('LessonPlansPrefs', pSchema, 'lesson_plans_prefs');

export function makeSuggestedStore(connectDB) {
  return {
    async list() { await connectDB(); return Suggested.find({}, { data: 0 }).sort({ grade: 1, semester: 1, updatedAt: -1 }).lean(); },
    async get(id) { await connectDB(); return Suggested.findById(id).lean(); },
    async put(doc) { await connectDB(); const { _id, ...rest } = doc; await Suggested.updateOne({ _id }, { $set: rest }, { upsert: true }); },
    async patch(id, set) { await connectDB(); const r = await Suggested.updateOne({ _id: id }, { $set: set }); return r.matchedCount > 0; },
    async remove(id) { await connectDB(); const r = await Suggested.deleteOne({ _id: id }); return r.deletedCount > 0; },
  };
}
export function makePrefsStore(connectDB) {
  return {
    async get(uid) { await connectDB(); return Prefs.findById(uid).lean(); },
    async put(uid, grades, updatedAt) { await connectDB(); await Prefs.updateOne({ _id: uid }, { $set: { grades, updatedAt } }, { upsert: true }); },
  };
}
