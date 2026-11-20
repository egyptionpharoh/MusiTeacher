import { makeShareHandlers } from '@/lib/student-games/handlers';
import { studentGamesDeps } from '@/lib/student-games/deps';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// المعلم المشترك: رابط النسخة الطلابية + رمز الدخول (إنشاء/تجديد/إلغاء) — انظر docs/STUDENT_GAMES.md
const h = makeShareHandlers(studentGamesDeps);
export const GET = h.GET;
export const POST = h.POST;
