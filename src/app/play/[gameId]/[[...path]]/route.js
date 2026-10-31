import { makePlayHandler } from '@/lib/virtual-games/handlers';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// يخدم ملفات الألعاب المحمية (من private-games) فقط لمن معه كوكي جلسة صالح.
export const GET = makePlayHandler();
