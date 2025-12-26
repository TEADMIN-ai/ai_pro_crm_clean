import { db } from "@/lib/firebase/config";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";

export async function notifyUser({
  userId,
  title,
  message,
  link,
}: {
  userId: string;
  title: string;
  message: string;
  link: string;
}) {
  if (!db) return;

  const ref = doc(db, "notifications", `${userId}_${Date.now()}`);

  await setDoc(ref, {
    userId,
    title,
    message,
    link,
    createdAt: serverTimestamp(),
    read: false,
  });
}
