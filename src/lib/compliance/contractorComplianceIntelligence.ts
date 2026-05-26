import {
  getDocumentTypeLabel,
  normalizeSupportedDocumentType,
  resolveContractorDocumentStatus,
  SUPPORTED_DOCUMENT_TYPES,
  type ContractorComplianceSummary,
  type SupportedDocumentType,
} from "@/lib/compliance/contractorCompliance";
import type { ContractorDocument } from "@/types/document";

export type ComplianceRiskGrade = "LOW RISK" | "MODERATE RISK" | "REVIEW REQUIRED" | "HIGH RISK";

export type ComplianceDocumentBreakdown = {
  documentType: SupportedDocumentType;
  label: string;
  weight: number;
  status: ReturnType<typeof resolveContractorDocumentStatus>;
  weightedScore: number;
  complianceScore: number;
  confidenceScore: number;
  verified: boolean;
  expiresAt: number | null;
  reason: string | null;
  suggestions: string[];
  missingFields: string[];
  taxDocumentCategory?: ContractorDocument["taxDocumentCategory"];
  taxDocumentPurpose?: ContractorDocument["taxDocumentPurpose"];
  taxClassificationConfidence?: number;
  taxComplianceCapable?: boolean;
  taxSupportingOnly?: boolean;
  readinessImpactReason?: string | null;
};

export type ContractorComplianceIntelligence = {
  complianceConfidence: number;
  readinessConfidence: number;
  operationalSubmissionConfidence: number;
  riskGrade: ComplianceRiskGrade;
  explainableSummary: string;
  blockedReasons: string[];
  reviewRecommendations: string[];
  missingCriticalDocuments: SupportedDocumentType[];
  verifiedCriticalDocuments: SupportedDocumentType[];
  averageDocumentConfidence: number;
  documentBreakdown: ComplianceDocumentBreakdown[];
  telemetry: {
    documentCount: number;
    verifiedDocumentCount: number;
    invalidDocumentCount: number;
    expiredDocumentCount: number;
    expiringSoonCount: number;
    uploadedDocumentCount: number;
    ocrActivatedCount: number;
    pdfTextDocumentCount: number;
    taxDocumentCategories: Partial<Record<NonNullable<ContractorDocument["taxDocumentCategory"]>, number>>;
    complianceCapableTaxDocumentCount: number;
    supportingOnlyTaxDocumentCount: number;
    taxClassificationConfidenceAverage: number;
    readinessImpactReasons: string[];
  };
};

const DOCUMENT_WEIGHTS: Record<SupportedDocumentType, number> = {
  taxClearance: 30,
  coida: 25,
  cipc: 20,
  bbbee: 15,
  bankConfirmation: 10,
};

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
}

function getDocumentComplianceScore(document: ContractorDocument, status: ComplianceDocumentBreakdown["status"]): number {
  if (typeof document.complianceScore === "number" && Number.isFinite(document.complianceScore)) {
    return clampPercent(document.complianceScore);
  }

  switch (status) {
    case "verified":
      return 100;
    case "expiringSoon":
      return 70;
    case "uploaded":
      return 25;
    case "invalid":
      return 10;
    case "expired":
    case "missing":
    default:
      return 0;
  }
}

function getDocumentConfidenceScore(document: ContractorDocument): number {
  return typeof document.confidenceScore === "number" && Number.isFinite(document.confidenceScore)
    ? clampPercent(document.confidenceScore)
    : 0;
}

function rankStatus(status: ComplianceDocumentBreakdown["status"]): number {
  switch (status) {
    case "verified":
      return 6;
    case "expiringSoon":
      return 5;
    case "uploaded":
      return 4;
    case "invalid":
      return 3;
    case "expired":
      return 2;
    case "missing":
    default:
      return 1;
  }
}

