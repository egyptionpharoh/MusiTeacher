// غلاف مشترك لكل صفحات «أدوات المعلم»: يضيف شريط التنقل الموحد (شعار MusiTeacher + الرجوع الصريح).
// الشريط نفسه يقرر أين يظهر (الأدوات العشر فقط) — راجع src/components/tools-nav/routes.js
import ToolsNavBar from '@/components/tools-nav/ToolsNavBar';

export default function ToolsLayout({ children }) {
  return (
    <>
      <ToolsNavBar />
      {children}
    </>
  );
}
