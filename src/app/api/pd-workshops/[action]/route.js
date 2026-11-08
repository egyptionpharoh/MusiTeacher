import { getHandlers } from '@/lib/pd-workshops/deps';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

// GET  /api/pd-workshops/status            → هل التوليد بالذكاء الاصطناعي مُعدّ؟ (لا يكشف أي سر)
// POST /api/pd-workshops/ideas|build|section → توليد (يتطلب تسجيل الدخول واشتراكًا فعّالًا)
const POSTS = new Set(['ideas', 'build', 'section']);
const notFound = () => Response.json({ ok: false, error: 'not-found' }, { status: 404 });

export async function GET(request, { params }) {
  const { action } = await params;
  if (action !== 'status') return notFound();
  return getHandlers().status(request);
}

export async function POST(request, { params }) {
  const { action } = await params;
  if (!POSTS.has(action)) return notFound();
  return getHandlers()[action](request);
}
