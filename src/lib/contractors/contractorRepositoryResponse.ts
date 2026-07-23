import type { ContractorSelectorOption } from "@/lib/contractors/contractorSelectorOptions";

export type PublicContractorRepositoryItem = {
  id: unknown;
  contractorId: unknown;
  workspaceId: unknown;
  companyName: unknown;
  tradingName: unknown;
  contractorReference: unknown;
  registrationNumber: unknown;
  csdNumber: unknown;
  status: unknown;
  identityStatus: unknown;
  identityResolved: unknown;
  identityMatchStatus: unknown;
  documentCompletenessScore: unknown;
  complianceDecisionStatus: unknown;
  readinessScore: unknown;
  readinessDecisionStatus: unknown;
  assignmentAllowed: unknown;
  blockingReasons: unknown;
  externalVerificationStatus: unknown;
  csdValidationStatus: unknown;
  evaluatedAt: unknown;
  logicVersion: unknown;
  stale: unknown;
  historicalDecision: unknown;
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
    companyName: str(record.companyName),
    tradingName: str(record.tradingName),
    contractorReference: str(record.contractorReference),
    registrationNumber: str(record.registrationNumber),
    csdNumber: str(record.csdNumber),
    status: str(record.status),
    identityStatus: str(record.identityStatus),
    identityResolved: record.identityResolved === true,
    identityMatchStatus: str(record.identityMatchStatus),
    documentCompletenessScore: num(record.documentCompletenessScore),
    complianceDecisionStatus: str(record.complianceDecisionStatus),
    readinessScore: num(record.readinessScore),
    readinessDecisionStatus: str(record.readinessDecisionStatus),
    assignmentAllowed: bool(record.assignmentAllowed),
    blockingReasons: stringArray(record.blockingReasons),
    externalVerificationStatus: str(record.externalVerificationStatus),
    csdValidationStatus: str(record.csdValidationStatus),
    evaluatedAt: str(record.evaluatedAt),
    logicVersion: str(record.logicVersion),
    stale: bool(record.stale),
    historicalDecision: record.historicalDecision ?? null,
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
