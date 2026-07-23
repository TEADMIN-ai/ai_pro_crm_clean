import type { ContractorSelectorOption } from "@/lib/contractors/contractorSelectorOptions";

export type PublicContractorRepositoryItem = {
  id: string | null;
  contractorId: string | null;
  workspaceId: string | null;
  readinessScore: number | null;
  readinessDecisionStatus: string | null;
  assignmentAllowed: boolean;
  identityStatus: string | null;
  identityMatchStatus: string | null;
  csdValidationStatus: string | null;
  externalVerificationStatus: string | null;
  historicalDecision: unknown;
  [key: string]: unknown;
};

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function bool(value: unknown): boolean {
  return value === true;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export function serializePublicContractor(record: Record<string, unknown>): PublicContractorRepositoryItem {
  return {
    id: str(record.id),
    contractorId: str(record.contractorId),
    workspaceId: str(record.workspaceId),
    workspaceSlug: str(record.workspaceSlug),
    archived: bool(record.archived),
    archivedAt: record.archivedAt ?? null,
    archiveReason: str(record.archiveReason),
    companyName: str(record.companyName),
    businessName: str(record.businessName),
    legalName: str(record.legalName),
    tradingName: str(record.tradingName),
    name: str(record.name),
    status: str(record.status),
    createdAt: record.createdAt ?? null,
    updatedAt: record.updatedAt ?? null,
    lastDocumentUpdateAt: record.lastDocumentUpdateAt ?? null,
    registrationNumber: str(record.registrationNumber),
    companyRegistrationNumber: str(record.companyRegistrationNumber),
    csdNumber: str(record.csdNumber),
    csdMNumber: str(record.csdMNumber),
    mNumber: str(record.mNumber),
    teosContractorReference: str(record.teosContractorReference),
    contractorReference: str(record.contractorReference),
    contractorNumber: str(record.contractorNumber),
    businessReference: str(record.businessReference),
    readinessScore: num(record.readinessScore),
    readinessStatus: str(record.readinessStatus),
    readinessDecisionStatus: str(record.readinessDecisionStatus),
    complianceStatusScore: num(record.complianceStatusScore),
    complianceStatus: str(record.complianceStatus),
    complianceDecisionStatus: str(record.complianceDecisionStatus),
    documentCompletenessScore: num(record.documentCompletenessScore),
    documentReviewStatus: str(record.documentReviewStatus),
    externalVerificationStatus: str(record.externalVerificationStatus),
    identityMatchStatus: str(record.identityMatchStatus),
    identityStatus: str(record.identityStatus),
    assignmentAllowed: bool(record.assignmentAllowed),
    blockingReasons: stringArray(record.blockingReasons),
    warnings: stringArray(record.warnings),
    evaluatedAt: str(record.evaluatedAt),
    logicVersion: str(record.logicVersion),
    stale: bool(record.stale),
    staleReasons: stringArray(record.staleReasons),
    csdValidationStatus: str(record.csdValidationStatus),
    registrationValidationStatus: str(record.registrationValidationStatus),
    historicalDecision: record.historicalDecision ?? null,
    docsMissing: num(record.docsMissing),
    missingDocumentTypes: stringArray(record.missingDocumentTypes),
    tenderLockStatus: str(record.tenderLockStatus),
    isTenderLocked: bool(record.isTenderLocked),
    requiredDocsApprovedCount: num(record.requiredDocsApprovedCount),
    requiredDocsTotalCount: num(record.requiredDocsTotalCount),
    reviewRequiredCount: num(record.reviewRequiredCount),
    overallStatus: str(record.overallStatus),
    complianceApproved: bool(record.complianceApproved),
    taxPinStatus: str(record.taxPinStatus),
    csdStatus: str(record.csdStatus),
    recordClassification: str(record.recordClassification),
  };
}

export function serializePublicContractors(records: Array<Record<string, unknown>>): PublicContractorRepositoryItem[] {
  return records.map(serializePublicContractor);
}

export function serializePublicContractorSelectorOptions(options: ContractorSelectorOption[]): ContractorSelectorOption[] {
  return options.map((option) => ({
    contractorId: option.contractorId,
    legalName: option.legalName,
    tradingName: option.tradingName,
    registeredBusinessName: option.registeredBusinessName,
    workspaceId: option.workspaceId,
    linkedUserId: option.linkedUserId,
    status: option.status,
    identityResolved: true,
    label: option.label,
  }));
}
