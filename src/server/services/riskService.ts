import type { AuthorizedUser } from "@/lib/server/authz";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { buildRiskMetrics } from "@/lib/risk/riskMetrics";
import { recordAuditLog } from "@/server/services/auditLogService";
import type { CreateRiskInput, Risk, RiskMetrics, RiskStatus, UpdateRiskInput } from "@/types/risk";

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

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.trim() : fallback;
}

function isRiskStatus(value: unknown): value is RiskStatus {
  return value === "open" || value === "monitoring" || value === "mitigated";
}

function normalizeRiskScore(value: unknown): number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 5 ? value : 1;
}

function normalizeRisk(id: string, data: Record<string, unknown>): Risk {
  return {
    id,
    riskTitle: asString(data.riskTitle, "Untitled risk"),
    riskDescription: asString(data.riskDescription),
    riskCategory: asString(data.riskCategory, "general"),
    riskScore: normalizeRiskScore(data.riskScore),
    mitigationPlan: asString(data.mitigationPlan),
    owner: asString(data.owner, "unassigned"),
    status: isRiskStatus(data.status) ? data.status : "open",
    createdAt: toIsoDate(data.createdAt),
    updatedAt: toIsoDate(data.updatedAt),
    createdByUid: asString(data.createdByUid) || undefined,
    updatedByUid: asString(data.updatedByUid) || undefined,
  };
}

export async function listRisks(): Promise<Risk[]> {
  const snapshot = await getFirebaseAdmin().collection(RISK_COLLECTION).orderBy("updatedAt", "desc").get();
  return snapshot.docs.map((doc) => normalizeRisk(doc.id, (doc.data() ?? {}) as Record<string, unknown>));
}

export async function getRiskById(riskId: string): Promise<Risk | null> {
  const snapshot = await getFirebaseAdmin().collection(RISK_COLLECTION).doc(riskId).get();
  if (!snapshot.exists) {
    return null;
  }

  return normalizeRisk(snapshot.id, (snapshot.data() ?? {}) as Record<string, unknown>);
}

export async function createRisk(input: CreateRiskInput, actor: AuthorizedUser): Promise<Risk> {
  const now = new Date();
  const payload = {
    ...input,
    createdAt: now,
    updatedAt: now,
    createdByUid: actor.uid,
    updatedByUid: actor.uid,
  };

  const docRef = await getFirebaseAdmin().collection(RISK_COLLECTION).add(payload);
  const saved = await docRef.get();
  const risk = normalizeRisk(saved.id, (saved.data() ?? {}) as Record<string, unknown>);

  await recordAuditLog({
    userId: actor.uid,
    action: "RISK_CREATED",
    entityType: "risk",
    entityId: risk.id,
  });

  return risk;
}

export async function updateRisk(riskId: string, updates: UpdateRiskInput, actor: AuthorizedUser): Promise<Risk | null> {
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
    payload.riskScore = updates.riskScore;
  }
  if (typeof updates.mitigationPlan === "string") {
    payload.mitigationPlan = updates.mitigationPlan.trim();
  }
  if (typeof updates.owner === "string") {
    payload.owner = updates.owner.trim();
  }
  if (isRiskStatus(updates.status)) {
    payload.status = updates.status;
  }

  await docRef.set(payload, { merge: true });
  const updated = await docRef.get();
  const risk = normalizeRisk(updated.id, (updated.data() ?? {}) as Record<string, unknown>);

  await recordAuditLog({
    userId: actor.uid,
    action: "RISK_UPDATED",
    entityType: "risk",
    entityId: risk.id,
  });

  return risk;
}

export async function deleteRisk(riskId: string, actor: AuthorizedUser): Promise<Risk | null> {
  const docRef = getFirebaseAdmin().collection(RISK_COLLECTION).doc(riskId);
  const snapshot = await docRef.get();

  if (!snapshot.exists) {
    return null;
  }

  const risk = normalizeRisk(snapshot.id, (snapshot.data() ?? {}) as Record<string, unknown>);
  await docRef.delete();

  await recordAuditLog({
    userId: actor.uid,
    action: "RISK_DELETED",
    entityType: "risk",
    entityId: risk.id,
  });

  return risk;
}

export async function getRiskMetrics(_actor?: AuthorizedUser): Promise<RiskMetrics> {
  const risks = await listRisks();
  return buildRiskMetrics(risks);
}
