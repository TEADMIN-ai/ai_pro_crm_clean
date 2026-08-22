import { Timestamp } from "firebase-admin/firestore";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { assertPrivilegedRole, type AuthorizedUser } from "@/lib/server/authz";
import { listContractors } from "@/server/services/contractorService";
import { getContractorBusinessName, resolveContractorReference } from "@/lib/contractors/contractorReferenceResolver";
import { buildOpportunityExecutionState, extractOpportunityRequirements, hasValidContractorApproval, hasValidInternalReviewCompletion, hasValidSubmissionReviewCompletion, isDocumentPreparationComplete, isRecoverableLegacyInternalReviewState, isReopenedRequirementsReview, matchContractorsForOpportunity, mergeOpportunityDocuments, validateOpportunityTransition, type ContractorMatchResult, type OpportunityExecutionPhase, type OpportunityRequirementReview } from "@/lib/opportunities/opportunityExecution";
import { buildProcurementExecutionProjection, hasGovernedLockedPricing } from "@/lib/opportunities/procurementExecutionProjection";
import { getDealContractorReference } from "@/lib/deals/contractorReference";
import { assertAssignmentAllowed, evaluateContractorAssignmentAuthority } from "@/server/services/contractorAssignmentAuthorityService";
import { currentDealStateLabel, normalizeSubmissionEvidence, recordProcurementTransitionAudit } from "@/lib/procurement/procurementStateAuthority";
import { resolveApprovedClientQuote } from "@/server/services/commercialAuthorityService";
import { resolveVerifiedTenderPackDocument } from "@/server/services/tenderPackCommercialAuthorityService";
import { getSubmissionEvidenceAuthoritySnapshot, resolveSingleApprovedSubmissionEvidence, resolveSubmissionEvidence } from "@/server/services/submissionEvidenceAuthorityService";

type ActionInput = { dealId: string; action: string; actor: AuthorizedUser; contractorId?: string; requirements?: Partial<OpportunityRequirementReview>; submission?: Record<string, unknown> };
function asString(value: unknown): string | null { return typeof value === "string" && value.trim() ? value.trim() : null; }
function asRecord(value: unknown): Record<string, unknown> { return value && typeof value === "object" ? value as Record<string, unknown> : {}; }
function asNumber(value: unknown): number | null { return typeof value === "number" && Number.isFinite(value) ? value : null; }
function eventKey(parts: string[]): string { return parts.map((part) => part.trim().replace(/[^a-zA-Z0-9_-]+/g, "-")).filter(Boolean).join("__"); }
function existingCreatedAt(value: unknown, fallback: Date) { return value ?? Timestamp.fromDate(fallback); }
async function getUserWorkspaceId(uid: string): Promise<string | null> {
  const snapshot = await getFirebaseAdmin().collection("users").doc(uid).get();
  return asString((snapshot.data() ?? {}).workspaceId);
}
async function loadDealRecord(dealId: string) {
  const dealRef = getFirebaseAdmin().collection("deals").doc(dealId);
  const [snapshot, documentsSnapshot] = await Promise.all([dealRef.get(), dealRef.collection("documents").get()]);
  if (!snapshot.exists) throw Object.assign(new Error("Opportunity not found"), { status: 404 });
  const data = snapshot.data() ?? {};
  const documents = mergeOpportunityDocuments(data.documents, documentsSnapshot.docs.map((document) => ({ id: document.id, ...(document.data() ?? {}) })));
  return { id: snapshot.id, ...data, documents } as Record<string, unknown> & { id: string };
}
async function loadCanonicalTenderPricing(dealId: string): Promise<Record<string, unknown> | null> {
  const snapshot = await getFirebaseAdmin().collection("tenderPricingWorkspaces").where("dealId", "==", dealId).limit(1).get();
  if (snapshot.empty) return null;
  return { id: snapshot.docs[0].id, ...(snapshot.docs[0].data() ?? {}) };
}

function contractorReferenceFromDeal(deal: Record<string, unknown>): string | null {
  const reference = getDealContractorReference(deal);
  return reference.status === "reference_present" ? reference.value : null;
}

