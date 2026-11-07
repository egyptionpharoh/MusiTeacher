import { getHandlers } from '@/lib/audio-separator/deps';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
// عند انتهاء الفصل يُنسخ الملف الناتج إلى التخزين داخل هذا الطلب (ثوانٍ معدودة). 60 ثانية مسموحة في كل خطط Vercel.
export const maxDuration = 60;

// GET: الحالة الحقيقية للمهمة · POST {action:'start'}: بدء الفصل بعد الرفع · DELETE: إلغاء وحذف الملفات فورًا
export const GET = (request, context) => getHandlers().getJob(request, context);
export const POST = (request, context) => getHandlers().jobAction(request, context);
export const DELETE = (request, context) => getHandlers().deleteJob(request, context);
