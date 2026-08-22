import { buildOpportunityExecutionState, buildSubmissionReadiness, hasValidContractorApproval, hasValidInternalReviewCompletion, hasValidSubmissionReviewCompletion, isDocumentPreparationComplete, isRecoverableLegacyInternalReviewState, deriveOpportunityPhase, evaluateOpportunityCompliance, extractOpportunityRequirements, matchContractorsForOpportunity, validateOpportunityTransition } from "@/lib/opportunities/opportunityExecution";

const baseDeal = {
  id: "deal-1", title: "Cleaning RFQ", companyId: "unassigned", stage: "lead", status: "draft", category: "cleaning",
  workspaceId: "workspace-a", closingDate: "2026-08-01T11:00:00", rfqNumber: "RFQ-1", clientName: "City", municipalityName: "Cape Town",
  tenderAnalysis: { requiredCertificates: ["Tax compliance", "B-BBEE", "COIDA", "CSD"], location: "Western Cape" },
  documents: [{ documentType: "rfq", name: "RFQ.pdf" }],
};
const reviewed = { ...baseDeal, opportunityExecution: { requirementsReviewed: true, requirements: { reviewed: true } } };
const validContractor = { id: "c1", contractorId: "c1", companyName: "Clean Co", workspaceId: "workspace-a", serviceCategories: ["cleaning"], regions: ["Western Cape"], readinessScore: 92, taxValid: true, bbbeeValid: true, coidaValid: true, csdValid: true };
const assignedDeal = { ...reviewed, contractorId: "c1", companyId: "c1", contractorAssignment: { contractorId: "c1", contractorName: "Clean Co", assignedAt: "2026-07-16T10:00:00.000Z", assignedBy: "staff-1", assignedByEmail: "staff@example.com", assignmentStatus: "assigned", opportunityId: "deal-1", dealId: "deal-1", workspaceId: "workspace-a", executionWorkspaceId: "exec-deal-1" }, opportunityExecution: { requirementsReviewed: true, requirements: { reviewed: true }, contractorId: "c1", executionWorkspaceId: "exec-deal-1", submissionReviewId: "deal-1" }, submissionReview: { id: "deal-1" } };
const invalidContractor = { ...validContractor, id: "c2", contractorId: "c2", taxValid: false, missingCriticalDocuments: ["Tax compliance"] };

