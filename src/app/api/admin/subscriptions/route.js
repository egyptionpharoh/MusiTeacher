import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import User from '@/models/User';

// دالة للاتصال بقاعدة البيانات لضمان الاتصال قبل تنفيذ أي عملية
const connectDB = async () => {
  if (mongoose.connection.readyState >= 1) return;
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is missing in .env');
  await mongoose.connect(process.env.MONGODB_URI);
};

export async function POST(req) {
  try {
    await connectDB();

    // 1. استلام البيانات من الواجهة الإدارية
    const { adminUid, targetEmail, planType } = await req.json();

    if (!adminUid || !targetEmail || !planType) {
      return NextResponse.json({ success: false, message: 'يجب إرسال جميع البيانات المطلوبة.' }, { status: 400 });
    }

    // 2. الجدار الحديدي: التحقق من أن طالب التفعيل هو "المدير" فعلياً من قاعدة البيانات
    const adminUser = await User.findOne({ uid: adminUid });
    if (!adminUser || adminUser.role !== 'admin') {
      return NextResponse.json({ 
        success: false, 
        message: 'محاولة اختراق أو صلاحيات غير كافية! هذا الإجراء مسموح للمدير فقط.' 
      }, { status: 403 });
    }

    // 3. البحث عن المستخدم المراد تفعيل اشتراكه باستخدام الإيميل وتحديث حالته مباشرة لضمان عدم ضياع الاشتراك
    const normalizedEmail = targetEmail.toLowerCase().trim();
    let targetUser = await User.findOne({ email: normalizedEmail });

    if (!targetUser) {
      return NextResponse.json({ 
        success: false, 
        message: 'لم يتم العثور على مستخدم بهذا البريد الإلكتروني في المنصة.' 
      }, { status: 404 });
    }
    if (!targetUser) {
      return NextResponse.json({ 
        success: false, 
        message: 'لم يتم العثور على مستخدم بهذا البريد الإلكتروني في المنصة.' 
      }, { status: 404 });
    }

    // 4. حساب تاريخ انتهاء الاشتراك بناءً على نوع الباقة
    const now = new Date();
    let expirationDate = new Date(now);

    if (planType === 'semester') {
      // باقة الفصل الدراسي (120 يوم - يمكنك تغيير الرقم 120 إلى أي عدد أيام تريده)
      expirationDate.setDate(now.getDate() + 120);
    } else if (planType === 'annual') {
      // الباقة السنوية (365 يوم)
      expirationDate.setDate(now.getDate() + 365);
    } else {
      return NextResponse.json({ success: false, message: 'نوع الباقة غير معروف.' }, { status: 400 });
    }

    // 5. تفعيل المستخدم وتحديث تاريخ الانتهاء
    targetUser.isSubscribed = true;
    targetUser.subscriptionEndDate = expirationDate;
    
    // حفظ التعديلات في MongoDB
    await targetUser.save();

    // إرسال رسالة نجاح للواجهة الإدارية
    return NextResponse.json({ 
      success: true, 
      message: 'تم تفعيل الاشتراك بنجاح يا ملك!',
      endDate: expirationDate
    });

  } catch (error) {
    console.error('خطأ في تفعيل الاشتراك (API):', error);
    return NextResponse.json({ success: false, message: 'حدث خطأ في الخادم أثناء معالجة التفعيل.' }, { status: 500 });
  }
}