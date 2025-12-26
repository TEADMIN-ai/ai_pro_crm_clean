import { collection, getDocs, query, where, updateDoc, doc, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase/config";

export async function notifyUser(data: {
  userId: string;
  title: string;
  message: string;
  link?: string;
}) {
  if (!db) return;
  await addDoc(collection(db, "notifications"), {
    ...data,
    read: false,
    createdAt: serverTimestamp(),
  });
}

export async function getUserNotifications(userId: string) {
  if (!db) return [];
  const q = query(
    collection(db, "notifications"),
    where("userId", "==", userId)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function markNotificationRead(id: string) {
  if (!db) return;
  await updateDoc(doc(db, "notifications", id), {
    read: true,
  });
}
