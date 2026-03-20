import type { SbdFieldKey } from "@/lib/pdfs/templates/sbdSchema";

export const CRITICAL_TENDER_FIELDS = [
  "vatNumber",
  "taxPin",
  "csdNumber",
  "address",
] as const satisfies readonly SbdFieldKey[];

export type CriticalTenderField = (typeof CRITICAL_TENDER_FIELDS)[number];

export const CRITICAL_TENDER_FIELD_LABELS: Record<CriticalTenderField, string> = {
  vatNumber: "VAT Number",
  taxPin: "Tax Pin",
  csdNumber: "CSD Number",
  address: "Address",
};

export function getCriticalTenderMissingFields(
  missingFields: readonly string[]
): CriticalTenderField[] {
  const missingSet = new Set(missingFields);
  return CRITICAL_TENDER_FIELDS.filter((field) => missingSet.has(field));
}
