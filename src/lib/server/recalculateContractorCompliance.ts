import type { Firestore } from "firebase-admin/firestore";
import { calculateContractorCompliance, resolveContractorDocumentStatus } from "@/lib/compliance/contractorCompliance";
import type { ContractorDocument } from "@/types/document";

function toMillis(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (value && typeof value === "object" && "toMillis" in value && typeof value.toMillis === "function") {
    return value.toMillis();
  }

  return undefined;
}

function hasTimestamp(value: unknown): boolean {
  return typeof toMillis(value) === "number";
}

function normalizeContractorDocument(id: string, source: Record<string, unknown>): ContractorDocument {
  const document: ContractorDocument = {
    id,
    contractorId: typeof source.contractorId === "string" ? source.contractorId : "",
    documentName: typeof source.documentName === "string" ? source.documentName : undefined,
    documentType:
      typeof source.documentType === "string"
        ? source.documentType
        : typeof source.docType === "string"
          ? source.docType
          : undefined,
    docType: typeof source.docType === "string" ? source.docType : undefined,
    fileUrl:
      typeof source.fileUrl === "string"
        ? source.fileUrl
        : typeof source.downloadURL === "string"
          ? source.downloadURL
          : typeof source.url === "string"
            ? source.url
            : undefined,
    downloadURL:
      typeof source.downloadURL === "string"
        ? source.downloadURL
        : typeof source.fileUrl === "string"
          ? source.fileUrl
          : undefined,
    storagePath: typeof source.storagePath === "string" ? source.storagePath : undefined,
    fileName:
      typeof source.fileName === "string"
        ? source.fileName
        : typeof source.documentName === "string"
          ? source.documentName
          : undefined,
    verified: source.verified === true || hasTimestamp(source.verifiedAt),
    verifiedAt: toMillis(source.verifiedAt),
    validationError: typeof source.validationError === "string" ? source.validationError : undefined,
    uploadedAt: toMillis(source.uploadedAt),
    updatedAt: toMillis(source.updatedAt),
    extractedAt: toMillis(source.extractedAt),
    expiresAt: typeof source.expiresAt === "number" ? source.expiresAt : toMillis(source.expiresAt),
    confidenceScore: typeof source.confidenceScore === "number" ? source.confidenceScore : undefined,
    extractedData:
      source.extractedData && typeof source.extractedData === "object"
        ? (source.extractedData as Record<string, string | null>)
        : undefined,
    extractedFields:
      source.extractedFields && typeof source.extractedFields === "object"
        ? (source.extractedFields as Record<string, string | null>)
        : source.extractedData && typeof source.extractedData === "object"
          ? (source.extractedData as Record<string, string | null>)
        : undefined,
    status: typeof source.status === "string" ? source.status : undefined,
  };

  return {
    ...document,
    status: resolveContractorDocumentStatus(document),
  };
}

export async function recalculateContractorCompliance(db: Firestore, contractorId: string) {
  const documentsSnapshot = await db.collection("contractors").doc(contractorId).collection("documents").get();
  const documents = documentsSnapshot.docs.map((doc) =>
    normalizeContractorDocument(doc.id, (doc.data() ?? {}) as Record<string, unknown>)
  );
  const summary = calculateContractorCompliance(documents);
  const readinessUpdatedAt = new Date().toISOString();

  await db.collection("contractors").doc(contractorId).set(
    {
      readinessScore: summary.readinessScore,
      docsMissing: summary.docsMissing,
      tenderLockStatus: summary.tenderLockStatus,
      isTenderLocked: summary.isTenderLocked,
      missingDocumentTypes: summary.missingDocumentTypes,
      readinessUpdatedAt,
      updatedAt: readinessUpdatedAt,
    },
    { merge: true }
  );

  const dealsSnapshot = await db.collection("deals").where("contractorId", "==", contractorId).get();
  if (!dealsSnapshot.empty) {
    const batch = db.batch();

    for (const dealDoc of dealsSnapshot.docs) {
      batch.set(
        dealDoc.ref,
        {
          readinessScore: summary.readinessScore,
          docsMissing: summary.docsMissing,
          tenderLockStatus: summary.tenderLockStatus,
          isTenderLocked: summary.isTenderLocked,
          readinessUpdatedAt,
          updatedAt: new Date(),
        },
        { merge: true }
      );
    }

    await batch.commit();
  }

  return {
    ...summary,
    readinessUpdatedAt,
  };
}
