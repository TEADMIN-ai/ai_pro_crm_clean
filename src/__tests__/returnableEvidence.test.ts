import { dedupeReturnableEvidence, getReturnableContext } from "@/lib/opportunities/returnableEvidence";
import { buildOpportunityExecutionState, mergeOpportunityDocuments, normalizeSbdSubtype } from "@/lib/opportunities/opportunityExecution";

const deal = {
  id: "deal-1",
  workspaceId: "workspace-a",
  title: "Tender",
  documents: [{ documentType: "rfq", name: "RFQ.pdf" }],
  contractorId: "c1",
  companyId: "c1",
  contractorAssignment: { contractorId: "c1", contractorName: "Clean Co", assignmentStatus: "assigned", workspaceId: "workspace-a", executionWorkspaceId: "exec-deal-1" },
  opportunityExecution: { requirementsReviewed: true, complianceReviewed: true, contractorId: "c1", executionWorkspaceId: "exec-deal-1" },
};
const contractor = { id: "c1", contractorId: "c1", companyName: "Clean Co", workspaceId: "workspace-a", taxValid: true, bbbeeValid: true, coidaValid: true, csdValid: true };
function governedDocument(key: string, category: string, name: string, status: string, reviewStatus: string, subtype?: string) { return { name, returnableKey: key, returnableCategory: category, returnableSubtype: subtype ?? null, status, reviewStatus }; }

describe("governed returnable evidence context", () => {
  test("maps checklist key to explicit SBD context", () => {
    expect(getReturnableContext("sbd_forms")).toMatchObject({ key: "sbd", category: "SBD_FORMS", required: true });
  });

  test("pending SBD evidence remains blocked and review-required", () => {
    const state = buildOpportunityExecutionState({ deal: { ...deal, documents: [...deal.documents, { name: "SBD1.pdf", returnableKey: "sbd", returnableCategory: "SBD_FORMS", status: "pending", reviewStatus: "READY_FOR_REVIEW" }] }, contractor });
    expect(state.documentChecklist.find((item) => item.key === "sbd")).toMatchObject({ status: "BLOCKED", reviewStatus: "READY_FOR_REVIEW" });
  });

  test("only approved evidence completes its own checklist item", () => {
    const state = buildOpportunityExecutionState({ deal: { ...deal, opportunityExecution: { ...deal.opportunityExecution, requirements: { formsRequiringCompletion: ["SBD1"] } }, documents: [...deal.documents, governedDocument("sbd", "SBD_FORMS", "SBD1.pdf", "approved", "APPROVED", "SBD1")] }, contractor });
    expect(state.documentChecklist.find((item) => item.key === "sbd")).toMatchObject({ status: "COMPLETE" });
    expect(state.documentChecklist.find((item) => item.key === "declarations")?.status).toBe("BLOCKED");
  });
});

describe("returnable evidence identity projection", () => {
  test("keeps SBD subtypes distinct while deduplicating canonical/projected copies", () => {
    const records = [
      { id: "doc-1", name: "SBD1.pdf", returnableSubtype: "SBD1", status: "pending", reviewStatus: "READY_FOR_REVIEW" },
      { id: "doc-1", name: "SBD1.pdf", returnableSubtype: "SBD1", status: "pending", reviewStatus: "READY_FOR_REVIEW" },
      { id: "doc-2", name: "SBD4.pdf", returnableSubtype: "SBD4", status: "pending", reviewStatus: "READY_FOR_REVIEW" },
      { id: "doc-3", name: "SBD6_1.pdf", returnableSubtype: "SBD6_1", status: "pending", reviewStatus: "READY_FOR_REVIEW" },
    ];
    expect(dedupeReturnableEvidence(records)).toHaveLength(3);
    expect(dedupeReturnableEvidence(records).map((record) => record.returnableSubtype)).toEqual(["SBD1", "SBD4", "SBD6_1"]);
  });

  test("does not deduplicate distinct documents with the same filename", () => {
    const records = [{ id: "doc-1", name: "SBD.pdf" }, { id: "doc-2", name: "SBD.pdf" }];
    expect(dedupeReturnableEvidence(records)).toHaveLength(2);
  });
});

