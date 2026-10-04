import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import User from '@/models/User';
import mongoose from 'mongoose';

async function connectDB() {
  if (mongoose.connection.readyState >= 1) return;
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/musiteacher';
  await mongoose.connect(uri);
}

export async function POST(req) {
  try {
    const body = await req.json();
    const { message, uid } = body;

    await connectDB();
    const dbUser = uid ? await User.findOne({ uid }) : null;

    // التحقق من حالة الاشتراك وتاريخ الانتهاء
    let isValidSub = false;
    if (dbUser && dbUser.isSubscribed) {
      if (dbUser.subscriptionEndDate) {
        const endDate = new Date(dbUser.subscriptionEndDate);
        const now = new Date();
        if (endDate > now) {
          isValidSub = true;
        }
      }
    }

    // إذا لم يكن مسجلاً للدخول أو ليس لديه اشتراك فعال، نجعل البوت يرد بهذه الرسالة مباشرة
    if (!uid || !isValidSub) {
      const replyText = "عذراً لا يمكنك التحدث مع المعلم الذكي The Smart Teacher إلا إذا كنت مشتركاً فى إحدى الباقات المدفوعة، يمكنك اختيار الباقة المناسبة لك، مع أطيب امنياتي لك بيوم سعيد.. 🎵";
      return NextResponse.json({ reply: replyText });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "مفتاح GEMINI_API_KEY غير موجود في إعدادات السيرفر." }, 
        { status: 500 }
      );
    }

    // رابط الاتصال المباشر بجوجل جيمني
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        system_instruction: {
          parts: { 
            text: "أنت مساعد ذكي اسمك 'المعلم الذكي'، تم برمجتك وتطويرك حصرياً بواسطة المهندس 'حسين الملك' لخدمة منصة MusiTeacher ومعلمي المهارات الموسيقية في سلطنة عمان. أجب باللغة العربية بأسلوب احترافي، عملي، ومختصر قدر الإمكان لمساعدة المعلمين." 
          }
        },
        contents: [{
          role: "user",
          parts: [{ text: message }]
        }]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || "حدث خطأ من خوادم جوجل.");
    }

    // استخراج الرد من استجابة جيمني
    const replyText = data.candidates[0].content.parts[0].text;

    // إرجاع الرد للواجهة الأمامية
    return NextResponse.json({ reply: replyText });

  } catch (error) {
    console.error("Chat API Error:", error);
    return NextResponse.json(
      { error: "حدث خطأ أثناء معالجة الطلب: " + error.message }, 
      { status: 500 }
    );
  }
}
