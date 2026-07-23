import { resolveContractorBusinessIdentity } from "@/lib/contractors/contractorBusinessIdentity";
import { calculateContractorCompliance, type ContractorComplianceSummary } from "@/lib/compliance/contractorCompliance";
import { buildSarsTcsProjection, type SarsTcsVerificationRecord } from "@/lib/sars-tcs";
import type { ContractorDocument } from "@/types/document";

export const CONTRACTOR_REPOSITORY_DECISION_LOGIC_VERSION = "contractor-repository-decision-v1";

export type ContractorDecisionStatus = "VALID" | "BLOCKED" | "UNRESOLVED" | "STALE";
export type ContractorIdentityMatchStatus = "MATCH" | "CONFLICT" | "UNRESOLVED";
export type BusinessIdentifierStatus = "VALID" | "INVALID" | "UNRESOLVED";

export type ContractorRepositoryDecision = {
  documentCompletenessScore: number;
  documentReviewStatus: ContractorDecisionStatus;
  externalVerificationStatus: string;
  identityMatchStatus: ContractorIdentityMatchStatus;
  identityStatus: "VERIFIED" | "CONFLICT" | "UNRESOLVED";
  complianceDecisionStatus: ContractorDecisionStatus;
  readinessDecisionStatus: "READY" | "BLOCKED" | "UNRESOLVED" | "STALE";
  readinessScore: number | null;
  assignmentAllowed: boolean;
  blockingReasons: string[];
  warnings: string[];
  evaluatedAt: string;
  logicVersion: string;
  stale: boolean;
  staleReasons: string[];
  csdValidationStatus: BusinessIdentifierStatus;
  registrationValidationStatus: BusinessIdentifierStatus;
  documentSummary: ContractorComplianceSummary;
  historicalDecision: {
    readinessScore: unknown;
    readinessStatus: unknown;
    complianceStatus: unknown;
    overallStatus: unknown;
    complianceApproved: unknown;
    evaluatedAt: unknown;
    logicVersion: unknown;
  };
};

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function norm(value: unknown): string {
  return str(value)?.toLowerCase().replace(/[^a-z0-9]+/g, "") ?? "";
}

