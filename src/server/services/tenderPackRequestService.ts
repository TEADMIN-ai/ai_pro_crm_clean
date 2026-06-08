import { FieldValue } from "firebase-admin/firestore";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import type { AuthorizedUser } from "@/lib/server/authz";
import { isPrivilegedRole } from "@/lib/server/authz";
import type {
  TenderPackRequest,
  TenderPackRequestAuditEvent,
  TenderPackRequestStatus,
} from "@/types/tenderPackRequest";
import { TENDER_PACK_REQUEST_STATUSES } from "@/types/tenderPackRequest";

const COLLECTION = "tenderPackRequests";

type RequestInput = {
  contractorId: string;
  dealId?: string | null;
  note?: string | null;
  actor: AuthorizedUser;
};

type StatusInput = {
  requestId: string;
  status: Exclude<TenderPackRequestStatus, "generated">;
  actor: AuthorizedUser;
  note?: string | null;
};

type GeneratedInput = {
  requestId: string;
  actor: AuthorizedUser;
  packId: string;
  downloadURL: string;
};

function nowIso(): string {
  return new Date().toISOString();
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function asStatus(value: unknown): TenderPackRequestStatus {
  return TENDER_PACK_REQUEST_STATUSES.includes(value as TenderPackRequestStatus)
    ? (value as TenderPackRequestStatus)
    : "pending";
}

function toIso(value: unknown): string {
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? nowIso() : parsed.toISOString();
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return new Date(value).toISOString();
  }
  if (value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    const date = value.toDate() as Date;
    return Number.isNaN(date.getTime()) ? nowIso() : date.toISOString();
  }
  return nowIso();
}

function normalizeAuditTrail(value: unknown): TenderPackRequestAuditEvent[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is TenderPackRequestAuditEvent => Boolean(entry && typeof entry === "object"))
    : [];
}

function normalizeRequest(id: string, data: Record<string, unknown>): TenderPackRequest {
  return {
    id,
    contractorId: asString(data.contractorId) ?? "",
    contractorName: asString(data.contractorName),
    dealId: asString(data.dealId),
    dealTitle: asString(data.dealTitle),
    status: asStatus(data.status),
    requestedBy: asString(data.requestedBy) ?? "",
    requestedByEmail: asString(data.requestedByEmail),
    requestedAt: toIso(data.requestedAt),
    updatedAt: toIso(data.updatedAt),
    reviewedBy: asString(data.reviewedBy),
    reviewedByEmail: asString(data.reviewedByEmail),
    reviewedAt: data.reviewedAt ? toIso(data.reviewedAt) : null,
    generatedBy: asString(data.generatedBy),
    generatedByEmail: asString(data.generatedByEmail),
    generatedAt: data.generatedAt ? toIso(data.generatedAt) : null,
    packId: asString(data.packId),
    downloadURL: asString(data.downloadURL),
    rejectionReason: asString(data.rejectionReason),
    note: asString(data.note),
    auditTrail: normalizeAuditTrail(data.auditTrail),
  };
}

async function getContractorName(contractorId: string): Promise<string | null> {
  const snap = await getFirebaseAdmin().collection("contractors").doc(contractorId).get();
  const data = (snap.data() ?? {}) as Record<string, unknown>;
  return asString(data.companyName) ?? asString(data.company) ?? asString(data.name);
}

async function getDealTitle(dealId: string | null | undefined): Promise<string | null> {
  if (!dealId) {
    return null;
  }
  const snap = await getFirebaseAdmin().collection("deals").doc(dealId).get();
  const data = (snap.data() ?? {}) as Record<string, unknown>;
  return asString(data.title) ?? asString(data.name);
}

export function canCreateTenderPackRequest(user: AuthorizedUser, contractorId: string): boolean {
  if (isPrivilegedRole(user.role)) {
    return true;
  }
  return user.role === "contractor" && user.contractorId === contractorId;
}

