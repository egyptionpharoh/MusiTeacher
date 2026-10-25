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

        {/* كارت تنويه: المنصة قيد التحديث */}
        <div className="bg-[#111827] p-8 rounded-2xl border border-amber-500/40 shadow-xl hover:shadow-[0_0_25px_rgba(245,158,11,0.2)] transition-all md:col-span-2 text-center">
          <div className="bg-amber-900/40 w-16 h-16 rounded-2xl flex items-center justify-center mb-6 border border-amber-500/50 mx-auto">
            <Star size={32} className="text-amber-400 drop-shadow-md" />
          </div>
          <h2 className="text-2xl font-bold mb-3 text-amber-300">المنصة قيد التحديث</h2>
          <p className="text-gray-300 leading-relaxed font-medium text-lg mb-4">
            نعمل حاليًا على تطوير أدوات المنصة وألعابها التعليمية. للاطلاع على أحدث المستجدات يُرجى التواصل مع المطور عبر البريد الإلكتروني:
          </p>
          <a href="mailto:hussien.elmalek@gmail.com" dir="ltr" className="inline-block text-amber-300 font-bold underline underline-offset-4 hover:opacity-80">
            hussien.elmalek@gmail.com
          </a>
        </div>

      </div>

      <div className="mt-16 text-center text-gray-500 text-sm font-semibold">
        <p>تم التصميم والتطوير بواسطة حسين الملك © 2026</p>
      </div>
    </div>
  );
}