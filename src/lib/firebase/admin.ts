import { initializeApp, cert, getApps, App } from "firebase-admin/app";
import { getFirestore, Firestore } from "firebase-admin/firestore";

type FirebaseAdminGlobal = typeof globalThis & {
  __firebaseAdminApp?: App;
  __firebaseAdminDb?: Firestore;
};

const globalForFirebase = globalThis as FirebaseAdminGlobal;

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Firebase Admin initialization failed: missing ${name}`);
  }
  return value;
}

export function getFirebaseAdmin() {
  if (globalForFirebase.__firebaseAdminDb) {
    return globalForFirebase.__firebaseAdminDb;
  }

  if (!globalForFirebase.__firebaseAdminApp) {
    if (!getApps().length) {
      const projectId = getRequiredEnv("FIREBASE_PROJECT_ID");
      const clientEmail = getRequiredEnv("FIREBASE_CLIENT_EMAIL");
      const privateKey = getRequiredEnv("FIREBASE_PRIVATE_KEY");

      globalForFirebase.__firebaseAdminApp = initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey: privateKey.replace(/\\n/g, "\n"),
        }),
      });
    } else {
      globalForFirebase.__firebaseAdminApp = getApps()[0];
    }
  }

  if (!globalForFirebase.__firebaseAdminApp) {
    throw new Error("Firebase Admin initialization failed: app instance unavailable");
  }

  globalForFirebase.__firebaseAdminDb = getFirestore(globalForFirebase.__firebaseAdminApp);
  return globalForFirebase.__firebaseAdminDb;
}
