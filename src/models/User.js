import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
    username: { type: String, required: true },
    email: { type: String, required: true, unique: true },
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