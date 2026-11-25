'use client';
// صفحة «مصنع الألحان (AI)» داخل أدوات المعلم. كل منطق الأداة في src/modules/music-factory.
// الرجوع إلى «الأدوات» والشعار في شريط التنقل الموحد أعلى الصفحة (src/app/dashboard/tools/layout.js)،
// لذلك لا نمرر onBack فلا يظهر زر «→ العودة» الداخلي المكرر.
import MusicFactoryApp from '@/modules/music-factory/ui/MusicFactoryApp';
import { getIdToken } from '@/modules/music-factory/adapters/musiteacherClient';

export default function MusicFactoryPage() {
  return <MusicFactoryApp getToken={getIdToken} apiBase="/api/music-factory" />;
}
