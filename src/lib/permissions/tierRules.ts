import type { Contractor } from "@/types/contractor";

export function canSubmit(contractor: Pick<Contractor, "submissionsUsed" | "submissionsLimit">) {
  const submissionsUsed = typeof contractor.submissionsUsed === "number" ? contractor.submissionsUsed : 0;
  const submissionsLimit =
    typeof contractor.submissionsLimit === "number" ? contractor.submissionsLimit : Number.POSITIVE_INFINITY;

  return submissionsUsed < submissionsLimit;
}
