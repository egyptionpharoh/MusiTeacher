'use client';

import React, { useRef, useState } from 'react';
import { useStore } from '../../store/useStore';
import { useAuthStore } from '../../store/useAuthStore'; // استيراد صحيح
import { parseNoorExcel } from './utils/excelParser'; 
import { Printer, Trash2, CheckCircle, Palette, Upload } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import LandingPage from './LandingPage'; 
import './noormark.css';

const headerThemes = [
  { value: 'blue', label: 'أزرق ملكي' },
  { value: 'navy', label: 'وردي' },
  { value: 'royal-blue', label: 'أزرق داكن' },
  { value: 'maroon', label: 'نبيتي ملكي' },
  { value: 'emerald', label: 'بنفسجي' },
  { value: 'classic-school', label: 'رمادي' },
  { value: 'arabic-art', label: 'ديواني' },
  { value: 'gold', label: 'ذهبي' },
  { value: 'simple', label: 'أبيض' }
];

export default function NoorMarkModule() {
  const { studentsData, settings, setSettings, clearData, setStudentsData, linkUser } = useStore();
const { user } = useAuthStore(); // سحب بيانات المعلم المسجل

// في الـ useEffect (أو عند تحميل المكون):
React.useEffect(() => {
  if (user) {
    linkUser({ id: user.id, name: user.name });
  }
}, [user]);
  const [headerTheme, setHeaderTheme] = useState('blue');
  const [reportMode, setReportMode] = useState<'summary' | 'detailed'>('summary');
  const [isLoading, setIsLoading] = useState(false);
  const [showLanding, setShowLanding] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAutomate = () => {
    if (studentsData.length === 0) {
      toast.error('لا توجد بيانات لإرسالها!');
      return;
    }
    window.dispatchEvent(new CustomEvent('MusiTeacherData', { detail: studentsData }));
    toast.success('تم إرسال البيانات إلى البوابة التعليمية بنجاح!');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    try {
      const result: any = await parseNoorExcel(file, 'detailed'); 
      const data = result.students ? result.students : result; 
      setStudentsData(data);
      toast.success('تم سحب المجموع والدرجات التفصيلية بنجاح!');
    } catch (err: any) {
      toast.error(err.toString() || 'حدث خطأ في قراءة الملف');
    } finally {
      setIsLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handlePrint = () => window.print();

  return (
    <div className="w-full font-cairo" dir="rtl">
      <Toaster position="top-center" />
      
      {showLanding ? (
        <LandingPage onEnter={() => setShowLanding(false)} />
      ) : (
        <>
          <div className="no-print bg-[#0f2027]/90 backdrop-blur-xl border border-gray-700 rounded-2xl p-6 mb-8 shadow-xl">
            {/* ... (نفس لوحة التحكم السابقة) ... */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 pb-6 border-b border-gray-700">
              <div>
                <h1 className="text-3xl font-bold text-white">NoorMark Pro</h1>
                <p className="text-gray-400 mt-1">إعداد وطباعة كشوف التقويم المستمر</p>
              </div>
              <div className="flex gap-3">
                {studentsData.length > 0 && (
                  <>
                    <button onClick={handleAutomate} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-all font-bold">
                      <CheckCircle size={18} /> إرسال للبوابة
                    </button>
                    <button onClick={handlePrint} className="flex items-center gap-2 px-4 py-2 bg-green-600/20 text-green-400 border border-green-600/30 rounded-lg hover:bg-green-600/30 transition-all">
                      <Printer size={18} /> طباعة
                    </button>
                    <button onClick={() => { if(window.confirm('هل أنت متأكد أنك تريد مسح جميع البيانات؟')) clearData(); }} className="flex items-center gap-2 px-4 py-2 bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/20 transition-all">
                      <Trash2 size={18} /> مسح
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6 bg-black/30 p-4 rounded-xl border border-gray-700/50">
              <select value={settings.subject} onChange={(e) => setSettings({ subject: e.target.value })} className="bg-gray-800 border border-gray-600 text-white text-sm rounded-lg p-2.5 outline-none focus:border-blue-500">
                <option value="المهارات الموسيقية">المهارات الموسيقية</option>
                <option value="الفنون الموسيقية">الفنون الموسيقية</option>
              </select>
              <input type="text" placeholder="الصف" value={settings.grade} onChange={(e) => setSettings({ grade: e.target.value })} className="bg-gray-800 border border-gray-600 text-white text-sm rounded-lg p-2.5 outline-none focus:border-blue-500" />
              <input type="text" placeholder="العام الدراسي" value={settings.year} onChange={(e) => setSettings({ year: e.target.value })} className="bg-gray-800 border border-gray-600 text-white text-sm rounded-lg p-2.5 outline-none focus:border-blue-500" />
              <input type="text" placeholder="اسم المعلم" value={settings.teacher} onChange={(e) => setSettings({ teacher: e.target.value })} className="bg-gray-800 border border-gray-600 text-white text-sm rounded-lg p-2.5 outline-none focus:border-blue-500" />
              <input type="text" placeholder="اسم المدير" value={settings.principal} onChange={(e) => setSettings({ principal: e.target.value })} className="bg-gray-800 border border-gray-600 text-white text-sm rounded-lg p-2.5 outline-none focus:border-blue-500" />
            </div>

            <div className="flex flex-wrap gap-4 items-center">
              <div className="flex items-center gap-2">
                <Palette size={18} className="text-gray-400" />
                <select value={headerTheme} onChange={(e) => setHeaderTheme(e.target.value)} className="bg-gray-800 border border-gray-600 text-white text-sm rounded-lg p-2 outline-none">
                  {headerThemes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-1 bg-gray-800 p-1 rounded-lg border border-gray-700">
                <button onClick={() => setReportMode('summary')} className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${reportMode === 'summary' ? 'bg-blue-600 text-white' : 'text-gray-400'}`}>كشف مختصر</button>
                <button onClick={() => setReportMode('detailed')} className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${reportMode === 'detailed' ? 'bg-blue-600 text-white' : 'text-gray-400'}`}>سجل تفصيلي</button>
              </div>
            </div>
          </div>

          {studentsData.length === 0 ? (
            <div className="bg-black/20 border-2 border-dashed border-gray-700 rounded-3xl p-12 text-center no-print hover:border-blue-500 transition-all">
              <input type="file" accept=".xlsx, .xls" onChange={handleFileUpload} ref={fileInputRef} className="hidden" id="excel-upload" />
              <label htmlFor="excel-upload" className="cursor-pointer flex flex-col items-center gap-4">
                <Upload size={40} className="text-blue-500" />
                <h3 className="text-xl font-bold text-white">{isLoading ? 'جاري السحب...' : 'ارفع كشف الدرجات (Excel)'}</h3>
              </label>
            </div>
          ) : (
            <div className={`printable-area ${headerTheme} bg-white text-black p-8 rounded-xl shadow-lg mx-auto max-w-5xl`}>
              <div className="header">
                <div className="header-content">
                  <div style={{ textAlign: 'center' }}>
                    <h1>
                      {reportMode === 'detailed' ? 'سجل درجات مادة' : 'استمارة رصد درجات الطلبة فى مادة'}
                      <span> {settings.subject}</span>
                    </h1>
                    <p>الصف: {settings.grade} | الفصل الدراسي: {settings.term} | العام الدراسي: {settings.year}</p>
                  </div>
                </div>
              </div>

              {/* ... (الجدول والتوقيعات كما هي في ملفك) ... */}
              <table className="w-full mb-8">
                {/* ... تفاصيل الجدول ... */}
              </table>

              <div className="signatures">
                <div><div>توقيع معلم المادة</div><div className="sign-name">{settings.teacher}</div></div>
                <div><div>يعتمد ، مدير المدرسة</div><div className="sign-name">{settings.principal}</div></div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}