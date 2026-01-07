import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./config";

export async function createUserInFirestore(user: {
  uid: string;
  email: string | null;
}) {
  if (!user.uid || !user.email) return;

  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    await setDoc(ref, {
      uid: user.uid,
      email: user.email,
      role: "user",
      createdAt: serverTimestamp(),
    });
  }
}
