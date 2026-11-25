export async function getUserId() { return 'teacherA'; }
// الاختبار يضبط window.__mtToken ليحاكي معلمًا مسجّلًا (الافتراضي: غير مسجّل)
export async function getIdToken() { return (typeof window !== 'undefined' && window.__mtToken) || null; }
export const getToken = getIdToken;
