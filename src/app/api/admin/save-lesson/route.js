import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

// أداة صغيرة لتحويل الأسماء العربي لإنجليزي عشان مسارات الفولدرات
const gradeMap = {
  "الصف الأول": "grade1", "الصف الثاني": "grade2", "الصف الثالث": "grade3",
  "الصف الرابع": "grade4", "الصف الخامس": "grade5", "الصف السادس": "grade6",
  "الصف السابع": "grade7"
};

export async function POST(req) {
  try {
    const data = await req.json();
    const { metadata, core, precomputed_ai } = data;

    // 1. تحديد وتجهيز المسارات
    const semesterFolder = metadata.semester === 'الفصل الدراسي الأول' ? 'semester1' : 'semester2';
    const gradeFolder = gradeMap[metadata.grade] || 'other';
    
    // تنظيف اسم الدرس عشان ينفع يكون اسم ملف (بنشيل أي رموز غريبة)
    const safeTitle = metadata.title.replace(/[^a-zA-Z0-9أ-ي\s-]/g, '').trim().replace(/\s+/g, '-');
    
    // مسار حفظ الصور (في الـ public عشان تتعرض للمستخدم)
    const imagesDir = path.join(process.cwd(), 'public', 'images', 'lessons', semesterFolder, gradeFolder, safeTitle);
    
    // مسار حفظ ملف الـ JSON (في بنك التحضيرات)
    const jsonDir = path.join(process.cwd(), 'src', 'content-bank', semesterFolder, gradeFolder);

    // إنشاء الفولدرات لو مش موجودة
    await fs.mkdir(imagesDir, { recursive: true });
    await fs.mkdir(jsonDir, { recursive: true });

    // 2. دالة سحب الصور المنسوخة من النص وحفظها
    const processHtmlImages = async (htmlContent, sectionName) => {
      if (!htmlContent) return htmlContent;
      
      // التدوير على أي صورة Base64 جوه الكود
      const base64Regex = /<img[^>]+src="data:image\/([a-zA-Z]*);base64,([^"]+)"[^>]*>/g;
      let processedHtml = htmlContent;
      let match;
      let imageCounter = 1;

      // سحب الصور واحدة واحدة
      while ((match = base64Regex.exec(htmlContent)) !== null) {
        const extension = match[1] || 'png';
        const base64Data = match[2];
        const fileName = `${sectionName}-img-${imageCounter}.${extension}`;
        const filePath = path.join(imagesDir, fileName);
        
        // حفظ الصورة كملف فعلي على الجهاز
        await fs.writeFile(filePath, Buffer.from(base64Data, 'base64'));
        
        // استبدال كود الصورة الطويل بالرابط النضيف بتاعها
        const publicUrl = `/images/lessons/${semesterFolder}/${gradeFolder}/${safeTitle}/${fileName}`;
        processedHtml = processedHtml.replace(match[0], `<img src="${publicUrl}" alt="صورة توضيحية من الدرس" className="lesson-image my-4 rounded-xl shadow-md border border-gray-200" style="max-width: 100%; height: auto;" />`);
        
        imageCounter++;
      }
      return processedHtml;
    };

    const autoFormatText = (text) => {
      if (!text) return text;
      let formatted = text;

      // 1. تلوين وتكبير العناوين الرئيسية (الرؤوس المميزة اللي طلبتها)
      const headings = [
        'الاستراتيجيات', 
        'المصادر التعليمية', 
        'المفاهيم',
        'التهيئة / التمهيد / التعلم القبلي', // ضفتها احتياطي لضمان شمولية الدرس
        'إجراءات سير الدرس / اﻷنشطة التدريسية',
        'التقويم التكويني', 
        '•النشاط الأول:', 
        '•النشاط الثاني:',
        'التقويم الختامي'
      ];
      
      // ترتيب العناوين من الأطول للأقصر عشان نضمن إن مفيش عنوان يقطع التاني في المعالجة
      headings.sort((a, b) => b.length - a.length);

      headings.forEach(heading => {
        // عمل Escape للرموز الخاصة زي النقطة أو الأقواس عشان الـ Regex يشتغل صح
        const escapedHeading = heading.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        const regex = new RegExp(`(${escapedHeading})`, 'g');
        formatted = formatted.replace(regex, `<h3 class="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600 dark:from-cyan-400 dark:to-purple-400 mt-10 mb-4 border-b border-gray-200 dark:border-gray-700 pb-2">📌 $1</h3>`);
      });

      // 2. تحويل الاستراتيجيات لعلامات ملونة (Badges)
      formatted = formatted.replace(/\([^\)]*استراتيجية[^\)]*\)|\(الحوار والمناقشة\)|\(العرض التوضيحي\)|\(النمذجة\)|\(التعلم التعاوني\)|\(التكرار والممارسة\)|\(التعلم بالاكتشاف\)/g, match => `<span class="bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-cyan-300 px-2 py-1 rounded-lg text-sm font-bold border border-blue-200 dark:border-cyan-800 mx-1 shadow-sm">${match}</span>`);

      // 3. إبراز الترقيم والأسئلة (استبعدنا الأنشطة من هنا عشان اتعالجت فوق كعناوين رئيسية)
      formatted = formatted.replace(/(\d+_|\d+-|•|س\d+)/g, `<strong class="text-orange-600 dark:text-orange-400 font-black text-xl">$1</strong>`);

      return formatted;
    };

    // 3. (تم إيقاف دوال معالجة النصوص لأن البيانات أصبحت JSON مبرمج ونظيف)

    // 4. تجميع الدرس وحفظه كملف JSON (نحفظه كما جاء من المربع الآمن بالضبط)
    const finalLessonData = { metadata, core, precomputed_ai };
    const jsonFilePath = path.join(jsonDir, `${safeTitle}.json`);
    
    await fs.writeFile(jsonFilePath, JSON.stringify(finalLessonData, null, 2), 'utf8');

    return NextResponse.json({ success: true, message: 'تم حفظ الدرس والصور بنجاح!' });

  } catch (error) {
    console.error("Error saving lesson:", error);
    return NextResponse.json({ success: false, error: 'حصل خطأ أثناء حفظ الدرس.' }, { status: 500 });
  }
}