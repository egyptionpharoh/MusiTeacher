// مخزن «مبادراتي» في MongoDB على نمط مزامنة منبّه الحصص: مستند واحد لكل معلم (uid)، بلا شعارات أو صور.
import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  _id: { type: String },                                   // = Firebase uid
  data: { type: mongoose.Schema.Types.Mixed, required: true },
  updatedAt: { type: Number, required: true },
}, { versionKey: false, minimize: false });

const InitiativesSync = mongoose.models.InitiativesSync || mongoose.model('InitiativesSync', schema, 'initiatives_sync');

export function makeSyncStore(connectDB) {
  return {
    async get(uid) { await connectDB(); return InitiativesSync.findById(uid).lean(); },
    async put(uid, data, updatedAt) { await connectDB(); await InitiativesSync.updateOne({ _id: uid }, { $set: { data, updatedAt } }, { upsert: true }); },
    async remove(uid) { await connectDB(); await InitiativesSync.deleteOne({ _id: uid }); },
  };
}
