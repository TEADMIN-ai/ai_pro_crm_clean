import crypto from "node:crypto";
import type {
  VehicleFinanceApplication,
  VehicleFinanceAssessment,
  VehicleFinanceCertificate,
  VehicleFinanceCustomer,
  VehicleFinanceDocument,
} from "@/types/vehicleFinance";

export const VEHICLE_FINANCE_WORKFLOW_STAGE_IDS = [
  "new-application",
  "validation",
  "consultant-assignment",
  "customer-contact",
  "documents-outstanding",
  "documents-verified",
  "credit-assessment",
  "bank-submission",
  "awaiting-bank-decision",
  "approved",
  "declined",
  "vehicle-allocation",
  "contract-preparation",
  "contract-signed",
  "delivery-scheduled",
  "vehicle-delivered",
  "after-sales-follow-up",
  "deal-closed",
] as const;

export type VehicleFinanceWorkflowStageId = (typeof VEHICLE_FINANCE_WORKFLOW_STAGE_IDS)[number];
export type VehicleFinanceWorkflowStatus = "active" | "waiting" | "blocked" | "completed";
export type VehicleFinanceWorkflowTone = "grey" | "blue" | "green" | "amber" | "orange" | "red";
export type VehicleFinanceWorkflowTaskStatus = "open" | "in_progress" | "done" | "blocked";
export type VehicleFinanceWorkflowTaskPriority = "LOW" | "NORMAL" | "HIGH" | "URGENT";

export interface VehicleFinanceWorkflowStageDefinition {
  stageId: VehicleFinanceWorkflowStageId;
  label: string;
  nextAction: string;
  tone: VehicleFinanceWorkflowTone;
}

export interface VehicleFinanceWorkflowSnapshot {
  applicationId: string;
  stageId: VehicleFinanceWorkflowStageId;
  stageLabel: string;
  stageIndex: number;
  stageTone: VehicleFinanceWorkflowTone;
  status: VehicleFinanceWorkflowStatus;
  progressPercentage: number;
  completedStageIds: VehicleFinanceWorkflowStageId[];
  stepTimestamps: Partial<Record<VehicleFinanceWorkflowStageId, string>>;
  nextRequiredAction: string;
  nextRequiredActionKey: string;
  assignedConsultantUid: string | null;
  assignedConsultantName: string | null;
  nextTaskId: string | null;
  nextTaskDueAt: string | null;
  nextTaskPriority: VehicleFinanceWorkflowTaskPriority;
  aiRiskScore: number | null;
  aiAffordabilityAssessment: string | null;
  aiDocumentCompleteness: number | null;
  aiMissingInformation: string[];
  aiRecommendedNextAction: string | null;
  aiSuggestedBanks: string[];
  createdAt: string;
  updatedAt: string;
}

export interface VehicleFinanceWorkflowTask {
  taskId: string;
  applicationId: string;
  stageId: VehicleFinanceWorkflowStageId;
  title: string;
  description: string;
  assignedUser: string | null;
  assignedUserName: string | null;
  priority: VehicleFinanceWorkflowTaskPriority;
  dueDate: string;
  status: VehicleFinanceWorkflowTaskStatus;
  escalationRule: string;
  reminderRule: string;
  completionDate: string | null;
  auditTrail: Array<{ timestamp: string; action: string; user: string | null; note: string }>;
  createdAt: string;
  updatedAt: string;
}

export interface VehicleFinanceWorkflowTimelineEvent {
  eventId: string;
  applicationId: string;
  stageId: VehicleFinanceWorkflowStageId;
  type: string;
  title: string;
  notes: string;
  actorId: string | null;
  actorName: string | null;
  timestamp: string;
  relatedDocuments: string[];
  metadata: Record<string, unknown>;
  immutable: true;
}

export interface VehicleFinanceWorkflowContext {
  application: VehicleFinanceApplication;
  customer?: VehicleFinanceCustomer | null;
  documents?: VehicleFinanceDocument[];
  assessment?: VehicleFinanceAssessment | null;
  certificate?: VehicleFinanceCertificate | null;
  existingWorkflow?: Partial<VehicleFinanceWorkflowSnapshot> | null;
  actor?: { actorId?: string; actorName?: string; actorRole?: string };
  now?: Date;
}

