// الاعتماديات الحقيقية: الهوية والاشتراك كبقية الأدوات، ومفتاح Gemini نفسه (GEMINI_API_KEY)، ومزامنة MongoDB الاختيارية.
import { realDeps as auth } from '../virtual-games/deps.js';
import { makeGemini, modelsFrom } from '../pd-workshops/ai.js';
import { makeSyncStore } from './store-mongo.js';
import { makeHandlers } from './handlers.js';

let handlers = null;
export function getHandlers() {
  if (handlers) return handlers;
  const syncEnabled = !!process.env.MONGODB_URI && String(process.env.INITIATIVES_SYNC_ENABLED || 'true').toLowerCase() !== 'false';
  handlers = makeHandlers({
    verifyIdToken: auth.verifyIdToken,
    findUser: auth.findUser,
    ai: makeGemini({ apiKey: process.env.GEMINI_API_KEY, models: modelsFrom({ PD_WORKSHOPS_MODEL: process.env.INITIATIVES_MODEL || process.env.PD_WORKSHOPS_MODEL }), timeoutMs: 50000 }),
    store: syncEnabled ? makeSyncStore(auth.connectDB) : null,
  });
  return handlers;
}
