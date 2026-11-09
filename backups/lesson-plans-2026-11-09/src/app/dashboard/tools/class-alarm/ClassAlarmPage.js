'use client';
import ClassAlarmApp from '@/modules/class-alarm/ui/ClassAlarmApp';
import { getIdToken } from '@/modules/class-alarm/adapters/musiteacherClient';

export default function ClassAlarmPage() {
  return <ClassAlarmApp getToken={getIdToken} apiBase="/api/class-alarm" backHref="/dashboard/tools" swScope="/dashboard/tools/class-alarm" />;
}
