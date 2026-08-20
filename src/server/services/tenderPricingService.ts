import { Timestamp } from "firebase-admin/firestore";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import type { AuthorizedUser } from "@/lib/server/authz";
import { listSupplierQuotesForDeal } from "@/server/services/supplierQuoteService";
import {
  approveTenderPricing,
  buildPricingScheduleFillEvidence,
  buildTenderPricingHandoff,
  buildTenderPricingWorkspace,
  createTenderPricingRevision,
  lockTenderPricing,
  validateTenderPricingWorkspace,
} from "@/lib/tender-pricing";
import type {
  TenderLineMapping,
  TenderPricingBuildInput,
  TenderPricingTenderLineItem,
  TenderPricingWorkspace,
} from "@/types/tenderPricing";
import { isApprovedTenderIntelligence, loadCanonicalTenderPricingSources, type CanonicalTenderPricingSources } from "@/server/services/tenderPricingCanonicalSources";
import { createApprovedClientQuoteFromLockedPricing } from "@/server/services/clientQuoteAuthorityService";

const TENDER_PRICING_COLLECTION = "tenderPricingWorkspaces";
const TENDER_PRICING_AUDIT_COLLECTION = "tenderPricingAuditEvents";
const TORQUE_EMPIRE_CONTRACTOR_NAME = "Torque Empire (Pty) Ltd";

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function nowIso() {
  return new Date().toISOString();
}

async function getUserWorkspaceId(uid: string): Promise<string | null> {
  const snapshot = await getFirebaseAdmin().collection("users").doc(uid).get();
  return asString((snapshot.data() ?? {}).workspaceId);
}

async function assertWorkspaceAccess(actor: AuthorizedUser, workspaceId: string | null | undefined) {
  const actorWorkspaceId = await getUserWorkspaceId(actor.uid);
  if (actorWorkspaceId && workspaceId && actorWorkspaceId !== workspaceId) {
    throw Object.assign(new Error("Cross-workspace access rejected"), { status: 403 });
  }
}

async function loadDeal(dealId: string): Promise<Record<string, unknown> & { id: string }> {
  const snapshot = await getFirebaseAdmin().collection("deals").doc(dealId).get();
  if (!snapshot.exists) throw Object.assign(new Error("Deal not found"), { status: 404 });
  return { id: snapshot.id, ...(snapshot.data() ?? {}) };
}

async function loadPricing(id: string, actor: AuthorizedUser): Promise<TenderPricingWorkspace> {
  const snapshot = await getFirebaseAdmin().collection(TENDER_PRICING_COLLECTION).doc(id).get();
  if (!snapshot.exists) throw Object.assign(new Error("Tender pricing workspace not found"), { status: 404 });
  const workspace = { id: snapshot.id, ...(snapshot.data() ?? {}) } as TenderPricingWorkspace;
  await assertWorkspaceAccess(actor, workspace.workspaceId);
  return workspace;
}

async function writeAudit(input: {
  pricingId: string;
  dealId: string;
  workspaceId: string;
  actorUid: string;
  action: string;
  metadata?: Record<string, unknown>;
}) {
  const id = `${input.pricingId}__${input.action}__${Date.now()}`;
  await getFirebaseAdmin().collection(TENDER_PRICING_AUDIT_COLLECTION).doc(id).set({
    id,
    ...input,
    createdAt: nowIso(),
  });
}

function extractTenderLines(deal: Record<string, unknown>, override?: TenderPricingTenderLineItem[]): TenderPricingTenderLineItem[] {
  if (override?.length) return override;
  const intelligence = asRecord(deal.tenderIntelligence);
  const execution = asRecord(deal.opportunityExecution);
  const requirements = asRecord(execution.requirements);
  const sourceLines = Array.isArray(intelligence.lineItems)
    ? intelligence.lineItems
    : Array.isArray(intelligence.pricingLineItems)
      ? intelligence.pricingLineItems
      : Array.isArray(requirements.lineItems)
        ? requirements.lineItems
        : [];

  return sourceLines
    .map((raw, index): TenderPricingTenderLineItem | null => {
      if (typeof raw === "string") {
        return {
          id: `tender-line-${index + 1}`,
          itemCode: null,
          description: raw,
          quantity: null,
          quantityMode: "FIXED_QUANTITY",
          unit: "item",
          compulsory: true,
          sourcePage: null,
          sourceDocumentId: asString(intelligence.sourcePricingDocumentId),
        };
      }
      const item = asRecord(raw);
      const description = asString(item.description ?? item.itemDescription ?? item.originalText);
      if (!description) return null;
      return {
        id: asString(item.id ?? item.tenderLineItemId ?? item.boqLineItemId) ?? `tender-line-${index + 1}`,
        itemCode: asString(item.itemCode ?? item.code),
        description,
        normalizedDescription: asString(item.normalizedDescription),
        quantity: asNumber(item.quantity),
        quantityMode: item.quantityMode === "UNIT_RATE_ONLY" ? "UNIT_RATE_ONLY" : "FIXED_QUANTITY",
        unit: asString(item.unit ?? item.normalizedUnit) ?? "item",
        specification: asString(item.specification),
        packSize: asString(item.packSize),
        dimensions: asString(item.dimensions),
        brandRequirement: asString(item.brandRequirement),
        deliveryRequirement: asString(item.deliveryRequirement),
        compulsory: item.compulsory !== false,
        sourcePage: asNumber(item.sourcePage),
        sourceDocumentId: asString(item.sourceDocumentId ?? intelligence.sourcePricingDocumentId),
      };
    })
    .filter((item): item is TenderPricingTenderLineItem => Boolean(item));
}

