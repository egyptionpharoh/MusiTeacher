'use client';
import { useState } from 'react';
import { Send, Eye, X, Info, BookOpen, Loader2 } from 'lucide-react';
import AppHeader from '../../components/AppHeader'; 
import { useTheme } from '../../context/ThemeContext';

const semesterOneData = {
  "الصف الأول": ["النشيد الوطني", "العلامة الإيقاعية النوار والسكتة المقابلة لها", "الحدة والغلظة - السرعة والبطء", "اللعبة الشعبية (حبوه موه تدوري)", "المدرج الموسيقي ومفتاح صول", "تطبيقات على المدرج الموسيقي"],
  "الصف الثاني": ["النشيد الوطني", "سلم (دو) الكبير وإشارات اليد الدالة على الأثر النفسي", "تدريبات صوتية وغنائية", "العلامة الإيقاعية البلانش والسكتة المقابلة لها", "نشيد (أقسمت أحبك يا وطني)", "الشدة والخفوت"],
  "الصف الثالث": ["نشيد (موطني)", "الشكل الإيقاعي (طفاتيفي)", "الكريشيندو والديمنويندو", "التيمينة", "آلة الإكسيلوفون", "عزف مقطوعة موسيقية على آلة الإكسيلوفون"],
  "الصف الرابع": ["تدريبات صوتية بالتظليلات", "نشيد (علم بلادي)", "الشكل الإيقاعي (طفاتي)", "نشيد (سلامتي)", "آلة الأورج", "عزف مقطوعة موسيقية على آلة الأورج"],
  "الصف الخامس": ["نشيد (نهضة متجددة)", "الميزان الرباعي", "العلامة الإيقاعية (الروند) والسكتة المقابلة لها", "آلة الأوكورديون", "قراءة إيقاعية وصولفيج غنائي", "عزف مقطوعة موسيقية على آلة الأكورديون"],
  "الصف السادس": ["الأزمنة الأساسية وتقسيماتها", "نشيد (عُمان عظيمة بشعبها )", "التمييز السمعي", "الشكل الإيقاعي (طفافي)", "قراءة إيقاعية وصولفيج غنائي", "عزف مقطوعة موسيقية"],
  "الصف السابع": ["نشيد (وَحْيُ الإِلْهَامِ).", "الرِّباط الزَّمَنِي والنُّقْطَة الزَّمَنِيَّة.", "الشَّكْلان الإِيقاعيَّان (تافي&تافا).", "شَخْصيَّة موسيقيَّة عالميَّة (موتسارت).", "قِراءَة إِيقاعيَّة وصولفيج غِنائي.", "عَزْف مَقْطوعَة موسيقيَّة."],
  "الصف الثامن": ["فَنَّا (البَرْعة) و(طَبْل النِّساء).", "نشيدان من فَنَّي (البرعة) و(طبل النِّساء).", "ابتكارات لحنية.", "أبعاد سلَّم (دو) الكبير.", "قراءة إيقاعية وصولفيج غنائي.", "عزف مقطوعة موسيقية."],
  "الصف التاسع": ["الحبال الصوتية والجهاز التنفسي", "العيوب الشائعة في الغناء وطرق معالجتها", "تدريبات لتحسين مستوى الصوت", "الدور", "إنشاد دور يا من به تجلى الكروب", "عزف موسيقا الدور", "الآلات الإيقاعية العربية", "ضربي سماعي سربند وسماعي ثقيل", "استماع وتذوق موسيقا عربية سماعي بياتي"],
  "الصف العاشر": ["مفتاح ( فا ) الخط الرابع", "سلم ( فا ) الكبير وسلم ( رى ) الصغير الهارموني", "التآلف الكبير والتآلف الصغير", "فن المولد", "نشيد (يا نبي سلام عليك)", "آلات من التراث العماني", "العصر الرومانسي (الرومانتيكي) (١٨٠٠ - ١٩٠٠)", "جوزيبه فردي (١٨١٣ - ١٩٠١)", "عزف مقطوعة موسيقية"],
  "الصف الحادي عشر": [
    "1. عنصر الإيقاع",
"2. عنصر النغم",
"3. عنصر التعبير (التظليل)",
"4. التآلفات الهارمونية",
"5. المصاحبة الهارمونية",
"6. عزف الألحان الهارمونية",
"7. نبذة تاريخية لآلة الجيتار",
"8. مكونات آلة الجيتار",
"9. طريقة العزف على آلة الجيتار",
"10. فن الصوت",
"11. من فن الصوت (صوت عمان الجميلة)",
  ],
  "الصف الثاني عشر": ["الطبقات الصوتية", "التنفس والرنين", "تدريبات عملية لتربية الصوت", "قواعد هارمونية", "مصاحبة هارمونية", "عزف تآلفات هارمونية", "انتشار الموسيقا في الأندلس", "زرياب (٧٧٧م - ٨٥٢م)", "الموشحات الأندلسية"]};

