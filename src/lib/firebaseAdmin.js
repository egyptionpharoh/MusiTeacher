import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

// 1. فحص آمن لـ getApps لتجنب خطأ undefined أثناء الـ Build
const apps = getApps();

if (!apps || apps.length === 0) {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  // 2. التهيئة فقط في حال توفر البيانات (لتجنب توقف الـ Build عند غياب المتغيرات)
  if (projectId && clientEmail && privateKey) {
    initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });
  }
}

// 3. تصدير adminAuth بأمان
export const adminAuth = (getApps() && getApps().length > 0) ? getAuth() : null;
