/**
 * ContractorDocument
 * ==================
 *
 * Canonical normalized document model used across:
 *
 * API routes
 * Firestore normalization
 * Frontend dashboard
 * AI processing pipeline
 *
 * Firestore may contain null values.
 * This model normalizes null → undefined.
 *
 * expiresAt is stored as Unix timestamp (number).
 */

export interface ContractorDocument {
  taxDocumentCategory?:
    | "TAX_COMPLIANCE_STATUS"
    | "TCS_PIN_DOCUMENT"
    | "SARS_NOTICE_OF_REGISTRATION"
    | "VAT_REGISTRATION_NOTICE"
    | "LEGACY_TAX_CLEARANCE_CERTIFICATE"
    | "UNKNOWN_TAX_DOCUMENT";
  taxDocumentPurpose?:
    | "ACTIVE_TAX_COMPLIANCE_PROOF"
    | "SARS_REGISTRATION_PROOF"
    | "IDENTITY_TAX_LINKAGE_SUPPORT"
    | "UNKNOWN_TAX_PURPOSE";
  taxClassificationConfidence?: number;
  taxComplianceCapable?: boolean;
  taxSupportingOnly?: boolean;
  readinessImpactReason?: string;

  aiValidated?: boolean;
  aiStatus?: "pending" | "complete" | "failed";
  aiError?: string;
  aiSuggestion?: string;
  aiData?: {
    valid?: boolean;
    companyName?: string | null;
    registrationNumber?: string | null;
    documentType?: string | null;
    expiryDate?: string | null;
    confidenceScore?: number;
    riskLevel?: "low" | "medium" | "high" | "unknown";
    issues?: string[];
    fraudIndicators?: string[];
    error?: string;
  };
  riskLevel?: "low" | "medium" | "high" | "unknown";
  aiIssues?: string[];

  /**
   * Firestore document ID
   */
  id: string;

  /**
   * Contractor owner
   */
  contractorId: string;

  /**
   * Firebase Storage path
   */
  storagePath?: string;

  /**
   * Public download URL
   */
  downloadURL?: string;

  /**
   * Original uploaded filename
   */
  fileName?: string;

  /**
   * Alternate filename formats (legacy compatibility)
   */
  originalName?: string;

  filename?: string;

  /**
   * AI classified document type
   */
  docType?: string;
  documentType?: string;
  complianceType?: string;

  /**
   * Canonical display name for compliance documents
   */
  documentName?: string;

  /**
   * Compliance status
   */
  status?: string;
  finalStatus?: "PASS" | "REVIEW" | "FAIL";
  validationStatus?: "PASS" | "REVIEW" | "FAIL";
  verified?: boolean;
  verifiedAt?: number;
  verifiedBy?: string;
  verificationMethod?: "AI" | "MANUAL";
  verificationStatus?: "VERIFIED_MANUAL" | "REJECTED_MANUAL" | string;
  verificationNote?: string;
  rejectedBy?: string;
  rejectedAt?: number;
  rejectionReason?: string;
  validationError?: string;
  reviewReason?: string;
  reviewedBy?: string;
  reviewedAt?: number;
  manualDecisionAvailable?: boolean;
  confidenceNotes?: string[];
  suggestions?: string[];
  isExpired?: boolean;

  /**
   * Expiry timestamp (Unix milliseconds)
   */
  expiresAt?: number;
  expiryDate?: number;
  expiryAlert?: "none" | "expiringSoon" | "expired";
  expiryAlertMessage?: string;

  /**
   * Creation timestamp
   */
  createdAt?: number;
  uploadedAt?: number;

  /**
   * Last updated timestamp
   */
  updatedAt?: number;

  extractedAt?: number;
  confidenceScore?: number;
  complianceScore?: number;
  extractedFields?: Record<string, string | null>;
  missingFields?: string[];
  issues?: string[];
  validationErrors?: string[];
  analysisTimestamp?: number;
  extractionMethod?: "pdf-parse" | "ocr";
  extractionSource?: "PDF_TEXT" | "OCR" | "EMPTY";
  extractedText?: string;
  extractedTextLength?: number;
  directTextLength?: number;
  ocrTextLength?: number;
  pageCount?: number;

  /**
   * Direct file URL used by the dashboard and execution APIs
   */
  fileUrl?: string;

}
