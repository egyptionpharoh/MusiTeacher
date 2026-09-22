'use client';
import { useState } from 'react';
import { Send, CheckCircle, Loader2, Wand2, Info, X } from 'lucide-react';
import AppHeader from '../../components/AppHeader'; // تأكد إن مسار الاستدعاء ده مطابق لمكان ملف AppHeader عندك

// قاعدة البيانات المحلية للعرض (المنهج العماني - الفصل الدراسي الثاني)
const semesterOneData = {
  "الصف الأول": ["النشيد الوطني", "العلامة الإيقاعية النوار والسكتة المقابلة لها", "الحدة والغلظة - السرعة والبطء", "اللعبة الشعبية (حبوه موه تدوري)", "المدرج الموسيقي ومفتاح صول", "تطبيقات على المدرج الموسيقي"],
  "الصف الثاني": ["النشيد الوطني", "سلم (دو) الكبير وإشارات اليد الدالة على الأثر النفسي", "تدريبات صوتية وغنائية", "العلامة الإيقاعية البلانش والسكتة المقابلة لها", "نشيد (أقسمت أحبك يا وطني)", "الشدة والخفوت"],
  "الصف الثالث": ["نشيد (موطني)", "الشكل الإيقاعي (طفاتيفي)", "الكريشيندو والديمنويندو", "التيمينة", "آلة الإكسيلوفون", "عزف مقطوعة موسيقية على آلة الإكسيلوفون"],
  "الصف الرابع": ["تدريبات صوتية بالتظليلات", "نشيد (علم بلادي)", "الشكل الإيقاعي (طفاتي)", "نشيد (سلامتي)", "آلة الأورج", "عزف مقطوعة موسيقية على آلة الأورج"],
  "الصف الخامس": ["نشيد (نهضة متجددة)", "الميزان الرباعي", "العلامة الإيقاعية (الروند) والسكتة المقابلة لها", "آلة الأوكورديون", "قراءة إيقاعية وصولفيج غنائي", "عزف مقطوعة موسيقية على آلة الأكورديون"],
  "الصف السادس": ["الأزمنة الأساسية وتقسيماتها", "نشيد (عُمان عظيمة بشعبها )", "التمييز السمعي", "الشكل الإيقاعي (طفافي)", "قراءة إيقاعية وصولفيج غنائي", "عزف مقطوعة موسيقية"]
};