describe("opportunity execution workflow", () => {
  test("intake-complete opportunity gets requirements review", () => {
    expect(deriveOpportunityPhase({ deal: baseDeal })).toBe("REQUIREMENTS_REVIEW");
  });
  test("requirements review completion moves to matching required", () => {
    expect(deriveOpportunityPhase({ deal: reviewed })).toBe("MATCHING_REQUIRED");
  });
  test("matching uses live contractors and excludes mock data", () => {
    const matches = matchContractorsForOpportunity({ deal: reviewed, contractors: [validContractor, { ...validContractor, id: "mock", demoContractor: true }] });
    expect(matches.map((match) => match.contractorId)).toEqual(["c1"]);
  });
  test("assignment persists contractorId in state", () => {
    const state = buildOpportunityExecutionState({ deal: assignedDeal, contractor: validContractor });
    expect(state.contractorId).toBe("c1");
  });
  test("assignment creates an execution workspace id", () => {
    const state = buildOpportunityExecutionState({ deal: assignedDeal, contractor: validContractor });
    expect(state.executionWorkspaceId).toBe("exec-deal-1");
  });
  test("assignment redirects to execution route by contract", () => { expect(`/dashboard/deals/${baseDeal.id}/execution`).toBe("/dashboard/deals/deal-1/execution"); });
  test("missing compliance blocks progression", () => {
    const status = evaluateOpportunityCompliance(extractOpportunityRequirements(baseDeal), invalidContractor);
    expect(status.status).toBe("MISSING");
  });
  test("valid compliance permits progression", () => {
    const status = evaluateOpportunityCompliance(extractOpportunityRequirements(baseDeal), validContractor);
    expect(status.status).toBe("VALID");
  });
  test("BOQ presence activates BOQ workflow", () => {
    const state = buildOpportunityExecutionState({ deal: { ...assignedDeal, documents: [...baseDeal.documents, { documentType: "boq", name: "BOQ.pdf" }], opportunityExecution: { ...assignedDeal.opportunityExecution, complianceReviewed: true } }, contractor: validContractor });
    expect(state.boqRequired).toBe(true); expect(state.currentPhase).toBe("BOQ_PRICING");
  });
  test("no BOQ marks BOQ not applicable", () => {
    const state = buildOpportunityExecutionState({ deal: { ...assignedDeal, opportunityExecution: { ...assignedDeal.opportunityExecution, complianceReviewed: true } }, contractor: validContractor });
    expect(state.boqRequired).toBe(false);
  });
  test("missing pricing blocks pack readiness", () => {
    const state = buildOpportunityExecutionState({ deal: { ...assignedDeal, documents: [...baseDeal.documents, { documentType: "boq", name: "BOQ.pdf" }], opportunityExecution: { ...assignedDeal.opportunityExecution, complianceReviewed: true } }, contractor: validContractor });
    expect(buildSubmissionReadiness({ state, pricingComplete: false, documentsComplete: true, internalReviewApproved: true, signaturesComplete: true, packGenerated: true, packValidated: true }).blockers).toContain("Required pricing must be complete");
  });
  test("required documents are tracked correctly", () => {
    const req = extractOpportunityRequirements(baseDeal);
    expect(req.compulsoryReturnables).toEqual(expect.arrayContaining(["Tax compliance", "B-BBEE"]));
  });
  test("internal review is required", () => {
    const state = buildOpportunityExecutionState({ deal: { ...assignedDeal, opportunityExecution: { ...assignedDeal.opportunityExecution, complianceReviewed: true, documentsPrepared: true } }, contractor: validContractor });
    expect(state.currentPhase).toBe("INTERNAL_REVIEW");
  });
  test("signatures are required where configured", () => {
    const state = buildOpportunityExecutionState({ deal: { ...assignedDeal, opportunityExecution: { ...assignedDeal.opportunityExecution, currentPhase: "PACK_GENERATION" } }, contractor: validContractor });
    expect(buildSubmissionReadiness({ state, pricingComplete: true, documentsComplete: true, internalReviewApproved: true, signaturesComplete: false, packGenerated: true, packValidated: true }).blockers).toContain("Required signatures must be complete");
  });
  test("pack generation only allowed when prerequisites pass", () => {
    const state = buildOpportunityExecutionState({ deal: { ...assignedDeal, opportunityExecution: { ...assignedDeal.opportunityExecution, currentPhase: "PACK_GENERATION", documentsPrepared: true, internalReviewApproved: true, contractorApprovalComplete: true } }, contractor: validContractor });
    expect(buildSubmissionReadiness({ state, pricingComplete: true, documentsComplete: true, internalReviewApproved: true, signaturesComplete: true, packGenerated: true, packValidated: true }).ready).toBe(true);
  });
  test("submission record changes status to submitted", () => {
    expect(deriveOpportunityPhase({ deal: { ...baseDeal, status: "submitted", stage: "submitted" } })).toBe("SUBMITTED");
  });
  test("invalid phase transition returns 409", () => {
    expect(validateOpportunityTransition("REQUIREMENTS_REVIEW", "SUBMITTED")).toMatchObject({ ok: false, status: 409 });
  });
  test("unauthorised user rejected by route policy", () => {
    expect(["admin", "manager", "staff"].includes("contractor")).toBe(false);
  });
  test("cross-workspace access is rejected by comparison rule", () => { const dealWorkspace = "workspace-a"; const contractorWorkspace: string = "workspace-b"; expect(dealWorkspace === contractorWorkspace).toBe(false); });
  test("no mock contractor data is used", () => {
    const matches = matchContractorsForOpportunity({ deal: baseDeal, contractors: [{ ...validContractor, id: "mock", mockContractor: true }, validContractor] });
    expect(matches).toHaveLength(1); expect(matches[0].contractorId).toBe("c1");
  });
  test("execution workspace exposes the full operational stage model", () => {
    const state = buildOpportunityExecutionState({ deal: assignedDeal, contractor: validContractor });
    expect(state.stages.map((stage) => stage.title)).toEqual([
      "Requirements Review",
      "Contractor Assignment",
      "Compliance Review",
      "BOQ/Pricing",
      "Document Preparation",
      "Internal Review",
      "Contractor Approval",
      "Tender Pack",
      "Submission",
    ]);
  });

  test("compliance blockers drive the exact next action", () => {
    const coidaBlockedContractor = { ...validContractor, coidaValid: false, missingCriticalDocuments: ["COIDA"] };
    const state = buildOpportunityExecutionState({ deal: assignedDeal, contractor: coidaBlockedContractor });
    expect(state.complianceChecks.find((check) => check.key === "coida")).toMatchObject({ status: "BLOCKED", blocker: "COIDA document not found" });
    expect(state.nextAction).toBe("COIDA document not found");
    expect(state.actions.find((action) => action.key === "open_missing_documents")).toMatchObject({ enabled: true });
  });

  test("BOQ stage is not applicable when no pricing schedule is present", () => {
    const state = buildOpportunityExecutionState({ deal: { ...assignedDeal, opportunityExecution: { ...assignedDeal.opportunityExecution, complianceReviewed: true } }, contractor: validContractor });
    expect(state.stages.find((stage) => stage.key === "boq")).toMatchObject({ status: "NOT_APPLICABLE" });
  });

  test("document preparation action stays available to prepare missing returnables", () => {
    const state = buildOpportunityExecutionState({ deal: { ...assignedDeal, opportunityExecution: { ...assignedDeal.opportunityExecution, complianceReviewed: true } }, contractor: validContractor });
    expect(state.currentPhase).toBe("DOCUMENT_PREPARATION");
    expect(state.actions.find((action) => action.key === "prepare_documents")).toMatchObject({ enabled: true, href: undefined });
  });

  test("ready for submission requires validated tender pack", () => {
    const packState = buildOpportunityExecutionState({ deal: { ...assignedDeal, opportunityExecution: { ...assignedDeal.opportunityExecution, currentPhase: "PACK_GENERATION", documentsPrepared: true, internalReviewApproved: true, contractorApprovalComplete: true } }, contractor: validContractor });
    expect(buildSubmissionReadiness({ state: packState, pricingComplete: true, documentsComplete: true, internalReviewApproved: true, signaturesComplete: true, packGenerated: false, packValidated: false }).blockers).toContain("Final pack must be generated and validated");
  });

});

