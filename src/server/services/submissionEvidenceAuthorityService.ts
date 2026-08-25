import { randomUUID } from "node:crypto";
import { getFirebaseAdmin, getFirebaseStorageBucket } from "@/lib/firebase/admin";
import { assertPrivilegedRole, type AuthorizedUser } from "@/lib/server/authz";
import { getServerEnvironmentClassification } from "@/lib/server/environmentSafety";
import { isStagingSimulationAllowed, STAGING_SIMULATION_AUTHORITY, STAGING_SIMULATION_MESSAGE, STAGING_SIMULATION_SOURCE } from "@/lib/server/stagingSimulationSafety";

export type SubmissionEvidenceType = "PORTAL_RECEIPT" | "SENT_EMAIL" | "MANUAL_RECEIPT" | "SUBMISSION_DOCUMENT";
export type SubmissionEvidenceStatus = "READY_FOR_REVIEW" | "APPROVED" | "REJECTED";
export const CONTROLLED_STAGING_SUBMISSION_MARKER = "TEST / DO NOT SUBMIT";

function text(value: unknown): string | null { return typeof value === "string" && value.trim() ? value.trim() : null; }
async function dealFor(dealId: string) { const snapshot = await getFirebaseAdmin().collection("deals").doc(dealId).get(); if (!snapshot.exists) throw Object.assign(new Error("Opportunity not found"), { status: 404 }); return { id: snapshot.id, ...(snapshot.data() ?? {}) } as Record<string, unknown> & { id: string }; }
function assertWorkspace(actor: AuthorizedUser, workspaceId: string | null) { if (actor.workspaceId && workspaceId && actor.workspaceId !== workspaceId) throw Object.assign(new Error("Cross-workspace submission evidence access rejected"), { status: 403 }); }
function isApprovedEvidenceForDeal(evidence: Record<string, unknown>, dealId: string, workspaceId: string | null) { return evidence.dealId === dealId && (!text(evidence.opportunityId) || evidence.opportunityId === dealId) && (!workspaceId || evidence.workspaceId === workspaceId) && evidence.status === "APPROVED" && Boolean(text(evidence.reviewedBy)) && Boolean(text(evidence.reviewedAt)); }

export async function createSubmissionEvidence(input: { dealId: string; actor: AuthorizedUser; type: SubmissionEvidenceType; portalReference?: string | null; note?: string | null; testMarker?: string | null; file?: File | null }) {
  assertPrivilegedRole(input.actor); const deal = await dealFor(input.dealId); const workspaceId = text(deal.workspaceId); assertWorkspace(input.actor, workspaceId);
  if (!input.file && !text(input.portalReference)) throw Object.assign(new Error("A portal reference or PDF evidence file is required"), { status: 400 });
  const id = `SE-${randomUUID()}`; const now = new Date().toISOString(); let storagePath: string | null = null; let filename: string | null = null;
  if (input.file) { if (input.file.size <= 0 || !input.file.name.toLowerCase().endsWith(".pdf")) throw Object.assign(new Error("Submission evidence must be a PDF"), { status: 400 }); filename = input.file.name; storagePath = `uploads/deals/${input.dealId}/submission-evidence/${Date.now()}_${filename.replace(/[^a-zA-Z0-9._-]/g, "_")}`; await getFirebaseStorageBucket().file(storagePath).save(Buffer.from(await input.file.arrayBuffer()), { contentType: "application/pdf", resumable: false }); }
  const evidence = { id, dealId: input.dealId, opportunityId: input.dealId, workspaceId, evidenceType: input.type, portalReference: text(input.portalReference), note: text(input.note), storagePath, filename, testMarker: text(input.testMarker), status: "READY_FOR_REVIEW" as SubmissionEvidenceStatus, createdBy: input.actor.uid, createdByEmail: input.actor.email ?? null, createdAt: now, updatedAt: now, reviewedBy: null, reviewedAt: null };
  const environmentDecision = validateSubmissionEvidenceForEnvironment({ evidence });
  const governedEvidence = environmentDecision.controlledStaging ? { ...evidence, controlledStagingEvidence: true, externalSubmissionOccurred: false, testOnly: true, evidenceAuthority: STAGING_SIMULATION_AUTHORITY, evidenceSource: STAGING_SIMULATION_SOURCE, stagingSimulationMessage: STAGING_SIMULATION_MESSAGE } : evidence;
  const db = getFirebaseAdmin(); await db.collection("submissionEvidence").doc(id).set(governedEvidence); await db.collection("commercialAuthorityAuditEvents").add({ action: "submission_evidence_created", entityId: id, actor: input.actor.uid, workspaceId, metadata: { dealId: input.dealId, evidenceType: input.type, testMarker: governedEvidence.testMarker, controlledStagingEvidence: environmentDecision.controlledStaging, storagePath }, createdAt: new Date() }); return governedEvidence;
}

