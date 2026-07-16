const getFirebaseAdmin = jest.fn();

jest.mock("@/lib/firebase/admin", () => ({
  getFirebaseAdmin: () => getFirebaseAdmin(),
}));

import { resolveContractorReference } from "@/lib/contractors/contractorReferenceResolver";

type RecordMap = Record<string, Record<string, unknown>>;

function snapshot(id: string, data?: Record<string, unknown>) {
  return {
    id,
    exists: Boolean(data),
    data: () => data,
  };
}

function querySnapshot(docs: Array<{ id: string; data: () => Record<string, unknown> }>) {
  return {
    empty: docs.length === 0,
    docs,
  };
}

function createDb(collections: Record<string, RecordMap>) {
  return {
    collection: jest.fn((collectionName: string) => ({
      doc: jest.fn((id: string) => ({
        get: jest.fn().mockResolvedValue(snapshot(id, collections[collectionName]?.[id])),
      })),
      where: jest.fn((field: string, _op: string, value: string) => ({
        limit: jest.fn(() => ({
          get: jest.fn().mockResolvedValue(
            querySnapshot(
              Object.entries(collections[collectionName] ?? {})
                .filter(([, data]) => data[field] === value)
                .map(([id, data]) => ({
                  id,
                  data: () => data,
                })),
            ),
          ),
        })),
      })),
    })),
  };
}

describe("resolveContractorReference", () => {
  beforeEach(() => {
    getFirebaseAdmin.mockReset();
    jest.spyOn(console, "info").mockImplementation(() => undefined);
    jest.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("resolves by canonical Firestore contractor document ID", async () => {
    getFirebaseAdmin.mockReturnValue(createDb({
      contractors: {
        "contractor-doc": { contractorId: "contractor-doc", companyName: "Mackay and Daughters", workspaceId: "workspace-a" },
      },
    }));

    const result = await resolveContractorReference({ reference: "contractor-doc", expectedWorkspaceId: "workspace-a" });

    expect(result.ok).toBe(true);
    expect(result.ok && result.contractorId).toBe("contractor-doc");
    expect(result.ok && result.referenceType).toBe("firestore_document_id");
  });

  it("resolves legacy Firebase Auth UID through authUid", async () => {
    getFirebaseAdmin.mockReturnValue(createDb({
      contractors: {
        "contractor-doc": { contractorId: "contractor-doc", authUid: "auth-uid" },
      },
    }));

    const result = await resolveContractorReference({ reference: "auth-uid" });

    expect(result.ok).toBe(true);
    expect(result.ok && result.contractorId).toBe("contractor-doc");
    expect(result.ok && result.referenceType).toBe("authUid_field");
  });

  it("resolves legacy contractor uid field", async () => {
    getFirebaseAdmin.mockReturnValue(createDb({
      contractors: {
        "contractor-doc": { contractorId: "contractor-doc", uid: "legacy-uid" },
      },
    }));

    const result = await resolveContractorReference({ reference: "legacy-uid" });

    expect(result.ok).toBe(true);
    expect(result.ok && result.contractorId).toBe("contractor-doc");
    expect(result.ok && result.referenceType).toBe("uid_field");
  });

  it("rejects cross-workspace contractor references", async () => {
    getFirebaseAdmin.mockReturnValue(createDb({
      contractors: {
        "contractor-doc": { contractorId: "contractor-doc", workspaceId: "workspace-b" },
      },
    }));

    const result = await resolveContractorReference({ reference: "contractor-doc", expectedWorkspaceId: "workspace-a" });

    expect(result.ok).toBe(false);
    expect(result).toMatchObject({ ok: false, failureReason: "cross_workspace" });
  });

  it("returns not_found for missing contractor references", async () => {
    getFirebaseAdmin.mockReturnValue(createDb({ contractors: {}, users: {}, contractorProfiles: {} }));

    const result = await resolveContractorReference({ reference: "missing" });

    expect(result.ok).toBe(false);
    expect(result).toMatchObject({ ok: false, failureReason: "not_found" });
  });

  it("returns an error for ambiguous contractor references", async () => {
    getFirebaseAdmin.mockReturnValue(createDb({
      contractors: {
        "contractor-a": { authUid: "shared-uid" },
        "contractor-b": { authUid: "shared-uid" },
      },
    }));

    const result = await resolveContractorReference({ reference: "shared-uid" });

    expect(result.ok).toBe(false);
    expect(result).toMatchObject({ ok: false, failureReason: "ambiguous_reference" });
  });

  it("resolves legacy user profile references through users.contractorId", async () => {
    getFirebaseAdmin.mockReturnValue(createDb({
      users: {
        "user-profile": { uid: "user-profile", contractorId: "contractor-doc" },
      },
      contractors: {
        "contractor-doc": { contractorId: "contractor-doc", userId: "user-profile" },
      },
    }));

    const result = await resolveContractorReference({ reference: "user-profile" });

    expect(result.ok).toBe(true);
    expect(result.ok && result.contractorId).toBe("contractor-doc");
  });
});
