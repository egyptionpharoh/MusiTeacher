import { createClassAlarmHandler } from '@/modules/class-alarm/server/http';
import { makeMusiTeacherAuthorize } from '@/modules/class-alarm/adapters/musiteacherAuth';
import { makeSyncStore } from '@/modules/class-alarm/adapters/syncStore';
import { realDeps } from '@/lib/virtual-games/deps';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// قراءة الصور بالذكاء الاصطناعي قد تستغرق حتى دقيقة
export const maxDuration = 90;

const handle = createClassAlarmHandler({
  authorize: makeMusiTeacherAuthorize(realDeps),
  store: process.env.MONGODB_URI ? makeSyncStore(realDeps.connectDB) : null,
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
