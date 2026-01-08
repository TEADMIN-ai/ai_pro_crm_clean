import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

type ActivityType = "assign" | "status" | "comment";

export async function logDealActivity(
  dealId: string,
  activity: {
    type: ActivityType;
    message: string;
    performedBy: string;
    performedByEmail: string;
  }
) {
  const ref = collection(db, "deals", dealId, "activity");

  await addDoc(ref, {
    ...activity,
    createdAt: serverTimestamp(),
  });
}