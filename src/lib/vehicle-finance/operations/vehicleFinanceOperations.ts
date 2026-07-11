import type { VehicleFinanceApplication, VehicleFinanceDocument } from "@/types/vehicleFinance";
import { getVehicleFinanceDocumentLabel, type VehicleFinanceDocumentType } from "@/types/vehicleFinance";
import type { VehicleFinanceWorkflowSnapshot, VehicleFinanceWorkflowTask } from "@/lib/vehicle-finance/workflow";

export type VehicleFinanceAssignmentRecord = {
  applicationId: string;
  assignedConsultantUid: string | null;
  assignedConsultantName: string | null;
  assignedSalesManagerUid: string | null;
  assignedSalesManagerName: string | null;
  assignedFinanceManagerUid: string | null;
  assignedFinanceManagerName: string | null;
  assignmentTimestamp: string | null;
  assignmentHistory: Array<{
    timestamp: string;
    actorId: string | null;
    actorName: string | null;
    reason: string;
    previousValue: Record<string, string | null>;
    nextValue: Record<string, string | null>;
  }>;
  updatedAt: string;
}

export type VehicleFinanceDocumentChecklistItem = {
  documentType: VehicleFinanceDocumentType;
  label: string;
  received: boolean;
  verified: boolean;
  rejected: boolean;
  outstanding: boolean;
  documentId: string | null;
  updatedAt: string | null;
};

export type VehicleFinanceDocumentChecklistSummary = {
  items: VehicleFinanceDocumentChecklistItem[];
  receivedCount: number;
  verifiedCount: number;
  rejectedCount: number;
  outstandingCount: number;
  completionPercentage: number;
};

export type VehicleFinanceTaskSummary = {
  totalCount: number;
  openCount: number;
  inProgressCount: number;
  doneCount: number;
  blockedCount: number;
  overdueCount: number;
};

export type VehicleFinanceNotificationRecord = {
  notificationId: string;
  applicationId: string | null;
  title: string;
  message: string;
  channel: "dashboard" | "email" | "future-whatsapp" | "future-sms";
  audience: string[];
  unread: boolean;
  priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  createdAt: string;
  updatedAt: string;
  readAt: string | null;
  actorId: string | null;
  actorName: string | null;
  actorRole: string | null;
  metadata: Record<string, unknown>;
}

export type VehicleFinanceOperationalSummary = {
  assignment: VehicleFinanceAssignmentRecord;
  checklist: VehicleFinanceDocumentChecklistSummary;
  tasks: VehicleFinanceTaskSummary;
  unreadNotifications: number;
};

const REQUIRED_DOCUMENT_TYPES: VehicleFinanceDocumentType[] = [
  "saIdDocument",
  "driversLicense",
  "payslip",
  "bankStatement",
  "proofOfAddress",
  "employmentLetter",
];

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function nowIso(now?: Date): string {
  return (now ?? new Date()).toISOString();
}

function normalizeDocument(document: VehicleFinanceDocument) {
  const analysis = document.aiAnalysis as Record<string, unknown> & {
    verificationStatus?: string;
    documentIntegrityScore?: number;
  };

  const documentIntegrityScore = typeof analysis.documentIntegrityScore === "number" && Number.isFinite(analysis.documentIntegrityScore)
    ? analysis.documentIntegrityScore
    : null;
  const verificationStatus = asString(analysis.verificationStatus);

  return {
    document,
    documentIntegrityScore,
    verificationStatus,
  };
}

export function buildVehicleFinanceAssignmentRecord(args: {
  application: VehicleFinanceApplication;
  snapshot?: VehicleFinanceWorkflowSnapshot | null;
  now?: Date;
}): VehicleFinanceAssignmentRecord {
  const snapshot = args.snapshot ?? (args.application.workflowSnapshot as VehicleFinanceWorkflowSnapshot | null | undefined) ?? null;
  const history = Array.isArray((args.application as Record<string, unknown>).assignmentHistory)
    ? ((args.application as Record<string, unknown>).assignmentHistory as VehicleFinanceAssignmentRecord["assignmentHistory"])
    : [];

  return {
    applicationId: args.application.applicationId,
    assignedConsultantUid: asString(snapshot?.assignedConsultantUid) || asString((args.application as Record<string, unknown>).assignedConsultantUid) || null,
    assignedConsultantName: asString(snapshot?.assignedConsultantName) || asString((args.application as Record<string, unknown>).assignedConsultantName) || null,
    assignedSalesManagerUid: asString((args.application as Record<string, unknown>).assignedSalesManagerUid) || null,
    assignedSalesManagerName: asString((args.application as Record<string, unknown>).assignedSalesManagerName) || null,
    assignedFinanceManagerUid: asString((args.application as Record<string, unknown>).assignedFinanceManagerUid) || null,
    assignedFinanceManagerName: asString((args.application as Record<string, unknown>).assignedFinanceManagerName) || null,
    assignmentTimestamp: asString((args.application as Record<string, unknown>).assignmentTimestamp) || snapshot?.updatedAt || null,
    assignmentHistory: history,
    updatedAt: nowIso(args.now),
  };
}

