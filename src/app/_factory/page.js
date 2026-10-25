'use client';
import { useState, useEffect } from 'react';
import { Send, CheckCircle, Loader2, Wand2, Info, X } from 'lucide-react';
import AppHeader from '../../components/AppHeader'; // تأكد إن مسار الاستدعاء ده مطابق لمكان ملف AppHeader عندك

// مكوّن مؤثر الكتابة التدريجية المستقل
const TypewriterMessage = ({ text, onComplete }) => {
  const [displayedText, setDisplayedText] = useState('');
  
  useEffect(() => {
    let currentIndex = 0;
    setDisplayedText(''); // تصفير النص عند تغير المحتوى
    
    const interval = setInterval(() => {
      if (currentIndex < text.length) {
        setDisplayedText(prev => prev + text[currentIndex]);
        currentIndex++;
      } else {
        clearInterval(interval);
        if (onComplete) onComplete();
      }
    }, 25); // سرعة الكتابة (25 مللي ثانية للحرف)
    
    return () => clearInterval(interval);
  }, [text]); // نعتمد على النص فقط لضمان عدم التكرار

  return <div className="whitespace-pre-wrap">{displayedText}</div>;
};
// قاعدة البيانات المحلية للعرض (المنهج العماني - استكمال حتى الصف الثاني عشر)
const semesterOneData = {
  "الصف الأول": ["النشيد الوطني", "العلامة الإيقاعية النوار والسكتة المقابلة لها", "الحدة والغلظة - السرعة والبطء", "اللعبة الشعبية (حبوه موه تدوري)", "المدرج الموسيقي ومفتاح صول", "تطبيقات على المدرج الموسيقي"],
  "الصف الثاني": ["النشيد الوطني", "سلم (دو) الكبير وإشارات اليد الدالة على الأثر النفسي", "تدريبات صوتية وغنائية", "العلامة الإيقاعية البلانش والسكتة المقابلة لها", "نشيد (أقسمت أحبك يا وطني)", "الشدة والخفوت"],
  "الصف الثالث": ["نشيد (موطني)", "الشكل الإيقاعي (طفاتيفي)", "الكريشيندو والديمنويندو", "التيمينة", "آلة الإكسيلوفون", "عزف مقطوعة موسيقية على آلة الإكسيلوفون"],
  "الصف الرابع": ["تدريبات صوتية بالتظليلات", "نشيد (علم بلادي)", "الشكل الإيقاعي (طفاتي)", "نشيد (سلامتي)", "آلة الأورج", "عزف مقطوعة موسيقية على آلة الأورج"],
  "الصف الخامس": ["نشيد (نهضة متجددة)", "الميزان الرباعي", "العلامة الإيقاعية (الروند) والسكتة المقابلة لها", "آلة الأوكورديون", "قراءة إيقاعية وصولفيج غنائي", "عزف مقطوعة موسيقية على آلة الأكورديون"],
  "الصف السادس": ["الأزمنة الأساسية وتقسيماتها", "نشيد (عُمان عظيمة بشعبها )", "التمييز السمعي", "الشكل الإيقاعي (طفافي)", "قراءة إيقاعية وصولفيج غنائي", "عزف مقطوعة موسيقية"],
  "الصف السابع": ["نشيد (وَحْيُ الإِلْهَامِ).", "الرِّباط الزَّمَنِي والنُّقْطَة الزَّمَنِيَّة.", "الشَّكْلان الإِيقاعيَّان (تافي&تافا).", "شَخْصيَّة موسيقيَّة عالميَّة (موتسارت).", "قِراءَة إِيقاعيَّة وصولفيج غِنائي.", "عَزْف مَقْطوعَة موسيقيَّة."],
  "الصف الثامن": ["فَنَّا (البَرْعة) و(طَبْل النِّساء).", "نشيد من فن البرعة", "نشيد من فن النساء", "ابتكارات لحنية.", "أبعاد سلَّم (دو) الكبير.", "قراءة إيقاعية وصولفيج غنائي.", "عزف مقطوعة موسيقية."],
  "الصف التاسع": ["الحبال الصوتية والجهاز التنفسي", "العيوب الشائعة في الغناء وطرق معالجتها", "تدريبات لتحسين مستوى الصوت", "الدور", "إنشاد دور يا من به تجلى الكروب", "عزف موسيقا الدور", "الآلات الإيقاعية العربية", "ضربي سماعي سربند وسماعي ثقيل", "استماع وتذوق موسيقا عربية سماعي بياتي"],
  "الصف العاشر": ["مفتاح ( فا ) الخط الرابع", "سلم ( فا ) الكبير وسلم ( رى ) الصغير الهارموني", "التآلف الكبير والتآلف الصغير", "فن المولد", "نشيد (يا نبي سلام عليك)", "آلات من التراث العماني", "العصر الرومانسي (الرومانتيكي) (١٨٠٠ - ١٩٠٠)", "جوزيبه فردي (١٨١٣ - ١٩٠١)", "عزف مقطوعة موسيقية"],
  "الصف الحادي عشر": ["1. عنصر الإيقاع", "2. عنصر النغم", "3. عنصر التعبير (التظليل)", "4. التآلفات الهارمونية", "5. المصاحبة الهارمونية", "6. عزف الألحان الهارمونية", "7. نبذة تاريخية لآلة الجيتار", "8. مكونات آلة الجيتار", "9. طريقة العزف على آلة الجيتار", "10. فن الصوت", "11. من فن الصوت (صوت عمان الجميلة)"],
  "الصف الثاني عشر": ["الطبقات الصوتية", "التنفس والرنين", "تدريبات عملية لتربية الصوت", "قواعد هارمونية", "مصاحبة هارمونية", "عزف تآلفات هارمونية", "انتشار الموسيقا في الأندلس", "زرياب (٧٧٧م - ٨٥٢م)", "الموشحات الأندلسية"]
};

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