const semesterTwoData = {
  "الصف الأول": ["نشيد (أرقامي)", "العلامة الإيقاعية الكروش والسكتة المقابلة لها", "إيقاع حركي", "نشيد (أسرتي)", "آلات الباند", "عزف مقطوعة على آلات الباند"],
  "الصف الثاني": ["اللعبة الشعبية (حدلجي مدلجي)", "الميزان الثنائي", "قراءة إيقاعية وغناء صولفائي", "نشيد (أركان الإسلام)", "عزف مقطوعة موسيقية على آلات الباند", "إيقاع حركي للبلانش (ل)"],
  "الصف الثالث": ["نشيد (الصوم)", "الشكل الإيقاعي ()1", "إيقاع حركي ()", "نشيد (نظافتي)", "قراءة إيقاعية وغناء صولفائي", "النغمات الصاعدة والهابطة والمتكررة"],
  "الصف الرابع": ["اللعبة الشعبية (تراني بقطع السناسل)", "الميزان الثلاثي", "إيقاع حركي ()1", "نشيد (حرف الأجداد)", "أربيج سلم (دو) الكبير", "قراءة إيقاعية وغناء صولفائي"],
  "الصف الخامس": ["فنا (الرزحة) و (الكيذا)", "نشيدان من فني (الرزحة) و (الكيذا)", "التمييز بين الموازين الموسيقية البسيطة", "إملاء إيقاعي", "قراءة إيقاعية وصولفيج غنائي", "عزف مقطوعة موسيقية"],
  "الصف السادس": ["فنا (المديمة) و (الحمبورة)", "نشيدان من فني (المديمة) و (الحمبورة)", "إملاء إيقاعي", "المرجع (ذو الخطين)", "قراءة إيقاعية وصولفيج غنائي", "عزف مقطوعة موسيقية"],
  "الصف السابع": ["فنا (البرعة، وطبل النساء)", "نشيدان من فني (البرعة، وطبل النساء)", "شخصية موسيقية عُمانية (سالم بن علي بن سعيد)", "مقام عجم عشيران", "قراءة إيقاعية وغناء صولفائي", "عزف مقطوعة موسيقية"]
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

  const showToast = (message) => {
    setToast(message);
    // خلينا التوست يستمر 60 ثانية (دقيقة كاملة) عشان المعلم يلحق يشوفه ويتصرف
    setTimeout(() => setToast(null), 60000); 
  };

  const availableGrades = semester ? Object.keys(syllabusData[semester] || {}) : [];
  const availableLessons = (semester && grade) ? syllabusData[semester][grade] : [];

  const handleGenerate = async () => {
    if (!grade || !lessonTitle) {
      alert("يرجى اختيار الصف وعنوان الدرس أولاً.");
      return;
    }

    setIsLoading(true);
    setGeneratedData(null);
    setIsSent(false);

    try {
      const res = await fetch('/api/factory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ semester, grade, lessonTitle, notes })
      });

      const result = await res.json();
      if (result.success) {
        setGeneratedData(result.data);
      } else {
        showToast(result.error); // هيعرض الرسالة اللي جاية من الباك إند في التوست
      }
    } catch (error) {
      showToast("حدث خطأ في الاتصال بالخادم.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAutomate = () => {
    if (typeof window !== 'undefined' && generatedData) {
      window.dispatchEvent(new CustomEvent('MusiTeacherData', { detail: generatedData }));
    }
    setIsSent(true);
    setTimeout(() => setIsSent(false), 3000);
  };

  return (
    <>
      <AppHeader />
      {/* الـ Wrapper ده هيستخدم الـ CSS المخصص عشان يقلب أزرق في النهار وشفاف في الليل */}
      <div className="min-h-screen w-full factory-blue-bg transition-colors duration-500">

        <div className="relative min-h-[80vh] flex flex-col items-center pt-32 px-4">
        <h1 className="text-3xl md:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-yellow-300 mb-8 drop-shadow-md text-center">
          مصنع التحضيرات المتطورة 🪄
        </h1>

      {/* تحويل الحاوية لزجاج مصنفر أنيق يعكس الإضاءة */}
      <div className="w-full max-w-3xl bg-[#0f2027]/70 backdrop-blur-md p-8 rounded-2xl border border-emerald-500/30 shadow-2xl mb-8">
        {/* باقي الكود كما هو من أول الـ select بتاع الفصل الدراسي */}
        {/* 1. اختيار الفصل الدراسي */}
        <div className="mb-6">
          <label className="block text-gray-300 mb-2">الفصل الدراسي:</label>
          <select 
            value={semester} 
            onChange={(e) => {
              setSemester(e.target.value);
              setGrade('');
              setLessonTitle('');
            }}
            className="w-full bg-[#0f2027] text-white border border-gray-600 rounded-lg px-4 py-3 focus:border-orange-500 focus:outline-none"
          >
            <option value="" disabled>اختر الفصل الدراسي...</option>
            <option value="الفصل الدراسي الأول">الفصل الدراسي الأول</option>
            <option value="الفصل الدراسي الثاني">الفصل الدراسي الثاني</option>
          </select>
        </div>

        {/* 2. باقي الحقول تظهر عند اختيار أي فصل دراسي */}
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

            <div className="mb-6 animate-fade-in">
              <label className="block text-gray-300 mb-2">ملاحظات إضافية (اختياري):</label>
              <textarea 
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="مثال: ركز على استخدام استراتيجية التعلم التعاوني..."
                className="w-full bg-[#0f2027] text-white border border-gray-600 rounded-lg px-4 py-3 h-24 focus:border-orange-500 focus:outline-none"
              />
            </div>

            {/* الحاوية النسبية التي تجمع الزر والتوست الغطاء */}
            <div className="relative w-full animate-fade-in mt-2">
              <button 
                onClick={handleGenerate}
                // منع الضغط برمجياً أيضاً إذا كان التوست ظاهراً
                disabled={isLoading || toast !== null}
                className="w-full bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white font-bold py-4 rounded-xl shadow-lg transition-all flex justify-center items-center gap-2"
              >
                {isLoading ? <Loader2 className="animate-spin" size={24} /> : <Wand2 size={24} />}
                {isLoading ? 'جاري بناء التحضير (نرجو الانتظار، نتعامل مع ضغط الخوادم بذكاء)...' : 'توليد التحضير الآن'}
              </button>

              {toast && (
  <div className="absolute -inset-2 z-50 flex items-center justify-center" dir="rtl">
    {/* طبقة النبض الخارجية فقط (Shadow Pulse) */}
    <div className="absolute inset-0 rounded-2xl border-2 border-red-400 shadow-[0_0_40px_rgba(239,68,68,1)] animate-pulse"></div>
    
    {/* طبقة المحتوى الثابتة - باللون المتزن والحد الداكن الأنيق */}
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

      {/* عرض النتيجة */}
      {generatedData && (
        <div className="w-full max-w-4xl bg-white text-gray-900 rounded-2xl shadow-2xl overflow-hidden p-8">
          <h2 className="text-2xl font-bold text-center mb-6 text-blue-900 border-b pb-4">
            تم تجهيز درس ({lessonTitle}) بنجاح!
          </h2>
          
          <div className="space-y-4 mb-8 opacity-90 text-right" dir="rtl">
            <p className="text-sm text-gray-600 text-center mb-6 font-bold bg-blue-50 p-3 rounded-lg border border-blue-100">
              *هذه معاينة سريعة، سيتم إدراج التحضير بكامل تفاصيله وتنسيقاته في منصة البوابة التعليمية (نور).*
            </p>
            
            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
              <strong className="block mb-3 text-blue-800 text-lg border-b pb-2">الاستراتيجيات التعليمية:</strong> 
              <div className="text-gray-700 leading-relaxed font-bold text-indigo-600">{generatedData.other_strategies}</div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
              <strong className="block mb-3 text-blue-800 text-lg border-b pb-2">المصادر التعليمية:</strong> 
              <div className="text-gray-700 leading-relaxed">{generatedData.other_learning_resources}</div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
              <strong className="block mb-3 text-blue-800 text-lg border-b pb-2">المفاهيم والمصطلحات:</strong> 
              <div className="text-gray-700 leading-relaxed font-medium">{generatedData.lesson_vocabulary || "لا يوجد"}</div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
              <strong className="block mb-3 text-blue-800 text-lg border-b pb-2">التهيئة / التمهيد / التعلم القبلي:</strong> 
              <div className="text-gray-700 leading-relaxed space-y-2" dangerouslySetInnerHTML={{ __html: generatedData.preparation }} />
            </div>

            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
              <strong className="block mb-3 text-blue-800 text-lg border-b pb-2">إجراءات سير الدرس / الأنشطة التدريسية:</strong> 
              <div className="text-gray-700 leading-relaxed space-y-2" dangerouslySetInnerHTML={{ __html: generatedData.thinking_skills }} />
            </div>

            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
              <strong className="block mb-3 text-blue-800 text-lg border-b pb-2">التقويم التكويني:</strong> 
              <div className="text-gray-700 leading-relaxed space-y-2" dangerouslySetInnerHTML={{ __html: generatedData.formative_assessment }} />
            </div>

            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
              <strong className="block mb-3 text-blue-800 text-lg border-b pb-2">التقويم الختامي:</strong> 
              <div className="text-gray-700 leading-relaxed space-y-2" dangerouslySetInnerHTML={{ __html: generatedData.closing_assessment || "<p>لا يوجد أسئلة للتقويم الختامي.</p>" }} />
            </div>

            {generatedData.weekly_notes && generatedData.weekly_notes.trim() !== "" && (
              <div className="bg-yellow-50 p-5 rounded-xl border border-yellow-200 shadow-sm">
                <strong className="block mb-3 text-yellow-800 text-lg border-b border-yellow-200 pb-2">ملاحظات ضمن خطة الدراسة الأسبوعية:</strong> 
                <div className="text-gray-800 leading-relaxed space-y-2" dangerouslySetInnerHTML={{ __html: generatedData.weekly_notes }} />
              </div>
            )}
          </div>
          <button 
            onClick={handleAutomate}
            className={`w-full py-4 rounded-xl font-bold text-2xl flex items-center justify-center gap-3 transition-all duration-300 shadow-lg ${
              isSent ? 'bg-green-600' : 'bg-gradient-to-r from-purple-600 to-blue-600'
            } text-white`}
          >
            {isSent ? <CheckCircle size={32} /> : <Send size={32} />}
            {isSent ? 'تم الإرسال للمتصفح بنجاح!' : 'أتمتة وإدراج في البوابة التعليمية 🪄'}
          </button>
        </div>
      )}
    </div>
    </div> {/* هذا الـ div هو إغلاق الـ Wrapper الجديد */}
    </>
  );
}