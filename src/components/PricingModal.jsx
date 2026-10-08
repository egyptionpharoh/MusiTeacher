'use client';
import React, { useState } from 'react';
import { X, Check, Crown, Zap, Sparkles, MessageCircle, ShieldCheck, Landmark, Copy, ArrowRight } from 'lucide-react';

export default function PricingModal({ isOpen, onClose, user }) {
  // حالة لحفظ الباقة التي اختارها المستخدم بدلاً من تحويله مباشرة
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [copiedText, setCopiedText] = useState('');

  if (!isOpen) return null;

  // دالة إغلاق النافذة وتصفير الحالة للبدء من جديد في المرة القادمة
  const handleClose = () => {
    setSelectedPlan(null);
    onClose();
  };

  // المرحلة الأولى: حفظ الباقة المختارة فقط دون الانتقال لواتساب
  const handleSelectPlan = (planName, price) => {
    setSelectedPlan({ name: planName, price: price });
  };

  // دالة النسخ المساعدة
  const handleCopy = (text, type) => {
    navigator.clipboard.writeText(text);
    setCopiedText(type);
    setTimeout(() => setCopiedText(''), 2000); // إخفاء رسالة النجاح بعد ثانيتين
  };

  // المرحلة النهائية: دالة تحويل المعلم للواتساب لإرسال الوصل
  const handleWhatsAppRedirect = () => {
    const rawPhone = '96879886716'; 
    const phone = rawPhone.replace(/[^0-9]/g, '');
    
    const userName = user?.displayName || 'معلم';
    const userEmail = user?.email || 'غير مسجل';
    const userId = user?.uid || 'غير معروف';
    
    // رسالة ديناميكية تعتمد على الباقة التي تم اختيارها
    const message = encodeURIComponent(
      `السلام عليكم، أرغب في تفعيل اشتراك MusiTeacher 🎵\n\n` +
      `👤 الاسم: ${userName}\n` +
      `📧 البريد: ${userEmail}\n` +
      `📌 المميزات المطلوبة: ${selectedPlan.name}\n` +
      `💰 القيمة: ${selectedPlan.price}\n` +
      `🆔 المعرف: ${userId}\n\n` +
      `ارجو مشاركتي فى منصتكم  ميوزي تيتشر و أود الاشتراك فى تطوير هذه المنصة.`
    );

    // تم تغيير النطاق إلى api.whatsapp.com لحل مشكلة DNS_PROBE_FINISHED_NXDOMAIN
    window.open(`https://api.whatsapp.com/send?phone=${phone}&text=${message}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in" dir="rtl">
      <div className="relative w-full max-w-4xl bg-[#0f172a]/95 text-white rounded-3xl p-6 md:p-10 border border-white/10 shadow-[0_0_50px_rgba(239,68,68,0.2)] overflow-hidden max-h-[90vh] overflow-y-auto">
        
        {/* زر الإغلاق */}
        <button 
          onClick={handleClose}
          className="absolute top-5 left-5 p-2 rounded-full bg-white/5 hover:bg-white/10 text-stone-400 hover:text-white transition-colors"
        >
          <X size={24} />
        </button>

        {/* ========================================= */}
        {/* العرض الشرطي: إذا لم يختر باقة نعرض الباقات، وإذا اختار نعرض البنك */}
        {/* ========================================= */}
        
        {!selectedPlan ? (
          /* ----- واجهة اختيار الباقات (المرحلة 1) ----- */
          <>
            <div className="text-center mb-8">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-red-500/20 to-rose-500/20 border border-red-500/30 text-red-400 font-bold text-sm mb-4">
                <Crown size={18} />
                <span>انضم إلى المعلمين المتميزين</span>
              </div>
              <h2 className="text-3xl md:text-4xl font-black font-cairo mb-3 text-transparent bg-clip-text bg-gradient-to-r from-white via-stone-100 to-stone-300">
                إنضم الآن إلى أسرة منصة MusiTeacher 
              </h2>
              <p className="text-stone-400 text-base md:text-lg max-w-xl mx-auto">
                الآن يمكنك على تصدير تحضيرك الصفي لمنصة نور فى أقل من ثانية بنقرة زر واحدة، بالإضافة إلى فتح جميع الألعاب والأدوات التعليمية الذكية.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 my-6">
              {/*  استمتع بفصل دراسي مميز */}
              <div className="relative rounded-2xl bg-white/5 border border-white/10 p-6 flex flex-col justify-between hover:border-red-500/40 transition-all duration-300 group">
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                      <Zap className="text-amber-400" size={20} />
                      استمتع بفصل دراسي مميز
                    </h3>
                  </div>
                  <p className="text-stone-400 text-sm mb-6">توفير ألعاب ممتعة و أدوات تعليميةجذابة  لمدة فصل دراسي كامل.</p>
                  <div className="mb-6">
                    <span className="text-4xl font-black text-white">15</span>
                    <span className="text-stone-400 mr-2 text-lg">أداة سحرية / طوال الفصل</span>
                  </div>

                  <ul className="space-y-3 text-sm text-stone-300 mb-8">
                    <li className="flex items-center gap-2">
                      <Check size={18} className="text-emerald-400 flex-shrink-0" />
                      <span>توليد مباشر للتحضير بهدف الاستفادة من ىلية التحضير</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check size={18} className="text-emerald-400 flex-shrink-0" />
                      <span>إمكانية تصدير التحضير إلى منصة نور مباشرة</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check size={18} className="text-emerald-400 flex-shrink-0" />
                      <span>باقة متنوعة من أجمل الألعاب التعليمية</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check size={18} className="text-emerald-400 flex-shrink-0" />
                      <span>أدوات حيه تعمل بالذكاء الاصطناعي</span>
                    </li>
                  </ul>
                </div>

                <button
                  onClick={() => handleSelectPlan('باقة الفصل الدراسي', '15 ر.ع')}
                  className="w-full py-3.5 px-6 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold transition-all flex items-center justify-center gap-2 group-hover:bg-red-600 group-hover:text-white"
                >
                  <span>انطلق الآن</span>
                </button>
              </div>

              {/*استمتع بعام دراسي متألق */}
              <div className="relative rounded-2xl bg-gradient-to-b from-red-950/40 via-stone-900/60 to-[#0f172a] border-2 border-red-500/60 p-6 flex flex-col justify-between shadow-[0_0_30px_rgba(239,68,68,0.2)]">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-red-600 to-rose-600 text-white font-bold text-xs px-4 py-1 rounded-full shadow-md flex items-center gap-1">
                  <Sparkles size={14} />
                  <span>الأكثر شعبية واختياراً</span>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-4 mt-2">
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                      <Crown className="text-red-400" size={20} />
                      استمتع بعام دراسي متألق
                    </h3>
                  </div>
                  <p className="text-stone-400 text-sm mb-6">تغطي العام الدراسي الكلي مع توفير مميز.</p>
                  
                  <div className="mb-6">
                    <span className="text-4xl font-black text-white">25</span>
                    <span className="text-stone-400 mr-2 text-lg">أداة سحرية ولعبة مميزة / خلال عام دراسي كامل</span>
                  </div>

                  <ul className="space-y-3 text-sm text-stone-200 mb-8">
                    <li className="flex items-center gap-2">
                      <Check size={18} className="text-emerald-400 flex-shrink-0" />
                      <span className="font-semibold text-white">عام دراسي كامل من التألق والإبداع</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check size={18} className="text-emerald-400 flex-shrink-0" />
                      <span>سرعة فائقة فى توليد التحضير المقترح</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check size={18} className="text-emerald-400 flex-shrink-0" />
                      <span>معلم مساعد ذكي يلبي كامل احتياجات المعلمين</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check size={18} className="text-emerald-400 flex-shrink-0" />
                      <span>ألعاب ساحرة وأدوات تعليمية لا تنقطع طوال </span>
                    </li>
                  </ul>
                </div>

                <button
                  onClick={() => handleSelectPlan('استمتع ب 25 تجربة خيالية فى عالم الموسيقى')}
                  className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold transition-all shadow-lg shadow-red-600/30 flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98]"
                >
                  <span>انطلق الآن</span>
                </button>
              </div>
            </div>
            
            <div className="mt-6 pt-4 border-t border-white/10 flex flex-col md:flex-row items-center justify-between text-xs text-stone-400 gap-3">
              <div className="flex items-center gap-2">
                <ShieldCheck size={18} className="text-emerald-400" />
                <span>يمكنك الآن دعم المنصة والحصول على كل أدواتها والعابها المتميزة للمساهمة فى التطوير القادم.</span>
              </div>
              <button onClick={handleClose} className="hover:underline text-stone-300">
                إغلاق والرجوع لمتابعة المعاينة 
              </button>
            </div>
          </>
        ) : (
          /* ----- واجهة بيانات التحويل البنكي (المرحلة 2) ----- */
          <div className="animate-fade-in py-2">
            <button 
              onClick={() => setSelectedPlan(null)} 
              className="flex items-center gap-2 text-stone-400 hover:text-white mb-6 transition-colors"
            >
              <ArrowRight size={20} />
              <span>العودة لدعم المنصة</span>
            </button>

            <div className="text-center mb-8">
              <h2 className="text-2xl md:text-3xl font-black font-cairo mb-3 text-white">
                بيانات التحويل لدعم المنصة
              </h2>
              <p className="text-stone-300 text-lg">
                لقد اخترت <strong className="text-red-400 font-bold">{selectedPlan.name}</strong> بقيمة <strong className="text-white bg-white/10 px-2 py-1 rounded">{selectedPlan.price}</strong>.
              </p>
              <p className="text-stone-400 mt-2 text-sm">
               يمكنك دعم المنصة للمساهمة فى تطويرها للوصول إلى أكبر قدر من الأدوات والألعاب التعليمية وكل ما يهم المعلم
              </p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-8 max-w-2xl mx-auto">
              <div className="flex items-center gap-3 mb-6 border-b border-white/10 pb-4">
                <Landmark className="text-red-500" size={28} />
                <h3 className="text-2xl font-bold text-white">بنك مسقط (Bank Muscat)</h3>
              </div>

              {/* رقم الحساب فى حالة الرغبة فى دعم المنصة */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-black/40 p-4 rounded-xl border border-white/5 mb-4 gap-4">
                <div>
                  <p className="text-stone-400 text-sm mb-1">رقم الحساب:</p>
                  {/* تم إضافة dir="ltr" لتعديل اتجاه عرض الأرقام وإظهارها معدولة */}
                  <p className="text-xl md:text-2xl font-mono font-bold tracking-[0.2em] text-white text-right sm:text-right" dir="ltr">
                    4837 9150 0501 7207
                  </p>
                </div>
                <button 
                  onClick={() => handleCopy('4837915005017207', 'account')} 
                  className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-colors whitespace-nowrap"
                >
                  <Copy size={18} />
                  <span>{copiedText === 'account' ? 'تم النسخ!' : 'نسخ الرقم'}</span>
                </button>
              </div>

              {/* رقم الهاتف */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-black/40 p-4 rounded-xl border border-white/5 gap-4">
                <div>
                  <p className="text-stone-400 text-sm mb-1">رقم الهاتف (مسجل بالبنك):</p>
                  {/* تم إضافة dir="ltr" لتعديل اتجاه عرض الأرقام وإظهارها معدولة */}
                  <p className="text-xl md:text-2xl font-mono font-bold tracking-[0.2em] text-white text-right sm:text-right" dir="ltr">
                    7988 6716
                  </p>
                </div>
                <button 
                  onClick={() => handleCopy('79886716', 'phone')} 
                  className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-colors whitespace-nowrap"
                >
                  <Copy size={18} />
                  <span>{copiedText === 'phone' ? 'تم النسخ!' : 'نسخ الرقم'}</span>
                </button>
              </div>
            </div>

            {/* زر الواتساب البارز مع تأثير 3D خفيف */}
            <div className="max-w-2xl mx-auto">
              <button
                onClick={handleWhatsAppRedirect}
                className="w-full py-4 px-6 rounded-xl bg-red-600 hover:bg-red-500 text-white font-black text-lg transition-all shadow-[0_6px_0_rgb(153,27,27)] hover:shadow-[0_2px_0_rgb(153,27,27)] hover:translate-y-[4px] flex items-center justify-center gap-3"
              >
                <MessageCircle size={24} />
                <span>اضغط للتواصل وطلب الإنضمام</span>
              </button>
              <p className="text-center text-stone-500 text-xs mt-6">
                نتمنى ان تيسر المنصة على جميع المعلمين والمعلمات مهامهم و أعمالهم اليومية.              </p>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}