import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";

const firebaseAdminConfig = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
};

if (!admin.apps.length) {
  if (
    firebaseAdminConfig.projectId &&
    firebaseAdminConfig.clientEmail &&
    firebaseAdminConfig.privateKey
  ) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: firebaseAdminConfig.projectId,
        clientEmail: firebaseAdminConfig.clientEmail,
        privateKey: firebaseAdminConfig.privateKey,
      }),
    });
  } else {
    admin.initializeApp();
  }
}

const adminApp = admin.apps[0]!;
const db = getFirestore(adminApp);
const adminAuth = admin.auth(adminApp);

export function getFirebaseAdmin() {
  return db;
}

export { adminApp, adminAuth, db };
