import { getFirebaseAdmin } from "@/lib/firebase/admin";
import type { AuthorizedUser } from "@/lib/server/authz";
import { recordAuditLog } from "@/server/services/auditLogService";
import type { AuditLogAction } from "@/types/auditLog";
import type { ContractorTimelineItem } from "@/types/intelligenceCenter";

export type ContractorNoteType =
  | "INFO"
  | "ACTION_REQUIRED"
  | "CLIENT_CONTACT"
  | "APPROVAL"
  | "WARNING"
  | "REJECTION";

export type ContractorCommandNote = {
  id: string;
  contractorId: string;
  authorId: string;
  authorName: string;
  authorRole: string;
  noteType: ContractorNoteType;
  title: string;
  message: string;
  createdAt: string;
};

export type ContractorLastAction = {
  id: string;
  actionType: string;
  summary: string;
  performedBy: string;
  timestamp: string;
  nextAction: string;
};

const CONTRACTOR_NOTES_COLLECTION = "contractorNotes";

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function toMillis(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (value && typeof value === "object" && "toMillis" in value && typeof value.toMillis === "function") {
    const millis = value.toMillis();
    return typeof millis === "number" && Number.isFinite(millis) ? millis : null;
  }
  if (value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    const date = value.toDate() as Date;
    return Number.isNaN(date.getTime()) ? null : date.getTime();
  }
  if (value && typeof value === "object" && "seconds" in value && typeof value.seconds === "number") {
    return value.seconds * 1000;
  }
  return null;
}

function toIso(value: unknown, fallback = Date.now()): string {
  return new Date(toMillis(value) ?? fallback).toISOString();
}

function normalizeNoteType(value: unknown): ContractorNoteType {
  switch (value) {
    case "ACTION_REQUIRED":
    case "CLIENT_CONTACT":
    case "APPROVAL":
    case "WARNING":
    case "REJECTION":
      return value;
    case "INFO":
    default:
      return "INFO";
  }
}

function displayNameForActor(actor: AuthorizedUser): string {
  return actor.email?.trim() || actor.uid;
}

function noteAuditAction(noteType: ContractorNoteType): AuditLogAction {
  return noteType === "CLIENT_CONTACT" ? "CLIENT_CONTACT_RECORDED" : "ACCOUNT_NOTE_CREATED";
}

