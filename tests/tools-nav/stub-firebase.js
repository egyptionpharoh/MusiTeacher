// بديل اختبار لـ Firebase: لا مستخدم مسجّل (الأدوات تعمل محليًا)
export const auth = null; export const db = null; export const storage = null;
export function onAuthStateChanged(_a, cb) { setTimeout(() => cb(null), 0); return () => {}; }
export function getAuth() { return null; } export function initializeApp() { return {}; } export function getApps() { return []; }
export default {};