function isArchivedContractor(contractor: Record<string, unknown>): boolean {
  return contractor.archived === true || asString(contractor.status)?.toLowerCase() === "archived";
}
async function assertWorkspaceAccess(actor: AuthorizedUser, deal: Record<string, unknown>) {
  const actorWorkspaceId = await getUserWorkspaceId(actor.uid);
  const dealWorkspaceId = asString(deal.workspaceId);
  if (actorWorkspaceId && dealWorkspaceId && actorWorkspaceId !== dealWorkspaceId) throw Object.assign(new Error("Cross-workspace access rejected"), { status: 403 });
}
export async function getOpportunityExecutionView(dealId: string, actor?: AuthorizedUser) {
  const deal = await loadDealRecord(dealId);
  if (actor) await assertWorkspaceAccess(actor, deal);
  const contractorReference = contractorReferenceFromDeal(deal);
  const resolved = contractorReference ? await resolveContractorReference({ reference: contractorReference, expectedWorkspaceId: asString(deal.workspaceId), actor, dealId, logContext: "opportunity_execution_view" }) : null;
  const contractor = resolved?.ok && !isArchivedContractor(resolved.contractor) ? resolved.contractor : null;
const canonicalPricing = await loadCanonicalTenderPricing(dealId);
const submissionAuthority = actor ? await getSubmissionEvidenceAuthoritySnapshot({ dealId, actor }) : { clientQuoteReady: false, tenderPackDocumentReady: false, submissionEvidenceReady: false, evidenceCount: 0 };
const projectionDeal = { ...deal, submissionAuthority, ...(canonicalPricing ? { tenderPricing: canonicalPricing } : {}), sarsTcsSummary: contractor ? (contractor as Record<string, unknown>).sarsTcsSummary : null };
const stateDeal = canonicalPricing && hasGovernedLockedPricing(canonicalPricing) ? { ...projectionDeal, opportunityExecution: { ...asRecord(asRecord(projectionDeal).opportunityExecution), pricingComplete: true } } : projectionDeal;
const state = buildOpportunityExecutionState({ deal: stateDeal, contractor: contractor as Record<string, unknown> | null });
const projection = buildProcurementExecutionProjection({ deal: stateDeal, state, remediationRequests: state.remediationRequests });
  const baseMatches = matchContractorsForOpportunity({ deal, contractors: await listContractors({ workspaceId: asString(deal.workspaceId), actorRole: actor?.role ?? null }) as Array<Record<string, unknown> & { id: string }> });
  const matches: ContractorMatchResult[] = actor
    ? await Promise.all(baseMatches.map(async (match) => {
      const decision = await evaluateContractorAssignmentAuthority({ dealId, contractorReference: match.contractorId, actor, deal });
      return {
        ...match,
        contractorId: decision.contractorId ?? match.contractorId,
        assignmentAllowed: decision.status === "ALLOWED",
        eligible: decision.status === "ALLOWED",
        blockingReasons: decision.blockers,
        recommendationReason: decision.blockers.length ? decision.blockers.join("; ") : match.recommendationReason,
        readinessDecisionStatus: decision.readinessDecisionStatus,
        decisionLogicVersion: decision.decisionLogicVersion,
        authorityStatus: decision.status,
      };
    }))
    : baseMatches.map((match) => ({
      ...match,
      assignmentAllowed: false,
      eligible: false,
      blockingReasons: ["Authenticated actor context is required for assignment authority"],
      recommendationReason: "Authenticated actor context is required for assignment authority",
      readinessDecisionStatus: "UNKNOWN",
      decisionLogicVersion: null,
      authorityStatus: "BLOCKED",
    }));
  const activitySnapshot = await getFirebaseAdmin().collection("deals").doc(dealId).collection("activity").orderBy("createdAt", "desc").limit(25).get();
  const activity = activitySnapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() ?? {}) }));
  return { deal, contractor, state, projection, matches, activity };
}

