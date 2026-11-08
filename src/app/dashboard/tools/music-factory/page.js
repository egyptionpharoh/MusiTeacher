'use client';
// صفحة «مصنع الألحان (AI)» داخل أدوات المعلم. كل منطق الأداة في src/modules/music-factory.
import { useRouter } from 'next/navigation';
import MusicFactoryApp from '@/modules/music-factory/ui/MusicFactoryApp';
import { getIdToken } from '@/modules/music-factory/adapters/musiteacherClient';

export default function MusicFactoryPage() {
  const router = useRouter();
  return <MusicFactoryApp getToken={getIdToken} apiBase="/api/music-factory" onBack={() => router.push('/dashboard/tools')} />;
}
