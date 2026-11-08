import LibraryViewer from '@/components/LibraryViewer';
import workshopsData from '@/data/workshops.json';

export default function WorkshopsPage() {
  return (
    <LibraryViewer 
      title="مشاغل الإنماء المهني"
      subtitle="عروض تقديمية وحقائب تدريبية جاهزة لبرامج الإنماء المهني"
      items={workshopsData}
      gradientColor="from-sky-400 via-indigo-500 to-purple-600"
    />
  );
}