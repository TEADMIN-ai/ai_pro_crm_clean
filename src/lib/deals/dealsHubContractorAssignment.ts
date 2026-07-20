import type { UserRole } from "@/lib/auth/roleUtils";

export function canManageDealContractorLink(role?: UserRole | null): boolean {
  return role === "admin" || role === "manager" || role === "staff";
}

export function buildAssignContractorRequest(contractorId: string) {
  return {
    action: "assign_contractor" as const,
    contractorId: contractorId.trim(),
  };
}

export function getContractorLinkActionLabel(currentContractorId?: string | null): string {
  return currentContractorId?.trim() ? "Change Contractor" : "Link Contractor";
}