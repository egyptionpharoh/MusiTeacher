'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTheme } from '../../../context/ThemeContext';
import { Settings, BookOpen, Gamepad2, BookText, Wrench, Factory, ArrowRight } from 'lucide-react';

export default function DashboardPage() {
  const router = useRouter();
  const { isDark } = useTheme();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    setIsReady(true);
  }, []);

  return (
    <div 
      className={`relative min-h-[85vh] flex flex-col items-center justify-center text-white transition-all duration-1000 ${isReady ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
      style={{
        background: 'radial-gradient(ellipse at top, var(--bg-from), var(--bg-via), var(--bg-to))'
      }}
    >
      
      {/* الشريط العلوي للأزرار (العودة فقط) */}
      <div className="absolute top-0 left-0 w-full p-6 md:p-8 flex justify-start items-center pointer-events-none z-50">
        
        {/* زر العودة */}
        <button 
          onClick={() => router.back()}
          className="pointer-events-auto flex items-center gap-2 px-5 py-2.5 bg-white/20 border border-white/30 rounded-full backdrop-blur-xl text-white hover:bg-white/30 hover:border-white/50 transition-all duration-300 shadow-lg group"
        >
          <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform duration-300" />
          <span className="text-sm font-bold tracking-wide">العودة</span>
        </button>

      </div>

     {/* قسم العنوان والترحيب - مع حل مشكلة حجب النقاط السفلية */}
<div className="text-center mt-16 mb-12 w-full max-w-4xl px-4 flex flex-col items-center z-10 relative">
  
  {/* أضفنا pb-4 (Padding Bottom) لتعطي مساحة للحروف السفلية، ورفعنا الـ line-height قليلاً */}
  <h1 className="text-6xl md:text-7xl font-black mb-8 tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-red-400 via-red-600 to-rose-500 pb-4 leading-[1.2] drop-shadow-[0_0_15px_rgba(255,255,255,0.8)]">
    مكتبة الأدوات والألعاب التعليمية
  </h1>
  
  <div className="inline-flex relative group mt-2">
    {/* هالة تفاعلية حمراء نيون */}
    <div className="absolute -inset-1 bg-gradient-to-r from-red-500/20 to-rose-500/20 rounded-full blur-xl opacity-40 group-hover:opacity-70 transition duration-700"></div>
    
    {/* كبسولة زجاجية */}
    <div className="relative bg-[#0a0a0a]/40 dark:bg-black/50 backdrop-blur-3xl px-12 py-5 rounded-full border border-white/5 border-t-white/20 shadow-[0_20px_40px_-10px_rgba(0,0,0,0.7)] transition-all duration-700 hover:bg-black/60">
      <p className="text-lg md:text-xl text-stone-200 font-medium leading-relaxed tracking-wide drop-shadow-md">
        وداعاً لعبء البحث عن الوسائل والأدوات والألعاب التعليمية.. هنا كل ما تحتاجه في مكان واحد!
      </p>
    </div>
  </div>
</div>

      {/* مسافة بديلة للفصل الدراسي للحفاظ على تناسق التصميم */}
      <div className="mb-12"></div>

      {/* شبكة البطاقات - سيمترية مثالية */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-6xl mx-auto px-6 flex-grow pb-16 relative z-10">
        {[
          { 
            href: "/dashboard/tools", 
            icon: Wrench, 
            title: "أدوات المعلم", 
            color: "from-purple-400 to-fuchsia-600", 
            iconColor: "text-purple-500 dark:text-purple-400"
          },
          { 
            href: "/dashboard/platforms", 
            icon: BookOpen, 
            title: "المنصات التعليمية", 
            color: "from-emerald-400 to-teal-600", 
            iconColor: "text-emerald-500 dark:text-emerald-400"
          },
          { 
            href: "/dashboard/resources", 
            icon: Gamepad2, 
            title: "الألعاب التعليمية", 
            color: "from-cyan-400 to-blue-600", 
            iconColor: "text-cyan-500 dark:text-cyan-400"
          },
        ].map((item, index) => (
          <Link 
            key={index} 
            href={item.href}
            className="group relative h-64 block hover:-translate-y-3 hover:scale-[1.03] hover:z-50 transition-all duration-500 ease-out outline-none"
          >
            {/* التوهج الخارجي */}
            <div className={`absolute -inset-1.5 bg-gradient-to-r ${item.color} rounded-[26px] blur-xl opacity-0 group-hover:opacity-60 transition-opacity duration-700`}></div>

            {/* الحاوية الأساسية */}
            <div className="relative h-full w-full rounded-[24px] bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.08] dark:border-white/[0.08] p-[2px] overflow-hidden shadow-lg transition-all duration-500">
              
              {/* الإطار الدوار */}
              <div className={`absolute inset-[-150%] bg-gradient-to-r ${item.color} animate-[spin_4s_linear_infinite] opacity-0 group-hover:opacity-100 transition-opacity duration-700`}></div>
              
              {/* المحتوى الداخلي - متجاوب مع الوضع الفاتح والداكن */}
              <div className="relative h-full w-full bg-white/90 dark:bg-[#0A192F]/80 backdrop-blur-3xl rounded-[22px] p-8 flex flex-col items-center justify-center z-10 transition-colors duration-1000">
                
                {/* التلوين الفوسفوري الداخلي */}
                <div className={`absolute inset-0 bg-gradient-to-br ${item.color} opacity-0 group-hover:opacity-[0.12] dark:group-hover:opacity-[0.15] transition-opacity duration-700`}></div>
                
                {/* الأيقونة */}
                <div className={`mb-6 p-6 rounded-2xl bg-black/[0.03] dark:bg-white/[0.03] border border-black/5 dark:border-white/5 shadow-inner group-hover:scale-110 transition-transform duration-500 ${item.iconColor}`}>
                  <item.icon size={52} strokeWidth={1.5} />
                </div>
                
                <h2 className="text-3xl font-bold text-center tracking-wide text-stone-900 dark:text-white group-hover:text-stone-900 dark:group-hover:text-white transition-colors duration-1000">{item.title}</h2>
              </div>
            </div>
          </Link>
        ))}
      </div>
      
    </div>
  );
}