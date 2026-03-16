import { getFirebaseAdmin } from "@/lib/firebase/admin";
import type { AuditLogAction, AuditLogEntityType, AuditLogEntry } from "@/types/auditLog";

const AUDIT_LOGS_COLLECTION = "auditLogs";

function toMillis(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (value && typeof value === "object" && "toMillis" in value && typeof value.toMillis === "function") {
    return value.toMillis();
  }

  return undefined;
}

function toIsoDate(value: unknown): string {
  const millis = toMillis(value);
  return typeof millis === "number" ? new Date(millis).toISOString() : new Date().toISOString();
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback;
}

function normalizeAuditLogEntry(id: string, data: Record<string, unknown>): AuditLogEntry {
  return {
    id,
    userId: asString(data.userId),
    action: asString(data.action) as AuditLogAction,
    timestamp: toIsoDate(data.timestamp),
    entityType: asString(data.entityType) as AuditLogEntityType,
    entityId: asString(data.entityId),
    metadata: data.metadata && typeof data.metadata === "object" ? (data.metadata as Record<string, unknown>) : undefined,
  };
}

export async function recordAuditLog(input: {
  userId: string;
  action: AuditLogAction;
  entityType: AuditLogEntityType;
  entityId: string;
  metadata?: Record<string, unknown>;
}): Promise<AuditLogEntry> {
  const payload = {
    userId: input.userId.trim(),
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId.trim(),
    metadata: input.metadata ?? {},
    timestamp: new Date(),
  };

  const docRef = await getFirebaseAdmin().collection(AUDIT_LOGS_COLLECTION).add(payload);
  const saved = await docRef.get();
  return normalizeAuditLogEntry(saved.id, (saved.data() ?? {}) as Record<string, unknown>);
}

export async function listAuditLogs(filters?: {
  userId?: string;
  action?: AuditLogAction;
  entityType?: AuditLogEntityType;
  entityId?: string;
}): Promise<AuditLogEntry[]> {
  let query: FirebaseFirestore.Query = getFirebaseAdmin().collection(AUDIT_LOGS_COLLECTION);

  if (filters?.userId) {
    query = query.where("userId", "==", filters.userId.trim());
  }
  if (filters?.action) {
    query = query.where("action", "==", filters.action);
  }
  if (filters?.entityType) {
    query = query.where("entityType", "==", filters.entityType);
  }
  if (filters?.entityId) {
    query = query.where("entityId", "==", filters.entityId.trim());
  }

  const snapshot = await query.orderBy("timestamp", "desc").limit(200).get();
  return snapshot.docs.map((doc) => normalizeAuditLogEntry(doc.id, (doc.data() ?? {}) as Record<string, unknown>));
}
