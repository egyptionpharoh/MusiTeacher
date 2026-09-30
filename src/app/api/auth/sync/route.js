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
    const isAdminEmail = email.toLowerCase().trim() === 'egyptionpharoh5@gmail.com';

    if (!user) {
      user = await User.create({
        uid,
        email,
        displayName: displayName || '',
        photoURL: photoURL || '',
        role: isAdminEmail ? 'admin' : 'teacher',
        isSubscribed: false,
        subscriptionEndDate: null,
      });
    } else {
      // تحديث البيانات الأساسية وترقية حسابك إلى admin تلقائياً
      user.displayName = displayName || user.displayName;
      user.photoURL = photoURL || user.photoURL;
      if (isAdminEmail) {
        user.role = 'admin';
      }
      await user.save();
    }

    return NextResponse.json({ success: true, user }, { status: 200 });
  } catch (error) {
    console.error('Error in auth sync:', error);
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 });
  }
}