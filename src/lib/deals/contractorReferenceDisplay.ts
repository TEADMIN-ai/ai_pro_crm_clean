export interface DealContractorReferenceDisplay {
  contractorId?: string | null;
  contractorName?: string | null;
  contractorReferenceResolution?: {
    status: "none" | "resolved" | "unresolved";
    failureReason?: string;
  } | null;
}

export function getDealContractorDisplayName(deal: DealContractorReferenceDisplay | null): string {
  if (!deal) {
    return "No contractor selected";
  }

  if (deal.contractorReferenceResolution?.status === "unresolved") {
    return deal.contractorReferenceResolution.failureReason === "cross_workspace"
      ? "Linked contractor is outside this workspace."
      : "Linked contractor record could not be resolved.";
  }

  const contractorName = deal.contractorName?.trim();
  if (contractorName) {
    return contractorName;
  }

  return deal.contractorId?.trim() ? "Linked contractor" : "No contractor linked";
}

export function isDealContractorResolved(deal: DealContractorReferenceDisplay | null): boolean {
  return Boolean(deal?.contractorId?.trim()) && deal?.contractorReferenceResolution?.status !== "unresolved";
}