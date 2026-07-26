import {
  buildContractorRepositoryDecision,
  getContractorRepositoryStatusLabel,
  type ContractorRepositoryDecision,
} from "@/lib/contractors/contractorRepositoryDecision";
import {
  SUPPORTED_DOCUMENT_TYPES,
  type SupportedDocumentType,
} from "@/lib/compliance/contractorCompliance";
import type { ContractorDocument } from "@/types/document";

export type ContractorOnboardingReviewSummary = {
  status: "VALID" | "REVIEW_REQUIRED" | "BLOCKED" | "STALE" | "UNRESOLVED";
  documentReviewStatus: ContractorRepositoryDecision["documentReviewStatus"];
  requiredDocsApprovedCount: number;
  requiredDocsTotalCount: number;
  docsMissing: number;
  missingDocumentTypes: SupportedDocumentType[];
  reviewRequiredCount: number;
  expiredDocumentCount: number;
  expiringSoonCount: number;
  blockingReasons: string[];
};

export type ContractorOnboardingAssignmentSummary = {
  status: "ALLOWED" | "BLOCKED";
  assignmentAllowed: boolean;
  readinessDecisionStatus: ContractorRepositoryDecision["readinessDecisionStatus"];
  complianceDecisionStatus: ContractorRepositoryDecision["complianceDecisionStatus"];
  readinessScore: number | null;
  blockingReasons: string[];
  authority: "contractor-repository-decision";
};

export type ContractorOnboardingDecisionView = {
  readinessDecisionStatus: ContractorRepositoryDecision["readinessDecisionStatus"];
  complianceDecisionStatus: ContractorRepositoryDecision["complianceDecisionStatus"];
  readinessScore: number | null;
  documentCompletenessScore: number;
  documentReviewStatus: ContractorRepositoryDecision["documentReviewStatus"];
  assignmentAllowed: boolean;
  blockingReasons: string[];
  warnings: string[];
  identityStatus: ContractorRepositoryDecision["identityStatus"];
  identityMatchStatus: ContractorRepositoryDecision["identityMatchStatus"];
  externalVerificationStatus: string;
  csdValidationStatus: ContractorRepositoryDecision["csdValidationStatus"];
  registrationValidationStatus: ContractorRepositoryDecision["registrationValidationStatus"];
  stale: boolean;
  staleReasons: string[];
  evaluatedAt: string;
  logicVersion: string;
  overallStatus: string;
  documentSummary: ContractorRepositoryDecision["documentSummary"];
  reviewSummary: ContractorOnboardingReviewSummary;
  assignmentSummary: ContractorOnboardingAssignmentSummary;
  historicalDecision: ContractorRepositoryDecision["historicalDecision"];
};

function hasReviewRequiredEvidence(document: ContractorDocument): boolean {
  return Boolean(document.fileUrl) &&
    document.verified !== true &&
    (document.validationStatus === "REVIEW" ||
      document.manualDecisionAvailable === true ||
      document.aiStatus === "failed" ||
      document.extractionSource === "EMPTY" ||
      document.status === "uploaded");
}

function buildReviewSummary(
  decision: ContractorRepositoryDecision,
  documents: ContractorDocument[],
): ContractorOnboardingReviewSummary {
  const reviewRequiredCount = documents.filter(hasReviewRequiredEvidence).length;
  const requiredDocsApprovedCount = SUPPORTED_DOCUMENT_TYPES.length - decision.documentSummary.docsMissing;
  const status =
    decision.stale ? "STALE"
      : decision.identityStatus === "UNRESOLVED" ? "UNRESOLVED"
        : reviewRequiredCount > 0 ? "REVIEW_REQUIRED"
          : decision.documentReviewStatus;

  return {
    status,
    documentReviewStatus: decision.documentReviewStatus,
    requiredDocsApprovedCount,
    requiredDocsTotalCount: SUPPORTED_DOCUMENT_TYPES.length,
    docsMissing: decision.documentSummary.docsMissing,
    missingDocumentTypes: decision.documentSummary.missingDocumentTypes,
    reviewRequiredCount,
    expiredDocumentCount: decision.documentSummary.expiredDocumentCount,
    expiringSoonCount: decision.documentSummary.expiringSoonCount,
    blockingReasons: decision.blockingReasons,
  };
}

function buildAssignmentSummary(decision: ContractorRepositoryDecision): ContractorOnboardingAssignmentSummary {
  return {
    status: decision.assignmentAllowed === true ? "ALLOWED" : "BLOCKED",
    assignmentAllowed: decision.assignmentAllowed === true,
    readinessDecisionStatus: decision.readinessDecisionStatus,
    complianceDecisionStatus: decision.complianceDecisionStatus,
    readinessScore: decision.readinessScore,
    blockingReasons: decision.assignmentAllowed === true ? [] : decision.blockingReasons,
    authority: "contractor-repository-decision",
  };
}

export function buildContractorOnboardingDecisionView(input: {
  contractor: Record<string, unknown>;
  documents: ContractorDocument[];
  evaluatedAt?: string;
}): ContractorOnboardingDecisionView {
  const decision = buildContractorRepositoryDecision(input);

  return {
    readinessDecisionStatus: decision.readinessDecisionStatus,
    complianceDecisionStatus: decision.complianceDecisionStatus,
    readinessScore: decision.readinessScore,
    documentCompletenessScore: decision.documentCompletenessScore,
    documentReviewStatus: decision.documentReviewStatus,
    assignmentAllowed: decision.assignmentAllowed,
    blockingReasons: decision.blockingReasons,
    warnings: decision.warnings,
    identityStatus: decision.identityStatus,
    identityMatchStatus: decision.identityMatchStatus,
    externalVerificationStatus: decision.externalVerificationStatus,
    csdValidationStatus: decision.csdValidationStatus,
    registrationValidationStatus: decision.registrationValidationStatus,
    stale: decision.stale,
    staleReasons: decision.staleReasons,
    evaluatedAt: decision.evaluatedAt,
    logicVersion: decision.logicVersion,
    overallStatus: getContractorRepositoryStatusLabel(decision),
    documentSummary: decision.documentSummary,
    reviewSummary: buildReviewSummary(decision, input.documents),
    assignmentSummary: buildAssignmentSummary(decision),
    historicalDecision: decision.historicalDecision,
  };
}
