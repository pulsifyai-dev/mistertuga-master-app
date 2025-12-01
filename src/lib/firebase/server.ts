import admin from 'firebase-admin';
import type { App } from 'firebase-admin/app';

const serviceAccount: admin.ServiceAccount = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
};

let adminApp: App;
if (admin.apps.length === 0) {
  adminApp = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
} else {
  adminApp = admin.apps[0] as App;
}


export const adminAuth = admin.auth(adminApp);
export const adminDb = admin.firestore(adminApp);
