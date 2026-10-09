'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Sparkles, ArrowRight, RefreshCw, BookOpen, 
  Layers, FileText, Award, LayoutTemplate
} from 'lucide-react';
import AppHeader from '@/components/AppHeader';
import { useAuth } from '@/context/AuthContext';
import PricingModal from '@/components/PricingModal.jsx';

// 1. الداتا الحقيقية للمنهج
const semesterOneData = {
  "الصف الأول": ["النشيد الوطني", "العلامة الإيقاعية النوار والسكتة المقابلة لها", "الحدة والغلظة - السرعة والبطء", "اللعبة الشعبية (حبوه موه تدوري)", "المدرج الموسيقي ومفتاح صول", "تطبيقات على المدرج الموسيقي"],
  "الصف الثاني": ["النشيد الوطني", "سلم (دو) الكبير وإشارات اليد الدالة على الأثر النفسي", "تدريبات صوتية وغنائية", "العلامة الإيقاعية البلانش والسكتة المقابلة لها", "نشيد (أقسمت أحبك يا وطني)", "الشدة والخفوت"],
  "الصف الثالث": ["نشيد (موطني)", "الشكل الإيقاعي (طفاتيفي)", "الكريشيندو والديمنويندو", "التيمينة", "آلة الإكسيلوفون", "عزف مقطوعة موسيقية على آلة الإكسيلوفون"],
  "الصف الرابع": ["تدريبات صوتية بالتظليلات", "نشيد (علم بلادي)", "الشكل الإيقاعي (طفاتي)", "نشيد (سلامتي)", "آلة الأورج", "عزف مقطوعة موسيقية على آلة الأورج"],
  "الصف الخامس": ["نشيد (نهضة متجددة)", "الميزان الرباعي", "العلامة الإيقاعية (الروند) والسكتة المقابلة لها", "آلة الأوكورديون", "قراءة إيقاعية وصولفيج غنائي", "عزف مقطوعة موسيقية على آلة الأكورديون"],
  "الصف السادس": ["الأزمنة الأساسية وتقسيماتها", "نشيد (عُمان عظيمة بشعبها )", "التمييز السمعي", "الشكل الإيقاعي (طفافي)", "قراءة إيقاعية وصولفيج غنائي", "عزف مقطوعة موسيقية"],
  "الصف السابع": ["نشيد (وَحْيُ الإِلْهَامِ).", "الرِّباط الزَّمَنِي والنُّقْطَة الزَّمَنِيَّة.", "الشَّكْلان الإِيقاعيَّان (تافي&تافا).", "شَخْصيَّة موسيقيَّة عالميَّة (موتسارت).", "قِراءَة إِيقاعيَّة وصولفيج غِنائي.", "عَزْف مَقْطوعَة موسيقيَّة."],
"الصف الثامن": [
    "فَنَّا (البَرْعة) و(طَبْل النِّساء).", 
    "نشيد من فن البرعة", 
    "نشيد من فن النساء", 
    "ابتكارات لحنية.", 
    "أبعاد سلَّم (دو) الكبير.", 
    "قراءة إيقاعية وصولفيج غنائي.", 
    "عزف مقطوعة موسيقية."
  ],
"الصف التاسع": [ "حل اسئلة كتاب الانشطة ص9",
  "حل اسئلة كتاب الانشطة ص10",
  "حل اسئلة كتاب الانشطة ص 11",
  "حل اسئلة كتاب الانشطة ص15",
  "حل اسئلة كتاب الانشطة ص16",
  "حل اسئلة كتاب الانشطة ص17",  "حل اسئلة كتاب الانشطة ص21",
  "حل اسئلة كتاب الانشطة ص22",  "حل اسئلة كتاب الانشطة ص23"
],
"الصف العاشر": [
  "حل اسئلة كتاب الانشطة ص9",
  "حل اسئلة كتاب الانشطة ص11",
  "حل اسئلة كتاب الانشطة ص 14",
  "حل اسئلة كتاب الانشطة ص16",
  "حل اسئلة كتاب الانشطة ص18",
  "حل اسئلة كتاب الانشطة ص20",
  "حل اسئلة كتاب الانشطة ص22",
  "حل اسئلة كتاب الانشطة ص24",
  "حل اسئلة كتاب الانشطة ص26"
],
};

