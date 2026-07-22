import { cleanContractorIdentityText, hasResolvedContractorBusinessIdentity, looksLikePersonalContractorIdentity } from "@/lib/contractors/contractorBusinessIdentity";

export type ContractorSelectorOption = {
  contractorId: string;
  legalName: string | null;
  tradingName: string | null;
  registeredBusinessName: string | null;
  workspaceId: string;
  linkedUserId: string | null;
  status: string;
  identityResolved: true;
  label: string;
};

function clean(value: unknown): string | null {
  return cleanContractorIdentityText(value);
}

function normalized(value: unknown): string {
  return clean(value)?.toLowerCase() ?? "";
}

function hasBadStatus(record: Record<string, unknown>): boolean {
  const status = normalized(record.status);
  return record.archived === true || Boolean(clean(record.archivedAt)) || ["archived", "deleted", "suspended", "inactive"].includes(status);
}

function isStaffOnlyRecord(record: Record<string, unknown>): boolean {
  const role = normalized(record.role ?? record.userRole ?? record.accountRole);
  return ["admin", "manager", "staff", "viewer"].includes(role) && !clean(record.contractorId);
}

function looksLikePersonalName(value: string): boolean {
  return looksLikePersonalContractorIdentity(value);
}

function businessNameFrom(record: Record<string, unknown>): {
  legalName: string | null;
  tradingName: string | null;
  registeredBusinessName: string | null;
  label: string | null;
} {
  const legalName = clean(record.legalName);
  const tradingName = clean(record.tradingName);
  const registeredBusinessName = clean(record.registeredBusinessName) ?? clean(record.businessName) ?? clean(record.companyName);
  const label = legalName ?? tradingName ?? registeredBusinessName;
  return { legalName, tradingName, registeredBusinessName, label };
}

function identityResolved(record: Record<string, unknown>): boolean {
  return hasResolvedContractorBusinessIdentity(record);
}

export function buildContractorSelectorOption(record: Record<string, unknown>): ContractorSelectorOption | null {
  const contractorId = clean(record.contractorId);
  const workspaceId = clean(record.workspaceId);
  const status = clean(record.status) ?? "UNKNOWN";
  const names = businessNameFrom(record);

  if (!contractorId || !workspaceId || hasBadStatus(record) || isStaffOnlyRecord(record)) return null;
  if (!identityResolved(record)) return null;
  if (!names.label || looksLikePersonalName(names.label)) return null;

  return {
    contractorId,
    legalName: names.legalName,
    tradingName: names.tradingName,
    registeredBusinessName: names.registeredBusinessName,
    workspaceId,
    linkedUserId: clean(record.linkedUserId) ?? clean(record.authUid) ?? clean(record.userId),
    status,
    identityResolved: true,
    label: names.label,
  };
}

export function buildContractorSelectorOptions(records: Array<Record<string, unknown>>): ContractorSelectorOption[] {
  return records.flatMap((record) => {
    const option = buildContractorSelectorOption(record);
    return option ? [option] : [];
  });
}
