export type OpportunityDocumentKey = "rfq" | "boq" | "annexures" | "sbd" | "supporting";

export type OpportunityFieldSource = "manual" | "extracted" | "missing" | "invalid";

export interface OpportunityExtractionField {
  value: string;
  confidence: number;
  source: string;
}

export interface OpportunityExtractionResult {
  extractionId?: string;
  fields: Partial<Record<keyof OpportunityDraftFields, OpportunityExtractionField>>;
  extractedText?: string;
  documentName?: string;
  analyzedAt: string;
}

export interface OpportunityUploadedDocument {
  id: string;
  documentType: OpportunityDocumentKey;
  name: string;
  size?: number;
  contentType?: string;
  storagePath?: string;
  downloadURL?: string;
  analysis?: OpportunityExtractionResult | null;
}

export interface OpportunityDraftFields {
  referenceNumber: string;
  opportunityTitle: string;
  clientName: string;
  municipality: string;
  department: string;
  closingDate: string;
  estimatedValue: string;
  province: string;
  category: string;
  description: string;
  assignedContractorId: string;
}

export interface OpportunityDraft extends OpportunityDraftFields {
  draftId: string;
  activeRfqExtractionId?: string;
  activeRfqFileName?: string;
  rfqExtractionStatus?: string;
  rfqExtractionError?: string;
  uploadedDocuments: OpportunityUploadedDocument[];
  fieldSources: Partial<Record<keyof OpportunityDraftFields, OpportunityFieldSource>>;
  extractionMetadata: OpportunityExtractionResult[];
  updatedAt?: string;
}

export interface OpportunitySummaryField {
  key: keyof OpportunityDraftFields;
  label: string;
  value: string;
  status: OpportunityFieldSource;
  confidence?: number;
  source?: string;
}

export const OPPORTUNITY_DRAFT_STORAGE_KEY = "teos:opportunity-intake-draft:v1";

export const OPPORTUNITY_FIELD_LABELS: Record<keyof OpportunityDraftFields, string> = {
  referenceNumber: "RFQ / RFP Number",
  opportunityTitle: "Opportunity Title",
  clientName: "Client",
  municipality: "Municipality",
  department: "Department",
  closingDate: "Closing Date",
  estimatedValue: "Estimated Value",
  province: "Province",
  category: "Category",
  description: "Description",
  assignedContractorId: "Assigned Contractor",
};

export const REQUIRED_CREATE_FIELDS: Array<keyof OpportunityDraftFields | "primaryDocument"> = [
  "opportunityTitle",
  "clientName",
  "closingDate",
  "primaryDocument",
];

export function createOpportunityDraft(draftId = `opp-draft-${Date.now()}`): OpportunityDraft {
  return {
    draftId,
    referenceNumber: "",
    opportunityTitle: "",
    clientName: "",
    municipality: "",
    department: "",
    closingDate: "",
    estimatedValue: "",
    province: "",
    category: "",
    description: "",
    assignedContractorId: "",
    uploadedDocuments: [],
    fieldSources: {},
    extractionMetadata: [],
    updatedAt: new Date().toISOString(),
  };
}

export function hasPrimaryRfqDocument(draft: Pick<OpportunityDraft, "uploadedDocuments">): boolean {
  return draft.uploadedDocuments.some((document) => document.documentType === "rfq");
}

export function getMissingCreateRequirements(draft: OpportunityDraft): string[] {
  const missing: string[] = [];
  if (!draft.opportunityTitle.trim()) missing.push("Opportunity title");
  if (!draft.clientName.trim()) missing.push("Client/issuer");
  if (!draft.closingDate.trim()) missing.push("Closing date");
  if (!hasPrimaryRfqDocument(draft)) missing.push("Primary RFQ/RFP document");
  return missing;
}

export function canCreateOpportunity(draft: OpportunityDraft): boolean {
  return getMissingCreateRequirements(draft).length === 0;
}

export function getStepCompletion(draft: OpportunityDraft) {
  const detailsComplete = Boolean(
    draft.opportunityTitle.trim() &&
      draft.clientName.trim() &&
      draft.closingDate.trim(),
  );
  return {
    detailsComplete,
    documentsComplete: hasPrimaryRfqDocument(draft),
    summaryComplete: canCreateOpportunity(draft),
  };
}

export function buildOpportunitySummary(draft: OpportunityDraft): OpportunitySummaryField[] {
  const keys: Array<keyof OpportunityDraftFields> = [
    "referenceNumber",
    "opportunityTitle",
    "clientName",
    "municipality",
    "department",
    "closingDate",
    "estimatedValue",
    "province",
    "category",
    "description",
    "assignedContractorId",
  ];

  return keys.map((key) => {
    const value = draft[key].trim();
    const extracted = draft.extractionMetadata
      .map((metadata) => metadata.fields[key])
      .find((field): field is OpportunityExtractionField => Boolean(field?.value));
    const source = draft.fieldSources[key] ?? (value ? "manual" : "missing");
    return {
      key,
      label: OPPORTUNITY_FIELD_LABELS[key],
      value,
      status: value ? source : "missing",
      confidence: extracted?.confidence,
      source: extracted?.source,
    };
  });
}

