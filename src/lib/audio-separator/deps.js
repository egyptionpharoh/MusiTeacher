// الاعتماديات الحقيقية للإنتاج. نعيد استخدام طبقة التحقق من الهوية والاشتراك نفسها المستعملة في الألعاب المحمية.
import { realDeps as auth } from '../virtual-games/deps.js';
import SeparationJob from '../../models/SeparationJob.js';
import { makeMongoStore } from './store-mongo.js';
import { makeR2Storage } from './storage-r2.js';
import { makeReplicateProvider } from './provider-replicate.js';
import { getLimits, getPreset } from './config.js';
import { makeHandlers } from './handlers.js';

let handlers = null;

/** تُنشأ مرة واحدة لكل نسخة خادم (تحتفظ بمحددات المعدل في الذاكرة). */
export function getHandlers() {
  if (handlers) return handlers;
  handlers = makeHandlers({
    verifyIdToken: auth.verifyIdToken,
    findUser: auth.findUser,
    connectDB: auth.connectDB,
    jobs: makeMongoStore(SeparationJob, auth.connectDB),
    storage: makeR2Storage(process.env),
    provider: makeReplicateProvider({ token: (process.env.REPLICATE_API_TOKEN || '').trim() || null, preset: getPreset(process.env) }),
    limits: getLimits(process.env),
  });
  return handlers;
}
