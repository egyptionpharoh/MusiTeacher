import mongoose from 'mongoose';

// مهام «استوديو فصل الصوت». لا تُخزَّن هنا أي بيانات صوتية — فقط حالة المهمة ومفاتيح ملفاتها المؤقتة في التخزين.
// السجل نفسه يُحذف تلقائيًا من MongoDB بعد 7 أيام (فهرس TTL على purgeAt).
const separationJobSchema = new mongoose.Schema({
  _id: { type: String },                       // معرّف عشوائي 128-بت (hex)
  uid: { type: String, required: true, index: true },
  requestId: { type: String, required: true },
  status: { type: String, required: true, index: true },
  mode: { type: String, enum: ['vocals', 'instrumental'], required: true },
  format: { type: String, enum: ['mp3', 'wav'], required: true },
  bitrate: { type: Number, default: null },
  fileName: String, baseName: String, inputExt: String, container: String, inputType: String,
  inputSize: Number, clientDuration: Number, serverDuration: Number, sourceKbps: Number,
  inputKey: String, outputKey: String, outputFileName: String, outputSize: Number,
  inputDeleted: { type: Boolean, default: false }, outputDeleted: { type: Boolean, default: false },
  modelId: String, modelLabel: String,
  predictionId: { type: String, default: null }, providerStatus: String,
  progress: { type: Number, default: null }, error: { type: String, default: null },
  countsTowardQuota: { type: Boolean, default: true },
  finalizeAttempts: { type: Number, default: 0 }, predictTime: Number, stale: Boolean, ageMs: Number,
  createdAt: { type: Date, default: Date.now }, startedAt: Date, completedAt: Date, expiresAt: Date,
  finalizingAt: Date, lastPolledAt: Date,
  purgeAt: { type: Date, default: () => new Date(Date.now() + 7 * 24 * 3600 * 1000) },
}, { versionKey: false });

separationJobSchema.index({ uid: 1, requestId: 1 }, { unique: true });
separationJobSchema.index({ uid: 1, startedAt: 1 });
separationJobSchema.index({ status: 1, createdAt: 1 });
separationJobSchema.index({ purgeAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.models.SeparationJob || mongoose.model('SeparationJob', separationJobSchema);
