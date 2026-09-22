'use client';
import { useState } from 'react';
import Link from 'next/link'; // تأكد من استيراد Link
import { X, Send, AlertCircle, CheckCircle } from 'lucide-react';

export default function PreparationPage() {
  const [selectedGrade, setSelectedGrade] = useState('');
  const [selectedLesson, setSelectedLesson] = useState(null);
  const [showAlert, setShowAlert] = useState(false);
  const [isSent, setIsSent] = useState(false);

  const grades = [
    "الصف الأول", "الصف الثاني", "الصف الثالث", "الصف الرابع", 
    "الصف الخامس", "الصف السادس", "الصف السابع", "الصف الثامن", 
    "الصف التاسع", "الصف العاشر", "الحادي عشر", "الثاني عشر"
  ];

  const lessonsData = {
    "الصف الأول": [
      { 
        id: 1, 
        title: "درس السلم الموسيقي", 
        isReady: true, 
        noorData: {
          preparation: "<p>نستمع مع الطلبة إلى مقطوعة موسيقية بسيطة ونسألهم عن الأصوات...</p>",
          lesson_vocabulary: "السلم الموسيقي، المدرج، العلامات الإيقاعية",
          thinking_skills: "<p>1- يعرض المعلم السلم الموسيقي - (باستخدام العرض التوضيحي)<br>2- يغني الطلبة السلم - (باستخدام التكرار والممارسة)</p>",
          formative_assessment: "<p>غناء السلم صعوداً وهبوطاً بشكل جماعي</p>",
          closing_assessment: "<p>ما هي النغمة الأساسية التي يبدأ بها السلم الموسيقي؟</p>",
          other_strategies: "العرض التوضيحي، التكرار والممارسة",
          other_learning_resources: "آلة الأورج، السبورة الذكية، بطاقات ملونة"
        }
      },
      { id: 2, title: "درس الإيقاع الثنائي", isReady: false }
    ]
  };

  const handleSelectLesson = (lesson) => {
    if (lesson.isReady) {
      setSelectedLesson(lesson);
      setShowAlert(false);
      setIsSent(false);
    } else {
      setShowAlert(true);
      setTimeout(() => setShowAlert(false), 3000);
    }
  };

  const handleAutomate = () => {
    const payload = selectedLesson.noorData;
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('MusiTeacherData', { detail: payload }));
    }
    setIsSent(true);
    setTimeout(() => setIsSent(false), 3000);
  };

  return (
    <div className="relative min-h-[80vh] flex flex-col items-center p-6">
      
      {/* زر العودة للرئيسية */}
      <div className="w-full max-w-4xl flex justify-start mb-4">
        <Link 
          href="/dashboard" 
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-all bg-black/30 px-4 py-2 rounded-lg border border-gray-800 hover:border-gray-600"
        >
          <span>←</span> العودة للرئيسية
        </Link>
      </div>

      <h1 className="text-4xl font-bold text-neonBlue mb-8 drop-shadow-md">
        بنك التحضيرات المتطورة
      </h1>

      {showAlert && (
        <div className="absolute top-20 bg-orange-500 text-white px-6 py-3 rounded-full shadow-lg flex items-center gap-2 animate-bounce transition-all">
          <AlertCircle size={24} />
          <span className="font-bold text-lg">هذا الدرس قيد الإعداد حالياً وسيتم إضافته قريباً بإذن الله.</span>
        </div>
      )}

      {!selectedLesson ? (
        <div className="w-full max-w-2xl bg-black/40 p-8 rounded-2xl border border-gray-700 shadow-xl">
          <p className="text-gray-300 mb-4 text-lg">يرجى اختيار الصف الدراسي:</p>
          <select 
            value={selectedGrade} 
            onChange={(e) => setSelectedGrade(e.target.value)}
            className="w-full bg-[#0f2027] text-white border border-gray-600 rounded-lg px-4 py-3 mb-6 focus:border-neonBlue focus:outline-none"
          >
            <option value="" disabled>اختر الصف...</option>
            {grades.map(grade => <option key={grade} value={grade}>{grade}</option>)}
          </select>

          {selectedGrade && (
            <div className="mt-4 border-t border-gray-700 pt-6">
              <p className="text-gray-300 mb-4 text-lg">دروس {selectedGrade}:</p>
              <div className="grid grid-cols-1 gap-3">
                {lessonsData[selectedGrade]?.map(lesson => (
                  <button 
                    key={lesson.id}
                    onClick={() => handleSelectLesson(lesson)}
                    className="flex justify-between items-center w-full bg-gray-800 hover:bg-gray-700 text-white font-bold py-3 px-6 rounded-lg transition duration-200"
                  >
                    <span>{lesson.title}</span>
                    {!lesson.isReady && <span className="text-orange-400 text-sm font-normal">جاري الإعداد...</span>}
                  </button>
                )) || <p className="text-gray-400">لا توجد دروس مضافة حالياً لهذا الصف.</p>}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="w-full max-w-4xl bg-white text-gray-900 rounded-2xl shadow-2xl overflow-hidden relative">
          <div className="bg-gradient-to-r from-red-600 to-red-800 p-4 flex justify-between items-center text-white">
            <div>
              <p className="text-sm opacity-80">{selectedGrade} / وحدة الموسيقى</p>
              <h2 className="text-2xl font-bold">{selectedLesson.title}</h2>
            </div>
            <button onClick={() => setSelectedLesson(null)} className="hover:bg-red-900 p-2 rounded-full transition">
              <X size={28} />
            </button>
          </div>
          <div className="p-6 space-y-6">
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <h3 className="font-bold text-lg text-blue-800 mb-2">المفاهيم والمصطلحات</h3>
              <p>{selectedLesson.noorData.lesson_vocabulary}</p>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <h3 className="font-bold text-lg text-blue-800 mb-2">إجراءات سير الدرس</h3>
              <div dangerouslySetInnerHTML={{ __html: selectedLesson.noorData.thinking_skills }} />
            </div>
            <button 
              onClick={handleAutomate}
              className={`w-full py-4 mt-8 rounded-xl font-bold text-2xl flex items-center justify-center gap-3 transition-all ${
                isSent ? 'bg-green-600' : 'bg-gradient-to-r from-purple-600 to-blue-600'
              } text-white`}
            >
              {isSent ? <CheckCircle size={32} /> : <Send size={32} />}
              {isSent ? 'تم الإرسال!' : 'أتمتة وإدراج في منصة نور 🪄'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}