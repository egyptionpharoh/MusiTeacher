import { createLessonPlansHandler } from '@/modules/lesson-plans/server/http';
import { makeMusiTeacherAuthorize } from '@/modules/class-alarm/adapters/musiteacherAuth';
import { makePlansSyncStore } from '@/modules/lesson-plans/adapters/syncStore';
import { realDeps } from '@/lib/virtual-games/deps';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// قراءة خطة PDF بالذكاء الاصطناعي قد تستغرق حتى دقيقة
export const maxDuration = 90;

const handle = createLessonPlansHandler({
  authorize: makeMusiTeacherAuthorize(realDeps),
  store: process.env.MONGODB_URI ? makePlansSyncStore(realDeps.connectDB) : null,
});

export async function GET(request, { params }) {
  const { action } = await params;
  return handle(request, action);
}

export async function POST(request, { params }) {
  const { action } = await params;
  return handle(request, action);
}

export async function DELETE(request, { params }) {
  const { action } = await params;
  return handle(request, action);
}
