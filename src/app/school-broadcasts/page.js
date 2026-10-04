"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import broadcastsData from "@/data/school-broadcasts.json";

export default function SchoolBroadcastsPage() {
  const [category, setCategory] = useState("");
  const [topic, setTopic] = useState("");
  
  const [topicsList, setTopicsList] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [broadcastDetails, setBroadcastDetails] = useState(null);
  const [displayedText, setDisplayedText] = useState("");
  const [copied, setCopied] = useState(false);

  const categories = Object.keys(broadcastsData);

  // تحديث المواضيع بناءً على القسم المختار
  const handleCategoryChange = (e) => {
    const val = e.target.value;
    setCategory(val);
    setTopic("");
    setBroadcastDetails(null);
    setDisplayedText("");
    if (val) {
      setTopicsList(Object.keys(broadcastsData[val]));
    } else {
      setTopicsList([]);
    }
  };

  // معالجة اختيار موضوع الإذاعة وتوليد النص
  const handleTopicChange = (e) => {
    const val = e.target.value;
    setTopic(val);
    
    if (val) {
      setIsLoading(true);
      setBroadcastDetails(null);
      setDisplayedText("");
      
      setTimeout(() => {
        const data = broadcastsData[category]?.[val];
        if (data) {
          setBroadcastDetails(data);
        }
        setIsLoading(false);
      }, 1800);
    } else {
      setBroadcastDetails(null);
      setDisplayedText("");
    }
  };

  // تأثير الآلة الكاتبة لعرض فقرات الإذاعة
  useEffect(() => {
    if (broadcastDetails) {
      const textToType = broadcastDetails.content;
      let i = 0;
      setDisplayedText("");
      
      const typingInterval = setInterval(() => {
        if (i < textToType.length) {
          setDisplayedText((prev) => prev + textToType.charAt(i));
          i++;
        } else {
          clearInterval(typingInterval);
        }
      }, 20);
      
      return () => clearInterval(typingInterval);
    }
  }, [broadcastDetails]);

  // نسخ المحتوى للسبورة أو الحافظة
  const handleCopy = () => {
    if (broadcastDetails) {
      navigator.clipboard.writeText(broadcastDetails.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="min-h-screen p-6 md:p-10 bg-gradient-to-br from-slate-950 via-gray-950 to-slate-900 text-white font-sans" dir="rtl">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* أزرار العودة والتنقل */}
        <div className="flex items-center justify-between gap-4 pb-2">
          <Link
            href="/tools"
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-pink-300 bg-white/5 border border-pink-500/30 rounded-xl backdrop-blur-md hover:bg-pink-500/10 hover:border-pink-400 hover:text-pink-200 transition-all duration-300 shadow-[0_0_15px_rgba(244,114,182,0.15)] group"
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

        {/* الهيدر الرئيسي مع نيون وردي مطابق لبطاقة الأداة */}
        <header className="text-center space-y-4 mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-pink-500/10 border border-pink-500/30 text-pink-400 text-xs md:text-sm font-semibold shadow-[0_0_15px_rgba(244,114,182,0.2)]">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"></path></svg>
            <span>استوديو الإذاعة المدرسية الذكي</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-extrabold text-transparent bg-clip-text bg-gradient-to-l from-pink-400 via-rose-500 to-purple-500 leading-normal pb-2">
            Radio Station AI
          </h1>
          <p className="text-gray-300 text-lg md:text-xl font-light">
            حدد تصنيف وموضوع الإذاعة ليقوم <span className="font-semibold text-pink-400">المُساعد الذكي</span> بتوليد فقراتها وتجهيز ملف التحميل
          </p>
        </header>

        {/* أشرطة الاختيار */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 backdrop-blur-md bg-white/5 border border-white/10 rounded-2xl p-6 shadow-2xl relative z-10">
          <div>
            <label className="block text-sm font-medium text-pink-300 mb-2">1. تصنيف الإذاعة</label>
            <select 
              value={category} 
              onChange={handleCategoryChange}
              className="w-full bg-gray-900/90 border border-gray-700 hover:border-pink-500/60 rounded-xl p-4 text-white focus:outline-none focus:border-pink-400 focus:shadow-[0_0_20px_rgba(244,114,182,0.3)] transition-all cursor-pointer"
            >
              <option value="">-- اختر المجال / التصنيف --</option>
              {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-pink-300 mb-2">2. موضوع الإذاعة</label>
            <select 
              value={topic} 
              onChange={handleTopicChange}
              disabled={!category}
              className="w-full bg-gray-900/90 border border-gray-700 hover:border-pink-500/60 rounded-xl p-4 text-white focus:outline-none focus:border-pink-400 focus:shadow-[0_0_20px_rgba(244,114,182,0.3)] transition-all disabled:opacity-40 cursor-pointer"
            >
              <option value="">-- اختر موضوع الإذاعة --</option>
              {topicsList.map(top => <option key={top} value={top}>{top}</option>)}
            </select>
          </div>
        </div>

        {/* الغرفة الزجاجية لعرض فقرات الإذاعة والتنزيل */}
        <div className="min-h-[350px] backdrop-blur-xl bg-white/[0.03] border border-white/10 hover:bg-white/[0.05] hover:border-pink-500/30 rounded-3xl p-8 md:p-10 shadow-[0_8px_32px_0_rgba(0,0,0,0.5)] relative overflow-hidden transition-all duration-500">
          
          <div className="absolute -top-40 -right-40 w-96 h-96 bg-pink-500/10 blur-[100px] pointer-events-none"></div>
          <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-purple-600/10 blur-[100px] pointer-events-none"></div>

          {!topic && !isLoading && (
            <div className="h-full flex flex-col items-center justify-center text-gray-500 space-y-4 min-h-[250px]">
              <svg className="w-20 h-20 opacity-20 text-pink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"></path></svg>
              <p className="text-lg">في انتظار اختيار الموضوع لبدء هندسة وتوليد الفقرات الإذاعية...</p>
            </div>
          )}

          {isLoading && (
            <div className="h-full flex flex-col items-center justify-center space-y-6 min-h-[250px] text-pink-400">
              <div className="relative w-16 h-16">
                <div className="absolute inset-0 border-4 border-pink-500/20 rounded-full"></div>
                <div className="absolute inset-0 border-4 border-pink-500 rounded-full border-t-transparent animate-spin"></div>
              </div>
              <p className="animate-pulse font-medium text-lg tracking-wide">جاري تجميع وصياغة الفقرات الإذاعية...</p>
            </div>
          )}

          {broadcastDetails && !isLoading && (
            <div className="space-y-6 relative z-10">
              
              {/* شريط الإجراءات: العنوان + أزرار النسخ والتحميل */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-6">
                <div className="flex items-center space-x-3 space-x-reverse">
                  <div className="w-3.5 h-3.5 bg-pink-400 rounded-full animate-pulse shadow-[0_0_12px_rgba(244,114,182,0.8)]"></div>
                  <h3 className="text-2xl font-bold text-pink-300">{broadcastDetails.title}</h3>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/15 hover:bg-white/10 text-gray-200 rounded-xl text-sm font-medium transition-all"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                    <span>{copied ? "تم النسخ!" : "نسخ النص"}</span>
                  </button>

                  <a
                    href={broadcastDetails.pdfUrl}
                    download
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-pink-500 to-rose-600 hover:from-pink-600 hover:to-rose-700 text-white rounded-xl text-sm font-semibold shadow-[0_0_20px_rgba(244,114,182,0.4)] hover:shadow-[0_0_25px_rgba(244,114,182,0.6)] transition-all"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                    <span>تحميل الإذاعة PDF</span>
                  </a>
                </div>
              </div>

              {/* كود عرض السطور مع الآلة الكاتبة ومؤشر النيون الوردي */}
              <div className="text-lg md:text-xl leading-relaxed text-gray-200 font-medium tracking-wide space-y-4 pt-2">
                {displayedText.split("\n").map((line, idx, arr) => {
                  const isLastLine = idx === arr.length - 1;
                  const cursorNode = isLastLine ? (
                    <span className="inline-block w-2.5 h-6 bg-gradient-to-b from-pink-300 to-rose-500 mx-1 animate-pulse align-middle rounded-sm shadow-[0_0_10px_rgba(244,114,182,0.8)]"></span>
                  ) : null;

                  return (
                    <div key={idx} className="bg-black/20 p-4 rounded-xl border border-white/5 hover:border-pink-500/20 transition-all">
                      <span className="text-gray-200 [unicode-bidi:isolate]" dir="rtl">
                        {line}
                      </span>
                      {cursorNode}
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