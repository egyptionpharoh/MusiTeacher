import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
    uid: { type: String, required: true, unique: true }, // رقم تعريف Firebase عشان نربط الحساب صح
    username: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    role: { type: String, enum: ['user', 'admin'], default: 'user' }, // عشان السيرفر يحفظ صلاحية الأدمن
    isSubscribed: { type: Boolean, default: false }, // حالة الاشتراك الفعالية
    subscriptionEndDate: { type: Date, default: null }, // تاريخ انتهاء الاشتراك
    // تخصص المعلم عشان الروبوت يعرف يتكلم معاه في إيه
    specialization: { type: String, default: 'موسيقى' }, 
    // حالة الاشتراك في MusiTeacher
    status: { 
        type: String, 
        enum: ['active', 'expired', 'suspended'], 
        default: 'active' 
    },
    subscriptionDate: { type: Date, default: Date.now }
}, { timestamps: true });

export default mongoose.models.User || mongoose.model('User', userSchema);