function buildInputFromDeal(args: {
  deal: Record<string, unknown> & { id: string };
  actor: AuthorizedUser;
  body?: Record<string, unknown>;
  tenderLineItems?: TenderPricingTenderLineItem[];
  canonicalSources?: CanonicalTenderPricingSources;
}): Omit<TenderPricingBuildInput, "supplierQuotes" | "createdBy"> {
  const assignment = asRecord(args.deal.contractorAssignment);
  const execution = asRecord(args.deal.opportunityExecution);
  const intelligence = asRecord(args.deal.tenderIntelligence);
  const canonicalIntelligence = args.canonicalSources?.intelligence ?? null;
  const workspaceId = asString(args.body?.workspaceId) ?? asString(args.deal.workspaceId) ?? "";
  const contractorId = asString(args.body?.contractorId) ?? asString(assignment.contractorId) ?? asString(execution.contractorId) ?? asString(args.deal.contractorId) ?? "torque-empire";
  const contractorName = asString(args.body?.contractorName) ?? asString(assignment.contractorName) ?? asString(args.deal.contractorName) ?? TORQUE_EMPIRE_CONTRACTOR_NAME;
  const sourcePricingDocumentId = asString(args.body?.sourcePricingDocumentId) ?? args.canonicalSources?.sourcePricingDocumentId ?? asString(intelligence.sourcePricingDocumentId ?? intelligence.pricingScheduleDocumentId);
  const sourcePricingDocumentPath = asString(args.body?.sourcePricingDocumentPath) ?? args.canonicalSources?.sourcePricingDocumentPath ?? asString(intelligence.sourcePricingDocumentPath ?? intelligence.pricingScheduleDocumentPath);
  return {
    id: asString(args.body?.id) ?? `tender-pricing-${args.deal.id}-r1`,
    workspaceId,
    opportunityId: asString(args.body?.opportunityId) ?? asString(args.deal.opportunityId) ?? args.deal.id,
    dealId: args.deal.id,
    contractorId,
    contractorName,
    tenderIntelligenceId: asString(args.body?.tenderIntelligenceId) ?? canonicalIntelligence?.id ?? asString(intelligence.id ?? intelligence.tenderIntelligenceId),
    tenderIntelligenceApproved: args.body?.tenderIntelligenceApproved === true || isApprovedTenderIntelligence(canonicalIntelligence) || intelligence.approvalStatus === "APPROVED" || intelligence.status === "APPROVED" || execution.tenderIntelligenceApproved === true,
    tenderLineItems: extractTenderLines(args.deal, args.tenderLineItems ?? args.canonicalSources?.tenderLineItems),
    sourcePricingDocumentRequired: args.body?.sourcePricingDocumentRequired !== false,
    sourcePricingDocumentId,
    sourcePricingDocumentPath,
    manualMappings: Array.isArray(args.body?.manualMappings) ? args.body.manualMappings as TenderLineMapping[] : [],
    manualPrices: Array.isArray(args.body?.manualPrices) ? args.body.manualPrices as TenderPricingBuildInput["manualPrices"] : [],
    rules: asRecord(args.body?.rules),
  };
}

async function persistPricing(workspace: TenderPricingWorkspace) {
  await getFirebaseAdmin().collection(TENDER_PRICING_COLLECTION).doc(workspace.id).set(workspace, { merge: true });
}

export async function getTenderPricingWorkspaceForDeal(dealId: string, actor: AuthorizedUser): Promise<TenderPricingWorkspace | null> {
  const deal = await loadDeal(dealId);
  await assertWorkspaceAccess(actor, asString(deal.workspaceId));
  const snapshot = await getFirebaseAdmin()
    .collection(TENDER_PRICING_COLLECTION)
    .where("dealId", "==", dealId)
    .limit(1)
    .get();
  if (snapshot.empty) return null;
  return { id: snapshot.docs[0].id, ...(snapshot.docs[0].data() ?? {}) } as TenderPricingWorkspace;
}

