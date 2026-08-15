import { randomUUID, createHash } from "node:crypto";
import { Timestamp } from "firebase-admin/firestore";
import { getFirebaseAdmin, getFirebaseStorageBucket } from "@/lib/firebase/admin";
import { extractTextFromPdfDetailed } from "@/lib/pdf/extractTextFromPdf";
import { buildTenderIntelligence, type TenderDocumentTextInput } from "@/lib/tender-intelligence/analyzer";
import { buildExecutionHandoff } from "@/lib/tender-intelligence/summaries";
import { getDealById, listDealDocuments } from "@/server/services/dealService";
import type {
  TenderExtractedLineItem,
  TenderIntelligence,
  TenderIntelligenceExecutionHandoff,
  TenderPricingClassification,
  TenderPricingTableCandidate,
} from "@/types/tenderIntelligence";
import type { AuthorizedUser } from "@/lib/server/authz";
import { resolveTenderIntelligenceSourceDocument } from "@/server/services/tenderPricingCanonicalSources";

const COLLECTION = "tenderIntelligence";

type AnyRecord = Record<string, unknown>;

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asRecord(value: unknown): AnyRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as AnyRecord : {};
}

function statusError(message: string, status: number) {
  return Object.assign(new Error(message), { status });
}

async function getUserWorkspaceId(uid: string): Promise<string | null> {
  const snapshot = await getFirebaseAdmin().collection("users").doc(uid).get();
  const data = snapshot.data() ?? {};
  return asString(data.workspaceId) ?? asString(asRecord(data.workspace).id);
}

async function assertDealAccess(dealId: string, actor: AuthorizedUser, options?: { allowContractorApprovedView?: boolean }) {
  const deal = await getDealById(dealId);
  if (!deal) throw statusError("Deal not found", 404);
  const actorWorkspaceId = await getUserWorkspaceId(actor.uid);
  const dealWorkspaceId = asString((deal as unknown as AnyRecord).workspaceId);
  if (actorWorkspaceId && dealWorkspaceId && actorWorkspaceId !== dealWorkspaceId) {
    throw statusError("Cross-workspace access rejected", 403);
  }
  if (actor.role === "contractor") {
    const contractorId = asString((deal as unknown as AnyRecord).contractorId) ?? asString(asRecord((deal as unknown as AnyRecord).contractorAssignment).contractorId);
    if (!options?.allowContractorApprovedView || !actor.contractorId || actor.contractorId !== contractorId) {
      throw statusError("unauthorized", 403);
    }
  }
  return { deal, workspaceId: dealWorkspaceId };
}

function assertStaffOrAdmin(actor: AuthorizedUser) {
  if (actor.role !== "staff" && actor.role !== "admin" && actor.role !== "manager") {
    throw statusError("unauthorized", 403);
  }
}

async function downloadDocument(storagePath: string): Promise<Buffer> {
  const [buffer] = await getFirebaseStorageBucket().file(storagePath).download();
  return Buffer.from(buffer);
}

async function extractDocumentText(document: Awaited<ReturnType<typeof listDealDocuments>>[number]): Promise<TenderDocumentTextInput> {
  if (!document.storagePath) {
    return {
      documentId: document.id,
      filename: document.name,
      storagePath: null,
      text: "",
      pageCount: 0,
      extractionSource: "UNAVAILABLE",
      extractionStatus: "FAILED",
    };
  }
  try {
    const buffer = await downloadDocument(document.storagePath);
    const extracted = await extractTextFromPdfDetailed(buffer, {
      filename: document.name,
      documentType: "TENDER_INTELLIGENCE",
      storagePath: document.storagePath,
    });
    return {
      documentId: document.id,
      filename: document.name,
      storagePath: document.storagePath,
      text: extracted.text,
      pageCount: extracted.pageCount,
      extractionSource: extracted.source,
      extractionStatus: extracted.source === "OCR" ? "OCR_USED" : extracted.source === "EMPTY" ? "EMPTY" : "EXTRACTED",
    };
  } catch {
    return {
      documentId: document.id,
      filename: document.name,
      storagePath: document.storagePath,
      text: "",
      pageCount: 0,
      extractionSource: "UNAVAILABLE",
      extractionStatus: "FAILED",
    };
  }
}

