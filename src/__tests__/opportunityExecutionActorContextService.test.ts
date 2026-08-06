const getFirebaseAdmin = jest.fn();
const listContractors = jest.fn();
const resolveContractorReference = jest.fn();
const evaluateContractorAssignmentAuthority = jest.fn();

jest.mock("@/lib/firebase/admin", () => ({
  getFirebaseAdmin: () => getFirebaseAdmin(),
}));
jest.mock("@/server/services/contractorService", () => ({
  listContractors: (input: unknown) => listContractors(input),
}));
jest.mock("@/lib/contractors/contractorReferenceResolver", () => ({
  getContractorBusinessName: (contractor: Record<string, unknown>) => contractor.companyName ?? contractor.id,
  resolveContractorReference: (input: unknown) => resolveContractorReference(input),
}));
jest.mock("@/server/services/contractorAssignmentAuthorityService", () => ({
  evaluateContractorAssignmentAuthority: (input: unknown) => evaluateContractorAssignmentAuthority(input),
}));
jest.mock("@/lib/opportunities/opportunityExecution", () => ({
  buildOpportunityExecutionState: () => ({
    currentPhase: "MATCHING_REQUIRED",
    requirements: {},
    remediationRequests: [],
  }),
  extractOpportunityRequirements: () => ({}),
  matchContractorsForOpportunity: () => [{
    contractorId: "c1",
    eligible: true,
    assignmentAllowed: true,
    blockingReasons: [],
    recommendationReason: "Matched",
  }],
}));
jest.mock("@/lib/opportunities/procurementExecutionProjection", () => ({
  buildProcurementExecutionProjection: () => ({}),
}));

import { getOpportunityExecutionView } from "@/server/services/opportunityExecutionService";

const actor = {
  uid: "staff-verified",
  email: "staff@example.test",
  role: "staff" as const,
  workspaceId: "workspace-a",
};
const deal = {
  id: "deal-1",
  workspaceId: "workspace-a",
  category: "cleaning",
  opportunityExecution: { currentPhase: "MATCHING_REQUIRED" },
};

function snapshot(id: string, data?: Record<string, unknown>) {
  return { id, exists: Boolean(data), data: () => data };
}

function database(actorWorkspaceId = "workspace-a") {
  const activityQuery = {
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    get: jest.fn(async () => ({ docs: [] })),
  };
  return {
    collection: jest.fn((name: string) => {
      if (name === "users") {
        return { doc: jest.fn(() => ({ get: jest.fn(async () => snapshot(actor.uid, { workspaceId: actorWorkspaceId })) })) };
      }
      if (name === "deals") {
        return {
          doc: jest.fn(() => ({
            get: jest.fn(async () => snapshot("deal-1", deal)),
            collection: jest.fn(() => activityQuery),
          })),
        };
      }
      throw new Error("Unexpected collection " + name);
    }),
  };
}

describe("opportunity execution actor context", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getFirebaseAdmin.mockReturnValue(database());
    listContractors.mockResolvedValue([{ id: "c1", contractorId: "c1", companyName: "Clean Co", workspaceId: "workspace-a" }]);
    evaluateContractorAssignmentAuthority.mockResolvedValue({
      status: "ALLOWED",
      blockers: [],
      contractorId: "c1",
      readinessDecisionStatus: "READY",
      decisionLogicVersion: "test",
    });
  });

  test("authenticated actor reaches contractor assignment authority evaluation", async () => {
    const view = await getOpportunityExecutionView("deal-1", actor);

    expect(evaluateContractorAssignmentAuthority).toHaveBeenCalledWith(expect.objectContaining({
      dealId: "deal-1",
      contractorReference: "c1",
      actor,
      deal,
    }));
    expect(view.matches[0]).toMatchObject({
      eligible: true,
      assignmentAllowed: true,
      authorityStatus: "ALLOWED",
    });
  });

  test("absent actor context remains blocked at the service layer", async () => {
    const view = await getOpportunityExecutionView("deal-1");

    expect(evaluateContractorAssignmentAuthority).not.toHaveBeenCalled();
    expect(view.matches[0]).toMatchObject({
      eligible: false,
      assignmentAllowed: false,
      blockingReasons: ["Authenticated actor context is required for assignment authority"],
      authorityStatus: "BLOCKED",
    });
  });

  test("cross-workspace actor access remains rejected", async () => {
    getFirebaseAdmin.mockReturnValue(database("workspace-b"));

    await expect(getOpportunityExecutionView("deal-1", actor)).rejects.toMatchObject({
      message: "Cross-workspace access rejected",
      status: 403,
    });
    expect(evaluateContractorAssignmentAuthority).not.toHaveBeenCalled();
  });
});