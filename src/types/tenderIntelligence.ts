export type TenderIntelligenceAnalysisStatus =
  | "NOT_STARTED"
  | "ANALYSING"
  | "ANALYSIS_COMPLETE"
  | "REVIEW_REQUIRED"
  | "APPROVED"
  | "REJECTED"
  | "FAILED"
  | "SUPERSEDED";

export type TenderIntelligenceReviewStatus = "PENDING" | "REVIEW_REQUIRED" | "APPROVED" | "REJECTED";

export type TenderPricingClassification =
  | "SEPARATE_BOQ_DOCUMENT"
  | "EMBEDDED_BOQ"
  | "EMBEDDED_PRICING_SCHEDULE"
  | "RATE_SCHEDULE"
  | "FORM_OF_OFFER_ONLY"
  | "PRICING_REQUIRED_BUT_TEMPLATE_NOT_FOUND"
  | "NO_PRICING_REQUIRED"
  | "MANUAL_REVIEW_REQUIRED";

export type TenderLineItemReviewStatus =
  | "EXTRACTED"
  | "REVIEW_REQUIRED"
  | "APPROVED"
  | "REJECTED"
  | "MERGED"
  | "NOT_APPLICABLE";

export type TenderDocumentCategory =
  | "RFQ_RFP_NOTICE"
  | "SPECIFICATION"
  | "ANNEXURE"
  | "AMENDMENT"
  | "BRIEFING_DOCUMENT"
  | "RETURNABLE_SCHEDULE"
  | "PRICING_SCHEDULE"
  | "BOQ"
  | "SCHEDULE_OF_RATES"
  | "FORM_OF_OFFER"
  | "SUPPORTING_TENDER_DOCUMENT"
  | "UNKNOWN";

export type TenderDocumentExtractionStatus = "PENDING" | "EXTRACTED" | "OCR_USED" | "EMPTY" | "FAILED";

export type TenderDocumentAnalysisStatus = "PENDING" | "ANALYSED" | "FAILED" | "SUPERSEDED";

export type TenderAmendmentStatus = "ORIGINAL" | "AMENDED" | "SUPERSEDES_PRIOR" | "SUPERSEDED" | "UNKNOWN";

export type TenderSourceEvidence = {
  sourceDocumentId: string;
  sourceDocumentName?: string | null;
  sourcePage: number | null;
  sourceTableIndex?: number | null;
  sourceHeading?: string | null;
  excerpt: string;
  confidence: number;
};

export type TenderEvidenceField<T> = {
  value: T;
  evidence: TenderSourceEvidence[];
  confidence: number;
};

export type TenderDocumentAnalysis = {
  documentId: string;
  filename: string;
  documentCategory: TenderDocumentCategory;
  storagePath: string | null;
  documentHash: string;
  pageCount: number;
  extractionStatus: TenderDocumentExtractionStatus;
  analysisStatus: TenderDocumentAnalysisStatus;
  amendmentStatus: TenderAmendmentStatus;
  textLength: number;
  extractionSource: "PDF_TEXT" | "OCR" | "EMPTY" | "MANUAL" | "UNAVAILABLE";
  errorMessage?: string | null;
};

export type TenderPricingTableCandidate = {
  id: string;
  sourceDocumentId: string;
  sourcePage: number;
  sourceTableIndex: number;
  sourceHeading: string | null;
  sourceRow: number;
  rawCells: string[];
  normalizedCells: Record<string, string | number | boolean | null>;
  confidence: number;
  reviewStatus: TenderLineItemReviewStatus;
  falsePositiveSignals: string[];
  pricingSignals: string[];
};

export type TenderExtractedLineItem = {
  id: string;
  sourceDocumentId: string;
  sourcePage: number;
  sourceTableIndex: number;
  sourceRow: number;
  itemNumber: string | null;
  description: string;
  specification: string | null;
  quantity: number | null;
  unit: string | null;
  tenderUnitPrice: number | null;
  tenderLineTotal: number | null;
  vatTreatment: string | null;
  mandatoryField: boolean;
  notes: string | null;
  rawText: string;
  extractionConfidence: number;
  reviewStatus: TenderLineItemReviewStatus;
  manuallyCorrected: boolean;
  correctedBy: string | null;
  correctedAt: string | null;
};

export type TenderSummaryConclusion = {
  label: string;
  value: string;
  evidence: TenderSourceEvidence[];
};

export type TenderIntelligence = {
  id: string;
  workspaceId: string | null;
  opportunityId: string;
  dealId: string;
  sourceDocumentIds: string[];
  tenderNumber: string | null;
  title: string | null;
  issuer: string | null;
  department: string | null;
  municipality: string | null;
  organOfState: string | null;
  province: string | null;
  advertisedAt: string | null;
  closingAt: string | null;
  briefingDate: string | null;
  briefingLocation: string | null;
  briefingRequired: boolean | null;
  briefingCompulsory: boolean | null;
  submissionMethod: string | null;
  submissionAddress: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  serviceCategory: string | null;
  scopeSummary: string | null;
  detailedScope: string | null;
  deliveryLocation: string | null;
  deliveryDeadline: string | null;
  contractDuration: string | null;
  estimatedValue: number | null;
  eligibilityRequirements: TenderSummaryConclusion[];
  compulsoryCompliance: TenderSummaryConclusion[];
  requiredReturnables: TenderSummaryConclusion[];
  evaluationCriteria: TenderSummaryConclusion[];
  functionalityCriteria: TenderSummaryConclusion[];
  preferencePointSystem: string | null;
  disqualificationRisks: TenderSummaryConclusion[];
  signaturesRequired: TenderSummaryConclusion[];
  pricingRequirement: string | null;
  boqClassification: TenderPricingClassification;
  extractedLineItems: TenderExtractedLineItem[];
  unresolvedQuestions: TenderSummaryConclusion[];
  executiveSummary: TenderSummaryConclusion[];
  detailedSubmissionSummary: TenderSummaryConclusion[];
  analysisConfidence: number;
  reviewStatus: TenderIntelligenceReviewStatus;
  analysisStatus: TenderIntelligenceAnalysisStatus;
  approvedBy: string | null;
  approvedAt: string | null;
  rejectedBy?: string | null;
  rejectedAt?: string | null;
  rejectionReason?: string | null;
  documentAnalyses: TenderDocumentAnalysis[];
  pricingTables: TenderPricingTableCandidate[];
  sourceEvidence: TenderSourceEvidence[];
  amendmentOfIntelligenceId?: string | null;
  supersededByIntelligenceId?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TenderIntelligenceExecutionHandoff = {
  tenderAnalysisStatus: TenderIntelligenceAnalysisStatus;
  requirementsReviewStatus: TenderIntelligenceReviewStatus;
  boqDetectionStatus: "NOT_STARTED" | "DETECTED" | "NOT_DETECTED" | "REVIEW_REQUIRED" | "APPROVED";
  pricingScheduleStatus: "NOT_STARTED" | "DETECTED" | "MISSING" | "NOT_APPLICABLE" | "REVIEW_REQUIRED" | "APPROVED";
  pricingClassification: TenderPricingClassification;
  extractedLineItemCount: number;
  intelligenceConfidence: number;
  analysisBlockers: string[];
  nextAction:
    | "Review tender summary"
    | "Confirm embedded BOQ on pages X-Y"
    | "Resolve low-confidence line items"
    | "Upload missing pricing template"
    | "Approve tender intelligence"
    | "Continue to supplier quote mapping";
  tenderIntelligenceId: string;
};

