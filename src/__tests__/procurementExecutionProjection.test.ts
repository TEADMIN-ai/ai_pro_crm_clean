import { buildOpportunityExecutionState } from "@/lib/opportunities/opportunityExecution";
import { buildProcurementExecutionProjection, tenderPackGenerationBlockers } from "@/lib/opportunities/procurementExecutionProjection";
import type { SarsTcsVerificationRecord } from "@/lib/sars-tcs";

function createCompliantSarsTcsSummary(overrides: Partial<SarsTcsVerificationRecord> = {}): SarsTcsVerificationRecord {
  return {
    id: "sars-tcs-current",
    workspaceId: "workspace-test",
    contractorId: "torque-empire",
    opportunityId: "test-procurement-1",
    taxReferenceNumber: "9876543210",
    registeredTaxpayerName: "Torque Empire (Pty) Ltd",
    registrationNumber: "2024/105084/07",
    pinLastFour: "D4E5",
    pinStatus: "ACTIVE",
    pinProvidedAt: "2026-07-01T08:00:00.000Z",
    pinProvidedBy: "contractor-uid",
    consentConfirmed: true,
    consentConfirmedAt: "2026-07-01T08:00:00.000Z",
    verificationStatus: "VERIFIED_COMPLIANT",
    source: "SARS_SOQS",
    verifiedAt: "2026-07-10T08:00:00.000Z",
    verifiedByUid: "staff-uid",
    verifiedByName: "Staff User",
    verificationReference: "SOQS-TEST-1",
    resultCapturedAt: "2026-07-10T08:05:00.000Z",
    recheckDueAt: "2026-12-31T00:00:00.000Z",
    notes: "Verified manually through SARS SOQS",
    taxpayerNameMatch: "MATCH",
    taxReferenceMatch: "MATCH",
    registrationNumberMatch: "MATCH",
    contractorIdentityMatch: "MATCH",
    mismatchReasons: [],
    verificationEvidenceHash: "sha256:test-evidence",
    createdAt: "2026-07-01T08:00:00.000Z",
    updatedAt: "2026-07-10T08:05:00.000Z",
    createdBy: "contractor-uid",
    supersededBy: null,
    version: 1,
    auditTrail: [],
    ...overrides,
  };
}

const contractor = {
  id: "torque-empire",
  contractorId: "torque-empire",
  companyName: "Torque Empire (Pty) Ltd",
  workspaceId: "workspace-test",
  readinessScore: 100,
  taxValid: true,
  bbbeeValid: true,
  coidaValid: true,
  csdValid: true,
  cidbValid: true,
  bankingValid: true,
  SBDforms: true,
};