export async function reviewSubmissionEvidence(input: { dealId: string; evidenceId: string; actor: AuthorizedUser; status: "APPROVED" | "REJECTED"; reason?: string | null }) {
  assertPrivilegedRole(input.actor); const deal = await dealFor(input.dealId); const workspaceId = text(deal.workspaceId); assertWorkspace(input.actor, workspaceId); const ref = getFirebaseAdmin().collection("submissionEvidence").doc(input.evidenceId); const snapshot = await ref.get(); const existing = snapshot.exists ? snapshot.data() as Record<string, unknown> : null;
  if (!existing || existing.dealId !== input.dealId || (workspaceId && existing.workspaceId !== workspaceId)) throw Object.assign(new Error("Submission Evidence not found for this opportunity"), { status: 404 });
  const now = new Date().toISOString(); await ref.set({ status: input.status, reviewedBy: input.actor.uid, reviewedByEmail: input.actor.email ?? null, reviewedAt: now, rejectionReason: input.status === "REJECTED" ? text(input.reason) ?? "Rejected by reviewer" : null, updatedAt: now }, { merge: true }); await getFirebaseAdmin().collection("commercialAuthorityAuditEvents").add({ action: "submission_evidence_reviewed", entityId: input.evidenceId, actor: input.actor.uid, workspaceId, metadata: { dealId: input.dealId, status: input.status, reason: input.reason ?? null }, createdAt: new Date() }); return { ...existing, id: input.evidenceId, status: input.status, reviewedBy: input.actor.uid, reviewedAt: now };
}

export async function listSubmissionEvidence(dealId: string, actor: AuthorizedUser) { const deal = await dealFor(dealId); const workspaceId = text(deal.workspaceId); assertWorkspace(actor, workspaceId); const snapshot = await getFirebaseAdmin().collection("submissionEvidence").where("dealId", "==", dealId).get(); return snapshot.docs.map((item) => ({ id: item.id, ...(item.data() ?? {}) } as Record<string, unknown> & { id: string })); }

export async function resolveSubmissionEvidence(input: { dealId: string; evidenceId: string; actor: AuthorizedUser }) { const deal = await dealFor(input.dealId); const workspaceId = text(deal.workspaceId); assertWorkspace(input.actor, workspaceId); const snapshot = await getFirebaseAdmin().collection("submissionEvidence").doc(input.evidenceId).get(); const evidence = snapshot.exists ? ({ id: snapshot.id, ...(snapshot.data() ?? {}) } as Record<string, unknown> & { id: string }) : null; if (!evidence || !isApprovedEvidenceForDeal(evidence, input.dealId, workspaceId)) throw Object.assign(new Error("Approved Submission Evidence is required for this opportunity"), { status: 409, code: "SUBMISSION_EVIDENCE_NOT_APPROVED" }); validateSubmissionEvidenceForEnvironment({ evidence }); return evidence; }

export async function resolveSingleApprovedSubmissionEvidence(input: { dealId: string; actor: AuthorizedUser }) {
  const deal = await dealFor(input.dealId); const workspaceId = text(deal.workspaceId); assertWorkspace(input.actor, workspaceId);
  const snapshot = await getFirebaseAdmin().collection("submissionEvidence").where("dealId", "==", input.dealId).get();
  const eligible = snapshot.docs.map((item) => ({ id: item.id, ...(item.data() ?? {}) } as Record<string, unknown> & { id: string })).filter((item) => isApprovedEvidenceForDeal(item, input.dealId, workspaceId));
  if (eligible.length === 0) throw Object.assign(new Error("Approved Submission Evidence is required"), { status: 409, code: "SUBMISSION_EVIDENCE_REQUIRED" });
  if (eligible.length > 1) throw Object.assign(new Error("Multiple approved Submission Evidence records exist; select the evidence to record submission"), { status: 409, code: "SUBMISSION_EVIDENCE_AMBIGUOUS", evidenceIds: eligible.map((item) => item.id) });
  validateSubmissionEvidenceForEnvironment({ evidence: eligible[0] });
  return eligible[0];
}

import { resolveApprovedClientQuote } from "@/server/services/commercialAuthorityService";
import { resolveVerifiedTenderPackDocument } from "@/server/services/tenderPackCommercialAuthorityService";

