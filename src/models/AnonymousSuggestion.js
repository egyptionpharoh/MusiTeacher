import mongoose from 'mongoose';

// رسالة في «صندوق الاقتراحات السرية» — عمدًا بلا أي حقل يدل على المرسل:
// لا uid ولا بريد ولا اسم ولا IP ولا جهاز، ولا وقت دقيق (يوم الاستلام فقط)، والمعرّف UUID عشوائي (ليس ObjectId الذي يحمل وقت الإنشاء).
const schema = new mongoose.Schema({
  _id: { type: String, required: true },
  body: { type: String, required: true, maxlength: 4000 },
  category: { type: String, enum: ['idea', 'problem', 'design', 'complaint', 'thanks', 'other'], default: 'other' },
  status: { type: String, enum: ['new', 'read', 'review', 'done'], default: 'new' },
  archived: { type: Boolean, default: false },
  day: { type: String, required: true },   // YYYY-MM-DD بتوقيت مسقط
  seq: { type: Number, required: true },   // ترتيب الوصول (للعرض من الأحدث) — ليس وقتًا
}, { versionKey: false, timestamps: false, strict: true, collection: 'anonymous_suggestions' });
schema.index({ archived: 1, seq: -1 });

export default mongoose.models.AnonymousSuggestion || mongoose.model('AnonymousSuggestion', schema);
