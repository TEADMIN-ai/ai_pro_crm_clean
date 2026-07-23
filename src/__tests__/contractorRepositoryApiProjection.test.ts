const contractorDocs: Array<{ id: string; data: Record<string, unknown>; documents?: Array<{ id: string; data: Record<string, unknown> }> }> = [];

const getFirebaseAdmin = jest.fn(() => ({
  collection: (name: string) => {
    if (name !== "contractors") throw new Error(`Unexpected collection ${name}`);
    return {
      get: jest.fn(async () => ({
        docs: contractorDocs.map((doc) => ({
          id: doc.id,
          data: () => doc.data,
        })),
      })),
      doc: jest.fn((contractorId: string) => ({
        collection: jest.fn(() => ({
          get: jest.fn(async () => ({
            docs: (contractorDocs.find((doc) => doc.id === contractorId || doc.data.contractorId === contractorId)?.documents ?? []).map((doc) => ({
              id: doc.id,
              data: () => doc.data,
            })),
          })),
        })),
      })),
    };
  },
}));

jest.mock("@/lib/firebase/admin", () => ({
  getFirebaseAdmin: () => getFirebaseAdmin(),
}));

jest.mock("@/server/services/auditLogService", () => ({
  recordAuditLog: jest.fn(),
}));

import { listContractors } from "@/server/services/contractorService";

describe("contractor repository API projection safety", () => {
  beforeEach(() => {
    contractorDocs.length = 0;
    getFirebaseAdmin.mockClear();
  });

  it("does not return authUid or userId in the normal repository projection", async () => {
    contractorDocs.push({
      id: "contractor-doc",
      data: {
        id: "contractor-doc",
        contractorId: "contractor-doc",
        authUid: "auth-uid",
        userId: "user-id",
        uid: "legacy-uid",
        workspaceId: "workspace-a",
        role: "contractor",
        legalName: "Empire Civil Pty Ltd",
        csdNumber: "MISREPRESENT",
        readinessScore: 100,
        readinessStatus: "READY",
        complianceStatus: "complete",
        overallStatus: "Approved / Compliant",
      },
    });

    const [contractor] = await listContractors({ workspaceId: "workspace-a", actorRole: "staff" });

    expect(contractor.contractorId).toBe("contractor-doc");
    expect(contractor).not.toHaveProperty("authUid");
    expect(contractor).not.toHaveProperty("userId");
    expect(contractor).not.toHaveProperty("uid");
    expect(contractor.readinessScore).toBeNull();
    expect(contractor.readinessStatus).not.toBe("READY");
    expect(contractor.complianceStatus).not.toBe("complete");
    expect(contractor.overallStatus).not.toBe("Approved / Compliant");
    expect(contractor.historicalDecision).toMatchObject({
      readinessScore: 100,
      readinessStatus: "READY",
      complianceStatus: "complete",
      overallStatus: "Approved / Compliant",
    });
  });
});
