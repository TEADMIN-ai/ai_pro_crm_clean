import { doc, getDoc } from "firebase/firestore";
import { db } from "./config";

export async function getUserRole(uid: string): Promise<"admin" | "user"> {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) return "user";
  return (snap.data().role as "admin" | "user") || "user";
}
