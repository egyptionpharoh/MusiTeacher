import AppHeader from '../../../components/AppHeader';
import Link from 'next/link';
import { gamesConfig } from '../../../lib/gamesConfig';

export default function ResourcesPage() {
  return (
    <div 
      className="min-h-screen relative overflow-hidden transition-all duration-1000 z-0 text-slate-800 dark:text-white"
      style={{
        background: 'radial-gradient(ellipse at top, var(--bg-from), var(--bg-via), var(--bg-to))'
      }}
    >
      {/* الهيدر مستقل ومثبت علوياً */}
      <AppHeader />
      
      {/* عناصر الإضاءة الخلفية الناعمة للوضع النهاري فقط وتختفي تلقائياً في الـ Dark Mode */}
      <div className="absolute top-0 left-0 w-full h-[60vh] overflow-hidden pointer-events-none z-0 dark:hidden">
        <div className="absolute top-[-10%] right-[5%] w-96 h-96 bg-violet-200/40 rounded-full mix-blend-multiply filter blur-[80px] opacity-60 animate-blob"></div>
        <div className="absolute top-[10%] left-[10%] w-96 h-96 bg-cyan-200/40 rounded-full mix-blend-multiply filter blur-[80px] opacity-60 animate-blob animation-delay-2000"></div>
      </div>

      {/* الحاوية الأساسية للمحتوى */}
      <div className="min-h-[80vh] flex flex-col items-center pt-32 px-4 relative z-10 pb-20">
        
        {/* منطقة العنوان بالكامل (Hero Area) التفاعلية مع التوهج الهادئ الجديد */}
        <div className="text-center mb-16 relative w-full max-w-4xl mx-auto group cursor-pointer">
          <h1 className="flex items-center justify-center flex-wrap gap-4 text-5xl md:text-6xl lg:text-7xl font-extrabold leading-tight pb-2 select-none">
            {/* تم تجهيز التدرج بـ via-white ليعمل بشكل مثالي مع أنميشن الشعاع الضوئي الجديد */}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-white to-cyan-400 hover-title-flow transition-all duration-300
                             dark:from-cyan-400 dark:via-white dark:to-cyan-500 dark:text-4xl dark:font-bold dark:drop-shadow-sm">
             عالم الألعاب الموسيقية            </span>
            <span className="inline-block transform transition-all duration-500 group-hover:scale-110 group-hover:rotate-6 drop-shadow-xl text-5xl md:text-6xl">
              🎮
            </span>
          </h1>
          {/* تم تلطيف لون الوصف باستخدام شفافية ذكية (blue-50/90) لراحة بصرية فائقة وتباين ممتاز */}
          <p className="hidden md:block text-lg text-blue-50/90 font-medium mt-4 transition-colors duration-300 group-hover:text-white drop-shadow-sm dark:text-gray-300/90 dark:group-hover:text-cyan-50">
            اكتشف واستمتع بمجموعة من الألعاب التفاعلية المصممة لتنمية مهارات طلابك الموسيقية.
          </p>
          <div className="w-24 h-1 bg-gradient-to-r from-transparent via-cyan-300 to-transparent dark:via-cyan-400 mx-auto mt-8 rounded-full opacity-70 transition-all duration-700 ease-out group-hover:w-48 group-hover:opacity-100 shadow-[0_0_15px_rgba(34,211,238,0.5)]"></div>
        </div>
        
        {/* شبكة الألعاب التعليمية */}
        {/* شبكة الألعاب التعليمية */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 w-full max-w-6xl">
          {gamesConfig.map((game) => (
            <Link href={`/dashboard/resources/${game.id}`} key={game.id} 
                  /* تم استبدال border-slate بـ border-white/10 في الوضع الليلي للحصول على جودة Glassmorphism احترافية نقية */
              className="relative bg-white/95 dark:bg-[#0A192F]/95 backdrop-blur-2xl border border-white/80 dark:border-white/10 rounded-[2rem] p-8 transition-all duration-500 shadow-[0_8px_30px_rgba(0,0,0,0.06)] dark:shadow-[0_10px_40px_rgba(0,0,0,0.5)] hover:shadow-[0_15px_35px_rgba(34,211,238,0.2)] dark:hover:shadow-[0_15px_40px_rgba(34,211,238,0.15)] hover:-translate-y-2 hover:border-cyan-300 dark:hover:border-cyan-400/50 group overflow-hidden flex flex-col h-full">
              
              {/* شريط الإضاءة العلوي الجذاب */}
              <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-cyan-400 via-blue-500 to-cyan-400 dark:from-cyan-500 dark:via-blue-600 dark:to-cyan-500 opacity-0 group-hover:opacity-100 transition-opacity duration-500 shadow-[0_2px_15px_rgba(34,211,238,0.5)] z-20"></div>

              {/* حاوية الأيقونة */}
              <div className="w-20 h-20 mx-auto mb-6 flex items-center justify-center bg-blue-50/80 dark:bg-slate-800/80 rounded-2xl group-hover:scale-105 transition-transform duration-500 border border-blue-100 dark:border-slate-700 shadow-sm dark:shadow-inner">
                <div className="text-5xl group-hover:animate-bounce">{game.icon}</div>
              </div>
              
              {/* تفاصيل اللعبة */}
              <div className="flex-grow flex flex-col">
                <h2 className="text-2xl font-bold text-slate-800 dark:text-white text-center mb-2.5 transition-colors duration-300 group-hover:text-blue-600 dark:group-hover:text-cyan-400">
                  {game.title}
                </h2>
                
                <p className="text-slate-600 dark:text-slate-300 text-center mb-6 leading-relaxed text-sm font-medium flex-grow">
                  {game.description}
                </p>
                
                {/* صندوق الهدف التربوي - تم صقل الألوان لتعطي أفضل راحة بصرية وتباين داخل الكارت */}
                <div className="bg-cyan-50/50 dark:bg-cyan-900/10 border border-cyan-100/60 dark:border-white/5 p-4 rounded-xl mb-6 transition-all duration-300 group-hover:bg-cyan-50 dark:group-hover:bg-cyan-900/20 group-hover:border-cyan-200/80 dark:group-hover:border-cyan-500/20">
                  <p className="text-xs md:text-sm text-blue-900/90 dark:text-cyan-50/80 leading-relaxed font-medium">
                    <span className="font-bold text-blue-700 dark:text-cyan-400">الهدف التربوي:</span> {game.pedagogicalGoal}
                  </p>
                </div>

                {/* زر الدخول التفاعلي - ألوان احترافية تناسب الوضعين */}
                <div className="relative overflow-hidden w-full bg-gradient-to-r from-blue-600 to-cyan-500 dark:from-blue-700 dark:to-cyan-600 text-white font-bold py-3 px-4 rounded-xl text-center transform transition-all duration-300 group-hover:shadow-[0_4px_15px_rgba(34,211,238,0.4)] dark:group-hover:shadow-[0_4px_15px_rgba(34,211,238,0.2)]">
                   <span className="relative z-10 flex items-center justify-center gap-2 text-sm tracking-wide">
                     ابدأ اللعب
                     <svg className="w-4 h-4 group-hover:-translate-x-1 transition-transform rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                     </svg>
                   </span>
                   <div className="absolute top-0 -left-[100%] w-full h-full bg-gradient-to-r from-transparent via-white/30 to-transparent group-hover:animate-shine z-0"></div>
                </div>

              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}