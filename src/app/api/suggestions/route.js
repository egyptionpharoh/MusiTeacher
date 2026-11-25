// «صندوق الاقتراحات السرية» — المسار العام: لا يتطلب تسجيل الدخول، ولا يقرأ أي هوية (انظر docs/SUGGESTIONS_PRIVACY.md).
import { makeSuggestionHandlers } from '@/lib/suggestions/handlers';
import { mongoSuggestionStore } from '@/lib/suggestions/store-mongo';
import { realDeps } from '@/lib/virtual-games/deps';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const h = makeSuggestionHandlers({
  store: process.env.MONGODB_URI ? mongoSuggestionStore : null,
  verifyIdToken: (t) => realDeps.verifyIdToken(t),
  findUser: (uid) => realDeps.findUser(uid),
});

export async function GET() { return h.issueToken(); }
export async function POST(request) { return h.submit(request); }