const semesterTwoData = {
  "الصف الأول": ["نشيد (أرقامي)", "العلامة الإيقاعية الكروش والسكتة المقابلة لها", "إيقاع حركي", "نشيد (أسرتي)", "آلات الباند", "عزف مقطوعة على آلات الباند"],
  "الصف الثاني": ["اللعبة الشعبية (حدلجي مدلجي)", "الميزان الثنائي", "قراءة إيقاعية وغناء صولفائي", "نشيد (أركان الإسلام)", "عزف مقطوعة موسيقية على آلات الباند", "إيقاع حركي للبلانش (ل)"],
  "الصف الثالث": ["نشيد (الصوم)", "الشكل الإيقاعي ()1", "إيقاع حركي ()", "نشيد (نظافتي)", "قراءة إيقاعية وغناء صولفائي", "النغمات الصاعدة والهابطة والمتكررة"],
  "الصف الرابع": ["اللعبة الشعبية (تراني بقطع السناسل)", "الميزان الثلاثي", "إيقاع حركي ()1", "نشيد (حرف الأجداد)", "أربيج سلم (دو) الكبير", "قراءة إيقاعية وغناء صولفائي"],
  "الصف الخامس": ["فنا (الرزحة) و (الكيذا)", "نشيدان من فني (الرزحة) و (الكيذا)", "التمييز بين الموازين الموسيقية البسيطة", "إملاء إيقاعي", "قراءة إيقاعية وصولفيج غنائي", "عزف مقطوعة موسيقية"],
  "الصف السادس": ["فنا (المديمة) و (الحمبورة)", "نشيدان من فني (المديمة) و (الحمبورة)", "إملاء إيقاعي", "المرجع (ذو الخطين)", "قراءة إيقاعية وصولفيج غنائي", "عزف مقطوعة موسيقية"],
  "الصف السابع": ["فَنَّا (العَيَّالَة) و(الويْليَّة)", "نشيدان من فَنَّي (العيَّالة) و(الويْليَّة)", "إملاء ايقاعي", "العبارات والقفلات الموسيقية", "قراءة إيقاعية وصولفيج غنائي", "عزف مقطوعة موسيقية"],
  "الصف الثامن": ["علامات التَّحويل (الدييز - البيمول - البيكار)", "قراءة إيقاعية وصولفيج غنائي.", "عزف مقطوعة موسيقية.", "Song Of «Dreams Within Reach»", "إملاء إيقاعي.", "التَّدوين الموسيقي الرَّقمي."],
  "الصف التاسع": ["فن العيالة", "تطبيق ايقاع العيالة والآلات الإيقاعية المستخدمة فيه", "نشيد بلادنا تفتدى", "الاوركسترا السيمفوني", "الصيغ الموسيقية", "السيمفونية", "إنشاد نشيد سبحان ربي", "قراءة ايقاعيه ونغميه لموسيقي نشيد سبحان ربي", "عزف موسيقا لنشيد سبحان ربي"],
  "الصف العاشر": ["مقام الكرد", "عزف مقطوعة موسيقية", "نشيد (الولاء)", "( الدولاب - البشرف - اللونجا )", "رياض السنباطي (١٩٠٦-١٩٨١)", "عزف مقطوعة موسيقية", "دراسة آلة ( البيانو )", "الكانون (المحاكاة) في الموسيقا", "عزف موسيقا ((نشيد الفرح)) لبيتهوفن"],
  "الصف الحادي عشر": ["الصفراوي (قيثارة الوطن)", "السلالم الكبيرة", "الموازين المركبة والمقابلات الإيقاعية", "التآلفات اللحنية", "محمد القصبجي", "تحليل مقطوعة موسيقيه (ذكرياتي)", "عزف مقطوعة ذكرياتي", "عصر الباروك", "يوهان سباستيان باخ", "فن الاوبرا"],
  "الصف الثاني عشر": ["تصوير السلالم والألحان", "الأشكال الإيقاعية الغير مألوفة", "صولفيج غنائي", "فن الشرح", "شخصية عمانية ( محمد حبريش )", "نشيد ( نور العلم ) من فن الشرح", "مراجعة المقامات السابقة", "مقامات ( الحجاز ، والصبا ، والعجم عشيران )", "عزف مقطوعات موسيقية صغيرة", "موسيقا الشعوب", "العصر الحديث وبعض رواده", "عزف مقطوعة موسيقية من العصر الحديث", "ضروب عربية", "((البشرف))", "استماع وتذوق"]
};

