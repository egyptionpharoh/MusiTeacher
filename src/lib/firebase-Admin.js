import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

let adminAuth = null;

try {
  const apps = getApps();
  let app;

  if (!apps || apps.length === 0) {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    let privateKey = process.env.FIREBASE_PRIVATE_KEY;

    if (privateKey) {
      privateKey = privateKey
        .trim()
        .replace(/^["']|["']$/g, '')
        .replace(/\\n/g, '\n');
    }

    if (projectId && clientEmail && privateKey) {
      app = initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      });
    }
  } else {
    app = apps[0];
  }

  if (app) {
    adminAuth = getAuth(app);
  }
} catch (error) {
  console.error('Firebase Admin Initialization Error:', error);
}

export { adminAuth };