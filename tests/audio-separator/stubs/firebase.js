// بديل اختبار لـ firebase: الرمز «good-<uid>» يقبله خادم الاختبار فقط.
export const auth = { currentUser: { getIdToken: async () => 'good-' + (globalThis.__TEST_UID || 'sub') } };
export const app = {};
