const getUser = jest.fn();
const setCustomUserClaims = jest.fn();
const getUserByEmail = jest.fn();
const getAuth = jest.fn(() => ({
  getUser,
  getUserByEmail,
  setCustomUserClaims,
}));

const getFirebaseAdmin = jest.fn();

jest.mock("firebase-admin/auth", () => ({
  getAuth: () => getAuth(),
}));

jest.mock("@/lib/firebase/admin", () => ({
  getFirebaseAdmin: () => getFirebaseAdmin(),
}));

import { ensureContractorAuthLinkage } from "@/lib/contractors/contractorAuthLink";
import { buildContractorSelectorOption } from "@/lib/contractors/contractorSelectorOptions";
import { matchContractorsForOpportunity } from "@/lib/opportunities/opportunityExecution";

function createDocSnapshot(id: string, data?: Record<string, unknown>) {
  return {
    id,
    exists: Boolean(data),
    data: () => data,
  };
}

describe("ensureContractorAuthLinkage", () => {
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    getUser.mockReset();
    getUserByEmail.mockReset();
    setCustomUserClaims.mockReset();
    getAuth.mockClear();
    getFirebaseAdmin.mockReset();
    warnSpy = jest.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it("creates a missing contractor profile for a contractor user without duplicating mappings", async () => {
    const usersSet = jest.fn().mockResolvedValue(undefined);
    const contractorSet = jest.fn().mockResolvedValue(undefined);

    const db = {
      collection: jest.fn((name: string) => {
        if (name === "users") {
          return {
            doc: jest.fn((id: string) => ({
              get: jest.fn().mockResolvedValue(
                createDocSnapshot(id, {
                  uid: id,
                  email: "contractor@example.com",
                  name: "Mr K",
                  role: "contractor",
                  contractorId: id,
                  createdAt: 123,
                }),
              ),
              set: usersSet,
            })),
          };
        }

        if (name === "contractors") {
          return {
            doc: jest.fn((id: string) => ({
              get: jest.fn().mockResolvedValue(createDocSnapshot(id)),
              set: contractorSet,
            })),
            where: jest.fn(() => ({
              limit: jest.fn(() => ({
                get: jest.fn().mockResolvedValue({ docs: [] }),
              })),
            })),
          };
        }

        throw new Error(`Unexpected collection ${name}`);
      }),
    };

    getFirebaseAdmin.mockReturnValue(db);
    getUser.mockResolvedValue({
      uid: "FC6EgOoPtqedWvGjfdZPn8y19kx2",
      email: "contractor@example.com",
      displayName: "Mr K",
      customClaims: {
        role: "contractor",
        contractorId: "FC6EgOoPtqedWvGjfdZPn8y19kx2",
      },
    });

    const result = await ensureContractorAuthLinkage({
      uid: "FC6EgOoPtqedWvGjfdZPn8y19kx2",
      source: "test",
      allowCreateMissingContractor: true,
    });

    expect(result.contractorId).toBe("FC6EgOoPtqedWvGjfdZPn8y19kx2");
    expect(result.contractorProfileCreated).toBe(true);
    expect(contractorSet).toHaveBeenCalledTimes(2);
    expect(contractorSet).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        contractorId: "FC6EgOoPtqedWvGjfdZPn8y19kx2",
        authUid: "FC6EgOoPtqedWvGjfdZPn8y19kx2",
        userId: "FC6EgOoPtqedWvGjfdZPn8y19kx2",
      }),
      { merge: true },
    );
    const created = contractorSet.mock.calls[0][0] as Record<string, unknown>;
    expect(created).toEqual(expect.objectContaining({ identityResolved: false, identityStatus: "UNRESOLVED", identityResolutionStatus: "UNRESOLVED", workspaceId: null, workspaceResolutionStatus: "UNRESOLVED", businessIdentityEvidenceStatus: "MISSING", status: "identity_unresolved", logicVersion: "contractor-business-identity-v1" }));
    expect(created.companyName).toBeUndefined();
    expect(created.legalName).toBeUndefined();
    expect(created.businessName).toBeUndefined();
    expect(created.tradingName).toBeUndefined();
    expect(created.registeredName).toBeUndefined();
    expect(created.registeredBusinessName).toBeUndefined();
    expect(created.name).toBeUndefined();
    expect(created.contactPerson).toBeUndefined();
    expect(JSON.stringify(created)).not.toContain("Mr K");
    expect(created.blockingReasons).toEqual(expect.arrayContaining(["Contractor business identity evidence is missing", "Contractor workspace resolution is unresolved"]));
    expect(created.sourceMetadata).toEqual(expect.objectContaining({ source: "test", sourceUserUid: "FC6EgOoPtqedWvGjfdZPn8y19kx2", workspaceResolutionStatus: "UNRESOLVED", decisionLogicVersion: "contractor-business-identity-v1" }));
    expect(setCustomUserClaims).not.toHaveBeenCalled();
    expect(usersSet).not.toHaveBeenCalled();
  });

  it("adopts an existing contractor document when user contractorId is stale", async () => {
    const usersSet = jest.fn().mockResolvedValue(undefined);
    const contractorSet = jest.fn().mockResolvedValue(undefined);

    const db = {
      collection: jest.fn((name: string) => {
        if (name === "users") {
          return {
            doc: jest.fn(() => ({
              get: jest.fn().mockResolvedValue(
                createDocSnapshot("user-1", {
                  uid: "user-1",
                  email: "existing@example.com",
                  name: "Existing Contractor",
                  role: "contractor",
                  contractorId: "stale-id",
                  createdAt: 456,
                }),
              ),
              set: usersSet,
            })),
          };
        }

        if (name === "contractors") {
          return {
            doc: jest.fn((id: string) => ({
              get: jest.fn().mockResolvedValue(
                id === "existing-doc"
                  ? createDocSnapshot(id, {
                      contractorId: "existing-doc",
                      authUid: "user-1",
                      userId: "user-1",
                    })
                  : id === "stale-id"
                  ? createDocSnapshot(id)
                  : createDocSnapshot(id),
              ),
              set: contractorSet,
            })),
            where: jest.fn((field: string) => ({
              limit: jest.fn(() => ({
                get: jest.fn().mockResolvedValue(
                  field === "authUid"
                    ? {
                        docs: [
                          {
                            id: "existing-doc",
                            data: () => ({
                              contractorId: "existing-doc",
                              authUid: "user-1",
                              userId: "user-1",
                            }),
                          },
                        ],
                      }
                    : { docs: [] },
                ),
              })),
            })),
          };
        }

        throw new Error(`Unexpected collection ${name}`);
      }),
    };

    getFirebaseAdmin.mockReturnValue(db);
    getUser.mockResolvedValue({
      uid: "user-1",
      email: "existing@example.com",
      displayName: "Existing Contractor",
      customClaims: {
        role: "contractor",
        contractorId: "stale-id",
      },
    });

    const result = await ensureContractorAuthLinkage({
      uid: "user-1",
      source: "test",
      allowCreateMissingContractor: true,
    });

    expect(result.contractorId).toBe("existing-doc");
    expect(result.contractorProfileCreated).toBe(false);
    expect(usersSet).toHaveBeenCalledWith(
      expect.objectContaining({
        contractorId: "existing-doc",
      }),
      { merge: true },
    );
    expect(setCustomUserClaims).toHaveBeenCalledWith("user-1", {
      role: "contractor",
      contractorId: "existing-doc",
    });
    expect(contractorSet).toHaveBeenCalledWith(
      expect.objectContaining({
        contractorId: "existing-doc",
        authUid: "user-1",
        userId: "user-1",
      }),
      { merge: true },
    );
  });
});