const baseDeal = {
  id: "test-procurement-1",
  opportunityId: "test-procurement-1",
  title: "Controlled TEST RFQ",
  workspaceId: "workspace-test",
  rfqNumber: "TEST-RFQ-1",
  clientName: "Test Municipality",
  closingDate: "2026-08-01T10:00:00.000Z",
  contractorId: "torque-empire",
  contractorName: "Torque Empire (Pty) Ltd",
  contractorAssignment: {
    contractorId: "torque-empire",
    contractorName: "Torque Empire (Pty) Ltd",
    assignedAt: "2026-07-17T08:00:00.000Z",
    assignedBy: "sarah",
    assignedByEmail: "sarah@example.com",
    assignmentStatus: "assigned",
    workspaceId: "workspace-test",
    executionWorkspaceId: "exec-test-procurement-1",
  },
  documents: [{ id: "rfq", documentType: "rfq", name: "Controlled RFQ.pdf" }, { id: "sbd1", returnableCategory: "SBD_FORMS", returnableSubtype: "SBD1", status: "approved", name: "SBD1.pdf" }, { id: "sbd4", returnableCategory: "SBD_FORMS", returnableSubtype: "SBD4", status: "approved", name: "SBD4.pdf" }],
  opportunityExecution: {
    requirementsReviewed: true,
    complianceReviewed: true,
    pricingComplete: true,
    documentsPrepared: true,
    internalReviewApproved: true,
    internalReviewApprovalProvenance: { action: "complete_internal_review", status: "APPROVED", completedAt: "2026-08-18T20:00:00.000Z", completedBy: "manager-1" },
    contractorApprovalComplete: true,
    contractorApprovalProvenance: { action: "contractor_approval", status: "APPROVED", completedAt: "2026-08-18T20:01:00.000Z", completedBy: "manager-1" }, submissionReviewApprovalProvenance: { action: "complete_submission_review", status: "APPROVED", completedAt: "2026-08-18T20:02:00.000Z", completedBy: "manager-1" },
    tenderPackGenerated: true,
    tenderPackValidated: true,
    submissionReviewId: "test-procurement-1",
    requirements: {
      reviewed: true,
      taxRequirement: true,
      bbbeeRequirement: true,
      coidaRequirement: true,
      csdRequirement: true,
      bankingRequirement: true,
      boqPricingSchedulePresent: true,
      signatureRequired: true,
      compulsoryReturnables: ["Tax compliance", "B-BBEE", "COIDA", "CSD", "SBD forms"],
      formsRequiringCompletion: ["SBD 1", "SBD 4"],
    },
  },
  tenderIntelligence: {
    id: "ti-test-1",
    analysisStatus: "APPROVED",
    reviewStatus: "APPROVED",
    boqClassification: "EMBEDDED_PRICING_SCHEDULE",
    extractedLineItems: [{ id: "line-1" }, { id: "line-2" }],
  },
  supplierQuotes: [
    { id: "quote-a", supplierId: "supplier-a", approvalStatus: "APPROVED" },
    { id: "quote-b", supplierId: "supplier-b", approvalStatus: "PENDING" },
  ],
  tenderPricing: {
    id: "pricing-test-1",
    pricingStatus: "LOCKED",
    mappingStatus: "APPROVED",
    validationStatus: "VALIDATED",
    pricingApproved: true,
    pricingDocumentId: "priced-doc-1",
    total: 125000,
    grossProfit: 25000,
    grossMarginPercentage: 20,
    blockers: [],
  },
  submissionReview: { id: "test-procurement-1", reviewStatus: "APPROVED" },
  tenderPack: { packStatus: "VALIDATED" },
  submissionAuthority: { clientQuoteReady: true, tenderPackDocumentReady: true, submissionEvidenceReady: true },
  sarsTcsSummary: createCompliantSarsTcsSummary(),
};

function projectionFor(deal: Record<string, unknown>) {
  const state = buildOpportunityExecutionState({ deal, contractor });
  return buildProcurementExecutionProjection({ deal, state, remediationRequests: state.remediationRequests });
}

function withSarsVerificationRequired(overrides: Record<string, unknown> = {}) {
  const overrideExecution = overrides.opportunityExecution as Partial<typeof baseDeal.opportunityExecution> | undefined;
  const overrideRequirements = overrideExecution?.requirements as Partial<typeof baseDeal.opportunityExecution.requirements> | undefined;
  return {
    ...baseDeal,
    ...overrides,
    opportunityExecution: {
      ...baseDeal.opportunityExecution,
      ...overrideExecution,
      requirements: {
        ...baseDeal.opportunityExecution.requirements,
        ...overrideRequirements,
        sarsVerificationRequired: true,
      },
    },
  };
}

