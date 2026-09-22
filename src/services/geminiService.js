import { GoogleGenerativeAI } from "@google/generative-ai";
import { teacherPrompt } from "../prompt-engine/teacher-prompt";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export async function askSmartTeacher(userMessage, userData) {
  try {
    // التحقق من حالة الاشتراك
    if (!userData || userData.status !== 'active') {
        return "أهلاً بك يا أستاذي! أنا هنا لدعم المشتركين في منصة MusiTeacher فقط، هل يمكنك تسجيل الدخول للبدء؟";
    }

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const prompt = `${teacherPrompt} \n\n سؤال المعلم: ${userMessage}`;
    
    const result = await model.generateContent(prompt);
    return result.response.text();
    
  } catch (error) {
    console.error("DEBUG: Gemini Error:", error.message);
    return "عذراً يا أستاذي، النظام يحتاج لحظة للراحة. هل يمكنك المحاولة مرة أخرى؟";
  }
}