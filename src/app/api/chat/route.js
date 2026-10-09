import { NextResponse } from 'next/server';
import { askSmartTeacher } from '../../../services/geminiService';
import User from '../../../models/User'; 
import mongoose from 'mongoose';

export async function POST(req) {
  try {
    if (mongoose.connection.readyState !== 1) {
        await mongoose.connect(process.env.MONGODB_URI);
    }

    const { message, userEmail, uid } = await req.json();
    
    // البحث عن المستخدم في MongoDB سواء بالـ uid أو بالبريد الإلكتروني
    let user = null;
    if (uid || userEmail) {
      const searchConditions = [];
      if (uid) searchConditions.push({ uid });
      if (userEmail) searchConditions.push({ email: userEmail.toLowerCase().trim() });

      user = await User.findOne({ $or: searchConditions });
    }

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