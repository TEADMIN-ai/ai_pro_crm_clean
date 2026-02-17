// src/lib/firebase/admin.ts
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

/**
 * Server/Admin SDK singleton.
 * Use ONLY in server components / route handlers / server actions.
 */
function required(name: string, value: string | undefined) {
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing Firebase Admin environment variable: ${name}`);
  }
  return value;
}

export function initFirebaseAdmin() {
  if (getApps().length) return;

  const projectId = required("FIREBASE_PROJECT_ID", process.env.FIREBASE_PROJECT_ID);
  const clientEmail = required("FIREBASE_CLIENT_EMAIL", process.env.FIREBASE_CLIENT_EMAIL);

  // Keep the header/footer lines. Only fix newlines.
  const privateKeyRaw = required("FIREBASE_PRIVATE_KEY", process.env.FIREBASE_PRIVATE_KEY);
  const privateKey = privateKeyRaw.replace(/\\n/g, "\n");

  initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  });
}

export function adminDb() {
  initFirebaseAdmin();
  return getFirestore();
}