function toMillis(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  if (value && typeof value === "object" && "toMillis" in value && typeof value.toMillis === "function") {
    const parsed = value.toMillis();
    return typeof parsed === "number" && Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function latestEvidenceMillis(contractor: Record<string, unknown>, documents: ContractorDocument[]): number | null {
  const values = [
    contractor.updatedAt,
    contractor.sarsTcsSummary && typeof contractor.sarsTcsSummary === "object"
      ? (contractor.sarsTcsSummary as Record<string, unknown>).updatedAt
      : null,
    ...documents.flatMap((document) => [
      document.updatedAt,
      document.uploadedAt,
      document.verifiedAt,
      document.extractedAt,
      document.createdAt,
    ]),
  ]
    .map(toMillis)
    .filter((value): value is number => typeof value === "number");
  return values.length ? Math.max(...values) : null;
}

export function validateCsdSupplierNumber(value: unknown): BusinessIdentifierStatus {
  const candidate = str(value);
  if (!candidate) return "UNRESOLVED";
  const normalized = candidate.toUpperCase().replace(/\s+/g, "");
  if (/^(UNKNOWN|N\/A|NA|NONE|NULL|UNDEFINED|MISREPRESENT|TEST|PLACEHOLDER|CSD)$/.test(normalized)) return "INVALID";
  if (candidate.includes("@")) return "INVALID";
  return /^MAAA\d{6,}$/.test(normalized) ? "VALID" : "UNRESOLVED";
}

export function validateCipcRegistrationNumber(value: unknown): BusinessIdentifierStatus {
  const candidate = str(value);
  if (!candidate) return "UNRESOLVED";
  const normalized = candidate.toUpperCase().replace(/\s+/g, "");
  if (/^(UNKNOWN|N\/A|NA|NONE|NULL|UNDEFINED|MISREPRESENT|TEST|PLACEHOLDER)$/.test(normalized)) return "INVALID";
  return /^\d{4}\/\d{6}\/\d{2}$/.test(candidate) ? "VALID" : "UNRESOLVED";
}

function resolveIdentityMatch(contractor: Record<string, unknown>): {
  identityStatus: ContractorRepositoryDecision["identityStatus"];
  identityMatchStatus: ContractorIdentityMatchStatus;
  blockers: string[];
  warnings: string[];
} {
  const identity = resolveContractorBusinessIdentity(contractor);
  const taxpayerName = str(contractor.taxpayerName)
    ?? (contractor.sarsTcsSummary && typeof contractor.sarsTcsSummary === "object"
      ? str((contractor.sarsTcsSummary as Record<string, unknown>).registeredTaxpayerName)
      : null);
  const label = identity.label;

  if (identity.status === "CONFLICT") {
    return {
      identityStatus: "CONFLICT",
      identityMatchStatus: "CONFLICT",
      blockers: ["Contractor business identity evidence is conflicting"],
      warnings: identity.warnings,
    };
  }

  if (!identity.identityResolved || !label) {
    if (taxpayerName && identity.warnings.some((warning) => warning.includes("personal profile") || warning.includes("personal name"))) {
      return {
        identityStatus: "CONFLICT",
        identityMatchStatus: "CONFLICT",
        blockers: ["SARS taxpayer name does not match contractor business identity"],
        warnings: identity.warnings,
      };
    }

    return {
      identityStatus: "UNRESOLVED",
      identityMatchStatus: "UNRESOLVED",
      blockers: ["Contractor business identity is unresolved"],
      warnings: identity.warnings,
    };
  }

  if (taxpayerName && norm(taxpayerName) !== norm(label)) {
    return {
      identityStatus: "CONFLICT",
      identityMatchStatus: "CONFLICT",
      blockers: ["SARS taxpayer name does not match contractor business identity"],
      warnings: identity.warnings,
    };
  }

  return { identityStatus: "VERIFIED", identityMatchStatus: taxpayerName ? "MATCH" : "UNRESOLVED", blockers: [], warnings: identity.warnings };
}

export function buildContractorRepositoryDecision(input: {
  contractor: Record<string, unknown>;
  documents: ContractorDocument[];
  evaluatedAt?: string;
}): ContractorRepositoryDecision {
  const evaluatedAt = input.evaluatedAt ?? new Date().toISOString();
  const summary = calculateContractorCompliance(input.documents);
  const identity = resolveIdentityMatch(input.contractor);
  const sarsRecord = input.contractor.sarsTcsSummary && typeof input.contractor.sarsTcsSummary === "object"
    ? input.contractor.sarsTcsSummary as SarsTcsVerificationRecord
    : null;
  const taxDocumentStatus = summary.missingDocumentTypes.includes("taxClearance") ? "missing" : "verified";
  const sarsProjection = buildSarsTcsProjection({
    record: sarsRecord,
    taxDocumentStatus,
    requiresLiveVerification: true,
    now: new Date(evaluatedAt),
  });
  const csdValue = str(input.contractor.csdNumber) ?? str(input.contractor.csdMNumber) ?? str(input.contractor.mNumber);
  const registrationValue = str(input.contractor.companyRegistrationNumber) ?? str(input.contractor.registrationNumber);
  const csdValidationStatus = validateCsdSupplierNumber(csdValue);
  const registrationValidationStatus = validateCipcRegistrationNumber(registrationValue);
  const storedEvaluatedAt = input.contractor.decisionEvaluatedAt ?? input.contractor.readinessUpdatedAt;
  const storedLogicVersion = input.contractor.decisionLogicVersion ?? input.contractor.logicVersion;
  const storedEvaluationMillis = toMillis(storedEvaluatedAt);
  const evidenceMillis = latestEvidenceMillis(input.contractor, input.documents);
  const staleReasons = [
    ...(!storedEvaluationMillis ? ["Stored readiness/compliance summary has no evaluation timestamp"] : []),
    ...(storedLogicVersion !== CONTRACTOR_REPOSITORY_DECISION_LOGIC_VERSION ? ["Stored readiness/compliance summary has missing or outdated logic version"] : []),
    ...(storedEvaluationMillis && evidenceMillis && evidenceMillis > storedEvaluationMillis ? ["Evidence is newer than stored readiness/compliance summary"] : []),
  ];
  const documentReviewStatus: ContractorDecisionStatus =
    summary.docsMissing > 0 || summary.expiredDocumentCount > 0 ? "BLOCKED" : "VALID";
  const blockingReasons = Array.from(new Set([
    ...identity.blockers,
    ...sarsProjection.sarsVerificationBlockers,
    ...(csdValidationStatus !== "VALID" ? ["CSD supplier number is not verified as valid"] : []),
    ...(registrationValidationStatus === "INVALID" ? ["CIPC registration number is invalid"] : []),
    ...(summary.docsMissing > 0 ? summary.missingDocumentTypes.map((type) => `${type} document is missing or unverified`) : []),
    ...(summary.expiredDocumentCount > 0 ? ["One or more compliance documents are expired"] : []),
    ...staleReasons,
  ]));
  const stale = staleReasons.length > 0;
  const compliant =
    blockingReasons.length === 0 &&
    identity.identityStatus === "VERIFIED" &&
    documentReviewStatus === "VALID" &&
    sarsProjection.sarsVerificationStatus === "VERIFIED_COMPLIANT" &&
    sarsProjection.evidenceAvailable &&
    csdValidationStatus === "VALID";
  const readinessDecisionStatus = compliant ? "READY" : identity.identityStatus === "UNRESOLVED" ? "UNRESOLVED" : stale ? "STALE" : "BLOCKED";

  return {
    documentCompletenessScore: summary.readinessScore,
    documentReviewStatus,
    externalVerificationStatus: sarsProjection.sarsVerificationStatus,
    identityMatchStatus: identity.identityMatchStatus,
    identityStatus: identity.identityStatus,
    complianceDecisionStatus: compliant ? "VALID" : stale ? "STALE" : identity.identityStatus === "UNRESOLVED" ? "UNRESOLVED" : "BLOCKED",
    readinessDecisionStatus,
    readinessScore: readinessDecisionStatus === "READY" ? summary.readinessScore : null,
    assignmentAllowed: readinessDecisionStatus === "READY",
    blockingReasons,
    warnings: identity.warnings,
    evaluatedAt,
    logicVersion: CONTRACTOR_REPOSITORY_DECISION_LOGIC_VERSION,
    stale,
    staleReasons,
    csdValidationStatus,
    registrationValidationStatus,
    documentSummary: summary,
    historicalDecision: {
      readinessScore: input.contractor.readinessScore ?? null,
      readinessStatus: input.contractor.readinessStatus ?? null,
      complianceStatus: input.contractor.complianceStatus ?? null,
      overallStatus: input.contractor.overallStatus ?? null,
      complianceApproved: input.contractor.complianceApproved ?? null,
      evaluatedAt: storedEvaluatedAt ?? null,
      logicVersion: storedLogicVersion ?? null,
    },
  };
}
