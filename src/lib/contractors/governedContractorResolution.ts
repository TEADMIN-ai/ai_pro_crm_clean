export type ContractorIdentityRecord = {
  id: string;
  legalName?: string | null;
  tradingName?: string | null;
  registrationNumber?: string | null;
  companyRegistrationNumber?: string | null;
  csdNumber?: string | null;
  csdMNumber?: string | null;
  workspaceId?: string | null;
};

export type ContractorResolution = {
  status: "RESOLVED" | "REVIEW_REQUIRED" | "UNRESOLVED";
  contractorId: string | null;
  candidateIds: string[];
  reason: string;
};

export type GovernedComplianceEvidence = {
  complianceType?: string | null;
  documentId?: string | null;
  verificationStatus?: string | null;
  currentStatus?: string | null;
  issueDate?: string | number | null;
  expiryDate?: string | number | null;
};

export type ContractorReadiness = {
  status: "READY" | "BLOCKED" | "REVIEW_REQUIRED";
  blockers: string[];
  evidenceDocumentIds: string[];
};

const text = (value: unknown) => typeof value === "string" ? value.trim() : "";
const identityKey = (value: unknown) => text(value).toLowerCase().replace(/[^a-z0-9]+/g, "");
const identifierKey = (value: unknown) => text(value).toUpperCase().replace(/\s+/g, "");

export function resolveCanonicalContractor(input: {
  reference?: string | null;
  registrationNumber?: string | null;
  csdNumber?: string | null;
  legalName?: string | null;
  tradingName?: string | null;
  workspaceId: string;
  records: ContractorIdentityRecord[];
}): ContractorResolution {
  const records = input.records.filter((record) => !record.workspaceId || record.workspaceId === input.workspaceId);
  if (input.reference) {
    const matches = records.filter((record) => record.id === input.reference);
    if (matches.length === 1) return { status: "RESOLVED", contractorId: matches[0].id, candidateIds: [matches[0].id], reason: "Canonical Contractor_ID matched." };
    if (matches.length > 1) return { status: "REVIEW_REQUIRED", contractorId: null, candidateIds: matches.map((record) => record.id), reason: "Multiple canonical contractors match the supplied reference." };
  }

  const registration = identifierKey(input.registrationNumber);
  const csd = identifierKey(input.csdNumber);
  const identifierMatches = records.filter((record) => {
    const registrationMatch = registration && [record.registrationNumber, record.companyRegistrationNumber].map(identifierKey).includes(registration);
    const csdMatch = csd && [record.csdNumber, record.csdMNumber].map(identifierKey).includes(csd);
    return Boolean(registrationMatch || csdMatch);
  });
  if (identifierMatches.length === 1) return { status: "RESOLVED", contractorId: identifierMatches[0].id, candidateIds: [identifierMatches[0].id], reason: "Authoritative business identifier matched." };
  if (identifierMatches.length > 1) return { status: "REVIEW_REQUIRED", contractorId: null, candidateIds: identifierMatches.map((record) => record.id), reason: "Multiple contractors match the supplied business identifiers." };

  const names = [identityKey(input.legalName), identityKey(input.tradingName)].filter(Boolean);
  const nameMatches = records.filter((record) => [record.legalName, record.tradingName].map(identityKey).some((value) => names.includes(value)));
  if (nameMatches.length === 1 && (registration || csd)) return { status: "RESOLVED", contractorId: nameMatches[0].id, candidateIds: [nameMatches[0].id], reason: "Trusted business identity matched." };
  if (nameMatches.length > 1 || nameMatches.length === 1) return { status: "REVIEW_REQUIRED", contractorId: null, candidateIds: nameMatches.map((record) => record.id), reason: "Name-only contractor identity requires review." };
  return { status: "UNRESOLVED", contractorId: null, candidateIds: [], reason: "No canonical contractor identity match." };
}

function verified(value: GovernedComplianceEvidence): boolean {
  return [value.verificationStatus, value.currentStatus].some((status) => ["VERIFIED", "VERIFIED_MANUAL", "CURRENT", "VALID"].includes(text(status).toUpperCase()));
}

function current(value: GovernedComplianceEvidence, now: Date): boolean {
  const expiry = value.expiryDate == null ? null : typeof value.expiryDate === "number" ? value.expiryDate : Date.parse(String(value.expiryDate));
  return expiry == null || !Number.isFinite(expiry) || expiry > now.getTime();
}

export function evaluateContractorReadiness(input: {
  evidence: GovernedComplianceEvidence[];
  requiredTypes: string[];
  now?: Date;
  csdMaxAgeDays?: number | null;
}): ContractorReadiness {
  const now = input.now ?? new Date();
  const blockers: string[] = [];
  const evidenceDocumentIds: string[] = [];
  for (const type of input.requiredTypes) {
    const normalized = type.toUpperCase();
    const matches = input.evidence.filter((item) => text(item.complianceType).toUpperCase() === normalized);
    const accepted = matches.find((item) => item.documentId && verified(item) && current(item, now));
    if (!accepted) {
      if (!matches.some((item) => item.documentId)) blockers.push(`${normalized}_EVIDENCE_MISSING`);
      else if (matches.some((item) => !current(item, now))) blockers.push(`${normalized}_EVIDENCE_EXPIRED`);
      else blockers.push(`${normalized}_EVIDENCE_UNVERIFIED`);
      continue;
    }
    evidenceDocumentIds.push(accepted.documentId as string);
    if (normalized === "CSD" && input.csdMaxAgeDays != null) {
      const issue = accepted.issueDate == null ? null : typeof accepted.issueDate === "number" ? accepted.issueDate : Date.parse(String(accepted.issueDate));
      if (issue == null || !Number.isFinite(issue) || now.getTime() - issue > input.csdMaxAgeDays * 24 * 60 * 60 * 1000) blockers.push("CSD_EVIDENCE_TOO_OLD");
    }
  }
  return { status: blockers.length ? "BLOCKED" : "READY", blockers, evidenceDocumentIds };
}
