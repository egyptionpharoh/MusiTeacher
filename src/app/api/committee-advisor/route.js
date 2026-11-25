// مستشار اللجان والامتحانات — الاستعانة بـ Gemini عند الحاجة فقط (على الخادم؛ المفتاح لا يصل للمتصفح).
// المنطق كله في src/modules/committee-advisor/server/ai.js. لإيقاف الذكاء الاصطناعي: COMMITTEE_ADVISOR_AI=false
import mongoose from 'mongoose';
import User from '@/models/User';
import { realDeps } from '@/lib/virtual-games/deps';
import { makeGemini } from '@/lib/pd-workshops/ai';
import { makeAdvisorAIHandler, DEFAULT_MODELS } from '@/modules/committee-advisor/server/ai';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const models = (process.env.COMMITTEE_ADVISOR_MODEL || '').split(',').map((s) => s.trim()).filter(Boolean);

const handler = makeAdvisorAIHandler({
  enabled: String(process.env.COMMITTEE_ADVISOR_AI || 'true').toLowerCase() !== 'false',
  ai: makeGemini({ apiKey: process.env.GEMINI_API_KEY, models: models.length ? models : DEFAULT_MODELS, timeoutMs: 20000 }),
  verifyIdToken: (t) => realDeps.verifyIdToken(t),
  // أي حساب مسجّل في المنصة وغير موقوف (لا يحتاج اشتراكًا)
  async findUser(uid) {
    await realDeps.connectDB();
    if (mongoose.connection.readyState !== 1) return null;
    return User.findOne({ uid }).select('status role').lean();
  },
});

export async function POST(request) {
  return handler(request);
}
