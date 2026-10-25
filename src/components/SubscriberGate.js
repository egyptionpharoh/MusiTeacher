'use client';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';

export default function SubscriberGate({ children }) {
  const { user, isSubscribed, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0f16] text-gray-300" dir="rtl">
        جارٍ التحقق من الحساب...
      </div>
    );
  }

  if (!user || !isSubscribed) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-[#0a0f16]" dir="rtl">
        <div className="max-w-md w-full bg-[#111827] border border-gray-700 rounded-2xl p-8 text-center text-white shadow-xl">
          <h2 className="text-2xl font-bold mb-4">الوصول مقيّد حاليًا</h2>
          <p className="text-gray-300 leading-relaxed mb-6">
            {!user
              ? 'يرجى تسجيل الدخول من زر الإعدادات في الصفحة الرئيسية.'
              : 'الأدوات والألعاب متاحة حاليًا للمشتركين الحاليين فقط، والتسجيل الجديد متوقف مؤقتًا.'}
          </p>
          <Link href="/" className="inline-block bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-xl font-bold transition-colors">
            العودة للرئيسية
          </Link>
        </div>
      </div>
    );
  }

  return children;
}