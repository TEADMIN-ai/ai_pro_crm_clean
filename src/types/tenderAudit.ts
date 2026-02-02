export type TenderAuditEventType =
  | "TENDER_SUBMITTED"
  | "TENDER_LOCKED"
  | "DOCUMENT_UPLOADED"
  | "DOCUMENT_REMOVED";

export interface TenderAuditEvent {
  id: string;
  dealId: string;
  type: TenderAuditEventType;
  message: string;
  userId: string;
  createdAt: Date;
}