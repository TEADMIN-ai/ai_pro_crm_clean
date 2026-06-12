import { getFirebaseAdmin } from "@/lib/firebase/admin";
import type {
  ComplianceIntelligenceAlert,
  ContractorTimelineItem,
  DecisionLog,
  IntelligenceAuditLog,
  IntelligenceCenterOverview,
  SystemMetric,
} from "@/types/intelligenceCenter";
import { listRecentTeamActivity } from "@/server/services/contractorCommandCenterService";

const DAY_MS = 24 * 60 * 60 * 1000;
const EXPIRING_SOON_MS = 30 * DAY_MS;

function toMillis(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = new Date(value).getTime();
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (value && typeof value === "object" && "toMillis" in value && typeof value.toMillis === "function") {
    const millis = value.toMillis();
    return typeof millis === "number" && Number.isFinite(millis) ? millis : null;
  }
  if (value && typeof value === "object" && "seconds" in value && typeof value.seconds === "number") {
    return value.seconds * 1000;
  }
  return null;
}

function toIso(value: unknown, fallback = Date.now()): string {
  return new Date(toMillis(value) ?? fallback).toISOString();
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function normalizeAuditLog(id: string, data: Record<string, unknown>): IntelligenceAuditLog {
  const metadata = asRecord(data.metadata);
  const legacyAction = asString(data.action);
  const legacyEntityId = asString(data.entityId);

  return {
    id,
    eventType: asString(data.eventType) ?? legacyAction ?? "AUDIT_EVENT",
    actorId: asString(data.actorId) ?? asString(data.userId),
    actorRole: asString(data.actorRole),
    contractorId: asString(data.contractorId) ?? asString(metadata.contractorId),
    targetId: asString(data.targetId) ?? legacyEntityId,
    previousValue: data.previousValue ?? null,
    newValue: data.newValue ?? null,
    timestamp: toIso(data.timestamp),
    metadata,
  };
}

function normalizeDecisionLog(id: string, data: Record<string, unknown>): DecisionLog {
  return {
    id,
    contractorId: asString(data.contractorId),
    previousReadinessScore: asNumber(data.previousReadinessScore),
    newReadinessScore: asNumber(data.newReadinessScore),
    triggerEvent: asString(data.triggerEvent),
    reasonForChange: asString(data.reasonForChange) ?? asString(data.reason),
    timestamp: toIso(data.timestamp),
    metadata: asRecord(data.metadata),
  };
}

function normalizeSystemMetric(id: string, data: Record<string, unknown>): SystemMetric {
  return {
    id,
    metricType: asString(data.metricType) ?? "system_metric",
    route: asString(data.route),
    durationMs: asNumber(data.durationMs),
    contractorId: asString(data.contractorId),
    targetId: asString(data.targetId),
    timestamp: toIso(data.timestamp),
    metadata: asRecord(data.metadata),
  };
}

async function safeCollection(collectionName: string, limit = 200) {
  try {
    return await getFirebaseAdmin().collection(collectionName).orderBy("timestamp", "desc").limit(limit).get();
  } catch (error) {
    console.warn(`[intelligence-center] ${collectionName} timestamp ordering unavailable`, error);
    return getFirebaseAdmin().collection(collectionName).limit(limit).get();
  }
}

async function listContractors(limit = 500) {
  const snapshot = await getFirebaseAdmin().collection("contractors").limit(limit).get();
  return snapshot.docs.map((doc) => ({ id: doc.id, data: (doc.data() ?? {}) as Record<string, unknown> }));
}

async function listContractorDocuments(contractorId: string) {
  const snapshot = await getFirebaseAdmin()
    .collection("contractors")
    .doc(contractorId)
    .collection("documents")
    .get();

  return snapshot.docs.map((doc) => ({ id: doc.id, data: (doc.data() ?? {}) as Record<string, unknown> }));
}

function isToday(value: unknown, now = Date.now()): boolean {
  const millis = toMillis(value);
  if (!millis) return false;

  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start.getTime() + DAY_MS);
  return millis >= start.getTime() && millis < end.getTime();
}

function contractorName(data: Record<string, unknown>, fallback: string): string {
  return asString(data.companyName) ?? asString(data.name) ?? fallback;
}

