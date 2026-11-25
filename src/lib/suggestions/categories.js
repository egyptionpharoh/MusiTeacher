// تصنيفات الرسائل وحالاتها — ملف مشترك بين الواجهة والخادم (بلا أي اعتماديات خادمية).
export const CATEGORIES = [
  { id: 'idea', label: 'اقتراح أو فكرة' },
  { id: 'problem', label: 'مشكلة واجهتني' },
  { id: 'design', label: 'التصميم وسهولة الاستخدام' },
  { id: 'complaint', label: 'شكوى أو انتقاد' },
  { id: 'thanks', label: 'شكر وتقدير' },
  { id: 'other', label: 'موضوع آخر' },
];
export const CATEGORY_IDS = CATEGORIES.map((c) => c.id);
export const categoryLabel = (id) => (CATEGORIES.find((c) => c.id === id) || CATEGORIES[CATEGORIES.length - 1]).label;

export const STATUSES = [
  { id: 'new', label: 'جديدة' },
  { id: 'read', label: 'تمت القراءة' },
  { id: 'review', label: 'قيد المراجعة' },
  { id: 'done', label: 'تم التعامل معها' },
];
export const STATUS_IDS = STATUSES.map((s) => s.id);
export const statusLabel = (id) => (STATUSES.find((s) => s.id === id) || STATUSES[0]).label;
