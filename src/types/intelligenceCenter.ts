export type IntelligenceAuditEventType =
  | "USER_LOGIN"
  | "USER_LOGOUT"
  | "CONTRACTOR_CREATED"
  | "CONTRACTOR_UPDATED"
  | "DOCUMENT_UPLOADED"
  | "DOCUMENT_APPROVED"
  | "DOCUMENT_REJECTED"
  | "AI_ANALYSIS_EXECUTED"
  | "READINESS_CHANGED"
  | "TENDER_PACK_GENERATED"
  | "PDF_DOWNLOADED"
  | "CONTRACTOR_STATUS_CHANGED";

export type IntelligenceAuditLog = {
  id: string;
  eventType: string;
  actorId: string | null;
  actorRole: string | null;
  contractorId: string | null;
  targetId: string | null;
  previousValue: unknown | null;
  newValue: unknown | null;
  timestamp: string;
  metadata: Record<string, unknown>;
};

export type DecisionLog = {
  id: string;
  contractorId: string | null;
  previousReadinessScore: number | null;
  newReadinessScore: number | null;
  triggerEvent: string | null;
  reasonForChange: string | null;
  timestamp: string;
  metadata: Record<string, unknown>;
};

export type SystemMetric = {
  id: string;
  metricType: string;
  route: string | null;
  durationMs: number | null;
  contractorId: string | null;
  targetId: string | null;
  timestamp: string;
  metadata: Record<string, unknown>;
};

export type ComplianceIntelligenceAlert = {
  id: string;
  contractorId: string;
  contractorName: string;
  documentType: string;
  severity: "expired" | "expiringSoon";
  expiresAt: string;
  daysUntilExpiry: number;
};

export type ContractorTimelineItem = {
  id: string;
  eventType: string;
  label: string;
  timestamp: string;
  contractorId: string;
  targetId: string | null;
  metadata: Record<string, unknown>;
};

export type IntelligenceCenterOverview = {
  metrics: {
    totalContractors: number;
    newContractors: number;
    readyContractors: number;
    riskContractors: number;
    blockedContractors: number;
    documentsUploadedToday: number;
    aiAnalysesToday: number;
    tenderPacksGenerated: number;
    userActivityToday: number;
  };
  auditLogs: IntelligenceAuditLog[];
  recentTeamActivity: ContractorTimelineItem[];
  decisionLogs: DecisionLog[];
  systemMetrics: SystemMetric[];
  complianceAlerts: ComplianceIntelligenceAlert[];
};
