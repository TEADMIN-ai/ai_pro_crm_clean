import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { getDocumentById } from "@/server/services/dealService";

export async function findDocumentSnapshotById(documentId: string) {
  return getDocumentById(documentId);
}

export async function listDealDocumentSnapshots(dealId: string) {
  return getFirebaseAdmin().collection("deals").doc(dealId).collection("documents").get();
}

export async function updateDealReadinessState(
  dealId: string,
  readiness: {
    readinessScore: number;
    docsMissing: number;
    tenderLockStatus: "READY" | "RISK" | "BLOCKED";
    isTenderLocked: boolean;
    readinessUpdatedAt: string;
  },
) {
  await getFirebaseAdmin().collection("deals").doc(dealId).update(readiness);
}
