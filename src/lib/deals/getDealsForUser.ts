import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { AuthUser } from "@/lib/auth/userProfile";
import { normalizeDeal } from "@/lib/deals/normalizeDeal";
import type { Deal } from "@/types/deal";

export async function getDealsForUser(user: Pick<AuthUser, "role" | "contractorId"> | null): Promise<Deal[]> {
  if (!user || user.role === "guest") {
    return [];
  }

  const dealsRef = collection(db, "deals");
  if (user.role === "contractor") {
    if (!user.contractorId) {
      return [];
    }

    const contractorDealsQuery = query(dealsRef, where("contractorId", "==", user.contractorId));
    const snapshot = await getDocs(contractorDealsQuery);
    return snapshot.docs.map((docSnapshot) => normalizeDeal(docSnapshot.id, docSnapshot.data() as Record<string, unknown>));
  }

  if (user.role !== "admin" && user.role !== "manager" && user.role !== "staff") {
    return [];
  }

  const snapshot = await getDocs(query(dealsRef));
  return snapshot.docs.map((docSnapshot) => normalizeDeal(docSnapshot.id, docSnapshot.data() as Record<string, unknown>));
}