export async function getSubmissionEvidenceAuthoritySnapshot(input: { dealId: string; actor: AuthorizedUser }) {
  const deal = await dealFor(input.dealId); const workspaceId = text(deal.workspaceId); assertWorkspace(input.actor, workspaceId);
  let clientQuoteReady = false; let tenderPackDocumentReady = false;
  try { await resolveApprovedClientQuote({ opportunityId: input.dealId, workspaceId, actor: input.actor }); clientQuoteReady = true; } catch { clientQuoteReady = false; }
  try { await resolveVerifiedTenderPackDocument({ opportunityId: input.dealId, workspaceId }); tenderPackDocumentReady = true; } catch { tenderPackDocumentReady = false; }
  const evidence = await listSubmissionEvidence(input.dealId, input.actor);
  const approvedEvidence = evidence.filter((item) => isApprovedEvidenceForDeal(item, input.dealId, workspaceId));
  return { clientQuoteReady, tenderPackDocumentReady, submissionEvidenceReady: approvedEvidence.length > 0, approvedSubmissionEvidenceId: approvedEvidence.length === 1 ? approvedEvidence[0].id : null, approvedSubmissionEvidenceCount: approvedEvidence.length, evidenceCount: evidence.length };
}




function normalizedType(value: unknown): SubmissionEvidenceType | null {
  const type = text(value)?.toUpperCase();
  if (type === "PORTAL_RECEIPT" || type === "SENT_EMAIL" || type === "MANUAL_RECEIPT" || type === "SUBMISSION_DOCUMENT") return type;
  return null;
}
function hasStorageArtifact(evidence: Record<string, unknown>) { return Boolean(text(evidence.storagePath) || text(evidence.documentId) || text(evidence.receiptDocumentId) || text(evidence.storageArtifactId)); }
function hasReference(evidence: Record<string, unknown>) { return Boolean(text(evidence.portalReference) || text(evidence.reference) || text(evidence.evidenceReference)); }
export function isControlledStagingSubmissionEvidence(evidence: Record<string, unknown>) { const marker = text(evidence.testMarker)?.toUpperCase(); return marker === CONTROLLED_STAGING_SUBMISSION_MARKER || evidence.controlledStagingEvidence === true || evidence.testOnly === true || evidence.evidenceAuthority === STAGING_SIMULATION_AUTHORITY || evidence.evidenceSource === STAGING_SIMULATION_SOURCE || evidence.externalSubmissionOccurred === false; }

export function validateSubmissionEvidenceForEnvironment(input: { evidence: Record<string, unknown>; env?: NodeJS.ProcessEnv }) {
  const env = input.env ?? process.env;
  const evidence = input.evidence;
  const type = normalizedType(evidence.evidenceType);
  if (!type) throw Object.assign(new Error("A valid submission evidence type is required"), { status: 400, code: "SUBMISSION_EVIDENCE_TYPE_REQUIRED" });
  const controlledStaging = isControlledStagingSubmissionEvidence(evidence);
  const stagingAllowed = isStagingSimulationAllowed(env);
  const classification = getServerEnvironmentClassification(env);
  if (controlledStaging) {
    if (!stagingAllowed) throw Object.assign(new Error("Controlled staging submission evidence is not valid in this server environment"), { status: 409, code: "CONTROLLED_STAGING_SUBMISSION_EVIDENCE_REJECTED" });
    return { controlledStaging: true, stagingAllowed, classification };
  }
  if (classification.isStagingFirebase && stagingAllowed) return { controlledStaging: false, stagingAllowed, classification };
  if (type === "PORTAL_RECEIPT" && !hasReference(evidence) && !hasStorageArtifact(evidence)) throw Object.assign(new Error("Portal submission evidence requires a portal/reference value or governed receipt artifact"), { status: 400, code: "PORTAL_RECEIPT_EVIDENCE_REQUIRED" });
  if (type === "SENT_EMAIL" && !hasReference(evidence) && !hasStorageArtifact(evidence)) throw Object.assign(new Error("Sent-email submission evidence requires a governed sent-email evidence reference or artifact"), { status: 400, code: "SENT_EMAIL_EVIDENCE_REQUIRED" });
  if ((type === "MANUAL_RECEIPT" || type === "SUBMISSION_DOCUMENT") && !hasStorageArtifact(evidence)) throw Object.assign(new Error("Manual submission receipt evidence requires a governed receipt/document artifact"), { status: 400, code: "MANUAL_RECEIPT_EVIDENCE_REQUIRED" });
  return { controlledStaging: false, stagingAllowed, classification };
}
