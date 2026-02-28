import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const firebaseAdminConfig = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
};

const hasServiceAccountConfig = Boolean(
  firebaseAdminConfig.projectId &&
    firebaseAdminConfig.clientEmail &&
    firebaseAdminConfig.privateKey
);

const app =
  getApps().length === 0
    ? initializeApp(
        hasServiceAccountConfig
          ? {
              credential: cert(firebaseAdminConfig as any),
            }
          : undefined
      )
    : getApps()[0];

const db = getFirestore(app);

/**
 * Backward-compatible accessor for legacy routes.
 * Do NOT reinitialize Firebase anywhere else.
 */
export function getFirebaseAdmin() {
  return db;
}

/**
 * Preferred modern import for new routes.
 */
export { db };