function pickBestDocument(documents: ContractorDocument[], documentType: SupportedDocumentType): ContractorDocument | null {
  const candidates = documents
    .filter((document) => normalizeSupportedDocumentType(document.documentType ?? document.docType) === documentType)
    .sort((left, right) => {
      const leftStatus = resolveContractorDocumentStatus(left);
      const rightStatus = resolveContractorDocumentStatus(right);
      const rankDelta = rankStatus(rightStatus) - rankStatus(leftStatus);
      if (rankDelta !== 0) {
        return rankDelta;
      }

      const rightUpdatedAt = typeof right.updatedAt === "number" ? right.updatedAt : 0;
      const leftUpdatedAt = typeof left.updatedAt === "number" ? left.updatedAt : 0;
      return rightUpdatedAt - leftUpdatedAt;
    });

  return candidates[0] ?? null;
}

function formatDate(value: number | null): string | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  return new Date(value).toISOString().slice(0, 10);
}

function getDaysUntil(value: number | null): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  return Math.ceil((value - Date.now()) / (24 * 60 * 60 * 1000));
}

function buildDocumentReason(documentType: SupportedDocumentType, document: ContractorDocument | null): string | null {
  const label = getDocumentTypeLabel(documentType);
  if (!document) {
    return `${label} is missing`;
  }

  if (documentType === "taxClearance" && document.taxSupportingOnly === true) {
    return typeof document.reviewReason === "string" && document.reviewReason.trim().length > 0
      ? document.reviewReason
      : "Document confirms SARS registration but does not independently confirm active tax compliance.";
  }

  const status = resolveContractorDocumentStatus(document);
  const expiryDate = formatDate(document.expiresAt ?? null);
  const daysUntil = getDaysUntil(document.expiresAt ?? null);
  const validationError = asString(document.validationError) ?? asString(document.reviewReason);
  const missingFields = asStringArray(document.missingFields);

  switch (status) {
    case "verified":
      return null;
    case "expiringSoon":
      return daysUntil !== null
        ? `${label} expires in ${daysUntil} day(s)`
        : `${label} is close to expiry`;
    case "expired":
      return expiryDate ? `${label} expired on ${expiryDate}` : `${label} has expired`;
    case "invalid":
      return validationError
        ? `${label} failed verification: ${validationError}`
        : `${label} failed verification`;
    case "uploaded":
      return missingFields.length > 0
        ? `${label} requires review: missing ${missingFields.join(", ")}`
        : `${label} uploaded but not yet verified`;
    case "missing":
    default:
      return `${label} is missing`;
  }
}

function buildDocumentSuggestions(documentType: SupportedDocumentType, document: ContractorDocument | null): string[] {
  const label = getDocumentTypeLabel(documentType);
  if (!document) {
    switch (documentType) {
      case "taxClearance":
        return ["Upload updated TCS certificate"];
      case "coida":
        return ["Upload current COIDA / Compensation Fund certificate"];
      case "bbbee":
        return ["Upload current B-BBEE certificate"];
      case "cipc":
        return ["Upload valid CIPC registration document"];
      case "bankConfirmation":
        return ["Upload bank confirmation letter"];
    }
  }

  if (documentType === "taxClearance" && document.taxSupportingOnly === true) {
    return ["Upload updated TCS certificate"];
  }

  const status = resolveContractorDocumentStatus(document);
  const labelLower = label.toLowerCase();
  const persistedSuggestions = asStringArray(document.suggestions);

  if (persistedSuggestions.length > 0) {
    return persistedSuggestions;
  }

  switch (status) {
    case "expiringSoon":
      return [`Renew ${labelLower} before expiry`];
    case "expired":
      return [`Renew ${labelLower} and upload the current document`];
    case "invalid":
      return [`Review ${labelLower} mismatch and upload a corrected document`];
    case "uploaded":
      return [`Upload a clearer ${labelLower} document for automatic verification`];
    case "missing":
      return [`Upload ${labelLower}`];
    case "verified":
    default:
      return [];
  }
}

