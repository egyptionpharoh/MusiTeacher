import mongoose from 'mongoose';

// سجلات حماية مؤقتة لـ«صندوق الاقتراحات السرية» (تُحذف تلقائيًا):
//   seq           عدّاد ترتيب الرسائل
//   day:<يوم>     عدد الرسائل في ذلك اليوم (سقف عام يحمي من الإغراق)
//   nonce:<رقم>   رمز نموذج استُخدم (منع الإرسال المزدوج)
//   dup:<بصمة>    بصمة محتوى رسالة حديثة (منع تكرار الرسالة نفسها)
// لا شيء هنا يرتبط بالمرسل، وتاريخ الحذف «خشن» (نهاية يوم) حتى لا يُستنتج منه وقت الإرسال.
const schema = new mongoose.Schema({
  _id: { type: String, required: true },
  n: { type: Number, default: 0 },
  expireAt: { type: Date, default: null },
}, { versionKey: false, timestamps: false, collection: 'anonymous_suggestions_guard' });
schema.index({ expireAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.models.SuggestionGuard || mongoose.model('SuggestionGuard', schema);
