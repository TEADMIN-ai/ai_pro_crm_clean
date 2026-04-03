import { createRequire } from "node:module";
import { cert, getApp, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getStorage, type Storage } from "firebase-admin/storage";
import {
  validateFirebaseEnv,
  type FirebaseEnvValidationResult,
} from "@/lib/server/validateFirebaseEnv";

interface FirebaseAdminServices {
  app: App;
  auth: Auth;
  db: Firestore;
  storage: Storage;
}

const require = createRequire(import.meta.url);

try {
  require("server-only");
} catch {
  // Optional when the module is imported from standalone diagnostics.
}

export const SESSION_COOKIE_EXPIRES_IN_MS = 5 * 24 * 60 * 60 * 1000;

let cachedServices: FirebaseAdminServices | null = null;
let bootLogEmitted = false;

export function normalizePrivateKey(key: string | undefined) {
  if (!key) return undefined;

  return key.replace(/\\n/g, "\n").replace(/\r/g, "").trim();
}

function normalizeStorageBucket(bucket: string | undefined) {
  if (!bucket) {
    return undefined;
  }

  return bucket.replace(/^gs:\/\//, "").replace(/^\/+|\/+$/g, "").trim() || undefined;
}

function resolveStorageBucket(projectId: string | undefined) {
  const configuredBucket = normalizeStorageBucket(
    process.env.FIREBASE_STORAGE_BUCKET ?? process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
  );

  if (configuredBucket) {
    return configuredBucket;
  }

  return projectId ? `${projectId}.firebasestorage.app` : undefined;
}

function emitBootLog(validation: FirebaseEnvValidationResult) {
  if (bootLogEmitted) {
    return;
  }

  bootLogEmitted = true;
  const storageBucket = resolveStorageBucket(validation.projectId);
  console.info("Firebase Admin initialized successfully");
  console.info("Firebase Admin initialized");
  console.info(`Project ID: ${validation.projectId ?? "unknown"}`);
  console.info(`Storage bucket: ${storageBucket ?? "unknown"}`);
  console.info(`Private key loaded: ${validation.privateKeyLoaded}`);
}

export function getFirebaseAdminStatus(): FirebaseEnvValidationResult & {
  firebaseAdminInitialized: boolean;
} {
  const validation = validateFirebaseEnv();

  return {
    ...validation,
    firebaseAdminInitialized: cachedServices !== null || getApps().length > 0,
  };
}

function createFirebaseAdminServices(): FirebaseAdminServices {
  const validation = validateFirebaseEnv();

  if (!validation.valid) {
    throw new Error(validation.message ?? "Firebase Admin environment is invalid.");
  }

  const existingApp = getApps().length > 0 ? getApp() : null;
  const storageBucket = resolveStorageBucket(validation.projectId);
  const app =
    existingApp ??
    initializeApp({
      credential: cert({
        projectId: validation.projectId,
        clientEmail: validation.clientEmail,
        privateKey: validation.privateKey,
      }),
      ...(storageBucket ? { storageBucket } : {}),
    });

  emitBootLog(validation);

  return {
    app,
    auth: getAuth(app),
    db: getFirestore(app),
    storage: getStorage(app),
  };
}

export function getFirebaseAdminServices(): FirebaseAdminServices {
  if (cachedServices) {
    return cachedServices;
  }

  cachedServices = createFirebaseAdminServices();
  return cachedServices;
}

export function getFirebaseAdmin() {
  return getFirebaseAdminServices().db;
}

export function getAdminAuth() {
  return getFirebaseAdminServices().auth;
}

export function getAdminApp() {
  return getFirebaseAdminServices().app;
}

export function getAdminStorage() {
  return getFirebaseAdminServices().storage;
}
