// قوالب كروت التميز: كل قالب = زخرفة متجهة (SVG) + إطار + ألوان. النصوص نصوص حقيقية قابلة للتعديل وليست صورًا.
// gift: هل يبدأ القالب بمساحة الهدية (يمكن للمعلم إظهارها أو إخفاؤها في أي قالب).
export const TEMPLATES = [
  { id: 'notes', name: 'نوتة وإبداع', motif: 'music', frame: 'round', gift: true, c1: '#4338ca', c2: '#db2777', tint: '#eef2ff' },
  { id: 'stars', name: 'نجم التميز', motif: 'stars', frame: 'double', gift: true, c1: '#b45309', c2: '#7c3aed', tint: '#fff7e6' },
  { id: 'trophy', name: 'كأس الإنجاز', motif: 'trophy', frame: 'ticket', gift: false, c1: '#0f766e', c2: '#d97706', tint: '#ecfdf5' },
  { id: 'medal', name: 'وسام التقدير', motif: 'medal', frame: 'double', gift: true, c1: '#9f1239', c2: '#ca8a04', tint: '#fff1f2' },
  { id: 'book', name: 'شغف المعرفة', motif: 'book', frame: 'round', gift: false, c1: '#1d4ed8', c2: '#059669', tint: '#eff6ff' },
  { id: 'rocket', name: 'انطلاقة نحو القمة', motif: 'rocket', frame: 'ticket', gift: true, c1: '#7c3aed', c2: '#ea580c', tint: '#f5f3ff' },
  { id: 'laurel', name: 'إكليل الفخر', motif: 'laurel', frame: 'double', gift: false, c1: '#166534', c2: '#a16207', tint: '#f0fdf4' },
  { id: 'palette', name: 'بصمة إبداع', motif: 'palette', frame: 'round', gift: true, c1: '#c2410c', c2: '#0369a1', tint: '#fff7ed' },
];
const byId = new Map(TEMPLATES.map((t) => [t.id, t]));
export const templateById = (id) => byId.get(id) || TEMPLATES[0];
