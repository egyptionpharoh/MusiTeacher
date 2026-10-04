import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

// نفس الأداة اللي استخدمناها في الحفظ عشان نوحد مسارات الفولدرات
const gradeMap = {
  "الصف الأول": "grade1", "الصف الثاني": "grade2", "الصف الثالث": "grade3",
  "الصف الرابع": "grade4", "الصف الخامس": "grade5", "الصف السادس": "grade6",
  "الصف السابع": "grade7", "الصف الثامن": "grade8", "الصف التاسع": "grade9",
  "الصف العاشر": "grade10", "الصف الحادي عشر": "grade11", "الصف الثاني عشر": "grade12"
};

export async function POST(req) {
  try {
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

    // 3. قراءة الملف وإرساله للواجهة (في أجزاء من الثانية - بدون أي ذكاء اصطناعي)
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