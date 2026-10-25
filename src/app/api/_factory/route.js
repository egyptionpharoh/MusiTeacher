import { NextResponse } from 'next/server';
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// 1. إعداد عميل التخزين السحابي (جاهز للعمل مع Cloudflare R2)
const S3 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT, 
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

export async function POST(req) {
  try {
    // التحقق المبدئي من الأمان (يمكن ربطه لاحقاً ببيانات AuthContext)
    // حالياً سنكتفي بالتحقق من البيانات المرسلة
    const { semester, grade, lessonTitle } = await req.json();

    if (!semester || !grade || !lessonTitle) {
      return NextResponse.json(
        { success: false, error: "بيانات الدرس غير مكتملة." },
        { status: 400 }
      );
    }

    // 2. بناء مسار الملف كما سيتم ترتيبه داخل الحاوية السحابية (Bucket)
    // الترتيب: الفصل/الصف/اسم_الدرس.pptx
    const fileKey = `presentations/${semester}/${grade}/${lessonTitle}.pptx`;

    // 3. تجهيز أمر استدعاء الملف من السحابة
    const command = new GetObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: fileKey,
    });

    // 4. إصدار الرابط الموقّع المؤقت (صالح لمدة 15 دقيقة فقط - 900 ثانية)
    // هذا الرابط يحتوي على توقيع مشفر يمنع التلاعب أو الوصول الدائم للملف
    const signedUrl = await getSignedUrl(S3, command, { expiresIn: 900 });

    // 5. إرسال الرابط للمتصفح ليبدأ التنزيل المباشر من سيرفرات Cloudflare
    return NextResponse.json({ 
      success: true, 
      downloadUrl: signedUrl 
    });

  } catch (error) {
    console.error("Download Presentation API Error:", error);
    return NextResponse.json(
      { success: false, error: "حدث خطأ أثناء إعداد رابط التنزيل الآمن. يرجى المحاولة لاحقاً." }, 
      { status: 500 }
    );
  }
}