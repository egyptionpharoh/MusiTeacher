'use client';
import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useTheme } from '../context/ThemeContext';
import Image from 'next/image';
import { 
  BookOpen, Wand2, FileSpreadsheet, X, Send as SendIcon, Bot, Settings,
  User, Palette, Bell, Lock, Database, Accessibility, HelpCircle, LogOut, Trash2, Eye, ArrowUpLeft 
} from 'lucide-react';

export default function HomePage() {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const { theme, changeTheme, isDark } = useTheme();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('account'); // للتحكم بتبويبات الإعدادات
  const [isReady, setIsReady] = useState(false);

  // إعدادات الشات بوت
  const [messages, setMessages] = useState([
    {
      text: "مرحباً بك في منصة MusiTeacher 🎵. يسعدني أن أكون مساعدك الرقمي في إعداد التحضيرات التعليمية وتنظيم أعمالك اليومية. أخبرني بما تحتاج إليه وسأساعدك خطوة بخطوة.",
      isUser: false
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    setIsReady(true);
  }, []);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  useEffect(() => { scrollToBottom(); }, [messages, isTyping]);

 const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputText.trim() || isTyping) return;

    const userMessage = inputText.trim();
    setMessages(prev => [...prev, { text: userMessage, isUser: true }]);
    setInputText('');
    setIsTyping(true);

    try {
      // إرسال الطلب لنقطة الـ API
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: userMessage, history: messages }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.message || `Server error: ${response.status}`);
      }

      // قراءة الرد بأي صيغة مرجعة من الـ API
      const aiReply = data.reply || data.response || data.message || data.text || data.result;

      if (!aiReply) {
        throw new Error("لم يتم استلام نص في استجابة الذكاء الاصطناعي");
      }

      setMessages(prev => [...prev, { text: aiReply, isUser: false }]);
    } catch (error) {
      console.error("Error communicating with AI:", error);
      setMessages(prev => [
        ...prev, 
        { text: "عذراً، حدث خطأ أثناء الاتصال بالذكاء الاصطناعي. تأكد من إعدادات الـ API ومسار /api/chat.", isUser: false }
      ]);
    } finally {
      setIsTyping(false);
    }
  };
 // تبويبات الإعدادات لتسهيل التنقل
  const settingsTabs = [
    { id: 'account', label: 'الحساب', icon: User },
    { id: 'appearance', label: 'المظهر', icon: Palette },
    { id: 'notifications', label: 'الإشعارات', icon: Bell },
    { id: 'privacy', label: 'الخصوصية', icon: Lock },
    { id: 'data', label: 'البيانات والتخزين', icon: Database },
    { id: 'accessibility', label: 'إمكانية الوصول', icon: Accessibility },
    { id: 'support', label: 'الدعم والمساعدة', icon: HelpCircle },
  ];

  return (
    <div className={`min-h-screen flex flex-col items-center justify-start pt-32 pb-8 px-4 sm:px-8 relative overflow-hidden transition-all duration-700 ease-in-out
      ${isDark ? 'bg-[#050B14] text-white' : 'bg-[#FDFBF7] text-stone-900'}
      ${isReady ? 'opacity-100' : 'opacity-0'}`}
      dir="rtl"
    >
      {/* دوائر الإضاءة الخلفية المعدلة لتناسب الهوية الفاخرة */}
      <div className={`absolute top-[-10%] right-[-5%] w-[500px] h-[500px] rounded-full blur-[120px] z-0 pointer-events-none transition-colors duration-700 ${isDark ? 'bg-red-900/20' : 'bg-rose-200/40'}`}></div>
      <div className={`absolute bottom-[-10%] left-[-10%] w-[400px] h-[400px] rounded-full blur-[100px] z-0 pointer-events-none transition-colors duration-700 ${isDark ? 'bg-blue-900/20' : 'bg-amber-100/50'}`}></div>

      {/* زر فتح الإعدادات (أعلى الشاشة) */}
      <div className="absolute top-6 right-6 md:top-8 md:right-8 z-40">
        <button 
          onClick={() => setIsSettingsOpen(true)}
          className={`flex items-center justify-center p-3 rounded-full border transition-all duration-300 shadow-md hover:scale-110 backdrop-blur-sm
            ${isDark ? 'bg-white/5 border-white/10 text-gray-400 hover:text-cyan-400 hover:bg-cyan-500/10' : 'bg-white/80 border-sky-100 text-gray-600 hover:text-blue-600 hover:bg-blue-50'}`}
          title="الإعدادات الشاملة"
        >
          <Settings size={22} className="transition-transform duration-500 hover:rotate-90" />
        </button>
      </div>

      {/* نافذة الإعدادات (Modal) */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm transition-opacity">
          <div className={`relative w-full max-w-5xl h-[85vh] flex flex-col md:flex-row rounded-3xl overflow-hidden shadow-2xl border 
            ${isDark ? 'bg-[#0A1628] border-white/10' : 'bg-white border-gray-200'}`}>
            
            {/* زر الإغلاق */}
            <button onClick={() => setIsSettingsOpen(false)} className={`absolute top-4 left-4 p-2 rounded-full z-50 transition-colors ${isDark ? 'hover:bg-white/10 text-gray-400' : 'hover:bg-gray-100 text-gray-600'}`}>
              <X size={24} />
            </button>

            {/* القائمة الجانبية للإعدادات */}
            <div className={`w-full md:w-1/4 p-6 border-l overflow-y-auto flex flex-col gap-2 ${isDark ? 'bg-[#0D1E36]/50 border-white/5' : 'bg-gray-50 border-gray-100'}`}>
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
                <Settings className="text-cyan-500" size={28} /> الإعدادات
              </h2>
              {settingsTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-right
                    ${activeTab === tab.id 
                      ? (isDark ? 'bg-cyan-500/20 text-cyan-400' : 'bg-blue-100 text-blue-700') 
                      : (isDark ? 'text-gray-400 hover:bg-white/5 hover:text-white' : 'text-gray-600 hover:bg-gray-200 hover:text-gray-900')}`}
                >
                  <tab.icon size={20} /> {tab.label}
                </button>
              ))}
            </div>

            {/* محتوى الإعدادات */}
            <div className="w-full md:w-3/4 p-8 overflow-y-auto custom-scrollbar">
              
              {/* قسم الحساب */}
              {activeTab === 'account' && (
                <div className="space-y-8 animate-fade-in-up">
                  <h3 className="text-2xl font-bold border-b pb-4 border-gray-500/20">الملف الشخصي</h3>
                  
                  <div className="flex items-center gap-6">
                    <div className={`w-20 h-20 rounded-full flex items-center justify-center text-3xl shadow-lg border-2 ${isDark ? 'bg-gray-800 border-gray-600' : 'bg-gray-200 border-gray-300'}`}>
                      👤
                    </div>
                    <div>
                      <input type="file" className="hidden" id="avatarUpload" />
                      <label htmlFor="avatarUpload" className="px-4 py-2 bg-blue-600 text-white rounded-lg cursor-pointer hover:bg-blue-700 transition-colors text-sm">تغيير الصورة</label>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-sm font-medium opacity-80">الاسم الكامل</label>
                      <input type="text" placeholder="حسين الملك" className={`w-full px-4 py-3 rounded-xl border outline-none focus:ring-2 focus:ring-blue-500 transition-all ${isDark ? 'bg-[#0A1628] border-gray-700' : 'bg-gray-50 border-gray-200'}`} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium opacity-80">البريد الإلكتروني</label>
                      <input type="email" placeholder="hussien.elmalek@gmail.com" className={`w-full px-4 py-3 rounded-xl border outline-none focus:ring-2 focus:ring-blue-500 transition-all ${isDark ? 'bg-[#0A1628] border-gray-700' : 'bg-gray-50 border-gray-200'}`} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium opacity-80">كلمة المرور</label>
                      <div className="relative">
                        <input type="password" placeholder="••••••••" className={`w-full px-4 py-3 rounded-xl border outline-none focus:ring-2 focus:ring-blue-500 transition-all ${isDark ? 'bg-[#0A1628] border-gray-700' : 'bg-gray-50 border-gray-200'}`} />
                        <Eye className="absolute left-3 top-3.5 opacity-50 cursor-pointer hover:opacity-100" size={20} />
                      </div>
                    </div>
                  </div>

                  <div className="pt-6 flex gap-4 flex-wrap">
                    <button className="px-6 py-2.5 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/30">حفظ التعديلات</button>
                    <button className="px-6 py-2.5 flex items-center gap-2 bg-red-500/10 text-red-500 font-medium rounded-xl hover:bg-red-500 hover:text-white transition-colors"><LogOut size={18} /> تسجيل الخروج</button>
                    <button className="px-6 py-2.5 flex items-center gap-2 border border-red-500/50 text-red-500 font-medium rounded-xl hover:bg-red-500 hover:text-white transition-colors mr-auto"><Trash2 size={18} /> حذف الحساب</button>
                  </div>
                </div>
              )}

              {/* قسم المظهر */}
              {activeTab === 'appearance' && (
                <div className="space-y-8 animate-fade-in-up">
                  <h3 className="text-2xl font-bold border-b pb-4 border-gray-500/20">تخصيص الواجهة</h3>
                  
                  <div className="space-y-4">
                    <label className="text-sm font-medium opacity-80 block">الوضع الداكن / الفاتح</label>
                    <div className="flex gap-4">
                      <button onClick={() => changeTheme('light')} className={`flex-1 py-4 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all ${!isDark ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-700 hover:border-gray-500'}`}>
                        <span className="text-3xl">☀️</span> الفاتح
                      </button>
                      <button onClick={() => changeTheme('dark')} className={`flex-1 py-4 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all ${isDark ? 'border-cyan-500 bg-cyan-500/10 text-cyan-400' : 'border-gray-200 hover:border-gray-400'}`}>
                        <span className="text-3xl">🌙</span> الداكن
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-sm font-medium opacity-80">لغة المنصة</label>
                      <select className={`w-full px-4 py-3 rounded-xl border outline-none ${isDark ? 'bg-[#0A1628] border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
                        <option value="ar">العربية</option>
                        <option value="en">English</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium opacity-80">اللون الأساسي</label>
                      <input type="color" defaultValue="#0ea5e9" className="w-full h-[50px] rounded-xl cursor-pointer" />
                    </div>
                  </div>

                  <div className="space-y-2 pt-4">
                    <label className="text-sm font-medium opacity-80">حجم الخط</label>
                    <input type="range" min="14" max="24" defaultValue="16" className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700" />
                  </div>
                </div>
              )}

              {/* أقسام أخرى مبسطة للتوضيح (يمكنك التوسع فيها لاحقاً) */}
              {(activeTab === 'notifications' || activeTab === 'privacy' || activeTab === 'data' || activeTab === 'accessibility') && (
                <div className="space-y-6 animate-fade-in-up">
                  <h3 className="text-2xl font-bold border-b pb-4 border-gray-500/20">{settingsTabs.find(t => t.id === activeTab)?.label}</h3>
                  
                  {/* مثال لعناصر تحكم عامة */}
                  {['تفعيل الإشعارات والتنبيهات', 'أصوات النظام', 'النسخ الاحتياطي التلقائي', 'وضع التباين العالي'].map((item, i) => (
                    <div key={i} className={`flex items-center justify-between p-4 rounded-xl border ${isDark ? 'bg-white/5 border-white/5' : 'bg-gray-50 border-gray-100'}`}>
                      <span className="font-medium">{item}</span>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" className="sr-only peer" defaultChecked={i % 2 === 0} />
                        <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-[-100%] peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-500"></div>
                      </label>
                    </div>
                  ))}
                </div>
              )}

              {/* قسم الدعم والمساعدة (Accordion مصغر) */}
              {activeTab === 'support' && (
                <div className="space-y-6 animate-fade-in-up">
                  <h3 className="text-2xl font-bold border-b pb-4 border-gray-500/20">مركز الدعم والأسئلة الشائعة</h3>
                  <div className="space-y-4">
                    <details className={`p-4 rounded-xl border cursor-pointer ${isDark ? 'bg-white/5 border-white/10' : 'bg-white border-gray-200 shadow-sm'}`}>
                      <summary className="font-bold outline-none">عن منصة MusiTeacher</summary>
                      <p className="mt-3 text-sm opacity-80 leading-relaxed">منصة متكاملة صُممت خصيصاً لتسهيل المهام اليومية لمعلمي المهارات الموسيقية، وتشمل أدوات ذكية لتوليد التحضيرات ورصد الدرجات.</p>
                    </details>
                    <details className={`p-4 rounded-xl border cursor-pointer ${isDark ? 'bg-white/5 border-white/10' : 'bg-white border-gray-200 shadow-sm'}`}>
                      <summary className="font-bold outline-none">سياسة الخصوصية والاستخدام</summary>
                      <p className="mt-3 text-sm opacity-80 leading-relaxed">تتم معالجة كافة خطط الدروس والبيانات بشكل محلي وآمن لضمان سرية معلومات المعلمين والطلاب.</p>
                    </details>
                    <details className={`p-4 rounded-xl border cursor-pointer ${isDark ? 'bg-white/5 border-white/10' : 'bg-white border-gray-200 shadow-sm'}`}>
                      <summary className="font-bold outline-none">الإبلاغ عن مشكلة / اقتراح</summary>
                      <p className="mt-3 text-sm opacity-80 leading-relaxed">نسعد بتواصلكم عبر البريد الإلكتروني: hussien.elmalek@gmail.com لتطوير المنصة للأفضل.</p>
                    </details>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      )}

      {/* قسم العنوان والترحيب (الصفحة الرئيسية) */}
      <Link href="/" className="group z-10 text-center mb-16 animate-in slide-in-from-bottom-8 duration-700 mt-12 md:mt-0 flex flex-col items-center">
        {/* الشعار */}
        <div className="relative p-6 mb-4 rounded-3xl transition-all duration-500 group-hover:bg-white/5 group-hover:shadow-[0_0_40px_rgba(56,189,248,0.3)]">
          <Image 
            src="/logo.png" 
            alt="MusiTeacher Logo" 
            width={120}
            height={120}
            unoptimized
            className="object-contain transition-transform duration-500 group-hover:scale-110" 
          />
        </div>

        {/* العنوان الرئيسي: تم تكبير الحجم ومعالجة قص النقاط بالكامل عبر البادينج والارتفاع السطري المحسوب */}
        <h1 className={`text-5xl md:text-6xl lg:text-7xl font-black text-transparent bg-clip-text pt-2 pb-6 px-2 leading-[1.3] drop-shadow-md transition-all duration-500 bg-gradient-to-l
          ${isDark ? 'from-purple-600 via-blue-500 to-cyan-400' : 'from-indigo-600 via-sky-500 to-blue-700'}
          group-hover:opacity-90`}>
          بوابة MusiTeacher الذكية
        </h1>

        {/* الكبسولة الزجاجية الشفافة المحسنة للعبارة التسويقية الأصلية */}
        <div className="inline-flex relative mt-2 max-w-3xl mx-auto px-4">
          {/* توهج خلفي ناعم ومتكيف مع الوضعين ليعطي عمقاً زجاجياً */}
          <div className={`absolute -inset-2 rounded-full blur-xl opacity-40 transition duration-700 
            ${isDark ? 'bg-purple-500/10' : 'bg-indigo-500/5'}`}></div>
          
          {/* جسم الكبسولة الزجاجية الفاخرة */}
          <div className={`relative backdrop-blur-xl px-8 py-4 rounded-full border shadow-[0_12px_30px_rgba(0,0,0,0.03)] transition-all duration-500
            ${isDark 
              ? 'bg-white/[0.03] border-white/10 text-gray-200' 
              : 'bg-stone-50/60 border-stone-200/60 text-stone-700'}`}>
            <p className="text-lg md:text-xl font-semibold tracking-wide text-center leading-relaxed">
              المنصة الأولى المتكاملة لمعلمي المهارات الموسيقية في سلطنة عمان. اختر الأداة للبدء.
            </p>
          </div>
        </div>
      </Link>

      {/* شبكة الكروت (الأدوات) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 z-10 w-full max-w-6xl">
        <Link href="/bank" className={`group relative overflow-hidden rounded-2xl transition-all duration-300 ease-out cursor-pointer block transform
          ${isDark 
            ? 'p-8 duration-500 hover:-translate-y-3 bg-[#111827]/60 backdrop-blur-md border border-blue-500/20 hover:border-blue-400/60 hover:shadow-[0_0_30px_rgba(59,130,246,0.2)]' 
            : 'p-6 hover:-translate-y-2 hover:scale-[1.05] bg-white border border-gray-200/60 shadow-[0_4px_16px_rgba(0,0,0,0.03)] hover:shadow-[0_24px_48px_rgba(0,0,0,0.12)] hover:border-blue-400'}`}>
          
          <div className={isDark ? "block" : "flex justify-between items-start mb-5"}>
            <div className={isDark ? "" : "w-12 h-12 rounded-xl bg-gradient-to-b from-blue-50/50 to-blue-100/50 border border-blue-100/50 flex items-center justify-center transition-all duration-300 group-hover:scale-105 group-hover:shadow-sm"}>
              <BookOpen size={isDark ? 48 : 22} className={`transition-colors ${isDark ? 'mb-6 drop-shadow-md text-blue-400' : 'text-blue-600'}`} />
            </div>
            {!isDark && (
              <div className="w-8 h-8 rounded-full bg-gray-50/50 flex items-center justify-center opacity-0 translate-x-2 transition-all duration-300 group-hover:opacity-100 group-hover:translate-x-0">
                <ArrowUpLeft size={16} className="text-gray-400 group-hover:text-blue-600 transition-colors" />
              </div>
            )}
          </div>
          
          <h2 className={`font-bold transition-colors ${isDark ? 'text-2xl mb-3 text-white' : 'text-lg mb-2 text-gray-900 group-hover:text-blue-700'}`}>بنك التحضيرات</h2>
          <p className={`leading-relaxed transition-colors font-medium ${isDark ? 'text-gray-400' : 'text-sm text-gray-500'}`}>استعرض وحمل خطط الدروس المعتمدة رسمياً.</p>
        </Link>

        <Link href="/factory" className={`group relative overflow-hidden rounded-2xl transition-all duration-300 ease-out transform
          ${isDark 
            ? 'p-8 duration-500 hover:-translate-y-3 bg-[#111827]/60 backdrop-blur-md border border-orange-500/20 hover:border-orange-400/60 hover:shadow-[0_0_30px_rgba(249,115,22,0.2)]' 
            : 'p-6 hover:-translate-y-2 hover:scale-[1.05] bg-white border border-gray-200/60 shadow-[0_4px_16px_rgba(0,0,0,0.03)] hover:shadow-[0_24px_48px_rgba(0,0,0,0.12)] hover:border-orange-400'}`}>
          
          <div className={isDark ? "block" : "flex justify-between items-start mb-5"}>
            <div className={isDark ? "" : "w-12 h-12 rounded-xl bg-gradient-to-b from-orange-50/50 to-orange-100/50 border border-orange-100/50 flex items-center justify-center transition-all duration-300 group-hover:scale-105 group-hover:shadow-sm"}>
              <Wand2 size={isDark ? 48 : 22} className={`transition-colors ${isDark ? 'mb-6 drop-shadow-md text-orange-400' : 'text-orange-500'}`} />
            </div>
            {!isDark && (
              <div className="w-8 h-8 rounded-full bg-gray-50/50 flex items-center justify-center opacity-0 translate-x-2 transition-all duration-300 group-hover:opacity-100 group-hover:translate-x-0">
                <ArrowUpLeft size={16} className="text-gray-400 group-hover:text-orange-500 transition-colors" />
              </div>
            )}
          </div>
          
          <h2 className={`font-bold transition-colors ${isDark ? 'text-2xl mb-3 text-white' : 'text-lg mb-2 text-gray-900 group-hover:text-orange-600'}`}>مصنع التحضيرات</h2>
          <p className={`leading-relaxed transition-colors font-medium ${isDark ? 'text-gray-400' : 'text-sm text-gray-500'}`}>مساعدك الذكي لتوليد تحضيرات إبداعية جديدة.</p>
        </Link>

        <Link href="/dashboard/guide" className={`group relative block w-full h-full z-10 overflow-hidden rounded-2xl transition-all duration-300 ease-out transform pointer-events-auto
          ${isDark 
            ? 'p-8 duration-500 hover:-translate-y-3 bg-[#111827]/60 backdrop-blur-md border border-green-500/20 hover:border-green-400/60 hover:shadow-[0_0_30px_rgba(34,197,94,0.2)]' 
            : 'p-6 hover:-translate-y-2 hover:scale-[1.05] bg-white border border-gray-200/60 shadow-[0_4px_16px_rgba(0,0,0,0.03)] hover:shadow-[0_24px_48px_rgba(0,0,0,0.12)] hover:border-green-400'}`}>
          
          <div className={isDark ? "block" : "flex justify-between items-start mb-5"}>
            <div className={isDark ? "" : "w-12 h-12 rounded-xl bg-gradient-to-b from-green-50/50 to-green-100/50 border border-green-100/50 flex items-center justify-center transition-all duration-300 group-hover:scale-105 group-hover:shadow-sm"}>
              <FileSpreadsheet size={isDark ? 48 : 22} className={`transition-colors ${isDark ? 'mb-6 drop-shadow-md text-green-400' : 'text-green-600'}`} />
            </div>
            {!isDark && (
              <div className="w-8 h-8 rounded-full bg-gray-50/50 flex items-center justify-center opacity-0 translate-x-2 transition-all duration-300 group-hover:opacity-100 group-hover:translate-x-0">
                <ArrowUpLeft size={16} className="text-gray-400 group-hover:text-green-600 transition-colors" />
              </div>
            )}
          </div>
          
          <h2 className={`font-bold transition-colors ${isDark ? 'text-2xl mb-3 text-white' : 'text-lg mb-2 text-gray-900 group-hover:text-green-700'}`}>الأدوات والألعاب التعليمية</h2>
          <p className={`leading-relaxed transition-colors font-medium ${isDark ? 'text-gray-400' : 'text-sm text-gray-500'}`}>أتمتة إدخال الدرجات في سجلات البوابة التعليمية.</p>
        </Link>
      </div>

      {/* الفوتر */}
      <footer className="w-full py-6 text-center z-10 mt-auto">
        <Link href="/founder" className={`text-sm font-bold tracking-wide transition-colors ${isDark ? 'text-cyan-400' : 'text-blue-600'}`}>
          برمجة وتطوير: حسين الملك
        </Link>
      </footer>

      {/* الشات بوت (المعلم الذكي) - تم إضافة pointer-events-none للحاوية لمنع حجب الكليكات */}
      <div className="fixed bottom-6 left-6 z-[9000] flex flex-col items-end pointer-events-none" dir="rtl">
        <div className={`mb-4 w-80 sm:w-96 rounded-2xl shadow-2xl overflow-hidden transition-all duration-300 origin-bottom-left pointer-events-auto ${isChatOpen ? 'scale-100 opacity-100' : 'scale-0 opacity-0'} ${isDark ? 'bg-gray-900 border border-gray-800' : 'bg-white border border-gray-200'}`}>
          <div className="bg-gradient-to-r from-blue-600 to-cyan-500 p-4 flex justify-between items-center text-white">
            <div className="flex items-center gap-2"><Bot size={24} /><span className="font-bold">Smart Teacher</span></div>            <button onClick={() => setIsChatOpen(false)} className="hover:bg-white/20 p-1 rounded-lg"><X size={20} /></button>
          </div>
          
          {/* تم تعديل الحاوية هنا لضمان اتجاه الـ RTL */}
          <div className={`h-80 p-4 overflow-y-auto flex flex-col gap-3 ${isDark ? 'bg-gray-800' : 'bg-gray-50'}`}>
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.isUser ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] p-3 rounded-2xl text-sm ${msg.isUser ? 'bg-blue-600 text-white rounded-bl-none' : `rounded-br-none ${isDark ? 'bg-gray-700 text-white' : 'bg-white border text-gray-800'}`}`}>
                  {msg.text}
                </div>
              </div>
            ))}
            {isTyping && (
              <div className="flex justify-start">
                <div className={`p-3 rounded-2xl rounded-br-none flex gap-1 ${isDark ? 'bg-gray-700' : 'bg-white border'}`}>
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></span>
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></span>
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
          
          <form onSubmit={handleSendMessage} className="p-3 border-t flex gap-2 bg-white border-gray-100 dark:bg-gray-900 dark:border-gray-800">
            <input 
  type="text" 
  value={inputText} 
  onChange={(e) => setInputText(e.target.value)}
  onKeyDown={(e) => { if (e.key === 'Enter') handleSendMessage(e); }}
  placeholder="اسأل المعلم الذكي..." 
  className="flex-1 px-4 py-2 rounded-lg focus:outline-none text-sm border bg-gray-100 border-gray-200 text-gray-800 dark:bg-gray-800 dark:border-gray-700 dark:text-white" 
/>
            <button type="submit" disabled={!inputText.trim()} className="bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"><SendIcon size={18} /></button>
          </form>
        </div>

        <button 
  onClick={() => setIsChatOpen(!isChatOpen)} 
  className="relative w-[70px] h-[70px] rounded-full flex items-center justify-center transition-all duration-300 hover:scale-105 group border-2 pointer-events-auto shadow-[0_0_20px_rgba(0,0,0,0.1)] dark:shadow-[0_0_20px_rgba(0,210,256,0.3)] bg-white border-blue-100 dark:bg-gray-900 dark:border-gray-700"
>
          <span className="text-3xl z-10 transition-transform duration-300 group-hover:scale-110">🤖</span>
        </button>
      </div>
    </div>
  );
}
