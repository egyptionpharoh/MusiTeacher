import { NextResponse } from 'next/server';
import { askSmartTeacher } from '../../../services/geminiService';
import User from '../../../models/User'; 
import mongoose from 'mongoose';

export async function POST(req) {
  try {
    // التحقق من الاتصال قبل البحث
    if (mongoose.connection.readyState !== 1) {
        await mongoose.connect(process.env.MONGODB_URI);
    }

    const { message, userEmail } = await req.json();
    const user = await User.findOne({ email: userEmail });
    const reply = await askSmartTeacher(message, user);

    return NextResponse.json({ reply });

  } catch (error) {
    console.error("API Route Error:", error);
    return NextResponse.json(
      { error: "عذراً يا أستاذي، حدث خطأ في التواصل مع خوادم المعلم الذكي." },
      { status: 500 }
    );
  }
}