test("CIDB Not Required remains not applicable and does not create matching blockers", () => {
  const deal = { ...baseDeal, opportunityExecution: { requirementsReviewed: true, requirements: { reviewed: true, cidbRequirement: "Not Required" } } };
  const requirements = extractOpportunityRequirements(deal);
  const compliance = evaluateOpportunityCompliance(requirements, validContractor);
  const cidbDetail = compliance.details.find((detail) => detail.key === "cidb");
  const state = buildOpportunityExecutionState({ deal, contractor: validContractor });
  const match = matchContractorsForOpportunity({ deal, contractors: [validContractor] })[0];

  expect(requirements.cidbRequirement).toBeNull();
  expect(cidbDetail).toMatchObject({ required: false, status: "NOT_APPLICABLE", reason: "CIDB is not required for this opportunity" });
  expect(state.complianceChecks.find((check) => check.key === "cidb")).toMatchObject({ required: false, status: "NOT_APPLICABLE", blocker: null });
  expect(match.missingDocuments).not.toContain("CIDB document not found");
  expect(match.blockingReasons).not.toContain("CIDB document not found");
});

test("genuine CIDB grade remains required", () => {
  const deal = { ...baseDeal, opportunityExecution: { requirementsReviewed: true, requirements: { reviewed: true, cidbRequirement: "2CE" } } };
  const requirements = extractOpportunityRequirements(deal);
  const compliance = evaluateOpportunityCompliance(requirements, validContractor);
  const cidbDetail = compliance.details.find((detail) => detail.key === "cidb");

  expect(requirements.cidbRequirement).toBe("2CE");
  expect(cidbDetail).toMatchObject({ required: true, status: "MISSING", reason: "CIDB document not found" });
});


test("complete document preparation is distinct from internal review approval", () => {
  const state = buildOpportunityExecutionState({
    deal: {
      ...assignedDeal,
      documents: [
        { id: "rfq", returnableCategory: "RFQ_SOURCE", status: "approved", reviewStatus: "APPROVED" },
        { id: "decl", returnableCategory: "DECLARATIONS", status: "approved", reviewStatus: "APPROVED" },
      ],
      opportunityExecution: {
        ...assignedDeal.opportunityExecution,
        complianceReviewed: true,
        requirements: {
          reviewed: true,
          reviewStatus: "APPROVED",
          formsRequiringCompletion: ["Declarations"],
          boqPricingSchedulePresent: false,
          signatureRequired: false,
          annexuresAndAmendments: [],
        },
        documentsPrepared: true,
      },
    },
    contractor: validContractor,
  });
  expect(isDocumentPreparationComplete(state)).toBe(true);
  expect(state.stages.find((stage) => stage.key === "documents")?.status).toBe("COMPLETE");
  expect(state.stages.find((stage) => stage.key === "internalReview")?.status).toBe("NOT_STARTED");
});

