import { applicationDefault, cert, getApps, initializeApp, type AppOptions, type ServiceAccount } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

function normalizePrivateKey(privateKey: string | undefined) {
  return privateKey?.replace(/\\n/g, "\n").replace(/^"(.*)"$/, "$1").trim();
}

function resolveFirebaseStorageBucket() {
  const rawBucket = process.env.FIREBASE_STORAGE_BUCKET?.trim()
    || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET?.trim();
  if (!rawBucket) return undefined;

  const normalizedBucket = rawBucket
    .replace(/^gs:\/\//, "")
    .replace(/^https?:\/\/storage.googleapis.com\//, "")
    .replace(/\/+$/, "");

  return normalizedBucket;
}

function resolveAdminCredential() {
  const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
  const privateKey = normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY);

  if (!projectId || !clientEmail || !privateKey) {
    return {
      credential: applicationDefault(),
      credentialSource: process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim()
        ? "googleApplicationCredentials" as const
        : "applicationDefault" as const,
    };
  }

  const serviceAccount: ServiceAccount = {
    projectId,
    clientEmail,
    privateKey,
  };

  return {
    credential: cert(serviceAccount),
    credentialSource: "serviceAccount" as const,
  };
}

export const firebaseAdminStorageBucket = resolveFirebaseStorageBucket();

if (!getApps().length) {
  const { credential, credentialSource } = resolveAdminCredential();
  const appOptions: AppOptions = {
    credential,
  };

  if (firebaseAdminStorageBucket) {
    appOptions.storageBucket = firebaseAdminStorageBucket;
  }

  initializeApp(appOptions);

  console.log("[FIREBASE_ADMIN_INIT]", {
    credentialSource,
    projectId: process.env.FIREBASE_PROJECT_ID?.trim() ?? null,
    storageBucket: firebaseAdminStorageBucket ?? null,
  });
}

export const adminDb = getFirestore();
export const getFirebaseAdmin = () => adminDb;
export const getFirebaseStorageBucketName = () => firebaseAdminStorageBucket;
export function getFirebaseStorageBucket() {
  return firebaseAdminStorageBucket
    ? getStorage().bucket(firebaseAdminStorageBucket)
    : getStorage().bucket();
}
