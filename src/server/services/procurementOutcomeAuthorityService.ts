import { Timestamp } from "firebase-admin/firestore";

import { getFirebaseAdmin } from "@/lib/firebase/admin";
import type { AuthorizedUser } from "@/lib/server/authz";
import { currentDealStateLabel, recordProcurementTransitionAudit } from "@/lib/procurement/procurementStateAuthority";

export type ProcurementOutcomeStatus = "AWARDED" | "UNSUCCESSFUL" | "CANCELLED";

type RecordProcurementOutcomeInput = {
  dealId: string;
  actor: AuthorizedUser;
  outcome: ProcurementOutcomeStatus;
  outcomeEvidenceDocumentId: string;
  reference?: string | null;
  reason?: string | null;
  awardedAmount?: number | null;
  actualIncomeReference?: string | null;
};

type AnyRecord = Record<string, unknown>;

function asRecord(value: unknown): AnyRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as AnyRecord : {};
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

async function getActorWorkspaceId(actor: AuthorizedUser): Promise<string | null> {
  if (actor.workspaceId) return actor.workspaceId;
  const snapshot = await getFirebaseAdmin().collection("users").doc(actor.uid).get();
  return asString((snapshot.data() ?? {}).workspaceId);
}

function terminalOutcome(value: unknown): ProcurementOutcomeStatus | null {
  const normalized = asString(value)?.toUpperCase();
  return normalized === "AWARDED" || normalized === "UNSUCCESSFUL" || normalized === "CANCELLED"
    ? normalized
    : null;
}

