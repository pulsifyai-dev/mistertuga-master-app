import * as admin from "firebase-admin";

// Padrão Singleton para garantir que a inicialização só corre uma vez.
if (!admin.apps.length) {
  // Verificação crucial para garantir que as variáveis de ambiente foram carregadas.
  if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_PRIVATE_KEY) {
    throw new Error("Firebase Admin SDK environment variables are not set. Check your .env.local file.");
  }

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      // A linha mais importante: formata a chave privada corretamente.
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    }),
  });
}

// Exporta as instâncias dos serviços de admin, prontas a usar noutros ficheiros.
export const adminAuth = admin.auth();
export const adminDb = admin.firestore();