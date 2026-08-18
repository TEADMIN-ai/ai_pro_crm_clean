
import { buildSubmissionReviewView, canAccessSubmissionReview } from "@/lib/submission-review";
const review={id:"deal-1",dealId:"deal-1",opportunityId:"deal-1",contractorId:"contractor-1",workspaceId:"workspace-a",readiness:42,complianceStatus:"missing",pricingStatus:"pending",boqStatus:"required",documentStatus:"pending",signatureStatus:"pending",approvalStatus:"pending",packStatus:"pending",blockers:["Tax compliance missing","Pricing incomplete"],nextAction:"Start compliance review",assignedOwner:"compliance",updatedAt:"2026-07-17T08:00:00.000Z"};
const deal={id:"deal-1",title:"Cleaning Tender",rfqNumber:"RFQ-17",clientName:"City",closingDate:"2026-08-01",workspaceId:"workspace-a",documents:["RFQ.pdf"]};
const contractor={id:"contractor-1",companyName:"Mackay and Daughters",workspaceId:"workspace-a"};
describe("submission review workspace model",()=>{
it("loads a valid review record",()=>{expect(buildSubmissionReviewView({review,deal,contractor}).dealId).toBe("deal-1");});
it("displays contractor name",()=>{expect(buildSubmissionReviewView({review,deal,contractor}).contractorName).toBe("Mackay and Daughters");});
it("displays blockers",()=>{expect(buildSubmissionReviewView({review,deal,contractor}).blockers).toContain("Tax compliance missing");});
it("displays readiness",()=>{expect(buildSubmissionReviewView({review,deal,contractor}).readiness).toBe(11);});
it("marks missing record shape as incomplete",()=>{expect(buildSubmissionReviewView({review:{id:"missing"}}).connectionStatus).toBe("incomplete");});
it("rejects cross-workspace access",()=>{expect(canAccessSubmissionReview({actor:{role:"staff",workspaceId:"workspace-b"},review,contractor})).toMatchObject({ok:false,reason:"cross_workspace"});});
it("handles archived contractor safely",()=>{const view=buildSubmissionReviewView({review,deal,contractor:{...contractor,archived:true}});expect(view.contractorArchived).toBe(true);expect(view.blockers).toContain("Assigned contractor is archived");});
it("does not use mock data",()=>{expect(()=>buildSubmissionReviewView({review:{...review,mockReview:true},deal,contractor})).toThrow("mock data");});
it("clears stale pricing blockers after governed locked handoff",()=>{const pricing={lockStatus:"LOCKED",validationStatus:"VALIDATED",pricingDocumentId:"priced-doc",revision:1,managementApprovalStatus:"MANAGER_APPROVED",approvals:[{revision:1,role:"staff",approvedBy:"staff",approvedAt:"now"},{revision:1,role:"manager",approvedBy:"manager",approvedAt:"now"}],lineItems:[{mapping:{supplierQuoteId:"quote-a"}}],blockers:[],submissionReviewHandoff:{pricingApproved:true,workflowTransition:"DOCUMENT_PREPARATION"}};const view=buildSubmissionReviewView({review:{...review,blockers:["No approved supplier quote","Required pricing must be complete","Mandatory documents must be complete"]},deal:{...deal,tenderPricing:pricing},contractor});expect(view.blockers).not.toContain("No approved supplier quote");expect(view.blockers).not.toContain("Required pricing must be complete");expect(view.blockers).toContain("Mandatory documents must be complete");});
});

it("uses canonical execution workflow fields over stale review snapshot fields", () => {
  const view = buildSubmissionReviewView({
    review: { ...review, currentWorkflowPhase: "DOCUMENT_PREPARATION", readiness: 0, nextAction: "Continue document preparation" },
    deal: { ...deal, opportunityExecution: { currentPhase: "INTERNAL_REVIEW", documentsPrepared: true, internalReviewStarted: true, requirementsReviewed: true, complianceReviewed: true, requirements: { reviewed: true, reviewStatus: "APPROVED", boqPricingSchedulePresent: false, signatureRequired: false, annexuresAndAmendments: [] } } },
    contractor,
  });
  expect(view.currentWorkflowPhase).toBe("INTERNAL_REVIEW");
  expect(view.nextAction).not.toBe("Continue document preparation");
});