async function getLatestForDeal(dealId: string): Promise<TenderIntelligence | null> {
  const snapshot = await getFirebaseAdmin()
    .collection(COLLECTION)
    .where("dealId", "==", dealId)
    .orderBy("createdAt", "desc")
    .limit(1)
    .get();
  if (snapshot.empty) return null;
  return { id: snapshot.docs[0].id, ...(snapshot.docs[0].data() ?? {}) } as TenderIntelligence;
}

async function writeActivity(dealId: string, actor: AuthorizedUser, message: string, metadata?: AnyRecord) {
  const id = `tender-intelligence-${Date.now()}`;
  await getFirebaseAdmin().collection("deals").doc(dealId).collection("activity").doc(id).set({
    type: "tender_intelligence",
    message,
    performedByEmail: actor.email ?? null,
    metadata: metadata ?? {},
    createdAt: Timestamp.fromDate(new Date()),
  });
}

async function persistExecutionHandoff(intelligence: TenderIntelligence): Promise<TenderIntelligenceExecutionHandoff> {
  const handoff = buildExecutionHandoff(intelligence);
  const now = new Date();
  await Promise.all([
    getFirebaseAdmin().collection("deals").doc(intelligence.dealId).set({
      tenderIntelligenceId: intelligence.id,
      tenderIntelligence: handoff,
      opportunityExecution: {
        tenderIntelligenceId: intelligence.id,
        tenderAnalysisStatus: handoff.tenderAnalysisStatus,
        requirementsReviewStatus: handoff.requirementsReviewStatus,
        boqDetectionStatus: handoff.boqDetectionStatus,
        pricingScheduleStatus: handoff.pricingScheduleStatus,
        pricingClassification: handoff.pricingClassification,
        extractedLineItemCount: handoff.extractedLineItemCount,
        intelligenceConfidence: handoff.intelligenceConfidence,
        analysisBlockers: handoff.analysisBlockers,
        nextAction: handoff.nextAction,
        tenderIntelligenceUpdatedAt: now.toISOString(),
      },
      updatedAt: now,
    }, { merge: true }),
    getFirebaseAdmin().collection("opportunityExecutionWorkspaces").doc(intelligence.dealId).set({
      dealId: intelligence.dealId,
      opportunityId: intelligence.opportunityId,
      workspaceId: intelligence.workspaceId,
      ...handoff,
      updatedAt: Timestamp.fromDate(now),
    }, { merge: true }),
  ]);
  return handoff;
}

export async function startTenderIntelligenceAnalysis(dealId: string, actor: AuthorizedUser): Promise<TenderIntelligence> {
  assertStaffOrAdmin(actor);
  const { deal, workspaceId } = await assertDealAccess(dealId, actor);
  const documents = await listDealDocuments(dealId);
  if (!documents.length) throw statusError("No tender documents are linked to this deal.", 400);
  const previous = await getLatestForDeal(dealId);
  const now = new Date().toISOString();
  const id = previous?.analysisStatus === "APPROVED" ? `ti-${randomUUID()}` : previous?.id ?? `ti-${randomUUID()}`;

  await getFirebaseAdmin().collection(COLLECTION).doc(id).set({
    id,
    workspaceId,
    opportunityId: dealId,
    dealId,
    analysisStatus: "ANALYSING",
    reviewStatus: "REVIEW_REQUIRED",
    sourceDocumentIds: documents.map((document) => document.id),
    createdAt: previous?.createdAt ?? now,
    updatedAt: now,
  }, { merge: true });

  const extractedDocuments = await Promise.all(documents.map(extractDocumentText));
  const intelligence = buildTenderIntelligence({
    id,
    workspaceId,
    opportunityId: asString((deal as unknown as AnyRecord).opportunityId) ?? dealId,
    dealId,
    documents: extractedDocuments,
    existing: previous,
    nowIso: now,
  });

  if (previous?.analysisStatus === "APPROVED") {
    await getFirebaseAdmin().collection(COLLECTION).doc(previous.id).set({
      analysisStatus: "SUPERSEDED",
      supersededByIntelligenceId: id,
      updatedAt: now,
    }, { merge: true });
  }

  await getFirebaseAdmin().collection(COLLECTION).doc(id).set(intelligence, { merge: true });
  await persistExecutionHandoff(intelligence);
  await writeActivity(dealId, actor, "Tender intelligence analysis completed", { tenderIntelligenceId: id });
  return intelligence;
}

