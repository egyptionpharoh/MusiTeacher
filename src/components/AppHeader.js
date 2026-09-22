import Link from 'next/link';
import { ArrowRight, Music, Settings } from 'lucide-react';

export default function AppHeader() {
  return (
    <header className="fixed top-0 left-0 right-0 w-full z-50 bg-[#0f2027]/70 backdrop-blur-xl border-b border-gray-800 shadow-[0_4px_30px_rgba(0,0,0,0.3)] transition-all duration-300">
      <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
        
        {/* الجهة اليمنى: زر العودة للرئيسية */}
        <Link 
          href="/" 
          className="group flex items-center gap-2 text-gray-400 hover:text-white transition-all duration-300 rounded-xl px-4 py-2 hover:bg-white/5"
        >
          <ArrowRight size={20} className="transform group-hover:-translate-x-1 transition-transform" />
          <span className="font-semibold text-sm">العودة للرئيسية</span>
        </Link>

        {/* الجهة اليسرى: الهوية + الإعدادات */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3 cursor-default">
            <h2 className="text-xl font-bold tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500 drop-shadow-[0_0_8px_rgba(34,211,238,0.3)]">
              MusiTeacher
            </h2>
            <Music size={20} className="text-cyan-400" />
          </div>
          
          <div className="h-6 w-px bg-gray-700" /> 
          
          <button className="text-gray-400 hover:text-cyan-400 transition-colors p-2 hover:bg-white/5 rounded-full">
            <Settings size={20} />
          </button>
        </div>
      </div>
    </header>
  );
}