import type { UserRole } from "@/lib/auth/roleUtils";

export type AgentRole =
  | "orchestrator"
  | "tender_analyst"
  | "compliance_officer"
  | "scoring_engine"
  | "dashboard_operator"
  | "notification_coordinator";

export type WorkflowStatus =
  | "queued"
  | "pending"
  | "running"
  | "completed"
  | "partial"
  | "partial_success"
  | "failed"
  | "rolled_back"
  | "cancelled";

export type WorkflowStepStatus = "pending" | "running" | "completed" | "failed" | "skipped" | "rolled_back";
export type WorkflowType = "tender" | "compliance" | "onboarding";

export interface WorkflowStep {
  id: string;
  title: string;
  status: WorkflowStepStatus;
  actor?: AgentRole | "system";
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  retries?: number;
  error?: string;
  warnings?: string[];
  output?: Record<string, unknown>;
}

export interface ToolExecutionResult<TData = Record<string, unknown>> {
  ok: boolean;
  toolName: string;
  data?: TData;
  warnings: string[];
  audit: Record<string, unknown>;
  rollbackToken?: string;
  error?: string;
}

export interface ManusContext {
  requestId: string;
  workflowId: string;
  workflowType: WorkflowType;
  actor: {
    uid: string;
    email?: string;
    role: UserRole;
    contractorId?: string;
  };
  contractorId?: string;
  dealId?: string;
  correlationId?: string;
  dryRun?: boolean;
  abortSignal?: AbortSignal;
  metadata: Record<string, unknown>;
}

export interface ContractorMemory {
  contractorId: string;
  lastWorkflowId?: string;
  lastUpdatedAt: string;
  submissionHistory: Array<{
    dealId?: string;
    workflowId: string;
    status: WorkflowStatus;
    submittedAt: string;
  }>;
  complianceHistory: Array<{
    workflowId: string;
    score: number;
    missingDocuments: string[];
    expiredDocuments: string[];
    capturedAt: string;
  }>;
  readinessTrends: Array<{
    workflowId: string;
    score: number;
    status: "READY" | "RISK" | "BLOCKED";
    capturedAt: string;
  }>;
  documentExpiryPatterns: Array<{
    documentType: string;
    expiryDate?: string;
    status: "valid" | "expiring" | "expired" | "unknown";
  }>;
  repeatedComplianceFailures?: Array<{
    workflowId: string;
    missingDocuments: string[];
    capturedAt: string;
  }>;
  industryPreferences: string[];
  riskPatterns: string[];
  submissionSuccessTrends?: Array<{
    workflowId: string;
    status: "READY" | "RISK" | "BLOCKED";
    capturedAt: string;
  }>;
}

export interface WorkflowExecutionPayload {
  workflowType: WorkflowType;
  contractorId?: string;
  dealId?: string;
  documentPath?: string;
  documentType?: string;
  promptTemplate?: string;
  input: Record<string, unknown>;
  options?: {
    dryRun?: boolean;
    continueOnFailure?: boolean;
  };
}

export interface AgentExecutionPayload {
  agentRole: AgentRole;
  objective: string;
  input: Record<string, unknown>;
  context: ManusContext;
}

export interface AgentExecutionResult<TData = Record<string, unknown>, TOutput = unknown> {
  agentRole: AgentRole;
  ok: boolean;
  summary: string;
  nextAction?: string;
  data: TData;
  warnings: string[];
  output: TOutput;
}

export interface WorkflowState {
  status: WorkflowStatus;
  currentStepId?: string;
  steps: WorkflowStep[];
  shared: Record<string, unknown>;
  errors: string[];
  retryCount: number;
  history: Array<{
    type: string;
    stepId?: string;
    timestamp: string;
    detail?: Record<string, unknown>;
  }>;
  startedAt?: string;
  completedAt?: string;
}

export interface WorkflowDefinition {
  type: WorkflowType;
  name: string;
  steps: Array<{
    id: string;
    title: string;
    actor?: AgentRole | "system";
    continueOnError?: boolean;
    execute: (context: ManusContext, state: WorkflowState) => Promise<Record<string, unknown> | void>;
    rollback?: (context: ManusContext, state: WorkflowState) => Promise<void>;
  }>;
}

export interface WorkflowExecutionResult {
  workflowId: string;
  workflowType: WorkflowType;
  status: WorkflowStatus;
  steps: WorkflowStep[];
  shared: Record<string, unknown>;
  errors: string[];
  retryCount?: number;
  startedAt?: string;
  completedAt?: string;
}