export default function FactoryPage() {
  const [semester, setSemester] = useState('');
  const [grade, setGrade] = useState('');
  const [lessonTitle, setLessonTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [generatedData, setGeneratedData] = useState(null);
  const [isSent, setIsSent] = useState(false);
  const [toast, setToast] = useState(null);

  // متغيرات الحالة الجديدة لإدارة صندوق المحادثة والتنزيل
  const [chatMessages, setChatMessages] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [downloadReadyUrl, setDownloadReadyUrl] = useState(null);

  // مراقبة تغيير الدرس لعرض الرسالة الترحيبية وتصفير حالة التنزيل
  useEffect(() => {
    if (lessonTitle) {
      setDownloadReadyUrl(null); // تصفير رابط التحميل السابق
      setIsTyping(true);
      setChatMessages([
        {
          id: Date.now(),

text: `👋مرحبًا بك في Presentation Generator، وشكرًا لثقتك بنا!

 لقد طلبت إنشاء عرض تقديمي احترافي لدرس: ${lessonTitle}

يسعدنا أن نضع بين يديك عرضًا تقديميًا تعليميًا أُعِدَّ بعناية؛ ليساعدك على شرح الدرس وتقديمه لطلابك بأسلوب واضح ومنظّم.

📌 تنويه هام:
نوصيك بمراجعة محتوى العرض التقديمي قبل استخدامه، حرصًا على دقته وملاءمته لأهداف الدرس. 
كما يسعدنا استقبال ملاحظاتك ومقترحاتك للتطوير، وذلك بالتواصل مع مبرمج ومطور المنصة مباشرة عبر الواتساب: 79886716.

هل أنت مستعد؟
اضغط الزر أدناه لتحميل العرض التقديمي بعد الانتهاء من عملية التوليد والبدء في الاستفادة منه.`,          type: 'welcome'
        }
      ]);
    } else {
      setChatMessages([]);
      setDownloadReadyUrl(null);
    }
  }, [lessonTitle]);

  const showToast = (message) => {
    setToast(message);
    // خلينا التوست يستمر 60 ثانية (دقيقة كاملة) عشان المعلم يلحق يشوفه ويتصرف
    setTimeout(() => setToast(null), 60000); 
  };

  const availableGrades = semester ? Object.keys(syllabusData[semester] || {}) : [];
  const availableLessons = (semester && grade) ? syllabusData[semester][grade] : [];

  const handleDownload = async () => {
    if (!grade || !lessonTitle) {
      alert("يرجى اختيار الصف وعنوان الدرس أولاً.");
      return;
    }

    setIsLoading(true);
    setIsTyping(true);

    const copyrightNotice = `تنويه بشأن حقوق الملكية والاستخدام\n\nيرجى العلم بأن الشريحة الأخيرة من العرض التقديمي تتضمن اسم وشعار منصة MusiTeacher، بالإضافة إلى بيان حقوق الملكية الخاص بالعرض.`;

    // إضافة رسالة الانتظار والتنويه القانوني لصندوق المحادثة
    setChatMessages(prev => [
      ...prev,
      { id: Date.now() + 1, text: `جارٍ توليد العرض التقديمي الخاص بدرس [ ${lessonTitle} ]... يرجى الانتظار حتى يكتمل تجهيز رابط التنزيل.`, type: 'loading' },
      { id: Date.now() + 2, text: copyrightNotice, type: 'legal' }
    ]);

    try {
      // إضافة تأخير مصطنع (3 ثواني) لمحاكاة عملية بناء وتوليد العرض التقديمي بواقعية
      await new Promise(resolve => setTimeout(resolve, 15000));

      // نرسل الطلب لمسار الـ API الذي يجلب الرابط الموقّع من السحابة
      const res = await fetch('/api/factory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ semester, grade, lessonTitle })
      });

      const result = await res.json();
      
      if (result.success && result.downloadUrl) {
        // بدلاً من التنزيل الفوري، نحفظ الرابط ليتغير الزر للون الأخضر
        setDownloadReadyUrl(result.downloadUrl);
      } else {
        setChatMessages(prev => [
          ...prev,
          { id: Date.now() + 3, text: `نعتذر لك، تعذّر توليد العرض التقديمي لهذا الدرس في الوقت الحالي. قد يكون العرض غير متاح بعد أو توجد مشكلة مؤقتة في خدمة الملفات. يرجى المحاولة لاحقًا، وشكرًا لثقتك بمنصة MusiTeacher.`, type: 'error' }
        ]);
      }
    } catch (error) {
      setChatMessages(prev => [
        ...prev,
        { id: Date.now() + 3, text: `حدث خطأ في الاتصال بالخادم. يرجى المحاولة لاحقًا.`, type: 'error' }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <AppHeader />
      <div className="min-h-screen w-full factory-blue-bg transition-colors duration-500">
        <div className="relative min-h-[80vh] flex flex-col items-center pt-32 px-4">
        <h1 className="text-3xl md:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-300 mb-4 drop-shadow-md text-center" dir="rtl">
          AI Presentation Generator
          <span className="block text-2xl md:text-3xl mt-2 text-white">مولّد العروض التقديمية الذكي 🪄</span>
        </h1>
        <p className="text-gray-300 text-center max-w-2xl mb-8 text-sm md:text-base leading-relaxed" dir="rtl">
🎓 أصبح إعداد عروض PowerPoint التقديمية الاحترافية أسهل من أي وقت مضى!

اختر الدرس الذي تريده، وبضغطة زر واحدة، احصل على عرض تقديمي احترافي ورائع، مُعدّ بالذكاء الاصطناعي، ليوفّر عليك الوقت والجهد ويمنحك انطلاقة مميزة في تقديم دروسك.        </p>

      <div className="w-full max-w-3xl bg-[#0f2027]/70 backdrop-blur-md p-8 rounded-2xl border border-emerald-500/30 shadow-2xl mb-8">
        
        <div className="mb-6" dir="rtl">
          <label className="block text-gray-300 mb-2">الفصل الدراسي:</label>
          <select 
            value={semester} 
            onChange={(e) => {
              setSemester(e.target.value);
              setGrade('');
              setLessonTitle('');
              setDownloadReadyUrl(null);
            }}
            className="w-full bg-[#0f2027] text-white border border-gray-600 rounded-lg px-4 py-3 focus:border-orange-500 focus:outline-none"
          >
            <option value="" disabled>اختر الفصل الدراسي...</option>
            <option value="الفصل الدراسي الأول">الفصل الدراسي الأول</option>
            <option value="الفصل الدراسي الثاني">الفصل الدراسي الثاني</option>
          </select>
        </div>

        {semester && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6 animate-fade-in">
              <div>
                <label className="block text-gray-300 mb-2">الصف الدراسي:</label>
                <select 
                  value={grade} 
                  onChange={(e) => {
                    setGrade(e.target.value);
                    setLessonTitle('');
                  }}
                  className="w-full bg-[#0f2027] text-white border border-gray-600 rounded-lg px-4 py-3 focus:border-orange-500 focus:outline-none"
                >
                  <option value="" disabled>اختر الصف...</option>
                  {availableGrades.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-gray-300 mb-2">عنوان الدرس:</label>
                <select 
                  value={lessonTitle}
                  onChange={(e) => setLessonTitle(e.target.value)}
                  disabled={!grade}
                  className="w-full bg-[#0f2027] text-white border border-gray-600 rounded-lg px-4 py-3 focus:border-orange-500 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="" disabled>اختر الدرس...</option>
                  {availableLessons.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
            </div>

            {chatMessages.length > 0 && (
              <div className="w-full bg-[#0a151a] border border-gray-700 rounded-xl p-4 mb-6 max-h-96 overflow-y-auto flex flex-col gap-4 text-right animate-fade-in shadow-inner" dir="rtl">
                {chatMessages.map((msg) => (
                  <div 
                    key={msg.id} 
                    className="bg-[#12252e] border border-gray-600/50 p-4 rounded-lg text-gray-200 text-sm md:text-base leading-relaxed tracking-wide"
                    style={{ fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif' }}
                  >
                     <TypewriterMessage 
                       text={msg.text} 
                       onComplete={() => setIsTyping(false)} 
                     />
                  </div>
                ))}
              </div>
            )}

            <div className="relative w-full animate-fade-in mt-2">
              {downloadReadyUrl ? (
                <a 
                  href={downloadReadyUrl}
                  download
                  className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold py-4 rounded-xl shadow-lg transition-all flex justify-center items-center gap-2"
                >
                  <CheckCircle size={24} />
                  تم تجهيز العرض بنجاح — اضغط للتحميل
                </a>
              ) : (
                <button 
                  onClick={handleDownload}
                  disabled={isLoading || isTyping || !lessonTitle}
                  className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-bold py-4 rounded-xl shadow-lg transition-all flex justify-center items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? <Loader2 className="animate-spin" size={24} /> : <Wand2 size={24} />}
                  {isLoading ? 'جارٍ توليد العرض التقديمي...' : 'اضغط لتوليد العرض التقديمي'}
                </button>
              )}

              {toast && (
                <div className="absolute -inset-2 z-50 flex items-center justify-center" dir="rtl">
                  <div className="absolute inset-0 rounded-2xl border-2 border-red-400 shadow-[0_0_40px_rgba(239,68,68,1)] animate-pulse"></div>
                  <div className="relative w-full h-full flex items-center justify-center bg-gradient-to-r from-red-500 via-red-600 to-red-500 text-white rounded-2xl border-4 border-slate-900 shadow-[0_4px_15px_rgba(0,0,0,0.2)] px-4 cursor-not-allowed">
                    <Info size={28} className="text-yellow-300 shrink-0" />
                    <span className="font-bold text-xs sm:text-sm leading-relaxed flex-1 text-center">{toast}</span>
                    <button 
                      onClick={() => setToast(null)} 
                      className="shrink-0 bg-black/20 hover:bg-black/40 p-2 rounded-full transition-colors pointer-events-auto"
                    >
                      <X size={18} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
    </div>
    </>
  );
}