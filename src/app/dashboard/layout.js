import SmartTeacher from '../../components/SmartTeacher'; // استدعينا المعلم الذكي هنا

export default function DashboardLayout({ children }) {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* مستقبلاً: هنحط هنا الـ Header بتاع الداشبورد 
        (اللي فيه شعار المنصة، زرار الإعدادات، وصورة المستخدم) 
      */}

      {/* منطقة عرض المحتوى المتغير (زي أدوات نورمارك أو التحضيرات) */}
      <main className="p-4 md:p-8">
        {children} 
      </main>

      {/* المعلم الذكي: الأيقونة العائمة اللي هتظهر في كل صفحات الداشبورد */}
      <SmartTeacher />
    </div>
  );
}