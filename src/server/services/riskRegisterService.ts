import type { AuthorizedUser } from "@/lib/server/authz";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { buildRiskRegisterSummary } from "@/lib/risk/riskRegisterSummary";
import { recordAuditLog } from "@/server/services/auditLogService";
import type { RiskRegisterEntry, RiskRegisterSummary, RiskStatus } from "@/types/risk";

const RISK_COLLECTION = "risks";

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

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function asRiskScore(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 1;
  }

  return Math.max(1, Math.min(5, Math.round(value)));
}

function asStatus(value: unknown): RiskStatus {
  return value === "monitoring" || value === "mitigated" ? value : "open";
}

function normalizeRiskEntry(id: string, data: Record<string, unknown>): RiskRegisterEntry {
  return {
    id,
    riskTitle: asString(data.riskTitle) ?? "Untitled risk",
    riskDescription: asString(data.riskDescription) ?? "",
    riskCategory: asString(data.riskCategory) ?? "general",
    riskScore: asRiskScore(data.riskScore),
    mitigationPlan: asString(data.mitigationPlan) ?? "",
    owner: asString(data.owner) ?? "unassigned",
    status: asStatus(data.status),
    createdAt: toIsoDate(data.createdAt),
    updatedAt: toIsoDate(data.updatedAt),
    createdByUid: asString(data.createdByUid),
    updatedByUid: asString(data.updatedByUid),
  };
}

export async function listRiskRegisterEntries(_user: AuthorizedUser): Promise<RiskRegisterEntry[]> {
  const snapshot = await getFirebaseAdmin()
    .collection(RISK_COLLECTION)
    .orderBy("updatedAt", "desc")
    .get();

  return snapshot.docs.map((doc) => normalizeRiskEntry(doc.id, (doc.data() ?? {}) as Record<string, unknown>));
}

export async function getRiskRegisterSummary(user: AuthorizedUser): Promise<RiskRegisterSummary> {
  const risks = await listRiskRegisterEntries(user);
  return buildRiskRegisterSummary(risks);
}

export async function getRiskRegisterEntryById(riskId: string): Promise<RiskRegisterEntry | null> {
  const snapshot = await getFirebaseAdmin().collection(RISK_COLLECTION).doc(riskId).get();
  if (!snapshot.exists) {
    return null;
  }

  return normalizeRiskEntry(snapshot.id, (snapshot.data() ?? {}) as Record<string, unknown>);
}

export async function createRiskRegisterEntry(
  input: Omit<RiskRegisterEntry, "id" | "createdAt" | "updatedAt" | "createdByUid" | "updatedByUid">,
  actor: AuthorizedUser,
): Promise<RiskRegisterEntry> {
  const now = new Date();
  const payload = {
    ...input,
    riskScore: asRiskScore(input.riskScore),
    status: asStatus(input.status),
    createdAt: now,
    updatedAt: now,
    createdByUid: actor.uid,
    updatedByUid: actor.uid,
  };

  const docRef = await getFirebaseAdmin().collection(RISK_COLLECTION).add(payload);
  const saved = await docRef.get();
  const risk = normalizeRiskEntry(saved.id, (saved.data() ?? {}) as Record<string, unknown>);
  await recordAuditLog({
    userId: actor.uid,
    action: "risk_created",
    entityType: "risk",
    entityId: risk.id,
    metadata: {
      riskTitle: risk.riskTitle,
      status: risk.status,
      riskScore: risk.riskScore,
    },
  });
  return risk;
}

export async function updateRiskRegisterEntry(
  riskId: string,
  updates: Partial<Omit<RiskRegisterEntry, "id" | "createdAt" | "updatedAt" | "createdByUid" | "updatedByUid">>,
  actor: AuthorizedUser,
): Promise<RiskRegisterEntry | null> {
  const docRef = getFirebaseAdmin().collection(RISK_COLLECTION).doc(riskId);
  const snapshot = await docRef.get();

  if (!snapshot.exists) {
    return null;
  }

  const payload: Record<string, unknown> = {
    updatedAt: new Date(),
    updatedByUid: actor.uid,
  };

  if (typeof updates.riskTitle === "string") {
    payload.riskTitle = updates.riskTitle.trim();
  }
  if (typeof updates.riskDescription === "string") {
    payload.riskDescription = updates.riskDescription.trim();
  }
  if (typeof updates.riskCategory === "string") {
    payload.riskCategory = updates.riskCategory.trim();
  }
  if (typeof updates.riskScore === "number") {
    payload.riskScore = asRiskScore(updates.riskScore);
  }
  if (typeof updates.mitigationPlan === "string") {
    payload.mitigationPlan = updates.mitigationPlan.trim();
  }
  if (typeof updates.owner === "string") {
    payload.owner = updates.owner.trim();
  }
  if (typeof updates.status === "string") {
    payload.status = asStatus(updates.status);
  }

  await docRef.set(payload, { merge: true });
  const updated = await docRef.get();
  const risk = normalizeRiskEntry(updated.id, (updated.data() ?? {}) as Record<string, unknown>);
  await recordAuditLog({
    userId: actor.uid,
    action: "risk_updated",
    entityType: "risk",
    entityId: risk.id,
    metadata: {
      riskTitle: risk.riskTitle,
      status: risk.status,
      riskScore: risk.riskScore,
    },
  });
  return risk;
}

export async function deleteRiskRegisterEntry(riskId: string, actor: AuthorizedUser): Promise<RiskRegisterEntry | null> {
  const docRef = getFirebaseAdmin().collection(RISK_COLLECTION).doc(riskId);
  const snapshot = await docRef.get();

  if (!snapshot.exists) {
    return null;
  }

  const deleted = normalizeRiskEntry(snapshot.id, (snapshot.data() ?? {}) as Record<string, unknown>);
  await docRef.delete();
  await recordAuditLog({
    userId: actor.uid,
    action: "risk_deleted",
    entityType: "risk",
    entityId: deleted.id,
    metadata: {
      riskTitle: deleted.riskTitle,
      status: deleted.status,
      riskScore: deleted.riskScore,
    },
  });
  return deleted;
}
