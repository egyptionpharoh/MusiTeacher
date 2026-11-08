import AnthemStudio from '@/components/anthem/AnthemStudio';
import anthemData from '@/data/anthem.json';

export const metadata = {
  title: 'نوتات النشيد والمارشات | MusiTeacher',
  description: 'مكتبة تفاعلية لنوتات الأناشيد والمارشات المدرسية: قراءة واستماع متزامن وتمارين.',
};

export default function AnthemPage() {
  return <AnthemStudio files={anthemData} />;
}