export async function startTenderPricingWorkspace(input: { dealId: string; actor: AuthorizedUser; body?: Record<string, unknown> }): Promise<TenderPricingWorkspace> {
  const deal = await loadDeal(input.dealId);
  await assertWorkspaceAccess(input.actor, asString(deal.workspaceId));
  const supplierQuotes = await listSupplierQuotesForDeal(input.dealId, input.actor);
  const canonicalSources = await loadCanonicalTenderPricingSources(input.dealId);
  const existing = await getTenderPricingWorkspaceForDeal(input.dealId, input.actor);
  const buildInput = buildInputFromDeal({ deal, actor: input.actor, body: { ...input.body, id: existing?.id }, canonicalSources });
  const workspace = buildTenderPricingWorkspace({
    ...buildInput,
    supplierQuotes,
    createdBy: existing?.createdBy ?? input.actor.uid,
  });
  await persistPricing(workspace);
  await writeAudit({ pricingId: workspace.id, dealId: workspace.dealId, workspaceId: workspace.workspaceId, actorUid: input.actor.uid, action: "TENDER_PRICING_STARTED", metadata: { blockers: workspace.blockers } });
  return workspace;
}

export async function updateTenderPricingWorkspace(input: { pricingId: string; actor: AuthorizedUser; body: Record<string, unknown> }): Promise<TenderPricingWorkspace> {
  const current = await loadPricing(input.pricingId, input.actor);
  if (current.lockStatus === "LOCKED") {
    const revised = createTenderPricingRevision(current, {
      changedBy: input.actor.uid,
      reason: asString(input.body.changeReason) ?? "Post-approval pricing change",
      newTotal: asNumber(input.body.total) ?? current.total,
      newMargin: asNumber(input.body.grossMarginPercentage) ?? current.grossMarginPercentage,
    });
    await persistPricing(revised);
    await writeAudit({ pricingId: revised.id, dealId: revised.dealId, workspaceId: revised.workspaceId, actorUid: input.actor.uid, action: "TENDER_PRICING_REVISION_CREATED" });
    return revised;
  }
  const deal = await loadDeal(current.dealId);
  const supplierQuotes = await listSupplierQuotesForDeal(current.dealId, input.actor);
  const canonicalSources = await loadCanonicalTenderPricingSources(current.dealId);
  const buildInput = buildInputFromDeal({ deal, actor: input.actor, body: { ...input.body, id: current.id }, canonicalSources });
  const rebuilt = buildTenderPricingWorkspace({ ...buildInput, supplierQuotes, createdBy: current.createdBy, now: nowIso() });
  await persistPricing(rebuilt);
  await writeAudit({ pricingId: rebuilt.id, dealId: rebuilt.dealId, workspaceId: rebuilt.workspaceId, actorUid: input.actor.uid, action: "TENDER_PRICING_UPDATED" });
  return rebuilt;
}

export async function approveTenderPricingWorkspace(input: { pricingId: string; actor: AuthorizedUser; role?: "staff" | "manager" | "director"; notes?: string | null }): Promise<TenderPricingWorkspace> {
  const current = await loadPricing(input.pricingId, input.actor);
  const role = input.role ?? (input.actor.role === "manager" || input.actor.role === "admin" ? "manager" : "staff");
  const approved = approveTenderPricing(current, { uid: input.actor.uid, role, notes: input.notes });
  await persistPricing(approved);
  await writeAudit({ pricingId: approved.id, dealId: approved.dealId, workspaceId: approved.workspaceId, actorUid: input.actor.uid, action: "TENDER_PRICING_APPROVED", metadata: { role } });
  return approved;
}

export async function generateTenderPricingDocument(input: { pricingId: string; actor: AuthorizedUser }): Promise<TenderPricingWorkspace> {
  const current = await loadPricing(input.pricingId, input.actor);
  const evidence = buildPricingScheduleFillEvidence(current);
  const next: TenderPricingWorkspace = {
    ...current,
    documentFillStatus: evidence.validationIssues.length ? "PREVIEW_REQUIRED" : "DOCUMENT_FILLED",
    pricingStatus: "DOCUMENT_FILLED",
    documentFillEvidence: evidence,
    updatedAt: nowIso(),
    nextAction: "Preview and validate the priced BOQ or pricing schedule.",
  };
  await persistPricing(next);
  await writeAudit({ pricingId: next.id, dealId: next.dealId, workspaceId: next.workspaceId, actorUid: input.actor.uid, action: "TENDER_PRICING_DOCUMENT_GENERATED", metadata: { warnings: evidence.warnings } });
  return next;
}

