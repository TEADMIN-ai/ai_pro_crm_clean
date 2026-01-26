import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Deal } from "@/types/deal";

export async function getDealsByCompany(companyId: string): Promise<Deal[]> {
  const q = query(
    collection(db, "deals"),
    where("companyId", "==", companyId)
  );

  const snap = await getDocs(q);

  return snap.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() as Omit<Deal, "id">),
  }));
}