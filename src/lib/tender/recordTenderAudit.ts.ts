import { getFirestore, collection, addDoc, serverTimestamp } from "firebase/firestore";
import { firebaseApp } from "@/lib/firebase/firebaseApp";
import type { Deal } from "@/types/deal";

const db = getFirestore(firebaseApp);

export type TenderAuditEvent = {
  dealId: string;
  action: "SUBMITTED" | "UPDATED" | "LOCKED";
  performedBy: string;
  timestamp: unknown;
  metadata?: Record<string, unknown>;
};

export async function recordTenderAudit(
  deal: Deal,
  action: TenderAuditEvent["action"],
  performedBy: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  await addDoc(collection(db, "tenderAudit"), {
    dealId: deal.id,
    action,
    performedBy,
    timestamp: serverTimestamp(),
    metadata: metadata ?? {},
  });
}

