import { makeBridgeHandlers } from '@/lib/student-games/handlers';
import { studentGamesDeps } from '@/lib/student-games/deps';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// يُستدعى من خادم MusiTeacher Games فقط (سرّ مشترك STUDENT_GAMES_BRIDGE_SECRET): هل رمز الطالب صحيح؟
export const POST = makeBridgeHandlers(studentGamesDeps).verify;
