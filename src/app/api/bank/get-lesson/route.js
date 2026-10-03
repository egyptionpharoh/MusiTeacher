import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

// 🚨 الخطوة 1: استيراد دوال التحقق من المستخدم من نظامك 
// (قم بتعديل هذا السطر بناءً على النظام اللي بتستخدمه: NextAuth أو Firebase أو JWT مخصص)
// import { getServerSession } from "next-auth/next";
// import { authOptions } from "@/app/api/auth/[...nextauth]/route";
// أو لو بتستخدم MongoDB وتوكن مخصص:
// import { verifyTokenAndGetUser } from '@/lib/auth';

const gradeMap = {
  "الصف الأول": "grade1", "الصف الثاني": "grade2", "الصف الثالث": "grade3",
  "الصف الرابع": "grade4", "الصف الخامس": "grade5", "الصف السادس": "grade6",
  "الصف السابع": "grade7", "الصف الثامن": "grade8", "الصف التاسع": "grade9",
  "الصف العاشر": "grade10", "الصف الحادي عشر": "grade11", "الصف الثاني عشر": "grade12"
};

export async function POST(req) {
  try {
    // ==========================================
    // 🚨 POLICE PATCH: حماية السيرفر من المتطفلين 🚨
    // ==========================================
    
    // 1. التحقق من تسجيل الدخول (Authentication)
    // لو بتستخدم NextAuth:
    // const session = await getServerSession(authOptions);
    // if (!session || !session.user) {
    //   return NextResponse.json({ success: false, error: 'غير مصرح: يرجى تسجيل الدخول أولاً. 🚫' }, { status: 401 });
    // }

    // -- أو لو بتستخدم نظام Token في الـ Headers --
    /*
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'غير مصرح: توكن مفقود أو غير صالح. 🚫' }, { status: 401 });
    }
    const token = authHeader.split(' ')[1];
    const user = await verifyTokenAndGetUser(token); // دالة مخصصة للتحقق من التوكن في الداتابيز (MongoDB)
    */

    // 2. التحقق من حالة الاشتراك (Authorization)
    // هنا بنتأكد إن اليوزر مش بس مسجل دخول، لأ وكمان حسابه مفعل ومشترك
    // if (!session.user.isSubscribed) { // أو user.isSubscribed حسب طريقتك
    //   return NextResponse.json({ success: false, error: 'عفواً، هذا المحتوى متاح للمشتركين فقط. 🔒' }, { status: 403 });
    // }
    
    // ==========================================
    // نهاية الـ Police Patch
    // ==========================================

    const { semester, grade, title, contentType } = await req.json();

    // 1. تحديد المسار اللي هندور فيه بناءً على طلب المعلم
    const semesterFolder = semester === 'الفصل الدراسي الأول' ? 'semester1' : 'semester2';
    const gradeFolder = gradeMap[grade] || 'other';
    const safeTitle = title.replace(/[^a-zA-Z0-9أ-ي\s-]/g, '').trim().replace(/\s+/g, '-');
    
    // تحديد اللاحقة بناءً على النوع القادم من الواجهة
    let typeSuffix = '';
    if (contentType === 'preparation') {
      typeSuffix = '-preparation';
    } else if (contentType === 'summary') {
      typeSuffix = '-summary';
    }

    // مسار ملف الـ JSON الأساسي
    let jsonFilePath = path.join(process.cwd(), 'src', 'content-bank', semesterFolder, gradeFolder, `${safeTitle}${typeSuffix}.json`);

    // 2. التأكد إن الدرس موجود فعلاً في البنك
    try {
      await fs.access(jsonFilePath);
    } catch (err) {
      // إضافة توافقية (Fallback): محاولة العثور على التحضير بدون لاحقة (-preparation) لو كان محفوظ بالنظام القديم
      if (contentType === 'preparation') {
        const fallbackPath = path.join(process.cwd(), 'src', 'content-bank', semesterFolder, gradeFolder, `${safeTitle}.json`);
        try {
          await fs.access(fallbackPath);
          jsonFilePath = fallbackPath; // إذا وجدنا الملف القديم، نحدث المسار ونكمل
        } catch (fallbackErr) {
          return NextResponse.json(
            { success: false, error: 'تعذر توليد الدرس نظراً لوجود ضغط كبير على السيرفر فى الوقت الحالي.. ⏳' }, 
            { status: 404 }
          );
        }
      } else {
        return NextResponse.json(
          { success: false, error: 'عذراً، هذا الدرس قيد التجهيز ولم يتم إضافته لبنك التحضيرات بعد. ⏳' }, 
          { status: 404 }
        );
      }
    }

    // 3. قراءة الملف وإرساله للواجهة
    const fileContent = await fs.readFile(jsonFilePath, 'utf8');
    const lessonData = JSON.parse(fileContent);

    return NextResponse.json({ success: true, data: lessonData });

  } catch (error) {
    console.error("Error retrieving lesson:", error);
    return NextResponse.json(
      { success: false, error: 'حدث خطأ في النظام أثناء استرجاع الدرس.' }, 
      { status: 500 }
    );
  }
}