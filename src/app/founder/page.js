'use client';
import Image from 'next/image';
import Link from 'next/link';
import { X, Code, Music, BookOpen, Server } from 'lucide-react';

export default function FounderPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-8 relative overflow-hidden">
      {/* خلفية ديناميكية */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#0f2027] to-[#001022] z-0"></div>
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-cyan-600/10 rounded-full blur-[120px] pointer-events-none"></div>

      <div className="w-full max-w-4xl glass-card p-10 md:p-16 z-10 relative overflow-hidden border-cyan-500/30 shadow-2xl rounded-3xl">
        
        {/* زر الخروج (X) */}
        <Link href="/" className="absolute top-6 left-6 text-gray-400 hover:text-red-500 transition-colors bg-white/5 p-2 rounded-full hover:bg-white/10 flex items-center justify-center">
          <X size={28} />
        </Link>

        <div className="flex flex-col md:flex-row items-center gap-12 mt-4">
          {/* صورة المؤسس */}
          <div className="relative group shrink-0">
            <div className="absolute -inset-1 bg-gradient-to-r from-cyan-400 to-blue-600 rounded-full blur opacity-75 group-hover:opacity-100 transition duration-1000 group-hover:duration-200"></div>
            <div className="relative w-48 h-48 rounded-full overflow-hidden border-4 border-[#0f2027] bg-gray-900 shadow-inner">
              <Image 
                src="/my-photo.jpg" 
                alt="حسين الملك" 
                fill
                className="object-cover"
              />
            </div>
          </div>

          {/* معلومات المؤسس */}
          <div className="text-center md:text-right flex-1">
            <h1 className="text-4xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500 mb-2">
              حسين الملك
            </h1>
            <h2 className="text-xl text-gray-400 mb-6 font-medium">
              حسين محمد سيد عبدالعال
            </h2>

            <p className="text-gray-300 leading-relaxed mb-8 text-lg text-justify">
              باحث أكاديمي بجامعة القاهرة، ومبتكر أول منصة عربية للذكاء الاصطناعي الموسيقي <span className="text-cyan-400 font-bold">"Music Factory AI"</span>، المتخصصة في تلحين الأغاني والموسيقى التصويرية بالمقامات الشرقية الأصيلة (كـ البياتي، السيكا، الصبا، والراست) بدقة متناهية.
              <br/><br/>
              كرّس خبرته البرمجية والفنية لتطوير أنظمة ومنصات ذكية (مثل <span className="text-orange-400 font-bold">MusiTeacher</span> و <span className="text-green-400 font-bold">NoorMark</span>) بهدف الارتقاء بقطاع التعليم الموسيقي، ودمج سحر النغم الشرقي بقوة التكنولوجيا الحديثة.             </p>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-[#0f2027]/70 p-4 rounded-xl border border-gray-700/50 flex items-center gap-3">
                <Music className="text-purple-400" size={24} />
                <span className="text-gray-200 text-sm">ملحن وشاعر غنائي</span>
              </div>
              <div className="bg-[#0f2027]/70 p-4 rounded-xl border border-gray-700/50 flex items-center gap-3">
                <BookOpen className="text-blue-400" size={24} />
                <span className="text-gray-200 text-sm">باحث أكاديمي (جامعة القاهرة)</span>
              </div>
              <div className="bg-[#0f2027]/70 p-4 rounded-xl border border-gray-700/50 flex items-center gap-3 col-span-2">
                <Server className="text-cyan-400" size={24} />
                <span className="text-gray-200 text-sm font-semibold">مؤسس ومطور منصات التعليم الذكية (EdTech & AI)</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}