function buildComplianceAlert(args: {
  contractorId: string;
  contractorName: string;
  documentType: string;
  expiresAt: number;
  now: number;
}): ComplianceIntelligenceAlert | null {
  const delta = args.expiresAt - args.now;
  if (delta > EXPIRING_SOON_MS) return null;

  return {
    id: `${args.contractorId}-${args.documentType}`,
    contractorId: args.contractorId,
    contractorName: args.contractorName,
    documentType: args.documentType,
    severity: delta <= 0 ? "expired" : "expiringSoon",
    expiresAt: new Date(args.expiresAt).toISOString(),
    daysUntilExpiry: Math.ceil(delta / DAY_MS),
  };
}

export async function getIntelligenceCenterOverview(): Promise<IntelligenceCenterOverview> {
  const now = Date.now();
  const [contractors, auditSnapshot, decisionSnapshot, metricsSnapshot, tenderPackSnapshot, recentTeamActivity] = await Promise.all([
    listContractors(),
    safeCollection("auditLogs"),
    safeCollection("decisionLogs"),
    safeCollection("systemMetrics"),
    getFirebaseAdmin().collection("tenderPackRequests").limit(200).get(),
    listRecentTeamActivity(),
  ]);

  const documentGroups = await Promise.all(
    contractors.map(async (contractor) => ({
      contractor,
      documents: await listContractorDocuments(contractor.id),
    })),
  );

  const auditLogs = auditSnapshot.docs.map((doc) => normalizeAuditLog(doc.id, (doc.data() ?? {}) as Record<string, unknown>));
  const decisionLogs = decisionSnapshot.docs.map((doc) => normalizeDecisionLog(doc.id, (doc.data() ?? {}) as Record<string, unknown>));
  const systemMetrics = metricsSnapshot.docs.map((doc) => normalizeSystemMetric(doc.id, (doc.data() ?? {}) as Record<string, unknown>));
  const allDocuments = documentGroups.flatMap((group) => group.documents);
  const complianceAlerts = documentGroups
    .flatMap((group) => {
      const name = contractorName(group.contractor.data, group.contractor.id);
      return group.documents.map((document) => {
        const expiresAt = toMillis(document.data.expiresAt) ?? toMillis(document.data.expiryDate);
        return typeof expiresAt === "number"
          ? buildComplianceAlert({
              contractorId: group.contractor.id,
              contractorName: name,
              documentType: document.id,
              expiresAt,
              now,
            })
          : null;
      });
    })
    .filter((alert): alert is ComplianceIntelligenceAlert => Boolean(alert))
    .sort((left, right) => new Date(left.expiresAt).getTime() - new Date(right.expiresAt).getTime());

  const metrics = {
    totalContractors: contractors.length,
    newContractors: contractors.filter((contractor) => isToday(contractor.data.createdAt, now)).length,
    readyContractors: contractors.filter((contractor) => contractor.data.tenderLockStatus === "READY").length,
    riskContractors: contractors.filter((contractor) => contractor.data.tenderLockStatus === "RISK").length,
    blockedContractors: contractors.filter((contractor) => contractor.data.tenderLockStatus === "BLOCKED").length,
    documentsUploadedToday: allDocuments.filter((document) => isToday(document.data.uploadedAt ?? document.data.updatedAt, now)).length,
    aiAnalysesToday: allDocuments.filter((document) => isToday(document.data.analysisTimestamp, now)).length,
    tenderPacksGenerated: tenderPackSnapshot.docs.filter((doc) => {
      const data = (doc.data() ?? {}) as Record<string, unknown>;
      return data.status === "generated" || Boolean(data.generatedAt);
    }).length,
    userActivityToday: auditLogs.filter((log) => isToday(log.timestamp, now)).length,
  };

  return {
    metrics,
    auditLogs,
    recentTeamActivity,
    decisionLogs,
    systemMetrics,
    complianceAlerts,
  };
}

