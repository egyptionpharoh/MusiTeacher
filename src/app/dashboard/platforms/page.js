'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from '../../../context/ThemeContext';
import { BookOpen, Monitor, Award, Briefcase, GraduationCap, ArrowRight } from 'lucide-react';

export default function PlatformsPage() {
  const router = useRouter();
  const { isDark } = useTheme();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    setIsReady(true);
  }, []);

  const platforms = [
    {
      name: "منصة نور",
      url: "https://lms.moe.gov.om",
      icon: BookOpen,
      bgStyle: "bg-gradient-to-br from-emerald-400 to-teal-600",
      borderColor: "border-teal-700 dark:border-teal-900",
      shadowColor: "shadow-teal-500/30",
    },
    {
      name: "البوابة التعليمية",
      url: "https://home.moe.gov.om",
      icon: Monitor,
      bgStyle: "bg-gradient-to-br from-blue-400 to-indigo-600",
      borderColor: "border-indigo-700 dark:border-indigo-900",
      shadowColor: "shadow-indigo-500/30",
    },
    {
      name: "منصة إجادة",
      url: "https://ejada.gov.om",
      icon: Award,
      bgStyle: "bg-gradient-to-br from-amber-400 to-orange-500",
      borderColor: "border-orange-600 dark:border-orange-800",
      shadowColor: "shadow-orange-500/30",
    },
    {
      name: "منصة مورد",
      url: "https://pext-hrss.mol.gov.om",
      icon: Briefcase,
      bgStyle: "bg-gradient-to-br from-purple-400 to-fuchsia-600",
      borderColor: "border-fuchsia-700 dark:border-fuchsia-900",
      shadowColor: "shadow-fuchsia-500/30",
    },
    {
      name: "معادلة الشهادة",
      url: "https://eservices.moheri.gov.om/Student/StudentSignUp.aspx?lang=ar",
      icon: GraduationCap,
      bgStyle: "bg-gradient-to-br from-rose-400 to-red-500",
      borderColor: "border-red-700 dark:border-red-900",
      shadowColor: "shadow-red-500/30",
    }
  ];

  return (
    <div 
      className={`relative min-h-screen w-full flex flex-col items-center pt-24 pb-16 px-4 text-white transition-all duration-1000 ${isReady ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
      style={{
        background: 'radial-gradient(ellipse at top, var(--bg-from), var(--bg-via), var(--bg-to))'
      }}
    >
      
      {/* الشريط العلوي */}
      <div className="absolute top-0 left-0 w-full p-6 md:p-8 flex justify-start items-center pointer-events-none z-50">
        <button 
          onClick={() => router.back()}
          className="pointer-events-auto flex items-center gap-2 px-5 py-2.5 bg-white/20 border border-white/30 rounded-full backdrop-blur-xl text-white hover:bg-white/30 hover:border-white/50 transition-all duration-300 shadow-lg group"
        >
          <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform duration-300" />
          <span className="text-sm font-bold tracking-wide">العودة للرئيسية</span>
        </button>
      </div>

      {/* العنوان */}
      <div className="text-center mb-16 w-full max-w-4xl z-10">
        <h1 className="text-5xl md:text-6xl font-black mb-6 tracking-tight text-white drop-shadow-sm">
          المنصات التعليمية
        </h1>
        <p className="text-lg md:text-xl text-white/90 font-medium">
          وصول سريع ومباشر لأهم البوابات والأنظمة المعتمدة
        </p>
      </div>

      {/* شبكة الأزرار الـ 3D */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 w-full max-w-6xl mx-auto z-10">
        {platforms.map((platform, index) => (
          <a
            key={index}
            href={platform.url}
            target="_blank"
            rel="noopener noreferrer"
            className={`
              group relative flex flex-col items-center justify-center p-8 
              ${platform.bgStyle} rounded-3xl text-white 
              border-b-[8px] ${platform.borderColor} 
              shadow-xl ${platform.shadowColor}
              hover:brightness-110 
              active:border-b-0 active:translate-y-[8px] active:mb-[8px]
              transition-all duration-150 ease-out outline-none
            `}
          >
            {/* لمعة زجاجية خفيفة فوق الزر */}
            <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent rounded-3xl opacity-50 pointer-events-none"></div>

            <platform.icon size={56} strokeWidth={1.5} className="mb-5 drop-shadow-md group-hover:scale-110 transition-transform duration-300 relative z-10" />
            
            <span className="text-xl md:text-2xl font-bold text-center drop-shadow-md relative z-10">
              {platform.name}
            </span>
            
            <span className="mt-2 text-sm text-white/80 font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center gap-1 relative z-10">
              انقر للدخول
              <ArrowRight size={14} className="rotate-180" />
            </span>
          </a>
        ))}
      </div>

    </div>
  );
}