import React from 'react';

const MusiTeacherLogo = ({ isDark }) => {
  return (
    <div className="flex items-center gap-3">
      {/* أيقونة اللوجو */}
      <div className="relative w-14 h-14 bg-gradient-to-br from-blue-600 to-cyan-500 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20">
        <span className="text-white font-black text-2xl tracking-tighter">MT</span>
        {/* نقطة الإضاءة الذكية */}
        <div className="absolute -top-1 -right-1 w-4 h-4 bg-orange-400 rounded-full border-2 border-white shadow-sm animate-pulse"></div>
      </div>
      
      {/* اسم المنصة */}
      <div className="flex flex-col">
        <span className={`text-2xl font-black tracking-tight ${isDark ? 'text-white' : 'text-stone-900'}`}>
          MusiTeacher
        </span>
        <span className="text-[11px] font-bold text-blue-500 uppercase tracking-[0.2em]">
          Smart Portal
        </span>
      </div>
    </div>
  );
};

export default MusiTeacherLogo;