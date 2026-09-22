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

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const userMessage = inputText.trim();
    setMessages(prev => [...prev, { text: userMessage, isUser: true }]);
    setInputText('');
    setIsTyping(true);

    setTimeout(() => {
      setIsTyping(false);
      let fullResponse = "";
      const lowerMessage = userMessage.toLowerCase();

      if (lowerMessage.includes('جوجل') || lowerMessage.includes('جيمني') || lowerMessage.includes('gemini') || lowerMessage.includes('google') || lowerMessage.includes('gpt')) {
        fullResponse = "لا يا فندم، أنا لست تابعاً لجوجل أو جيمني. أنا 'المعلم الذكي'، تم برمجتي وتطويري حصرياً بواسطة الفنان المصري 'حسين الملك' لخدمة منصة MusiTeacher ومعلمي المهارات والفنون الموسيقية في سلطنة عمان.";      } 
      else if (lowerMessage.includes('من أنت') || lowerMessage.includes('مين انت') || lowerMessage.includes('اسمك') || lowerMessage.includes('برمجك') || lowerMessage.includes('صنعك') || lowerMessage.includes('حسين')) {
        fullResponse = "أنا مساعدك الذكي الخاص بمنصة MusiTeacher. مطوري هو الباحث الأكاديمي والمهندس 'حسين الملك'، وهدفي هو مساعدتك في أتمتة وتحضير دروسك بكل سهولة واحترافية.";
      }
      else if (lowerMessage.includes('مساء') || lowerMessage.includes('صباح') || lowerMessage.includes('سلام') || lowerMessage.includes('أهلا') || lowerMessage.includes('مرحبا')) {
        fullResponse = "وعليكم السلام ورحمة الله وبركاته، أهلاً وسهلاً بك في بوابتك الذكية. يسعدني أن أكون مساعدك الرقمي في إعداد التحضيرات وتنظيم المهام التعليمية بكل سهولة ودقة. تفضل، أنا جاهز لمساعدتك.";      } 
      else if (lowerMessage.includes('موسيقى') || lowerMessage.includes('إيقاع') || lowerMessage.includes('نوتة') || lowerMessage.includes('عزف') || lowerMessage.includes('درس') || lowerMessage.includes('تحضير')) {
        fullResponse = "موضوع رائع! يمكننا استخدام 'مصنع التحضيرات' لتوليد أهداف دقيقة لهذا الدرس مع أنشطة تفاعلية للطلاب. هل ننتقل للمصنع الآن؟";
      }
      else if (lowerMessage.includes('شكرا') || lowerMessage.includes('تسلم') || lowerMessage.includes('يعطيك العافية') || lowerMessage.includes('بطل')) {
        fullResponse = "العفو يا معلمنا المبدع! أنا هنا دائماً لتسهيل عملك. لا تتردد في سؤالي في أي وقت.";
      }
      else {
        fullResponse = "هممم.. فهمت قصدك. لنجعل الأمور أكثر عملية، ما رأيك أن نتوجه إلى 'مصنع التحضيرات' لنقوم بصياغة هذه الفكرة في شكل درس موسيقي متكامل؟";
      }

      setMessages(prev => [...prev, { text: "", isUser: false }]);
      
      let currentIndex = 0;
      const typingInterval = setInterval(() => {
        setMessages(prev => {
          const newMessages = [...prev];
          const lastIndex = newMessages.length - 1;
          newMessages[lastIndex] = { ...newMessages[lastIndex], text: fullResponse.slice(0, currentIndex + 1) };
          return newMessages;
        });
        currentIndex++;
        if (currentIndex >= fullResponse.length) clearInterval(typingInterval);
      }, 40); // زيادة القيمة قليلاً تجعل الكتابة تبدو أكثر تأنياً ومحاكاة للبشر
    }, 1000);
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
    <div className={`min-h-screen flex flex-col items-center justify-center p-8 relative overflow-hidden transition-all duration-700 ease-in-out
      ${isDark 
        ? 'bg-[#050B14] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#112240] via-[#050B14] to-black text-white' 
        : 'bg-[#FCFBF8] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#F4EFE6] via-[#FCFBF8] to-white text-stone-900'}
      ${isReady ? 'opacity-100' : 'opacity-0'}`}
      dir="rtl"
    >
      {/* دوائر الإضاءة الخلفية المستوحاة من الصفحة المرجعية لتعزيز التوهج الفاخر */}
      <div className={`absolute top-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full blur-[120px] z-0 pointer-events-none transition-colors duration-700 ${isDark ? 'bg-blue-600/20' : 'bg-amber-500/15'}`}></div>
      <div className={`absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full blur-[120px] z-0 pointer-events-none transition-colors duration-700 ${isDark ? 'bg-purple-600/20' : 'bg-orange-400/15'}`}></div>

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

      {/* قسم الـ Hero الاحترافي الشامل (Premium Hero Section) */}
      <div className="w-full max-w-5xl z-10 text-center mt-28 md:mt-36 mb-16 animate-in slide-in-from-bottom-12 duration-1000 flex flex-col items-center relative px-4">
        
        {/* أيقونة اللوجو التفاعلية محاطة بهالة ضوئية ناعمة */}
        <Link href="/" className="group flex flex-col items-center no-underline select-none">
          <div className="relative p-5 mb-6 rounded-full transition-all duration-700 group-hover:bg-white/5 group-hover:shadow-[0_0_50px_rgba(14,165,233,0.25)] dark:group-hover:shadow-[0_0_50px_rgba(6,182,212,0.3)]">
            <Image 
  src="/logo.png" 
  alt="MusiTeacher Logo" 
  width={40} 
  height={40}
  unoptimized // بما أنك تستخدم unoptimized فأنت تتجاوز تحسينات Next.js التلقائية
  style={{ width: '100%', height: 'auto' }} // هذا السطر هو الحل الجذري
  className="object-contain"
