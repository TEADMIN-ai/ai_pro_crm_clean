import { getFirebaseAdmin } from "@/lib/firebase/admin";

const REQUIRED_DOCS = [
  "taxClearance",
  "bbbee",
  "cipc",
  "coida",
  "bankConfirmation",
] as const;

type ReadinessStatus = "READY" | "AT_RISK" | "LOCKED";

type ReadinessDoc = {
  type?: unknown;
  documentType?: unknown;
  status?: unknown;
};

export async function computeReadiness(contractorId: string) {
  const db = getFirebaseAdmin();
  const docsSnapshot = await db
    .collection("documents")
    .where("contractorId", "==", contractorId)
    .get();

  const docs = docsSnapshot.docs.map((doc) => doc.data() as ReadinessDoc);
  const hasDocumentType = (doc: ReadinessDoc, requiredDoc: (typeof REQUIRED_DOCS)[number]) =>
    doc.type === requiredDoc || doc.documentType === requiredDoc;

  let approved = 0;
  let pending = 0;
  let rejected = 0;

  for (const requiredDoc of REQUIRED_DOCS) {
    const matchingDocs = docs.filter((doc) => hasDocumentType(doc, requiredDoc));

    if (matchingDocs.some((doc) => doc.status === "rejected")) {
      rejected++;
      continue;
    }

    if (matchingDocs.some((doc) => doc.status === "pending")) {
      pending++;
      continue;
    }

    if (matchingDocs.some((doc) => doc.status === "approved")) {
      approved++;
    }
  }

  const totalRequired = REQUIRED_DOCS.length;
  const missingCount = Math.max(totalRequired - approved - pending - rejected, 0);

  let score = 0;
  let status: ReadinessStatus = "LOCKED";

  if (rejected > 0 || missingCount > 0) {
    score = 30;
    status = "LOCKED";
  } else if (pending > 0) {
    score = 70;
    status = "AT_RISK";
  } else if (approved >= totalRequired) {
    score = 100;
    status = "READY";
  }

  const missing = REQUIRED_DOCS.filter(
    (requiredDoc) => !docs.some((doc) => hasDocumentType(doc, requiredDoc))
  );

  return {
    score,
    status,
    approved,
    pending,
    rejected,
    missing,
  };
}
