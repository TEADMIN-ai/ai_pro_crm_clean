import { getFirestore, collection, query, where, orderBy, getDocs } from "firebase/firestore";
import { firebaseApp } from "@/lib/firebase/firebaseApp";

export type TenderAuditEvent = {
  id: string;
  dealId: string;
  action: "SUBMITTED" | "UPDATED" | "LOCKED";
  performedBy: string;
  timestamp: Date | null;
  metadata?: Record<string, unknown>;
};

const db = getFirestore(firebaseApp);

export async function getTenderAudit(dealId: string): Promise<TenderAuditEvent[]> {
  const q = query(
    collection(db, "tenderAudit"),
    where("dealId", "==", dealId),
    orderBy("timestamp", "desc")
  );

  const snapshot = await getDocs(q);

  return snapshot.docs.map((doc: any) => {
    const data = doc.data();

    return {
      id: doc.id,
      dealId: data.dealId,
      action: data.action,
      performedBy: data.performedBy,
      timestamp: data.timestamp?.toDate?.() ?? null,
      metadata: data.metadata ?? {},
    };
  });
}

