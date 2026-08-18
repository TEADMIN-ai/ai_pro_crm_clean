import { Timestamp } from "firebase-admin/firestore";
import type { AuthorizedUser } from "@/lib/server/authz";
import { getFirebaseAdmin } from "@/lib/firebase/admin";

type AnyRecord = Record<string, unknown>;

export const GOVERNED_PROCUREMENT_STATES = new Set([
  "approved",
  "ready",
  "ready_for_submission",
  "ready-for-submission",
  "ready for submission",
  "ready_to_submit",
  "ready-to-submit",
  "ready to submit",
  "rejected",
  "no_bid",
  "no-bid",
  "submitted",
  "awarded",
  "won",
  "lost",
  "abandoned",
  "cancelled",
  "canceled",
  "closed",
]);

export const GOVERNED_DEAL_PATCH_FIELDS = new Set([
  "status",
  "stage",
  "workflowStatus",
  "tenderSubmitted",
  "tenderLocked",
  "isTenderLocked",
  "submittedAt",
  "tenderSubmittedAt",
  "tenderSubmittedBy",
  "approvedAt",
  "approvedBy",
  "awardedAt",
  "awardedBy",
  "closedAt",
]);

const SAFE_DEAL_PATCH_FIELDS = new Set([
  "internalDescription",
  "internalNote",
  "notes",
  "riskNote",
  "description",
]);

const SUBMISSION_EVIDENCE_FIELDS = [
  "submissionDocumentId",
  "submissionEvidenceDocumentId",
  "submissionReceiptId",
  "sentEmailEvidenceId",
  "portalReference",
  "tenderPackId",
  "approvedTenderPackId",
  "generatedTenderPackId",
] as const;

export class ProcurementStateAuthorityError extends Error {
  status: number;
  code: string;

  constructor(message: string, status = 409, code = "PROCUREMENT_STATE_AUTHORITY_REJECTED") {
    super(message);
    this.name = "ProcurementStateAuthorityError";
    this.status = status;
    this.code = code;
  }
}

function asRecord(value: unknown): AnyRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as AnyRecord : {};
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function containsGovernedProcurementMutation(payload: AnyRecord): boolean {
  return Object.entries(payload).some(([key, value]) => {
    if (GOVERNED_DEAL_PATCH_FIELDS.has(key)) return true;
    if (typeof value === "string" && GOVERNED_PROCUREMENT_STATES.has(value.trim().toLowerCase())) return true;
    return false;
  });
}

export function assertNoGovernedProcurementMutation(payload: AnyRecord): void {
  if (containsGovernedProcurementMutation(payload)) {
    throw new ProcurementStateAuthorityError(
      "Governed procurement states must be changed through /api/opportunity-register/{dealId}/execution.",
      409,
      "GOVERNED_STATE_PATCH_REJECTED",
    );
  }
}

export function buildSafeDealMetadataPatch(payload: AnyRecord): AnyRecord {
  const patch: AnyRecord = {};
  for (const [key, value] of Object.entries(payload)) {
    if (!SAFE_DEAL_PATCH_FIELDS.has(key)) continue;
    if (typeof value === "string") patch[key] = value.trim();
    else if (value === null) patch[key] = null;
  }
  return patch;
}

export function normalizeSubmissionEvidence(value: unknown): {
  valid: boolean;
  evidenceReferences: Record<string, string>;
  reason: string | null;
} {
  const source = asRecord(value);
  const evidenceReferences: Record<string, string> = {};
  for (const field of SUBMISSION_EVIDENCE_FIELDS) {
    const fieldValue = asString(source[field]);
    if (fieldValue) evidenceReferences[field] = fieldValue;
  }

  if (Object.keys(evidenceReferences).length === 0) {
    return {
      valid: false,
      evidenceReferences,
      reason: "Durable submission evidence is required before marking an opportunity submitted.",
    };
  }

  return { valid: true, evidenceReferences, reason: null };
}

export async function getActorWorkspaceId(actor: AuthorizedUser): Promise<string | null> {
  if (actor.workspaceId) return actor.workspaceId;
  const snapshot = await getFirebaseAdmin().collection("users").doc(actor.uid).get();
  return asString((snapshot.data() ?? {}).workspaceId);
}

export async function assertDealWorkspaceAccess(actor: AuthorizedUser, deal: AnyRecord): Promise<void> {
  const actorWorkspaceId = await getActorWorkspaceId(actor);
  const dealWorkspaceId = asString(deal.workspaceId);
  if (actorWorkspaceId && dealWorkspaceId && actorWorkspaceId !== dealWorkspaceId) {
    throw new ProcurementStateAuthorityError("Cross-workspace deal mutation rejected.", 403, "CROSS_WORKSPACE_REJECTED");
  }
}

export async function recordProcurementTransitionAudit(input: {
  actor: AuthorizedUser;
  workspaceId?: string | null;
  dealId: string;
  action:
    | "transition_requested"
    | "transition_granted"
    | "transition_rejected"
    | "submission_evidence_accepted"
    | "legacy_bypass_rejected"
    | "tender_pack_delivery_sent";
  priorState?: string | null;
  requestedState?: string | null;
  resultingState?: string | null;
  reason?: string | null;
  evidenceReferences?: Record<string, unknown>;
}) {
  const now = new Date();
  const payload = {
    userId: input.actor.uid,
    action: `PROCUREMENT_${input.action.toUpperCase()}`,
    entityType: "deal",
    entityId: input.dealId,
    metadata: {
      workspaceId: input.workspaceId ?? null,
      priorState: input.priorState ?? null,
      requestedState: input.requestedState ?? null,
      resultingState: input.resultingState ?? null,
      reason: input.reason ?? null,
      evidenceReferences: input.evidenceReferences ?? {},
    },
    timestamp: Timestamp.fromDate(now),
    createdAt: Timestamp.fromDate(now),
  };
  await getFirebaseAdmin().collection("auditLogs").add(payload);
}

export function currentDealStateLabel(deal: AnyRecord): string {
  return [asString(deal.status), asString(deal.stage), asString(asRecord(deal.opportunityExecution).currentPhase)]
    .filter(Boolean)
    .join("/") || "unknown";
}
