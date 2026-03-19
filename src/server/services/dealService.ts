import { FieldPath, FieldValue } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import type { Deal } from "@/types/deal";
import { normalizeDeal, resolveTenderLockStatus } from "@/lib/deals/normalizeDeal";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import type { AuthorizedUser } from "@/lib/server/authz";
import { isPrivilegedRole } from "@/lib/server/authz";
import { isValidTransition } from "@/lib/deals/statusTransitions";

type DealDocumentStatus = "pending" | "approved" | "rejected";

function toMillis(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (value && typeof value === "object" && "toMillis" in value && typeof value.toMillis === "function") {
    return value.toMillis();
  }

  return undefined;
}

function toIsoDate(value: unknown): string | undefined {
  const millis = toMillis(value);
  return typeof millis === "number" ? new Date(millis).toISOString() : undefined;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

export interface DealDocumentSummary {
  id: string;
  dealId: string;
  name: string;
  status: DealDocumentStatus;
  contentType?: string;
  size?: number;
  storagePath?: string;
  downloadURL?: string;
  uploadedByUid?: string;
  uploadedByRole?: string;
  uploadedAt?: string;
  updatedAt?: string;
  reviewedAt?: string;
  reviewedByUid?: string;
  reviewedByRole?: string;
  rejectionReason?: string;
  version?: number;
}

export interface DealActivityEntry {
  id: string;
  type: string;
  message: string;
  from?: string | null;
  to?: string | null;
  performedByEmail?: string;
  createdAt?: string;
}

export interface DealAnalyticsState {
  readinessUpdatedAt?: string;
  previousWpi: {
    probability?: number;
    riskScore?: number;
    timestamp?: number;
  } | null;
}

function normalizeDealDocument(
  id: string,
  dealId: string,
  data: Record<string, unknown>,
): DealDocumentSummary {
  return {
    id,
    dealId,
    name: asString(data.name) ?? "Untitled document",
    status:
      data.status === "approved" || data.status === "rejected" ? data.status : "pending",
    contentType: asString(data.contentType),
    size: typeof data.size === "number" ? data.size : undefined,
    storagePath: asString(data.storagePath),
    downloadURL:
      asString(data.downloadURL) ?? asString(data.downloadUrl) ?? asString(data.url),
    uploadedByUid: asString(data.uploadedByUid),
    uploadedByRole: asString(data.uploadedByRole),
    uploadedAt: toIsoDate(data.uploadedAt),
    updatedAt: toIsoDate(data.updatedAt),
    reviewedAt: toIsoDate(data.reviewedAt),
    reviewedByUid: asString(data.reviewedByUid),
    reviewedByRole: asString(data.reviewedByRole),
    rejectionReason: asString(data.rejectionReason),
    version: typeof data.version === "number" ? data.version : undefined,
  };
}

export async function listDealsForUser(user: AuthorizedUser): Promise<Deal[]> {
  const db = getFirebaseAdmin();
  const dealsQuery =
    user.role === "contractor"
      ? db.collection("deals").where("contractorId", "==", user.contractorId)
      : db.collection("deals");

  const snapshot = await dealsQuery.get();

  return snapshot.docs
    .map((doc) => normalizeDeal(doc.id, (doc.data() ?? {}) as Record<string, unknown>))
    .filter((deal) => isPrivilegedRole(user.role) || deal.contractorId === user.contractorId)
    .sort((a, b) => Number(b.createdAt ?? 0) - Number(a.createdAt ?? 0));
}

export async function getDealById(dealId: string): Promise<Deal | null> {
  const snapshot = await getFirebaseAdmin().collection("deals").doc(dealId).get();
  if (!snapshot.exists) {
    return null;
  }

  return normalizeDeal(snapshot.id, (snapshot.data() ?? {}) as Record<string, unknown>);
}

export async function listDealDocuments(dealId: string): Promise<DealDocumentSummary[]> {
  const snapshot = await getFirebaseAdmin()
    .collection("deals")
    .doc(dealId)
    .collection("documents")
    .orderBy("uploadedAt", "desc")
    .get();

  return snapshot.docs.map((doc) =>
    normalizeDealDocument(doc.id, dealId, (doc.data() ?? {}) as Record<string, unknown>),
  );
}

export async function createDealDocumentMetadata(input: {
  dealId: string;
  name: string;
  contentType?: string;
  size?: number;
  storagePath: string;
  downloadURL: string;
  uploadedByUid: string;
  uploadedByRole: string;
}) {
  const now = new Date();
  const docRef = getFirebaseAdmin()
    .collection("deals")
    .doc(input.dealId)
    .collection("documents")
    .doc();

  await docRef.set({
    id: docRef.id,
    dealId: input.dealId,
    name: input.name,
    contentType: input.contentType ?? "application/pdf",
    size: input.size ?? 0,
    storagePath: input.storagePath,
    downloadURL: input.downloadURL,
    uploadedByUid: input.uploadedByUid,
    uploadedByRole: input.uploadedByRole,
    uploadedAt: now,
    updatedAt: now,
    status: "pending",
    reviewedAt: null,
    version: 1,
  });

  const saved = await docRef.get();
  return normalizeDealDocument(saved.id, input.dealId, (saved.data() ?? {}) as Record<string, unknown>);
}

export async function updateDealDocumentReview(input: {
  dealId: string;
  documentId: string;
  reviewerUid: string;
  reviewerRole: string;
  status: "approved" | "rejected";
}) {
  const docRef = getFirebaseAdmin()
    .collection("deals")
    .doc(input.dealId)
    .collection("documents")
    .doc(input.documentId);

  await docRef.set(
    {
      status: input.status,
      reviewedByUid: input.reviewerUid,
      reviewedByRole: input.reviewerRole,
      reviewedAt: new Date(),
      rejectionReason: input.status === "rejected" ? "Rejected by reviewer" : "",
      updatedAt: new Date(),
    },
    { merge: true },
  );

  const updated = await docRef.get();
  return normalizeDealDocument(updated.id, input.dealId, (updated.data() ?? {}) as Record<string, unknown>);
}

export async function deleteDealDocument(input: { dealId: string; documentId: string }) {
  const docRef = getFirebaseAdmin()
    .collection("deals")
    .doc(input.dealId)
    .collection("documents")
    .doc(input.documentId);
  const snapshot = await docRef.get();

  if (!snapshot.exists) {
    return null;
  }

  const data = (snapshot.data() ?? {}) as Record<string, unknown>;
  const storagePath = asString(data.storagePath);
  if (storagePath) {
    await getStorage().bucket().file(storagePath).delete({ ignoreNotFound: true });
  }

  await docRef.delete();
  return normalizeDealDocument(snapshot.id, input.dealId, data);
}

export async function listDealActivity(dealId: string): Promise<DealActivityEntry[]> {
  const snapshot = await getFirebaseAdmin()
    .collection("deals")
    .doc(dealId)
    .collection("activity")
    .orderBy("createdAt", "desc")
    .get();

  return snapshot.docs.map((doc) => {
    const data = (doc.data() ?? {}) as Record<string, unknown>;
    return {
      id: doc.id,
      type: asString(data.type) ?? "updated",
      message: asString(data.message) ?? "Updated",
      from: typeof data.from === "string" ? data.from : null,
      to: typeof data.to === "string" ? data.to : null,
      performedByEmail: asString(data.performedByEmail),
      createdAt: toIsoDate(data.createdAt),
    };
  });
}

export async function getDealAnalyticsState(dealId: string): Promise<DealAnalyticsState> {
  const [dealSnapshot, wpiSnapshot] = await Promise.all([
    getFirebaseAdmin().collection("deals").doc(dealId).get(),
    getFirebaseAdmin().collection("deals").doc(dealId).collection("analytics").doc("wpiHistory").get(),
  ]);

  const dealData = (dealSnapshot.data() ?? {}) as Record<string, unknown>;
  const wpiData = (wpiSnapshot.data() ?? {}) as Record<string, unknown>;

  return {
    readinessUpdatedAt: asString(dealData.readinessUpdatedAt),
    previousWpi:
      typeof wpiData.probability === "number" && typeof wpiData.riskScore === "number"
        ? {
            probability: wpiData.probability,
            riskScore: wpiData.riskScore,
            timestamp: typeof wpiData.timestamp === "number" ? wpiData.timestamp : undefined,
          }
        : null,
  };
}

export async function persistDealAnalytics(input: {
  dealId: string;
  winProbability?: number;
  riskScore?: number;
  documentIntelligence?: Record<string, unknown>;
}) {
  const analyticsRef = getFirebaseAdmin().collection("deals").doc(input.dealId).collection("analytics");
  const writes: Promise<unknown>[] = [];

  if (typeof input.winProbability === "number" && typeof input.riskScore === "number") {
    writes.push(
      analyticsRef.doc("wpiHistory").set(
        {
          timestamp: Date.now(),
          probability: input.winProbability,
          riskScore: input.riskScore,
        },
        { merge: true },
      ),
    );
  }

  if (input.documentIntelligence) {
    writes.push(
      analyticsRef.doc("documentIntelligence").set(input.documentIntelligence, { merge: true }),
    );
  }

  await Promise.all(writes);
}

export async function assignDeal(input: {
  dealId: string;
  assignedTo: string | null;
  actorEmail?: string;
}) {
  const db = getFirebaseAdmin();
  const dealRef = db.collection("deals").doc(input.dealId);
  const snapshot = await dealRef.get();

  if (!snapshot.exists) {
    throw new Error("Deal not found");
  }

  const previousAssignedTo = asString((snapshot.data() ?? {}).assignedTo) ?? null;
  await dealRef.set(
    {
      assignedTo: input.assignedTo,
      updatedAt: new Date(),
    },
    { merge: true },
  );

  await dealRef.collection("activity").add({
    type: "assignment_changed",
    message: "Deal assignment updated",
    from: previousAssignedTo,
    to: input.assignedTo,
    performedByEmail: input.actorEmail ?? null,
    createdAt: new Date(),
  });
}

export async function updateDealStageForRole(input: {
  dealId: string;
  nextStage: string;
  role: string;
}) {
  const dealRef = getFirebaseAdmin().collection("deals").doc(input.dealId);
  const snap = await dealRef.get();

  if (!snap.exists) {
    throw new Error("Deal not found");
  }

  const deal = (snap.data() ?? {}) as Record<string, unknown>;
  const currentStage = asString(deal.stage) ?? "lead";
  const pricingStatus = asString(deal.pricingStatus) ?? "not_started";

  if (!isValidTransition(input.role as never, currentStage as never, input.nextStage as never)) {
    throw new Error(`Invalid transition from ${currentStage} to ${input.nextStage} for role ${input.role}`);
  }

  if (input.nextStage === "approved" && pricingStatus !== "contractor_signed_off") {
    throw new Error("Deal cannot be approved until contractor signs off pricing.");
  }

  await dealRef.set(
    {
      stage: input.nextStage,
      updatedAt: new Date(),
    },
    { merge: true },
  );
}

export async function approveDealPricing(input: { dealId: string; managerUid: string }) {
  const dealRef = getFirebaseAdmin().collection("deals").doc(input.dealId);
  const snap = await dealRef.get();

  if (!snap.exists) {
    throw new Error("Deal not found");
  }

  const deal = (snap.data() ?? {}) as Record<string, unknown>;
  if (deal.pricingStatus !== "ai_generated") {
    throw new Error("Pricing must be AI generated before manager approval.");
  }

  await dealRef.set(
    {
      pricingStatus: "manager_approved",
      pricingApprovedBy: input.managerUid,
      pricingApprovedAt: new Date(),
      updatedAt: new Date(),
    },
    { merge: true },
  );
}

export async function createLeadDeal(input: {
  title: string;
  source: string;
  companyId: string;
  customerName: string;
  contactMethod: string;
  vehicle: string;
  budget: string;
  financeRequired: string;
  purchaseTimeline: string;
}) {
  const now = new Date();
  const payload = {
    title: input.title,
    status: "draft",
    stage: "lead",
    assignedTo: null,
    companyId: input.companyId,
    contractorId: input.companyId,
    contractorName: input.companyId,
    sla: null,
    source: input.source,
    customerName: input.customerName,
    contactMethod: input.contactMethod,
    vehicle: input.vehicle,
    budget: input.budget,
    financeRequired: input.financeRequired,
    purchaseTimeline: input.purchaseTimeline,
    createdAt: now.getTime(),
    updatedAt: now,
    readinessScore: 0,
    docsMissing: 0,
    tenderLockStatus: resolveTenderLockStatus(0, 0, "BLOCKED"),
    isTenderLocked: true,
  };

  const docRef = await getFirebaseAdmin().collection("deals").add(payload);
  return { id: docRef.id, ...payload };
}

export async function getStaffUsers() {
  const snapshot = await getFirebaseAdmin().collection("users").where("role", "==", "staff").get();
  return snapshot.docs.map((doc) => ({
    uid: doc.id,
    email: asString((doc.data() ?? {}).email) ?? "",
    role: asString((doc.data() ?? {}).role) ?? "staff",
  }));
}

export async function getDocumentById(documentId: string) {
  const snapshot = await getFirebaseAdmin()
    .collectionGroup("documents")
    .where(FieldPath.documentId(), "==", documentId)
    .limit(1)
    .get();

  return snapshot.docs[0] ?? null;
}

export async function submitDealTender(input: {
  dealId: string;
  score: number;
  docsMissing: number;
  tenderLockStatus: "READY" | "RISK" | "BLOCKED";
  userUid: string;
}) {
  await getFirebaseAdmin().collection("deals").doc(input.dealId).update({
    stage: "submitted",
    status: "submitted",
    isTenderLocked: true,
    readinessScore: input.score,
    docsMissing: input.docsMissing,
    tenderLockStatus: input.tenderLockStatus,
    submittedAt: new Date(),
    tenderSubmittedAt: new Date(),
    tenderSubmittedBy: input.userUid,
    updatedAt: new Date(),
  });
}
