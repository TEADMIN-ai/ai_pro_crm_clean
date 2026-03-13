import { getFirebaseAdmin } from "@/lib/firebase/admin";

export async function getContractorDocumentSnapshot(contractorId: string, documentType: string) {
  return getFirebaseAdmin()
    .collection("contractors")
    .doc(contractorId)
    .collection("documents")
    .doc(documentType)
    .get();
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
