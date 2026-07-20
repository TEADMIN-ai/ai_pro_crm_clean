export type DealContractorReferenceField =
  | "contractorAssignment.contractorId"
  | "opportunityExecution.contractorId"
  | "contractorId"
  | "assignedContractorId"
  | "linkedContractorId"
  | "contractorUid";

export type DealContractorReference =
  | { status: "no_reference"; value: null; field: null }
  | { status: "reference_present"; value: string; field: DealContractorReferenceField };

const SENTINEL_VALUES = new Set(["unassigned", "none", "null", "undefined", "n/a", "na"]);

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function normalizeReference(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (SENTINEL_VALUES.has(trimmed.toLowerCase())) return null;
  return trimmed;
}

export function getDealContractorReference(source: Record<string, unknown> | null | undefined): DealContractorReference {
  const deal = asRecord(source);
  const contractorAssignment = asRecord(deal.contractorAssignment);
  const opportunityExecution = asRecord(deal.opportunityExecution);

  const candidates: Array<{ field: DealContractorReferenceField; value: unknown }> = [
    { field: "contractorAssignment.contractorId", value: contractorAssignment.contractorId },
    { field: "opportunityExecution.contractorId", value: opportunityExecution.contractorId },
    { field: "contractorId", value: deal.contractorId },
    { field: "assignedContractorId", value: deal.assignedContractorId },
    { field: "linkedContractorId", value: deal.linkedContractorId },
    { field: "contractorUid", value: deal.contractorUid },
  ];

  for (const candidate of candidates) {
    const value = normalizeReference(candidate.value);
    if (value) return { status: "reference_present", field: candidate.field, value };
  }

  return { status: "no_reference", field: null, value: null };
}