export function buildVehicleFinanceDocumentChecklist(documents: VehicleFinanceDocument[]): VehicleFinanceDocumentChecklistSummary {
  const normalized = new Map(REQUIRED_DOCUMENT_TYPES.map((documentType) => [documentType, null as VehicleFinanceDocument | null]));

  for (const document of documents) {
    if (normalized.has(document.documentType)) {
      normalized.set(document.documentType, document);
    }
  }

  const items = REQUIRED_DOCUMENT_TYPES.map((documentType) => {
    const document = normalized.get(documentType) ?? null;
    const { documentIntegrityScore, verificationStatus } = document ? normalizeDocument(document) : { documentIntegrityScore: null, verificationStatus: "" };
    const received = Boolean(document);
    const verified = Boolean(document) && (verificationStatus === "VERIFIED" || (documentIntegrityScore ?? 0) >= 70);
    const rejected = verificationStatus === "FLAGGED" || verificationStatus === "REJECTED";
    const outstanding = !received || (!verified && !rejected);

    return {
      documentType,
      label: getVehicleFinanceDocumentLabel(documentType),
      received,
      verified,
      rejected,
      outstanding,
      documentId: document?.documentId ?? null,
      updatedAt: document?.uploadedAt ?? null,
    } satisfies VehicleFinanceDocumentChecklistItem;
  });

  const receivedCount = items.filter((item) => item.received).length;
  const verifiedCount = items.filter((item) => item.verified).length;
  const rejectedCount = items.filter((item) => item.rejected).length;
  const outstandingCount = items.filter((item) => item.outstanding).length;
  const completionPercentage = REQUIRED_DOCUMENT_TYPES.length > 0
    ? Math.round((verifiedCount / REQUIRED_DOCUMENT_TYPES.length) * 100)
    : 0;

  return {
    items,
    receivedCount,
    verifiedCount,
    rejectedCount,
    outstandingCount,
    completionPercentage,
  };
}

export function summarizeVehicleFinanceTasks(tasks: VehicleFinanceWorkflowTask[], now = new Date()): VehicleFinanceTaskSummary {
  const nowMs = now.getTime();
  const totalCount = tasks.length;
  const openCount = tasks.filter((task) => task.status === "open").length;
  const inProgressCount = tasks.filter((task) => task.status === "in_progress").length;
  const doneCount = tasks.filter((task) => task.status === "done").length;
  const blockedCount = tasks.filter((task) => task.status === "blocked").length;
  const overdueCount = tasks.filter((task) => task.status !== "done" && Date.parse(task.dueDate) < nowMs).length;

  return {
    totalCount,
    openCount,
    inProgressCount,
    doneCount,
    blockedCount,
    overdueCount,
  };
}

export function buildVehicleFinanceOperationalSummary(args: {
  application: VehicleFinanceApplication;
  tasks?: VehicleFinanceWorkflowTask[];
  documents?: VehicleFinanceDocument[];
  notifications?: VehicleFinanceNotificationRecord[];
  now?: Date;
}): VehicleFinanceOperationalSummary {
  const checklist = buildVehicleFinanceDocumentChecklist(args.documents ?? []);
  const assignment = buildVehicleFinanceAssignmentRecord({ application: args.application, snapshot: args.application.workflowSnapshot as VehicleFinanceWorkflowSnapshot | null | undefined, now: args.now });
  const tasks = summarizeVehicleFinanceTasks(args.tasks ?? [], args.now ?? new Date());
  const unreadNotifications = (args.notifications ?? []).filter((notification) => notification.unread).length;

  return {
    assignment,
    checklist,
    tasks,
    unreadNotifications,
  };
}

export function buildVehicleFinanceApplicationSearchText(application: VehicleFinanceApplication, customer?: { firstName?: string; lastName?: string; phone?: string; email?: string } | null, documents: VehicleFinanceDocument[] = []): string {
  const documentText = documents.map((document) => `${document.fileName} ${document.documentType} ${document.extractedText}`).join(" ");
  return [
    application.applicationId,
    application.customerId,
    application.vehicleId,
    application.vehicleTitle ?? "",
    application.dealerName,
    customer ? `${customer.firstName ?? ""} ${customer.lastName ?? ""}` : "",
    customer?.phone ?? "",
    customer?.email ?? "",
    documentText,
    application.workflowStageLabel ?? "",
    application.workflowNextRequiredAction ?? "",
    application.aiRecommendedNextAction ?? "",
  ]
    .join(" ")
    .toLowerCase();
}

export function searchVehicleFinanceApplications(args: {
  query: string;
  applications: VehicleFinanceApplication[];
  customers?: Array<{ customerId: string; firstName: string; lastName: string; phone: string; email: string }> ;
  documents?: VehicleFinanceDocument[];
}): VehicleFinanceApplication[] {
  const normalizedQuery = args.query.trim().toLowerCase();
  if (!normalizedQuery) {
    return args.applications;
  }

  const customerById = new Map((args.customers ?? []).map((customer) => [customer.customerId, customer]));
  const documentsByApplication = new Map<string, VehicleFinanceDocument[]>();
  for (const document of args.documents ?? []) {
    const current = documentsByApplication.get(document.applicationId) ?? [];
    current.push(document);
    documentsByApplication.set(document.applicationId, current);
  }

  return args.applications.filter((application) => {
    const searchableText = buildVehicleFinanceApplicationSearchText(application, customerById.get(application.customerId), documentsByApplication.get(application.applicationId) ?? []);
    return searchableText.includes(normalizedQuery);
  });
}
