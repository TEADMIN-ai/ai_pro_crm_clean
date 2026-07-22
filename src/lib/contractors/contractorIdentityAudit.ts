import {
  cleanContractorIdentityText,
  hasResolvedContractorBusinessIdentity,
  looksLikePersonalContractorIdentity,
  looksLikePlaceholderContractorIdentity,
  resolveContractorBusinessIdentity,
} from "@/lib/contractors/contractorBusinessIdentity";

export type ContractorIdentityAuditRisk = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export type ContractorIdentityAuditRecord = {
  contractorId: string;
  risk: ContractorIdentityAuditRisk;
  reasons: string[];
  evidence: Record<string, unknown>;
  linkedUsers: string[];
  workspaceId: string | null;
  recommendations: string[];
  assignments: string[];
  allowedByAllowlist: boolean;
};

export type ContractorIdentityAuditReport = {
  mode: "dry-run";
  generatedAt: string;
  logicVersion: string;
  summary: {
    contractorsReviewed: number;
    suspectRecords: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  records: ContractorIdentityAuditRecord[];
  humanReadable: string;
};

type AuditInput = {
  contractors: Array<Record<string, unknown> & { id?: string }>;
  users?: Array<Record<string, unknown> & { id?: string }>;
  recommendations?: Array<Record<string, unknown> & { id?: string }>;
  assignments?: Array<Record<string, unknown> & { id?: string }>;
  allowlist?: string[];
  generatedAt?: string;
};

function str(value: unknown): string | null {
  return cleanContractorIdentityText(value);
}

function norm(value: unknown): string | null {
  const text = str(value);
  return text ? text.toLowerCase().replace(/[^a-z0-9]+/g, "") : null;
}

function contractorId(record: Record<string, unknown> & { id?: string }): string {
  return str(record.contractorId) ?? str(record.id) ?? "UNKNOWN_CONTRACTOR";
}

function identityValues(record: Record<string, unknown>): string[] {
  return [record.legalName, record.tradingName, record.registeredBusinessName, record.businessName, record.companyName, record.name]
    .map(str)
    .filter((value): value is string => Boolean(value));
}

function riskRank(risk: ContractorIdentityAuditRisk): number {
  return risk === "CRITICAL" ? 4 : risk === "HIGH" ? 3 : risk === "MEDIUM" ? 2 : 1;
}

function addReason(reasons: string[], reason: string) {
  if (!reasons.includes(reason)) reasons.push(reason);
}

function linkedUsers(input: AuditInput, record: Record<string, unknown>): string[] {
  const ids = [record.linkedUserId, record.authUid, record.userId, record.uid].map(str).filter((value): value is string => Boolean(value));
  const byContractorId = contractorId(record);
  for (const user of input.users ?? []) {
    if (str(user.contractorId) === byContractorId) ids.push(str(user.id) ?? str(user.uid) ?? "UNKNOWN_USER");
  }
  return Array.from(new Set(ids));
}

function relatedIds(items: AuditInput["assignments"], id: string): string[] {
  return (items ?? [])
    .filter((item) => [item.contractorId, item.assignedContractorId, item.linkedContractorId].map(str).includes(id))
    .map((item) => str(item.id) ?? str(item.dealId) ?? str(item.opportunityId) ?? "UNKNOWN_REFERENCE");
}

function classify(input: AuditInput, record: Record<string, unknown> & { id?: string }): ContractorIdentityAuditRecord | null {
  const id = contractorId(record);
  const reasons: string[] = [];
  const values = identityValues(record);
  const ids = [record.contractorId, record.id, record.uid, record.authUid, record.userId].map(norm).filter(Boolean);
  const emails = [record.email, record.contactEmail].flatMap((value) => {
    const email = str(value);
    return email ? [norm(email), norm(email.split("@")[0])] : [];
  }).filter(Boolean);

  for (const value of values) {
    const normalized = norm(value);
    if (looksLikePlaceholderContractorIdentity(value)) addReason(reasons, "placeholder business identity");
    if (looksLikePersonalContractorIdentity(value)) addReason(reasons, "personal-name-only business identity");
    if (normalized && ids.includes(normalized)) addReason(reasons, "business identity equals technical identifier");
    if (normalized && emails.includes(normalized)) addReason(reasons, "business identity equals email evidence");
  }

  const decision = resolveContractorBusinessIdentity(record);
  if (!values.length) addReason(reasons, "missing business identity evidence");
  if (record.identityResolved !== true) addReason(reasons, "missing identityResolved true evidence");
  if (record.identityResolved === true && !decision.identityResolved) addReason(reasons, "identityResolved true without verified business evidence");
  if (!hasResolvedContractorBusinessIdentity(record)) addReason(reasons, "canonical identity helper does not resolve record");
  if (!str(record.workspaceId)) addReason(reasons, "missing workspace evidence");
  if (["admin", "staff", "manager"].includes(String(record.role ?? record.userRole ?? "").toLowerCase())) addReason(reasons, "staff/admin-linked contractor record");
  if (decision.status === "CONFLICT") addReason(reasons, "conflicting business identity evidence");

  if (!reasons.length) return null;

  const risk: ContractorIdentityAuditRisk =
    reasons.some((reason) => /identityResolved true|technical identifier|email evidence|conflicting|staff/.test(reason))
      ? "CRITICAL"
      : reasons.some((reason) => /personal-name|placeholder|missing business/.test(reason))
        ? "HIGH"
        : !str(record.workspaceId)
          ? "MEDIUM"
          : "LOW";

  return {
    contractorId: id,
    risk,
    reasons,
    evidence: {
      identityValues: values,
      identityResolved: record.identityResolved ?? null,
      identityStatus: record.identityStatus ?? record.identityResolutionStatus ?? null,
      workspaceId: str(record.workspaceId),
      linkedUserId: str(record.linkedUserId ?? record.authUid ?? record.userId),
    },
    linkedUsers: linkedUsers(input, record),
    workspaceId: str(record.workspaceId),
    recommendations: relatedIds(input.recommendations, id),
    assignments: relatedIds(input.assignments, id),
    allowedByAllowlist: (input.allowlist ?? []).includes(id),
  };
}

export function auditContractorIdentityRecords(input: AuditInput): ContractorIdentityAuditReport {
  const records = input.contractors
    .map((record) => classify(input, record))
    .filter((record): record is ContractorIdentityAuditRecord => Boolean(record))
    .sort((left, right) => riskRank(right.risk) - riskRank(left.risk) || left.contractorId.localeCompare(right.contractorId));

  const count = (risk: ContractorIdentityAuditRisk) => records.filter((record) => record.risk === risk).length;
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const humanReadable = [
    "# Contractor Identity Audit",
    "",
    `Mode: dry-run`,
    `Generated: ${generatedAt}`,
    `Reviewed: ${input.contractors.length}`,
    `Suspect records: ${records.length}`,
    "",
    ...records.map((record) => `- ${record.risk} ${record.contractorId}: ${record.reasons.join("; ")}`),
  ].join("\n");

  return {
    mode: "dry-run",
    generatedAt,
    logicVersion: "contractor-identity-audit-v1",
    summary: {
      contractorsReviewed: input.contractors.length,
      suspectRecords: records.length,
      critical: count("CRITICAL"),
      high: count("HIGH"),
      medium: count("MEDIUM"),
      low: count("LOW"),
    },
    records,
    humanReadable,
  };
}