export const VEHICLE_FINANCE_WORKFLOW_STAGES: VehicleFinanceWorkflowStageDefinition[] = [
  { stageId: "new-application", label: "New Application", nextAction: "Assign Consultant", tone: "grey" },
  { stageId: "validation", label: "Validation", nextAction: "Validate Submitted Data", tone: "blue" },
  { stageId: "consultant-assignment", label: "Consultant Assignment", nextAction: "Assign Consultant", tone: "amber" },
  { stageId: "customer-contact", label: "Customer Contact", nextAction: "Contact Customer", tone: "blue" },
  { stageId: "documents-outstanding", label: "Documents Outstanding", nextAction: "Request Missing Documents", tone: "amber" },
  { stageId: "documents-verified", label: "Documents Verified", nextAction: "Proceed to Credit Assessment", tone: "green" },
  { stageId: "credit-assessment", label: "Credit Assessment", nextAction: "Review Affordability", tone: "blue" },
  { stageId: "bank-submission", label: "Bank Submission", nextAction: "Submit to Bank", tone: "blue" },
  { stageId: "awaiting-bank-decision", label: "Awaiting Bank Decision", nextAction: "Await Bank Decision", tone: "amber" },
  { stageId: "approved", label: "Approved", nextAction: "Prepare Contract Pack", tone: "green" },
  { stageId: "declined", label: "Declined", nextAction: "Close Declined File", tone: "red" },
  { stageId: "vehicle-allocation", label: "Vehicle Allocation", nextAction: "Allocate Vehicle", tone: "blue" },
  { stageId: "contract-preparation", label: "Contract Preparation", nextAction: "Prepare Contracts", tone: "blue" },
  { stageId: "contract-signed", label: "Contract Signed", nextAction: "Capture Signature", tone: "green" },
  { stageId: "delivery-scheduled", label: "Delivery Scheduled", nextAction: "Schedule Delivery", tone: "amber" },
  { stageId: "vehicle-delivered", label: "Vehicle Delivered", nextAction: "Confirm Delivery", tone: "green" },
  { stageId: "after-sales-follow-up", label: "After-Sales Follow-up", nextAction: "Schedule Follow-up", tone: "blue" },
  { stageId: "deal-closed", label: "Deal Closed", nextAction: "Archive File", tone: "green" },
];

const STAGE_INDEX = new Map(VEHICLE_FINANCE_WORKFLOW_STAGES.map((stage, index) => [stage.stageId, index]));
const REQUIRED_DOCUMENT_TYPES = ["saIdDocument", "driversLicense", "payslip", "bankStatement", "proofOfAddress", "employmentLetter"] as const;

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function nowIso(now?: Date): string {
  return (now ?? new Date()).toISOString();
}

function stageIndex(stageId: VehicleFinanceWorkflowStageId): number {
  return STAGE_INDEX.get(stageId) ?? 0;
}

function stageById(stageId: VehicleFinanceWorkflowStageId): VehicleFinanceWorkflowStageDefinition {
  return VEHICLE_FINANCE_WORKFLOW_STAGES[stageIndex(stageId)];
}