/>
          </div>
        </Link>

        {/* معالجة وهندسة العنوان الرئيسي - الحجم المكبر مع حماية كاملة للنقاط السفلية (Padding Protection Layer) */}
        <div className="relative select-none w-full max-w-4xl pt-4 pb-6 px-4">
          <h1 className={`text-5xl sm:text-6xl md:text-7xl font-black text-transparent bg-clip-text tracking-tight leading-[1.25] transition-all duration-500 bg-gradient-to-l drop-shadow-xl
            ${isDark ? 'from-purple-600 via-blue-500 to-cyan-400 shadow-cyan-500/10' : 'from-indigo-600 via-sky-500 to-blue-700'}`}>
            مصنع التحضيرات المتطورة
          </h1>
        </div>

        {/* الكبسولة الزجاجية الفاخرة عالية النقاء (Premium Glass Capsule) */}
        <div className="inline-flex relative group mt-4 w-full max-w-3xl px-2 sm:px-0">
          {/* تأثير التوهج الخلفي التفاعلي للكبسولة عند تمرير الماوس */}
          <div className="absolute -inset-1.5 bg-gradient-to-r from-blue-500/20 via-cyan-500/15 to-purple-500/20 rounded-2xl sm:rounded-full blur-2xl opacity-40 group-hover:opacity-75 transition duration-1000 group-hover:duration-500"></div>
          
          {/* جسم اللوح الزجاجي (Glass Panel) - شفافية تامة مع حواف عازلة وحماية للوضع الداكن والفاتح */}
          <div className="relative w-full bg-white/30 dark:bg-black/40 backdrop-blur-3xl px-6 py-5 sm:px-12 sm:py-5.5 rounded-2xl sm:rounded-full border border-white/20 dark:border-white/5 border-t-white/40 dark:border-t-white/10 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.08)] dark:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] transition-all duration-500 group-hover:bg-white/40 dark:group-hover:bg-black/50 group-hover:border-white/40 dark:group-hover:border-white/10 group-hover:shadow-[0_30px_60px_-10px_rgba(0,0,0,0.12)] dark:group-hover:shadow-[0_30px_60px_-10px_rgba(0,0,0,0.7)]">
            <p className="text-base sm:text-lg md:text-xl text-stone-800 dark:text-stone-200 font-semibold leading-relaxed tracking-wide drop-shadow-[0_1px_2px_rgba(255,255,255,0.5)] dark:drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)]">
              وداعاً لساعات التحضير اليدوي الرتيبة.. بنقرة واحدة ولّد تحضيراً احترافياً متكاملاً يطابق بدقة دليل المعلم، وانقله فوراً وبكل سهولة إلى منصة نور!
            </p>
          </div>
        </div>

      </div>

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
          
          <h2 className={`font-bold transition-colors ${isDark ? 'text-2xl mb-3 text-white' : 'text-lg mb-2 text-gray-900 group-hover:text-blue-700'}`}>مصنع التحضيرات</h2>
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