const syllabusData = {
  "الفصل الدراسي الأول": semesterOneData,
  "الفصل الدراسي الثاني": semesterTwoData
};

export default function BankPage() {
  const [semester, setSemester] = useState('');
  const [grade, setGrade] = useState('');
  const [lessonTitle, setLessonTitle] = useState('');
  const [showLesson, setShowLesson] = useState(false);
  const [showExtensionAlert, setShowExtensionAlert] = useState(false);
  const [customAlert, setCustomAlert] = useState(null);
  
  // حالات جديدة لجلب وعرض الدرس من الـ JSON
  const [isLoading, setIsLoading] = useState(false);
  const [lessonData, setLessonData] = useState(null);

  const availableGrades = semester ? Object.keys(syllabusData[semester] || {}) : [];
  const availableLessons = (semester && grade) ? syllabusData[semester][grade] : [];

  // دالة تحويل علامات الصور [صورة_1] إلى عناصر <img> حقيقية
  const renderContentWithImages = (text, screenshots = []) => {
    if (!text) return '';
    
    // التأكد من أن القيمة نصية ومعالجة المصفوفات لتجنب خطأ replace
    let processedText = text;
    if (Array.isArray(processedText)) {
      processedText = processedText.join('<br>');
    } else if (typeof processedText !== 'string') {
      processedText = String(processedText);
    }

    return processedText.replace(/\[صورة_(\d+)\]/g, (match, p1) => {
      const index = parseInt(p1, 10) - 1;
      if (screenshots && screenshots[index]) {
        // تم تحديد العرض ليكون w-48 للهواتف و w-64 للشاشات الأكبر ليظهر بحجم أنيق ومتناسق مع النص
        return `<div class="my-5 text-center"><img src="${screenshots[index]}" alt="صورة توضيحية للدرس" class="w-48 md:w-64 h-auto object-contain inline-block rounded-2xl shadow-sm border border-stone-200 dark:border-white/10 my-2 hover:scale-[1.03] transition-transform duration-300" /></div>`;
      }
      return '';
    });
  };

 const renderProfessionalCards = (core, metadata = {}) => {
    if (!core) return null;

    const screenshots = metadata.lessonScreenshots || [];
    let cards = [];

    // 1. الاستراتيجيات التعليمية
    if (core.strategies && core.strategies.length > 0) {
      const uniqueStrategies = [...new Set(core.strategies)];
      const strategiesHtml = `<div class="flex flex-wrap gap-3 mt-1">` + 
        uniqueStrategies.map(item => `<span class="inline-flex items-center px-4 py-2.5 rounded-xl bg-teal-50 dark:bg-teal-950/40 text-teal-900 dark:text-teal-300 font-bold text-base border border-teal-200/60 dark:border-teal-800/40 shadow-sm">${item}</span>`).join('') + 
        `</div>`;
      cards.push({ title: "الاستراتيجيات", content: strategiesHtml, theme: "teal" });
    }

    // 2. المصادر التعليمية
    if (core.resources && core.resources.length > 0) {
      const resourcesHtml = core.resources.map(r => `<span class="block mb-2 font-medium text-slate-700 dark:text-slate-300">• ${r}</span>`).join('');
      cards.push({ title: "المصادر التعليمية", content: resourcesHtml, theme: "orange" });
    }

   // 3. المفاهيم والمصطلحات
    if (core.concepts && core.concepts.length > 0) {
      const conceptsHtml = `<div class="flex flex-wrap gap-2 mt-2">` + 
        core.concepts.map(c => {
          const conceptText = typeof c === 'object' && c !== null ? (c.concept || c.name || c.term || c.title || Object.values(c).join(' - ')) : c;
          return `<span class="inline-block px-3 py-1.5 bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 font-semibold rounded-lg border border-rose-200/50 dark:border-rose-900/30">${conceptText}</span>`;
        }).join('') + 
        `</div>`;
      cards.push({ title: "المفاهيم", content: conceptsHtml, theme: "pink" });
    }

    // 4. التهيئة / التمهيد / التعلم القبلي
    if (core.introduction) {
      const introText = renderContentWithImages(core.introduction.replace(/\n/g, '<br>'), screenshots);
      cards.push({
        title: "التهيئة / التمهيد / التعلم القبلي",
        content: introText,
        theme: "pink"
      });
    }

    // 5. إجراءات سير الدرس / اﻷنشطة التدريسية
    if (core.procedures && core.procedures.length > 0) {
      const proceduresHtml = core.procedures.map(step => {
        const processedAction = renderContentWithImages(step.actionText, screenshots);
        
        // استخراج وتنسيق الخطوات الفرعية إن وجدت
        let subStepsHtml = '';
        if (step.subSteps && step.subSteps.length > 0) {
          subStepsHtml = `<div class="mt-4 mr-6 space-y-3">` + 
            step.subSteps.map(subStep => {
              // التحقق مما إذا كانت الخطوة الفرعية كائناً يحتوي على نص أو نصاً مباشراً
              const subText = typeof subStep === 'object' && subStep !== null ? (subStep.actionText || '') : subStep;
              const subStrategy = typeof subStep === 'object' && subStep !== null && subStep.assignedStrategy ? subStep.assignedStrategy : '';
              
              return `<div class="text-sm leading-relaxed text-slate-700 dark:text-slate-300 pr-3 border-r-2 border-blue-200 dark:border-cyan-800/50">
                ${renderContentWithImages(subText, screenshots)} ${subStrategy ? `<span class="inline-block mt-1 mx-2 font-semibold text-teal-600 dark:text-teal-400 text-xs">باستخدام ${subStrategy}</span>` : ''}
              </div>`;
            }).join('') + `</div>`;
        }

        return `
          <div class="mb-4 pb-4 border-b border-stone-100 dark:border-slate-800/50 last:border-none">
            <div class="flex items-start gap-3">
              <span class="font-bold text-blue-600 dark:text-cyan-400 text-xl flex-shrink-0">${step.stepIndex}-</span>
              <div class="flex-1">
                <div class="text-base leading-relaxed text-slate-800 dark:text-slate-200">
                  ${processedAction} ${step.assignedStrategy ? `<span class="inline-block mt-1 mx-2 font-semibold text-teal-600 dark:text-teal-400">باستخدام ${step.assignedStrategy}</span>` : ''}
                </div>
                ${subStepsHtml}
              </div>
            </div>
          </div>
        `;
      }).join('');
      cards.push({ title: "إجراءات سير الدرس / اﻷنشطة التدريسية", content: proceduresHtml, theme: "purple" });
    }

    // 6. التقويم التكويني
    if (core.formativeAssessment) {
      const formativeText = renderContentWithImages(core.formativeAssessment.replace(/\n/g, '<br>'), screenshots);
      cards.push({
        title: "التقويم التكويني",
        content: formativeText,
        theme: "green"
      });
    }

    // 7. التقويم الختامي
    if (core.summativeAssessment) {
      const summativeText = renderContentWithImages(core.summativeAssessment.replace(/\n/g, '<br>'), screenshots);
      cards.push({
        title: "التقويم الختامي",
        content: summativeText,
        theme: "green"
      });
    }

    return cards.map((card, idx) => (
      <div key={idx} className="bg-white dark:bg-[#0f172a] rounded-2xl shadow-sm hover:shadow-lg border border-gray-200 dark:border-white/10 mb-8 overflow-hidden transition-all duration-300">
        <div className={`theme-${card.theme} px-8 py-5 border-b border-black/5 dark:border-white/5 flex items-center gap-4`}>
          <div className="w-1.5 h-8 bg-white/40 rounded-full shadow-inner"></div>
          <h3 className="text-2xl font-bold font-cairo text-white tracking-wide drop-shadow-sm">
            {card.title}
          </h3>
        </div>
        <div className="p-8 md:p-10 bg-transparent">
          <div 
            className="pro-lesson-content text-slate-800 dark:text-slate-200"
            dangerouslySetInnerHTML={{ __html: card.content }} 
          />
        </div>
      </div>
    ));
  };
    
  const handleSemesterChange = (e) => {
    setSemester(e.target.value);
    setCustomAlert(null);
    setGrade('');
    setLessonTitle('');
    setShowLesson(false);
    setLessonData(null);
  };

  const handleViewLesson = async () => {
    if (!grade || !lessonTitle) {
      setCustomAlert({ type: 'warning', title: 'خطوة مفقودة!', message: 'يرجى اختيار الصف والدرس.' });
      return;
    }
    
    setCustomAlert({ type: 'info', title: 'جاري توليد التحضير...', message: 'يرجى الانتظار، النظام يقوم بمعالجة البيانات...' });
    setIsLoading(true);
    setShowLesson(false);

    // إضافة زمن تحميل لا يقل عن 2.5 ثانية ليشعر المستخدم بواقعية العمل في الخلفية
    const startTime = Date.now();

    try {
      const res = await fetch('/api/bank/get-lesson', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ semester, grade, title: lessonTitle })
      });
      
      const result = await res.json();
      
      // حساب الوقت المنقضي
      const elapsedTime = Date.now() - startTime;
      const remainingTime = Math.max(0, 2500 - elapsedTime);

      // انتظار باقي الوقت إذا كان الاتصال سريعاً لضمان تجربة مستخدم متزنة
      await new Promise(resolve => setTimeout(resolve, remainingTime));

      if (result.success) {
        setLessonData(result.data);
        setShowLesson(true);
        setCustomAlert({ type: 'success', title: 'تم توليد التحضير بنجاح', message: 'تم إعداد المحتوى بدقة.' });
        setTimeout(() => setCustomAlert(null), 2000);
      } else {
        setCustomAlert({ type: 'warning', title: ' تعذر توليد التحضير المطلوب نظراً لوجود ضغط هائل على السيرفر فى الوقت الحالي، لذا يرجى المحاولة فى وقت لاحق.' });
      }
    } catch (error) {
      setCustomAlert({ type: 'error', title: 'مشكلة في الاتصال', message: 'يرجى المحاولة لاحقاً.' });
    } finally {
      setIsLoading(false);
    }
  };
  return (
    <div className="relative min-h-screen flex flex-col items-center pb-32 transition-colors duration-1000 bg-transparent" dir="rtl">
      <AppHeader />

      {/* قسم العنوان والترحيب - الهوية البصرية الفاخرة (Premium SaaS Vibe) */}
      <div className="text-center mt-32 md:mt-40 mb-12 w-full max-w-4xl px-4 flex flex-col items-center z-10 relative">
        
        {/* التدرج اللوني الأحمر النيون مع مساحة سفلية لمنع حجب النقاط وظل فاتح للعزل البصري */}
        <h1 className="text-6xl md:text-7xl font-black mb-8 tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-red-400 via-red-600 to-rose-500 pb-4 leading-[1.2] drop-shadow-[0_0_15px_rgba(255,255,255,0.8)] dark:drop-shadow-[0_0_15px_rgba(0,0,0,0.8)]">
          مصنع التحضيرات المتطورة
        </h1>
        
        <div className="inline-flex relative group mt-2">
          {/* هالة تفاعلية حمراء نيون تظهر بنعومة عند مرور الماوس */}
          <div className="absolute -inset-1 bg-gradient-to-r from-red-500/20 to-rose-500/20 rounded-full blur-xl opacity-40 group-hover:opacity-70 transition duration-700"></div>
          
          {/* كبسولة زجاجية (Glass Capsule) فائقة النقاء مع تأثير الإضاءة العلوية */}
          <div className="relative bg-[#0a0a0a]/40 dark:bg-black/50 backdrop-blur-3xl px-12 py-5 rounded-full border border-white/5 border-t-white/20 shadow-[0_20px_40px_-10px_rgba(0,0,0,0.7)] transition-all duration-700 hover:bg-black/60">
            <p className="text-lg md:text-xl text-stone-200 font-medium leading-relaxed tracking-wide drop-shadow-md">
                           وداعاً لساعات التحضير اليدوي المتعبة.. الآن بنقرة زر واحدة يمكنك توليد تحضيراً احترافياً بالذكاء الاصطناعي مطابقاً لدليل المعلم، ونقله فوراً إلى منصة نور 
            </p>
          </div>
        </div>
      </div>

      {customAlert && (
        <div className="w-full max-w-3xl mb-6 bg-blue-50 dark:bg-[#0f2027] border border-blue-200 dark:border-cyan-500/50 text-stone-800 dark:text-white px-6 py-4 rounded-xl flex items-start gap-4 animate-fade-in shadow-sm dark:shadow-[0_0_15px_rgba(0,255,255,0.1)]">
          <Info size={28} className="text-blue-600 dark:text-cyan-400 mt-1 flex-shrink-0" />
          <div>
            <h3 className="font-bold text-xl mb-1 text-blue-900 dark:text-cyan-300">{customAlert.title}</h3>
            <p className="text-stone-600 dark:text-gray-300 leading-relaxed">{customAlert.message}</p>
          </div>
          <button onClick={() => setCustomAlert(null)} className="mr-auto text-stone-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400 transition-colors">
            <X size={24} />
          </button>
        </div>
      )}

      <div className="glass-card w-full max-w-3xl p-8 rounded-3xl mb-8 transition-all duration-500 relative overflow-hidden">
        <div className="mb-6">
          <label className="block text-stone-700 dark:text-gray-300 mb-2 font-bold transition-colors">الفصل الدراسي:</label>
          <select value={semester} onChange={handleSemesterChange} className="w-full bg-stone-50 hover:bg-stone-100 dark:bg-white/5 text-stone-900 dark:text-white border border-stone-200 dark:border-white/10 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 dark:focus:ring-cyan-500 outline-none transition-all duration-300 dark:backdrop-blur-sm">
            <option value="" disabled className="bg-white dark:bg-[#111827] text-stone-500">اختر الفصل الدراسي...</option>
            <option value="الفصل الدراسي الأول" className="bg-white dark:bg-[#111827]">الفصل الدراسي الأول</option>
            <option value="الفصل الدراسي الثاني" className="bg-white dark:bg-[#111827]">الفصل الدراسي الثاني</option>
          </select>
        </div>

        {semester && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6 animate-fade-in">
            <div>
              <label className="block text-stone-700 dark:text-gray-300 mb-2 font-bold transition-colors">الصف الدراسي:</label>
              <select value={grade} onChange={(e) => { setGrade(e.target.value); setLessonTitle(''); setShowLesson(false); setLessonData(null); }} className="w-full bg-stone-50 hover:bg-stone-100 dark:bg-white/5 text-stone-900 dark:text-white border border-stone-200 dark:border-white/10 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 dark:focus:ring-cyan-500 outline-none transition-all duration-300 dark:backdrop-blur-sm">
                <option value="" disabled className="bg-white dark:bg-[#111827] text-stone-500">اختر الصف...</option>
                {availableGrades.map(g => <option key={g} value={g} className="bg-white dark:bg-[#111827]">{g}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-stone-700 dark:text-gray-300 mb-2 font-bold transition-colors">عنوان الدرس:</label>
              <select value={lessonTitle} onChange={(e) => { setLessonTitle(e.target.value); setShowLesson(false); setLessonData(null); }} disabled={!grade} className="w-full bg-stone-50 hover:bg-stone-100 disabled:opacity-50 dark:bg-white/5 text-stone-900 dark:text-white border border-stone-200 dark:border-white/10 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 dark:focus:ring-cyan-500 outline-none transition-all duration-300 dark:backdrop-blur-sm">
                <option value="" disabled className="bg-white dark:bg-[#111827] text-stone-500">اختر الدرس...</option>
                {availableLessons.map((l, index) => <option key={`${l}-${index}`} value={l} className="bg-white dark:bg-[#111827]">{l}</option>)}
              </select>
            </div>
          </div>
        )}

        {semester && !showLesson && (
          <button 
            onClick={handleViewLesson} 
            disabled={isLoading || !lessonTitle}
            className="w-full text-white font-bold py-4 rounded-xl shadow-lg hover:shadow-xl transition-all flex justify-center items-center gap-2 hover:-translate-y-1 active:scale-[0.98] outline-none disabled:opacity-70 disabled:hover:translate-y-0"
            style={{ background: 'var(--primary-gradient)' }}
          >
            {isLoading ? <Loader2 size={24} className="animate-spin" /> : <Eye size={24} />} 
            {isLoading ? 'جاري توليد التحضير المطلوب...' : 'اضغط لتوليد التحضير الآن'}
          </button>
        )}
      </div>

      {/* منطقة عرض التحضير الذكي */}
      {showLesson && lessonData && (
        <div className="lesson-container-wrapper w-full max-w-5xl mt-12 animate-fade-in relative">
          <div className="lesson-overlay" onContextMenu={(e) => e.preventDefault()} />
          <div className="mb-12 text-center">
            <h2 className="text-4xl font-black text-stone-900 dark:text-white mb-6 font-cairo tracking-tight">
              {lessonData.metadata.title}
            </h2>
            <div className="inline-block bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold px-8 py-3 rounded-full shadow-lg border border-emerald-400/30">
              {lessonData.metadata.grade} - {lessonData.metadata.semester}
            </div>
          </div>
          <div className="flex flex-col">
            {renderProfessionalCards(lessonData.core, lessonData.metadata)}
          </div>
        </div>
      )}

      {showLesson && lessonData && (
        <button 
          onClick={() => {
            if (lessonData && lessonData.core) {
              const core = lessonData.core;
              const screenshots = lessonData.metadata?.lessonScreenshots || [];

              const payload = {
                preparation: renderContentWithImages((core.introduction || "").replace(/\n/g, '<br>'), screenshots),
                lesson_vocabulary: (core.concepts || []).map(c => {
                  const conceptText = typeof c === 'object' && c !== null ? (c.concept || c.name || c.term || c.title || Object.values(c).join(' - ')) : c;
                  return `• ${conceptText}`;
                }).join('<br>'),
                thinking_skills: (core.procedures || []).map(p => {
                  let stepHtml = `<br><strong>${p.stepIndex}-</strong> ${renderContentWithImages(p.actionText, screenshots)} ${p.assignedStrategy ? `باستخدام ${p.assignedStrategy}` : ''}`;
                  if (p.subSteps && p.subSteps.length > 0) {
                    stepHtml += p.subSteps.map(sub => {
                      const subText = typeof sub === 'object' && sub !== null ? (sub.actionText || '') : sub;
                      const subStrategy = typeof sub === 'object' && sub !== null && sub.assignedStrategy ? ` باستخدام ${sub.assignedStrategy}` : '';
                      return `<br>&nbsp;&nbsp;&nbsp; - ${renderContentWithImages(subText, screenshots)}${subStrategy}`;
                    }).join('');
                  }
                  return stepHtml;
                }).join(''),
                formative_assessment: renderContentWithImages((core.formativeAssessment || "").replace(/\n/g, '<br>'), screenshots),
                closing_assessment: renderContentWithImages((core.summativeAssessment || "").replace(/\n/g, '<br>'), screenshots),
                other_strategies: (core.strategies || []).join('، ') || "أخرى",
                other_learning_resources: (core.resources || []).join('، ') || "أخرى",
                levels: ["الفهم", "التطبيق", "التحليل"]
              };

              console.log("🚀 [حزمة البيانات الموجهة لإضافة نور]:", payload);

              document.dispatchEvent(new CustomEvent('MusiTeacher_ExportToNoor', { detail: payload }));
              
              const prepStatus = payload.preparation ? "✅ جاهزة ومحسنة" : "❌ فارغة";
              alert(`تم توليد التحضير بسرعة البرق ونقله للإضافة بنجاح 🪄\n\nحالة البيانات: ${prepStatus}\n\nافتح منصة نور واضغط على أيقونة الإضافة ليتم الحقن السريع.`);
            }
          }}
          className="fixed bottom-10 left-10 z-50 group flex items-center gap-3 px-8 py-4 rounded-full font-cairo font-black text-lg text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-[0_10px_30px_-5px_rgba(37,99,235,0.4)] dark:shadow-[0_10px_30px_-5px_rgba(59,130,246,0.3)] border border-blue-400/30 dark:border-indigo-500/30 transform transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_15px_40px_-5px_rgba(37,99,235,0.6)] dark:hover:shadow-[0_15px_40px_-5px_rgba(59,130,246,0.5)] active:translate-y-0 overflow-hidden"
        >
          <span className="absolute top-0 -inset-full h-full w-1/2 z-0 block transform -skew-x-12 bg-gradient-to-r from-transparent to-white opacity-20 group-hover:animate-shine" />
          <Send size={24} className="relative z-10 transition-transform duration-300 group-hover:translate-x-1 group-hover:-translate-y-1" /> 
          <span className="relative z-10 tracking-wide">إرسال التحضير إلى منصة نور</span>
        </button>
      )}
      {/* تنبيه الإضافة (Chrome Extension Alert) */}
      {showExtensionAlert && (
        <div className="fixed inset-0 bg-stone-900/60 dark:bg-black/80 flex items-center justify-center z-50 animate-fade-in p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#111827] rounded-3xl p-8 relative max-w-md w-full border border-stone-200 dark:border-none shadow-2xl">
            <button onClick={() => setShowExtensionAlert(false)} className="absolute top-4 right-4 text-stone-500 hover:text-red-500 dark:text-gray-400 dark:hover:text-red-500 transition-colors bg-stone-100 dark:bg-gray-800 p-2 rounded-full hover:bg-stone-200 dark:hover:bg-gray-700">
              <X size={24} />
            </button>
            <div className="mb-6 flex justify-center mt-4">
              <img src="/assets/extension-icon.png" alt="MusiTeacher Pro" className="w-20 h-20 shadow-lg dark:shadow-[0_0_20px_rgba(0,255,255,0.3)] rounded-2xl" />
            </div>
            <h3 className="text-2xl font-black text-stone-900 dark:text-white mb-3 text-center">إضافة المتصفح مطلوبة</h3>
            <p className="text-stone-600 dark:text-gray-400 mb-8 leading-relaxed font-medium text-center">
              لإرسال هذا التحضير مباشرة إلى منصة <strong>نور</strong>، يرجى تثبيت إضافة <strong>MusiTeacher Pro</strong> الخاصة بمتصفح Google Chrome.
            </p>
            <a href="#" className="block text-center w-full bg-blue-600 hover:bg-blue-700 dark:bg-[#0f2027] dark:border dark:border-cyan-500/50 text-white font-bold py-4 rounded-xl transition-all shadow-md hover:shadow-lg hover:-translate-y-1 text-lg">
              تثبيت الإضافة الآن
            </a>
          </div>
        </div>
      )}
    </div>
  );
}