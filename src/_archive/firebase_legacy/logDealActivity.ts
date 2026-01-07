import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "./config";

export async function logDealActivity(data: {
  dealId: string;
  action: string;
  userId: string;
  userEmail: string;
}): Promise<void> {
  if (!db) return;

  await addDoc(collection(db, "deal_activity"), {
    ...data,
    timestamp: serverTimestamp(),
  });
}
