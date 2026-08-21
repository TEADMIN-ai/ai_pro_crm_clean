
jest.mock("firebase-admin/firestore", () => ({ Timestamp: { fromDate: (date: Date) => date } }));

const mockSet = jest.fn();
const mockVerifiedClient = { entityType: "client", canonicalId: "TE-CLI-1", displayName: "Client", workspaceId: "workspace-1", status: "active", verificationStatus: "VERIFIED", reviewStatus: "READY_FOR_USE" };
const mockPricingGet = jest.fn();

jest.mock("@/lib/firebase/admin", () => ({
  getFirebaseAdmin: () => ({
    collection: (name: string) => ({
      doc: (id: string) => ({
        get: name === "tenderPricingWorkspaces" && id === "pricing-1"
          ? mockPricingGet
          : jest.fn(async () => ({ exists: true, id, data: () => name === "masterClients" ? mockVerifiedClient : name === "masterDocuments" ? { entityType: "document", canonicalId: id, documentId: id, documentType: "PRICED_TENDER_DOCUMENT", linkedEntityId: "deal-1", workspaceId: "workspace-1", status: "active", verificationStatus: "VERIFIED", reviewStatus: "READY_FOR_USE", storagePath: "priced-documents/workspace-1/deal-1/pricing-1/revision-1/priced-document.json" } : { workspaceId: "workspace-1", clientId: "TE-CLI-1" } })),
        set: mockSet,
      }),
      where: () => ({
        limit: () => ({ get: jest.fn(async () => ({ empty: false, docs: [{ id: "TE-CLI-1", data: () => mockVerifiedClient }] })) }),
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

const approvedPricing = {
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
  documentFillEvidence: { sourceDocumentId: "source-doc-1", sourceDocumentPath: "source.pdf", pricedDocumentId: "priced-doc-1", pricedDocumentUrl: "https://example.test/priced.pdf", originalPreserved: true, fieldMappings: [{ fieldName: "total", value: "100", source: "approved_pricing_record", confidence: 1 }], warnings: [], validationIssues: [] },
  lineItems: [],
};

describe("tender pricing Client Quote handoff", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPricingGet.mockResolvedValue({ exists: true, id: "pricing-1", data: () => approvedPricing });
  });

  it("fails closed before workflow projection writes when canonical Client Quote persistence fails", async () => {
    mockCreateApprovedClientQuoteFromLockedPricing.mockRejectedValue(Object.assign(new Error("quote persistence failed"), { code: "CLIENT_QUOTE_ARTIFACT_REQUIRED" }));

    await expect(sendTenderPricingToSubmissionReview({ pricingId: "pricing-1", actor })).rejects.toMatchObject({ code: "CLIENT_QUOTE_ARTIFACT_REQUIRED" });

    expect(mockCreateApprovedClientQuoteFromLockedPricing).toHaveBeenCalledWith({ pricing: expect.objectContaining({ id: "pricing-1", clientIdentityStatus: "RESOLVED_VERIFIED", clientIdentityCanonicalId: "TE-CLI-1" }), actor });
    expect(mockSet).not.toHaveBeenCalled();
  });
});

test("approved pricing handoff records canonical Client Quote identity after governed persistence", async () => {
  mockCreateApprovedClientQuoteFromLockedPricing.mockResolvedValue({ clientQuoteId: "client-quote-1", generatedDocumentId: "priced-doc-1" });

  await sendTenderPricingToSubmissionReview({ pricingId: "pricing-1", actor });

  expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({ clientQuoteId: "client-quote-1", clientQuoteDocumentId: "priced-doc-1", pricingComplete: true }), { merge: true });
});
