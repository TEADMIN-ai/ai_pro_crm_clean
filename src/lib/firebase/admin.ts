import "server-only";
import { cert, getApp, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import {
  validateFirebaseEnv,
  type FirebaseEnvValidationResult,
} from "@/lib/server/validateFirebaseEnv";

interface FirebaseAdminServices {
  app: App;
  auth: Auth;
  db: Firestore;
}

export const SESSION_COOKIE_EXPIRES_IN_MS = 5 * 24 * 60 * 60 * 1000;

let cachedServices: FirebaseAdminServices | null = null;
let bootLogEmitted = false;

export function normalizePrivateKey(key: string | undefined) {
  if (!key) return undefined;

  return key.replace(/\\n/g, "\n").replace(/\r/g, "").trim();
}

function emitBootLog(validation: FirebaseEnvValidationResult) {
  if (bootLogEmitted) {
    return;
  }

  bootLogEmitted = true;
  console.info("Firebase Admin initialized successfully");
  console.info("Firebase Admin initialized");
  console.info(`Project ID: ${validation.projectId ?? "unknown"}`);
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
  const app =
    existingApp ??
    initializeApp({
      credential: cert({
        projectId: validation.projectId,
        clientEmail: validation.clientEmail,
        privateKey: validation.privateKey,
      }),
    });

  emitBootLog(validation);

  return {
    app,
    auth: getAuth(app),
    db: getFirestore(app),
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
