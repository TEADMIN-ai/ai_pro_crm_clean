import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyBpVN65Z8LZ7wyO8TueFtZtQL7mdCb_ozM",
  authDomain: "torque-empire-ai-pro-crm.firebaseapp.com",
  projectId: "torque-empire-ai-pro-crm",
};

// Initialize Firebase only once
const app = getApps().length
  ? getApps()[0]
  : initializeApp(firebaseConfig);

// Export Auth instance
export const auth = getAuth(app);