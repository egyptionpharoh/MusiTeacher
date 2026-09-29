import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema(
  {
    // الرقم التعريفي الفريد القادم من Firebase (أساسي للربط)
    uid: {
      type: String,
      required: true,
      unique: true,
    },
    // البريد الإلكتروني للمستخدم
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    // اسم المستخدم
    displayName: {
      type: String,
      default: '',
    },
    // صورة البروفايل
    photoURL: {
      type: String,
      default: '',
    },
    // تخصص المعلم
    specialization: {
      type: String,
      default: 'موسيقى',
    },
    // صلاحية المستخدم (مستخدم عادي، معلم، أو أدمن)
    role: {
      type: String,
      enum: ['user', 'teacher', 'admin'],
      default: 'teacher',
    },
    // هل الاشتراك حالياً فعال؟
    isSubscribed: {
      type: Boolean,
      default: false,
    },
    // تاريخ انتهاء الاشتراك
    subscriptionEndDate: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true, // يضيف تلقائياً تاريخ إنشاء الحساب وتاريخ آخر تعديل
  }
);

export default mongoose.models.User || mongoose.model('User', UserSchema);