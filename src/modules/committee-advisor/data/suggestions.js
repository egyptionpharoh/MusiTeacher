// الأسئلة المقترحة التي تظهر أزرارًا في المستشار، مرتبة حسب المجموعات.
// كل عنصر = معرّف مدخل من knowledge.js. لإظهار سؤال جديد أضف معرّفه هنا.
// القاعدة: لا يُقترح إلا سؤال له إجابة واضحة ومفيدة من القاعدة (لا أسئلة إجابتها «غير متوفر»).
export const SUGGESTED = {
  meeting: ['meet-what', 'meet-prepare', 'meet-who', 'meet-notify', 'meet-schedule', 'meet-question', 'after-meeting', 'meet-conflict'],
  role: ['role-invigilator', 'role-how-know', 'role-unclear-assign', 'role-head', 'role-first'],
  papers: ['papers-what', 'papers-relatives', 'papers-oath', 'papers-signature', 'papers-unclear-item'],
  examday: ['examday-arrival', 'examday-prohibited', 'examday-envelopes', 'examday-students', 'examday-explain', 'examday-leave', 'examday-sick', 'examday-problem'],
  violations: ['viol-observed', 'viol-who-writes', 'viol-types', 'viol-phone', 'viol-late'],
  refer: ['refer-unclear', 'refer-conflict', 'refer-strange', 'about-official'],
};

// أسئلة البداية السريعة (تظهر تحت رسالة الترحيب)
export const STARTERS = ['meet-what', 'role-invigilator', 'papers-relatives', 'viol-observed'];
