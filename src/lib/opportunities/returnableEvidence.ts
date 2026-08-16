export const RETURNABLE_CATEGORIES = [
  "RFQ_SOURCE",
  "PRICING_SCHEDULE",
  "SBD_FORMS",
  "DECLARATIONS",
  "ANNEXURES",
  "CONTRACTOR_COMPLIANCE",
  "SIGNATURES",
  "AMENDMENTS",
] as const;

export type ReturnableCategory = (typeof RETURNABLE_CATEGORIES)[number];

export type ReturnableContext = {
  key: string;
  category: ReturnableCategory;
  label: string;
  required: boolean;
};

const CONTEXTS: Record<string, ReturnableContext> = {
  source: { key: "source", category: "RFQ_SOURCE", label: "RFQ/RFP source document", required: true },
  pricing: { key: "pricing", category: "PRICING_SCHEDULE", label: "Pricing schedules", required: true },
  sbd: { key: "sbd", category: "SBD_FORMS", label: "SBD Forms", required: true },
  declarations: { key: "declarations", category: "DECLARATIONS", label: "Declarations", required: true },
  annexures: { key: "annexures", category: "ANNEXURES", label: "Annexures", required: true },
  compliance: { key: "compliance", category: "CONTRACTOR_COMPLIANCE", label: "Contractor compliance documents", required: true },
  signatures: { key: "signatures", category: "SIGNATURES", label: "Signatures", required: true },
  amendments: { key: "amendments", category: "AMENDMENTS", label: "Amendments", required: true },
};

export const SBD_SUBTYPES = ["SBD1", "SBD4", "SBD6_1", "SBD8", "SBD9", "OTHER_SBD"] as const;

export function getReturnableContext(value: unknown): ReturnableContext | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return CONTEXTS[normalized] ?? Object.values(CONTEXTS).find((context) => context.category.toLowerCase() === normalized) ?? null;
}

export function getReturnableContextByCategory(value: unknown): ReturnableContext | null {
  if (typeof value !== "string") return null;
  return Object.values(CONTEXTS).find((context) => context.category === value.trim().toUpperCase()) ?? null;
}

export type ReturnableEvidenceIdentity = { id: string; canonicalEvidenceId?: string | null; documentId?: string | null; storagePath?: string | null; name: string };
export function dedupeReturnableEvidence<T extends ReturnableEvidenceIdentity>(records: T[]): T[] {
  const seen = new Set<string>();
  return records.filter((record) => {
    const identity = record.canonicalEvidenceId ?? record.documentId ?? record.id ?? record.storagePath ?? record.name;
    if (seen.has(identity)) return false;
    seen.add(identity);
    return true;
  });
}
