'use client';

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import AppHeader from '@/components/AppHeader';
import { ShieldAlert, CheckCircle, XCircle } from 'lucide-react';

export default function AdminSubscriptions() {
  // استخدام السياق (Context) لجلب بياناتك كمدير
  const { user, isAdmin, loading: authLoading } = useAuth();
  
  const [email, setEmail] = useState('');
  const [plan, setPlan] = useState('semester');
  const [isActivating, setIsActivating] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  // تفاصيل الباقات للعرض والتأكيد قبل التفعيل
  const planDetails = {
    semester: { name: 'باقة الفصل الدراسي', price: '15 ريال عماني', duration: '120 يوم' },
    annual: { name: 'الباقة السنوية', price: '25 ريال عماني', duration: '365 يوم' }
  };

  const showToastMessage = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 5000);
  };

  const handleActivate = async () => {
    if (!email) {
      showToastMessage('يا ملك لازم تكتب إيميل المستخدم الأول!', 'error');
      return;
    }

    setIsActivating(true);
    try {
      // الحصول على التوكن الخاص بك كمدير من Firebase لاجتياز الميدلوير
      const token = await user.getIdToken();
      
      // إرسال طلب التفعيل إلى الـ API السري الذي أنشأناه في المرحلة السابقة
      // 🚀 تم تصحيح المسار ليتطابق مع مجلد route.js الفعلي
      const res = await fetch('/api/admin/subscriptions', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` // تمرير التوكن للحارس (الميدلوير) ليسمح بالعبور
        },
        body: JSON.stringify({
          adminUid: user.uid, // الرقم السري الخاص بك لإثبات هويتك كمدير
          targetEmail: email, // إيميل المعلم الذي قام بالدفع
          planType: plan // الباقة المطلوبة
        })
      });

      const data = await res.json();

      if (res.ok && data.success) {
        if (data.alreadyActive) {
          showToastMessage(`المستخدم مشترك بالفعل وينتهي اشتراكه في: ${new Date(data.endDate).toLocaleDateString('ar-OM')}`, 'error');
        } else {
          showToastMessage(`تم التفعيل بنجاح! ينتهي الاشتراك في: ${new Date(data.endDate).toLocaleDateString('ar-OM')}`, 'success');
          setEmail(''); // تنظيف الحقل ليكون جاهزاً للمستخدم التالي
        }
      } else {
        showToastMessage(data.message || 'حصل خطأ أثناء التفعيل', 'error');
      }
    } catch (error) {
      console.error(error);
      showToastMessage('خطأ في الاتصال بالخادم!', 'error');
    } finally {
      setIsActivating(false);
    }
  };

  // 1. حالة التحميل أثناء فحص الصلاحيات
  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center text-2xl font-bold text-stone-700 dark:text-cyan-300">جاري التحقق من الصلاحيات...</div>;
  }

  // 2. الجدار الأمني في الواجهة (المرحلة 6): لو المستخدم العادي حاول يدخل، هنطرده فوراً
  if (!isAdmin) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-stone-50 dark:bg-[#111827]">
        <ShieldAlert size={80} className="text-red-500 mb-6" />
        <h1 className="text-3xl font-bold text-red-600 mb-4">منطقة محظورة</h1>
        <p className="text-lg text-stone-600 dark:text-stone-300">عفواً، هذه الصفحة مخصصة لإدارة المنصة فقط.</p>
      </div>
    );
  }

  // 3. واجهة الإدارة (للمدير فقط)
  return (
    <div className="relative min-h-screen flex flex-col items-center pb-32 transition-colors duration-1000 bg-transparent" dir="rtl">
      <AppHeader />
      
      {/* التوست العائم للإشعارات */}
      <div className={`fixed bottom-10 left-1/2 transform -translate-x-1/2 z-50 transition-all duration-500 ease-in-out ${toast.show ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-10 scale-95 pointer-events-none'}`}>
        <div className={`flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl backdrop-blur-md border font-bold text-lg ${toast.type === 'success' ? 'bg-emerald-600/90 border-emerald-400 text-white' : 'bg-red-600/90 border-red-400 text-white'}`}>
          {toast.type === 'success' ? <CheckCircle size={28} /> : <XCircle size={28} />}
          <span>{toast.message}</span>
        </div>
      </div>

      <div className="w-full max-w-2xl mt-32 p-4">
        <h1 className="text-4xl font-bold text-transparent bg-clip-text mb-2 drop-shadow-md text-center" style={{ backgroundImage: 'linear-gradient(to right, #3b82f6, #8b5cf6)' }}>
          لوحة الإدارة: تفعيل الاشتراكات
        </h1>
        <p className="text-center text-stone-600 dark:text-stone-300 mb-8 font-semibold">
          نظام التفعيل اليدوي (Manual Approval) الآمن 🛡️
        </p>

        <div className="glass-card p-8 rounded-3xl mb-8 transition-all duration-500 relative overflow-hidden border border-stone-200 dark:border-white/10 shadow-xl bg-white/50 dark:bg-black/20 backdrop-blur-md">
          
          <div className="mb-6">
            <label className="block text-lg font-bold mb-2 text-stone-800 dark:text-cyan-300">
              البريد الإلكتروني للمستخدم:
            </label>
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="teacher@example.com"
              className="w-full bg-stone-50 hover:bg-stone-100 dark:bg-white/5 text-stone-900 dark:text-white border border-stone-200 dark:border-white/10 rounded-xl px-4 py-4 focus:ring-2 focus:ring-blue-500 dark:focus:ring-cyan-500 outline-none transition-all duration-300 font-bold"
              dir="ltr"
            />
          </div>

          <div className="mb-8">
            <label className="block text-lg font-bold mb-2 text-stone-800 dark:text-cyan-300">
              اختر الباقة المدفوعة:
            </label>
            <select 
              value={plan} 
              onChange={(e) => setPlan(e.target.value)} 
              className="w-full bg-stone-50 hover:bg-stone-100 dark:bg-white/5 text-stone-900 dark:text-white border border-stone-200 dark:border-white/10 rounded-xl px-4 py-4 focus:ring-2 focus:ring-blue-500 dark:focus:ring-cyan-500 outline-none transition-all duration-300 font-bold"
            >
              <option value="semester" className="bg-white dark:bg-[#111827]">باقة الفصل الدراسي</option>
              <option value="annual" className="bg-white dark:bg-[#111827]">الباقة السنوية</option>
            </select>
          </div>

          {/* تفاصيل الباقة المحددة */}
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 mb-8 border border-blue-100 dark:border-blue-800/50">
            <div className="flex justify-between mb-2">
              <span className="font-semibold text-stone-700 dark:text-stone-300">السعر:</span>
              <span className="font-bold text-blue-600 dark:text-cyan-400">{planDetails[plan].price}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-semibold text-stone-700 dark:text-stone-300">مدة التفعيل:</span>
              <span className="font-bold text-blue-600 dark:text-cyan-400">{planDetails[plan].duration} (من تاريخ اليوم)</span>
            </div>
          </div>

          <button 
            onClick={handleActivate}
            disabled={isActivating}
            className="w-full text-white font-bold text-xl px-12 py-5 rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-1 active:scale-[0.98] disabled:opacity-50 transition-all duration-300 flex justify-center items-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700"
          >
            {isActivating ? 'جاري تفعيل الاشتراك...' : 'تفعيل الاشتراك الآن 🚀'}
          </button>
        </div>
      </div>
    </div>
  );
}