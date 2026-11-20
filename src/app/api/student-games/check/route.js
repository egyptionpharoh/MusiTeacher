import { makeBridgeHandlers } from '@/lib/student-games/handlers';
import { studentGamesDeps } from '@/lib/student-games/deps';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// يُستدعى من خادم MusiTeacher Games فقط: هل ما زالت جلسة الطالب صالحة (لم يُلغِ المعلم الرمز)؟
export const POST = makeBridgeHandlers(studentGamesDeps).check;
