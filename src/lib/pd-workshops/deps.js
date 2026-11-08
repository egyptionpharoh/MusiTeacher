// الاعتماديات الحقيقية للإنتاج: نفس طبقة الهوية والاشتراك المستعملة في بقية الأدوات المحمية،
// ومفتاح Gemini نفسه المستعمل في المنصة (GEMINI_API_KEY) من متغيرات البيئة على الخادم فقط.
import { realDeps as auth } from '../virtual-games/deps.js';
import { makeGemini, modelsFrom } from './ai.js';
import { makeHandlers } from './handlers.js';

let handlers = null;
export function getHandlers() {
  if (handlers) return handlers;
  handlers = makeHandlers({
    verifyIdToken: auth.verifyIdToken,
    findUser: auth.findUser,
    ai: makeGemini({ apiKey: process.env.GEMINI_API_KEY, models: modelsFrom(process.env), timeoutMs: 50000 }),
  });
  return handlers;
}
