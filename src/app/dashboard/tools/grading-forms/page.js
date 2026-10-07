import LibraryViewer from '@/components/LibraryViewer';
import gradingFormsData from '@/data/grading-forms.json';

export default function GradingFormsPage() {
  return (
    <LibraryViewer 
      title="استمارات رصد الدرجات"
      subtitle="قوالب جاهزة للرصد اليدوي والإلكتروني لتوفير الوقت"
      items={gradingFormsData}
      gradientColor="from-cyan-300 via-sky-500 to-blue-600"
    />
  );
}