function timelineLabel(eventType: string): string {
  return eventType
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function noteToTimelineItem(note: ContractorCommandNote): ContractorTimelineItem {
  return {
    id: note.id,
    eventType: note.noteType === "CLIENT_CONTACT" ? "CLIENT_CONTACT_RECORDED" : "ACCOUNT_NOTE_CREATED",
    label: note.noteType === "CLIENT_CONTACT" ? "Client Contact Recorded" : "Command Note Created",
    timestamp: note.createdAt,
    contractorId: note.contractorId,
    targetId: note.id,
    metadata: {
      noteType: note.noteType,
      title: note.title,
      message: note.message,
      actorName: note.authorName,
      actorRole: note.authorRole,
      source: "contractorNotes",
    },
  };
}

export function normalizeContractorCommandNote(id: string, data: Record<string, unknown>): ContractorCommandNote | null {
  const contractorId = asString(data.contractorId);
  const message = asString(data.message);
  if (!contractorId || !message) return null;

  return {
    id,
    contractorId,
    authorId: asString(data.authorId) ?? "unknown",
    authorName: asString(data.authorName) ?? asString(data.authorId) ?? "Unknown",
    authorRole: asString(data.authorRole) ?? "unknown",
    noteType: normalizeNoteType(data.noteType),
    title: asString(data.title) ?? "Contractor note",
    message,
    createdAt: toIso(data.createdAt),
  };
}

export async function createContractorCommandNote(input: {
  contractorId: string;
  noteType: ContractorNoteType;
  title: string;
  message: string;
  actor: AuthorizedUser;
}): Promise<ContractorCommandNote> {
  const now = new Date();
  const payload = {
    contractorId: input.contractorId,
    authorId: input.actor.uid,
    authorName: displayNameForActor(input.actor),
    authorRole: input.actor.role,
    noteType: input.noteType,
    title: input.title.trim(),
    message: input.message.trim(),
    createdAt: now,
  };

  const ref = await getFirebaseAdmin().collection(CONTRACTOR_NOTES_COLLECTION).add(payload);
  await recordAuditLog({
    userId: input.actor.uid,
    action: noteAuditAction(input.noteType),
    entityType: "contractor",
    entityId: input.contractorId,
    metadata: {
      contractorId: input.contractorId,
      noteId: ref.id,
      noteType: input.noteType,
      title: payload.title,
      message: payload.message,
      authorName: payload.authorName,
    },
  });

  return {
    ...payload,
    id: ref.id,
    createdAt: now.toISOString(),
  };
}

export async function listContractorCommandNotes(contractorId: string, limit = 100): Promise<ContractorCommandNote[]> {
  const snapshot = await getFirebaseAdmin()
    .collection(CONTRACTOR_NOTES_COLLECTION)
    .where("contractorId", "==", contractorId)
    .limit(limit)
    .get();

  return snapshot.docs
    .map((doc) => normalizeContractorCommandNote(doc.id, (doc.data() ?? {}) as Record<string, unknown>))
    .filter((note): note is ContractorCommandNote => Boolean(note))
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
}

export async function listRecentTeamActivity(limit = 12): Promise<ContractorTimelineItem[]> {
  const snapshot = await getFirebaseAdmin().collection("auditLogs").orderBy("timestamp", "desc").limit(limit).get();

  return snapshot.docs.map((doc) => {
    const data = (doc.data() ?? {}) as Record<string, unknown>;
    const metadata = asRecord(data.metadata);
    const eventType = asString(data.eventType) ?? asString(data.action) ?? "AUDIT_EVENT";
    const contractorId = asString(data.contractorId) ?? asString(metadata.contractorId) ?? "";
    const actor = asString(metadata.authorName) ?? asString(metadata.reviewedBy) ?? asString(data.actorId) ?? asString(data.userId) ?? "System";
    const targetId = asString(data.targetId) ?? asString(data.entityId);

    return {
      id: doc.id,
      eventType,
      label: timelineLabel(eventType),
      timestamp: toIso(data.timestamp),
      contractorId,
      targetId,
      metadata: {
        ...metadata,
        actorName: actor,
      },
    };
  });
}

export async function buildContractorOperationalTimeline(contractorId: string): Promise<ContractorTimelineItem[]> {
  const db = getFirebaseAdmin();
  const contractorRef = db.collection("contractors").doc(contractorId);
  const [contractorSnapshot, documentsSnapshot, auditSnapshot, decisionSnapshot, notes] = await Promise.all([
    contractorRef.get(),
    contractorRef.collection("documents").get(),
    db.collection("auditLogs").limit(200).get(),
    db.collection("decisionLogs").where("contractorId", "==", contractorId).limit(100).get(),
    listContractorCommandNotes(contractorId),
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
        metadata: { documentType: doc.id, fileName: data.fileName ?? null },
      });
    }
    if (data.analysisTimestamp) {
      items.push({
        id: `${doc.id}-analysis`,
        eventType: "AI_ANALYSIS_EXECUTED",
        label: "AI Analysis Completed",
        timestamp: toIso(data.analysisTimestamp),
        contractorId,
        targetId: doc.id,
        metadata: { documentType: doc.id, extractionSource: data.extractionSource ?? null },
      });
    }
    if (data.verifiedAt || data.verificationStatus === "VERIFIED_MANUAL" || data.validationStatus === "PASS") {
      const manual = data.verificationStatus === "VERIFIED_MANUAL" || data.verificationMethod === "MANUAL";
      items.push({
        id: `${doc.id}-approval`,
        eventType: manual ? "DOCUMENT_APPROVED_MANUAL" : "DOCUMENT_APPROVED",
        label: manual ? "Manual Approval Completed" : "Approval Completed",
        timestamp: toIso(data.verifiedAt ?? data.updatedAt),
        contractorId,
        targetId: doc.id,
        metadata: { documentType: doc.id, verificationMethod: data.verificationMethod ?? "AI" },
      });
    }
    if (data.rejectedAt || data.verificationStatus === "REJECTED_MANUAL") {
      items.push({
        id: `${doc.id}-rejection`,
        eventType: "DOCUMENT_REJECTED_MANUAL",
        label: "Manual Rejection Completed",
        timestamp: toIso(data.rejectedAt ?? data.updatedAt),
        contractorId,
        targetId: doc.id,
        metadata: { documentType: doc.id, reason: data.rejectionReason ?? data.reviewReason ?? null },
      });
    }
  }

  for (const doc of auditSnapshot.docs) {
    const data = (doc.data() ?? {}) as Record<string, unknown>;
    const metadata = asRecord(data.metadata);
    const auditContractorId = asString(data.contractorId) ?? asString(metadata.contractorId) ?? asString(data.entityId);
    if (auditContractorId !== contractorId) {
      continue;
    }
    const eventType = asString(data.eventType) ?? asString(data.action) ?? "AUDIT_EVENT";
    items.push({
      id: doc.id,
      eventType,
      label: timelineLabel(eventType),
      timestamp: toIso(data.timestamp),
      contractorId,
      targetId: asString(data.targetId) ?? asString(data.entityId),
      metadata,
    });
  }

  for (const doc of decisionSnapshot.docs) {
    const data = (doc.data() ?? {}) as Record<string, unknown>;
    items.push({
      id: doc.id,
      eventType: "READINESS_CHANGED",
      label: "Readiness Changed",
      timestamp: toIso(data.timestamp),
      contractorId,
      targetId: contractorId,
      metadata: {
        previousReadinessScore: data.previousReadinessScore ?? null,
        newReadinessScore: data.newReadinessScore ?? null,
        reasonForChange: data.reasonForChange ?? data.reason ?? null,
      },
    });
  }

  items.push(...notes.map(noteToTimelineItem));

  return items.sort((left, right) => Date.parse(right.timestamp) - Date.parse(left.timestamp));
}

export function buildLastAction(timeline: ContractorTimelineItem[]): ContractorLastAction | null {
  const latest = timeline[0];
  if (!latest) return null;

  const title = asString(latest.metadata.title);
  const message = asString(latest.metadata.message);
  const documentType = asString(latest.metadata.documentType);
  const reason = asString(latest.metadata.reason) ?? asString(latest.metadata.reasonForChange);
  const summary = title ?? message ?? (documentType ? `${latest.label}: ${documentType}` : latest.label);
  const nextAction =
    latest.eventType.includes("REJECT") || latest.eventType === "ACTION_REQUIRED"
      ? "Resolve the rejection or action item"
      : latest.eventType.includes("UPLOAD") || latest.eventType.includes("ANALYSIS")
        ? "Review verification status"
        : "Monitor contractor progress";

  return {
    id: latest.id,
    actionType: latest.eventType,
    summary: reason ? `${summary} - ${reason}` : summary,
    performedBy: asString(latest.metadata.actorName) ?? asString(latest.metadata.authorName) ?? "System",
    timestamp: latest.timestamp,
    nextAction,
  };
}
