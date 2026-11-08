import LibraryViewer from '@/components/LibraryViewer';
import anthemData from '@/data/anthem.json';

export default function AnthemPage() {
  return (
    <LibraryViewer 
      title="نوتات النشيد والمارشات"
      subtitle="مكتبة شاملة لنوتات الانصراف والطابور المدرسي"
      items={anthemData}
      gradientColor="from-rose-400 via-red-500 to-orange-600"
    />
  );
}