export async function getTenderIntelligenceForDeal(dealId: string, actor: AuthorizedUser): Promise<TenderIntelligence | null> {
  await assertDealAccess(dealId, actor, { allowContractorApprovedView: true });
  const intelligence = await getLatestForDeal(dealId);
  if (actor.role === "contractor" && intelligence?.reviewStatus !== "APPROVED") return null;
  return intelligence;
}

export async function listTenderIntelligenceLineItems(dealId: string, actor: AuthorizedUser): Promise<TenderExtractedLineItem[]> {
  const intelligence = await getTenderIntelligenceForDeal(dealId, actor);
  return intelligence?.extractedLineItems ?? [];
}

type ReviewUpdate = {
  pricingClassification?: TenderPricingClassification;
  pricingTables?: Array<Partial<TenderPricingTableCandidate> & { id: string }>;
  lineItems?: Array<Partial<TenderExtractedLineItem> & { id: string }>;
  markPricingNotApplicable?: boolean;
  missingPricingTemplate?: boolean;
};

export async function updateTenderIntelligenceReview(dealId: string, actor: AuthorizedUser, update: ReviewUpdate): Promise<TenderIntelligence> {
  assertStaffOrAdmin(actor);
  await assertDealAccess(dealId, actor);
  const intelligence = await getLatestForDeal(dealId);
  if (!intelligence) throw statusError("Tender intelligence analysis not found", 404);
  if (intelligence.reviewStatus === "APPROVED") throw statusError("Approved tender intelligence cannot be edited; refresh analysis after amendments.", 409);
  const now = new Date().toISOString();
  const lineUpdates = new Map((update.lineItems ?? []).map((item) => [item.id, item]));
  const tableUpdates = new Map((update.pricingTables ?? []).map((item) => [item.id, item]));
  const next: TenderIntelligence = {
    ...intelligence,
    boqClassification: update.markPricingNotApplicable
      ? "NO_PRICING_REQUIRED"
      : update.missingPricingTemplate
        ? "PRICING_REQUIRED_BUT_TEMPLATE_NOT_FOUND"
        : update.pricingClassification ?? intelligence.boqClassification,
    pricingTables: intelligence.pricingTables.map((table) => ({ ...table, ...tableUpdates.get(table.id) })),
    extractedLineItems: intelligence.extractedLineItems.map((item) => {
      const patch = lineUpdates.get(item.id);
      if (!patch) return item;
      return {
        ...item,
        ...patch,
        manuallyCorrected: true,
        correctedBy: actor.uid,
        correctedAt: now,
        reviewStatus: patch.reviewStatus ?? item.reviewStatus,
      };
    }),
    analysisStatus: "REVIEW_REQUIRED",
    reviewStatus: "REVIEW_REQUIRED",
    updatedAt: now,
  };
  await getFirebaseAdmin().collection(COLLECTION).doc(next.id).set(next, { merge: true });
  await persistExecutionHandoff(next);
  await writeActivity(dealId, actor, "Tender intelligence review updates saved", { tenderIntelligenceId: next.id });
  return next;
}

export function hasValidTenderLineQuantity(item: TenderExtractedLineItem): boolean {
  if (item.quantityMode === "UNIT_RATE_ONLY") {
    return item.quantity === null && Boolean(item.unit) && item.sourcePage > 0 && item.manuallyCorrected === true;
  }
  return typeof item.quantity === "number" && Number.isFinite(item.quantity) && item.quantity > 0;
}

