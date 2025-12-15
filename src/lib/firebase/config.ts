import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
};

const isBrowser = typeof window !== "undefined";

const app =
  isBrowser && getApps().length === 0
    ? initializeApp(firebaseConfig)
    : isBrowser
    ? getApps()[0]
    : null;

export const auth = isBrowser && app ? getAuth(app) : null;
export const db = isBrowser && app ? getFirestore(app) : null;