export async function recordProcurementOutcome(input: RecordProcurementOutcomeInput) {
  const db = getFirebaseAdmin();
  const dealId = asString(input.dealId);
  const evidenceDocumentId = asString(input.outcomeEvidenceDocumentId);
  if (!dealId) throw Object.assign(new Error("dealId is required"), { status: 400, code: "OUTCOME_DEAL_REQUIRED" });
  if (!evidenceDocumentId) throw Object.assign(new Error("Durable outcome evidence Document_ID is required"), { status: 409, code: "OUTCOME_EVIDENCE_REQUIRED" });

  const dealRef = db.collection("deals").doc(dealId);
  const dealSnapshot = await dealRef.get();
  if (!dealSnapshot.exists) throw Object.assign(new Error("Opportunity not found"), { status: 404, code: "OUTCOME_OPPORTUNITY_NOT_FOUND" });

  const deal = { id: dealSnapshot.id, ...(dealSnapshot.data() ?? {}) } as AnyRecord & { id: string };
  const actorWorkspaceId = await getActorWorkspaceId(input.actor);
  const dealWorkspaceId = asString(deal.workspaceId);
  if (actorWorkspaceId && dealWorkspaceId && actorWorkspaceId !== dealWorkspaceId) {
    throw Object.assign(new Error("Cross-workspace outcome mutation rejected"), { status: 403, code: "CROSS_WORKSPACE_OUTCOME_REJECTED" });
  }

  const execution = asRecord(deal.opportunityExecution);
  const currentPhase = asString(execution.currentPhase)?.toUpperCase();
  const status = asString(deal.status)?.toUpperCase();
  if (currentPhase !== "SUBMITTED" && status !== "SUBMITTED") {
    throw Object.assign(new Error("Procurement outcome can only be recorded after governed submission"), { status: 409, code: "OUTCOME_REQUIRES_SUBMISSION" });
  }

  const existingOutcome = terminalOutcome(execution.outcomeStatus) ?? terminalOutcome(deal.status);
  if (existingOutcome) {
    throw Object.assign(new Error(`Procurement outcome is already terminal: ${existingOutcome}`), { status: 409, code: "OUTCOME_ALREADY_RECORDED" });
  }

  const submission = asRecord(execution.submission);
  const submissionEvidenceDocumentId = asString(submission.submissionEvidenceDocumentId)
    ?? asString(asRecord(submission.evidenceReferences).submissionEvidenceDocumentId);
  const tenderPackDocumentId = asString(submission.tenderPackDocumentId)
    ?? asString(asRecord(submission.evidenceReferences).tenderPackDocumentId);
  const clientQuoteId = asString(submission.clientQuoteId)
    ?? asString(asRecord(submission.evidenceReferences).clientQuoteId);
  if (!submissionEvidenceDocumentId || !tenderPackDocumentId || !clientQuoteId) {
    throw Object.assign(new Error("Canonical submission evidence chain is incomplete"), { status: 409, code: "OUTCOME_SUBMISSION_CHAIN_INCOMPLETE" });
  }

  const reason = asString(input.reason);
  if ((input.outcome === "UNSUCCESSFUL" || input.outcome === "CANCELLED") && !reason) {
    throw Object.assign(new Error("Outcome reason is required for unsuccessful or cancelled opportunities"), { status: 409, code: "OUTCOME_REASON_REQUIRED" });
  }

  const awardedAmount = input.outcome === "AWARDED" ? asFiniteNumber(input.awardedAmount) : null;
  if (input.outcome === "AWARDED" && (awardedAmount === null || awardedAmount < 0)) {
    throw Object.assign(new Error("Awarded amount is required for an awarded outcome"), { status: 409, code: "AWARDED_AMOUNT_REQUIRED" });
  }

  const now = new Date();
  const outcomeRef = db.collection("procurementOutcomes").doc();
  const outcomeRecord = {
    id: outcomeRef.id,
    outcomeId: outcomeRef.id,
    dealId,
    opportunityId: dealId,
    workspaceId: dealWorkspaceId,
    contractorId: asString(asRecord(deal.contractorAssignment).contractorId) ?? asString(deal.contractorId),
    clientQuoteId,
    tenderPackDocumentId,
    submissionEvidenceDocumentId,
    outcomeEvidenceDocumentId: evidenceDocumentId,
    outcome: input.outcome,
    reference: asString(input.reference),
    reason,
    awardedAmount,
    actualIncomeReference: asString(input.actualIncomeReference),
    recordedBy: input.actor.uid,
    recordedByEmail: input.actor.email ?? null,
    recordedAt: Timestamp.fromDate(now),
    createdAt: Timestamp.fromDate(now),
  };

  await recordProcurementTransitionAudit({
    actor: input.actor,
    workspaceId: dealWorkspaceId,
    dealId,
    action: "transition_requested",
    priorState: currentDealStateLabel(deal),
    requestedState: input.outcome,
    reason: `record_outcome:${input.outcome}`,
    evidenceReferences: {
      clientQuoteId,
      tenderPackDocumentId,
      submissionEvidenceDocumentId,
      outcomeEvidenceDocumentId: evidenceDocumentId,
    },
  });

  await outcomeRef.set(outcomeRecord);

  const nextExecution = {
    ...execution,
    currentPhase: input.outcome,
    outcomeStatus: input.outcome,
    outcomeId: outcomeRef.id,
    outcomeEvidenceDocumentId: evidenceDocumentId,
    outcomeRecordedAt: now.toISOString(),
    outcomeRecordedBy: input.actor.uid,
    outcomeReference: asString(input.reference),
    outcomeReason: reason,
    awardedAmount,
    actualIncomeReference: asString(input.actualIncomeReference),
    updatedAt: now.toISOString(),
  };

  await dealRef.set({
    status: input.outcome.toLowerCase(),
    stage: input.outcome.toLowerCase(),
    workflowStatus: input.outcome,
    opportunityExecution: nextExecution,
    outcomeId: outcomeRef.id,
    outcomeEvidenceDocumentId: evidenceDocumentId,
    awardedAmount,
    actualIncomeReference: asString(input.actualIncomeReference),
    updatedAt: now,
  }, { merge: true });

  await recordProcurementTransitionAudit({
    actor: input.actor,
    workspaceId: dealWorkspaceId,
    dealId,
    action: "transition_granted",
    priorState: currentDealStateLabel(deal),
    requestedState: input.outcome,
    resultingState: input.outcome,
    reason: `record_outcome:${input.outcome}`,
    evidenceReferences: {
      outcomeId: outcomeRef.id,
      clientQuoteId,
      tenderPackDocumentId,
      submissionEvidenceDocumentId,
      outcomeEvidenceDocumentId: evidenceDocumentId,
    },
  });

  return {
    outcome: outcomeRecord,
    financialResult: {
      opportunityId: dealId,
      clientQuoteId,
      awardedAmount,
      actualIncomeReference: asString(input.actualIncomeReference),
    },
  };
}
