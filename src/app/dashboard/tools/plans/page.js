"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import plansData from "@/data/semester-plans.json";
export default function SemesterPlansPage() {
  const [semester, setSemester] = useState("");
  const [grade, setGrade] = useState("");
  const [lesson, setLesson] = useState("");
  
  const [grades, setGrades] = useState([]);
  const [lessons, setLessons] = useState([]);
  
  const [isLoading, setIsLoading] = useState(false);
  const [planDetails, setPlanDetails] = useState(null);
  const [displayedText, setDisplayedText] = useState("");

  const semesters = Object.keys(plansData);

  // تحديث الصفوف بناءً على الفصل الدراسي
  const handleSemesterChange = (e) => {
    const val = e.target.value;
    setSemester(val);
    setGrade("");
    setLesson("");
    setPlanDetails(null);
    setDisplayedText("");
    if (val) {
      setGrades(Object.keys(plansData[val]));
    } else {
      setGrades([]);
    }
  };

  // تحديث الدروس بناءً على الصف
  const handleGradeChange = (e) => {
    const val = e.target.value;
    setGrade(val);
    setLesson("");
    setPlanDetails(null);
    setDisplayedText("");
    if (val) {
      setLessons(Object.keys(plansData[semester][val]));
    } else {
      setLessons([]);
    }
  };

  // معالجة اختيار الدرس وتشغيل محاكاة الذكاء الاصطناعي
  const handleLessonChange = (e) => {
    const val = e.target.value;
    setLesson(val);
    
    if (val) {
      setIsLoading(true);
      setPlanDetails(null);
      setDisplayedText("");
      
      // محاكاة تحميل الذكاء الاصطناعي
      // محاكاة تحميل الذكاء الاصطناعي
              setTimeout(() => {
                const data = plansData[semester]?.[grade]?.[val];
                if (data) {
                  setPlanDetails(data);
                } else {
                  setPlanDetails({ duration: "غير متوفرة", weeks: "غير متوفر", expectedDates: "غير متوفر" });
                }
                setIsLoading(false);
              }, 2000);
    } else {
      setPlanDetails(null);
      setDisplayedText("");
    }
  };

  // تأثير الآلة الكاتبة لعرض الخطة
  useEffect(() => {
    if (planDetails) {
      const cleanDates = (planDetails.expectedDates || "").replace(/\/+$/, '');
      const textToType = `📌 الأسابيع المخصصة لعرض الدرس: ${planDetails.weeks}\n📅 التواريخ المقررة وفقاً للخطة الدراسية للعام الدراسي \u200E2026/2027\u200E: \u200E${cleanDates}\u200E`;
      let i = 0;
      setDisplayedText("");
      
      const typingInterval = setInterval(() => {
        if (i < textToType.length) {
          setDisplayedText((prev) => prev + textToType.charAt(i));
          i++;
        } else {
          clearInterval(typingInterval);
        }
      }, 30); // سرعة الكتابة
      
      return () => clearInterval(typingInterval);
    }
  }, [planDetails]);

  return (
    <div className="min-h-screen p-8 bg-gradient-to-br from-slate-900 via-gray-900 to-black text-white font-sans" dir="rtl">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* أزرار التنقل والعودة */}
        <div className="flex items-center justify-between gap-4 pb-2">
          <Link
            href="/dashboard/tools"
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-cyan-300 bg-white/5 border border-cyan-500/30 rounded-xl backdrop-blur-md hover:bg-cyan-500/10 hover:border-cyan-400 hover:text-cyan-200 transition-all duration-300 shadow-[0_0_15px_rgba(34,211,238,0.15)] group"
          >
            <svg className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
            <span>العودة للأدوات</span>
          </Link>

          <Link
            href="/"
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-300 bg-white/5 border border-white/10 rounded-xl backdrop-blur-md hover:bg-white/10 hover:border-white/20 hover:text-white transition-all duration-300"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            <span>الصفحة الرئيسية</span>
          </Link>
        </div>

        <header className="text-center space-y-5 mb-12">
          <h1 className="text-4xl md:text-6xl font-extrabold text-transparent bg-clip-text bg-gradient-to-l from-cyan-400 via-blue-500 to-purple-500 leading-normal md:leading-normal pb-2 drop-shadow-sm">
            Plan Generator
          </h1>
          <p className="text-gray-300 text-lg md:text-xl font-light tracking-wide">
            حدد الدرس ليقوم <span className="font-semibold text-cyan-400"> مُولِّد الخطط الفصلية الذكي</span> بتوليد الاسبوع والتاريخ المقرر لعرض الدرس 
          </p>
        </header>

        {/* أدوات التحكم والاختيار */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 backdrop-blur-md bg-white/5 border border-white/10 rounded-2xl p-6 shadow-2xl relative z-10">
          <select 
            value={semester} 
            onChange={handleSemesterChange}
            className="w-full bg-gray-900/90 border border-gray-700 hover:border-cyan-500/60 hover:shadow-[0_0_15px_rgba(34,211,238,0.15)] rounded-xl p-4 text-white focus:outline-none focus:border-cyan-400 focus:shadow-[0_0_20px_rgba(34,211,238,0.3)] transition-all duration-300 shadow-inner cursor-pointer"
          >
            <option value="">-- اختر الفصل الدراسي --</option>
            {semesters.map(sem => <option key={sem} value={sem}>{sem}</option>)}
          </select>

          <select 
            value={grade} 
            onChange={handleGradeChange}
            disabled={!semester}
            className="w-full bg-gray-900/90 border border-gray-700 hover:border-cyan-500/60 hover:shadow-[0_0_15px_rgba(34,211,238,0.15)] rounded-xl p-4 text-white focus:outline-none focus:border-cyan-400 focus:shadow-[0_0_20px_rgba(34,211,238,0.3)] transition-all duration-300 disabled:opacity-40 disabled:hover:border-gray-700 disabled:hover:shadow-none shadow-inner cursor-pointer"
          >
            <option value="">-- اختر الصف --</option>
            {grades.map(g => <option key={g} value={g}>{g}</option>)}
          </select>

          <select 
            value={lesson} 
            onChange={handleLessonChange}
            disabled={!grade}
            className="w-full bg-gray-900/90 border border-gray-700 hover:border-cyan-500/60 hover:shadow-[0_0_15px_rgba(34,211,238,0.15)] rounded-xl p-4 text-white focus:outline-none focus:border-cyan-400 focus:shadow-[0_0_20px_rgba(34,211,238,0.3)] transition-all duration-300 disabled:opacity-40 disabled:hover:border-gray-700 disabled:hover:shadow-none shadow-inner cursor-pointer"
          >
            <option value="">-- اختر الدرس --</option>
            {lessons.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>

        {/* الغرفة الزجاجية (Glass Room) لعرض المخرجات */}
        <div className="min-h-[300px] backdrop-blur-xl bg-white/[0.03] border border-white/10 hover:bg-white/[0.05] hover:border-cyan-500/30 hover:shadow-[0_8px_40px_0_rgba(34,211,238,0.15)] rounded-3xl p-8 md:p-10 shadow-[0_8px_32px_0_rgba(0,0,0,0.5)] relative overflow-hidden transition-all duration-500 group">
          
          {/* تأثير الإضاءة الخلفية للغرفة الزجاجية */}
          <div className="absolute -top-40 -right-40 w-96 h-96 bg-cyan-500/10 blur-[100px] pointer-events-none transition-opacity duration-1000"></div>
          <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-blue-600/10 blur-[100px] pointer-events-none transition-opacity duration-1000"></div>

          {!lesson && !isLoading && (
            <div className="h-full flex flex-col items-center justify-center text-gray-500 space-y-4 min-h-[200px]">
              <svg className="w-16 h-16 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
              <p className="text-lg">في انتظار تحديد الدرس لبدء التحليل وبناء الخطة...</p>
            </div>
          )}

          {isLoading && (
            <div className="h-full flex flex-col items-center justify-center space-y-6 min-h-[200px] text-cyan-400">
              <div className="relative w-16 h-16">
                <div className="absolute inset-0 border-4 border-cyan-500/20 rounded-full"></div>
                <div className="absolute inset-0 border-4 border-cyan-500 rounded-full border-t-transparent animate-spin"></div>
              </div>
              <p className="animate-pulse font-medium text-lg tracking-wide">الذكاء الاصطناعي يقوم بتحليل وتوليد الخطة الزمنية...</p>
            </div>
          )}

          {planDetails && !isLoading && (
            <div className="space-y-6 relative z-10">
              <div className="flex items-center space-x-3 space-x-reverse mb-6 border-b border-white/10 pb-5">
                <div className="w-3 h-3 bg-cyan-400 rounded-full animate-pulse shadow-[0_0_10px_rgba(34,211,238,0.8)]"></div>
                <h3 className="text-2xl font-semibold text-cyan-300">نتيجة البحث</h3>
              </div>
              <div className="text-xl md:text-2xl leading-loose text-gray-200 font-medium tracking-wide space-y-4">
                {displayedText.split("\n").map((line, idx, arr) => {
                  const colonIdx = line.indexOf(":");
                  const isLastLine = idx === arr.length - 1;
                  const cursorNode = isLastLine ? (
                    <span className="inline-block w-3 h-7 bg-gradient-to-b from-cyan-300 to-blue-500 mx-1 animate-pulse align-middle rounded-sm shadow-[0_0_10px_rgba(34,211,238,0.8)]"></span>
                  ) : null;
                  
                  if (idx === 0) {
                    if (colonIdx !== -1) {
                      const titlePart = line.slice(0, colonIdx + 1);
                      const valuePart = line.slice(colonIdx + 1);
                      return (
                        <div key={idx}>
                          <span className="font-bold text-cyan-400 drop-shadow-[0_0_12px_rgba(34,211,238,0.6)] ml-2">
                            {titlePart}
                          </span>
                          <span className="text-gray-200 [unicode-bidi:isolate]" dir="rtl">
                            {valuePart}{cursorNode}
                          </span>
                        </div>
                      );
                    }
                    return (
                      <div key={idx}>
                        <span className="font-bold text-cyan-400 drop-shadow-[0_0_12px_rgba(34,211,238,0.6)]">
                          {line}{cursorNode}
                        </span>
                      </div>
                    );
                  }

                  if (idx === 1) {
                    if (colonIdx !== -1) {
                      const titlePart = line.slice(0, colonIdx + 1);
                      const valuePart = line.slice(colonIdx + 1);
                      return (
                        <div key={idx}>
                          <span className="font-bold text-purple-400 drop-shadow-[0_0_12px_rgba(168,85,247,0.6)] ml-2">
                            {titlePart}
                          </span>
                          <span className="text-gray-200 [unicode-bidi:isolate]" dir="rtl">
                            {valuePart}{cursorNode}
                          </span>
                        </div>
                      );
                    }
                    return (
                      <div key={idx}>
                        <span className="font-bold text-purple-400 drop-shadow-[0_0_12px_rgba(168,85,247,0.6)]">
                          {line}{cursorNode}
                        </span>
                      </div>
                    );
                  }

                  return (
                    <div key={idx}>
                      <span className="text-gray-200 [unicode-bidi:isolate]" dir="rtl">
                        {line}{cursorNode}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}