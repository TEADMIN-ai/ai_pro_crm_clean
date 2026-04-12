import admin from "firebase-admin";

const rawKey = process.env.FIREBASE_PRIVATE_KEY || "";

const privateKey = rawKey.replace(/\\n/g, "\n").replace(/^"(.*)"$/, "$1");

if (!privateKey.includes("BEGIN PRIVATE KEY")) {
  throw new Error("Invalid Firebase private key format");
}

console.log("KEY CHECK:", privateKey.slice(0, 30));

if (!admin.apps.length) {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const storageBucket =
    process.env.FIREBASE_STORAGE_BUCKET ||
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ||
    (projectId ? `${projectId}.appspot.com` : undefined);

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey,
    }),
    ...(storageBucket ? { storageBucket } : {}),
  });
}

export const adminDb = admin.firestore();
export const adminAuth = admin.auth();
export const adminStorage = admin.storage();
