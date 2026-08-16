import { dedupeReturnableEvidence, getReturnableContext } from "@/lib/opportunities/returnableEvidence";
import { buildOpportunityExecutionState } from "@/lib/opportunities/opportunityExecution";

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
