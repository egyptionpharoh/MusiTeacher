import { NextResponse } from 'next/server';

export async function POST(req) {
  try {
    const { message } = await req.json();

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "مفتاح GEMINI_API_KEY غير موجود في إعدادات السيرفر." }, 
        { status: 500 }
      );
    }

    // رابط الاتصال المباشر بجوجل جيمني
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

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
