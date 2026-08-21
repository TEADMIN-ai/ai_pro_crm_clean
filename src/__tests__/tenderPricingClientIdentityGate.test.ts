jest.mock("firebase-admin/firestore", () => ({ Timestamp: { fromDate: (date: Date) => date } }));

const mockSet = jest.fn();
const mockPricingGet = jest.fn();

jest.mock("@/lib/firebase/admin", () => ({
  getFirebaseAdmin: () => ({
    collection: (name: string) => ({
      doc: (id: string) => ({
        get: name === "tenderPricingWorkspaces" && id === "pricing-1"
          ? mockPricingGet
          : jest.fn(async () => ({ exists: name === "deals", id, data: () => ({ workspaceId: "workspace-1", clientName: "Name Only Client" }) })),
        set: mockSet,
      }),
      where: () => ({
        limit: () => ({ get: jest.fn(async () => ({ empty: true, docs: [] })) }),
      }),
    }),
  }),
}));

const mockCreateApprovedClientQuoteFromLockedPricing = jest.fn();
jest.mock("@/server/services/clientQuoteAuthorityService", () => ({
  createApprovedClientQuoteFromLockedPricing: (...args: unknown[]) => mockCreateApprovedClientQuoteFromLockedPricing(...args),
}));

import { sendTenderPricingToSubmissionReview } from "@/server/services/tenderPricingService";

const actor = { uid: "manager-1", role: "manager" as const, workspaceId: "workspace-1" };

test("missing client identity blocks pricing handoff before Client Quote creation", async () => {
  mockPricingGet.mockResolvedValue({
    exists: true,
    id: "pricing-1",
    data: () => ({
      id: "pricing-1",
      workspaceId: "workspace-1",
      opportunityId: "deal-1",
      dealId: "deal-1",
      pricingStatus: "LOCKED",
      mappingStatus: "APPROVED",
      validationStatus: "VALIDATED",
      lockStatus: "LOCKED",
      total: 100,
      grossProfit: 20,
      grossMarginPercentage: 20,
      blockers: [],
      revision: 1,
      managementApprovalStatus: "MANAGER_APPROVED",
      approvals: [
        { revision: 1, role: "staff", approvedBy: "staff-1", approvedAt: "2026-08-01T00:00:00.000Z" },
        { revision: 1, role: "manager", approvedBy: "manager-1", approvedAt: "2026-08-01T00:00:00.000Z" },
      ],
      documentFillEvidence: { sourceDocumentId: "source-doc-1", sourceDocumentPath: "source.pdf", pricedDocumentId: "priced-doc-1", originalPreserved: true, fieldMappings: [], warnings: [], validationIssues: [] },
      lineItems: [],
    }),
  });

  await expect(sendTenderPricingToSubmissionReview({ pricingId: "pricing-1", actor })).rejects.toMatchObject({ code: "CLIENT_IDENTITY_REQUIRED" });

  expect(mockCreateApprovedClientQuoteFromLockedPricing).not.toHaveBeenCalled();
  expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({
    clientIdentityBlocker: "Client identity required",
    clientIdentityStatus: "CLIENT_REVIEW_REQUIRED",
    nextAction: "Client identity required",
  }), { merge: true });
});
