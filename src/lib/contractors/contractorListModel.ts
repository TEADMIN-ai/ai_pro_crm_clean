export interface ContractorListItem {
  id: string;
  contractorId?: string;
  archived?: boolean | null;
  archivedAt?: string | number | null;
  archiveReason?: string | null;
  companyName?: string | null;
  businessName?: string | null;
  legalName?: string | null;
  tradingName?: string | null;
  name?: string | null;
  status?: string | null;
  overallStatus?: string | null;
  readinessScore?: number | null;
  docsMissing?: number | null;
  missingDocumentTypes?: string[] | null;
  requiredDocsApprovedCount?: number | null;
  requiredDocsTotalCount?: number | null;
  reviewRequiredCount?: number | null;
  assignedOpportunities?: number | null;
  assignedOpportunityCount?: number | null;
  opportunityCount?: number | null;
  complianceApproved?: boolean | null;
  workspaceId?: string | null;
  workspaceSlug?: string | null;
  updatedAt?: string | number | null;
  createdAt?: string | number | null;
  lastDocumentUpdateAt?: string | number | null;
}

export interface ContractorListSummary {
  total: number;
  approved: number;
  pendingReview: number;
  onboarding: number;
  legacyWithoutWorkspace: number;
  duplicateBusinessNames: Array<{ name: string; ids: string[] }>;
}

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function getContractorBusinessName(contractor: ContractorListItem): string {
  return (
    clean(contractor.companyName) ||
    clean(contractor.businessName) ||
    clean(contractor.legalName) ||
    clean(contractor.tradingName) ||
    clean(contractor.name) ||
    clean(contractor.contractorId) ||
    contractor.id
  );
}

export function getContractorCanonicalId(contractor: ContractorListItem): string {
  return clean(contractor.contractorId) || contractor.id;
}

export function getContractorWorkspaceLabel(contractor: ContractorListItem): string {
  return clean(contractor.workspaceSlug) || clean(contractor.workspaceId) || "Legacy / unassigned";
}

export function getContractorTradingName(contractor: ContractorListItem): string {
  return clean(contractor.tradingName) || clean(contractor.businessName) || "Not recorded";
}

export function formatContractorDate(value: unknown): string {
  if (!value) {
    return "Not recorded";
  }

  const date = new Date(value as string | number);
  if (Number.isNaN(date.getTime())) {
    return "Not recorded";
  }

  return date.toLocaleDateString("en-ZA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function summarizeContractorList(contractors: ContractorListItem[]): ContractorListSummary {
  const duplicateMap = new Map<string, { name: string; ids: string[] }>();

  for (const contractor of contractors) {
    const businessName = getContractorBusinessName(contractor);
    const normalized = normalizeName(businessName);
    if (!normalized) {
      continue;
    }

    const existing = duplicateMap.get(normalized) ?? { name: businessName, ids: [] };
    existing.ids.push(getContractorCanonicalId(contractor));
    duplicateMap.set(normalized, existing);
  }

  const duplicateBusinessNames = [...duplicateMap.values()].filter((entry) => entry.ids.length > 1);

  return {
    total: contractors.length,
    approved: contractors.filter((contractor) => contractor.complianceApproved === true).length,
    pendingReview: contractors.filter((contractor) => {
      const status = clean(contractor.overallStatus || contractor.status).toLowerCase();
      return contractor.complianceApproved !== true && (status.includes("review") || Number(contractor.docsMissing ?? 0) === 0);
    }).length,
    onboarding: contractors.filter((contractor) => {
      const status = clean(contractor.overallStatus || contractor.status).toLowerCase();
      return contractor.complianceApproved !== true && !status.includes("review") && (status.includes("onboarding") || status.includes("pending") || Number(contractor.docsMissing ?? 0) > 0);
    }).length,
    legacyWithoutWorkspace: contractors.filter((contractor) => !clean(contractor.workspaceId)).length,
    duplicateBusinessNames,
  };
}
export function formatDocumentCoverage(contractor: ContractorListItem): string {
  const approved = typeof contractor.requiredDocsApprovedCount === "number" && Number.isFinite(contractor.requiredDocsApprovedCount) ? contractor.requiredDocsApprovedCount : null;
  const total = typeof contractor.requiredDocsTotalCount === "number" && Number.isFinite(contractor.requiredDocsTotalCount) ? contractor.requiredDocsTotalCount : null;
  if (approved !== null && total !== null) return String(approved) + "/" + String(total);
  if (typeof contractor.docsMissing === "number" && Number.isFinite(contractor.docsMissing)) return String(contractor.docsMissing) + " outstanding";
  return "Not recorded";
}

export function formatReviewCount(contractor: ContractorListItem): string {
  return typeof contractor.reviewRequiredCount === "number" && Number.isFinite(contractor.reviewRequiredCount) ? String(contractor.reviewRequiredCount) : "Not recorded";
}

export function formatAssignedOpportunities(contractor: ContractorListItem): string {
  const value = contractor.assignedOpportunities ?? contractor.assignedOpportunityCount ?? contractor.opportunityCount;
  return typeof value === "number" && Number.isFinite(value) ? String(value) : "Not recorded";
}
