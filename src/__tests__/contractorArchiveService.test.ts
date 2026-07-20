const updateMock = jest.fn();
const recordAuditLog = jest.fn();

const records: Record<string, Record<string, unknown>> = {
  active: { contractorId: "active", companyName: "Mackay and Daughters Enterprises", status: "READY", workspaceId: "w1" },
  archived: { contractorId: "archived", companyName: "Test Contractor", archived: true, status: "pending", workspaceId: "w1" },
  dependent: { contractorId: "dependent", companyName: "F E MILLER POOLS", status: "READY", workspaceId: "w1" },
};

function docSnapshot(id: string) {
  const data = records[id];
  return { id, exists: Boolean(data), data: () => data };
}

const db = {
  collection: jest.fn((name: string) => {
    if (name !== "contractors") {
      return { add: jest.fn() };
    }
    return {
      get: jest.fn(async () => ({ docs: Object.entries(records).map(([id]) => docSnapshot(id)) })),
      doc: jest.fn((id: string) => ({
        get: jest.fn(async () => docSnapshot(id)),
        update: updateMock,
        collection: jest.fn(() => ({ get: jest.fn(async () => ({ docs: [] })) })),
      })),
    };
  }),
};

jest.mock("@/lib/firebase/admin", () => ({ getFirebaseAdmin: () => db }));
jest.mock("@/server/services/auditLogService", () => ({ recordAuditLog: (...args: unknown[]) => recordAuditLog(...args) }));

import {
  archiveContractorById,
  deleteContractorById,
  getContractorById,
  listContractors,
  restoreContractorById,
} from "@/server/services/contractorService";
import { AuthorizationError } from "@/lib/server/authz";

describe("contractor archive service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    records.active.archived = false;
    records.archived.archived = true;
  });

  test("archived contractors are excluded from the active list", async () => {
    const contractors = await listContractors({ workspaceId: "w1", actorRole: "staff" });
    expect(contractors.map((contractor) => contractor.id)).toEqual(["active", "dependent"]);
  });

  test("archived contractors are visible when explicitly included for admin review", async () => {
    const contractors = await listContractors({ workspaceId: "w1", actorRole: "admin", includeArchived: true });
    expect(contractors.map((contractor) => contractor.id)).toContain("archived");
  });

  test("linked archived contractor detail remains resolvable", async () => {
    const contractor = await getContractorById("archived");
    expect(contractor).toMatchObject({ id: "archived", archived: true });
  });

  test("archive operation requires admin", async () => {
    await expect(
      archiveContractorById({
        contractorId: "active",
        reason: "test archive",
        actor: { uid: "staff-1", email: "staff@example.com", role: "staff" },
      }),
    ).rejects.toBeInstanceOf(AuthorizationError);
  });

  test("restore operation requires admin", async () => {
    await expect(
      restoreContractorById({
        contractorId: "archived",
        actor: { uid: "manager-1", email: "manager@example.com", role: "manager" },
      }),
    ).rejects.toBeInstanceOf(AuthorizationError);
  });

  test("audit event is written for archive", async () => {
    await archiveContractorById({
      contractorId: "active",
      reason: "duplicate test record",
      actor: { uid: "admin-1", email: "admin@example.com", role: "admin", workspaceId: "w1" },
    });

    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({ archived: true, archiveReason: "duplicate test record" }));
    expect(recordAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: "CONTRACTOR_ARCHIVED", entityId: "active" }));
  });

  test("audit event is written for restore", async () => {
    await restoreContractorById({
      contractorId: "archived",
      reason: "restore requested",
      actor: { uid: "admin-1", email: "admin@example.com", role: "admin", workspaceId: "w1" },
    });

    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({ archived: false, restoreReason: "restore requested" }));
    expect(recordAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: "CONTRACTOR_RESTORED", entityId: "archived" }));
  });

  test("cross-workspace archive is rejected", async () => {
    await expect(
      archiveContractorById({
        contractorId: "active",
        reason: "wrong workspace",
        actor: { uid: "admin-1", email: "admin@example.com", role: "admin", workspaceId: "other" },
      }),
    ).rejects.toBeInstanceOf(AuthorizationError);
  });

  test("contractor with dependencies is not hard-deleted", async () => {
    await expect(deleteContractorById("dependent")).rejects.toThrow("Hard deletion");
  });

  test("active legitimate contractors remain visible", async () => {
    const contractors = await listContractors({ workspaceId: "w1", actorRole: "staff" });
    expect(contractors.find((contractor) => contractor.id === "active")).toMatchObject({
      companyName: "Mackay and Daughters Enterprises",
    });
    expect(contractors.find((contractor) => contractor.id === "dependent")).toMatchObject({
      companyName: "F E MILLER POOLS",
    });
  });
});