describe("unresolved contractor linkage downstream invariants", () => {
  it("keeps unresolved linkage records out of selector, matching and assignment eligibility", () => {
    const unresolvedRecord = { id: "contractor-1", contractorId: "contractor-1", workspaceId: "workspace-a", identityResolved: false, identityStatus: "UNRESOLVED", readinessScore: 100, complianceStatusScore: 100, taxValid: true, csdValid: true, bbbeeValid: true, coidaValid: true, bankingValid: true };
    expect(buildContractorSelectorOption(unresolvedRecord)).toBeNull();
    const [match] = matchContractorsForOpportunity({ deal: { id: "deal-1", workspaceId: "workspace-a", category: "civil works", requirementsReview: { reviewed: true, taxRequirement: false, csdRequirement: false, bbbeeRequirement: false, coidaRequirement: false, bankingRequirement: false, compulsoryReturnables: [] } }, contractors: [unresolvedRecord] });
    expect(match.blockingReasons).toContain("Contractor identity is unresolved");
    expect(match.eligible).toBe(false);
    expect(match.assignmentAllowed).toBe(false);
    expect(match.matchScore).toBe(0);
  });

  it("allows later verified onboarding evidence to promote selector eligibility safely", () => {
    const unresolved = { contractorId: "contractor-1", workspaceId: "workspace-a", identityResolved: false, identityStatus: "UNRESOLVED", status: "identity_unresolved" };
    const verified = { ...unresolved, legalName: "Verified Civil Works Pty Ltd", identityResolved: true, identityStatus: "VERIFIED", status: "active" };
    expect(buildContractorSelectorOption(unresolved)).toBeNull();
    expect(buildContractorSelectorOption(verified)?.label).toBe("Verified Civil Works Pty Ltd");
  });
});
