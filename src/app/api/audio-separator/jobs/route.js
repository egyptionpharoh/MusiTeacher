import { getHandlers } from '@/lib/audio-separator/deps';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// إنشاء مهمة فصل جديدة + رابط رفع مؤقت مباشر إلى التخزين.
export const POST = (request) => getHandlers().createJob(request);