function nextActionKey(stageId: VehicleFinanceWorkflowStageId): string {
  return stageById(stageId).nextAction.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function completedStageIds(stageId: VehicleFinanceWorkflowStageId): VehicleFinanceWorkflowStageId[] {
  return VEHICLE_FINANCE_WORKFLOW_STAGES.slice(0, stageIndex(stageId)).map((stage) => stage.stageId);
}

function documentCoverage(documents: VehicleFinanceDocument[] = []): { missing: string[]; completeness: number } {
  const present = new Set(documents.map((document) => document.documentType));
  const missing = REQUIRED_DOCUMENT_TYPES.filter((documentType) => !present.has(documentType));
  const completeness = Math.max(0, Math.round(((REQUIRED_DOCUMENT_TYPES.length - missing.length) / REQUIRED_DOCUMENT_TYPES.length) * 100));
  return { missing, completeness };
}

function isDeclined(application: VehicleFinanceApplication, assessment?: VehicleFinanceAssessment | null): boolean {
  return application.applicationStatus === "REJECTED" || assessment?.verificationStatus === "FLAGGED";
}

function isApproved(assessment?: VehicleFinanceAssessment | null): boolean {
  return assessment?.verificationStatus === "VERIFIED";
}

function determineStageId(context: VehicleFinanceWorkflowContext): VehicleFinanceWorkflowStageId {
  const documents = context.documents ?? [];
  const coverage = documentCoverage(documents);

  if (context.certificate) return "deal-closed";
  if (isDeclined(context.application, context.assessment)) return "declined";
  if (isApproved(context.assessment) && coverage.missing.length === 0) return "approved";
  if (context.assessment?.verificationStatus === "REVIEW") return "credit-assessment";
  if (context.assessment?.verificationStatus === "PENDING" && coverage.missing.length === 0) return "documents-verified";
  if (coverage.missing.length > 0) return documents.length > 0 ? "documents-outstanding" : "new-application";
  return documents.length > 0 ? "validation" : "new-application";
}

function determineStatus(stageId: VehicleFinanceWorkflowStageId): VehicleFinanceWorkflowStatus {
  if (stageId === "deal-closed") return "completed";
  if (stageId === "declined") return "blocked";
  if (stageId === "awaiting-bank-decision" || stageId === "documents-outstanding" || stageId === "delivery-scheduled") return "waiting";
  return "active";
}

function taskPriority(stageId: VehicleFinanceWorkflowStageId): VehicleFinanceWorkflowTaskPriority {
  if (stageId === "documents-outstanding" || stageId === "awaiting-bank-decision" || stageId === "declined") return "URGENT";
  if (stageId === "credit-assessment" || stageId === "bank-submission" || stageId === "delivery-scheduled") return "HIGH";
  return "NORMAL";
}

function taskDueDate(stageId: VehicleFinanceWorkflowStageId, now: Date): string {
  const hours = stageId === "documents-outstanding" ? 4 : stageId === "awaiting-bank-decision" ? 24 : 12;
  return new Date(now.getTime() + hours * 60 * 60 * 1000).toISOString();
}

export function buildVehicleFinanceWorkflowSnapshot(context: VehicleFinanceWorkflowContext): VehicleFinanceWorkflowSnapshot {
  const now = context.now ?? new Date();
  const stageId = determineStageId(context);
  const stage = stageById(stageId);
  const coverage = documentCoverage(context.documents ?? []);
  const taskId = asString(context.existingWorkflow?.nextTaskId) || `vehicle-finance-task-${context.application.applicationId}`;
  return {
    applicationId: context.application.applicationId,
    stageId,
    stageLabel: stage.label,
    stageIndex: stageIndex(stageId),
    stageTone: stage.tone,
    status: determineStatus(stageId),
    progressPercentage: Math.min(100, Math.round((completedStageIds(stageId).length / VEHICLE_FINANCE_WORKFLOW_STAGES.length) * 100)),
    completedStageIds: completedStageIds(stageId),
    stepTimestamps: (context.existingWorkflow?.stepTimestamps ?? {}) as Partial<Record<VehicleFinanceWorkflowStageId, string>>,
    nextRequiredAction: stage.nextAction,
    nextRequiredActionKey: nextActionKey(stageId),
    assignedConsultantUid: asString(context.existingWorkflow?.assignedConsultantUid) || null,
    assignedConsultantName: asString(context.existingWorkflow?.assignedConsultantName) || null,
    nextTaskId: stageId === "deal-closed" ? null : taskId,
    nextTaskDueAt: stageId === "deal-closed" ? null : taskDueDate(stageId, now),
    nextTaskPriority: taskPriority(stageId),
    aiRiskScore: context.assessment?.overallFraudScore ?? null,
    aiAffordabilityAssessment: null,
    aiDocumentCompleteness: coverage.completeness,
    aiMissingInformation: coverage.missing,
    aiRecommendedNextAction: stage.nextAction,
    aiSuggestedBanks: [],
    createdAt: asString(context.existingWorkflow?.createdAt) || nowIso(now),
    updatedAt: nowIso(now),
  };
}

export function buildVehicleFinanceWorkflowTask(snapshot: VehicleFinanceWorkflowSnapshot, context: VehicleFinanceWorkflowContext): VehicleFinanceWorkflowTask | null {
  if (!snapshot.nextTaskId) return null;
  const now = context.now ?? new Date();
  return {
    taskId: snapshot.nextTaskId,
    applicationId: snapshot.applicationId,
    stageId: snapshot.stageId,
    title: snapshot.nextRequiredAction,
    description: `Next required action for application ${snapshot.applicationId}: ${snapshot.nextRequiredAction}`,
    assignedUser: snapshot.assignedConsultantUid,
    assignedUserName: snapshot.assignedConsultantName,
    priority: snapshot.nextTaskPriority,
    dueDate: snapshot.nextTaskDueAt ?? taskDueDate(snapshot.stageId, now),
    status: "open",
    escalationRule: "Escalate to manager after due date",
    reminderRule: "Remind assigned user every 12 hours until complete",
    completionDate: null,
    auditTrail: [{ timestamp: nowIso(now), action: "created", user: context.actor?.actorId ?? null, note: snapshot.nextRequiredAction }],
    createdAt: nowIso(now),
    updatedAt: nowIso(now),
  };
}

export function buildVehicleFinanceWorkflowEvent(snapshot: VehicleFinanceWorkflowSnapshot, context: VehicleFinanceWorkflowContext, title: string, notes: string, type = "workflow.updated", relatedDocuments: string[] = []): VehicleFinanceWorkflowTimelineEvent {
  const now = context.now ?? new Date();
  return {
    eventId: `vehicle-finance-event-${crypto.randomUUID()}`,
    applicationId: snapshot.applicationId,
    stageId: snapshot.stageId,
    type,
    title,
    notes,
    actorId: context.actor?.actorId ?? null,
    actorName: context.actor?.actorName ?? null,
    timestamp: nowIso(now),
    relatedDocuments,
    metadata: { stageId: snapshot.stageId, nextRequiredAction: snapshot.nextRequiredAction, status: snapshot.status },
    immutable: true,
  };
}

export function getVehicleFinanceWorkflowStageLabel(stageId: VehicleFinanceWorkflowStageId): string {
  return stageById(stageId).label;
}

export function getVehicleFinanceWorkflowProgress(stageId: VehicleFinanceWorkflowStageId): number {
  return Math.min(100, Math.round((stageIndex(stageId) / Math.max(1, VEHICLE_FINANCE_WORKFLOW_STAGES.length - 1)) * 100));
}

export function listVehicleFinanceWorkflowRequiredDocuments(): readonly string[] {
  return REQUIRED_DOCUMENT_TYPES;
}
