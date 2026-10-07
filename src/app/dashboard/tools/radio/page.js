"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { Lock, X } from "lucide-react";
import { Cairo, Amiri } from "next/font/google";
import broadcastsData from "@/data/school-broadcasts.json";
// 1. استيراد ملفات الحماية ونافذة الاشتراكات
import { useAuth } from "@/context/AuthContext"; 
import PricingModal from "@/components/PricingModal";
const cairo = Cairo({ subsets: ["arabic"], weight: ["400", "600", "700"] });
const amiri = Amiri({ subsets: ["arabic"], weight: ["400", "700"] });

export default function SchoolBroadcastsPage() {
  // 2. سحب بيانات المستخدم والاشتراك من الكونتكست
  const { user, isSubscribed } = useAuth();
  
  // 3. حالة للتحكم في ظهور نافذة الاشتراكات والتنبيهات
  const [isPricingModalOpen, setIsPricingModalOpen] = useState(false);
  const [showLoginToast, setShowLoginToast] = useState(false);

  const [category, setCategory] = useState("");
  const [topic, setTopic] = useState("");
  
  const [topicsList, setTopicsList] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [broadcastDetails, setBroadcastDetails] = useState(null);
  const [displayedText, setDisplayedText] = useState("");
  const [copied, setCopied] = useState(false);
  const [isTypingFinished, setIsTypingFinished] = useState(false);

  // === حالات التعديل الجديدة ===
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState("");

  // === دوال التعديل ===
  const handleEditClick = () => {
    // تجميع النص بنفس طريقة النسخ لوضعه في مربع التعديل
    const fullText = broadcastDetails.sections 
      ? broadcastDetails.sections.map(sec => `📌 ${sec.title}\n${sec.content}`).join("\n\n")
      : (broadcastDetails.content || "");
    setEditText(fullText);
    setIsEditing(true);
  };

  const handleSaveEdit = () => {
    setDisplayedText(editText);
    // استبدال كائن الإذاعة الحالي بنسخة جديدة معدلة لا تحتوي على sections
    // لكي يقوم النسخ والطباعة بقراءة النص المعدل مباشرة دون المساس بالملف الأصلي
    setBroadcastDetails({
      title: broadcastDetails.title,
      content: editText
    });
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
  };
  // ==========================

  // استخراج التصنيفات (المناسبات) من الكائن الرئيسي
  const categories = Object.keys(broadcastsData || {});

  // تحديث المواضيع بناءً على القسم المختار
  const handleCategoryChange = (e) => {
    const val = e.target.value;
    setCategory(val);
    setTopic("");
    setBroadcastDetails(null);
    setDisplayedText("");
    if (val && broadcastsData[val]) {
      // جلب عناوين الإذاعات التي تنتمي للمناسبة المختارة
      const filteredTopics = Object.values(broadcastsData[val]).map(item => item.title);
      setTopicsList(filteredTopics);
    } else {
      setTopicsList([]);
    }
  };

  // 4. معالجة اختيار موضوع الإذاعة (هنا بنطبق الـ Police Patch)
  const handleTopicChange = (e) => {
    const val = e.target.value;
    
    // ==========================================
    // 🚨 جدار الحماية (Police Patch Guard) 🚨
    // ==========================================
    if (val) {
      if (!user) {
        setShowLoginToast(true);
        setTimeout(() => setShowLoginToast(false), 4500);
        setTopic(""); // إرجاع القائمة لحالتها الأصلية
        return;
      }
      
      if (!isSubscribed) {
        setIsPricingModalOpen(true); // فتح نافذة الترقية
        setTopic(""); // إرجاع القائمة لحالتها الأصلية
        return;
      }
    }
    // ==========================================

    setTopic(val);
    
    if (val) {
      setIsLoading(true);
      setBroadcastDetails(null);
      setDisplayedText("");
      setIsTypingFinished(false);
      setIsEditing(false); // تفريغ وضع التعديل عند اختيار إذاعة جديدة
      setEditText("");
      
      setTimeout(() => {
        // البحث عن الإذاعة ككائن كامل يطابق العنوان والمناسبة
        const categoryObj = broadcastsData[category] || {};
        const data = Object.values(categoryObj).find(item => item.title === val) || categoryObj[val];
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

  // تأثير الآلة الكاتبة لعرض الإذاعة مع فصل كلام المقدم والفقرات الأساسية عن الفقرات المقترحة في النهاية تماماً
  useEffect(() => {
    if (broadcastDetails) {
      let textToType = "";
      if (broadcastDetails.sections) {
        // فرز الفقرات الأساسية (المقدمة، القرآن، الحديث، الخاتمة، إلخ)
        const mainSections = broadcastDetails.sections.filter(sec => {
          const t = sec.title.toLowerCase();
          return !t.includes("مقترحة") && !t.includes("إضافية") && !t.includes("بديلة");
        });

        // فرز الفقرات المقترحة أو الإضافية لتكون في النهاية تماماً
        const suggestedSections = broadcastDetails.sections.filter(sec => {
          const t = sec.title.toLowerCase();
          return t.includes("مقترحة") || t.includes("إضافية") || t.includes("بديلة");
        });

        const mainText = mainSections.map(sec => `📌 ${sec.title}\n${sec.content}`).join("\n\n");
        
        if (suggestedSections.length > 0) {
          const suggestedText = suggestedSections.map(sec => `💡 ${sec.title}\n${sec.content}`).join("\n\n");
          // فصل تام وواضح في نهاية الإذاعة
          textToType = `${mainText}\n\n==============================\n💡 فقرات ومقترحات إضافية للإذاعة:\n==============================\n\n${suggestedText}`;
        } else {
          textToType = mainText;
        }
      } else {
        textToType = broadcastDetails.content || "عذراً، محتوى الإذاعة غير متوفر بصيغة صحيحة.";
      }

      let i = 0;
      setDisplayedText("");
      
      const typingInterval = setInterval(() => {
        if (i < textToType.length) {
          setDisplayedText((prev) => prev + textToType.charAt(i));
          i++;
        } else {
          clearInterval(typingInterval);
          setIsTypingFinished(true);
        }
      }, 20);
      
      return () => clearInterval(typingInterval);
    }
  }, [broadcastDetails]);

  // نسخ المحتوى للسبورة أو الحافظة
  const handleCopy = () => {
    if (broadcastDetails) {
      const fullText = broadcastDetails.sections 
        ? broadcastDetails.sections.map(sec => `📌 ${sec.title}\n${sec.content}`).join("\n\n")
        : (broadcastDetails.content || "");
        
      navigator.clipboard.writeText(fullText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // تجهيز الإذاعة للطباعة أو الحفظ كملف PDF
  const handlePrint = () => {
    if (!broadcastDetails) return;
    
    const printWindow = window.open('', '_blank');
    const contentHtml = broadcastDetails.sections 
      ? broadcastDetails.sections.map(sec => `
          <div class="section">
            <h3>📌 ${sec.title}</h3>
            <p>${sec.content}</p>
          </div>
        `).join('')
      : `<p style="white-space: pre-wrap; line-height: 1.9; color: #111; font-size: 18px;">${broadcastDetails.content || ""}</p>`;

    printWindow.document.write(`
      <html dir="rtl" lang="ar">
        <head>
          <title>${broadcastDetails.title}</title>
          <link href="https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Cairo:wght@600;700&display=swap" rel="stylesheet">
          <style>
            body { font-family: 'Amiri', serif; padding: 0; margin: 0; color: #000; background: #fff; }
            @page { margin: 1.5cm; }
            
            /* البرواز الخارجي للصفحة */
            .page-container { border: 4px double #111; padding: 30px; min-height: 90vh; position: relative; }
            
            /* ترويسة المدرسة الرسمية */
            .school-header { display: flex; justify-content: space-between; font-family: 'Cairo', sans-serif; font-size: 15px; border-bottom: 2px solid #ddd; padding-bottom: 15px; margin-bottom: 30px; line-height: 1.7; font-weight: 600; }
            
            h1 { font-family: 'Cairo', sans-serif; text-align: center; color: #000; margin-bottom: 30px; font-size: 26px; }
            h3 { font-family: 'Cairo', sans-serif; color: #222; margin-bottom: 8px; font-size: 20px; border-bottom: 1px solid #eee; padding-bottom: 5px; }
            p { white-space: pre-wrap; line-height: 1.9; color: #111; margin: 0; font-size: 18px; }
            .section { margin-bottom: 25px; page-break-inside: avoid; }
            
            /* الفوتر المعدل ليناسب البرواز */
            .print-footer { margin-top: 40px; padding-top: 15px; border-top: 1px solid #eee; display: flex; align-items: center; justify-content: space-between; font-family: 'Cairo', sans-serif; page-break-inside: avoid; }
            .footer-text { margin: 0; font-size: 13px; color: #555; font-weight: 700; }
            .qr-container img { width: 50px; height: 50px; object-fit: contain; display: block; border-radius: 4px; }
            .qr-placeholder { width: 48px; height: 48px; border: 1px dashed #ccc; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 9px; color: #aaa; background-color: #fafafa; }
          </style>
        </head>
        <body>
          <div class="page-container">
            
            <!-- الهيدر المدرسي الجديد -->
            <header class="school-header">
              <div>
                سلطنة عُمان<br>
                وزارة التربية والتعليم<br>
                مدرسة: .......................................
              </div>
              <div style="text-align: right;">
                اليوم: .......................................<br>
                التاريخ: &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;/&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;/ 202 م<br>
                إشراف الأستاذ: ...........................
              </div>
            </header>
            
            <h1>${broadcastDetails.title}</h1>
            ${contentHtml}
            
            <div class="print-footer">
              <p class="footer-text">تم التوليد والإعداد عبر منصة MusiTeacher - استوديو الإذاعة الذكي</p>
              <div class="qr-container">
                <img src="/qrcode.png" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" alt="QR Code" />
                <div class="qr-placeholder" style="display:none;">QR Code</div>
              </div>
            </div>
            
          </div>
          <script>
            window.onload = () => {
              setTimeout(() => { window.print(); }, 800);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="min-h-screen p-6 md:p-10 bg-gradient-to-br from-slate-950 via-gray-950 to-slate-900 text-white font-sans" dir="rtl">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* أزرار العودة والتنقل */}
        <div className="flex items-center justify-between gap-4 pb-2">
          <Link
            href="/dashboard/tools"
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
              
              {/* شريط الإجراءات: العنوان فقط */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-6">
                <div className="flex items-center space-x-3 space-x-reverse">
                  <div className="w-3.5 h-3.5 bg-pink-400 rounded-full animate-pulse shadow-[0_0_12px_rgba(244,114,182,0.8)]"></div>
                  <h3 className={`text-2xl font-bold text-pink-300 ${cairo.className}`}>{broadcastDetails.title}</h3>
                </div>
              </div>

              {isEditing ? (
                /* واجهة التعديل */
                <div className="space-y-4 pt-2">
                  <textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    className={`w-full h-[400px] bg-gray-900/90 border border-pink-500/50 rounded-xl p-6 text-white text-xl leading-loose focus:outline-none focus:border-pink-400 focus:shadow-[0_0_20px_rgba(244,114,182,0.3)] transition-all resize-y ${amiri.className}`}
                    dir="rtl"
                  />
                  <div className={`flex flex-col sm:flex-row items-center justify-center gap-4 pt-4 border-t border-white/10 ${cairo.className}`}>
                    <button
                      onClick={handleSaveEdit}
                      className="flex items-center justify-center gap-2 w-full sm:w-auto px-6 py-3.5 bg-green-600 hover:bg-green-500 text-white rounded-xl text-base font-bold shadow-[0_0_15px_rgba(34,197,94,0.3)] transition-all transform hover:-translate-y-0.5"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                      <span>حفظ التعديل</span>
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      className="flex items-center justify-center gap-2 w-full sm:w-auto px-6 py-3.5 bg-gray-700 hover:bg-gray-600 text-white rounded-xl text-base font-bold shadow-lg transition-all"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                      <span>إلغاء</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* واجهة العرض الطبيعية */
                <>
                  {/* كود عرض السطور مع الآلة الكاتبة ومؤشر النيون الوردي */}
                  <div className={`text-xl md:text-2xl leading-loose text-gray-200 tracking-wide space-y-5 pt-2 ${amiri.className}`}>
                    {displayedText.split("\n\n").map((block, idx, arr) => {
                      const isLastLine = idx === arr.length - 1;
                      const cursorNode = isLastLine && !isTypingFinished ? (
                        <span className="inline-block w-2.5 h-6 bg-gradient-to-b from-pink-300 to-rose-500 mx-1 animate-pulse align-middle rounded-sm shadow-[0_0_10px_rgba(244,114,182,0.8)]"></span>
                      ) : null;

                      // منع طباعة مربعات فارغة إذا كان النص قيد الكتابة ويمر بمسافات فارغة
                      if (block.trim() === "" && !isLastLine) return null;

                      return (
                        <div key={idx} className="bg-black/20 p-5 rounded-xl border border-white/5 hover:border-pink-500/20 transition-all shadow-sm">
                          <span className="text-gray-100 [unicode-bidi:isolate] leading-loose whitespace-pre-wrap" dir="rtl">
                            {block}
                          </span>
                          {cursorNode}
                        </div>
                      );
                    })}
                  </div>

                  {/* أزرار التعديل والنسخ والطباعة تظهر فقط بعد انتهاء الكتابة */}
                  {isTypingFinished && (
                    <div className={`flex flex-col sm:flex-row items-center justify-center gap-4 pt-8 mt-4 border-t border-white/10 ${cairo.className}`}>
                      <button
                        onClick={handleEditClick}
                        className="flex items-center justify-center gap-2 w-full sm:w-auto px-6 py-3.5 bg-blue-600/20 border border-blue-500/30 hover:bg-blue-600/40 text-blue-300 rounded-xl text-base font-bold transition-all shadow-lg"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                        <span>تعديل</span>
                      </button>

                      <button
                        onClick={handleCopy}
                        className="flex items-center justify-center gap-2 w-full sm:w-auto px-6 py-3.5 bg-white/5 border border-white/15 hover:bg-white/10 hover:border-white/30 text-gray-200 rounded-xl text-base font-semibold transition-all shadow-lg"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                        <span>{copied ? "تم النسخ بنجاح!" : "نسخ النص"}</span>
                      </button>

                      <button
                        onClick={handlePrint}
                        className="flex items-center justify-center gap-2 w-full sm:w-auto px-6 py-3.5 bg-gradient-to-r from-pink-500 to-rose-600 hover:from-pink-600 hover:to-rose-700 text-white rounded-xl text-base font-bold shadow-[0_0_20px_rgba(244,114,182,0.4)] hover:shadow-[0_0_30px_rgba(244,114,182,0.6)] transition-all transform hover:-translate-y-0.5"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg>
                        <span>طباعة / حفظ PDF</span>
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

      </div>

      {/* توست تنبيه تسجيل الدخول المطابق لصفحة التحضيرات والملخصات */}
      {showLoginToast && (
        <>
          <style>{`
            @keyframes shake-toast {
              0%, 100% { transform: translateX(-50%); }
              20% { transform: translateX(calc(-50% - 10px)) rotate(-1deg); }
              40% { transform: translateX(calc(-50% + 10px)) rotate(1deg); }
              60% { transform: translateX(calc(-50% - 10px)) rotate(-1deg); }
              80% { transform: translateX(calc(-50% + 10px)) rotate(1deg); }
            }
            .toast-shake-animation {
              animation: shake-toast 0.5s ease-in-out forwards;
            }
          `}</style>
          <div className="fixed top-32 left-1/2 transform -translate-x-1/2 z-[100] toast-shake-animation transition-all duration-300 w-[90%] max-w-md">
            <div className="bg-gradient-to-r from-red-600 to-rose-600 text-white px-5 py-4 rounded-2xl shadow-[0_15px_40px_-10px_rgba(225,29,72,0.6)] border border-red-400/40 flex items-start gap-4 backdrop-blur-md">
              <div className="bg-white/20 p-2.5 rounded-full flex-shrink-0 shadow-inner mt-1">
                <Lock size={22} className="text-white drop-shadow-md" />
              </div>
              <div className="flex-1">
                <h4 className="font-black text-lg mb-1.5 drop-shadow-sm font-cairo tracking-wide">عذراً، الإجراء مرفوض 🔒</h4>
                <p className="text-sm text-red-50 leading-relaxed font-medium">
                  لا يمكنك استخدام الأداة الآن! يرجى التوجه إلى <span className="font-bold bg-white/25 px-2 py-0.5 rounded shadow-sm mx-1">الإعدادات</span> من الصفحة الرئيسية وتسجيل الدخول أولاً.
                </p>
              </div>
              <button onClick={() => setShowLoginToast(false)} className="text-white/70 hover:text-white transition-colors p-1.5 bg-black/10 hover:bg-black/20 rounded-full flex-shrink-0">
                <X size={18} />
              </button>
            </div>
          </div>
        </>
      )}

      {/* 5. تركيب نافذة الترقية المدمجة في آخر الصفحة */}
      <PricingModal 
        isOpen={isPricingModalOpen} 
        onClose={() => setIsPricingModalOpen(false)} 
        user={user} 
      />
    </div>
  );
}