import LibraryViewer from '@/components/LibraryViewer';
import coversData from '@/data/covers.json';

export default function CoversPage() {
  return (
    <LibraryViewer 
      title="بنك أغلفة السجلات"
      subtitle="مجموعة كروت وأغلفة وورد احترافية قابلة للتعديل والطباعة فوراً"
      items={coversData}
      gradientColor="from-violet-400 via-purple-500 to-fuchsia-500"
    />
  );
}