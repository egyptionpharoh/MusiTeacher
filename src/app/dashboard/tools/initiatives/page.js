import LibraryViewer from '@/components/LibraryViewer';
import initiativesData from '@/data/initiatives.json';

export default function InitiativesPage() {
  return (
    <LibraryViewer 
      title="مبادرات تعليمية"
      subtitle="مبادرات وأفكار إبداعية مقترحة جاهزة للتنفيذ في مدرستك"
      items={initiativesData}
      gradientColor="from-yellow-300 via-amber-400 to-orange-500"
    />
  );
}