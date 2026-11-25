'use client';
// «الرسائل والاقتراحات السرية» — لوحة مدير المنصة. إخفاء الصفحة عن غير المدير هنا للواجهة فقط؛
// الحماية الحقيقية على الخادم في /api/admin/suggestions (توكن موثّق + بريد المدير + role=admin).
import { useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import AppHeader from '@/components/AppHeader';
import SuggestionsAdmin from '@/components/suggestions/SuggestionsAdmin';

export default function AdminSuggestionsPage() {
  const { user, isAdmin, loading } = useAuth();
  const getToken = useCallback(() => user.getIdToken(), [user]);

  let body;
  if (loading) body = <p className="sg-muted" style={{ textAlign: 'center' }}>جارٍ التحقق من الحساب…</p>;
  else if (!user || !isAdmin) {
    body = (
      <div className="sg-denied">
        <h1>هذه الصفحة لمدير المنصة فقط</h1>
        <p>{!user ? 'سجّل الدخول بحساب المدير من زر الإعدادات في الصفحة الرئيسية.' : 'حسابك لا يملك صلاحية الاطلاع على الرسائل.'}</p>
        <Link href="/" className="sg-btn">العودة للرئيسية</Link>
      </div>
    );
  } else body = <SuggestionsAdmin getToken={getToken} />;

  return (
    <div className="min-h-screen bg-[#0a0f16] text-white" dir="rtl">
      <AppHeader />
      <main className="sg-admin-wrap">{body}</main>
    </div>
  );
}