export async function createTenderPackRequest(input: RequestInput): Promise<TenderPackRequest> {
  const timestamp = nowIso();
  const auditEntry: TenderPackRequestAuditEvent = {
    action: "created",
    actorId: input.actor.uid,
    actorEmail: input.actor.email ?? null,
    actorRole: input.actor.role,
    at: timestamp,
    toStatus: "pending",
    note: input.note ?? null,
  };
  const payload = {
    contractorId: input.contractorId,
    contractorName: await getContractorName(input.contractorId),
    dealId: input.dealId ?? null,
    dealTitle: await getDealTitle(input.dealId),
    status: "pending" satisfies TenderPackRequestStatus,
    requestedBy: input.actor.uid,
    requestedByEmail: input.actor.email ?? null,
    requestedAt: timestamp,
    updatedAt: timestamp,
    note: input.note ?? null,
    auditTrail: [auditEntry],
  };

  const ref = await getFirebaseAdmin().collection(COLLECTION).add(payload);
  const saved = await ref.get();
  return normalizeRequest(saved.id, (saved.data() ?? {}) as Record<string, unknown>);
}

export async function listTenderPackRequests(user: AuthorizedUser): Promise<TenderPackRequest[]> {
  let query: FirebaseFirestore.Query = getFirebaseAdmin().collection(COLLECTION);
  if (!isPrivilegedRole(user.role)) {
    query = query.where("contractorId", "==", user.contractorId ?? "__none__");
  }

  const snapshot = await query.limit(100).get();
  return snapshot.docs
    .map((doc) => normalizeRequest(doc.id, (doc.data() ?? {}) as Record<string, unknown>))
    .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt));
}

export async function getTenderPackRequest(requestId: string): Promise<TenderPackRequest | null> {
  const snap = await getFirebaseAdmin().collection(COLLECTION).doc(requestId).get();
  return snap.exists ? normalizeRequest(snap.id, (snap.data() ?? {}) as Record<string, unknown>) : null;
}

export async function updateTenderPackRequestStatus(input: StatusInput): Promise<TenderPackRequest> {
  const ref = getFirebaseAdmin().collection(COLLECTION).doc(input.requestId);
  const current = await ref.get();
  if (!current.exists) {
    throw new Error("Tender pack request not found");
  }

  const currentData = normalizeRequest(current.id, (current.data() ?? {}) as Record<string, unknown>);
  const timestamp = nowIso();
  const auditEntry: TenderPackRequestAuditEvent = {
    action: "status_changed",
    actorId: input.actor.uid,
    actorEmail: input.actor.email ?? null,
    actorRole: input.actor.role,
    at: timestamp,
    fromStatus: currentData.status,
    toStatus: input.status,
    note: input.note ?? null,
  };

  await ref.set(
    {
      status: input.status,
      updatedAt: timestamp,
      reviewedBy: input.actor.uid,
      reviewedByEmail: input.actor.email ?? null,
      reviewedAt: timestamp,
      rejectionReason: input.status === "rejected" ? input.note ?? null : null,
      auditTrail: FieldValue.arrayUnion(auditEntry),
    },
    { merge: true },
  );

  const saved = await ref.get();
  return normalizeRequest(saved.id, (saved.data() ?? {}) as Record<string, unknown>);
}

export async function markTenderPackRequestGenerated(input: GeneratedInput): Promise<TenderPackRequest> {
  const ref = getFirebaseAdmin().collection(COLLECTION).doc(input.requestId);
  const current = await ref.get();
  if (!current.exists) {
    throw new Error("Tender pack request not found");
  }

  const currentData = normalizeRequest(current.id, (current.data() ?? {}) as Record<string, unknown>);
  const timestamp = nowIso();
  const auditEntry: TenderPackRequestAuditEvent = {
    action: "generated",
    actorId: input.actor.uid,
    actorEmail: input.actor.email ?? null,
    actorRole: input.actor.role,
    at: timestamp,
    fromStatus: currentData.status,
    toStatus: "generated",
    packId: input.packId,
  };

  await ref.set(
    {
      status: "generated",
      updatedAt: timestamp,
      generatedBy: input.actor.uid,
      generatedByEmail: input.actor.email ?? null,
      generatedAt: timestamp,
      packId: input.packId,
      downloadURL: input.downloadURL,
      auditTrail: FieldValue.arrayUnion(auditEntry),
    },
    { merge: true },
  );

  const saved = await ref.get();
  return normalizeRequest(saved.id, (saved.data() ?? {}) as Record<string, unknown>);
}