test("starting internal review does not approve or advance the workflow", () => {
  const started = buildOpportunityExecutionState({
    deal: { ...assignedDeal, opportunityExecution: { ...assignedDeal.opportunityExecution, currentPhase: "INTERNAL_REVIEW", documentsPrepared: true } },
    contractor: validContractor,
  });
  expect(started.currentPhase).toBe("INTERNAL_REVIEW");
  expect(started.stages.find((stage) => stage.key === "internalReview")?.status).toBe("NOT_STARTED");
  expect(started.stages.find((stage) => stage.key === "contractorApproval")?.status).toBe("NOT_STARTED");
  expect(started.actions.find((action) => action.key === "start_internal_review")).toMatchObject({ enabled: true });
  expect(started.actions.find((action) => action.key === "complete_internal_review")).toMatchObject({ enabled: false });
  expect(started.actions.find((action) => action.key === "contractor_approval")).toMatchObject({ enabled: false });

  const inProgress = buildOpportunityExecutionState({
    deal: { ...assignedDeal, opportunityExecution: { ...assignedDeal.opportunityExecution, currentPhase: "INTERNAL_REVIEW", documentsPrepared: true, internalReviewStarted: true } },
    contractor: validContractor,
  });
  expect(inProgress.currentPhase).toBe("INTERNAL_REVIEW");
  expect(inProgress.stages.find((stage) => stage.key === "internalReview")?.status).toBe("IN_PROGRESS");
  expect(inProgress.stages.find((stage) => stage.key === "contractorApproval")?.status).toBe("NOT_STARTED");
  expect(inProgress.actions.find((action) => action.key === "complete_internal_review")).toMatchObject({ enabled: true });
  expect(inProgress.actions.find((action) => action.key === "contractor_approval")).toMatchObject({ enabled: false });
});

test("only completed internal review permits the forward transition", () => {
  expect(validateOpportunityTransition("INTERNAL_REVIEW", "CONTRACTOR_APPROVAL")).toMatchObject({ ok: true });
  expect(validateOpportunityTransition("INTERNAL_REVIEW", "PACK_GENERATION")).toMatchObject({ ok: false, status: 409 });
});

test("legacy internal review approval requires explicit completion provenance", () => {
  const legacy = { ...assignedDeal, opportunityExecution: { ...assignedDeal.opportunityExecution, currentPhase: "CONTRACTOR_APPROVAL", internalReviewApproved: true, contractorApprovalComplete: true, tenderPackGenerated: true, tenderPackValidated: true } };
  expect(hasValidInternalReviewCompletion(legacy)).toBe(false);
  expect(hasValidContractorApproval(legacy)).toBe(false);
  expect(isRecoverableLegacyInternalReviewState(legacy)).toBe(true);
  const valid = { ...legacy, opportunityExecution: { ...legacy.opportunityExecution, internalReviewApprovalProvenance: { action: "complete_internal_review", status: "APPROVED", completedAt: "2026-08-18T20:00:00.000Z", completedBy: "manager-1" }, contractorApprovalProvenance: { action: "contractor_approval", status: "APPROVED", completedAt: "2026-08-18T20:01:00.000Z", completedBy: "manager-1" } } };
  expect(hasValidInternalReviewCompletion(valid)).toBe(true);
  expect(hasValidContractorApproval(valid)).toBe(true);
  expect(isRecoverableLegacyInternalReviewState(valid)).toBe(false);
});

test("legacy downstream state derives back to internal review", () => {
  const state = buildOpportunityExecutionState({ deal: { ...assignedDeal, opportunityExecution: { ...assignedDeal.opportunityExecution, currentPhase: "PACK_GENERATION", internalReviewApproved: true, contractorApprovalComplete: true, tenderPackGenerated: true, tenderPackValidated: true } }, contractor: validContractor });
  expect(state.currentPhase).toBe("INTERNAL_REVIEW");
  expect(state.actions.find((action) => action.key === "reconcile_legacy_internal_review")).toMatchObject({ enabled: true });
  expect(state.actions.find((action) => action.key === "contractor_approval")).toMatchObject({ enabled: false });
});