describe("canonical evidence rebuild", () => {
  test("rebuilds execution state from approved canonical deal documents", () => {
    const canonicalDocuments = [
      governedDocument("sbd", "SBD_FORMS", "SBD1.pdf", "approved", "APPROVED", "SBD1"),
      governedDocument("sbd", "SBD_FORMS", "SBD4.pdf", "approved", "APPROVED", "SBD4"),
      governedDocument("sbd", "SBD_FORMS", "SBD6_1.pdf", "approved", "APPROVED", "SBD6_1"),
      governedDocument("declarations", "DECLARATIONS", "declaration.pdf", "approved", "APPROVED"),
      governedDocument("signatures", "SIGNATURES", "signed.pdf", "approved", "APPROVED"),
      governedDocument("amendments", "AMENDMENTS", "amendment.pdf", "approved", "APPROVED"),
    ].map((document) => ({ ...document, dealId: "deal-1", workspaceId: "workspace-a" }));
    const rebuiltDeal = { ...deal, documents: mergeOpportunityDocuments(deal.documents, canonicalDocuments), opportunityExecution: { ...deal.opportunityExecution, requirements: { formsRequiringCompletion: ["SBD1", "SBD4", "SBD6_1"], signatureRequired: true, annexuresAndAmendments: ["Amendments"] } } };
    const state = buildOpportunityExecutionState({ deal: rebuiltDeal, contractor });
    expect(state.documentChecklist.filter((item) => ["sbd", "declarations", "signatures", "amendments"].includes(item.key)).every((item) => item.status === "COMPLETE")).toBe(true);
  });

  test("category-only approved evidence maps to its governed checklist", () => {
    const state = buildOpportunityExecutionState({ deal: { ...deal, documents: [...deal.documents, { id: "declaration-1", returnableCategory: "DECLARATIONS", status: "approved", reviewStatus: "APPROVED" }] }, contractor });
    expect(state.documentChecklist.find((item) => item.key === "declarations")?.status).toBe("COMPLETE");
  });

  test("cross-deal or cross-workspace evidence does not satisfy the checklist", () => {
    const state = buildOpportunityExecutionState({ deal: { ...deal, documents: [{ id: "other", dealId: "other-deal", workspaceId: "workspace-a", returnableKey: "declarations", returnableCategory: "DECLARATIONS", status: "approved", reviewStatus: "APPROVED" }, { id: "other-workspace", dealId: "deal-1", workspaceId: "other-workspace", returnableKey: "signatures", returnableCategory: "SIGNATURES", status: "approved", reviewStatus: "APPROVED" }] }, contractor });
    expect(state.documentChecklist.find((item) => item.key === "declarations")?.status).toBe("BLOCKED");
    expect(state.documentChecklist.find((item) => item.key === "signatures")?.status).toBe("BLOCKED");
  });
});

describe("category and merge isolation", () => {
  test("BOQ cannot satisfy source and only satisfies pricing", () => {
    const state = buildOpportunityExecutionState({ deal: { ...deal, opportunityExecution: { ...deal.opportunityExecution, requirements: { boqPricingSchedulePresent: true } }, documents: [...deal.documents, { id: "boq", returnableCategory: "PRICING_SCHEDULE", documentType: "boq", name: "TEOS_STAGING_BOQ_TEST-RFQ-001.pdf", status: "approved", reviewStatus: "APPROVED" }] }, contractor });
    expect(state.documentChecklist.find((item) => item.key === "source")?.status).toBe("COMPLETE");
    expect(state.documentChecklist.find((item) => item.key === "pricing")?.status).toBe("COMPLETE");
  });

  test("canonical category takes precedence over conflicting legacy item key", () => {
    const state = buildOpportunityExecutionState({ deal: { ...deal, documents: [...deal.documents, { id: "boq", returnableKey: "source", returnableCategory: "PRICING_SCHEDULE", documentType: "boq", status: "approved", reviewStatus: "APPROVED" }] }, contractor });
    expect(state.documentChecklist.find((item) => item.key === "source")?.source).toBe("rfq RFQ.pdf");
    expect(state.documentChecklist.find((item) => item.key === "pricing")?.status).toBe("COMPLETE");
  });

  test("approved review status is sufficient and all approved SBD subtypes participate", () => {
    const docs = ["SBD1", "SBD4", "SBD6_1"].map((subtype) => ({ returnableCategory: "SBD_FORMS", returnableSubtype: subtype, name: subtype + ".pdf", status: "pending", reviewStatus: "APPROVED" }));
    const state = buildOpportunityExecutionState({ deal: { ...deal, opportunityExecution: { ...deal.opportunityExecution, requirements: { formsRequiringCompletion: ["SBD1", "SBD4", "SBD6_1"] } }, documents: docs }, contractor });
    expect(state.documentChecklist.find((item) => item.key === "sbd")).toMatchObject({ status: "COMPLETE", source: "SBD1.pdf, SBD4.pdf, SBD6_1.pdf" });
  });

  test("same filename in separate categories remains independently projected", () => {
    const state = buildOpportunityExecutionState({ deal: { ...deal, documents: [{ name: "same.pdf", returnableCategory: "DECLARATIONS", status: "approved", reviewStatus: "APPROVED" }, { name: "same.pdf", returnableCategory: "SIGNATURES", status: "approved", reviewStatus: "APPROVED" }] }, contractor });
    expect(state.documentChecklist.find((item) => item.key === "declarations")?.status).toBe("COMPLETE");
    expect(state.documentChecklist.find((item) => item.key === "signatures")?.status).toBe("COMPLETE");
  });
});

