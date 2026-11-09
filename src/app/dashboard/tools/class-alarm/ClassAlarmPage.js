'use client';
import ClassAlarmApp from '@/modules/class-alarm/ui/ClassAlarmApp';
import { getIdToken, getUserId } from '@/modules/class-alarm/adapters/musiteacherClient';

export default function ClassAlarmPage() {
  return <ClassAlarmApp getToken={getIdToken} getUserId={getUserId} apiBase="/api/class-alarm" backHref="/dashboard/tools" swScope="/dashboard/tools/class-alarm" plansHref="/dashboard/tools/plans" />;
}