export async function validateTenderPricing(input: { pricingId: string; actor: AuthorizedUser }): Promise<TenderPricingWorkspace> {
  const current = await loadPricing(input.pricingId, input.actor);
  const blockers = validateTenderPricingWorkspace(current);
  const next: TenderPricingWorkspace = {
    ...current,
    blockers,
    validationStatus: blockers.length ? "VALIDATION_FAILED" : "VALIDATED",
    pricingStatus: blockers.length ? "VALIDATION_FAILED" : current.pricingStatus,
    updatedAt: nowIso(),
    nextAction: blockers[0]?.message ?? "Lock pricing revision.",
  };
  await persistPricing(next);
  await writeAudit({ pricingId: next.id, dealId: next.dealId, workspaceId: next.workspaceId, actorUid: input.actor.uid, action: "TENDER_PRICING_VALIDATED", metadata: { blockerCount: blockers.length } });
  return next;
}

export async function lockTenderPricingWorkspace(input: { pricingId: string; actor: AuthorizedUser }): Promise<TenderPricingWorkspace> {
  const current = await loadPricing(input.pricingId, input.actor);
  const locked = lockTenderPricing(current, input.actor.uid);
  await persistPricing(locked);
  await writeAudit({ pricingId: locked.id, dealId: locked.dealId, workspaceId: locked.workspaceId, actorUid: input.actor.uid, action: "TENDER_PRICING_LOCKED" });
  return locked;
}

export async function sendTenderPricingToSubmissionReview(input: { pricingId: string; actor: AuthorizedUser }): Promise<TenderPricingWorkspace> {
  const current = await loadPricing(input.pricingId, input.actor);
  const handoff = buildTenderPricingHandoff(current);
  const clientQuote = handoff.pricingApproved ? await createApprovedClientQuoteFromLockedPricing({ pricing: current, actor: input.actor }) : null;
  const next: TenderPricingWorkspace = {
    ...current,
    submissionReviewHandoff: handoff,
    updatedAt: nowIso(),
    nextAction: handoff.nextAction,
  };
  const now = new Date();
  await Promise.all([
    persistPricing(next),
    getFirebaseAdmin().collection("submissionReviews").doc(current.dealId).set({
      tenderPricingId: handoff.tenderPricingId,
      pricingStatus: handoff.pricingApproved ? "approved" : "blocked",
      boqStatus: handoff.pricingApproved ? "priced" : "blocked",
      pricingApproved: handoff.pricingApproved,
      pricingDocumentId: handoff.pricingDocumentId ?? null,
      pricingDocumentUrl: handoff.pricingDocumentUrl ?? null,
      clientQuoteId: clientQuote?.clientQuoteId ?? null,
      clientQuoteDocumentId: clientQuote?.generatedDocumentId ?? null,
      totalTenderValue: handoff.totalTenderValue,
      grossProfit: handoff.grossProfit,
      grossMargin: handoff.grossMargin,
      unresolvedPricingBlockers: handoff.unresolvedPricingBlockers,
      currentWorkflowPhase: handoff.workflowTransition,
      blockers: handoff.unresolvedPricingBlockers.map((item) => item.message),
      nextAction: handoff.nextAction,
      updatedAt: Timestamp.fromDate(now),
    }, { merge: true }),
    getFirebaseAdmin().collection("opportunityExecutionWorkspaces").doc(current.dealId).set({
      tenderPricingId: handoff.tenderPricingId,
      pricingStatus: handoff.pricingStatus,
      pricingComplete: handoff.pricingApproved,
      pricingApproved: handoff.pricingApproved,
      pricingDocumentId: handoff.pricingDocumentId ?? null,
      pricingDocumentUrl: handoff.pricingDocumentUrl ?? null,
      clientQuoteId: clientQuote?.clientQuoteId ?? null,
      clientQuoteDocumentId: clientQuote?.generatedDocumentId ?? null,
      totalTenderValue: handoff.totalTenderValue,
      grossProfit: handoff.grossProfit,
      grossMargin: handoff.grossMargin,
      unresolvedPricingBlockers: handoff.unresolvedPricingBlockers,
      currentPhase: handoff.workflowTransition,
      nextAction: handoff.nextAction,
      updatedAt: Timestamp.fromDate(now),
    }, { merge: true }),
  ]);
  await writeAudit({ pricingId: next.id, dealId: next.dealId, workspaceId: next.workspaceId, actorUid: input.actor.uid, action: "TENDER_PRICING_SENT_TO_SUBMISSION_REVIEW", metadata: { workflowTransition: handoff.workflowTransition } });
  return next;
}
