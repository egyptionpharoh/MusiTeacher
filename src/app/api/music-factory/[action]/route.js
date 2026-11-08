import { createMusicFactoryHandler } from '@/modules/music-factory/server/http';
import { makeMusiTeacherAuthorize } from '@/modules/music-factory/adapters/musiteacherAuth';
import { realDeps } from '@/lib/virtual-games/deps';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// التوليد الصوتي قد يستغرق دقائق (الحد الأقصى المسموح في Vercel Pro/Fluid).
export const maxDuration = 300;

const handle = createMusicFactoryHandler({ authorize: makeMusiTeacherAuthorize(realDeps) });

export async function GET(request, { params }) {
  const { action } = await params;
  return handle(request, action);
}

export async function POST(request, { params }) {
  const { action } = await params;
  return handle(request, action);
}
