import { getHandlers } from '@/lib/initiatives/deps';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

// GET status · POST ideas|develop|section · GET/POST/DELETE sync
const GEN = new Set(['ideas', 'develop', 'section']);
const notFound = () => Response.json({ ok: false, error: 'not-found' }, { status: 404 });

export async function GET(request, { params }) {
  const { action } = await params;
  if (action === 'status') return getHandlers().status(request);
  if (action === 'sync') return getHandlers().sync(request);
  return notFound();
}
export async function POST(request, { params }) {
  const { action } = await params;
  if (GEN.has(action)) return getHandlers()[action](request);
  if (action === 'sync') return getHandlers().sync(request);
  return notFound();
}
export async function DELETE(request, { params }) {
  const { action } = await params;
  if (action === 'sync') return getHandlers().sync(request);
  return notFound();
}
