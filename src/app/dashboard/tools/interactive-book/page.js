'use client';
// صفحة «الكتاب التفاعلي الذكي 📖» داخل أدوات المعلم. كل منطق الأداة في src/modules/interactive-book.
import { useRouter } from 'next/navigation';
import InteractiveBookApp from '@/modules/interactive-book/ui/InteractiveBookApp';
import { getUserId } from '@/modules/class-alarm/adapters/musiteacherClient';

export default function InteractiveBookPage() {
  const router = useRouter();
  return <InteractiveBookApp getUserId={getUserId} onBack={() => router.push('/dashboard/tools')} />;
}
