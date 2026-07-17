import { buildOpportunityExecutionState } from "@/lib/opportunities/opportunityExecution";
import { buildProcurementExecutionProjection, tenderPackGenerationBlockers } from "@/lib/opportunities/procurementExecutionProjection";

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
  documents: [{ id: "rfq", documentType: "rfq", name: "Controlled RFQ with embedded pricing schedule.pdf" }],
  opportunityExecution: {
    requirementsReviewed: true,
    complianceReviewed: true,
    documentsPrepared: true,
    internalReviewApproved: true,
    contractorApprovalComplete: true,
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
};

function projectionFor(deal: typeof baseDeal) {
  const state = buildOpportunityExecutionState({ deal, contractor });
  return buildProcurementExecutionProjection({ deal, state, remediationRequests: state.remediationRequests });
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
});
