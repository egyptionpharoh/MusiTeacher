import mongoose from 'mongoose';

// الإعداد المركزي لمشروع MusiTeacher Games: الإصدارات الفصلية وعنوان كل منها (وثيقة واحدة key='main')
const release = new mongoose.Schema({
  id: { type: String, required: true },
  url: { type: String, required: true },
  status: { type: String, enum: ['active', 'transition', 'stopped'], default: 'stopped' },
  until: { type: Date, default: null },
  note: { type: String, default: '' },
}, { _id: false });
const schema = new mongoose.Schema({ key: { type: String, unique: true, default: 'main' }, releases: [release] }, { timestamps: true });

export default mongoose.models.StudentGamesConfig || mongoose.model('StudentGamesConfig', schema);
