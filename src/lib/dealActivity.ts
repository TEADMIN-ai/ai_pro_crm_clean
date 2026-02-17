import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

type ActivityType = "status_change" | "assignment_change";

export async function logDealActivity(params: {
  dealId: string;
  type: ActivityType;
  message: string;
  from?: string | null;
  to?: string | null;
  performedBy: string;
  performedByEmail: string;
}) {
  const {
    dealId,
    type,
    message,
    from = null,
    to = null,
    performedBy,
    performedByEmail,
  } = params;

  await addDoc(collection(db, "deals", dealId, "activity"), {
    type,
    message,
    from,
    to,
    performedBy,
    performedByEmail,
    createdAt: serverTimestamp(),
  });
}

