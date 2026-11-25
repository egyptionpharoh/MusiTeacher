'use client';
import CommitteeAdvisor from '@/modules/committee-advisor/ui/CommitteeAdvisor';
import { getIdToken } from '@/modules/class-alarm/adapters/musiteacherClient';

// ربط المستشار بحساب المعلم: رمز الدخول يُرسل لخادم المنصة فقط عند الاستعانة بالذكاء الاصطناعي.
export default function CommitteeAdvisorPage() {
  return <CommitteeAdvisor getToken={getIdToken} aiEndpoint="/api/committee-advisor" />;
}
