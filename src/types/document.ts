/**
 * ContractorDocument
 *
 * This represents ALL possible document fields coming from:
 *
 * - Firestore
 * - Upload API
 * - Legacy records
 * - Future normalized records
 *
 * This prevents recurring TypeScript breakage.
 */

export interface ContractorDocument {
  id: string;

  // canonical storage fields
  fileName?: string;
  originalName?: string;
  filename?: string;
  name?: string;

  docType?: string | null;
  status?: string;

  expiresAt?: number | null;

  createdAt?: number;
  updatedAt?: number;

  [key: string]: any;
}
