// مخزن المهام فوق MongoDB (Mongoose). مُرشّحات الاستعلام دوال نقية تُختبر بلا قاعدة بيانات.
import { ACTIVE_STATUSES } from './config.js';

const FINAL = ['failed', 'canceled', 'expired', 'deleted'];

/** مرشّح التحديث الشرطي (الذرّي): statusIn، و finalizingBefore يخص حالة finalizing فقط. */
export function updateFilter(id, cond = {}) {
  const f = { _id: id };
  if (cond.statusIn) {
    if (cond.finalizingBefore && cond.statusIn.includes('finalizing')) {
      const others = cond.statusIn.filter((s) => s !== 'finalizing');
      f.$or = [
        ...(others.length ? [{ status: { $in: others } }] : []),
        { status: 'finalizing', $or: [{ finalizingAt: { $lt: cond.finalizingBefore } }, { finalizingAt: null }] },
      ];
    } else f.status = { $in: cond.statusIn };
  }
  return f;
}

export function purgeableFilter(now, limits) {
  const t = now.getTime();
  return {
    $or: [
      { status: 'ready', expiresAt: { $lte: now } },
      { status: 'awaiting-upload', createdAt: { $lt: new Date(t - limits.staleUploadMs) } },
      { status: { $in: ACTIVE_STATUSES }, createdAt: { $lt: new Date(t - limits.staleActiveMs) } },
      { status: { $in: FINAL }, $or: [{ inputDeleted: { $ne: true } }, { outputDeleted: { $ne: true } }] },
    ],
  };
}

const plain = (d) => (d ? { ...d, id: d._id } : null);

export function makeMongoStore(Model, connectDB) {
  return {
    async create(doc) {
      await connectDB();
      const { id, ...rest } = doc;
      const created = await Model.create({ _id: id, ...rest });
      return plain(created.toObject());
    },
    async get(id) { await connectDB(); return plain(await Model.findById(id).lean()); },
    async update(id, patch, cond) {
      await connectDB();
      return plain(await Model.findOneAndUpdate(updateFilter(id, cond), { $set: patch }, { new: true }).lean());
    },
    async findByRequest(uid, requestId) { await connectDB(); return plain(await Model.findOne({ uid, requestId }).lean()); },
    async findActive({ uid, since }) {
      await connectDB();
      const q = { status: { $in: ACTIVE_STATUSES }, createdAt: { $gte: since } };
      if (uid) q.uid = uid;
      return (await Model.find(q).sort({ createdAt: -1 }).limit(10).lean()).map(plain);
    },
    async countActive({ since }) {
      await connectDB();
      return Model.countDocuments({ status: { $in: ACTIVE_STATUSES }, createdAt: { $gte: since } });
    },
    async countStartedSince(uid, since) {
      await connectDB();
      return Model.countDocuments({ uid, startedAt: { $gte: since }, countsTowardQuota: { $ne: false } });
    },
    async findPurgeable(now, limits, limit) {
      await connectDB();
      return (await Model.find(purgeableFilter(now, limits)).sort({ createdAt: 1 }).limit(limit).lean()).map(plain);
    },
  };
}