describe("classifier authority", () => {
  test("canonical categories are exclusive and approvalStatus is honored", () => {
    const documents = [{ id: "sbd", name: "SBD1-RFQ.pdf", returnableCategory: "SBD_FORMS", returnableSubtype: "SBD1", status: "pending", reviewStatus: "READY_FOR_REVIEW", approvalStatus: "APPROVED" }, { id: "declaration", name: "declaration-RFQ.pdf", returnableCategory: "DECLARATIONS", status: "pending", reviewStatus: "PENDING", approvalStatus: "APPROVED" }, { id: "signature", name: "signature-RFQ.pdf", returnableCategory: "SIGNATURES", status: "pending", reviewStatus: "PENDING", approvalStatus: "APPROVED" }, { id: "amendment", name: "amendment-RFQ.pdf", returnableCategory: "AMENDMENTS", status: "pending", reviewStatus: "PENDING", approvalStatus: "APPROVED" }, { id: "annexure", name: "annexure-RFQ.pdf", returnableCategory: "ANNEXURES", status: "pending", reviewStatus: "PENDING", approvalStatus: "APPROVED" }];
    const state = buildOpportunityExecutionState({ deal: { ...deal, documents: [...deal.documents, ...documents] }, contractor });
    expect(state.documentChecklist.find((item) => item.key === "source")?.source).toBe("rfq RFQ.pdf");
    expect(state.documentChecklist.find((item) => item.key === "sbd")?.status).toBe("BLOCKED");
    expect(state.documentChecklist.find((item) => item.key === "declarations")?.status).toBe("COMPLETE");
    expect(state.documentChecklist.find((item) => item.key === "signatures")?.status).toBe("COMPLETE");
    expect(state.documentChecklist.find((item) => item.key === "amendments")?.status).toBe("COMPLETE");
  });
  test("canonical and embedded copies deduplicate by stable identity without crossing categories", () => {
    const merged = mergeOpportunityDocuments([{ id: "legacy", storagePath: "same.pdf", name: "same.pdf", returnableCategory: "SBD_FORMS", status: "pending" }, { id: "other", storagePath: "same.pdf", name: "same.pdf", returnableCategory: "DECLARATIONS", status: "approved", approvalStatus: "APPROVED" }], [{ id: "canonical", storagePath: "same.pdf", name: "same.pdf", returnableCategory: "SBD_FORMS", status: "approved", approvalStatus: "APPROVED" }]);
    expect(merged).toHaveLength(2);
    expect(merged.map((item) => item.returnableCategory).sort()).toEqual(["DECLARATIONS", "SBD_FORMS"]);
    expect(merged.find((item) => item.returnableCategory === "SBD_FORMS")?.status).toBe("approved");
  });
});

