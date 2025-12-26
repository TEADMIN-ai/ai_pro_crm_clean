import { doc, setDoc, getDoc } from "firebase/firestore";
import { db } from "./config";

export async function createUserInFirestore(user: {
  uid: string;
  email: string | null;
}): Promise<void> {
  if (!db) return;

  const userRef = doc(db, "users", user.uid);
  const userSnap = await getDoc(userRef);

  if (!userSnap.exists()) {
    await setDoc(userRef, {
      uid: user.uid,
      email: user.email,
      createdAt: new Date(),
      role: "user",
    });
  }
}
