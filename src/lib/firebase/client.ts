import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const testFirebaseConfig = {
  apiKey: "test-api-key",
  authDomain: "test-project.firebaseapp.com",
  projectId: "test-project",
  storageBucket: "test-project.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:test",
};

export const firebaseConfig =
  process.env.NODE_ENV === "test"
    ? {
        apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || testFirebaseConfig.apiKey,
        authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || testFirebaseConfig.authDomain,
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || testFirebaseConfig.projectId,
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || testFirebaseConfig.storageBucket,
        messagingSenderId:
          process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || testFirebaseConfig.messagingSenderId,
        appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || testFirebaseConfig.appId,
      }
    : {
        apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
        authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
        messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
        appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
      };

export const firebaseConfigMissing =
  !firebaseConfig.apiKey ||
  !firebaseConfig.authDomain ||
  !firebaseConfig.projectId ||
  !firebaseConfig.storageBucket ||
  !firebaseConfig.messagingSenderId ||
  !firebaseConfig.appId;

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;
export { app };
