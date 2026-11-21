import { createRandomizerHandler } from '@/modules/randomizer-ai/server/http';
import { makeMusiTeacherAuthorize } from '@/modules/class-alarm/adapters/musiteacherAuth';
import { realDeps } from '@/lib/virtual-games/deps';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// توليد الأسئلة من ملف PDF أو صورة قد يستغرق حتى دقيقة
export const maxDuration = 90;

const handle = createRandomizerHandler({ authorize: makeMusiTeacherAuthorize(realDeps) });

export async function GET(request, { params }) {
  const { action } = await params;
  return handle(request, action);
}

export async function POST(request, { params }) {
  const { action } = await params;
  return handle(request, action);
}
