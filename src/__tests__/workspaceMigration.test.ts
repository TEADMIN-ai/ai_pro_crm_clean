const setMock = jest.fn();
const contractorGetMock = jest.fn();

jest.mock("@/lib/firebase/admin", () => ({
  getFirebaseAdmin: () => ({
    collection: (name: string) => {
      if (name === "users") {
        return {
          doc: () => ({
            set: setMock,
          }),
        };
      }

      if (name === "contractors") {
        return {
          doc: (contractorId: string) => ({
            get: () => contractorGetMock(contractorId),
          }),
        };
      }

      throw new Error(`Unexpected collection ${name}`);
    },
  }),
}));

import { buildUserProfile } from "@/lib/auth/userProfile";
import { migrateLegacyWorkspace, resolveLegacyWorkspace } from "@/lib/workspaces/workspaceMigration";

const WORKSPACES = {
  torqueEmpire: {
    id: "0bcd72d2-5f25-4c83-a1d2-8f8f1c5d9001",
    slug: "torque-empire",
    displayName: "Torque Empire",
    type: "TORQUE_EMPIRE",
    status: "ACTIVE",
  },
  roarCars: {
    id: "0bcd72d2-5f25-4c83-a1d2-8f8f1c5d9002",
    slug: "roar-cars",
    displayName: "Roar Cars SA",
    type: "ROAR_CARS",
    status: "ACTIVE",
  },
  hygiene: {
    id: "0bcd72d2-5f25-4c83-a1d2-8f8f1c5d9003",
    slug: "hygiene",
    displayName: "Torque Empire Hygiene",
    type: "HYGIENE",
    status: "ACTIVE",
  },
  partner: {
    id: "0bcd72d2-5f25-4c83-a1d2-8f8f1c5d9006",
    slug: "partner",
    displayName: "Partner Workspace",
    type: "PARTNER",
    status: "ACTIVE",
  },
} as const;

describe("workspace migration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setMock.mockResolvedValue(undefined);
    contractorGetMock.mockResolvedValue({ exists: false, data: () => null });
  });

  const representativeUsers = [
    { label: "admin", uid: "admin-1", data: { role: "admin", company: "Torque Empire" }, expected: WORKSPACES.torqueEmpire, source: "company" },
    { label: "staff", uid: "staff-1", data: { role: "staff", companyName: "Torque Empire Pty Ltd" }, expected: WORKSPACES.torqueEmpire, source: "company" },
    { label: "dealer", uid: "dealer-1", data: { role: "ROAR_CARS_STAFF", company: "Roar Cars SA" }, expected: WORKSPACES.roarCars, source: "company" },
    { label: "driver", uid: "driver-1", data: { role: "driver", company: "Torque Empire Hygiene" }, expected: WORKSPACES.hygiene, source: "company" },
    { label: "manager", uid: "manager-1", data: { role: "manager", workspaceSlug: "torque-empire" }, expected: WORKSPACES.torqueEmpire, source: "workspaceSlug" },
  ] as const;

  test.each(representativeUsers)("migrates representative legacy $label users once and writes workspace fields", async ({ uid, data, expected, source }) => {
    const first = await migrateLegacyWorkspace({
      uid,
      profile: buildUserProfile(data),
      profileData: data,
    });

    expect(first).toEqual(expect.objectContaining({
      migrated: true,
      workspace: expected,
      source,
      persisted: true,
    }));
    expect(setMock).toHaveBeenCalledTimes(1);
    expect(setMock).toHaveBeenCalledWith(
      expect.objectContaining({
        workspace: expected,
        workspaceId: expected.id,
        workspaceSlug: expected.slug,
        updatedAt: expect.any(String),
      }),
      { merge: true },
    );

    setMock.mockClear();

    const second = await migrateLegacyWorkspace({
      uid,
      profile: buildUserProfile({ ...data, workspace: expected, workspaceId: expected.id, workspaceSlug: expected.slug }),
      profileData: { ...data, workspace: expected, workspaceId: expected.id, workspaceSlug: expected.slug },
    });

    expect(second).toEqual(expect.objectContaining({
      migrated: false,
      workspace: expected,
      source: null,
      persisted: false,
    }));
    expect(setMock).not.toHaveBeenCalled();
  });

  test("migrates contractor users from the linked contractor canonical record", async () => {
    const contractorData = { companyName: "Partner Workspace" };
    contractorGetMock.mockResolvedValueOnce({
      exists: true,
      data: () => contractorData,
    });

    const result = await migrateLegacyWorkspace({
      uid: "contractor-user-1",
      profile: buildUserProfile({ role: "contractor", contractorId: "contractor-1" }),
      profileData: { role: "contractor", contractorId: "contractor-1" },
    });

    expect(contractorGetMock).toHaveBeenCalledWith("contractor-1");
    expect(result).toEqual(expect.objectContaining({
      migrated: true,
      workspace: WORKSPACES.partner,
      source: "contractor.company",
      persisted: true,
    }));
    expect(setMock).toHaveBeenCalledWith(
      expect.objectContaining({
        workspace: WORKSPACES.partner,
        workspaceId: WORKSPACES.partner.id,
        workspaceSlug: WORKSPACES.partner.slug,
        updatedAt: expect.any(String),
      }),
      { merge: true },
    );
  });

  test("resolves existing workspace records without migration persistence", async () => {
    const result = await resolveLegacyWorkspace({
      uid: "existing-user-1",
      profile: buildUserProfile({
        role: "staff",
        workspace: WORKSPACES.roarCars,
        workspaceId: WORKSPACES.roarCars.id,
        workspaceSlug: WORKSPACES.roarCars.slug,
      }),
      profileData: {
        role: "staff",
        workspace: WORKSPACES.roarCars,
        workspaceId: WORKSPACES.roarCars.id,
        workspaceSlug: WORKSPACES.roarCars.slug,
      },
    });

    expect(result).toEqual({ workspace: WORKSPACES.roarCars, source: "workspace" });
  });
});
