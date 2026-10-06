import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import mongoose from 'mongoose';
import User from '@/models/User';
import { adminAuth } from '@/lib/firebase-Admin'; // ⚠️ عدل هذا المسار إذا كان ملف firebase-Admin في مكان مختلف

// دالة للاتصال بقاعدة البيانات لضمان الاتصال قبل فحص الصلاحيات
const connectDB = async () => {
  if (mongoose.connection.readyState >= 1) return;
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is missing in .env');
  await mongoose.connect(process.env.MONGODB_URI);
};

// أداة صغيرة لتحويل الأسماء العربي لإنجليزي عشان مسارات الفولدرات
const gradeMap = {
  "الصف الأول": "grade1", "الصف الثاني": "grade2", "الصف الثالث": "grade3",
  "الصف الرابع": "grade4", "الصف الخامس": "grade5", "الصف السادس": "grade6",
  "الصف السابع": "grade7", "الصف الثامن": "grade8", "الصف التاسع": "grade9",
  "الصف العاشر": "grade10", "الصف الحادي عشر": "grade11", "الصف الثاني عشر": "grade12"
};

export async function POST(req) {
  try {
    // --- 🛡️ بداية الجدار الأمني 🛡️ ---
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'غير مصرح: التوكن مفقود.' }, { status: 401 });
    }
    
    const token = authHeader.split('Bearer ')[1];
    let decodedToken;
    
    try {
      // التحقق الفعلي من صحة التوكن لاستخراج هوية المستخدم الموثوقة (Authentication)
      decodedToken = await adminAuth.verifyIdToken(token);
    } catch (error) {
      return NextResponse.json({ success: false, error: 'غير مصرح: التوكن غير صالح أو منتهي الصلاحية.' }, { status: 401 });
    }

    // الاتصال بـ MongoDB والتأكد من أن المستخدم يمتلك صلاحية المدير (Authorization)
    await connectDB();
    const userInDB = await User.findOne({ uid: decodedToken.uid });

    if (!userInDB || userInDB.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'ممنوع: لا تملك صلاحية المدير لإضافة الدروس.' }, { status: 403 });
    }
    // --- 🛡️ نهاية الجدار الأمني 🛡️ ---

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

    // (تم نقل إنشاء الفولدرات للخلفية لتجنب إعادة تشغيل السيرفر وقطع الاتصال)

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

    // 4. تجميع الدرس وحفظه كملف JSON في الخلفية (تكتيك Fire and Forget)
    const finalLessonData = { metadata, core, precomputed_ai };
    const typeSuffix = metadata.contentType === 'summary' ? 'summary' : 'preparation';
    const jsonFileName = `${safeTitle}-${typeSuffix}.json`;
    const jsonFilePath = path.join(jsonDir, jsonFileName);
    
    // الدالة الخلفية: تقوم بإنشاء الفولدرات وحفظ الملف بعيداً عن استجابة المتصفح
    const saveToDisk = async () => {
      try {
        await fs.mkdir(imagesDir, { recursive: true });
        await fs.mkdir(jsonDir, { recursive: true });
        await fs.writeFile(jsonFilePath, JSON.stringify(finalLessonData, null, 2), 'utf8');
        console.log("✅ تم حفظ الدرس فعلياً على السيرفر بصمت!");
      } catch (err) {
        console.error("❌ خطأ في الحفظ بالخلفية:", err);
      }
    };

    saveToDisk(); // نشغلها دون أن ننتظرها (بدون await)

    // نرسل الرد للمتصفح فوراً قبل أن يقوم السيرفر بأي رد فعل تجاه الملفات الجديدة
    return NextResponse.json({ success: true, message: 'تسلم إيدك يا ملك.. تم الحفظ بنجاح 🚀!' });  } catch (error) {
    console.error("Error saving lesson:", error);
    return NextResponse.json({ success: false, error: 'حصل خطأ أثناء حفظ الدرس.' }, { status: 500 });
  }
}