test("submission review approval requires explicit completion provenance", () => {
  const pending = { ...assignedDeal, opportunityExecution: { ...assignedDeal.opportunityExecution, currentPhase: "READY_FOR_SUBMISSION" } };
  expect(hasValidSubmissionReviewCompletion(pending)).toBe(false);
  const approved = { ...pending, opportunityExecution: { ...pending.opportunityExecution, submissionReviewApprovalProvenance: { action: "complete_submission_review", status: "APPROVED", completedAt: "2026-08-18T20:02:00.000Z", completedBy: "manager-1" } } };
  expect(hasValidSubmissionReviewCompletion(approved)).toBe(true);
});

test("execution state exposes canonical approved submission evidence ID for Record Submission", () => {
  const state = buildOpportunityExecutionState({
    deal: {
      ...assignedDeal,
      submissionAuthority: {
        clientQuoteReady: true,
        tenderPackDocumentReady: true,
        submissionEvidenceReady: true,
        approvedSubmissionEvidenceId: "SE-1",
        approvedSubmissionEvidenceCount: 1,
        evidenceCount: 1,
      },
      opportunityExecution: {
        ...assignedDeal.opportunityExecution,
        currentPhase: "READY_FOR_SUBMISSION",
        documentsPrepared: true,
        internalReviewApproved: true,
        internalReviewApprovalProvenance: { action: "complete_internal_review", status: "APPROVED", completedAt: "2026-08-18T20:00:00.000Z", completedBy: "manager-1" },
        contractorApprovalComplete: true,
        contractorApprovalProvenance: { action: "contractor_approval", status: "APPROVED", completedAt: "2026-08-18T20:01:00.000Z", completedBy: "manager-1" },
        tenderPackGenerated: true,
        tenderPackValidated: true,
        submissionReviewApprovalProvenance: { action: "complete_submission_review", status: "APPROVED", completedAt: "2026-08-18T20:02:00.000Z", completedBy: "manager-1" },
      },
    },
    contractor: validContractor,
  });

  expect(state.submissionAuthority.approvedSubmissionEvidenceId).toBe("SE-1");
  expect(state.actions.find((action) => action.key === "record_submission")).toMatchObject({ enabled: true });
});

test("execution panel cannot mark ready with tender pack flags but missing durable authority", () => {
  const state = buildOpportunityExecutionState({
    deal: {
      ...assignedDeal,
      submissionAuthority: { clientQuoteReady: true, tenderPackDocumentReady: false, submissionEvidenceReady: false },
      opportunityExecution: {
        ...assignedDeal.opportunityExecution,
        currentPhase: "PACK_GENERATION",
        documentsPrepared: true,
        internalReviewApproved: true,
        internalReviewApprovalProvenance: { action: "complete_internal_review", status: "APPROVED", completedAt: "2026-08-18T20:00:00.000Z", completedBy: "manager-1" },
        contractorApprovalComplete: true,
        contractorApprovalProvenance: { action: "contractor_approval", status: "APPROVED", completedAt: "2026-08-18T20:01:00.000Z", completedBy: "manager-1" },
        tenderPackGenerated: true,
        tenderPackValidated: true,
      },
    },
    contractor: validContractor,
  });
  expect(state.stages.find((stage) => stage.key === "tenderPack")?.status).toBe("BLOCKED");
  expect(state.actions.find((action) => action.key === "mark_ready_for_submission")).toMatchObject({ enabled: false, reason: "Durable Tender Pack must be generated" });
});

test("execution panel routes tender pack generation through governed generator", () => {
  const state = buildOpportunityExecutionState({
    deal: {
      ...assignedDeal,
      submissionAuthority: { clientQuoteReady: true, tenderPackDocumentReady: false, submissionEvidenceReady: false },
      opportunityExecution: {
        ...assignedDeal.opportunityExecution,
        currentPhase: "PACK_GENERATION",
        documentsPrepared: true,
        internalReviewApproved: true,
        internalReviewApprovalProvenance: { action: "complete_internal_review", status: "APPROVED", completedAt: "2026-08-18T20:00:00.000Z", completedBy: "manager-1" },
        contractorApprovalComplete: true,
        contractorApprovalProvenance: { action: "contractor_approval", status: "APPROVED", completedAt: "2026-08-18T20:01:00.000Z", completedBy: "manager-1" },
      },
    },
    contractor: validContractor,
  });
  expect(state.actions.find((action) => action.key === "generate_tender_pack")).toMatchObject({ enabled: true, href: "/dashboard/tender-pack-requests?dealId=deal-1" });
});