export function mergeExtractionIntoDraft(
  draft: OpportunityDraft,
  extraction: OpportunityExtractionResult,
): OpportunityDraft {
  const next: OpportunityDraft = {
    ...draft,
    fieldSources: { ...draft.fieldSources },
    extractionMetadata: [...draft.extractionMetadata, extraction],
    updatedAt: new Date().toISOString(),
  };

  for (const [rawKey, field] of Object.entries(extraction.fields)) {
    const key = rawKey as keyof OpportunityDraftFields;
    if (!field?.value?.trim()) continue;
    const currentValue = next[key].trim();
    const currentSource = next.fieldSources[key];

    if (currentValue && currentSource === "manual") {
      continue;
    }

    if (currentValue && currentSource === "extracted") {
      const currentConfidence = next.extractionMetadata
        .map((metadata) => metadata.fields[key]?.confidence ?? 0)
        .reduce((max, value) => Math.max(max, value), 0);
      if (currentConfidence > field.confidence) {
        continue;
      }
    }

    next[key] = field.value.trim();
    next.fieldSources[key] = "extracted";
  }

  return next;
}

export function markManualField<K extends keyof OpportunityDraftFields>(
  draft: OpportunityDraft,
  key: K,
  value: string,
): OpportunityDraft {
  return {
    ...draft,
    [key]: value,
    fieldSources: {
      ...draft.fieldSources,
      [key]: value.trim() ? "manual" : "missing",
    },
    updatedAt: new Date().toISOString(),
  };
}

export function normalizeEstimatedValue(value: string): number {
  const parsed = Number(value.replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}




export function createOpportunityExtractionId(prefix = "rfq-extraction"): string {
  const randomId = typeof globalThis.crypto?.randomUUID === "function"
    ? globalThis.crypto.randomUUID()
    : String(Date.now()) + "-" + Math.random().toString(36).slice(2, 10)
  return prefix + "-" + randomId
}

export function createDraftForRfqExtractionSession(input: {
  fileName: string
  fileSize?: number
  contentType?: string
  extractionId?: string
  draftId?: string
}): OpportunityDraft {
  const extractionId = input.extractionId ?? createOpportunityExtractionId()
  const draft = createOpportunityDraft(input.draftId ?? "opp-draft-" + extractionId)
  return {
    ...draft,
    activeRfqExtractionId: extractionId,
    activeRfqFileName: input.fileName,
    rfqExtractionStatus: "processing",
    rfqExtractionError: undefined,
    uploadedDocuments: [
      {
        id: extractionId,
        documentType: "rfq",
        name: input.fileName,
        size: input.fileSize,
        contentType: input.contentType ?? "application/pdf",
        analysis: null,
      },
    ],
  }
}


export function clearExtractedOpportunityFields(draft: OpportunityDraft): OpportunityDraft {
  const next: OpportunityDraft = {
    ...draft,
    fieldSources: { ...draft.fieldSources },
    extractionMetadata: [],
    updatedAt: new Date().toISOString(),
  }

  const keys: Array<keyof OpportunityDraftFields> = [
    "referenceNumber",
    "opportunityTitle",
    "clientName",
    "municipality",
    "department",
    "closingDate",
    "estimatedValue",
    "province",
    "category",
    "description",
    "assignedContractorId",
  ]

  for (const key of keys) {
    if (next.fieldSources[key] === "extracted") {
      next[key] = ""
      next.fieldSources[key] = "missing"
    }
  }

  return next
}

export function applyRfqExtractionToDraft(draft: OpportunityDraft, extraction: OpportunityExtractionResult): OpportunityDraft {
  if (draft.activeRfqExtractionId && extraction.extractionId && draft.activeRfqExtractionId !== extraction.extractionId) {
    return draft
  }

  const merged = mergeExtractionIntoDraft(draft, extraction)
  const extractionId = extraction.extractionId ?? draft.activeRfqExtractionId
  return {
    ...merged,
    activeRfqExtractionId: extractionId,
    activeRfqFileName: extraction.documentName ?? draft.activeRfqFileName,
    rfqExtractionStatus: "extracted",
    rfqExtractionError: undefined,
    uploadedDocuments: merged.uploadedDocuments.map((document) =>
      document.documentType === "rfq" && document.id === extractionId
        ? { ...document, analysis: extraction }
        : document,
    ),
  }
}

export function markRfqExtractionFailed(draft: OpportunityDraft, extractionId: string, error: string): OpportunityDraft {
  if (draft.activeRfqExtractionId && draft.activeRfqExtractionId !== extractionId) {
    return draft
  }

  const cleared = clearExtractedOpportunityFields(draft)
  return {
    ...cleared,
    activeRfqExtractionId: extractionId,
    rfqExtractionStatus: "failed",
    rfqExtractionError: error,
    uploadedDocuments: cleared.uploadedDocuments.map((document) =>
      document.documentType === "rfq" && document.id === extractionId
        ? { ...document, analysis: null }
        : document,
    ),
  }
}
