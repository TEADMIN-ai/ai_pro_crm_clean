import { doc, getDoc } from "firebase/firestore";
import { db } from "./config";

export async function getUserRole(uid: string): Promise<string> {
  if (!db) return "user";

  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) return "user";

  const data = snap.data();
  return typeof data.role === "string" ? data.role : "user";
}
