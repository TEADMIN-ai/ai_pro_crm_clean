import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { AuthUser } from "@/context/AuthContext";

type ActivityType = "status_change" | "assignment_change";

export async function logDealActivity(
  dealId: string,
  user: AuthUser,
  type: ActivityType,
  from: string | null,
  to: string | null
) {
  const ref = collection(db, "deals", dealId, "activity");

  await addDoc(ref, {
    type,
    from,
    to,
    actorUid: user.uid,
    actorEmail: user.email,
    createdAt: serverTimestamp(),
  });
}
