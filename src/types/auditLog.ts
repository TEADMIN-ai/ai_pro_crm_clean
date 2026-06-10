export type AuditLogAction =
  | "login"
  | "document_upload"
  | "compliance_change"
  | "MANUAL_VERIFICATION_APPROVED"
  | "MANUAL_VERIFICATION_REJECTED"
  | "MANUAL_VERIFICATION_REUPLOAD_REQUESTED"
  | "TENDER_PACK_REQUEST_CREATED"
  | "TENDER_PACK_REQUEST_STATUS_CHANGED"
  | "TENDER_PACK_REQUEST_GENERATED"
  | "DEAL_NOTE_CREATED"
  | "risk_created"
  | "risk_updated"
  | "risk_deleted"
  | "RISK_CREATED"
  | "RISK_UPDATED"
  | "RISK_DELETED"
  | "audit_project_created"
  | "audit_project_updated"
  | "audit_project_deleted"
  | "audit_task_created"
  | "audit_task_updated"
  | "audit_task_deleted"
  | "audit_finding_created"
  | "audit_finding_updated"
  | "audit_finding_deleted";

export type AuditLogEntityType =
  | "auth"
  | "document"
  | "compliance"
  | "tenderPackRequest"
  | "deal"
  | "risk"
  | "auditProject"
  | "auditTask"
  | "auditFinding";

export interface AuditLogEntry {
  id: string;
  userId: string;
  action: AuditLogAction;
  timestamp: string;
  entityType: AuditLogEntityType;
  entityId: string;
  metadata?: Record<string, unknown>;
}
