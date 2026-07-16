export interface DealContractorReferenceDisplay {
  contractorId?: string | null;
  contractorName?: string | null;
  contractorReferenceResolution?: {
    status: "resolved" | "unresolved";
    failureReason?: string;
  } | null;
}

export function getDealContractorDisplayName(deal: DealContractorReferenceDisplay | null): string {
  if (!deal) {
    return "No contractor selected";
  }

  const contractorName = deal.contractorName?.trim();
  if (contractorName) {
    return contractorName;
  }

  if (deal.contractorReferenceResolution?.status === "unresolved") {
    return "Linked contractor record could not be resolved.";
  }

  return deal.contractorId?.trim() ? "Linked contractor" : "No contractor linked";
}

export function isDealContractorResolved(deal: DealContractorReferenceDisplay | null): boolean {
  return Boolean(deal?.contractorId?.trim()) && deal?.contractorReferenceResolution?.status !== "unresolved";
}
