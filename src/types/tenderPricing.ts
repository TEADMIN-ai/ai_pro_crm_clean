import type { SupplierQuote } from "@/types/supplierQuote";
import type { TenderQuantityMode } from "@/types/tenderIntelligence";

export type TenderPricingStatus =
  | "NOT_STARTED"
  | "SOURCE_QUOTES_REQUIRED"
  | "QUOTES_UNDER_REVIEW"
  | "TENDER_ANALYSIS_REQUIRED"
  | "MAPPING_REQUIRED"
  | "PRICING_IN_PROGRESS"
  | "REVIEW_REQUIRED"
  | "MANAGER_APPROVAL_REQUIRED"
  | "DIRECTOR_APPROVAL_REQUIRED"
  | "APPROVED"
  | "DOCUMENT_FILLING"
  | "DOCUMENT_FILLED"
  | "VALIDATION_FAILED"
  | "VALIDATED"
  | "LOCKED"
  | "SUPERSEDED";

export type TenderPricingMappingStatus =
  | "AUTO_MATCHED"
  | "MATCHED"
  | "REVIEW_REQUIRED"
  | "APPROVED"
  | "REJECTED"
  | "MANUAL_MAPPING"
  | "UNMATCHED";

export type TenderCommercialReviewStatus = "NOT_STARTED" | "REVIEW_REQUIRED" | "STAFF_APPROVED" | "MANAGER_APPROVED" | "REJECTED";
export type TenderManagementApprovalStatus = "NOT_STARTED" | "MANAGER_REQUIRED" | "MANAGER_APPROVED" | "DIRECTOR_REQUIRED" | "DIRECTOR_APPROVED" | "REJECTED";
export type TenderDocumentFillStatus = "NOT_STARTED" | "PREVIEW_REQUIRED" | "DOCUMENT_FILLING" | "DOCUMENT_FILLED" | "APPROVED";
export type TenderValidationStatus = "NOT_STARTED" | "VALIDATION_FAILED" | "VALIDATED";
export type TenderPricingLockStatus = "UNLOCKED" | "LOCKED" | "SUPERSEDED";
export type TenderPricingAggregationMode = "FIXED_QUANTITY" | "UNIT_RATE_ONLY" | "MIXED";
export type TenderPricingSource = "APPROVED_SUPPLIER_QUOTE" | "MANUAL_ENTRY" | "PROVISIONAL";
export type TenderPricingRiskCode =
  | "NEGATIVE_MARGIN"
  | "LOW_MARGIN"
  | "EXPIRED_SUPPLIER_QUOTE"
  | "DELIVERY_AFTER_DEADLINE"
  | "MISSING_ITEM"
  | "UNIT_MISMATCH"
  | "QUANTITY_MISMATCH"
  | "UNSUPPORTED_CONVERSION"
  | "PROVISIONAL_PRICING"
  | "HIGH_MARKUP"
  | "LOW_PRICE"
  | "QUOTE_EXCLUSIONS"
  | "VAT_MISMATCH"
  | "LOW_CONFIDENCE_MAPPING"
  | "MANUAL_REASON_REQUIRED"
  | "PROVISIONAL_APPROVAL_REQUIRED";

export type TenderPricingBlocker = {
  code: string;
  message: string;
  severity: "INFO" | "WARNING" | "BLOCKER";
  tenderLineItemId?: string | null;
  supplierQuoteId?: string | null;
};

export type TenderPricingTenderLineItem = {
  id: string;
  itemCode?: string | null;
  description: string;
  normalizedDescription?: string | null;
  quantity: number | null;
  quantityMode?: TenderQuantityMode;
  unit: string;
  specification?: string | null;
  packSize?: string | null;
  dimensions?: string | null;
  brandRequirement?: string | null;
  deliveryRequirement?: string | null;
  compulsory: boolean;
  sourcePage?: number | null;
  sourceDocumentId?: string | null;
};

export type TenderLineMapping = {
  id: string;
  tenderLineItemId: string;
  supplierQuoteId: string;
  supplierLineItemId: string;
  supplierName: string;
  matchConfidence: number;
  mappingReason: string;
  quantityConversion: number;
  unitConversion: number;
  conversionReason: string;
  supplierUnitCost: number;
  priceSource: TenderPricingSource;
  reviewStatus: TenderPricingMappingStatus;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
};

export type TenderSupplierOption = {
  tenderLineItemId: string;
  supplierQuoteId: string;
  supplierLineItemId: string;
  supplier: string;
  unitCost: number;
  totalCost: number;
  quoteValidity?: string | null;
  stockDeliveryPeriod?: string | null;
  paymentTerms?: string | null;
  exclusions: string[];
  completeness: number;
  commercialRisk: "LOW" | "MEDIUM" | "HIGH";
  alternativeSupplier: boolean;
  recommendedOption: boolean;
  recommendationReason: string;
  approvedStatus: SupplierQuote["approvalStatus"];
};

export type TenderPricingCalculationEvidence = {
  sourceCost: number;
  additions: {
    delivery: number;
    handling: number;
    labour: number;
    overhead: number;
    risk: number;
    contingency: number;
  };
  margin: number;
  vat: number;
  formula: string;
  assumptions: string[];
};

