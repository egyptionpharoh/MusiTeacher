import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import User from '@/models/User';
import mongoose from 'mongoose';

export const dynamic = 'force-dynamic';

// الاتصال بقاعدة البيانات MongoDB باستخدام Mongoose
async function connectDB() {
  if (mongoose.connection.readyState >= 1) return;
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/musiteacher';
  await mongoose.connect(uri);
}

export async function POST(request) {
  try {
    const { uid, email, displayName, photoURL } = await request.json();

    if (!uid || !email) {
      return NextResponse.json({ error: 'البيانات غير مكتملة' }, { status: 400 });
    }

    await connectDB();

    // البحث عن المستخدم أو إنشاؤه/تحديثه
    let user = await User.findOne({ uid });

    // فحص ما إذا كان البريد هو بريد مدير المنصة
    const adminEmails = [
      'egyptionpharoh5@gmail.com',
      // يمكنك إضافة إيميلك الحالي هنا بين علامتي تنصيص، على سبيل المثال:
       'hussien.elmalek@gmail.com'
    ];
    const isAdminEmail = adminEmails.includes(email.toLowerCase().trim());

    if (!user) {
      // 🚨 الجدار الواقي الجديد: 
      // قبل أن نعتبره مستخدماً جديداً وننشئ حساباً فارغاً من الاشتراكات،
      // نبحث أولاً هل له حساب سابق بنفس الإيميل (إذا دخل بحساب جوجل مثلاً ولديه حساب سابق)
      let existingUserByEmail = await User.findOne({ email: email.toLowerCase().trim() });

      if (existingUserByEmail) {
        // ممتاز! وجدنا حسابه القديم (الذي قد يحتوي على اشتراك مفعل).
        // سنقوم بتحديث رقم uid الخاص به ليتطابق مع تسجيل دخوله الحالي لمنع ضياع الباقة
        existingUserByEmail.uid = uid;
        existingUserByEmail.displayName = displayName || existingUserByEmail.displayName;
        existingUserByEmail.photoURL = photoURL || existingUserByEmail.photoURL;
        
        if (isAdminEmail) {
          existingUserByEmail.role = 'admin';
        }
        
        await existingUserByEmail.save();
        user = existingUserByEmail; // نعتمد هذا الحساب ليعود للواجهة
      } else {
        // مستخدم جديد كلياً
        user = await User.create({
          uid,
          email: email.toLowerCase().trim(), // توحيد حالة الأحرف لتفادي أخطاء التفعيل مستقبلاً
          displayName: displayName || '',
          photoURL: photoURL || '',
          role: isAdminEmail ? 'admin' : 'teacher',
          isSubscribed: false,
          subscriptionEndDate: null,
        });
      }
    } else {
      // المستخدم موجود وتم العثور عليه برقم uid، نحدث بياناته الأساسية
      user.displayName = displayName || user.displayName;
      user.photoURL = photoURL || user.photoURL;
      if (isAdminEmail) {
        user.role = 'admin';
      }
      await user.save();
    }

    return NextResponse.json({ 
      success: true, 
      user,
      isAdmin: isAdminEmail // 🚨 جدار حماية إضافي: نرسل حالة الأدمن مباشرة للواجهة
    }, { status: 200 });
  } catch (error) {
    console.error('Error in auth sync:', error);
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 });
  }
}