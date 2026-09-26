'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  FileSpreadsheet, FileText, Music, Mic, Presentation, 
  CalendarDays, BookOpen, ClipboardList, Star, Crown, BookCopy, ArrowRight
} from 'lucide-react';

export default function TeacherToolsPage() {
  const router = useRouter();
  
  // تم إزالة قيود تسجيل الدخول وفتح جميع الأدوات

  // استخدام تدرجات لونية ثلاثية الأبعاد (3-Stop Gradients) لإضاءة مذهلة
  const toolsList = [
    { id: 'noormark', name: 'أداة NoorMark', desc: 'لإعداد كشوف التقويم المستمر', icon: <FileSpreadsheet size={32} />, color: 'from-cyan-400 via-blue-500 to-indigo-600', path: '/dashboard/tools/noormark', isExternal: false },
{ id: 'music-factory', name: 'مصنع الألحان (AI)', desc: 'توليد الألحان والأناشيد بذكاء', icon: <Music size={32} />, color: 'from-fuchsia-500 via-rose-500 to-orange-500', path: 'https://music-factory-ai-1.onrender.com/', isExternal: true },    
{ id: 'summaries', name: 'مصنع ملخصات الدروس', desc: 'توليد ملخصات وتقويمات ذكية فورية', icon: <BookCopy size={32} />, color: 'from-emerald-400 via-teal-500 to-cyan-500', path: '/dashboard/tools/summaries' },
    { id: 'covers', name: 'بنك أغلفة السجلات', desc: 'أغلفة وورد قابلة للتعديل', icon: <FileText size={32} />, color: 'from-violet-400 via-purple-500 to-fuchsia-500', path: '/dashboard/tools/covers' },
{ 
  id: 'radio', 
  name: 'استوديو الإذاعة الذكي', 
  desc: 'توليد فقرات الإذاعة المدرسية بالذكاء الاصطناعي', 
  icon: <Mic size={32} />, 
  color: 'from-pink-400 via-rose-500 to-red-500', 
  path: '/dashboard/tools/radio' 
},    { id: 'workshops', name: 'مشاغل الإنماء المهني', desc: 'عروض باوربوينت لبرامج الإنماء', icon: <Presentation size={32} />, color: 'from-sky-400 via-indigo-500 to-purple-600', path: '/dashboard/tools/workshops' },
    { id: 'plans', name: 'الخطط الفصلية', desc: 'تحميل خطط جميع الصفوف', icon: <CalendarDays size={32} />, color: 'from-blue-400 via-indigo-400 to-violet-500', path: '/dashboard/tools/plans' },
    { id: 'guides', name: 'أدلة المعلم', desc: 'مكتبة أدلة المعلم الرسمية', icon: <BookOpen size={32} />, color: 'from-teal-400 via-emerald-500 to-green-600', path: '/dashboard/tools/guides' },
    { id: 'grading-forms', name: 'استمارات رصد الدرجات', desc: 'قوالب جاهزة للرصد اليدوي', icon: <ClipboardList size={32} />, color: 'from-cyan-300 via-sky-500 to-blue-600', path: '/dashboard/tools/grading-forms' },
    { id: 'anthem', name: 'نوتات النشيد والمارشات', desc: 'نوتات الانصراف والطابور', icon: <Music size={32} />, color: 'from-rose-400 via-red-500 to-orange-600', path: '/dashboard/tools/anthem' },
    { id: 'performance', name: 'استمارات متابعة الطلبة', desc: 'لمتابعة الأداء اليومي', icon: <FileSpreadsheet size={32} />, color: 'from-amber-300 via-orange-500 to-red-500', path: '/dashboard/tools/performance' },
    { id: 'initiatives', name: 'مبادرات تعليمية', desc: 'مبادرات مقترحة جاهزة للتنفيذ', icon: <Star size={32} />, color: 'from-yellow-300 via-amber-400 to-orange-500', path: '/dashboard/tools/initiatives' },
  ];

  return (
    <div 
      className="min-h-screen p-4 md:p-10 overflow-hidden relative selection:bg-fuchsia-500/30 text-stone-900 dark:text-white transition-all duration-1000"
      style={{
        background: 'radial-gradient(ellipse at top, var(--bg-from), var(--bg-via), var(--bg-to))'
      }}
    >
      
      {/* زر العودة للوراء */}
      <button 
        onClick={() => router.back()}
        className="absolute top-6 right-6 md:top-10 md:right-10 z-50 flex items-center gap-2 px-5 py-2.5 bg-white/20 dark:bg-white/5 border border-white/30 dark:border-white/10 rounded-full backdrop-blur-xl text-white dark:text-gray-400 hover:text-white dark:hover:text-white hover:bg-white/30 dark:hover:bg-white/10 hover:border-white/50 dark:hover:border-white/20 transition-all duration-300 shadow-lg group"
      >
        <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform duration-300" />
        <span className="text-sm font-bold tracking-wide">العودة</span>
      </button>

      {/* تأثيرات بصرية للخلفية */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-900/20 blur-[150px] pointer-events-none"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-fuchsia-900/10 blur-[150px] pointer-events-none"></div>

      {/* قسم العنوان */}
      <div className="relative text-center mb-20 mt-8 md:mt-12 z-10 w-full flex flex-col items-center">
        <div className="inline-block relative group cursor-default">
          <h1 className="text-5xl md:text-7xl font-black tracking-tighter text-white mb-4 relative z-10 transition-colors duration-1000">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-orange-400 to-rose-500 drop-shadow-[0_0_25px_rgba(245,158,11,0.5)] group-hover:from-rose-400 group-hover:via-fuchsia-400 group-hover:to-amber-300 transition-all duration-1000">أدوات المعلم</span>          </h1>
          <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-1/4 h-1 bg-gradient-to-r from-transparent via-fuchsia-500 to-transparent opacity-40 group-hover:w-3/4 group-hover:opacity-100 transition-all duration-700"></div>
        </div>
        <p className="text-blue-50 dark:text-gray-400 text-lg mt-6 max-w-2xl font-light tracking-wide transition-colors duration-1000">
          الترسانة الرقمية الشاملة لإدارة صفية استثنائية وأنشطة لا تُنسى.
        </p>
      </div>

      {/* شبكة البطاقات */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8 w-full max-w-[95rem] mx-auto px-2 pb-16 z-10 relative">
        {toolsList.map((tool) => {
          const CardWrapper = tool.isExternal ? 'a' : Link;
          const linkProps = tool.isExternal 
            ? { href: tool.path, target: "_blank", rel: "noopener noreferrer" } 
            : { href: tool.path };

          return (
            <CardWrapper 
              key={tool.id} 
              {...linkProps}
              className="group relative h-64 rounded-[24px] bg-white/[0.02] p-[2px] overflow-hidden hover:-translate-y-3 hover:scale-[1.03] hover:shadow-[0_0_30px_rgba(163,230,53,0.3)] dark:hover:shadow-[0_0_40px_rgba(163,230,53,0.2)] hover:border-lime-500/50 hover:z-50 transition-all duration-500 ease-out select-none cursor-pointer"
            >
              {/* الإطار الدوار السحري */}
              <div className={`absolute inset-[-150%] bg-gradient-to-r ${tool.color} animate-[spin_4s_linear_infinite] opacity-0 group-hover:opacity-100 transition-opacity duration-700`}></div>
              
              {/* الإطار الثابت في الحالة العادية */}
              <div className="absolute inset-0 bg-black/[0.03] dark:bg-white/[0.03] border border-black/10 dark:border-white/[0.08] rounded-[24px] group-hover:opacity-0 transition-all duration-1000"></div>

              {/* المحتوى الداخلي للبطاقة */}
              <div className="relative h-full w-full bg-white/85 dark:bg-[#050812]/95 backdrop-blur-3xl rounded-[22px] p-6 flex flex-col items-center justify-center overflow-hidden z-10 transition-colors duration-1000">
                <div className={`absolute top-0 right-0 w-40 h-40 bg-gradient-to-bl ${tool.color} opacity-0 group-hover:opacity-30 rounded-full blur-3xl transition-opacity duration-700`}></div>

                {/* الأيقونة */}
                <div className="relative mb-6 flex items-center justify-center w-16 h-16">
                  <div className="absolute inset-0 bg-black/[0.04] dark:bg-white/[0.04] rounded-2xl group-hover:scale-110 group-hover:bg-transparent transition-all duration-1000 border border-black/[0.05] dark:border-white/[0.05] group-hover:border-transparent"></div>
                  <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 group-hover:animate-ping rounded-2xl bg-gradient-to-r ${tool.color} mix-blend-screen transition-all duration-700`} style={{ animationDuration: '2.5s', animationIterationCount: 'infinite' }}></div>
                  <div className="relative text-stone-500 dark:text-gray-400 group-hover:text-stone-900 dark:group-hover:text-white transition-colors duration-1000 z-10 drop-shadow-md">
                    {tool.icon}
                  </div>
                </div>

                {/* النصوص */}
                <h2 className="text-xl font-bold text-center text-stone-800 dark:text-gray-200 group-hover:text-stone-900 dark:group-hover:text-white mb-2 tracking-wide transition-colors duration-1000 relative z-10">
                  {tool.name}
                </h2>
                <p className="text-sm text-center text-stone-600 dark:text-gray-500 group-hover:text-stone-900 dark:group-hover:text-gray-300 transition-colors duration-1000 px-2 leading-relaxed relative z-10">
                  {tool.desc}
                </p>

              </div>
            </CardWrapper>
          );
        })}
      </div>
    </div>
  );
}