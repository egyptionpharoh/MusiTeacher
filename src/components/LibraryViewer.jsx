'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { 
  ArrowRight, Search, Download, Eye, FileText, 
  FileSpreadsheet, Presentation, Music, BookOpen, 
  Filter, Sparkles, X, File
} from 'lucide-react';

export default function LibraryViewer({ 
  title = "المكتبة الرقمية", 
  subtitle = "استعرض ونزل جميع الملفات والمستندات بسهولة", 
  items = [], 
  gradientColor = "from-violet-400 via-purple-500 to-fuchsia-500"
}) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('الكل');

  // استخراج التصنيفات الفرعية تلقائياً إن وجدت
  const categories = useMemo(() => {
    const cats = new Set(['الكل']);
    items.forEach(item => {
      if (item.category) cats.add(item.category);
    });
    return Array.from(cats);
  }, [items]);

  // تصفية العناصر بناءً على البحث والتصنيف
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const matchesSearch = 
        item.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description?.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesCategory = selectedCategory === 'الكل' || item.category === selectedCategory;

      return matchesSearch && matchesCategory;
    });
  }, [items, searchQuery, selectedCategory]);

  // تحديد أيقونة ونوع الملف
  const getFileTypeInfo = (type) => {
    switch (type?.toLowerCase()) {
      case 'word':
      case 'doc':
      case 'docx':
        return { icon: <FileText className="text-blue-400" size={20} />, label: 'Word', color: 'bg-blue-500/10 border-blue-500/20 text-blue-300' };
      case 'excel':
      case 'xls':
      case 'xlsx':
        return { icon: <FileSpreadsheet className="text-emerald-400" size={20} />, label: 'Excel', color: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300' };
      case 'powerpoint':
      case 'ppt':
      case 'pptx':
        return { icon: <Presentation className="text-amber-400" size={20} />, label: 'PowerPoint', color: 'bg-amber-500/10 border-amber-500/20 text-amber-300' };
      case 'audio':
      case 'mp3':
        return { icon: <Music className="text-rose-400" size={20} />, label: 'صوت', color: 'bg-rose-500/10 border-rose-500/20 text-rose-300' };
      case 'pdf':
        return { icon: <BookOpen className="text-red-400" size={20} />, label: 'PDF', color: 'bg-red-500/10 border-red-500/20 text-red-300' };
      default:
        return { icon: <File className="text-fuchsia-400" size={20} />, label: 'ملف', color: 'bg-fuchsia-500/10 border-fuchsia-500/20 text-fuchsia-300' };
    }
  };

  return (
    <div 
      className="min-h-screen p-4 md:p-10 relative text-white selection:bg-fuchsia-500/30 overflow-x-hidden"
      style={{
        background: 'radial-gradient(ellipse at top, #0c1021, #050812, #020307)'
      }}
    >
      {/* زر العودة */}
      <button 
        onClick={() => router.back()}
        className="absolute top-6 right-6 md:top-10 md:right-10 z-50 flex items-center gap-2 px-5 py-2.5 bg-white/5 border border-white/10 rounded-full backdrop-blur-xl text-gray-300 hover:text-white hover:bg-white/10 hover:border-white/20 transition-all duration-300 shadow-lg group"
      >
        <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform duration-300" />
        <span className="text-sm font-bold">العودة</span>
      </button>

      {/* خلفية جمالية */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-fuchsia-900/15 blur-[140px] pointer-events-none"></div>
      <div className="absolute top-[20%] right-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-900/15 blur-[140px] pointer-events-none"></div>

      {/* رأس الصفحة */}
      <div className="relative text-center mb-12 mt-12 z-10 max-w-3xl mx-auto">
        <h1 className="text-4xl md:text-6xl font-black tracking-tight mb-4">
          <span className={`text-transparent bg-clip-text bg-gradient-to-r ${gradientColor} drop-shadow-[0_0_25px_rgba(217,70,239,0.3)]`}>
            {title}
          </span>
        </h1>
        <p className="text-gray-400 text-base md:text-lg font-light leading-relaxed">
          {subtitle}
        </p>
      </div>

      {/* شريط البحث والتصفية */}
      <div className="max-w-5xl mx-auto mb-10 z-10 relative flex flex-col md:flex-row gap-4 items-center justify-between">
        
        {/* مربع البحث */}
        <div className="relative w-full md:w-96">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input 
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ابحث باسم الملف أو الوصف..."
            className="w-full pl-10 pr-11 py-3 bg-white/[0.04] border border-white/10 rounded-2xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-fuchsia-500/50 focus:ring-1 focus:ring-fuchsia-500/50 transition-all backdrop-blur-xl"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* أزرار التصنيف (إن وجدت تصنيفات) */}
        {categories.length > 1 && (
          <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-2 md:pb-0 scrollbar-none">
            <Filter size={16} className="text-fuchsia-400 shrink-0 ml-1" />
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-300 border ${
                  selectedCategory === cat 
                    ? 'bg-fuchsia-500/20 border-fuchsia-500/50 text-fuchsia-300 shadow-[0_0_15px_rgba(217,70,239,0.2)]' 
                    : 'bg-white/[0.02] border-white/10 text-gray-400 hover:bg-white/5 hover:text-white'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* شبكة الكروت */}
      {filteredItems.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto z-10 relative">
          {filteredItems.map((item) => {
            const fileInfo = getFileTypeInfo(item.type);
            const hasThumbnail = item.thumbnailUrl && item.thumbnailUrl !== '#';
            const hasFileUrl = item.fileUrl && item.fileUrl !== '#';

            return (
              <div 
                key={item.id}
                className="group relative rounded-3xl bg-white/[0.02] border border-white/10 overflow-hidden hover:border-fuchsia-500/40 hover:shadow-[0_0_30px_rgba(217,70,239,0.15)] hover:-translate-y-1.5 transition-all duration-500 flex flex-col justify-between"
              >
                <div>
                  {/* معالجة الصورة المصغرة إن وجدت */}
                  {hasThumbnail ? (
                    <div className="relative h-44 w-full overflow-hidden bg-black/40 border-b border-white/5">
                      <img 
                        src={item.thumbnailUrl} 
                        alt={item.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" 
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#050812] via-transparent to-transparent"></div>
                      <span className={`absolute top-3 right-3 px-3 py-1 rounded-full text-xs font-medium border backdrop-blur-md flex items-center gap-1.5 ${fileInfo.color}`}>
                        {fileInfo.icon}
                        {fileInfo.label}
                      </span>
                    </div>
                  ) : (
                    <div className="p-6 pb-0 flex items-center justify-between">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium border backdrop-blur-md flex items-center gap-1.5 ${fileInfo.color}`}>
                        {fileInfo.icon}
                        {fileInfo.label}
                      </span>
                      <Sparkles size={16} className="text-fuchsia-400/40 group-hover:text-fuchsia-400 transition-colors" />
                    </div>
                  )}

                  {/* تفاصيل المستند */}
                  <div className="p-6">
                    <h3 className="text-lg font-bold text-white mb-2 group-hover:text-fuchsia-300 transition-colors">
                      {item.title}
                    </h3>
                    <p className="text-gray-400 text-xs leading-relaxed line-clamp-3">
                      {item.description || 'لا يوجد وصف إضافي للمستند.'}
                    </p>
                  </div>
                </div>

                {/* أزرار التحميل والمعاينة */}
                <div className="p-6 pt-0 flex items-center gap-3 mt-4">
                  {hasFileUrl ? (
                    <>
                      <button 
                        onClick={() => {
                          const isOfficeFile = ['word', 'excel', 'powerpoint', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(item.type?.toLowerCase());
                          if (isOfficeFile) {
                            const absoluteUrl = window.location.origin + encodeURI(item.fileUrl);
                            window.open(`https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(absoluteUrl)}`, '_blank');
                          } else {
                            window.open(item.fileUrl, '_blank');
                          }
                        }}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 bg-fuchsia-600 hover:bg-fuchsia-500 text-white rounded-xl text-xs font-bold transition-all shadow-[0_0_15px_rgba(217,70,239,0.3)] hover:shadow-[0_0_20px_rgba(217,70,239,0.5)]"
                      >
                        <Eye size={15} />
                        <span>فتح / معاينة</span>
                      </button>
                      <a 
                        href={item.fileUrl} 
                        download
                        className="flex items-center justify-center p-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-gray-300 hover:text-white transition-all"
                        title="تحميل الملف"
                      >
                        <Download size={16} />
                      </a>
                    </>
                  ) : (
                    <button 
                      disabled 
                      className="w-full py-2.5 bg-white/5 border border-white/5 rounded-xl text-xs text-gray-500 cursor-not-allowed text-center"
                    >
                      قريباً (الملف قيد التجهيز)
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-20 bg-white/[0.01] border border-white/5 rounded-3xl max-w-2xl mx-auto">
          <p className="text-gray-400 text-sm">لم نجد أي ملفات تطابق بحثك حالياً.</p>
        </div>
      )}
    </div>
  );
}