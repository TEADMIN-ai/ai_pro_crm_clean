import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyBpVN65Z8LZ7wyO8TueFtZtQL7mdCb_ozM",
  authDomain: "torque-empire-ai-pro-crm.firebaseapp.com",
  projectId: "torque-empire-ai-pro-crm",
  storageBucket: "torque-empire-ai-pro-crm.firebasestorage.app",
  messagingSenderId: "657699489075",
  appId: "1:657699489075:web:548fb392557469109b6a46",
};

const firebaseConfigMissing =
  !firebaseConfig.apiKey ||
  !firebaseConfig.authDomain ||
  !firebaseConfig.projectId ||
  !firebaseConfig.storageBucket ||
  !firebaseConfig.messagingSenderId ||
  !firebaseConfig.appId;

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export { app, auth, db, firebaseConfig, firebaseConfigMissing, storage };
