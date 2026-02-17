import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export async function getUserRole(
  uid: string
): Promise<"admin" | "manager" | "staff" | "contractor" | null> {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const role = (snap.data() as any)?.role;
  if (
    role === "admin" ||
    role === "manager" ||
    role === "staff" ||
    role === "contractor"
  ) {
    return role;
  }
  return null;
}

