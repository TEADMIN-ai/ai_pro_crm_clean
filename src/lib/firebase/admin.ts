import admin from "firebase-admin";
import type { App } from "firebase-admin/app";
import type { Auth } from "firebase-admin/auth";
import type { Firestore } from "firebase-admin/firestore";
import type { Storage } from "firebase-admin/storage";

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

export const SESSION_COOKIE_EXPIRES_IN_MS = 5 * 24 * 60 * 60 * 1000;

let cachedServices: FirebaseAdminServices | null = null;
let bootLogEmitted = false;

function getRequiredStorageBucket() {
  const bucket = process.env.FIREBASE_STORAGE_BUCKET?.trim();

  if (!bucket) {
    throw new Error("Missing FIREBASE_STORAGE_BUCKET");
  }

  return bucket.replace(/^gs:\/\//, "").replace(/^\/+|\/+$/g, "");
}

function emitBootLog(validation: FirebaseEnvValidationResult, storageBucket: string) {
  if (bootLogEmitted) {
    return;
  }

  bootLogEmitted = true;
  console.info("Firebase Admin initialized");
  console.info(`Project ID: ${validation.projectId ?? "unknown"}`);
  console.info(`Storage bucket: ${storageBucket}`);
  console.info(`Private key loaded: ${validation.privateKeyLoaded}`);
}

function createFirebaseAdminServices(): FirebaseAdminServices {
  const validation = validateFirebaseEnv();

  if (!validation.valid) {
    throw new Error(validation.message ?? "Firebase Admin environment is invalid.");
  }

  const storageBucket = getRequiredStorageBucket();

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      }),
      storageBucket,
    });
  }

  const app = admin.app();

  emitBootLog(validation, storageBucket);

  return {
    app,
    auth: admin.auth(app),
    db: admin.firestore(app),
    storage: admin.storage(app),
  };
}

export function getFirebaseAdminStatus(): FirebaseEnvValidationResult & {
  firebaseAdminInitialized: boolean;
  storageBucket?: string;
} {
  const validation = validateFirebaseEnv();

  return {
    ...validation,
    firebaseAdminInitialized: cachedServices !== null || admin.apps.length > 0,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET?.trim(),
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

export default admin;