describe("canonical procurement execution projection", () => {
  it("reaches ready for submission through the controlled workflow", () => {
    const projection = projectionFor(baseDeal);
    expect(projection.contractorId).toBe("torque-empire");
    expect(projection.approvedSupplierQuoteIds).toEqual(["quote-a"]);
    expect(projection.pricingClassification).toBe("EMBEDDED_PRICING_SCHEDULE");
    expect(projection.totalTenderValue).toBe(125000);
    expect(projection.grossMargin).toBe(20);
    expect(projection.nextAction.key).toBe("READY_FOR_SUBMISSION");
    expect(tenderPackGenerationBlockers(projection)).toEqual([]);
  });

  it("does not treat supplier IDs as contractor IDs", () => {
    const projection = projectionFor({ ...baseDeal, contractorId: "torque-empire", supplierQuotes: [...baseDeal.supplierQuotes] });
    expect(projection.contractorId).toBe("torque-empire");
    expect(projection.supplierQuoteIds).toContain("quote-a");
    expect(projection.approvedSupplierQuoteIds).not.toContain(projection.contractorId);
  });

  it("blocks the workflow until an approved supplier quote exists", () => {
    const projection = projectionFor({ ...baseDeal, supplierQuotes: baseDeal.supplierQuotes.map((quote) => ({ ...quote, approvalStatus: "PENDING" })) });
    expect(projection.nextAction.key).toBe("UPLOAD_OR_APPROVE_SUPPLIER_QUOTE");
    expect(projection.quoteBlockers[0].problem).toBe("No approved supplier quote");
  });

  it("rejects tender pack generation when pricing is unapproved", () => {
    const projection = projectionFor({ ...baseDeal, tenderPricing: { ...baseDeal.tenderPricing, pricingStatus: "REVIEW_REQUIRED", pricingApproved: false, pricingDocumentId: null } });
    expect(tenderPackGenerationBlockers(projection).map((item) => item.problem)).toContain("Pricing is not approved");
  });

  it("is idempotent for repeated quote upload records with the same IDs", () => {
    const first = projectionFor(baseDeal);
    const retry = projectionFor({ ...baseDeal, supplierQuotes: [...baseDeal.supplierQuotes, { ...baseDeal.supplierQuotes[0] }] });
    expect(retry.supplierQuoteIds).toEqual(first.supplierQuoteIds);
    expect(retry.approvedSupplierQuoteIds).toEqual(first.approvedSupplierQuoteIds);
  });
  it("blocks when live SARS verification is required but missing", () => {
    const projection = projectionFor(withSarsVerificationRequired({ sarsTcsSummary: null }));
    expect(projection.nextAction.key).toBe('REQUEST_TCS_PIN');
    expect(projection.sarsVerificationBlockers).toContain("Active SARS TCS PIN is missing");
  });

  it("does not add SARS blockers when required verification is current and compliant", () => {
    const projection = projectionFor(withSarsVerificationRequired());
    expect(projection.sarsVerificationStatus).toBe("VERIFIED_COMPLIANT");
    expect(projection.sarsVerificationBlockers).toEqual([]);
  });

  it("blocks when required SARS verification is stale", () => {
    const projection = projectionFor(withSarsVerificationRequired({ sarsTcsSummary: createCompliantSarsTcsSummary({ recheckDueAt: '2026-07-01T00:00:00.000Z' }) }));
    expect(projection.nextAction.key).toBe('REVERIFY_TCS');
    expect(projection.sarsVerificationBlockers).toContain("SARS TCS verification is stale and must be rechecked");
  });

  it("blocks when required SARS identity details mismatch", () => {
    const projection = projectionFor(withSarsVerificationRequired({ sarsTcsSummary: createCompliantSarsTcsSummary({ contractorIdentityMatch: 'MISMATCH', taxpayerNameMatch: 'MISMATCH', mismatchReasons: ['Taxpayer name mismatch'] }) }));
    expect(projection.nextAction.key).toBe('RESOLVE_TAX_IDENTITY_MISMATCH');
    expect(projection.sarsVerificationBlockers).toContain("SARS taxpayer details do not match contractor identity");
  });

  it("does not block downstream workflow when SARS verification is not required", () => {
    const projection = projectionFor({ ...baseDeal, sarsTcsSummary: null, opportunityExecution: { ...baseDeal.opportunityExecution, requirements: { ...baseDeal.opportunityExecution.requirements, taxRequirement: false, compulsoryReturnables: ["B-BBEE", "COIDA", "CSD", "SBD forms"] } } });
    expect(projection.nextAction.key).toBe("READY_FOR_SUBMISSION");
    expect(projection.sarsVerificationBlockers).toEqual([]);
  });

  it("uses the canonical default when taxRequirement is undefined", () => {
    const projection = projectionFor({ ...baseDeal, sarsTcsSummary: null, opportunityExecution: { ...baseDeal.opportunityExecution, requirements: { reviewed: true, bbbeeRequirement: true, coidaRequirement: true, csdRequirement: true, bankingRequirement: true, boqPricingSchedulePresent: true, signatureRequired: true, compulsoryReturnables: ["B-BBEE", "COIDA", "CSD", "SBD forms"], formsRequiringCompletion: ["SBD 1", "SBD 4"] } } });
    expect(projection.nextAction.key).toBe("READY_FOR_SUBMISSION");
    expect(projection.sarsVerificationBlockers).toEqual([]);
  });

  it("does not make taxRequirement imply live SARS verification", () => {
    const projection = projectionFor({ ...baseDeal, sarsTcsSummary: null, opportunityExecution: { ...baseDeal.opportunityExecution, requirements: { ...baseDeal.opportunityExecution.requirements, sarsVerificationRequired: false } } });
    expect(projection.sarsVerificationRequired).toBe(false);
    expect(projection.nextAction.key).toBe("READY_FOR_SUBMISSION");
    expect(projection.sarsVerificationBlockers).toEqual([]);
  });

  it("defaults undefined sarsVerificationRequired to false when taxRequirement is true", () => {
    const projection = projectionFor({ ...baseDeal, sarsTcsSummary: null });
    expect(projection.sarsVerificationRequired).toBe(false);
    expect(projection.nextAction.key).toBe("READY_FOR_SUBMISSION");
    expect(projection.sarsVerificationBlockers).toEqual([]);
  });

  it("blocks live SARS verification when required even if ordinary tax compliance is not required", () => {
    const projection = projectionFor(withSarsVerificationRequired({ sarsTcsSummary: null, opportunityExecution: { ...baseDeal.opportunityExecution, requirements: { ...baseDeal.opportunityExecution.requirements, taxRequirement: false, compulsoryReturnables: ["B-BBEE", "COIDA", "CSD", "SBD forms"] } } }));
    expect(projection.nextAction.key).toBe("REQUEST_TCS_PIN");
    expect(projection.sarsVerificationBlockers).toContain("Active SARS TCS PIN is missing");
  });

  it("preserves hard adverse SARS identity mismatch when live verification is optional", () => {
    const projection = projectionFor({ ...baseDeal, sarsTcsSummary: createCompliantSarsTcsSummary({ contractorIdentityMatch: "MISMATCH", taxpayerNameMatch: "MISMATCH", mismatchReasons: ["Taxpayer name mismatch"] }) });
    expect(projection.sarsVerificationRequired).toBe(false);
    expect(projection.nextAction.key).toBe("RESOLVE_TAX_IDENTITY_MISMATCH");
    expect(projection.sarsVerificationBlockers).toContain("SARS taxpayer details do not match contractor identity");
  });

  it("keeps the compliant SARS fixture free of plaintext PINs", () => {
    const serialized = JSON.stringify(createCompliantSarsTcsSummary());
    expect(serialized).not.toContain("A1B2C3D4E5");
    expect(serialized).not.toContain("encryptedTcsPin");
    expect(serialized).not.toContain("protectedSecretRef");
  });

  it("does not invent freshness or logic version values", () => {
    const projection = projectionFor(baseDeal);
    expect(projection.evaluatedAt).toBeNull();
    expect(projection.logicVersion).toBeNull();
    expect(projection.stale).toBeNull();
  });

  it("empty required document evidence does not create ready projection state", () => {
    const state = buildOpportunityExecutionState({ deal: baseDeal, contractor });
    const projection = buildProcurementExecutionProjection({
      deal: baseDeal,
      state: { ...state, documentChecklist: [] },
      remediationRequests: state.remediationRequests,
    });

    expect(projection.readinessStatus).not.toBe("READY");
    expect(projection.readinessScore).toBeNull();
    expect(projection.submissionReadiness).toBeNull();
  });

  it("score of 100 with a blocking reason remains blocked", () => {
    const state = buildOpportunityExecutionState({ deal: baseDeal, contractor });
    const projection = buildProcurementExecutionProjection({
      deal: baseDeal,
      state: { ...state, submissionReadiness: 100, blockers: ["Compliance evidence unavailable"] },
      remediationRequests: state.remediationRequests,
    });

    expect(projection.readinessStatus).toBe("BLOCKED");
    expect(projection.readinessScore).toBeNull();
    expect(projection.assignmentAllowed).toBe(false);
    expect(projection.blockingReasons).toContain("Compliance evidence unavailable");
  });

  it("valid canonical projection exposes assignment authority", () => {
    const projection = projectionFor(baseDeal);
    expect(projection.decisionStatus).toBe("ALLOWED");
    expect(projection.readinessStatus).toBe("READY");
    expect(projection.readinessScore).toBe(100);
    expect(projection.assignmentAllowed).toBe(true);
    expect(projection.eligible).toBe(true);
  });

  it("clears stale pricing blockers from locked canonical pricing", () => {
    const projection = projectionFor({ ...baseDeal, opportunityExecution: { ...baseDeal.opportunityExecution, pricingStatus: "REVIEW_REQUIRED", pricingApproved: false, lineItemCoverage: 50, approvedSupplierQuoteIds: [] }, tenderPricing: { ...baseDeal.tenderPricing, pricingStatus: "LOCKED", lockStatus: "LOCKED", validationStatus: "VALIDATED", approvedSupplierQuoteIds: ["quote-a"], lineItems: [{ mapping: { supplierQuoteId: "quote-a" } }], blockers: [], pricingDocumentId: "priced-doc", revision: 1, managementApprovalStatus: "MANAGER_APPROVED", approvals: [{ revision: 1, role: "staff", approvedBy: "staff", approvedAt: "now" }, { revision: 1, role: "manager", approvedBy: "manager", approvedAt: "now" }], submissionReviewHandoff: { pricingApproved: true, workflowTransition: "DOCUMENT_PREPARATION" } } });
    expect(projection.quoteCoverage).toBe(100);
    expect(projection.quoteBlockers).toEqual([]);
    expect(projection.pricingBlockers).toEqual([]);
    expect(projection.pricingStatus).toBe("LOCKED");
  });
  it("requires explicit Submission Review completion before submission", () => {
    const pending = projectionFor({ ...baseDeal, opportunityExecution: { ...baseDeal.opportunityExecution, submissionReviewApprovalProvenance: null } });
    expect(pending.nextAction.key).toBe("COMPLETE_SUBMISSION_REVIEW");
    expect(pending.submissionStatus).not.toBe("complete");
    const approved = projectionFor(baseDeal);
    expect(approved.nextAction.key).toBe("READY_FOR_SUBMISSION");
  });

  it("requires reviewed durable submission evidence before the final action", () => {
    const projection = projectionFor({ ...baseDeal, submissionAuthority: { clientQuoteReady: true, tenderPackDocumentReady: true, submissionEvidenceReady: false } });
    expect(projection.nextAction.key).toBe("ADD_SUBMISSION_EVIDENCE");
    expect(projection.readinessStatus).not.toBe("READY");
  });


});

