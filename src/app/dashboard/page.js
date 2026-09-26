'use client';
import Link from 'next/link';
import { BookOpen, Star, Wand2, ArrowRight } from 'lucide-react';

export default function GuidePage() {
  return (
    // فرضنا هنا خلفية داكنة جداً (bg-[#0a0f16]) عشان الألوان تنطق
    <div className="relative min-h-screen flex flex-col items-center p-6 text-white bg-[#0a0f16]">
      
      {/* زر العودة للرئيسية */}
      <div className="w-full max-w-4xl flex justify-start mb-8">
        <Link 
          href="/" 
          className="flex items-center gap-2 text-gray-300 hover:text-white transition-all bg-gray-800 hover:bg-gray-700 px-5 py-2.5 rounded-xl border border-gray-600 shadow-md"
        >
          <ArrowRight size={20} />
          <span className="font-semibold">العودة للرئيسية</span>
        </Link>
      </div>

      <div className="w-full max-w-4xl text-center mb-12">
        <h1 className="text-5xl font-black mb-4 text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-300 drop-shadow-[0_0_15px_rgba(52,211,153,0.4)]">
          دليل المعلم الشامل
        </h1>
        <p className="text-xl text-gray-400 font-medium">
          دليلك السريع لإتقان أدوات المنصة وتوفير ساعات من العمل اليومي
        </p>
      </div>

      <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* كارت شرح نور مارك */}
        <div className="bg-[#111827] p-8 rounded-2xl border border-gray-700 hover:border-blue-500 transition-all shadow-xl hover:shadow-[0_0_25px_rgba(59,130,246,0.2)]">
          <div className="bg-blue-900/50 w-16 h-16 rounded-2xl flex items-center justify-center mb-6 border border-blue-500/50">
            <Wand2 size={32} className="text-blue-400 drop-shadow-md" />
          </div>
          <h2 className="text-2xl font-bold mb-3 text-blue-300">نظام NoorMark</h2>
          <p className="text-gray-300 leading-relaxed mb-6 font-medium">
            أداة الأتمتة السحرية لرصد الدرجات. كل ما عليك فعله هو رفع ملف الإكسيل الخاص بدرجات الطلاب، وسيقوم النظام بتجهيزها وإرسالها بضغطة زر واحدة إلى البوابة التعليمية.
          </p>
          <ul className="text-sm text-gray-400 space-y-3 font-semibold">
            <li className="flex items-center gap-2"><span className="w-2 h-2 bg-blue-500 rounded-full"></span> يدعم ملفات Excel الرسمية</li>
            <li className="flex items-center gap-2"><span className="w-2 h-2 bg-blue-500 rounded-full"></span> رصد دقيق بدون أخطاء يدوية</li>
          </ul>
        </div>

        {/* كارت شرح التحضيرات */}
        <div className="bg-[#111827] p-8 rounded-2xl border border-gray-700 hover:border-red-500 transition-all shadow-xl hover:shadow-[0_0_25px_rgba(239,68,68,0.2)]">
          <div className="bg-red-900/50 w-16 h-16 rounded-2xl flex items-center justify-center mb-6 border border-red-500/50">
            <BookOpen size={32} className="text-red-400 drop-shadow-md" />
          </div>
          <h2 className="text-2xl font-bold mb-3 text-red-300">التحضيرات المتطورة</h2>
          <p className="text-gray-300 leading-relaxed mb-6 font-medium">
            بنك شامل لدروس المهارات الموسيقية. اختر الصف والدرس، وستجد التحضير جاهزاً (المفاهيم، الإجراءات، التقويم) لإدراجه فوراً في خطتك.
          </p>
          <ul className="text-sm text-gray-400 space-y-3 font-semibold">
            <li className="flex items-center gap-2"><span className="w-2 h-2 bg-red-500 rounded-full"></span> متوافق مع المناهج المعتمدة</li>
            <li className="flex items-center gap-2"><span className="w-2 h-2 bg-red-500 rounded-full"></span> إدراج مباشر بنقرة واحدة</li>
          </ul>
        </div>

        {/* كارت شرح مصنع الموسيقى */}
        <div className="bg-[#111827] p-8 rounded-2xl border border-gray-700 hover:border-orange-500 transition-all shadow-xl hover:shadow-[0_0_25px_rgba(249,115,22,0.2)] md:col-span-2">
          <div className="bg-orange-900/50 w-16 h-16 rounded-2xl flex items-center justify-center mb-6 border border-orange-500/50">
            <Star size={32} className="text-orange-400 drop-shadow-md" />
          </div>
          <h2 className="text-2xl font-bold mb-3 text-orange-300">مصنع التحضيرات (الذكاء الاصطناعي)</h2>
          <p className="text-gray-300 leading-relaxed font-medium text-lg">
            المساعد الذكي (Smart Maestro) الخاص بك. استخدم هذه الأداة لتوليد مقطوعات موسيقية، وأفكار إبداعية للدروس، أو حتى إيقاعات مخصصة تناسب أنشطتك الصفية باستخدام تقنيات الذكاء الاصطناعي المتطورة.
          </p>
        </div>

      </div>

      <div className="mt-16 text-center text-gray-500 text-sm font-semibold">
        <p>تم التصميم والتطوير بواسطة حسين الملك © 2026</p>
      </div>
    </div>
  );
}