export async function getContractorTimeline(contractorId: string): Promise<ContractorTimelineItem[]> {
  const contractorRef = getFirebaseAdmin().collection("contractors").doc(contractorId);
  const [contractorSnapshot, documentsSnapshot, auditSnapshot, decisionSnapshot] = await Promise.all([
    contractorRef.get(),
    contractorRef.collection("documents").get(),
    getFirebaseAdmin().collection("auditLogs").where("contractorId", "==", contractorId).limit(100).get(),
    getFirebaseAdmin().collection("decisionLogs").where("contractorId", "==", contractorId).limit(100).get(),
  ]);

  const items: ContractorTimelineItem[] = [];
  const contractorData = (contractorSnapshot.data() ?? {}) as Record<string, unknown>;

  if (contractorSnapshot.exists) {
    items.push({
      id: `${contractorId}-created`,
      eventType: "CONTRACTOR_CREATED",
      label: "Contractor Created",
      timestamp: toIso(contractorData.createdAt),
      contractorId,
      targetId: contractorId,
      metadata: { source: "contractors" },
    });
  }

  for (const doc of documentsSnapshot.docs) {
    const data = (doc.data() ?? {}) as Record<string, unknown>;
    const uploadedAt = data.uploadedAt ?? data.createdAt ?? data.updatedAt;
    if (uploadedAt) {
      items.push({
        id: `${doc.id}-uploaded`,
        eventType: "DOCUMENT_UPLOADED",
        label: "Document Uploaded",
        timestamp: toIso(uploadedAt),
        contractorId,
        targetId: doc.id,
        metadata: { documentType: doc.id },
      });
    }
    if (data.analysisTimestamp) {
      items.push({
        id: `${doc.id}-analysis`,
        eventType: "AI_ANALYSIS_EXECUTED",
        label: "Analysis Completed",
        timestamp: toIso(data.analysisTimestamp),
        contractorId,
        targetId: doc.id,
        metadata: { documentType: doc.id, aiStatus: data.aiStatus ?? null },
      });
    }
    if (data.verifiedAt || data.validationStatus === "PASS") {
      items.push({
        id: `${doc.id}-approval`,
        eventType: "DOCUMENT_APPROVED",
        label: "Approval Completed",
        timestamp: toIso(data.verifiedAt ?? data.updatedAt),
        contractorId,
        targetId: doc.id,
        metadata: { documentType: doc.id, validationStatus: data.validationStatus ?? null },
      });
    }
  }

  for (const doc of auditSnapshot.docs) {
    const log = normalizeAuditLog(doc.id, (doc.data() ?? {}) as Record<string, unknown>);
    items.push({
      id: log.id,
      eventType: log.eventType,
      label: log.eventType.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase()),
      timestamp: log.timestamp,
      contractorId,
      targetId: log.targetId,
      metadata: log.metadata,
    });
  }

  for (const doc of decisionSnapshot.docs) {
    const decision = normalizeDecisionLog(doc.id, (doc.data() ?? {}) as Record<string, unknown>);
    items.push({
      id: decision.id,
      eventType: "READINESS_CHANGED",
      label: "Readiness Changed",
      timestamp: decision.timestamp,
      contractorId,
      targetId: contractorId,
      metadata: {
        previousReadinessScore: decision.previousReadinessScore,
        newReadinessScore: decision.newReadinessScore,
        reasonForChange: decision.reasonForChange,
      },
    });
  }

  return items.sort((left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime());
}

export async function recordIntelligenceAuditLog(input: Omit<IntelligenceAuditLog, "id" | "timestamp"> & { timestamp?: Date }) {
  const payload = {
    eventType: input.eventType,
    actorId: input.actorId,
    actorRole: input.actorRole,
    contractorId: input.contractorId,
    targetId: input.targetId,
    previousValue: input.previousValue,
    newValue: input.newValue,
    metadata: input.metadata,
    timestamp: input.timestamp ?? new Date(),
  };
  const ref = await getFirebaseAdmin().collection("auditLogs").add(payload);
  return { ...payload, id: ref.id, timestamp: toIso(payload.timestamp) };
}

export async function recordDecisionLog(input: Omit<DecisionLog, "id" | "timestamp"> & { timestamp?: Date }) {
  const payload = {
    contractorId: input.contractorId,
    previousReadinessScore: input.previousReadinessScore,
    newReadinessScore: input.newReadinessScore,
    triggerEvent: input.triggerEvent,
    reasonForChange: input.reasonForChange,
    metadata: input.metadata,
    timestamp: input.timestamp ?? new Date(),
  };
  const ref = await getFirebaseAdmin().collection("decisionLogs").add(payload);
  return { ...payload, id: ref.id, timestamp: toIso(payload.timestamp) };
}

export async function recordSystemMetric(input: Omit<SystemMetric, "id" | "timestamp"> & { timestamp?: Date }) {
  const payload = {
    metricType: input.metricType,
    route: input.route,
    durationMs: input.durationMs,
    contractorId: input.contractorId,
    targetId: input.targetId,
    metadata: input.metadata,
    timestamp: input.timestamp ?? new Date(),
  };
  const ref = await getFirebaseAdmin().collection("systemMetrics").add(payload);
  return { ...payload, id: ref.id, timestamp: toIso(payload.timestamp) };
}
