// تخزين «صندوق الاقتراحات السرية» في MongoDB الحالي للمنصة (نفس الاتصال المستخدم في بقية الأدوات).
import Suggestion from '../../models/AnonymousSuggestion.js';
import Guard from '../../models/SuggestionGuard.js';
import { realDeps } from '../virtual-games/deps.js';
import { coarseExpiry } from './core.js';

const db = () => realDeps.connectDB();

export const mongoSuggestionStore = {
  async nextSeq() {
    await db();
    const d = await Guard.findOneAndUpdate({ _id: 'seq' }, { $inc: { n: 1 } }, { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }).lean();
    return d.n;
  },
  async bumpDaily(day, cap) {
    await db();
    const d = await Guard.findOneAndUpdate({ _id: 'day:' + day }, { $inc: { n: 1 }, $setOnInsert: { expireAt: coarseExpiry(new Date(), 3) } }, { upsert: true, returnDocument: 'after' }).lean();
    return d.n;
  },
  async claim(key, expireAt) {
    await db();
    try { await Guard.create({ _id: key, n: 1, expireAt }); return true; }
    catch (e) { if (e && e.code === 11000) return false; throw e; }
  },
  async insert(doc) { await db(); await Suggestion.create(doc); },
  async list({ archived, limit }) {
    await db();
    return Suggestion.find({ archived: !!archived }).sort({ seq: -1 }).limit(limit).lean();
  },
  async counts() {
    await db();
    const rows = await Suggestion.aggregate([{ $group: { _id: { a: '$archived', s: '$status' }, n: { $sum: 1 } } }]);
    const out = { inbox: 0, archived: 0, new: 0, read: 0, review: 0, done: 0 };
    for (const r of rows) { if (r._id.a) out.archived += r.n; else { out.inbox += r.n; out[r._id.s] = (out[r._id.s] || 0) + r.n; } }
    return out;
  },
  async update(id, patch) { await db(); const r = await Suggestion.updateOne({ _id: id }, { $set: patch }); return r.matchedCount > 0; },
  async remove(id) { await db(); const r = await Suggestion.deleteOne({ _id: id }); return r.deletedCount > 0; },
};
