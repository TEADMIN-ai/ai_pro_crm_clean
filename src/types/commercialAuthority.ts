import type { SupplierQuote, SupplierQuoteLineItem } from "@/types/supplierQuote";

export type CommercialBlockerCode =
  | "SUPPLIER_ID_REQUIRED"
  | "SUPPLIER_QUOTE_DOCUMENT_REQUIRED"
  | "SUPPLIER_QUOTE_EVIDENCE_NOT_ACCEPTED"
  | "SUPPLIER_QUOTE_EXPIRED"
  | "SUPPLIER_QUOTE_NOT_APPROVED"
  | "SUPPLIER_QUOTE_SUPERSEDED"
  | "SUPPLIER_QUOTE_CURRENCY_UNKNOWN"
  | "SUPPLIER_QUOTE_TAX_UNKNOWN"
  | "ITEM_ID_REQUIRED"
  | "ITEM_RESOLUTION_REVIEW_REQUIRED"
  | "UNIT_MISMATCH"
  | "LANDED_COST_INCOMPLETE"
  | "SELLING_RATE_NOT_APPROVED"
  | "CLIENT_QUOTE_NOT_APPROVED"
  | "CLIENT_QUOTE_ARTIFACT_REQUIRED"
  | "TENDER_PACK_CLIENT_QUOTE_REQUIRED"
  | "TENDER_PACK_ARTIFACT_REQUIRED"
  | "SUBMISSION_EVIDENCE_REQUIRED";

export type CommercialBlocker = {
  code: CommercialBlockerCode;
  message: string;
  supplierQuoteId?: string | null;
  supplierQuoteLineId?: string | null;
  itemId?: string | null;
};

export type VerifiedSupplierCostLine = {
  supplierQuoteId: string;
  supplierId: string;
  supplierQuoteDocumentId: string;
  supplierQuoteLineId: string;
  itemId: string;
  supplierItemDescription: string;
  unitOfMeasure: string;
  unitCostExcl: number;
  unitCostIncl: number | null;
  vatRate: number | null;
  deliveryCost: number;
  otherLandedCost: number;
  landedUnitCost: number;
  currency: string;
  quoteDate: string | null;
  validUntil: string | null;
  opportunityId: string;
  verifiedAt: string;
  verifiedBy: string;
};

export type SellingRateMethod = "MARKUP" | "MARGIN";

export type ApprovedSellingRate = {
  itemId: string;
  landedUnitCost: number;
  method: SellingRateMethod;
  percentage: number;
  sellingUnitRate: number;
  override: boolean;
  overrideReason: string | null;
  approvedBy: string;
  approvedAt: string;
};

export type ClientQuoteStatus = "DRAFT" | "REVIEW_REQUIRED" | "APPROVED" | "REJECTED" | "SUPERSEDED";

export type ClientQuoteLine = ApprovedSellingRate & {
  supplierQuoteId: string;
  supplierQuoteLineId: string;
  supplierId: string;
  supplierQuoteDocumentId: string;
  quantity: number | null;
  unit: string;
  description: string;
};

export type ClientQuoteRecord = {
  clientQuoteId: string;
  opportunityId: string;
  clientId: string;
  siteId: string | null;
  workspaceId: string;
  status: ClientQuoteStatus;
  currency: string;
  taxTreatment: string;
  lines: ClientQuoteLine[];
  total: number | null;
  generatedDocumentId: string | null;
  previousClientQuoteId: string | null;
  createdBy: string;
  createdAt: string;
  approvedBy: string | null;
  approvedAt: string | null;
  updatedAt: string;
};

export type CommercialAuthorityCheck = {
  allowed: boolean;
  blockers: CommercialBlocker[];
  costLine?: VerifiedSupplierCostLine;
};

export type SupplierQuoteCommercialInput = {
  quote: SupplierQuote;
  line: SupplierQuoteLineItem;
  itemId: string | null;
  itemUnit?: string | null;
  documentVerificationStatus?: string | null;
  documentEvidenceStatus?: string | null;
  today?: Date;
};
