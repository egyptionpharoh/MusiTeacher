// الاعتماديات الحقيقية: نفس تحقق Firebase واتصال MongoDB المستخدمَين في ألعاب الاستوديو.
import User from '../../models/User.js';
import Share from '../../models/StudentGameShare.js';
import Attempt from '../../models/StudentGameAttempt.js';
import Config from '../../models/StudentGamesConfig.js';
import { realDeps as vg } from '../virtual-games/deps.js';

const db = async () => { await vg.connectDB(); };

export const studentGamesDeps = {
  verifyIdToken: (t) => vg.verifyIdToken(t),
  async findUser(uid) { await db(); return User.findOne({ uid }).select('role isSubscribed subscriptionEndDate status').lean(); },
  store: {
    shares: {
      async active(uid, gameId, now) { await db(); return Share.findOne({ teacherUid: uid, gameId, revokedAt: null, expiresAt: { $gt: now } }).sort({ createdAt: -1 }).lean(); },
      async revokeActive(uid, gameId, now) { await db(); await Share.updateMany({ teacherUid: uid, gameId, revokedAt: null }, { $set: { revokedAt: now } }); },
      async insert(doc) {
        await db();
        try { return (await Share.create(doc)).toObject(); }
        catch (e) { if (e && e.code === 11000) return null; throw e; }        // رمز مكرر لنفس اللعبة: يُعاد التوليد
      },
      async revoke(id, uid, now) { await db(); await Share.updateOne({ _id: id, teacherUid: uid }, { $set: { revokedAt: now } }); },
      async byLookup(lookup) { await db(); return Share.findOne({ lookup }).lean(); },
      async byId(id) { await db(); if (!/^[a-f0-9]{24}$/.test(id)) return null; return Share.findById(id).lean(); },
      async touch(id, now) { await db(); await Share.updateOne({ _id: id }, { $inc: { uses: 1 }, $set: { lastUsedAt: now } }); },
      async list(uid, now) { await db(); return Share.find({ teacherUid: uid, revokedAt: null, expiresAt: { $gt: now } }).sort({ createdAt: -1 }).limit(100).lean(); },
    },
    attempts: {
      async fails(key, now, windowMs) { await db(); const a = await Attempt.findOne({ key }).lean(); return a && now - a.windowStart < windowMs ? a.fails : 0; },
      async fail(key, now, windowMs) {
        await db();
        const a = await Attempt.findOne({ key });
        if (!a || now - a.windowStart >= windowMs) await Attempt.updateOne({ key }, { $set: { fails: 1, windowStart: now, expireAt: new Date(now.getTime() + windowMs) } }, { upsert: true });
        else await Attempt.updateOne({ key }, { $inc: { fails: 1 } });
      },
    },
    config: {
      async get() { await db(); return Config.findOne({ key: 'main' }).lean(); },
      async set(cfg) { await db(); await Config.updateOne({ key: 'main' }, { $set: { releases: cfg.releases } }, { upsert: true }); },
    },
  },
};
