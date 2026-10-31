import { makeSessionHandler } from '@/lib/virtual-games/handlers';
import { realDeps } from '@/lib/virtual-games/deps';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// ينشئ جلسة لعب (كوكي موقّع) بعد التحقق من Firebase ID token ومن اشتراك المستخدم في MongoDB.
export const POST = makeSessionHandler(realDeps);
