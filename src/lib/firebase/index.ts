import { getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyBpVN65Z8LZ7wyO8TueFtZtQL7mdCb_ozM",
  authDomain:"torque-empire-ai-pro-crm.firebaseapp.com",
  projectId:"torque-empire-ai-pro-crm",
  storageBucket:"torque-empire-ai-pro-crm.firebasestorage.app",
  messagingSenderId:"657699489075",
  appId:"1:657699489075:web:548fb392557469109b6a46",
};

export const firebaseConfigMissing =
  !firebaseConfig.apiKey ||
  !firebaseConfig.authDomain ||
  !firebaseConfig.projectId ||
  !firebaseConfig.storageBucket ||
  !firebaseConfig.messagingSenderId ||
  !firebaseConfig.appId;

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

// IMPORTANT: storageBucket must be the raw bucket name (no gs:// in env)
export const storage = getStorage(app, `gs://${firebaseConfig.storageBucket}`);

export { app, firebaseConfig };
console.log("🔥 FIREBASE CONFIG LOADED:", firebaseConfig);