const semesterTwoData = {
  "الصف الأول": ["الصوت والسكوت", "الآلات الإيقاعية", "الآلات الإيقاعية العمانية", "مدرستي العمانية", "عزف إيقاعي", "لعبة شعبية (الصياد)"],
  "الصف الثاني": ["الصوت البشري", "أشكال الآلات الموسيقية", "الصوت الموسيقي والضوضاء", "لعبة شعبية (الخاتم)"],
  "الصف الثالث": ["العلامة الإيقاعية (الروش)", "لعبة شعبية", "الأداء الفردي والجماعي", "آلة الإكسيلوفون (2)", "عزف مقطوعة موسيقية (2)"],
  "الصف الرابع": ["الميزان الثنائي والثلاثي", "قراءة إيقاعية وغناء صولفيجي", "الفنون الشعبية العمانية (فن الرزحة وفن العازي)", "عزف مقطوعة موسيقية على آلة الأورج (2)"],
  "الصف الخامس": ["الخطوط الإضافية", "الوصلة (Legato) والمتقطع (Staccato)", "الفنون الشعبية العمانية (فن أبو زلف وفن الميدان)", "آلة الميلوديكا", "قراءة إيقاعية وغناء صولفيجي", "عزف مقطوعة موسيقية على آلة الميلوديكا"],
  "الصف السادس": ["السلالم الموسيقية", "سلم فا الكبير", "الفنون الشعبية العمانية (فن الشوباني وفن الربوبة)", "عزف مقطوعة موسيقية", "قراءة إيقاعية وغناء صولفيجي (2)", "عزف مقطوعة موسيقية (2)"],
  "الصف السابع": ["الميزان الموسيقي", "الفنون الشعبية العمانية", "آلات النفخ الخشبية", "عزف مقطوعة موسيقية"],
  "الصف الثامن": ["فنون البحر", "أناشيد فنون البحر", "القوالب الموسيقية", "عزف الآلات الموسيقية", "عزف مقطوعة (شوباني)", "تقييم الأداء"],
  "الصف التاسع": ["فنون البادية", "أناشيد فنون البادية", "القوالب الموسيقية الآلية", "عزف الآلات الموسيقية", "عزف مقطوعة (طارق)", "تقييم الأداء"],
  "الصف العاشر": ["نشيد (الأرض)", "المسافات الموسيقية", "قراءة إيقاعية وغناء صولفيجي", "آلات النفخ النحاسية", "عزف مقطوعة عالمية", "تقييم الأداء"]
};

const syllabusData = {
  "الفصل الدراسي الأول": semesterOneData,
  "الفصل الدراسي الثاني": semesterTwoData
};

// 2. دالة معالجة الصور الاحترافية (اللي بتستبدل [صورة_X] بعنصر img)
const renderContentWithImages = (text, screenshots = []) => {
  if (!text) return '';
  
  // معالجة متقدمة للنصوص والمصفوفات لتجنب الأخطاء (مقتبسة من بنك التحضيرات)
  let processedText = text;
  if (Array.isArray(processedText)) {
    processedText = processedText.join('<br>');
  } else if (typeof processedText !== 'string') {
    processedText = String(processedText);
  }

  const imageRegex = /\[صورة_(\d+)\]/g;
  
  processedText = processedText.replace(imageRegex, (match, imageNumber) => {
    const imgIndex = parseInt(imageNumber, 10) - 1;
    if (screenshots && screenshots[imgIndex]) {
      // تصميم احترافي متجاوب للصورة مع تأثير عند المرور
      return `<div class="my-5 flex justify-center"><img src="${screenshots[imgIndex]}" alt="شرح توضيحي ${imageNumber}" class="max-w-full md:max-w-2xl h-auto object-contain rounded-2xl shadow-lg border border-white/10 hover:scale-[1.02] transition-transform duration-300" /></div>`;
    }
    return match; // لو الصورة مش موجودة، يسيب الكلمة زي ما هي
  });

  return processedText;
};

// 3. دالة تفكيك محتوى الملخص ذكيًا على مستوى الـ Frontend بدون تعديل البيانات
const parseSummaryContent = (summaryText) => {
  if (!summaryText) return { parsed: false, raw: summaryText };

  const hasLyricsHeader = summaryText.includes('كلمات النشيد');
  const hasMeaningsHeader = summaryText.includes('معاني الكلمات');

  // أمان: لو النص مافيهوش العناوين دي، نعرض النص الأصلي زي ما هو
  if (!hasLyricsHeader && !hasMeaningsHeader) {
    return { parsed: false, raw: summaryText };
  }

  let overviewText = summaryText;
  let lyricsRaw = '';
  let meaningsRaw = '';

  // استخراج الهدف والملخص العام
  if (hasLyricsHeader) {
    const parts = overviewText.split(/كلمات النشيد:?/);
    overviewText = parts[0] || '';
    lyricsRaw = parts[1] || '';
  }

  // فصل كلمات النشيد عن معاني الكلمات
  if (hasMeaningsHeader) {
    if (lyricsRaw) {
      const parts = lyricsRaw.split(/معاني الكلمات:?/);
      lyricsRaw = parts[0] || '';
      meaningsRaw = parts[1] || '';
    } else {
      const parts = overviewText.split(/معاني الكلمات:?/);
      overviewText = parts[0] || '';
      meaningsRaw = parts[1] || '';
    }
  }

  // تفكيك أبيات النشيد (الصدر والعجز)
  const lyricsLines = lyricsRaw
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const sides = line.split('|');
      if (sides.length === 2) {
        return { firstSide: sides[0].trim(), secondSide: sides[1].trim() };
      }
      return { fullLine: line };
    });

  // تفكيك معاني الكلمات
  const meaningsList = meaningsRaw
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const separatorIndex = line.indexOf(':');
      if (separatorIndex !== -1) {
        return {
          word: line.substring(0, separatorIndex).trim(),
          meaning: line.substring(separatorIndex + 1).trim()
        };
      }
      return { word: '', meaning: line };
    });

  return {
    parsed: true,
    overview: overviewText.trim(),
    lyrics: lyricsLines,
    meanings: meaningsList
  };
};

