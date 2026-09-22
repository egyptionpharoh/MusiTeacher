import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { baseRules } from '../../../prompt-engine/base-rules';
import { lessonPrepRules } from '../../../prompt-engine/lesson-prep-rules';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export async function POST(req) {
  try {
    const { semester, grade, lessonTitle, notes } = await req.json();

    // 1. تحديد المسار
    const filePath = path.join(process.cwd(), 'public', 'factory_sources', semester, grade, `${lessonTitle}.pdf`);

    // 2. قراءة الملف كصور (Buffer)
    let fileBuffer;
    try {
      fileBuffer = await fs.readFile(filePath);
    } catch (fileError) {
      console.error("File Read Error:", fileError);
      return NextResponse.json(
        { success: false, error: `عذراً، لم يتم العثور على ملف الدرس في المسار: factory_sources/${semester}/${grade}/${lessonTitle}.pdf` }, 
        { status: 404 }
      );
    }

    // 3. تجهيز الملف للرؤية البصرية
    const pdfPart = {
      inlineData: {
        data: fileBuffer.toString("base64"),
        mimeType: "application/pdf"
      }
    };

    const model = genAI.getGenerativeModel({ 
        model: "gemini-2.5-flash",
        generationConfig: { responseMimeType: "application/json" }
    });

    // 4. دمج البروتوكول المطور بالهيكل الجديد المزدوج
    const promptText = `
      ${baseRules}
      ${lessonPrepRules}

      /// BEGIN_CORE_PROTOCOL: PROFESSIONAL_SYNC_EXTRACTION_V6 ///
      > ENGINE_TARGET: NOTEBOOK_LM_HYBRID
      > SOURCE_STRICTNESS: ABSOLUTE (DOCUMENT_IS_LAW)
      > SYNC_LOCK: ENABLED

      [SECTION 0: GLOBAL SAFETY LOCKS]
      - STEP_COUNT_INTEGRITY = TRUE
      - SYNC_RULE: "الاستراتيجيات التعليمية" list must be IDENTICAL to the tags used in "إجراءات سير الدرس" in both name and order.
      - NO_SUMMARIZATION: Do not list unique strategies only; list one for EVERY step.
      - TERMINOLOGY_CONTROL:
        1. AUTO_REPLACE: Convert all instances of "الطلاب" to "الطلبة" in the final output.
        2. STRICT_PRESERVATION: If the source text (Steps) uses "التلاميذ", KEEP it as "التلاميذ".
        3. NASHEED_STRATEGY_LOCK: If any step contains "(يُدرس النشيد بالطريقة الموضحة في إرشادات المعلم)"، الـ strategy المباشرة هي "استراتيجية الطريقة الجزئية".
      - IMAGE_PRESERVATION_LOCK: استخراج إحداثيات الصور بصيغة [[CROP_BOX:ymin,xmin,ymax,xmax]].
      - NUMBERING_LOCK: إجراءات سير الدرس يجب أن تكون مرقمة تسلسلياً بشكل صارم (1- ، 2- ، 3-).

      [SECTION 1: DATA EXTRACTION]
      استخرج البيانات الأساسية بدقة متناهية من الدليل.

      [SECTION 2: OUTPUT RENDERING - DUAL_CONTAINER_CONTRACT]
      يجب صياغة الـ JSON بالكامل ليكون محتوياً على حاويتين رئيسيتين هما (core) و (smartAssistantData) كالتالي تماماً:

      {
        "lessonId": "${lessonTitle}",
        
        "core": {
          "preparation": "التهيئة / التمهيد (مع استخدام وسوم HTML مثل <p>, <strong>)",
          "lesson_vocabulary": "المفاهيم والمصطلحات الخاصة بالدرس فقط",
          "thinking_skills": "إجراءات سير الدرس كاملة، مرقمة إجبارياً 1- 2- 3- ومدمج بها التوجيهات والاستراتيجيات وعلامات الـ CROP_BOX",
          "other_strategies": "الاستراتيجيات التعليمية المتبعة في الدرس في قائمة نصية واضحة يفصل بينها فاصلة",
          "other_learning_resources": "المصادر والمراجع والوسائل التعليمية المستخدمة",
          "formative_assessment": "التقويم التكويني والأسئلة المرحلية الكاشفة لفهم الطلبة",
          "closing_assessment": "التقويم الختامي والنشاط النهائي للدرس",
          "weekly_notes": ""
        },

        "smartAssistantData": {
          "teacherQuickView": {
            "lessonInOneMinute": "تحليل مكثف وملخص عبقري لجوهر وفكرة الدرس في دقيقة واحدة للمعلم المعاصر",
            "mainLearningGoal": "الهدف الأسمى المأمول خروج الطلبة به من هذا الدرس برؤية بيداغوجية عميقة",
            "focusPoint": "أخطر وأهم نقطة ارتكاز يجب على المعلم عدم إغفالها أو المرور عليها سريعاً أثناء الشرح"
          },
          "teachingTips": {
            "potentialDifficulties": "توقع دقيق مبني على التحليل الموسيقي لأكثر الأجزاء أو المفاهيم صعوبة على الطلبة (مثال: أداء سيكاه، نبر الميزان، التدوين)",
            "bestExplanationStyle": "توجيه استراتيجي للمعلم حول أفضل أسلوب لشرح وتوصيل فكرة هذا الدرس بالتحديد",
            "simplificationMethod": "خطوات عملية فورية لتبسيط المفهوم الموسيقي المعقد المعني بالدرس وتحويله لنشاط تفاعلي"
          },
          "enrichmentIdeas": [
            "فكرة إثرائية إبداعية خارج الصندوق للطلبة الموهوبين موسيقياً لتحدي قدراتهم وتنميتها",
            "نشاط عملي إضافي لربط الدرس بالثقافة العمانية أو الممارسات الموسيقية المتقدمة"
          ],
          "keywords": [
            "ضع هنا كلمات مفتاحية ذكية ومستخرجة من صلب الدرس ومفاهيمه بشكل دقيق جداً (من 3 إلى 5 كلمات)"
          ]
        }
      }

      * تنبيه صارم بخصوص الـ keywords: إذا كان الدرس يتعلق بالموازين أو الإشارات أو النبر أو الحركات الإيقاعية، تأكد من تضمين كلمة 'موازين' أو 'ميزان'. إذا كان عن لوحة المفاتيح أو العزف أو الراست أو السيكاه، ضمن كلمة 'أورج'. إذا كان عن الإملاء الموسيقي أو قراءة النوتة، ضمن كلمة 'إيقاع'.

      /// EXECUTE_SYNCED_PARSING: [${lessonTitle}] ///
      أمامك دليل المعلم، اقرأ المحتوى البصري والنصي بدقة تامة وفجر طاقاتك المعمارية لإنتاج الملف بالشكل المطلوب.
      ${notes ? `ملاحظات إضافية من المعلم يجب مراعاتها: ${notes}` : ""}
    `;

    let result;
    let retries = 3;
    let delayMs = 2000;

    for (let i = 0; i < retries; i++) {
      try {
        let timeoutId;
        const timeoutPromise = new Promise((_, reject) => {
          timeoutId = setTimeout(() => reject(new Error("Timeout")), 25000);
        });

        result = await Promise.race([
          model.generateContent([promptText, pdfPart]),
          timeoutPromise
        ]);
        
        clearTimeout(timeoutId);
        break;

      } catch (apiError) {
        const isOverloaded = apiError.message?.includes('503') || apiError.message?.includes('high demand');
        const isTimeout = apiError.message === "Timeout";

        if ((isOverloaded || isTimeout) && i < retries - 1) {
          console.warn(`[Gemini API] Attempt ${i + 1} failed. Retrying in ${delayMs}ms...`);
          await delay(delayMs);
          delayMs *= 2;
        } else {
          throw apiError; 
        }
      }
    }

    const responseText = result.response.text();
    const cleanJsonText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    const jsonData = JSON.parse(cleanJsonText);

    // نرجع الـ JSON كاملاً بالهيكل الجديد ليتم حفظه كاملاً ببيانات المساعد في البنك!
    return NextResponse.json({ success: true, data: jsonData });

  } catch (error) {
    console.error("Factory API System Error:", error);
    if (error.message?.includes('429') || error.message?.includes('Too Many Requests') || error.message?.includes('Quota')) {
      return NextResponse.json({ success: false, error: "تجاوزنا الحد الأقصى للطلبات، يرجى الانتظار قليلاً ثم المحاولة ⏳" }, { status: 429 });
    }
    return NextResponse.json({ success: false, error: "حدث خطأ أثناء معالجة وتوليد البيانات، يرجى المحاولة مرة أخرى." }, { status: 500 });
  }
}