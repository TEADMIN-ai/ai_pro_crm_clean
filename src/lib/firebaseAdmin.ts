import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

let firestore: ReturnType<typeof getFirestore> | null = null;
let storage: ReturnType<typeof getStorage> | null = null;

function initAdmin() {
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
  storage = getStorage();
}

// Ensure initialized
function ensureInit() {
  if (!firestore || !storage) {
    initAdmin();
  }
}

// 🔥 MAIN ACCESS FUNCTION
export function getFirebaseAdmin() {
  ensureInit();
  return { db: firestore!, storage: storage! };
}

// 🔥 FULL COMPATIBILITY EXPORTS
export const adminDb = (() => {
  ensureInit();
  return firestore!;
})();

export const db = adminDb;

export const adminStorage = (() => {
  ensureInit();
  return storage!;
})();