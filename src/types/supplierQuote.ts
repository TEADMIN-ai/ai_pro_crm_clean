export type SupplierQuoteWorkflowStatus =
  | "UPLOADED"
  | "ANALYSING"
  | "EXTRACTED"
  | "REVIEW_REQUIRED"
  | "APPROVED"
  | "REJECTED"
  | "EXPIRED"
  | "SUPERSEDED";

export type SupplierQuoteExtractionStatus = Extract<
  SupplierQuoteWorkflowStatus,
  "UPLOADED" | "ANALYSING" | "EXTRACTED" | "REVIEW_REQUIRED"
>;

export type SupplierQuoteReviewStatus = "PENDING" | "IN_REVIEW" | "CLARIFICATION_REQUESTED" | "REVIEWED";
export type SupplierQuoteApprovalStatus = "PENDING" | "APPROVED" | "REJECTED" | "LOCKED";
export type SupplierQuoteVatTreatment = "EXCLUSIVE" | "INCLUSIVE" | "ZERO_RATED" | "EXEMPT" | "UNKNOWN";
export type SupplierQuotePricingSourceStatus = "NO_QUOTES" | "QUOTE_UPLOADED" | "QUOTE_APPROVED" | "READY_FOR_PRICING";
export type SupplierQuoteNextAction =
  | "Upload another quote"
  | "Review extracted quote"
  | "Approve supplier quote"
  | "Resolve missing line items"
  | "Send approved prices to Pricing Schedule"
  | "Start BOQ pricing";

export type SupplierQuoteManualState = {
  overridden: boolean;
  overriddenBy?: string | null;
  overriddenAt?: string | null;
};

export type SupplierQuoteExtractedValue<T> = {
  value: T | null;
  confidence: number;
  sourcePage?: number | null;
  sourceText?: string | null;
  manual: SupplierQuoteManualState;
};

export type SupplierQuoteLineItem = {
  id: string;
  tenderLineItemId?: string | null;
  boqLineItemId?: string | null;
  pricingScheduleLineItemId?: string | null;
  sourceDescription: string;
  normalisedDescription: string;
  supplierSku?: string | null;
  quantity: number;
  unit: string;
  unitPrice: number;
  lineTotal: number;
  vatTreatment: SupplierQuoteVatTreatment;
  deliveryAllocation: number;
  confidence: number;
  sourcePage?: number | null;
  sourceText?: string | null;
  manualOverride: boolean;
  approved: boolean;
  approvedBy?: string | null;
  approvedAt?: string | null;
};

export type SupplierQuoteExtraction = {
  supplierName: SupplierQuoteExtractedValue<string>;
  quotationNumber: SupplierQuoteExtractedValue<string>;
  quotationDate: SupplierQuoteExtractedValue<string>;
  validityDate: SupplierQuoteExtractedValue<string>;
  vat: SupplierQuoteExtractedValue<number>;
  deliveryCost: SupplierQuoteExtractedValue<number>;
  deliveryPeriod: SupplierQuoteExtractedValue<string>;
  paymentTerms: SupplierQuoteExtractedValue<string>;
  exclusions: SupplierQuoteExtractedValue<string[]>;
  notes: SupplierQuoteExtractedValue<string[]>;
  rawTextPreview?: string | null;
  pageCount?: number | null;
};

export type SupplierQuote = {
  id: string;
  workspaceId: string;
  opportunityId: string;
  dealId: string;
  contractorId: string;
  contractorName: string;
  supplierId: string;
  supplierName: string;
  supplierRegistrationNumber?: string | null;
  supplierContactName?: string | null;
  supplierEmail?: string | null;
  supplierPhone?: string | null;
  quotationNumber?: string | null;
  quotationDate?: string | null;
  validityDate?: string | null;
  currency: string;
  subtotal: number;
  vat: number;
  total: number;
  deliveryCost: number;
  deliveryPeriod?: string | null;
  paymentTerms?: string | null;
  uploadedDocumentId?: string | null;
  storagePath?: string | null;
  sourceFileName?: string | null;
  documentClassification: "SUPPLIER_QUOTE";
  extractionStatus: SupplierQuoteExtractionStatus;
  reviewStatus: SupplierQuoteReviewStatus;
  approvalStatus: SupplierQuoteApprovalStatus;
  workflowStatus: SupplierQuoteWorkflowStatus;
  approvedBy?: string | null;
  approvedAt?: string | null;
  approvalNote?: string | null;
  rejectionReason?: string | null;
  clarificationRequest?: string | null;
  lineItems: SupplierQuoteLineItem[];
  extraction: SupplierQuoteExtraction;
  duplicateKey: string;
  supersedesQuoteId?: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type SupplierQuoteComparisonRow = {
  quoteId: string;
  supplierId: string;
  supplierName: string;
  quoteTotal: number;
  vat: number;
  deliveryCost: number;
  validityDate?: string | null;
  deliveryTime?: string | null;
  paymentTerms?: string | null;
  lineItemCoverage: number;
  missingItems: string[];
  deviations: string[];
  exclusions: string[];
  commercialRisk: "LOW" | "MEDIUM" | "HIGH";
  score: number;
  recommendationReason: string;
};

export type SupplierQuoteComparison = {
  opportunityId: string;
  dealId: string;
  contractorId: string;
  contractorName: string;
  rows: SupplierQuoteComparisonRow[];
  recommendedSupplier?: {
    quoteId: string;
    supplierId: string;
    supplierName: string;
    reason: string;
  } | null;
};

export type SupplierQuotePricingHandoff = {
  quoteId: string;
  opportunityId: string;
  dealId: string;
  contractorId: string;
  contractorName: string;
  supplierId: string;
  supplierName: string;
  currency: string;
  subtotal: number;
  vat: number;
  total: number;
  deliveryCost: number;
  lineItems: SupplierQuoteLineItem[];
  pricingSourceStatus: SupplierQuotePricingSourceStatus;
};

export type SupplierQuoteExecutionStatus = {
  supplierQuotesStatus: "NOT_STARTED" | "UPLOADED" | "REVIEW_REQUIRED" | "APPROVED" | "MISSING_LINE_ITEMS";
  approvedSupplierQuoteId?: string | null;
  pricingSourceStatus: SupplierQuotePricingSourceStatus;
  lineItemCoverage: number;
  commercialReviewStatus: "NOT_STARTED" | "REVIEW_REQUIRED" | "APPROVED";
  nextAction: SupplierQuoteNextAction;
};
