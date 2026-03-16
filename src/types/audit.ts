export type AuditProjectStatus = "planned" | "active" | "completed" | "archived";
export type AuditTaskStatus = "todo" | "in_progress" | "done" | "blocked";
export type AuditFindingSeverity = "low" | "medium" | "high" | "critical";
export type AuditFindingStatus = "open" | "in_review" | "resolved" | "closed";

export interface AuditProject {
  id: string;
  title: string;
  department: string;
  startDate: string;
  endDate: string;
  leadAuditor: string;
  status: AuditProjectStatus;
  createdAt?: string;
  updatedAt?: string;
  createdByUid?: string;
  updatedByUid?: string;
}

export interface AuditTask {
  id: string;
  auditProjectId: string;
  title: string;
  description: string;
  assignedTo: string;
  assignee?: string;
  dueDate: string;
  status: AuditTaskStatus;
  createdAt?: string;
  updatedAt?: string;
  createdByUid?: string;
  updatedByUid?: string;
}

export interface AuditFinding {
  id: string;
  auditProjectId: string;
  description: string;
  severity: AuditFindingSeverity;
  recommendation: string;
  status: AuditFindingStatus;
  createdAt?: string;
  updatedAt?: string;
  createdByUid?: string;
  updatedByUid?: string;
}

export interface AuditProjectSummary {
  taskCount: number;
  openTaskCount: number;
  findingCount: number;
  openFindingCount: number;
  criticalFindingCount: number;
}

export interface AuditDashboardMetrics {
  activeAudits: number;
  openFindings: number;
  resolvedFindings: number;
}

export interface AuditStatusCount {
  status: string;
  count: number;
}

export interface AuditSeverityCount {
  severity: AuditFindingSeverity;
  count: number;
}

export interface AuditProjectHealth {
  projectId: string;
  title: string;
  department: string;
  status: AuditProjectStatus;
  summary: AuditProjectSummary;
}

export interface AuditModuleDashboardMetrics {
  totals: AuditDashboardMetrics & {
    overdueTasks: number;
    completionRate: number;
  };
  projectsByStatus: AuditStatusCount[];
  tasksByStatus: AuditStatusCount[];
  findingsBySeverity: AuditSeverityCount[];
  projectHealth: AuditProjectHealth[];
}