export default function SummariesPage() {
  const router = useRouter();
  
  // الإضافة دي هي اللي كانت ناقصة عشان الكود يشوف الـ user
  const { user } = useAuth();

  // States
  const [semester, setSemester] = useState('الفصل الدراسي الأول');
  const [grade, setGrade] = useState('');
  const [lessonTitle, setLessonTitle] = useState('');
  const [lessonData, setLessonData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showAuthToast, setShowAuthToast] = useState(false); // 🔥 Toast state للمستخدم غير المسجل

  // === حالات التعديل والطباعة ===
  const [isEditing, setIsEditing] = useState(false);
  const [editSummary, setEditSummary] = useState("");
  const [editAssessment, setEditAssessment] = useState("");

  // دوال التحكم في التعديل
  const handleEditClick = () => {
    setEditSummary(lessonData?.summary || "");
    setEditAssessment(lessonData?.assessment || "");
    setIsEditing(true);
  };

  const handleSaveEdit = () => {
    setLessonData({
      ...lessonData,
      summary: editSummary,
      assessment: editAssessment
    });
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
  };

  // === دالة الطباعة المخصصة ===
  const handlePrint = () => {
    if (!lessonData) return;
    
    const printWindow = window.open('', '_blank');
    const summaryRaw = lessonData.summary || 'لا يوجد ملخص متاح';
    const parsedSummary = parseSummaryContent(summaryRaw);
    
    let contentHtml = '';
    if (!parsedSummary.parsed) {
      contentHtml = `<div class="section"><h3>📌 موضوع الدرس</h3><div class="content-body">${renderContentWithImages(summaryRaw.replace(/\n/g, '<br>'), lessonData.screenshots || [])}</div></div>`;
    } else {
      let overviewHtml = parsedSummary.overview ? `<div class="section"><h3>📌 موضوع الدرس</h3><div class="content-body">${renderContentWithImages(parsedSummary.overview.replace(/\n/g, '<br>'), lessonData.screenshots || [])}</div></div>` : '';
      
      let lyricsHtml = '';
      if (parsedSummary.lyrics && parsedSummary.lyrics.length > 0) {
        lyricsHtml = `<div class="section"><h3>📖 كلمات النشيد</h3>` + 
          parsedSummary.lyrics.map(item => {
            if (item.firstSide && item.secondSide) {
              return `<p style="text-align: center; font-weight: bold; font-size: 22px;">${item.firstSide} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ${item.secondSide}</p>`;
            }
            return `<p style="text-align: center; font-weight: bold; font-size: 22px;">${item.fullLine}</p>`;
          }).join('') + `</div>`;
      }
      
      let meaningsHtml = '';
      if (parsedSummary.meanings && parsedSummary.meanings.length > 0) {
        meaningsHtml = `<div class="section"><h3>✨ معاني الكلمات</h3><table style="width: 100%; border-collapse: collapse; margin-top: 15px; border: 1px solid #ccc;">` +
          `<thead><tr style="background-color: #f9f9f9;"><th style="border: 1px solid #ccc; padding: 10px; width: 30%;">المفردة / الكلمة</th><th style="border: 1px solid #ccc; padding: 10px;">المعنى والشرح</th></tr></thead><tbody>` +
          parsedSummary.meanings.map(m => `<tr><td style="border: 1px solid #ccc; padding: 10px; font-weight: bold; text-align: center;">${m.word}</td><td style="border: 1px solid #ccc; padding: 10px;">${m.meaning}</td></tr>`).join('') +
          `</tbody></table></div>`;
      }
      
      contentHtml = overviewHtml + lyricsHtml + meaningsHtml;
    }
    
    const assessmentHtml = `<div class="section" style="margin-top: 30px;"><h3>🏅 التقويم الختامي</h3><div class="content-body">${renderContentWithImages((lessonData.assessment || 'لا يوجد تقويم متاح').replace(/\n/g, '<br>'), lessonData.screenshots || [])}</div></div>`;

    printWindow.document.write(`
      <html dir="rtl" lang="ar">
        <head>
          <title>${lessonTitle} - ${grade}</title>
          <link href="https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Cairo:wght@600;700&display=swap" rel="stylesheet">
          <style>
            /* إجبار المتصفح على طباعة الألوان والخلفيات بدقة */
            * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            
            body { font-family: 'Amiri', serif; padding: 0; margin: 0; color: #1e293b; background: #fff; }
            @page { margin: 1cm; } 
            
            /* إطار احترافي، ألوان متناسقة، وخلفية موسيقية شفافة جداً */
            .page-container { 
              border: 3px solid #0d9488; 
              border-radius: 15px;
              padding: 15px; 
              position: relative;
              background-color: #f8fafc;
              background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="%2394a3b8" stroke-width="0.8" opacity="0.1"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>');
              background-repeat: space;
              box-shadow: inset 0 0 0 4px #ccfbf1;
            }

            .modern-banner { display: flex; justify-content: space-between; align-items: center; background: linear-gradient(135deg, #1e3a8a, #3b82f6, #1e40af); color: white; padding: 20px 25px; border-radius: 16px; margin-bottom: 25px; box-shadow: 0 10px 20px rgba(37, 99, 235, 0.2), inset 0 2px 4px rgba(255, 255, 255, 0.3); border: 2px solid #60a5fa; position: relative; overflow: hidden; page-break-inside: avoid; }
            .modern-banner::before { content: '♫ ♪'; position: absolute; top: -5px; right: 15px; font-size: 60px; color: rgba(255, 255, 255, 0.08); transform: rotate(15deg); pointer-events: none; }
            .modern-banner::after { content: '𝄞'; position: absolute; bottom: -15px; left: 20px; font-size: 80px; color: rgba(255, 255, 255, 0.08); transform: rotate(-10deg); pointer-events: none; }
            .banner-side { font-family: 'Cairo', sans-serif; font-size: 15px; font-weight: 700; line-height: 1.6; text-shadow: 1px 1px 2px rgba(0,0,0,0.3); z-index: 1; }
            .banner-center { text-align: center; z-index: 1; flex: 1; padding: 0 15px; }
            .banner-center h1 { font-family: 'Cairo', sans-serif; color: #ffffff; margin: 0; font-size: 26px; font-weight: 900; text-shadow: 2px 2px 4px rgba(0,0,0,0.4); }
            .banner-center h2 { font-family: 'Cairo', sans-serif; color: #bfdbfe; margin: 0 auto 10px auto; font-size: 15px; font-weight: 700; background: rgba(0, 0, 0, 0.25); display: inline-block; padding: 5px 20px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.15); box-shadow: 0 2px 4px rgba(0,0,0,0.2); }            h3 { font-family: 'Cairo', sans-serif; color: #0f766e; margin-bottom: 10px; font-size: 18px; border-bottom: 2px solid #99f6e4; padding-bottom: 5px; page-break-after: avoid; display: flex; align-items: center; gap: 8px; }
            
            .content-body { white-space: pre-wrap; line-height: 1.6; color: #334155; font-size: 18px; font-weight: 500; }
            p { margin: 0 0 8px 0; }
            
            /* إزالة منع الانقسام للسماح بانسياب النص طبيعياً بين الصفحات ومنع الفراغات */
            .section { margin-bottom: 15px; background: #ffffff; padding: 15px; border-radius: 12px; border: 1px solid #e2e8f0; box-shadow: 0 2px 4px rgba(0,0,0,0.03); }
            
            img { max-width: 100%; max-height: 300px; object-fit: contain; border-radius: 10px; margin: 10px auto; border: 2px solid #e2e8f0; display: block; page-break-inside: avoid; }
            
            /* الفوتر الآن يظهر كعنصر مستقل أسفل الإطار تماماً */
            .print-footer { margin-top: 30px; padding: 10px 20px; display: flex; align-items: center; justify-content: space-between; font-family: 'Cairo', sans-serif; background: transparent; page-break-inside: avoid; }
            .footer-text { margin: 0; font-size: 12px; color: #0f766e; font-weight: 700; }
            .qr-container img { width: 45px; height: 45px; object-fit: contain; border: none; margin: 0; }          </style>        </head>
        <body>
          <div class="page-container">
            <div class="modern-banner">
              <div class="banner-side" style="text-align: right;">
                سلطنة عُمان<br>
                وزارة التعليم
              </div>
              <div class="banner-center">
                <h2>${grade} - ${semester}</h2>
                <h1>${lessonTitle}</h1>
              </div>
              <div class="banner-side" style="text-align: left;">
                ملخص درس اليوم<br>
                المادة الموسيقية
              </div>
            </div>
            
            ${contentHtml}
            ${assessmentHtml}
          </div>
          
          <div class="print-footer">
            <p class="footer-text">مع أطيب الأمنيات بالتوفيق #MusiTeacher</p>
            <div class="qr-container">
              <img src="/qrcode.png" onerror="this.style.display='none';" alt="" />
            </div>
          </div>

          <script>
            window.onload = () => { setTimeout(() => { window.print(); }, 800); };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };
  // ==========================
  // تحديث الخيارات
  const availableGrades = Object.keys(syllabusData[semester] || {});
  const availableLessons = (semester && grade) ? syllabusData[semester][grade] : [];

  // تصفير الدرس عند تغيير الصف أو الفصل
  useEffect(() => {
    setLessonTitle('');
    setLessonData(null);
  }, [semester, grade]);

  // تصفير البيانات المعروضة فوراً لو المستخدم غير الدرس عشان يظهرله زرار التوليد من تاني
  useEffect(() => {
    setLessonData(null);
  }, [lessonTitle]);

  // دالة التوليد اليدوية المرتبطة بزر الضغط
  const handleGenerateLesson = async () => {
    if (!semester || !grade || !lessonTitle) return;

    // 🔥 1. حماية استباقية: لو المستخدم مش مسجل دخول، نوقف الطلب ونظهر التوست
    if (!user) {
      setShowAuthToast(true);
      setTimeout(() => setShowAuthToast(false), 5000);
      return;
    }

    setIsLoading(true);
    try {
      // 🔥 2. جلب التوكن الخاص بالمستخدم للعبور من حماية الميدلوير
      let token = '';
      if (user && typeof user.getIdToken === 'function') {
        token = await user.getIdToken(); // إذا كنت تستخدم Firebase
      } else {
        token = localStorage.getItem('token') || user?.token || ''; // للأنظمة المخصصة
      }

      // 🔥 3. إرسال الطلب مع إضافة التوكن في الـ Headers
      const res = await fetch('/api/bank/get-lesson', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ semester, grade, title: lessonTitle, contentType: 'summary' })
      });
      
      // 🔥 1. التقاط حالة الرفض لغير المسجلين (عن طريق كود 401)
      if (res.status === 401) {
        setIsLoading(false);
        setShowAuthToast(true);
        setTimeout(() => setShowAuthToast(false), 5000);
        return; // بنوقف التنفيذ هنا عشان ما يكملش ويدخل في منطق الـ Premium
      }

      const data = await res.json();
      
      // 🔥 2. التقاط رسالة الرفض لغير المسجلين (لو راجعة جوا الـ data.message)
      if (data && !data.success && data.message && (data.message.includes('تسجيل الدخول') || data.message.includes('غير مسجل'))) {
        setIsLoading(false);
        setShowAuthToast(true);
        setTimeout(() => setShowAuthToast(false), 5000);
        return;
      }

      // 🚀 هنا النظام القديم بيكمل زي ما هو بدون أي تغيير للمشتركين أو غير المشتركين (Premium)
      await new Promise((resolve) => setTimeout(resolve, 4500));

      if (data && data.success) {
        const coreData = data.data?.core || data.data;
        const extractedScreenshots = data.data?.metadata?.lessonScreenshots || data.data?.screenshots || [];
        setLessonData({ ...coreData, screenshots: extractedScreenshots }); 
      } else {
        // عرض أي رسايل تانية بتاعت الترقية لو موجودة في نظامك
        if (data && data.message && typeof window !== 'undefined' && !data.message.includes('تسجيل الدخول')) {
            // السلوك القديم محفوظ هنا لأي رسائل أخرى كـ Premium
        }
        setLessonData(null);
      }
    } catch (error) {
      console.error("Error fetching lesson:", error);
      setLessonData(null);
    } finally {
      setIsLoading(false);
    }
  };
  return (
    <div className="min-h-screen bg-slate-950 p-4 md:p-8 relative selection:bg-emerald-500/30 text-stone-900 dark:text-white transition-all duration-500 font-cairo dir-rtl">
      
      {/* 🔥 نظام Toast الأنيق والمهتز للمستخدم غير المسجل */}
      <style>{`
        @keyframes shake-toast {
          0%, 100% { transform: translate(-50%, 0) rotate(0deg); }
          20% { transform: translate(calc(-50% - 8px), 0) rotate(-2deg); }
          40% { transform: translate(calc(-50% + 8px), 0) rotate(2deg); }
          60% { transform: translate(calc(-50% - 8px), 0) rotate(-2deg); }
          80% { transform: translate(calc(-50% + 8px), 0) rotate(2deg); }
        }
        .animate-shake-toast {
          animation: shake-toast 0.6s cubic-bezier(0.36, 0.07, 0.19, 0.97) both;
        }
      `}</style>
      
      {showAuthToast && (
        <div className="fixed top-8 left-1/2 z-[9999] animate-shake-toast px-6 py-5 bg-slate-900/95 border-2 border-rose-500/50 rounded-2xl shadow-[0_15px_40px_rgba(244,63,94,0.3)] backdrop-blur-xl flex items-center gap-4 w-[90%] md:w-auto max-w-lg select-none">
          <div className="bg-rose-500/20 p-3 rounded-full flex-shrink-0 border border-rose-500/30">
            <span className="text-2xl block drop-shadow-md">🔒</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-rose-400 font-black text-lg md:text-xl">عذراً، لا يمكنك التوليد الآن!</span>
            <span className="text-slate-300 text-sm md:text-base leading-relaxed font-medium">
              يرجى الدخول إلى <strong className="text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded border border-emerald-400/20">"الإعدادات"</strong> من الصفحة الرئيسية وتسجيل الدخول أولاً.
            </span>
          </div>
        </div>
      )}

      {/* الهيدر العلوي لو موجود */}
      <AppHeader />

      {/* زر العودة */}
      <button 
        onClick={() => router.push('/dashboard/tools')}
        className="absolute top-24 left-6 md:top-28 md:left-8 z-50 flex items-center gap-2 px-5 py-2.5 bg-white/10 border border-white/20 rounded-full backdrop-blur-xl text-white hover:bg-white/20 transition-all duration-300 shadow-lg group print:hidden"
      >
        <ArrowRight size={18} className="group-hover:-translate-x-1 transition-transform duration-300" />
        <span className="text-sm font-bold tracking-wide">العودة للأدوات</span>
      </button>

      {/* خلفية جمالية */}
      <div className="absolute top-[-10%] left-[-10%] w-[45%] h-[45%] rounded-full bg-emerald-600/15 blur-[140px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[45%] h-[45%] rounded-full bg-teal-600/15 blur-[140px] pointer-events-none"></div>

      <div className="max-w-6xl mx-auto mt-24 md:mt-32 z-10 relative">
        
        {/* هيدر الصفحة */}
        <div className="text-center mb-10 print:hidden">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 mb-4 backdrop-blur-md">
            <Sparkles size={18} className="animate-pulse" />
            <span className="text-xs md:text-sm font-bold tracking-wide">عقلك المدبر لتلخيص المناهج</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-l from-emerald-400 via-teal-300 to-cyan-500 tracking-tight mb-3 drop-shadow-sm">
            مصنع الملخصات
          </h1>
          <p className="text-gray-400 text-sm md:text-base max-w-xl mx-auto font-light">
            اختر الفصل الدراسي والصف والدرس ليتم توليد ملخص للدرس بالذكاء الاصطناعي بسرعة فائقة لعرضه على السبورة جاهز للقراءة أو الطباعة فوراً.
          </p>
        </div>

        {/* لوحة التحكم والاختيارات */}
        <div className="bg-slate-900/60 border border-white/10 backdrop-blur-2xl rounded-3xl p-6 md:p-8 shadow-2xl mb-8 print:hidden">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* اختيار الفصل الدراسي */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                <Layers size={15} />
                اختر الفصل الدراسي
              </label>
              <select 
                value={semester}
                onChange={(e) => setSemester(e.target.value)}
                className="w-full bg-slate-800/80 border border-slate-700 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-500 transition-colors"
              >
                <option value="الفصل الدراسي الأول">الفصل الدراسي الأول</option>
                <option value="الفصل الدراسي الثاني">الفصل الدراسي الثاني</option>
              </select>
            </div>

            {/* اختيار الصف */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                <BookOpen size={15} />
                اختر الصف الدراسي
              </label>
              <select 
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
                className="w-full bg-slate-800/80 border border-slate-700 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-500 transition-colors"
              >
                <option value="">-- اختر الصف --</option>
                {availableGrades.map(g => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>

            {/* اختيار الدرس */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                <FileText size={15} />
                اختر الدرس المطلوب
              </label>
              <select 
                value={lessonTitle}
                onChange={(e) => setLessonTitle(e.target.value)}
                disabled={!grade}
                className="w-full bg-slate-800/80 border border-slate-700 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-500 transition-colors disabled:opacity-50"
              >
                <option value="">-- اختر الدرس --</option>
                {availableLessons.map((lesson, idx) => (
                  <option key={idx} value={lesson}>{lesson}</option>
                ))}
              </select>
            </div>

          </div>
        </div>

        {/* زر التوليد ثلاثي الأبعاد (يظهر فقط بعد اختيار الدرس وقبل التوليد) */}
        {lessonTitle && !lessonData && !isLoading && (
          <div className="flex justify-center mb-10 animate-in fade-in zoom-in duration-300 print:hidden">
            <button
              onClick={handleGenerateLesson}
              className="group relative px-8 py-4 bg-gradient-to-b from-emerald-500 to-emerald-700 rounded-2xl text-white font-bold text-xl shadow-[0_8px_0_0_#047857,0_15px_20px_rgba(0,0,0,0.3)] active:shadow-[0_0px_0_0_#047857,0_0px_0px_rgba(0,0,0,0)] active:translate-y-[8px] transition-all duration-150 flex items-center gap-3 overflow-hidden border border-emerald-400/50"
            >
              <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]" />
              <Sparkles size={26} className="animate-pulse text-emerald-200" />
              <span className="drop-shadow-md">اضغط لتوليد التلخيص</span>
            </button>
          </div>
        )}

        {/* حالة التحميل (بدون التوست المكرر) */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-20 bg-slate-900/40 rounded-3xl border border-emerald-500/20 backdrop-blur-md shadow-xl animate-in fade-in zoom-in duration-300">
            <div className="relative flex items-center justify-center mb-4">
              <div className="absolute inset-0 rounded-full bg-emerald-500/20 blur-xl animate-pulse"></div>
              <RefreshCw size={44} className="animate-spin text-emerald-400 relative z-10" />
            </div>
<p className="text-emerald-300 font-bold text-lg">جاري توليد الملخص بالذكاء الاصطناعي بواسطة MusiTeacher...</p>            <p className="text-gray-400 text-xs mt-1">يرجى الانتظار لحظات لإنهاء تجهيز المحتوى</p>
          </div>
        )}
        {/* عرض نتائج الملخص */}
        {lessonData && !isLoading && (
          <div 
            onContextMenu={(e) => e.preventDefault()}
            onCopy={(e) => e.preventDefault()}
            onCut={(e) => e.preventDefault()}
            className="bg-slate-900/80 border border-emerald-500/30 rounded-3xl p-6 md:p-8 backdrop-blur-2xl shadow-2xl relative overflow-hidden animate-in fade-in slide-in-from-bottom-5 duration-500 select-none"
          >
            {/* طبقة حماية زجاجية شفافة فوق منطقة ملخص الدرس */}
            <div className="absolute inset-0 pointer-events-none bg-slate-900/10 backdrop-blur-[0.3px] border border-emerald-500/10 rounded-3xl z-20" />
            
            {/* عنوان الدرس (متوسط في أعلى الصفحة مع تباعد متناسق) */}           <div className="flex flex-col items-center justify-center text-center border-b border-white/10 pb-3 mb-4">
              <span className="text-xs md:text-sm font-bold text-emerald-400 tracking-wider block mb-1">
                {grade} • {semester}
              </span>
              <h2 className="text-2xl md:text-4xl font-black text-white tracking-tight">
                {lessonTitle}
              </h2>
            </div>

            {/* تفاصيل الملخص للسبورة أو واجهة التعديل */}
            <div className="flex flex-col gap-4">
              
              {isEditing ? (
                /* واجهة التعديل */
                <div className="space-y-6">
                  <div className="bg-slate-900/90 border border-emerald-500/50 rounded-2xl p-6 shadow-lg">
                    <label className="text-emerald-400 font-bold text-lg mb-2 block">موضوع الدرس (أو الملخص):</label>
                    <textarea
                      value={editSummary}
                      onChange={(e) => setEditSummary(e.target.value)}
                      className="w-full h-64 bg-slate-800/80 border border-slate-700 hover:border-emerald-500/50 rounded-xl p-4 text-white text-lg leading-loose focus:outline-none focus:border-emerald-400 focus:shadow-[0_0_15px_rgba(52,211,153,0.2)] transition-all resize-y font-['Amiri',serif]"
                      dir="rtl"
                    />
                  </div>
                  
                  <div className="bg-slate-900/90 border border-cyan-500/50 rounded-2xl p-6 shadow-lg">
                    <label className="text-cyan-400 font-bold text-lg mb-2 block">التقويم الختامي:</label>
                    <textarea
                      value={editAssessment}
                      onChange={(e) => setEditAssessment(e.target.value)}
                      className="w-full h-40 bg-slate-800/80 border border-slate-700 hover:border-cyan-500/50 rounded-xl p-4 text-white text-lg leading-loose focus:outline-none focus:border-cyan-400 focus:shadow-[0_0_15px_rgba(34,211,238,0.2)] transition-all resize-y font-['Amiri',serif]"
                      dir="rtl"
                    />
                  </div>

                  <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4 border-t border-white/10">
                    <button
                      onClick={handleSaveEdit}
                      className="flex items-center justify-center gap-2 w-full sm:w-auto px-6 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-base font-bold shadow-[0_0_15px_rgba(5,150,105,0.3)] transition-all transform hover:-translate-y-0.5"
                    >
                      <Sparkles size={20} />
                      <span>حفظ التعديل</span>
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      className="flex items-center justify-center gap-2 w-full sm:w-auto px-6 py-3.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-base font-bold shadow-lg transition-all"
                    >
                      <span className="font-sans">✕</span>
                      <span>إلغاء</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* واجهة العرض الطبيعية */
                <>
                  {/* كارت ملخص الدرس المقسّم بصرّيًا */}
                  {(() => {
                const summaryRaw = lessonData.summary || 'لا يوجد ملخص متاح';
                const parsedSummary = parseSummaryContent(summaryRaw);

                if (!parsedSummary.parsed) {
                  // العرض الاحتياطي في حال عدم إمكانية التفكيك
                  return (
                    <div className="bg-slate-900/90 border border-emerald-500/30 border-r-4 border-r-emerald-500 rounded-2xl p-6 md:p-8 backdrop-blur-sm shadow-lg">
                      <h3 className="text-emerald-400 font-bold text-xl md:text-2xl mb-4 flex items-center gap-2.5">
                        <FileText size={26} />
                        موضوع الدرس
                      </h3>
                      <div 
                        className="text-slate-100 leading-loose text-xl md:text-2xl font-medium prose prose-invert prose-emerald max-w-none font-['Amiri',serif]"
                        dangerouslySetInnerHTML={{ 
                          __html: renderContentWithImages(
                            summaryRaw.replace(/\n/g, '<br>'), 
                            lessonData.screenshots || []
                          ) 
                        }}
                      />
                    </div>
                  );
                }

                return (
                  <div className="space-y-6">
                    {/* 1. قسم الهدف/الملخص العام */}
                    {parsedSummary.overview && (
                      <div className="bg-slate-900/90 border border-emerald-500/30 border-r-4 border-r-emerald-500 rounded-2xl p-6 md:p-8 shadow-lg">
                        <h3 className="text-emerald-400 font-bold text-xl md:text-2xl mb-3 flex items-center gap-2.5">
                          <FileText size={26} className="text-emerald-400" />
                          موضوع الدرس:                        </h3>
                        <div 
                          className="text-slate-100 leading-loose text-xl md:text-2xl font-medium font-['Amiri',serif]"
                          dangerouslySetInnerHTML={{ 
                            __html: renderContentWithImages(
                              parsedSummary.overview.replace(/\n/g, '<br>'), 
                              lessonData.screenshots || []
                            ) 
                          }}
                        />
                      </div>
                    )}
                    {/* 2. قسم كلمات النشيد (تصميم Glass Classroom بخط Amiri) */}
                    {parsedSummary.lyrics && parsedSummary.lyrics.length > 0 && (
                      <div className="bg-slate-900/50 dark:bg-slate-900/60 backdrop-blur-xl border border-teal-500/30 rounded-2xl p-5 md:p-7 shadow-[0_0_25px_-5px_rgba(20,184,166,0.15)] hover:shadow-[0_12px_35px_-5px_rgba(20,184,166,0.25)] hover:-translate-y-1 hover:border-teal-400/50 transition-all duration-300 relative overflow-hidden group">
                        <h3 className="text-teal-300 dark:text-teal-300 font-bold text-xl md:text-2xl mb-5 flex items-center gap-2.5 border-b border-white/10 pb-3">
                          <BookOpen size={3} className="text-teal-400" />
                          كلمات النشيد
                        </h3>
                        <div className="flex flex-col gap-1.5 md:gap-2 dir-rtl max-w-5xl mx-auto w-full">
                          {parsedSummary.lyrics.map((item, idx) => (
                            <div key={idx} className="bg-slate-800/60 dark:bg-slate-800/70 border border-slate-500/40 rounded-xl py-3 px-4 md:py-4 md:px-8 flex flex-col md:flex-row items-center justify-center gap-6 md:gap-16 shadow-lg hover:bg-slate-700/60 transition-colors">
                              {item.firstSide && item.secondSide ? (
                                <>
                                  {/* الشطر الأول - محاذاة للداخل وتكبير الخط */}
                                  <span className="text-white font-bold text-2xl md:text-4xl w-full md:w-1/2 text-center md:text-left leading-relaxed font-['Amiri',serif] drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] tracking-wide">
  {item.firstSide}
</span>
                                  {/* الشطر الثاني - محاذاة للداخل وتكبير الخط */}
                                  <span className="text-white font-bold text-2xl md:text-4xl w-full md:w-1/2 text-center md:text-right leading-relaxed font-['Amiri',serif] drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] tracking-wide">
  {item.secondSide}
</span>
                                </>
                              ) : (
                                <span className="text-slate-50 font-bold text-2xl md:text-4xl w-full text-center font-['Amiri',serif] drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                                  {item.fullLine}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 3. قسم معاني الكلمات (جدول واحد مقسم داخليًا لتوفير المساحة) */}
                    {parsedSummary.meanings && parsedSummary.meanings.length > 0 && (
                      <div className="bg-slate-900/80 dark:bg-slate-900/80 border border-cyan-500/30 border-r-4 border-r-cyan-400 rounded-2xl p-5 md:p-6 shadow-lg">
                        <h3 className="text-cyan-300 dark:text-cyan-300 font-bold text-lg md:text-xl mb-4 flex items-center gap-2.5 border-b border-white/10 pb-3">
                          <Sparkles size={22} className="text-cyan-400" />
                          معاني الكلمات والمفردات
                        </h3>
                        
                        {/* حاوية رئيسية واحدة مصممة كجدول إلكتروني مقسم */}
                        <div className="overflow-hidden rounded-xl border border-cyan-500/20 bg-slate-800/40 dark:bg-slate-800/40 backdrop-blur-sm">
                          <table className="w-full text-right border-collapse">
                            <thead>
                              <tr className="bg-cyan-500/10 border-b border-cyan-500/20 text-cyan-300 dark:text-cyan-300 text-xs md:text-sm font-bold">
                                <th className="py-2.5 px-4 w-1/3 border-l border-cyan-500/20">المفردة / الكلمة</th>
                                <th className="py-2.5 px-4 w-2/3">المعنى والشرح</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-cyan-500/10 text-slate-200">
                              {parsedSummary.meanings.map((m, idx) => (
                                <tr key={idx} className="hover:bg-cyan-500/5 transition-colors">
                                  <td className="py-2.5 px-4 font-bold text-cyan-200 dark:text-cyan-200 text-base border-l border-cyan-500/20">
                                    {m.word}
                                  </td>
                                  <td className="py-2.5 px-4 text-sm md:text-base text-slate-200 dark:text-slate-200 leading-relaxed">
                                    {m.meaning}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* كارت التقويم الختامي بخط النسخ المدرسي الواضح */}
              <div className="bg-slate-900/80 dark:bg-slate-900/80 border border-cyan-500/30 border-r-4 border-r-cyan-400 rounded-2xl p-5 md:p-6 backdrop-blur-sm shadow-lg hover:border-cyan-400/50 transition-all">
                <h3 className="text-cyan-300 dark:text-cyan-300 font-bold text-lg md:text-xl mb-3 flex items-center gap-2.5">
                  <Award size={22} className="text-cyan-400" />
                  التقويم الختامي
                </h3>
                <div 
                  className="text-slate-100 dark:text-slate-100 leading-loose text-xl md:text-2xl font-medium prose prose-invert prose-cyan max-w-none font-['Amiri',serif]"
                  dangerouslySetInnerHTML={{ 
                    __html: renderContentWithImages(
                      (lessonData.assessment || 'لا يوجد تقويم متاح').replace(/\n/g, '<br>'), 
                      lessonData.screenshots || []
                    ) 
                  }}
                />
              </div>

              {/* أزرار التعديل والطباعة */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-8 mt-4 border-t border-white/10 print:hidden font-cairo">
                <button
                  onClick={handleEditClick}
                  className="flex items-center justify-center gap-2 w-full sm:w-auto px-6 py-3.5 bg-blue-600/20 border border-blue-500/30 hover:bg-blue-600/40 text-blue-300 rounded-xl text-base font-bold transition-all shadow-lg"
                >
                  <LayoutTemplate size={20} />
                  <span>تعديل الملخص</span>
                </button>

                <button
                  onClick={handlePrint}
                  className="flex items-center justify-center gap-2 w-full sm:w-auto px-6 py-3.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-xl text-base font-bold shadow-[0_0_20px_rgba(16,185,129,0.4)] hover:shadow-[0_0_30px_rgba(16,185,129,0.6)] transition-all transform hover:-translate-y-0.5"
                >
                  <FileText size={20} />
                  <span>طباعة / حفظ PDF</span>
                </button>
              </div>

              </>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}