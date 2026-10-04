import { NextResponse } from 'next/server';
import User from '@/models/User';
import mongoose from 'mongoose';
import { adminAuth } from '@/lib/firebaseAdmin';

// الاتصال بقاعدة البيانات MongoDB باستخدام Mongoose
async function connectDB() {
  if (mongoose.connection.readyState >= 1) return;
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/musiteacher';
  await mongoose.connect(uri);
}

export async function POST(request) {
  try {
    // 🚨 1. الجدار الأمني الأول: استخراج التوكن من الهيدر 🚨
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'غير مصرح لك بالوصول - التوكن مفقود' }, { status: 401 });
    }
    const token = authHeader.split(' ')[1];

    // 🚨 2. الجدار الأمني الثاني: فك تشفير التوكن والتأكد من صحته عبر سيرفرات فايربيز 🚨
    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(token);
    } catch (error) {
      return NextResponse.json({ error: 'التوكن غير صالح أو انتهت صلاحيته' }, { status: 401 });
    }
    const uid = decodedToken.uid;

    // 🚨 3. الجدار الأمني الثالث: التحقق من وجود حساب المستخدم وحالة اشتراكه في MongoDB 🚨
    await connectDB();
    const user = await User.findOne({ uid });

    if (!user) {
      return NextResponse.json({ error: 'حساب المستخدم غير موجود في قاعدة البيانات' }, { status: 404 });
    }

    // فحص ما إذا كان المستخدم أدمن أو لديه اشتراك ساري
    const isSubscribed = user.isSubscribed && user.subscriptionEndDate && new Date(user.subscriptionEndDate) > new Date();
    
    if (user.role !== 'admin' && !isSubscribed) {
      return NextResponse.json({ error: 'لا يوجد اشتراك فعال، يرجى تجديد الباقة' }, { status: 403 });
    }

    // ======== 🟢 منطقة الأمان 🟢 ========
    // إذا وصل الكود إلى هنا، فالمستخدم حقيقي، واشتراكه سليم 100%
    const body = await request.json();
    const { semester, grade, title, contentType } = body;

    // TODO: ضع هنا كود استخراج الدرس الخاص بك من قاعدة البيانات بناءً على الـ body
    // ... 
    
    // مثال للإرجاع الناجح (استبدل البيانات الفيك ببيانات الدرس الحقيقية الخاصة بك)
    const lessonData = {
       title: title,
       content: "محتوى الدرس هنا..."
    };

    return NextResponse.json({ success: true, data: lessonData }, { status: 200 });

  } catch (error) {
    console.error('Error in get-lesson:', error);
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 });
  }
}