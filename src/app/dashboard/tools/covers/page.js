import CoverStudio from '@/components/cover-studio/CoverStudio';

// بنك أغلفة السجلات: استوديو لاختيار الغلاف وتخصيصه وتصديره ملف Word حقيقيًا قابلًا للتعديل.
// النسخة السابقة من هذه الصفحة محفوظة في backups/covers-2026-11-08/page.js
export const metadata = {
  title: 'بنك أغلفة السجلات | MusiTeacher',
  description: 'مجموعة كروت وأغلفة Word احترافية قابلة للتعديل والطباعة فورًا.',
};

export default function CoversPage() {
  return <CoverStudio />;
}
