// src/lib/tender/tenderExportModel.ts

export type TenderExportDocument = {
  id: string;
  name: string;
  /**
   * Optional for now (Phase E4 wiring).
   * Later: populate from Firebase Storage (bytes/base64/text).
   */
  content?: string | Uint8Array;
  uploadedAt?: any;
};

export type TenderExportModel = {
  tenderId: string;
  tenderTitle: string;

  metadata?: Record<string, unknown>;

  documents?: TenderExportDocument[];
};