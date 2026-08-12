import type { AuthorizedUser } from "@/lib/server/authz";

const mockDealGet = jest.fn();
const mockDealSet = jest.fn();
const mockOutcomeSet = jest.fn();
const mockRecordTransitionAudit = jest.fn();

jest.mock("@/lib/firebase/admin", () => ({
  getFirebaseAdmin: () => ({
    collection: (name: string) => {
      if (name === "deals") {
        return {
          doc: (id: string) => ({
            get: () => mockDealGet(id),
            set: (value: unknown, options?: unknown) => mockDealSet(id, value, options),
          }),
        };
      }
      if (name === "procurementOutcomes") {
        return {
          doc: () => ({ id: "outcome-1", set: mockOutcomeSet }),
        };
      }
      if (name === "users") {
        return {
          doc: () => ({ get: jest.fn() }),
        };
      }
      throw new Error(`Unexpected collection ${name}`);
    },
  }),
}));

jest.mock("@/lib/procurement/procurementStateAuthority", () => ({
  currentDealStateLabel: () => "submitted/submitted/SUBMITTED",
  recordProcurementTransitionAudit: (...args: unknown[]) => mockRecordTransitionAudit(...args),
}));

import { recordProcurementOutcome } from "@/server/services/procurementOutcomeAuthorityService";

function actor(overrides: Partial<AuthorizedUser> = {}): AuthorizedUser {
  return {
    uid: "staff-1",
    email: "staff@example.test",
    role: "staff",
    workspaceId: "workspace-1",
    ...overrides,
  } as AuthorizedUser;
}

function submittedDeal(overrides: Record<string, unknown> = {}) {
  return {
    workspaceId: "workspace-1",
    contractorId: "contractor-1",
    contractorAssignment: { contractorId: "contractor-1" },
    status: "submitted",
    stage: "submitted",
    opportunityExecution: {
      currentPhase: "SUBMITTED",
      submission: {
        clientQuoteId: "quote-1",
        tenderPackDocumentId: "pack-doc-1",
        submissionEvidenceDocumentId: "submission-evidence-1",
      },
    },
    ...overrides,
  };
}

function seedDeal(data: Record<string, unknown>) {
  mockDealGet.mockResolvedValue({ id: "deal-1", exists: true, data: () => data });
}

describe("procurement outcome authority", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDealSet.mockResolvedValue(undefined);
    mockOutcomeSet.mockResolvedValue(undefined);
    mockRecordTransitionAudit.mockResolvedValue(undefined);
  });

  test("rejects outcome before governed submission", async () => {
    seedDeal(submittedDeal({ status: "ready", stage: "ready", opportunityExecution: { currentPhase: "READY_FOR_SUBMISSION" } }));

    await expect(recordProcurementOutcome({
      dealId: "deal-1",
      actor: actor(),
      outcome: "AWARDED",
      outcomeEvidenceDocumentId: "award-doc-1",
      awardedAmount: 1000,
    })).rejects.toMatchObject({ code: "OUTCOME_REQUIRES_SUBMISSION" });

    expect(mockOutcomeSet).not.toHaveBeenCalled();
  });

  test("rejects cross-workspace outcome mutation", async () => {
    seedDeal(submittedDeal({ workspaceId: "workspace-2" }));

    await expect(recordProcurementOutcome({
      dealId: "deal-1",
      actor: actor(),
      outcome: "AWARDED",
      outcomeEvidenceDocumentId: "award-doc-1",
      awardedAmount: 1000,
    })).rejects.toMatchObject({ code: "CROSS_WORKSPACE_OUTCOME_REJECTED" });
  });

  test("requires durable outcome evidence", async () => {
    seedDeal(submittedDeal());

    await expect(recordProcurementOutcome({
      dealId: "deal-1",
      actor: actor(),
      outcome: "AWARDED",
      outcomeEvidenceDocumentId: "",
      awardedAmount: 1000,
    })).rejects.toMatchObject({ code: "OUTCOME_EVIDENCE_REQUIRED" });
  });

  test("records awarded outcome with canonical submission and financial linkage", async () => {
    seedDeal(submittedDeal());

    const result = await recordProcurementOutcome({
      dealId: "deal-1",
      actor: actor(),
      outcome: "AWARDED",
      outcomeEvidenceDocumentId: "award-doc-1",
      reference: "AWD-2026-001",
      awardedAmount: 125000,
      actualIncomeReference: "income-pending",
    });

    expect(mockOutcomeSet).toHaveBeenCalledWith(expect.objectContaining({
      outcomeId: "outcome-1",
      dealId: "deal-1",
      opportunityId: "deal-1",
      workspaceId: "workspace-1",
      contractorId: "contractor-1",
      clientQuoteId: "quote-1",
      tenderPackDocumentId: "pack-doc-1",
      submissionEvidenceDocumentId: "submission-evidence-1",
      outcomeEvidenceDocumentId: "award-doc-1",
      outcome: "AWARDED",
      awardedAmount: 125000,
    }));
    expect(mockDealSet).toHaveBeenCalledWith("deal-1", expect.objectContaining({
      status: "awarded",
      stage: "awarded",
      workflowStatus: "AWARDED",
      outcomeId: "outcome-1",
      awardedAmount: 125000,
    }), { merge: true });
    expect(result.financialResult).toEqual(expect.objectContaining({
      opportunityId: "deal-1",
      clientQuoteId: "quote-1",
      awardedAmount: 125000,
      actualIncomeReference: "income-pending",
    }));
    expect(mockRecordTransitionAudit).toHaveBeenCalledTimes(2);
  });

  test("requires a reason for unsuccessful outcome", async () => {
    seedDeal(submittedDeal());

    await expect(recordProcurementOutcome({
      dealId: "deal-1",
      actor: actor(),
      outcome: "UNSUCCESSFUL",
      outcomeEvidenceDocumentId: "notice-1",
    })).rejects.toMatchObject({ code: "OUTCOME_REASON_REQUIRED" });
  });

  test("rejects a second terminal outcome", async () => {
    seedDeal(submittedDeal({
      status: "submitted",
      opportunityExecution: {
        currentPhase: "SUBMITTED",
        outcomeStatus: "AWARDED",
        submission: {
          clientQuoteId: "quote-1",
          tenderPackDocumentId: "pack-doc-1",
          submissionEvidenceDocumentId: "submission-evidence-1",
        },
      },
    }));

    await expect(recordProcurementOutcome({
      dealId: "deal-1",
      actor: actor(),
      outcome: "CANCELLED",
      outcomeEvidenceDocumentId: "cancel-doc-1",
      reason: "Issuer cancelled tender",
    })).rejects.toMatchObject({ code: "OUTCOME_ALREADY_RECORDED" });
  });
});