describe("live persisted returnable shapes", () => {
  test("approved canonical category records survive into checklist projection", () => {
    const state = buildOpportunityExecutionState({ deal: { ...deal, opportunityExecution: { ...deal.opportunityExecution, documentPreparation: { returnables: [{ key: "declarations", status: "BLOCKED" }, { key: "signatures", status: "BLOCKED" }, { key: "amendments", status: "BLOCKED" }] }, requirements: { formsRequiringCompletion: ["SBD forms", "Declarations"], signatureRequired: true, annexuresAndAmendments: ["Amendments"] } }, documents: [{ id: "decl", dealId: "deal-1", returnableCategory: "DECLARATIONS", returnableKey: "declarations", documentPreparationItem: "declarations", status: "approved", reviewStatus: "APPROVED", approvalStatus: null, storagePath: "decl.pdf" }, { id: "sig", dealId: "deal-1", returnableCategory: "SIGNATURES", returnableKey: "signatures", documentPreparationItem: "signatures", status: "approved", reviewStatus: "APPROVED", storagePath: "sig.pdf" }, { id: "amend", dealId: "deal-1", returnableCategory: "AMENDMENTS", returnableKey: "amendments", status: "approved", reviewStatus: "APPROVED", storagePath: "amend.pdf" }] }, contractor });
    expect(state.documentChecklist.find((item) => item.key === "declarations")?.status).toBe("COMPLETE");
    expect(state.documentChecklist.find((item) => item.key === "signatures")?.status).toBe("COMPLETE");
    expect(state.documentChecklist.find((item) => item.key === "amendments")?.status).toBe("COMPLETE");
    expect(state.documentChecklist.find((item) => item.key === "sbd")?.status).toBe("BLOCKED");
  });
  test("SBD subtype normalization is shared by requirements and evidence", () => {
    expect(["SBD1", "SBD_1", "SBD 1"].map(normalizeSbdSubtype)).toEqual(["sbd1", "sbd1", "sbd1"]);
    expect(["SBD6_1", "SBD6.1", "SBD 6.1"].map(normalizeSbdSubtype)).toEqual(["sbd61", "sbd61", "sbd61"]);
  });
});

describe("approval-to-checklist projection", () => {
  test("approved declarations, signatures, and amendments complete only their matching items", () => {
    const state = buildOpportunityExecutionState({ deal: { ...deal, opportunityExecution: { ...deal.opportunityExecution, requirements: { formsRequiringCompletion: ["SBD forms"], signatureRequired: true, annexuresAndAmendments: ["Amendments"] } }, documents: [...deal.documents, governedDocument("declarations", "DECLARATIONS", "declaration.pdf", "approved", "APPROVED"), governedDocument("signatures", "SIGNATURES", "signed.pdf", "approved", "APPROVED"), governedDocument("amendments", "AMENDMENTS", "amendment.pdf", "approved", "APPROVED")] }, contractor });
    expect(state.documentChecklist.find((item) => item.key === "declarations")?.status).toBe("COMPLETE");
    expect(state.documentChecklist.find((item) => item.key === "signatures")?.status).toBe("COMPLETE");
    expect(state.documentChecklist.find((item) => item.key === "amendments")?.status).toBe("COMPLETE");
    expect(state.documentChecklist.find((item) => item.key === "sbd")?.status).toBe("BLOCKED");
  });

  test("review-required and rejected evidence do not complete a requirement", () => {
    const state = buildOpportunityExecutionState({ deal: { ...deal, documents: [...deal.documents, governedDocument("declarations", "DECLARATIONS", "declaration.pdf", "pending", "READY_FOR_REVIEW"), governedDocument("signatures", "SIGNATURES", "signed.pdf", "rejected", "REJECTED")] }, contractor });
    expect(state.documentChecklist.find((item) => item.key === "declarations")).toMatchObject({ status: "BLOCKED", reviewStatus: "READY_FOR_REVIEW" });
    expect(state.documentChecklist.find((item) => item.key === "signatures")?.status).toBe("BLOCKED");
  });

  test("SBD fails closed without authoritative required subtype requirements", () => {
    const state = buildOpportunityExecutionState({ deal: { ...deal, documents: [ ...deal.documents, governedDocument("sbd", "SBD_FORMS", "SBD1.pdf", "approved", "APPROVED", "SBD1"), governedDocument("sbd", "SBD_FORMS", "SBD4.pdf", "approved", "APPROVED", "SBD4"), governedDocument("sbd", "SBD_FORMS", "SBD6.1.pdf", "approved", "APPROVED", "SBD6_1") ] }, contractor });
    expect(state.documentChecklist.find((item) => item.key === "sbd")?.status).toBe("BLOCKED");
  });
});
