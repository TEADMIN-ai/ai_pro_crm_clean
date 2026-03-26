import type { Firestore } from "firebase-admin/firestore";
import {
  calculateContractorCompliance,
  getLatestDocumentsByType,
  isSupersededDocument,
  resolveContractorDocumentStatus,
} from "@/lib/compliance/contractorCompliance";
import type { ContractorDocument } from "@/types/document";

function toMillis(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? undefined : parsed;
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
    complianceType: typeof source.complianceType === "string" ? source.complianceType : undefined,
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
    verifiedBy: typeof source.verifiedBy === "string" ? source.verifiedBy : undefined,
    validationError: typeof source.validationError === "string" ? source.validationError : undefined,
    uploadedAt: toMillis(source.uploadedAt),
    updatedAt: toMillis(source.updatedAt),
    extractedAt: toMillis(source.extractedAt),
    expiresAt: typeof source.expiresAt === "number" ? source.expiresAt : toMillis(source.expiresAt),
    expiryDate: typeof source.expiryDate === "number" ? source.expiryDate : toMillis(source.expiryDate),
    isExpired: source.isExpired === true,
    expiryAlert:
      source.expiryAlert === "expired" || source.expiryAlert === "expiringSoon" || source.expiryAlert === "none"
        ? source.expiryAlert
        : undefined,
    expiryAlertMessage: typeof source.expiryAlertMessage === "string" ? source.expiryAlertMessage : undefined,
    confidenceScore: typeof source.confidenceScore === "number" ? source.confidenceScore : undefined,
    complianceScore: typeof source.complianceScore === "number" ? source.complianceScore : undefined,
    extractedFields:
      source.extractedFields && typeof source.extractedFields === "object"
        ? (source.extractedFields as Record<string, string | null>)
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
  const latestDocuments = getLatestDocumentsByType(documents);
  const summary = calculateContractorCompliance(documents);
  const readinessUpdatedAt = new Date().toISOString();
  const supersededUpdates = documentsSnapshot.docs
    .map((doc) => {
      const normalized = documents.find((document) => document.id === doc.id);
      if (!normalized) {
        return null;
      }

      const isSuperseded = isSupersededDocument(normalized, latestDocuments);
      return { ref: doc.ref, isSuperseded };
    })
    .filter((entry): entry is { ref: FirebaseFirestore.DocumentReference; isSuperseded: boolean } => entry !== null);

  if (supersededUpdates.length > 0) {
    const supersededBatch = db.batch();
    for (const entry of supersededUpdates) {
      supersededBatch.set(entry.ref, { isSuperseded: entry.isSuperseded }, { merge: true });
    }
    await supersededBatch.commit();
  }

  await db.collection("contractors").doc(contractorId).set(
    {
      readinessScore: summary.readinessScore,
      docsMissing: summary.docsMissing,
      tenderLockStatus: summary.tenderLockStatus,
      isTenderLocked: summary.isTenderLocked,
      complianceStatusScore: summary.complianceStatusScore,
      expiredDocumentCount: summary.expiredDocumentCount,
      expiringSoonCount: summary.expiringSoonCount,
      activeComplianceAlerts: summary.activeAlerts,
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
