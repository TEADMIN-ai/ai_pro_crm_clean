import { db } from "./config";
import { doc, setDoc, getDoc } from "firebase/firestore";

export async function createUserInFirestore(user: {
  if (!db) return;
  uid: string;
  email: string | null;
}) {
  if (!user.uid || !user.email) return;

  const userRef = doc(db, "users", user.uid);
  const userSnap = await getDoc(userRef);

  if (!userSnap.exists()) {
    await setDoc(userRef, {
      email: user.email,
      name: "New User",
      role: "staff",
      createdAt: new Date().toISOString(),
      uid: user.uid,
    });
  }
}


