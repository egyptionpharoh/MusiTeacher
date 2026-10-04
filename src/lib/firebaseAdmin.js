import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

// فحص آمن لمنع أخطاء undefined أثناء الـ Build في Next.js / Vercel
const apps = getApps();

if (!apps || apps.length === 0) {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  // التهيئة فقط في حال توفر بيانات البيئة المعتمدة
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

// تصدير آمن يضمن عدم ضرب إيرور عند البناء
export const adminAuth = (getApps() && getApps().length > 0) ? getAuth() : null;