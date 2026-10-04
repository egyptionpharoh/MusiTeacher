import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";

// 1. تعريف الإعدادات
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
};

// 2. إضافة "الحارس" (Check) للتأكد من وجود المفاتيح قبل ما نبدأ
if (!firebaseConfig.apiKey) {
    console.error("Firebase Config Error: Missing API Key in .env.local");
}

// 3. تخطي التهيئة مؤقتاً لتشغيل المنصة بدون فايربيس
let app = {};
let auth = {};

if (firebaseConfig.apiKey && firebaseConfig.apiKey !== "") {
    app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
    auth = getAuth(app);
}

export { app, auth };