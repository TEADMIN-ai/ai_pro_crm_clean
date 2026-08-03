import { assignEtendersContractor } from "@/server/services/etendersOpportunityService";
import { assertAssignmentAllowed, evaluateContractorAssignmentAuthority } from "@/server/services/contractorAssignmentAuthorityService";
import { getFirebaseAdmin } from "@/lib/firebase/admin";

jest.mock("@/lib/firebase/admin", () => ({ getFirebaseAdmin: jest.fn() }));
jest.mock("@/server/services/contractorAssignmentAuthorityService", () => ({
  assertAssignmentAllowed: jest.fn(),
  evaluateContractorAssignmentAuthority: jest.fn(),
}));

const actor = { uid: "staff-1", email: "staff@example.com", role: "staff" as const, workspaceId: "workspace-a" };
const dealId = "deal-1";
const requestedContractorId = "requested-contractor";
const canonicalContractorId = "contractor-1";
const deal = {
  workspaceId: "workspace-a",
  workflowStatus: "MATCHING_REQUIRED",
  etendersSource: { sourceOpportunityId: "162256", sourceSystem: "ETENDERS_SA" },
  boqRequired: { required: false },
};

function allowedDecision(overrides: Record<string, unknown> = {}) {
  return {
    status: "ALLOWED",
    dealId,
    contractorId: canonicalContractorId,
    workspaceId: "workspace-a",
    blockers: [],
    warnings: [],
    contractor: { id: canonicalContractorId, workspaceId: "workspace-a", companyName: "Eligible Contractor" },
    ...overrides,
  };
}

function blockedDecision(code: string, message = code) {
  return {
    ...allowedDecision(),
    status: "BLOCKED",
    blockers: [{ code, message }],
  };
}

function firestore(overrides: Partial<typeof deal> = {}) {
  const set = jest.fn().mockResolvedValue(undefined);
  const add = jest.fn().mockResolvedValue({ id: "activity-1" });
  const doc = jest.fn(() => ({
    id: dealId,
    get: jest.fn().mockResolvedValue({ exists: true, id: dealId, data: () => ({ ...deal, ...overrides }) }),
    set,
    collection: jest.fn(() => ({ add })),
  }));
  const collection = jest.fn(() => ({ doc }));
  return { db: { collection }, set, add, doc };
}

async function expectBlockedByAuthority(code: string) {
  const store = firestore();
  (getFirebaseAdmin as jest.Mock).mockReturnValue(store.db);
  (evaluateContractorAssignmentAuthority as jest.Mock).mockResolvedValue(blockedDecision(code));
  (assertAssignmentAllowed as jest.Mock).mockImplementation((decision) => {
    if (decision.status !== "ALLOWED") throw new Error(`Assignment blocked: ${code}`);
  });

  await expect(assignEtendersContractor({ dealId, contractorId: requestedContractorId, actor })).rejects.toThrow(`Assignment blocked: ${code}`);
  expect(store.set).not.toHaveBeenCalled();
  expect(store.add).not.toHaveBeenCalled();
}

describe("eTenders assignment authority", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (assertAssignmentAllowed as jest.Mock).mockImplementation((decision) => {
      if (decision.status !== "ALLOWED") throw new Error("Assignment blocked");
    });
  });

  test("assigns an eligible contractor after canonical authority allows it", async () => {
    const store = firestore();
    (getFirebaseAdmin as jest.Mock).mockReturnValue(store.db);
    (evaluateContractorAssignmentAuthority as jest.Mock).mockResolvedValue(allowedDecision());

    const execution = await assignEtendersContractor({ dealId, contractorId: requestedContractorId, actor });

    expect(evaluateContractorAssignmentAuthority).toHaveBeenCalledWith({
      dealId,
      contractorReference: requestedContractorId,
      actor,
      targetPhase: "COMPLIANCE_REVIEW",
      deal: { id: dealId, ...deal },
    });
    expect(assertAssignmentAllowed).toHaveBeenCalledWith(expect.objectContaining({ status: "ALLOWED" }));
    expect(store.set).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: canonicalContractorId,
        contractorId: canonicalContractorId,
        contractorName: "Eligible Contractor",
        workflowStatus: "CONTRACTOR_ASSIGNED",
      }),
      { merge: true },
    );
    expect(execution.contractorId).toBe(canonicalContractorId);
    expect(execution.workspaceId).toBe("workspace-a");
  });

  test("blocks unresolved contractor identity", async () => {
    await expectBlockedByAuthority("CONTRACTOR_IDENTITY_UNRESOLVED");
  });

  test("blocks missing required documents", async () => {
    await expectBlockedByAuthority("REQUIRED_DOCUMENTS_MISSING");
  });

  test("blocks incomplete compliance", async () => {
    await expectBlockedByAuthority("COMPLIANCE_INCOMPLETE");
  });

  test("blocks missing or invalid SARS/TCS evidence", async () => {
    await expectBlockedByAuthority("SARS_TCS_EVIDENCE_MISSING");
  });

  test("blocks stale authority decisions", async () => {
    await expectBlockedByAuthority("STALE_ASSIGNMENT_DECISION");
  });

  test("blocks contractors without a workspace", async () => {
    await expectBlockedByAuthority("CONTRACTOR_WORKSPACE_UNRESOLVED");
  });

  test("blocks cross-workspace contractors", async () => {
    await expectBlockedByAuthority("WORKSPACE_MISMATCH");
  });

  test("performs no assignment write when authority fails", async () => {
    await expectBlockedByAuthority("ASSIGNMENT_AUTHORITY_BLOCKED");
  });

  test("does not calculate readiness or missing documents independently", async () => {
    const store = firestore();
    (getFirebaseAdmin as jest.Mock).mockReturnValue(store.db);
    (evaluateContractorAssignmentAuthority as jest.Mock).mockResolvedValue(
      allowedDecision({
        contractor: {
          id: canonicalContractorId,
          workspaceId: "workspace-a",
          companyName: "Eligible Contractor",
          readinessScore: 0,
          missingCriticalDocuments: ["Tax compliance"],
        },
      }),
    );

    await assignEtendersContractor({ dealId, contractorId: requestedContractorId, actor });

    expect(store.set).toHaveBeenCalledWith(expect.objectContaining({ workflowStatus: "CONTRACTOR_ASSIGNED" }), { merge: true });
  });

  test("preserves assignment audit activity after allowed assignment", async () => {
    const store = firestore();
    (getFirebaseAdmin as jest.Mock).mockReturnValue(store.db);
    (evaluateContractorAssignmentAuthority as jest.Mock).mockResolvedValue(allowedDecision());

    await assignEtendersContractor({ dealId, contractorId: requestedContractorId, actor });

    expect(store.add).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "contractor_assigned",
        message: "Contractor assigned and eTenders execution workspace created",
        to: canonicalContractorId,
        performedByEmail: actor.email,
      }),
    );
  });
});
