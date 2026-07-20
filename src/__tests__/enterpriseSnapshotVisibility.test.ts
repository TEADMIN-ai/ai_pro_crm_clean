const collectionMock = jest.fn();
const collectionGroupMock = jest.fn();

jest.mock("@/lib/firebase/admin", () => ({
  getFirebaseAdmin: () => ({
    collection: collectionMock,
    collectionGroup: collectionGroupMock,
  }),
}));

import { getEnterpriseKpiSnapshot } from "@/lib/kpis/enterpriseSnapshot";

function doc(id: string, data: Record<string, unknown>, path = id) {
  return { id, data: () => data, ref: { path } };
}

function collectionSnapshot(records: Array<{ id: string; data: Record<string, unknown>; path?: string }> = []) {
  return {
    docs: records.map((record) => doc(record.id, record.data, record.path ?? record.id)),
  };
}

describe("enterprise KPI contractor visibility", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    collectionGroupMock.mockReturnValue({ get: jest.fn(async () => collectionSnapshot()) });
    collectionMock.mockImplementation((name: string) => {
      const data: Record<string, Array<{ id: string; data: Record<string, unknown> }>> = {
        opportunities: [
          {
            id: "opp-a",
            data: {
              workspaceId: "workspace-a",
              status: "ready_for_submission",
              readinessScore: 90,
              contractorAssignments: [{ contractorId: "prod-a" }],
            },
          },
          {
            id: "opp-b",
            data: {
              workspaceId: "workspace-b",
              status: "ready_for_submission",
              readinessScore: 95,
              contractorAssignments: [{ contractorId: "cross-workspace" }],
            },
          },
        ],
        contractors: [
          { id: "prod-a", data: { workspaceId: "workspace-a", readinessScore: 90, complianceConfidence: 90 } },
          { id: "cross-workspace", data: { workspaceId: "workspace-b", readinessScore: 95, complianceConfidence: 95 } },
          { id: "qa", data: { workspaceId: "workspace-a", qa: true, readinessScore: 100, complianceConfidence: 100 } },
          { id: "safe-delete", data: { workspaceId: "workspace-a", safeToDelete: true, readinessScore: 100, complianceConfidence: 100 } },
          { id: "archived", data: { workspaceId: "workspace-a", archived: true, readinessScore: 100, complianceConfidence: 100 } },
          { id: "legacy", data: { readinessScore: 100, complianceConfidence: 100 } },
        ],
        hygieneClients: [],
        hygieneCollections: [],
        hygieneComplianceDocuments: [],
        documents: [],
      };

      if (name === "users") {
        return { where: jest.fn(() => ({ get: jest.fn(async () => collectionSnapshot()) })) };
      }

      return { get: jest.fn(async () => collectionSnapshot(data[name] ?? [])) };
    });
  });

  test("counts only production contractors and opportunities in the current workspace", async () => {
    const snapshot = await getEnterpriseKpiSnapshot({ workspaceId: "workspace-a", actorRole: "staff" });

    expect(snapshot.opportunities.total).toBe(1);
    expect(snapshot.contractors.total).toBe(1);
    expect(snapshot.contractors.ready).toBe(1);
    expect(snapshot.contractors.compliant).toBe(1);
    expect(snapshot.contractors.assigned).toBe(1);
    expect(snapshot.contractors.unassigned).toBe(0);
  });
});