export async function approveTenderIntelligence(dealId: string, actor: AuthorizedUser): Promise<{ intelligence: TenderIntelligence; handoff: TenderIntelligenceExecutionHandoff }> {
  assertStaffOrAdmin(actor);
  await assertDealAccess(dealId, actor);
  const intelligence = await getLatestForDeal(dealId);
  if (!intelligence) throw statusError("Tender intelligence analysis not found", 404);
  const unresolved = intelligence.extractedLineItems.filter((item) => item.reviewStatus === "REVIEW_REQUIRED" || item.reviewStatus === "EXTRACTED");
  if (unresolved.length > 0) throw statusError("All extracted line items must be approved, rejected, merged, or marked not applicable before approval.", 409);
  const invalidQuantities = intelligence.extractedLineItems.filter((item) => item.reviewStatus === "APPROVED" && !hasValidTenderLineQuantity(item));
  if (invalidQuantities.length > 0) throw statusError("Approved tender lines must have a positive quantity or an explicitly reviewed UNIT_RATE_ONLY quantity mode.", 409);
  const now = new Date().toISOString();
  const next: TenderIntelligence = {
    ...intelligence,
    analysisStatus: "APPROVED",
    reviewStatus: "APPROVED",
    approvedBy: actor.uid,
    approvedAt: now,
    updatedAt: now,
  };
  await getFirebaseAdmin().collection(COLLECTION).doc(next.id).set(next, { merge: true });
  const handoff = await persistExecutionHandoff(next);
  const sourcePricingDocument = resolveTenderIntelligenceSourceDocument(next);
  await getFirebaseAdmin().collection("deals").doc(dealId).collection("pricingSources").doc(next.id).set({
    sourceType: "APPROVED_TENDER_INTELLIGENCE",
    tenderIntelligenceId: next.id,
    dealId,
    workspaceId: next.workspaceId,
    pricingClassification: next.boqClassification,
    sourcePricingDocumentId: sourcePricingDocument.id,
    sourcePricingDocumentPath: sourcePricingDocument.storagePath,
    sourcePricingDocumentName: sourcePricingDocument.name,
    lineItems: next.extractedLineItems.filter((item) => item.reviewStatus === "APPROVED"),
    locked: true,
    createdBy: actor.uid,
    createdAt: now,
    updatedAt: now,
  }, { merge: true });
  await writeActivity(dealId, actor, "Tender intelligence approved for pricing handoff", { tenderIntelligenceId: next.id });
  return { intelligence: next, handoff };
}

export async function rejectTenderIntelligence(dealId: string, actor: AuthorizedUser, reason?: string | null): Promise<TenderIntelligence> {
  assertStaffOrAdmin(actor);
  await assertDealAccess(dealId, actor);
  const intelligence = await getLatestForDeal(dealId);
  if (!intelligence) throw statusError("Tender intelligence analysis not found", 404);
  const now = new Date().toISOString();
  const next: TenderIntelligence = {
    ...intelligence,
    analysisStatus: "REJECTED",
    reviewStatus: "REJECTED",
    rejectedBy: actor.uid,
    rejectedAt: now,
    rejectionReason: reason ?? "Rejected by staff review",
    updatedAt: now,
  };
  await getFirebaseAdmin().collection(COLLECTION).doc(next.id).set(next, { merge: true });
  await persistExecutionHandoff(next);
  await writeActivity(dealId, actor, "Tender intelligence rejected", { tenderIntelligenceId: next.id, reason: next.rejectionReason });
  return next;
}

export async function refreshTenderIntelligenceAfterAmendment(dealId: string, actor: AuthorizedUser): Promise<TenderIntelligence> {
  return startTenderIntelligenceAnalysis(dealId, actor);
}

export function buildTenderDocumentHashForTests(text: string) {
  return createHash("sha256").update(text).digest("hex");
}
