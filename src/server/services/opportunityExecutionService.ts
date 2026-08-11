import { Timestamp } from "firebase-admin/firestore";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import type { AuthorizedUser } from "@/lib/server/authz";
import { listContractors } from "@/server/services/contractorService";
import { getContractorBusinessName, resolveContractorReference } from "@/lib/contractors/contractorReferenceResolver";
import { buildOpportunityExecutionState, extractOpportunityRequirements, matchContractorsForOpportunity, validateOpportunityTransition, type ContractorMatchResult, type OpportunityExecutionPhase, type OpportunityRequirementReview } from "@/lib/opportunities/opportunityExecution";
import { buildProcurementExecutionProjection } from "@/lib/opportunities/procurementExecutionProjection";
import { getDealContractorReference } from "@/lib/deals/contractorReference";
import { assertAssignmentAllowed, evaluateContractorAssignmentAuthority } from "@/server/services/contractorAssignmentAuthorityService";
import { currentDealStateLabel, normalizeSubmissionEvidence, recordProcurementTransitionAudit } from "@/lib/procurement/procurementStateAuthority";

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
  const snapshot = await getFirebaseAdmin().collection("deals").doc(dealId).get();
  if (!snapshot.exists) throw Object.assign(new Error("Opportunity not found"), { status: 404 });
  return { id: snapshot.id, ...(snapshot.data() ?? {}) } as Record<string, unknown> & { id: string };
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
  const state = buildOpportunityExecutionState({ deal, contractor: contractor as Record<string, unknown> | null });
  const projection = buildProcurementExecutionProjection({ deal: { ...deal, sarsTcsSummary: contractor ? (contractor as Record<string, unknown>).sarsTcsSummary : null }, state, remediationRequests: state.remediationRequests });
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
  if (action === "review_requirements") return "MATCHING_REQUIRED";
  if (action === "find_matching_contractors") return "MATCHING_REQUIRED";
  if (action === "assign_contractor") return "COMPLIANCE_REVIEW";
  if (action === "start_compliance_review") return "COMPLIANCE_REVIEW";
  if (action === "open_boq_pricing") return "BOQ_PRICING";
  if (action === "prepare_documents") return "INTERNAL_REVIEW";
  if (action === "start_internal_review") return "CONTRACTOR_APPROVAL";
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
  const currentView = await getOpportunityExecutionView(input.dealId, input.actor);
  const current = currentView.state.currentPhase;
  const target = targetPhaseForAction(input.action, deal);
  if (!target) throw Object.assign(new Error("Unknown opportunity action"), { status: 400 });
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
  let submissionEvidence: ReturnType<typeof normalizeSubmissionEvidence> | null = null;
  if (input.action === "record_submission") {
    submissionEvidence = normalizeSubmissionEvidence(input.submission);
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
  const now = new Date();
  const patch: Record<string, unknown> = { updatedAt: now, workflowStatus: target };
  const existingExecution = asRecord(deal.opportunityExecution);
  const requirements = { ...extractOpportunityRequirements(deal), ...(input.requirements ?? {}) };
  const execution: Record<string, unknown> = { ...existingExecution, currentPhase: target, executionWorkspaceId: existingExecution.executionWorkspaceId ?? `exec-${input.dealId}`, updatedAt: now.toISOString() };
  if (input.action === "review_requirements") { execution.requirementsReviewed = true; requirements.reviewed = true; requirements.reviewedAt = now.toISOString(); requirements.reviewedByUid = input.actor.uid; execution.requirements = requirements; }
  if (input.action === "find_matching_contractors") execution.matchingCompleted = true;
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
  if (input.action === "prepare_documents") execution.documentsPrepared = true;
  if (input.action === "start_internal_review") execution.internalReviewApproved = true;
  if (input.action === "contractor_approval") execution.contractorApprovalComplete = true;
  if (input.action === "generate_tender_pack") { execution.tenderPackGenerated = true; execution.tenderPackValidated = true; }
  if (input.action === "mark_ready_for_submission") execution.readyForSubmission = true;
  if (input.action === "record_submission") { execution.submitted = true; execution.submission = { ...(input.submission ?? {}), evidenceReferences: submissionEvidence?.evidenceReferences ?? {} }; patch.status = "submitted"; patch.stage = "submitted"; patch.tenderSubmittedAt = now; patch.tenderSubmittedBy = input.actor.uid; }
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
    action: input.action === "assign_contractor" ? "OPPORTUNITY_CONTRACTOR_ASSIGNED" : "OPPORTUNITY_EXECUTION_UPDATED",
    entityType: "deal",
    entityId: input.dealId,
    metadata: { action: input.action, phase: target, eventKey: deterministicEventKey },
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
  return { ...nextView, redirectTo: input.action === "assign_contractor" ? `/dashboard/deals/${input.dealId}/execution` : undefined };
}
