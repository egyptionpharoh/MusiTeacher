'use client';
import { useAuth } from '@/context/AuthContext'; // تأكد من مسار الـ AuthContext لديك
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // إذا انتهى التحميل ولم يتم العثور على مستخدم، وجهه فوراً لصفحة الدخول
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  // أثناء التحقق من حالة التسجيل، اعرض شاشة تحميل
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-lg font-semibold text-gray-700">جاري التحقق من صلاحية الدخول...</p>
        </div>
      </div>
    );
  }

  // إذا لم يكن هناك مستخدم، لا تعرض أي شيء حتى يتم التوجيه
  if (!user) {
    return null;
  }

  // إذا كان مسجلاً، اعرض محتوى الصفحة بشكل طبيعي
  return <>{children}</>;
}