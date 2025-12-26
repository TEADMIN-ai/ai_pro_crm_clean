import { initializeApp, getApps } from "firebase/app";
import {
  getAuth,
  signInWithRedirect,
  type Auth,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const env = (key: string) => process.env[key];

const firebaseConfig = {
  apiKey: env("NEXT_PUBLIC_FIREBASE_API_KEY"),
  authDomain: env("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN"),
  projectId: env("NEXT_PUBLIC_FIREBASE_PROJECT_ID"),
  storageBucket: env("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET"),
  messagingSenderId: env("NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID"),
  appId: env("NEXT_PUBLIC_FIREBASE_APP_ID"),
};

const missingKeys = Object.entries(firebaseConfig)
  .filter(([, value]) => !value)
  .map(([key]) => key);

export const firebaseConfigMissing = missingKeys.length > 0;

const app =
  firebaseConfigMissing
    ? null
    : getApps().length
      ? getApps()[0]
      : initializeApp(firebaseConfig);

export const auth: Auth | null = app ? getAuth(app) : null;
export const db = app ? getFirestore(app) : null;

/**
 * Compatibility shim:
 * Some older code expects auth.signInWithRedirect(...)
 * Firebase v9+ exposes it as a standalone function.
 */
if (auth && typeof (auth as any).signInWithRedirect !== "function") {
  (auth as any).signInWithRedirect = (provider: any) =>
    signInWithRedirect(auth, provider);
}
