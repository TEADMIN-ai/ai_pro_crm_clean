import type { Firestore } from "firebase-admin/firestore";

import { recalculateContractorCompliance } from "@/lib/server/recalculateContractorCompliance";
import { LEGACY_COMPLIANCE_REQUIREMENT_KEYS } from "@/lib/compliance/contractorCompliance";

const REQUIRED_DOCS = LEGACY_COMPLIANCE_REQUIREMENT_KEYS;

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

export async function updateContractorIntelligence(
  db: Firestore,
  contractorId: string,
  options?: {
    precomputedSummary?: Awaited<ReturnType<typeof recalculateContractorCompliance>>;
  }
) {
  const documentsSnapshot = await db
    .collection("contractors")
    .doc(contractorId)
    .collection("documents")
    .get();

  const documents = documentsSnapshot.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() as ContractorDocumentRecord),
  }));

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
  const aiStatuses = uploadedDocuments.map((document) => document.aiStatus).filter(Boolean);
  const aiStatusSummary =
    aiStatuses.includes("failed")
      ? "failed"
      : aiStatuses.includes("pending")
        ? "pending"
        : aiStatuses.includes("complete")
          ? "complete"
          : "pending";
  const aiStatusPendingSince =
    aiStatusSummary === "pending"
      ? Date.now()
      : null;
  const legacySummary = options?.precomputedSummary ?? (await recalculateContractorCompliance(db, contractorId));
  const complianceCompletedTypes = REQUIRED_DOCS.filter(
    (requirement) => legacySummary.legacyDocuments[requirement]?.valid === true
  );
  const complianceMissingTypes = REQUIRED_DOCS.filter(
    (requirement) => legacySummary.legacyDocuments[requirement]?.valid !== true
  );
  const complianceScore = legacySummary.complianceStatusScore;
  const complianceStatus =
    legacySummary.docsMissing === 0 ? "complete" : complianceCompletedTypes.length > 0 ? "partial" : "risk";
  const intelligence = legacySummary.intelligence;

  await db
    .collection("contractors")
    .doc(contractorId)
    .set(
      {
        complianceScore,
        complianceCompleted: complianceCompletedTypes.length,
        complianceCompletedTypes,
        complianceMissing: complianceMissingTypes.length,
        complianceMissingTypes,
        missingDocsCount: legacySummary.docsMissing,
        complianceStatus,
        complianceConfidence: intelligence.complianceConfidence,
        readinessConfidence: intelligence.readinessConfidence,
        operationalSubmissionConfidence: intelligence.operationalSubmissionConfidence,
        riskGrade: intelligence.riskGrade,
        explainableSummary: intelligence.explainableSummary,
        blockedReasons: intelligence.blockedReasons,
        reviewRecommendations: intelligence.reviewRecommendations,
        averageDocumentConfidence: intelligence.averageDocumentConfidence,
        documentQualityScore,
        aiStatusSummary,
        aiStatusPendingSince,
        updatedAt: new Date(),
      },
      { merge: true }
    );

  return {
    complianceScore,
    complianceCompleted: complianceCompletedTypes.length,
    complianceCompletedTypes,
    complianceMissing: complianceMissingTypes.length,
    complianceMissingTypes,
    missingDocsCount: legacySummary.docsMissing,
    complianceStatus,
    complianceConfidence: intelligence.complianceConfidence,
    readinessConfidence: intelligence.readinessConfidence,
    operationalSubmissionConfidence: intelligence.operationalSubmissionConfidence,
    riskGrade: intelligence.riskGrade,
    explainableSummary: intelligence.explainableSummary,
    blockedReasons: intelligence.blockedReasons,
    reviewRecommendations: intelligence.reviewRecommendations,
    averageDocumentConfidence: intelligence.averageDocumentConfidence,
    documentQualityScore,
    readinessScore: legacySummary.readinessScore,
    readinessStatus: legacySummary.tenderLockStatus,
    aiStatusSummary,
    aiStatusPendingSince,
    legacySummary,
  };
}
