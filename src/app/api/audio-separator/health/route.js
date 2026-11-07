import { getHandlers } from '@/lib/audio-separator/deps';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// فحص تهيئة الخدمة (نعم/لا فقط، بلا أسرار): افتح /api/audio-separator/health بعد النشر.
export const GET = () => getHandlers().health();