test("approved pricing flags without canonical clientQuotes remain insufficient", () => {
  const projection = projectionFor({ ...baseDeal, submissionAuthority: { clientQuoteReady: false, tenderPackDocumentReady: true, submissionEvidenceReady: true } });
  expect(projection.nextAction.key).toBe("APPROVE_PRICING");
  expect(projection.nextAction.blocker).toBe("Approved Client Quote must be generated.");
  expect(projection.readinessStatus).toBe("BLOCKED");
  expect(projection.blockers.map((item) => item.problem)).toContain("Approved Client Quote must be generated");
});

test("Tender Pack flags without durable authority remain insufficient", () => {
  const projection = projectionFor({ ...baseDeal, submissionAuthority: { clientQuoteReady: true, tenderPackDocumentReady: false, submissionEvidenceReady: true } });
  expect(projection.nextAction.key).toBe("GENERATE_TENDER_PACK");
  expect(projection.nextAction.blocker).toBe("Durable Tender Pack must be generated.");
  expect(projection.readinessStatus).toBe("BLOCKED");
  expect(projection.blockers.map((item) => item.problem)).toContain("Durable Tender Pack must be generated");
});

test("legacy ready-for-submission state projects durable artifact repair blockers", () => {
  const projection = projectionFor({
    ...baseDeal,
    opportunityExecution: { ...baseDeal.opportunityExecution, currentPhase: "READY_FOR_SUBMISSION" },
    submissionAuthority: { clientQuoteReady: false, tenderPackDocumentReady: false, submissionEvidenceReady: false },
  });
  expect(projection.currentPhase).toBe("READY_FOR_SUBMISSION");
  expect(projection.readinessStatus).toBe("BLOCKED");
  expect(projection.nextAction.key).toBe("APPROVE_PRICING");
  expect(projection.blockers.map((item) => item.problem)).toEqual(expect.arrayContaining([
    "Approved Client Quote must be generated",
    "Durable Tender Pack must be generated",
  ]));
});
