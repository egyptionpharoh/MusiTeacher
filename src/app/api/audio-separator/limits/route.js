import { getHandlers } from '@/lib/audio-separator/deps';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// حدود الاستخدام وحالة التهيئة للمستخدم الحالي (تُعرض في الواجهة قبل الرفع).
export const GET = (request) => getHandlers().limitsInfo(request);
