import LibraryViewer from '@/components/LibraryViewer';
import guidesData from '@/data/guides.json';

export default function GuidesPage() {
  return (
    <LibraryViewer 
      title="أدلة المعلم الرسمية"
      subtitle="جميع الأدلة والكتب المرجعية المعتمدة جاهزة للعرض والتحميل"
      items={guidesData}
      gradientColor="from-teal-400 via-emerald-500 to-green-600"
    />
  );
}