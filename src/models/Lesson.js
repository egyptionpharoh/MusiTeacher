const mongoose = require('mongoose');

const LessonSchema = new mongoose.Schema({
  metadata: {
    grade: { type: String, required: true },
    unit: { type: String, required: true },
    title: { type: String, required: true },
    lessonId: { type: String, required: true, unique: true }
  },
  // 1. الثوابت المقدسة (The Core - لا تُمس عبر AI)
  core: {
    objectives: [{ type: String }],
    procedures: [{ type: String }], // خطوات السير
    formativeEvaluation: [{ type: String }], // التقويم التكويني
    summativeEvaluation: [{ type: String }], // التقويم الختامي
    images: [{ url: String, placeholder: String }] // الصور المرفوعة يدوياً
  },
  // 2. طبقة المساعد الحتمي (Deterministic AI Layer - الإجابات المسبقة)
  precomputed_ai: {
    lesson_summary: { type: String }, // ملخص الدرس
    strategies: [
      { name: String, precomputed_integration: String } // استراتيجيات مدمجة مسبقاً
    ],
    games: [{ type: String }], // ألعاب مقترحة
    tools: [{ type: String }], // الوسائل
    citizenship_link: { type: String }, // ربط المواطنة والهوية
    enrichment_activity: { type: String }, // نشاط إثرائي
    remedial_activity: { type: String } // نشاط علاجي
  }
}, { timestamps: true });

module.exports = mongoose.model('Lesson', LessonSchema);