function targetPhaseForAction(action: string, deal: Record<string, unknown>): OpportunityExecutionPhase | null {
  if (action === "reopen_requirements_review") return asString(asRecord(deal.opportunityExecution).currentPhase) as OpportunityExecutionPhase | null;
  if (action === "review_requirements") return "MATCHING_REQUIRED";
  if (action === "find_matching_contractors") return "MATCHING_REQUIRED";
  if (action === "assign_contractor") return "COMPLIANCE_REVIEW";
  if (action === "start_compliance_review") return "COMPLIANCE_REVIEW";
  if (action === "open_boq_pricing") return "BOQ_PRICING";
  if (action === "prepare_documents") return "INTERNAL_REVIEW";
  if (action === "start_internal_review") return asString(asRecord(deal.opportunityExecution).currentPhase) as OpportunityExecutionPhase | null; if (action === "complete_internal_review") return "CONTRACTOR_APPROVAL"; if (action === "reconcile_legacy_internal_review") return "INTERNAL_REVIEW"; if (action === "complete_submission_review") return "READY_FOR_SUBMISSION";
  if (action === "contractor_approval") return "PACK_GENERATION";
  if (action === "generate_tender_pack") return "PACK_GENERATION";
  if (action === "mark_ready_for_submission") return "READY_FOR_SUBMISSION";
  if (action === "record_submission") return "SUBMITTED";
  return asString(asRecord(deal.opportunityExecution).currentPhase) as OpportunityExecutionPhase | null;
}

