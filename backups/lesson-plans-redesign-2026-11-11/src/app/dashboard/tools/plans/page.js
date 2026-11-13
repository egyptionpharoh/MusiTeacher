'use client';
// مولد الخطط الفصلية — كل المنطق في src/modules/lesson-plans (الواجهة الأصلية أصبحت تبويب «الخطة الرسمية»)
import plansData from '@/data/semester-plans.json';
import LessonPlansApp from '@/modules/lesson-plans/ui/LessonPlansApp';
import { getIdToken, getUserId } from '@/modules/lesson-plans/adapters/musiteacherClient';

export default function SemesterPlansPage() {
  return <LessonPlansApp plansData={plansData} getToken={getIdToken} getUserId={getUserId} apiBase="/api/lesson-plans" alarmHref="/dashboard/tools/class-alarm" backHref="/dashboard/tools" />;
}
