// «الرسائل والاقتراحات السرية» — لمدير المنصة فقط. الحماية على الخادم:
// توكن Firebase موثّق + بريد الحساب ضمن قائمة المدير + role=admin في MongoDB (انظر src/lib/suggestions/handlers.js).
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

export async function GET(request) { return h.adminList(request); }
export async function PATCH(request) { return h.adminPatch(request); }
export async function DELETE(request) { return h.adminDelete(request); }
