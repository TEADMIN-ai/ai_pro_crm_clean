import { getReturnableContext } from "@/lib/opportunities/returnableEvidence";
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

describe("governed returnable evidence context", () => {
  test("maps checklist key to explicit SBD context", () => {
    expect(getReturnableContext("sbd_forms")).toMatchObject({ key: "sbd", category: "SBD_FORMS", required: true });
  });

  test("pending SBD evidence remains blocked and review-required", () => {
    const state = buildOpportunityExecutionState({ deal: { ...deal, documents: [...deal.documents, { name: "SBD1.pdf", returnableKey: "sbd", returnableCategory: "SBD_FORMS", status: "pending", reviewStatus: "READY_FOR_REVIEW" }] }, contractor });
    expect(state.documentChecklist.find((item) => item.key === "sbd")).toMatchObject({ status: "BLOCKED", reviewStatus: "READY_FOR_REVIEW" });
  });

  test("only approved evidence completes its own checklist item", () => {
    const state = buildOpportunityExecutionState({ deal: { ...deal, documents: [...deal.documents, { name: "SBD1.pdf", returnableKey: "sbd", returnableCategory: "SBD_FORMS", status: "approved", reviewStatus: "APPROVED" }] }, contractor });
    expect(state.documentChecklist.find((item) => item.key === "sbd")).toMatchObject({ status: "COMPLETE" });
    expect(state.documentChecklist.find((item) => item.key === "declarations")?.status).toBe("BLOCKED");
  });
});
