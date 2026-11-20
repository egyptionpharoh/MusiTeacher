import { makeConfigHandlers } from '@/lib/student-games/handlers';
import { studentGamesDeps } from '@/lib/student-games/deps';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// المدير فقط: الإصدارات الفصلية لمشروع MusiTeacher Games وعنوان كل منها
const h = makeConfigHandlers(studentGamesDeps);
export const GET = h.GET;
export const POST = h.POST;
