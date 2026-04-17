import type { Firestore } from "firebase-admin/firestore";

import { recalculateContractorCompliance } from "@/lib/server/recalculateContractorCompliance";

const REQUIRED_DOCS = ["cipc", "tax", "bbbee", "coida"] as const;

type ContractorDocumentRecord = Record<string, unknown> & {
  aiData?: {
    valid?: boolean;
  };
  aiStatus?: "pending" | "complete" | "failed";
  aiValidated?: boolean;
  confidenceScore?: number;
  fileUrl?: string;
  downloadURL?: string;
  url?: string;
};

function documentMatchesRequirement(documentId: string, requirement: (typeof REQUIRED_DOCS)[number]) {
  const normalized = documentId.trim().toLowerCase();

  if (requirement === "tax") {
    return normalized === "tax" || normalized === "taxclearance";
  }

  return normalized === requirement;
}

function toConfidenceScore(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;
}

function toValidationScore(document: ContractorDocumentRecord): number {
  if (document.aiData?.valid === true) {
    return 100;
  }

  if (document.aiStatus === "failed") {
    return 0;
  }

  if (document.aiStatus === "pending") {
    return 0;
  }

  if (document.aiValidated === true) {
    return 0;
  }

  return document.verified === true ? 100 : 0;
}

function hasUploadedFile(document: ContractorDocumentRecord) {
  return typeof document.fileUrl === "string" ||
    typeof document.downloadURL === "string" ||
    typeof document.url === "string";
}

export async function updateContractorIntelligence(db: Firestore, contractorId: string) {
  const documentsSnapshot = await db
    .collection("contractors")
    .doc(contractorId)
    .collection("documents")
    .get();

  const documents = documentsSnapshot.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() as ContractorDocumentRecord),
  }));

  const existingDocs = documents.map((doc) => doc.id);
  const completed = REQUIRED_DOCS.filter((requirement) =>
    existingDocs.some((documentId) => documentMatchesRequirement(documentId, requirement))
  );
  const missing = REQUIRED_DOCS.filter((requirement) =>
    !existingDocs.some((documentId) => documentMatchesRequirement(documentId, requirement))
  );

  const complianceScore = Math.round((completed.length / REQUIRED_DOCS.length) * 100);
  const complianceStatus =
    complianceScore === 100 ? "complete" : complianceScore >= 60 ? "partial" : "risk";

  const uploadedDocuments = documents.filter(hasUploadedFile);
  const averageConfidenceScore =
    uploadedDocuments.length > 0
      ? uploadedDocuments.reduce((sum, document) => sum + toConfidenceScore(document.confidenceScore), 0) /
        uploadedDocuments.length
      : 0;
  const averageValidationScore =
    uploadedDocuments.length > 0
      ? uploadedDocuments.reduce((sum, document) => sum + toValidationScore(document), 0) / uploadedDocuments.length
      : 0;

  const documentQualityScore = Math.round((averageConfidenceScore + averageValidationScore) / 2);
  const readinessScore = Math.round(complianceScore * 0.6 + documentQualityScore * 0.4);
  const readinessStatus = readinessScore >= 80 ? "READY" : readinessScore >= 60 ? "RISK" : "BLOCKED";

  await db
    .collection("contractors")
    .doc(contractorId)
    .set(
      {
        complianceScore,
        complianceCompleted: completed,
        complianceMissing: missing,
        complianceStatus,
        documentQualityScore,
        readinessScore,
        readinessStatus,
        updatedAt: new Date(),
      },
      { merge: true }
    );

  const legacySummary = await recalculateContractorCompliance(db, contractorId);

  return {
    complianceScore,
    complianceCompleted: completed,
    complianceMissing: missing,
    complianceStatus,
    documentQualityScore,
    readinessScore,
    readinessStatus,
    legacySummary,
  };
}
