import "server-only";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

// Check environment variables
if (!process.env.FIREBASE_PROJECT_ID) {
  console.error("❌ MISSING ENV VAR: FIREBASE_PROJECT_ID");
}
if (!process.env.FIREBASE_CLIENT_EMAIL) {
  console.error("❌ MISSING ENV VAR: FIREBASE_CLIENT_EMAIL");
}
if (!process.env.FIREBASE_PRIVATE_KEY) {
  console.error("❌ MISSING ENV VAR: FIREBASE_PRIVATE_KEY");
}

const serviceAccount = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY
    ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n")
    : undefined,
};

// Log initialization attempt (without secrets)
console.log("Attempting to initialize Firebase Admin with Project ID:", serviceAccount.projectId);

export const firebaseApp =
  getApps().find((app) => app.name === "firebase-admin-app") ||
  initializeApp(
    {
      credential: cert(serviceAccount),
    },
    "firebase-admin-app"
  );

export const adminDb = getFirestore(firebaseApp);
export const adminAuth = getAuth(firebaseApp);