function resolveRiskGrade(score: number, hasHardBlocker: boolean): ComplianceRiskGrade {
  const baseGrade: ComplianceRiskGrade =
    score >= 90 ? "LOW RISK" : score >= 75 ? "MODERATE RISK" : score >= 50 ? "REVIEW REQUIRED" : "HIGH RISK";

  if (!hasHardBlocker) {
    return baseGrade;
  }

  if (baseGrade === "LOW RISK" || baseGrade === "MODERATE RISK") {
    return "REVIEW REQUIRED";
  }

  return baseGrade;
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter((value) => value.trim().length > 0)));
}

export function buildContractorComplianceIntelligence(
  contractorId: string,
  documents: ContractorDocument[],
  summary: ContractorComplianceSummary,
): ContractorComplianceIntelligence {
  const documentBreakdown = SUPPORTED_DOCUMENT_TYPES.map((documentType) => {
    const bestDocument = pickBestDocument(documents, documentType);
    const status = bestDocument ? resolveContractorDocumentStatus(bestDocument) : "missing";
    const complianceScore = bestDocument ? getDocumentComplianceScore(bestDocument, status) : 0;
    const confidenceScore = bestDocument ? getDocumentConfidenceScore(bestDocument) : 0;
    const weight = DOCUMENT_WEIGHTS[documentType];
    const weightedScore = Math.round((complianceScore / 100) * weight);
    const reason = buildDocumentReason(documentType, bestDocument);
    const suggestions = buildDocumentSuggestions(documentType, bestDocument);
    const missingFields = bestDocument ? asStringArray(bestDocument.missingFields) : [];

    return {
      documentType,
      label: getDocumentTypeLabel(documentType),
      weight,
      status,
      weightedScore,
      complianceScore,
      confidenceScore,
      verified: bestDocument ? status === "verified" || status === "expiringSoon" : false,
      expiresAt: bestDocument?.expiresAt ?? null,
      reason,
      suggestions,
      missingFields,
      taxDocumentCategory: bestDocument?.taxDocumentCategory,
      taxDocumentPurpose: bestDocument?.taxDocumentPurpose,
      taxClassificationConfidence: bestDocument?.taxClassificationConfidence,
      taxComplianceCapable: bestDocument?.taxComplianceCapable,
      taxSupportingOnly: bestDocument?.taxSupportingOnly,
      readinessImpactReason: bestDocument?.readinessImpactReason ?? null,
    } satisfies ComplianceDocumentBreakdown;
  });

  const weightedComplianceTotal = documentBreakdown.reduce((sum, item) => sum + item.weightedScore, 0);
  const verifiedWeightTotal = documentBreakdown
    .filter((item) => item.verified)
    .reduce((sum, item) => sum + item.weight, 0);
  const confidenceScores = documentBreakdown
    .filter((item) => item.confidenceScore > 0)
    .map((item) => item.confidenceScore);
  const averageDocumentConfidence =
    confidenceScores.length > 0
      ? clampPercent(confidenceScores.reduce((sum, item) => sum + item, 0) / confidenceScores.length)
      : 0;

  const complianceConfidence = clampPercent(weightedComplianceTotal);
  const readinessConfidence = clampPercent(
    complianceConfidence * 0.45 +
      summary.readinessScore * 0.45 +
      ((verifiedWeightTotal / 100) * 100) * 0.1,
  );
  const operationalSubmissionConfidence = clampPercent(
    complianceConfidence * 0.5 +
      readinessConfidence * 0.3 +
      averageDocumentConfidence * 0.2,
  );

  const blockedReasons = uniqueStrings(
    documentBreakdown
      .map((item) => item.reason)
      .filter((value): value is string => typeof value === "string" && value.trim().length > 0),
  );
  const reviewRecommendations = uniqueStrings(documentBreakdown.flatMap((item) => item.suggestions));
  const missingCriticalDocuments = documentBreakdown
    .filter((item) => item.status === "missing" || item.status === "expired" || item.status === "invalid")
    .map((item) => item.documentType);
  const verifiedCriticalDocuments = documentBreakdown.filter((item) => item.verified).map((item) => item.documentType);
  const riskGrade = resolveRiskGrade(
    operationalSubmissionConfidence,
    summary.docsMissing > 0 || summary.expiredDocumentCount > 0,
  );

  const explainableSummary =
    blockedReasons.length === 0
      ? "Ready because all required compliance documents are verified and current."
      : `${summary.tenderLockStatus === "READY" ? "Review required because" : "Blocked because"} ${blockedReasons.join("; ")}`;

  const taxDocuments = documents.filter((document) => typeof document.taxDocumentCategory === "string");
  const taxDocumentCategories = taxDocuments.reduce<Partial<Record<NonNullable<ContractorDocument["taxDocumentCategory"]>, number>>>(
    (acc, document) => {
      const category = document.taxDocumentCategory;
      if (!category) {
        return acc;
      }

      acc[category] = (acc[category] ?? 0) + 1;
      return acc;
    },
    {},
  );
  const taxClassificationConfidenceAverage =
    taxDocuments.length > 0
      ? clampPercent(
          taxDocuments.reduce((sum, document) => sum + (document.taxClassificationConfidence ?? 0), 0) / taxDocuments.length,
        )
      : 0;
  const readinessImpactReasons = uniqueStrings(
    taxDocuments
      .map((document) => asString(document.readinessImpactReason))
      .filter((value): value is string => Boolean(value)),
  );

  const telemetry = {
    documentCount: documents.length,
    verifiedDocumentCount: documents.filter((document) => {
      const status = resolveContractorDocumentStatus(document);
      return status === "verified" || status === "expiringSoon";
    }).length,
    invalidDocumentCount: documents.filter((document) => resolveContractorDocumentStatus(document) === "invalid").length,
    expiredDocumentCount: documents.filter((document) => resolveContractorDocumentStatus(document) === "expired").length,
    expiringSoonCount: documents.filter((document) => resolveContractorDocumentStatus(document) === "expiringSoon").length,
    uploadedDocumentCount: documents.filter((document) => resolveContractorDocumentStatus(document) === "uploaded").length,
    ocrActivatedCount: documents.filter((document) => document.extractionMethod === "ocr").length,
    pdfTextDocumentCount: documents.filter((document) => document.extractionMethod === "pdf-parse").length,
    taxDocumentCategories,
    complianceCapableTaxDocumentCount: taxDocuments.filter((document) => document.taxComplianceCapable === true).length,
    supportingOnlyTaxDocumentCount: taxDocuments.filter((document) => document.taxSupportingOnly === true).length,
    taxClassificationConfidenceAverage,
    readinessImpactReasons,
  };

  console.log("[CONFIDENCE_SCORE]", {
    contractorId,
    complianceConfidence,
    readinessConfidence,
    operationalSubmissionConfidence,
    averageDocumentConfidence,
    weightedComplianceTotal,
    weightedBreakdown: documentBreakdown.map((item) => ({
      documentType: item.documentType,
      weight: item.weight,
      status: item.status,
      complianceScore: item.complianceScore,
      weightedScore: item.weightedScore,
    })),
  });

  console.log("[RISK_GRADE]", {
    contractorId,
    riskGrade,
    readinessStatus: summary.tenderLockStatus,
    docsMissing: summary.docsMissing,
    expiredDocumentCount: summary.expiredDocumentCount,
    expiringSoonCount: summary.expiringSoonCount,
  });

  console.log("[REVIEW_RECOMMENDATION]", {
    contractorId,
    blockedReasons,
    reviewRecommendations,
    explainableSummary,
  });

  return {
    complianceConfidence,
    readinessConfidence,
    operationalSubmissionConfidence,
    riskGrade,
    explainableSummary,
    blockedReasons,
    reviewRecommendations,
    missingCriticalDocuments,
    verifiedCriticalDocuments,
    averageDocumentConfidence,
    documentBreakdown,
    telemetry,
  };
}