export async function applyOpportunityExecutionAction(input: ActionInput) {
  const db = getFirebaseAdmin();
  const deal = await loadDealRecord(input.dealId);
  await assertWorkspaceAccess(input.actor, deal);
  if (input.action === "reopen_requirements_review" || input.action === "review_requirements" || input.action === "start_internal_review" || input.action === "complete_internal_review" || input.action === "reconcile_legacy_internal_review" || input.action === "complete_submission_review" || input.action === "mark_ready_for_submission") assertPrivilegedRole(input.actor); if (input.action === "complete_submission_review" && input.actor.role !== "admin" && input.actor.role !== "manager") throw Object.assign(new Error("Manager or admin authorization is required"), { status: 403 });
  const currentView = await getOpportunityExecutionView(input.dealId, input.actor);
  const current = currentView.state.currentPhase; if (input.action === "complete_submission_review" && (current !== "READY_FOR_SUBMISSION" || !hasValidInternalReviewCompletion(deal) || !hasValidContractorApproval(deal) || !["VALIDATED", "GENERATED"].includes(String(currentView.projection.packStatus ?? "").toUpperCase()) || currentView.projection.blockers.length > 0)) throw Object.assign(new Error("Submission Review prerequisites are not satisfied"), { status: 409 }); if (input.action === "reconcile_legacy_internal_review" && !isRecoverableLegacyInternalReviewState(deal)) throw Object.assign(new Error("No recoverable legacy internal-review state detected"), { status: 409 }); if (input.action === "contractor_approval" && (current !== "CONTRACTOR_APPROVAL" || !hasValidInternalReviewCompletion(deal))) throw Object.assign(new Error("Explicit completed internal review is required before contractor approval"), { status: 409 }); if (input.action === "generate_tender_pack" && (current !== "PACK_GENERATION" || !hasValidInternalReviewCompletion(deal) || !hasValidContractorApproval(deal))) throw Object.assign(new Error("Governed internal review and contractor approval provenance are required before tender-pack generation"), { status: 409 }); if ((input.action === "start_internal_review" || input.action === "complete_internal_review") && current !== "INTERNAL_REVIEW") throw Object.assign(new Error("Internal review is not the current governed phase"), { status: 409 }); if (input.action === "complete_internal_review" && !currentView.state.stages.some((stage) => stage.key === "internalReview" && stage.status === "IN_PROGRESS")) throw Object.assign(new Error("Internal review must be started before completion"), { status: 409 }); if (input.action === "record_submission" && (current !== "READY_FOR_SUBMISSION" || !hasValidSubmissionReviewCompletion(deal))) throw Object.assign(new Error("Submission Review must be explicitly completed before recording submission"), { status: 409 });
  if (input.action === "mark_ready_for_submission" && current !== "PACK_GENERATION") throw Object.assign(new Error("Pack generation must complete before marking ready for submission"), { status: 409 });
  if (input.action === "mark_ready_for_submission") {
    const workspaceId = asString(deal.workspaceId);
    await resolveApprovedClientQuote({ opportunityId: input.dealId, workspaceId, clientQuoteId: asString(asRecord(deal.opportunityExecution).clientQuoteId), actor: input.actor });
    await resolveVerifiedTenderPackDocument({ opportunityId: input.dealId, workspaceId, documentId: asString(asRecord(deal.opportunityExecution).tenderPackDocumentId) });
  }
  if (input.action === "reopen_requirements_review" && !currentView.state.requirements.reviewed) throw Object.assign(new Error("Requirements review is not complete"), { status: 409 });
  if (input.action === "review_requirements" && currentView.state.requirements.reviewed && !isReopenedRequirementsReview(currentView.state.requirements)) throw Object.assign(new Error("Requirements review must be reopened before it can be amended"), { status: 409 });
  if (input.action === "review_requirements" && !currentView.state.requirements.reviewed && !isReopenedRequirementsReview(currentView.state.requirements) && current !== "REQUIREMENTS_REVIEW") throw Object.assign(new Error("Requirements review is not the current governed phase"), { status: 409 });
  let governedTenderPackDocument: Record<string, unknown> | null = null;
  if (input.action === "generate_tender_pack") governedTenderPackDocument = await resolveVerifiedTenderPackDocument({ opportunityId: input.dealId, workspaceId: asString(deal.workspaceId), documentId: asString(asRecord(deal.opportunityExecution).tenderPackDocumentId) });
  const reopenedRequirementsReview = input.action === "review_requirements" && isReopenedRequirementsReview(currentView.state.requirements);
  const prepareDocumentsComplete = input.action === "prepare_documents" && current === "DOCUMENT_PREPARATION" && isDocumentPreparationComplete(currentView.state);
  const target = reopenedRequirementsReview || (input.action === "reopen_requirements_review") ? current : prepareDocumentsComplete ? "INTERNAL_REVIEW" : input.action === "prepare_documents" && current === "DOCUMENT_PREPARATION" ? "DOCUMENT_PREPARATION" as OpportunityExecutionPhase : targetPhaseForAction(input.action, deal);
  if (!target) throw Object.assign(new Error("Unknown opportunity action"), { status: 400 });
  if (!reopenedRequirementsReview) {
    await recordProcurementTransitionAudit({
      actor: input.actor,
      workspaceId: asString(deal.workspaceId),
      dealId: input.dealId,
      action: "transition_requested",
      priorState: currentDealStateLabel(deal),
      requestedState: target,
      reason: input.action,
    });
    const transition = validateOpportunityTransition(current, target);
    if (transition.ok === false) {
      await recordProcurementTransitionAudit({
        actor: input.actor,
        workspaceId: asString(deal.workspaceId),
        dealId: input.dealId,
        action: "transition_rejected",
        priorState: currentDealStateLabel(deal),
        requestedState: target,
        reason: transition.message,
      });
      throw Object.assign(new Error(transition.message), { status: transition.status });
    }
  }
  let submissionEvidence: ReturnType<typeof normalizeSubmissionEvidence> | null = null;
  const submissionPayload: Record<string, unknown> = { ...(input.submission ?? {}) };
  if (input.action === "record_submission") {
    const workspaceId = asString(deal.workspaceId);
    const clientQuote = await resolveApprovedClientQuote({ opportunityId: input.dealId, workspaceId, clientQuoteId: asString(submissionPayload.clientQuoteId), actor: input.actor });
    const tenderPack = await resolveVerifiedTenderPackDocument({ opportunityId: input.dealId, workspaceId, documentId: asString(submissionPayload.tenderPackDocumentId) });
    const explicitSubmissionEvidenceDocumentId = asString(submissionPayload.submissionEvidenceDocumentId);
    const resolvedSubmissionEvidence = explicitSubmissionEvidenceDocumentId ? null : await resolveSingleApprovedSubmissionEvidence({ dealId: input.dealId, actor: input.actor });
    const submissionEvidenceDocumentId = explicitSubmissionEvidenceDocumentId ?? asString(resolvedSubmissionEvidence?.id);
    if (!submissionEvidenceDocumentId) throw Object.assign(new Error("Approved Submission Evidence is required"), { status: 409, code: "SUBMISSION_EVIDENCE_REQUIRED" });
    const evidence = await resolveSubmissionEvidence({ dealId: input.dealId, evidenceId: submissionEvidenceDocumentId, actor: input.actor });
    submissionPayload.clientQuoteId = clientQuote.clientQuoteId;
    submissionPayload.tenderPackDocumentId = tenderPack.documentId;
    submissionPayload.submissionEvidenceDocumentId = evidence.id;
    submissionEvidence = normalizeSubmissionEvidence(submissionPayload);
    if (!submissionEvidence.valid) {
      await recordProcurementTransitionAudit({
        actor: input.actor,
        workspaceId: asString(deal.workspaceId),
        dealId: input.dealId,
        action: "transition_rejected",
        priorState: currentDealStateLabel(deal),
        requestedState: target,
        reason: submissionEvidence.reason,
        evidenceReferences: submissionEvidence.evidenceReferences,
      });
      throw Object.assign(new Error(submissionEvidence.reason ?? "Submission evidence is required"), { status: 409 });
    }
    await recordProcurementTransitionAudit({
      actor: input.actor,
      workspaceId: asString(deal.workspaceId),
      dealId: input.dealId,
      action: "submission_evidence_accepted",
      priorState: currentDealStateLabel(deal),
      requestedState: target,
      evidenceReferences: submissionEvidence.evidenceReferences,
    });
  }
  if (submissionEvidence) {
    submissionEvidence.evidenceReferences.clientQuoteId = asString(submissionPayload.clientQuoteId) ?? "";
    submissionEvidence.evidenceReferences.tenderPackDocumentId = asString(submissionPayload.tenderPackDocumentId) ?? "";
    submissionEvidence.evidenceReferences.submissionEvidenceDocumentId = asString(submissionPayload.submissionEvidenceDocumentId) ?? "";
  }
  const now = new Date();
  const patch: Record<string, unknown> = { updatedAt: now, workflowStatus: target };
  const existingExecution = asRecord(deal.opportunityExecution);
  const requirements = input.action === "reopen_requirements_review" ? extractOpportunityRequirements(deal) : { ...extractOpportunityRequirements(deal), ...(input.requirements ?? {}) };
  const execution: Record<string, unknown> = { ...existingExecution, currentPhase: target, executionWorkspaceId: existingExecution.executionWorkspaceId ?? `exec-${input.dealId}`, updatedAt: now.toISOString() };
  if (input.action === "reopen_requirements_review") { const priorRequirements = { ...requirements }; execution.requirementsReviewed = false; execution.requirements = { ...priorRequirements, reviewed: false, reviewStatus: "IN_REVIEW", reopenedAt: now.toISOString(), reopenedByUid: input.actor.uid }; }
  if (input.action === "review_requirements") { execution.requirementsReviewed = true; requirements.reviewed = true; requirements.reviewStatus = "APPROVED"; requirements.reviewedAt = now.toISOString(); requirements.reviewedByUid = input.actor.uid; execution.requirements = requirements; }
  if (input.action === "find_matching_contractors") execution.matchingCompleted = true;
  if (prepareDocumentsComplete) execution.documentsPrepared = true;
  if (input.action === "assign_contractor") {
    if (!input.contractorId) throw Object.assign(new Error("contractorId is required"), { status: 400 });
    await db.collection("deals").doc(input.dealId).set({ candidateContractorId: input.contractorId, contractorResolutionStatus: "REVIEW_REQUIRED", contractorAssignmentRequest: { requestedBy: input.actor.uid, requestedAt: now.toISOString(), candidateContractorId: input.contractorId } }, { merge: true });
    await recordProcurementTransitionAudit({ actor: input.actor, workspaceId: asString(deal.workspaceId), dealId: input.dealId, action: "transition_requested", priorState: currentDealStateLabel(deal), requestedState: "CONTRACTOR_ASSIGNMENT", reason: "Contractor assignment requested; candidate remains non-authoritative", evidenceReferences: { candidateContractorId: input.contractorId } });
    const authority = await evaluateContractorAssignmentAuthority({ dealId: input.dealId, contractorReference: input.contractorId, actor: input.actor, targetPhase: target, deal });
    if (authority.status !== "ALLOWED") {
      await recordProcurementTransitionAudit({ actor: input.actor, workspaceId: asString(deal.workspaceId), dealId: input.dealId, action: "transition_rejected", priorState: currentDealStateLabel(deal), requestedState: "CONTRACTOR_ASSIGNMENT", reason: authority.blockers.join("; "), evidenceReferences: { contractorId: authority.contractorId, blockers: authority.blockers } });
    }
    assertAssignmentAllowed(authority);
    const canonicalContractorId = authority.contractorId as string;
    const canonicalContractorName = authority.contractor ? getContractorBusinessName(authority.contractor) : canonicalContractorId;
    const workspaceId = authority.workspaceId as string;
    const executionWorkspaceId = `exec-${input.dealId}`;
    const submissionReviewId = input.dealId;
    const existingAssignment = asRecord(deal.contractorAssignment);
    const previousContractorId = asString(existingAssignment.contractorId);
    const sameAssignment = previousContractorId === canonicalContractorId;
    const assignmentVersion = sameAssignment ? asNumber(existingAssignment.assignmentVersion) ?? 1 : (asNumber(existingAssignment.assignmentVersion) ?? 0) + 1;
    const assignedAt = sameAssignment ? asString(existingAssignment.assignedAt) ?? now.toISOString() : now.toISOString();
    const assignmentEventKey = eventKey(["opportunity_assignment", input.dealId, canonicalContractorId, `v${assignmentVersion}`]);
    const assignment = { contractorId: canonicalContractorId, contractorName: canonicalContractorName, assignedAt, assignedBy: input.actor.uid, assignedByEmail: input.actor.email ?? null, assignmentStatus: "assigned", assignmentReason: null, opportunityId: input.dealId, dealId: input.dealId, workspaceId, executionWorkspaceId, submissionReviewId, assignmentVersion, assignmentEventKey };
    patch.contractorId = canonicalContractorId; patch.companyId = canonicalContractorId;
    patch.contractorName = canonicalContractorName;
    patch.contractorAssignment = assignment;
    patch.submissionReview = { id: submissionReviewId, connectedAt: sameAssignment ? asString(asRecord(deal.submissionReview).connectedAt) ?? now.toISOString() : now.toISOString() };
    execution.contractorId = canonicalContractorId; execution.assignmentCreatedAt = sameAssignment ? asString(existingExecution.assignmentCreatedAt) ?? assignedAt : assignedAt;
    execution.assignment = assignment; execution.executionWorkspaceId = executionWorkspaceId; execution.submissionReviewId = submissionReviewId; execution.assignmentVersion = assignmentVersion; execution.assignmentEventKey = assignmentEventKey;
  }
  if (input.action === "start_compliance_review") execution.complianceReviewed = true;
  if (input.action === "open_boq_pricing") execution.boqTaskCreated = true;
  if (input.action === "prepare_documents") {
    if (current === "DOCUMENT_PREPARATION") {
      const existingPreparation = asRecord(existingExecution.documentPreparation);
      execution.documentPreparation = { ...existingPreparation, status: prepareDocumentsComplete ? "COMPLETE" : "IN_PROGRESS", openedAt: existingPreparation.openedAt ?? now.toISOString(), openedBy: existingPreparation.openedBy ?? input.actor.uid, returnables: currentView.state.documentChecklist.map((item) => ({ key: item.key, label: item.label, required: item.required, status: item.status, source: item.source })) };
    } else {
      execution.documentsPrepared = true;
    }
  }
  if (input.action === "start_internal_review") execution.internalReviewStarted = true; if (input.action === "complete_internal_review") { execution.internalReviewStarted = true; execution.internalReviewApproved = true; execution.internalReviewApprovalProvenance = { action: "complete_internal_review", status: "APPROVED", completedAt: now.toISOString(), completedBy: input.actor.uid, completedByEmail: input.actor.email ?? null }; } if (input.action === "reconcile_legacy_internal_review") { execution.currentPhase = "INTERNAL_REVIEW"; execution.internalReviewStarted = true; execution.internalReviewApproved = false; execution.internalReviewApprovalProvenance = null; execution.contractorApprovalComplete = false; execution.contractorApprovalProvenance = null; execution.tenderPackGenerated = false; execution.tenderPackValidated = false; execution.readyForSubmission = false; }
  if (input.action === "complete_submission_review") { execution.submissionReviewApprovalProvenance = { action: "complete_submission_review", status: "APPROVED", completedAt: now.toISOString(), completedBy: input.actor.uid, completedByEmail: input.actor.email ?? null }; }
  if (input.action === "contractor_approval") { execution.contractorApprovalComplete = true; execution.contractorApprovalProvenance = { action: "contractor_approval", status: "APPROVED", completedAt: now.toISOString(), completedBy: input.actor.uid, completedByEmail: input.actor.email ?? null }; }
  if (input.action === "generate_tender_pack") { execution.tenderPackGenerated = true; execution.tenderPackValidated = true; execution.tenderPackDocumentId = governedTenderPackDocument?.documentId ?? null; }
  if (input.action === "mark_ready_for_submission") execution.readyForSubmission = true;
  if (input.action === "record_submission") { execution.submitted = true; execution.submission = { ...submissionPayload, evidenceReferences: submissionEvidence?.evidenceReferences ?? {} }; patch.status = "submitted"; patch.stage = "submitted"; patch.tenderSubmittedAt = now; patch.tenderSubmittedBy = input.actor.uid; }
  if (input.action === "assign_contractor") {
    const assignment = asRecord(patch.contractorAssignment);
    const executionWorkspaceId = asString(assignment.executionWorkspaceId) ?? `exec-${input.dealId}`;
    const submissionReviewId = input.dealId;
    const [executionWorkspaceSnapshot, submissionReviewSnapshot] = await Promise.all([
      db.collection("opportunityExecutionWorkspaces").doc(input.dealId).get(),
      db.collection("submissionReviews").doc(submissionReviewId).get(),
    ]);
    const executionWorkspaceData = executionWorkspaceSnapshot.data?.() ?? {};
    const submissionReviewData = submissionReviewSnapshot.data?.() ?? {};
    await db.collection("opportunityExecutionWorkspaces").doc(input.dealId).set({ id: executionWorkspaceId, opportunityId: input.dealId, dealId: input.dealId, contractorId: assignment.contractorId, contractorName: assignment.contractorName, workspaceId: assignment.workspaceId, sourceDocuments: deal.documents ?? [], closingDate: deal.closingDate ?? deal.deadline ?? null, requirements, currentPhase: target, updatedAt: Timestamp.fromDate(now), createdAt: existingCreatedAt(executionWorkspaceData.createdAt, now) }, { merge: true });
    await db.collection("submissionReviews").doc(submissionReviewId).set({ id: submissionReviewId, opportunityId: input.dealId, dealId: input.dealId, contractorId: assignment.contractorId, contractorName: assignment.contractorName, workspaceId: assignment.workspaceId, readiness: submissionReviewData.readiness ?? 0, validationStatus: submissionReviewData.validationStatus ?? "pending", complianceStatus: submissionReviewData.complianceStatus ?? "pending", pricingStatus: submissionReviewData.pricingStatus ?? (requirements.boqPricingSchedulePresent ? "pending" : "not_applicable"), boqStatus: submissionReviewData.boqStatus ?? (requirements.boqPricingSchedulePresent ? "required" : "not_applicable"), documentStatus: submissionReviewData.documentStatus ?? "pending", signatureStatus: submissionReviewData.signatureStatus ?? "pending", approvalStatus: submissionReviewData.approvalStatus ?? "pending", packStatus: submissionReviewData.packStatus ?? "pending", blockers: submissionReviewData.blockers ?? ["Compliance review is required"], nextAction: submissionReviewData.nextAction ?? "Start compliance review", updatedAt: Timestamp.fromDate(now), createdAt: existingCreatedAt(submissionReviewData.createdAt, now) }, { merge: true });
  }
  patch.opportunityExecution = execution;
  await db.collection("deals").doc(input.dealId).set(patch, { merge: true });
  if (input.action === "complete_submission_review") await db.collection("submissionReviews").doc(input.dealId).set({ reviewStatus: "APPROVED", approvalStatus: "APPROVED", nextAction: "Record submission", submissionReviewApprovalProvenance: execution.submissionReviewApprovalProvenance, updatedAt: Timestamp.fromDate(now) }, { merge: true });
  const deterministicEventKey = input.action === "assign_contractor"
    ? asString(asRecord(patch.contractorAssignment).assignmentEventKey) ?? eventKey(["opportunity_assignment", input.dealId, asString(asRecord(patch.contractorAssignment).contractorId) ?? "unknown"])
    : null;
  const activityPayload = {
    type: input.action === "assign_contractor" ? "contractor_assigned" : "opportunity_execution",
    message: input.action === "assign_contractor" ? "Contractor assigned and execution workspace connected" : `Opportunity execution action: ${input.action}`,
    performedByEmail: input.actor.email ?? null,
    createdAt: Timestamp.fromDate(now),
    phase: target,
    eventKey: deterministicEventKey,
  };
  const auditPayload = {
    userId: input.actor.uid,
    action: input.action === "assign_contractor" ? "OPPORTUNITY_CONTRACTOR_ASSIGNED" : input.action === "reopen_requirements_review" ? "OPPORTUNITY_REQUIREMENTS_REOPENED" : input.action === "reconcile_legacy_internal_review" ? "LEGACY_INTERNAL_REVIEW_STATE_RECONCILED" : input.action === "complete_submission_review" ? "SUBMISSION_REVIEW_COMPLETED" : "OPPORTUNITY_EXECUTION_UPDATED",
    entityType: "deal",
    entityId: input.dealId,
    metadata: { action: input.action, phase: target, eventKey: deterministicEventKey, ...(input.action === "reopen_requirements_review" ? { priorRequirements: requirements, priorReviewStatus: requirements.reviewStatus ?? "APPROVED" } : {}), ...(input.action === "reconcile_legacy_internal_review" ? { reason: "Reconcile legacy internal-review state without trusting legacy approval", priorPhase: current, recoveredPhase: target, priorInternalReviewStarted: Boolean(existingExecution.internalReviewStarted), priorInternalReviewApproved: Boolean(existingExecution.internalReviewApproved), priorContractorApprovalComplete: Boolean(existingExecution.contractorApprovalComplete), priorTenderPackGenerated: Boolean(existingExecution.tenderPackGenerated), priorTenderPackValidated: Boolean(existingExecution.tenderPackValidated), recoveredInternalReviewStarted: true, recoveredInternalReviewApproved: false, recoveredContractorApprovalComplete: false, recoveredTenderPackGenerated: false, recoveredTenderPackValidated: false } : {}) },
    createdAt: Timestamp.fromDate(now),
  };
  if (deterministicEventKey) {
    const [activityEventSnapshot, auditEventSnapshot] = await Promise.all([
      db.collection("deals").doc(input.dealId).collection("activity").doc(deterministicEventKey).get(),
      db.collection("auditLogs").doc(deterministicEventKey).get(),
    ]);
    if (!activityEventSnapshot.exists) await db.collection("deals").doc(input.dealId).collection("activity").doc(deterministicEventKey).set(activityPayload);
    if (!auditEventSnapshot.exists) await db.collection("auditLogs").doc(deterministicEventKey).set(auditPayload);
  } else {
    await db.collection("deals").doc(input.dealId).collection("activity").add(activityPayload);
    await db.collection("auditLogs").add(auditPayload);
  }
  await recordProcurementTransitionAudit({
    actor: input.actor,
    workspaceId: asString(deal.workspaceId),
    dealId: input.dealId,
    action: "transition_granted",
    priorState: currentDealStateLabel(deal),
    requestedState: target,
    resultingState: target,
    reason: input.action,
    evidenceReferences: submissionEvidence?.evidenceReferences ?? {},
  });
  const nextView = await getOpportunityExecutionView(input.dealId, input.actor);
  return { ...nextView, redirectTo: input.action === "assign_contractor" ? "/dashboard/deals/" + input.dealId + "/execution" : input.action === "prepare_documents" ? "/dashboard/deals/" + input.dealId + "/document-preparation" : input.action === "reopen_requirements_review" ? "/dashboard/deals/" + input.dealId + "/execution" : undefined };
}