export type TenderPricingLineItem = TenderPricingTenderLineItem & {
  mapping?: TenderLineMapping | null;
  supplierOptions: TenderSupplierOption[];
  sourceCost: number;
  supplierSubtotal: number;
  deliveryAllocation: number;
  handlingAllocation: number;
  labourAllocation: number;
  overheadAllocation: number;
  riskAllowance: number;
  contingency: number;
  profitMargin: number;
  vatTreatment: "EXCLUSIVE" | "INCLUSIVE" | "ZERO_RATED" | "EXEMPT";
  tenderUnitPrice: number;
  tenderLineTotal: number | null;
  grossProfit: number | null;
  grossMarginPercentage: number | null;
  priceSource: TenderPricingSource | "UNPRICED";
  manualPriceReason?: string | null;
  provisionalApprovedBy?: string | null;
  provisionalApprovedAt?: string | null;
  riskFlags: TenderPricingRiskCode[];
  calculationEvidence: TenderPricingCalculationEvidence;
};

export type TenderPricingRules = {
  vatRate: number;
  marginPercentage: number;
  minimumMarginPercentage: number;
  overheadPercentage: number;
  riskPercentage: number;
  contingencyPercentage: number;
  handlingPercentage: number;
  labourRatePerUnit?: number;
  highMarkupPercentage: number;
  lowPriceVariancePercentage: number;
  directorApprovalThreshold?: number | null;
};

export type TenderPricingApproval = {
  status: TenderCommercialReviewStatus | TenderManagementApprovalStatus;
  approvedBy?: string | null;
  approvedAt?: string | null;
  notes?: string | null;
  role: "staff" | "manager" | "director";
  total: number | null;
  margin: number | null;
  revision: number;
};

export type TenderPricingDocumentFillEvidence = {
  sourceDocumentId: string;
  sourceDocumentPath: string;
  pricedDocumentId?: string | null;
  pricedDocumentUrl?: string | null;
  originalPreserved: boolean;
  fieldMappings: Array<{
    tenderLineItemId?: string | null;
    fieldName: string;
    page?: number | null;
    value: string;
    source: "approved_pricing_record" | "approved_contractor_profile";
    confidence: number;
  }>;
  warnings: string[];
  validationIssues: string[];
};

export type TenderPricingRevision = {
  revision: number;
  previousRevisionId?: string | null;
  changedBy: string;
  changedAt: string;
  changeReason: string;
  previousTotal: number;
  newTotal: number;
  previousMargin: number;
  newMargin: number;
  approvalReset: boolean;
};

export type TenderPricingHandoff = {
  tenderPricingId: string;
  pricingStatus: TenderPricingStatus;
  pricingApproved: boolean;
  pricingDocumentId?: string | null;
  pricingDocumentUrl?: string | null;
  totalTenderValue: number | null;
  grossProfit: number | null;
  grossMargin: number | null;
  unresolvedPricingBlockers: TenderPricingBlocker[];
  nextAction: string;
  workflowTransition: "DOCUMENT_PREPARATION" | "BLOCKED";
};

export type TenderPricingWorkspace = {
  id: string;
  workspaceId: string;
  opportunityId: string;
  dealId: string;
  contractorId: string;
  contractorName: string;
  tenderIntelligenceId?: string | null;
  sourcePricingDocumentId?: string | null;
  sourcePricingDocumentPath?: string | null;
  approvedSupplierQuoteIds: string[];
  pricingStatus: TenderPricingStatus;
  mappingStatus: TenderPricingStatus;
  commercialReviewStatus: TenderCommercialReviewStatus;
  managementApprovalStatus: TenderManagementApprovalStatus;
  documentFillStatus: TenderDocumentFillStatus;
  validationStatus: TenderValidationStatus;
  lockStatus: TenderPricingLockStatus;
  currency: string;
  subtotal: number | null;
  vat: number | null;
  total: number | null;
  totalSupplierCost: number | null;
  pricingAggregationMode: TenderPricingAggregationMode;
  deliveryCost: number;
  handlingCost: number;
  overheadCost: number;
  riskAllowance: number;
  contingency: number;
  grossProfit: number | null;
  grossMarginPercentage: number | null;
  lineItems: TenderPricingLineItem[];
  blockers: TenderPricingBlocker[];
  nextAction: string;
  revision: number;
  previousRevisionId?: string | null;
  revisions: TenderPricingRevision[];
  approvals: TenderPricingApproval[];
  documentFillEvidence?: TenderPricingDocumentFillEvidence | null;
  submissionReviewHandoff?: TenderPricingHandoff | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  approvedBy?: string | null;
  approvedAt?: string | null;
  lockedBy?: string | null;
  lockedAt?: string | null;
};

export type TenderPricingSourceValidationInput = {
  workspaceId: string;
  opportunityId?: string;
  dealId?: string;
  contractorId: string;
  contractorName: string;
  tenderIntelligenceApproved: boolean;
  tenderLineItems: TenderPricingTenderLineItem[];
  sourcePricingDocumentRequired: boolean;
  sourcePricingDocumentId?: string | null;
  sourcePricingDocumentPath?: string | null;
  supplierQuotes: SupplierQuote[];
  today?: Date;
};

export type TenderPricingBuildInput = TenderPricingSourceValidationInput & {
  id?: string;
  opportunityId: string;
  dealId: string;
  tenderIntelligenceId?: string | null;
  rules?: Partial<TenderPricingRules>;
  manualMappings?: TenderLineMapping[];
  manualPrices?: Array<{
    tenderLineItemId: string;
    unitPrice: number;
    reason?: string | null;
    provisional?: boolean;
    approvedBy?: string | null;
    approvedAt?: string | null;
  }>;
  createdBy: string;
  now?: string;
};
