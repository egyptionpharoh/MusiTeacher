import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import User from '@/models/User';
import mongoose from 'mongoose';

// الاتصال بقاعدة البيانات MongoDB باستخدام Mongoose
async function connectDB() {
  if (mongoose.connection.readyState >= 1) return;
  await mongoose.connect(process.env.MONGODB_URI);
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

    if (!user) {
      user = await User.create({
        uid,
        email,
        displayName: displayName || '',
        photoURL: photoURL || '',
        isSubscribed: false,
        subscriptionEndDate: null,
      });
    } else {
      // تحديث البيانات الأساسية إن تطلب الأمر
      user.displayName = displayName || user.displayName;
      user.photoURL = photoURL || user.photoURL;
      await user.save();
    }

    return NextResponse.json({ success: true, user }, { status: 200 });
  } catch (error) {
    console.error('Error in auth sync:', error);
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 });
  }
}