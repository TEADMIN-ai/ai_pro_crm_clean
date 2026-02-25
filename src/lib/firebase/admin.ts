import { initializeApp, cert, getApps, App } from "firebase-admin/app";
import { getFirestore, Firestore } from "firebase-admin/firestore";
import { getStorage, Storage } from "firebase-admin/storage";

type FirebaseAdminContext = Firestore & {
  app: App;
  db: Firestore;
  storage: Storage;
};

let app: App;
let db: Firestore;
let storage: Storage;
let context: FirebaseAdminContext;

export function getFirebaseAdmin(): FirebaseAdminContext {
  if (!app) {
    if (
      !process.env.FIREBASE_PROJECT_ID ||
      !process.env.FIREBASE_CLIENT_EMAIL ||
      !process.env.FIREBASE_PRIVATE_KEY ||
      !process.env.FIREBASE_STORAGE_BUCKET
    ) {
      throw new Error("Missing Firebase Admin environment variables.");
    }

    app =
      getApps().length > 0
        ? getApps()[0]
        : initializeApp({
            credential: cert({
              projectId: process.env.FIREBASE_PROJECT_ID,
              clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
              privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
            }),
            storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
          });

    db = getFirestore(app);
    storage = getStorage(app);
    context = Object.assign(db, { app, db, storage });
  }

  return context;
}
