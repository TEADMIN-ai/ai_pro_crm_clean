const contractorDocs: Array<{ id: string; data: Record<string, unknown> }> = [];

const getFirebaseAdmin = jest.fn(() => ({
  collection: (name: string) => {
    if (name !== "contractors") {
      throw new Error(`Unexpected collection ${name}`);
    }

    return {
      get: jest.fn(async () => ({
        docs: contractorDocs.map((doc) => ({
          id: doc.id,
          data: () => doc.data,
        })),
      })),
      doc: jest.fn((contractorId: string) => ({
        collection: jest.fn(() => ({
          get: jest.fn(async () => ({ docs: [] })),
        })),
        id: contractorId,
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

const rawUid = "z0yX8cyt38hkfa6OUEyNTOiX2812";

describe("contractor service repository identity filtering", () => {
  beforeEach(() => {
    contractorDocs.length = 0;
    getFirebaseAdmin.mockClear();
  });

  it("excludes admin, staff, and manager user-shaped records from the live contractor repository", async () => {
    contractorDocs.push(
      { id: rawUid, data: { uid: rawUid, role: "admin", status: "active", name: "Mr K", workspaceId: "workspace-a" } },
      { id: "staff-user", data: { uid: "staff-user", role: "staff", status: "active", workspaceId: "workspace-a" } },
      { id: "manager-user", data: { uid: "manager-user", role: "manager", status: "active", workspaceId: "workspace-a" } },
      {
        id: "contractor-doc",
        data: {
          contractorId: "contractor-doc",
          role: "contractor",
          status: "active",
          workspaceId: "workspace-a",
          identityResolved: true,
          legalName: "Mackay and Daughters Enterprises (Pty) Ltd",
        },
      },
    );

    const contractors = await listContractors({ workspaceId: "workspace-a", actorRole: "staff" });

    expect(contractors).toHaveLength(1);
    expect(contractors[0]).toMatchObject({ id: "contractor-doc", contractorId: "contractor-doc" });
    expect(JSON.stringify(contractors)).not.toContain(rawUid);
    expect(JSON.stringify(contractors)).not.toContain("Mr K");
  });
});

