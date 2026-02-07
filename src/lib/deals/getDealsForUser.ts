// src/lib/deals/getDealsForUser.ts

import { collection, getDocs, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Deal } from "@/types/deal";

export async function getDealsForUser(): Promise<Deal[]> {
  const dealsRef = collection(db, "deals");

  const q = query(dealsRef);

  const snapshot = await getDocs(q);

  const deals: Deal[] = snapshot.docs.map((doc) => {
    const data = doc.data();

    return {
      id: doc.id,
      title: data.title,
      stage: data.stage,
      value: data.value ?? 0,
      currency: data.currency ?? "ZAR",
      pricingStatus: data.pricingStatus ?? "not_started",
      isTenderLocked: data.isTenderLocked ?? false,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
      companyId: data.companyId,
      assignedTo: data.assignedTo ?? null,
      clientName: data.clientName,
      tenderSubmittedAt: data.tenderSubmittedAt,
      tenderSubmittedBy: data.tenderSubmittedBy,
      documents: data.documents ?? [],
      auditTrail: data.auditTrail ?? [],
    } as Deal;
  });

  return deals;
}