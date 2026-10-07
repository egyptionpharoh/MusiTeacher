import LibraryViewer from '@/components/LibraryViewer';
import performanceData from '@/data/performance.json';

export default function PerformancePage() {
  return (
    <LibraryViewer 
      title="استمارات متابعة الطلبة"
      subtitle="نماذج متطورة لمتابعة الأداء اليومي والمشاركة الصفية"
      items={performanceData}
      gradientColor="from-amber-300 via-orange-500 to-red-500"
    />
  );
}