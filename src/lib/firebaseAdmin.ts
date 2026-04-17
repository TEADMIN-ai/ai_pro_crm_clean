import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

let firestore: ReturnType<typeof getFirestore>;

export function getFirebaseAdmin() {
  if (!getApps().length) {
    console.log("🔥 Initializing Firebase Admin...");

    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY
          ?.replace(/\\n/g, "\n")
          .replace(/"/g, ""),
      }),
    });

    console.log("✅ Firebase Admin initialized");
  }

  firestore = getFirestore();
  return firestore;
}