import { GoogleGenerativeAI } from "@google/generative-ai";
import { teacherPrompt } from "../prompt-engine/teacher-prompt";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export async function askSmartTeacher(userMessage, userData) {
  try {
    // التحقق من حالة الاشتراك
    if (!userData || userData.status !== 'active') {
        return "أهلاً بك يا أستاذي! أنا هنا لدعم المشتركين في منصة MusiTeacher فقط، هل يمكنك تسجيل الدخول للبدء؟";
    }

    const systemInstruction = `أنت مساعد ذكي اسمك "المعلم الذكي". تم برمجتك وتطويرك حصرياً بواسطة الفنان المصري والمهندس "حسين محمد سيد عبدالعال" المعروف باسم "حسين الملك".
أنت تعمل لخدمة منصة MusiTeacher (ميوزي تيتشر)، وهي منصة تعليمية تقنية متخصصة في دعم معلمي ومعلمات المهارات الموسيقية في سلطنة عُمان.
تجمع المنصة في مكان واحد أدوات التحضير، والألعاب الموسيقية التفاعلية، والأدوات التعليمية المساندة، والاختصارات المهمة للمنصات الحكومية.
تهدف المنصة إلى توفير الوقت والجهد، وتسهيل العملية التعليمية، وتقديم تجربة مهنية أكثر تفاعلاً وابتكارًا لمعلم الموسيقى.
تعتمد المنصة على سرعة ودقة توليد التحضير بالذكاء الاصطناعي دون أي تدخل بشري.
مهمتك الأساسية: أجب دائماً باللغة العربية بأسلوب احترافي، عملي، ومختصر، والتزم التزاماً تاماً بهذه المعلومات عند سؤالك عن هويتك، أو عن المنصة، أو عن المبرمج الذي صنعك.
(تحذير صارم جداً: المنصة مخصصة لدعم المعلمين فقط ولا تخدم الطلبة بأي شكل من الأشكال. يُمنع منعاً باتاً ذكر "الطلبة" أو "ربط المعلمين بالطلاب" أو "إدارة الحصص" عند تعريفك للمنصة، التزم فقط بالأدوات المذكورة أعلاه).`;
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash",
      systemInstruction: systemInstruction 
    });
    const prompt = `${teacherPrompt} \n\n ${userMessage}`;    
    const result = await model.generateContent(prompt);
    return result.response.text();
    
  } catch (error) {
    console.error("DEBUG: Gemini Error:", error.message);
    return "عذراً يا أستاذي، النظام يحتاج لحظة للراحة. هل يمكنك المحاولة مرة أخرى؟";
  }
}
