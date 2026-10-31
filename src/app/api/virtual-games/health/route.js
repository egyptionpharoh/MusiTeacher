import { makeHealthHandler } from '@/lib/virtual-games/handlers';
import { realDeps } from '@/lib/virtual-games/deps';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// فحص تهيئة خادم الألعاب (نعم/لا فقط، بلا أسرار): افتح /api/virtual-games/health بعد النشر.
export const GET = makeHealthHandler(realDeps);
