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
  validationStatus?: "PASS" | "REVIEW" | "FAIL";
  verified?: boolean;
  verifiedAt?: number;
  validationError?: string;
  reviewReason?: string;
  reviewedBy?: string;
  reviewedAt?: number;
  manualDecisionAvailable?: boolean;
  confidenceNotes?: string[];
  suggestions?: string[];

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
  validationErrors?: string[];
  analysisTimestamp?: number;
  extractionMethod?: "pdf-parse" | "ocr";
  extractedTextLength?: number;

  /**
   * Direct file URL used by the dashboard and execution APIs
   */
  fileUrl?: string;

}
