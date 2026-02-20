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

  /**
   * Compliance status
   */
  status?: string;

  /**
   * Expiry timestamp (Unix milliseconds)
   */
  expiresAt?: number;
  expiryDate?: number;

  /**
   * Creation timestamp
   */
  createdAt?: number;

  /**
   * Last updated timestamp
   */
  updatedAt?: number;

}
