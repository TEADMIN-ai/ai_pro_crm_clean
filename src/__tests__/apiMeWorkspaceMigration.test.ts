const verifyIdTokenMock = jest.fn();
const users = new Map<string, Record<string, unknown>>();
const contractors = new Map<string, Record<string, unknown>>();
const userSetMock = jest.fn(async function set(this: { uid: string }, data: Record<string, unknown>) {
  users.set(this.uid, { ...(users.get(this.uid) ?? {}), ...data });
});

jest.mock("firebase-admin/auth", () => ({
  getAuth: () => ({
    verifyIdToken: verifyIdTokenMock,
  }),
}));

jest.mock("@/lib/firebase/admin", () => ({
  getFirebaseAdmin: () => ({
    collection: (name: string) => {
      if (name === "users") {
        return {
          doc: (uid: string) => ({
            get: async () => ({
              exists: users.has(uid),
              data: () => users.get(uid),
            }),
            set: userSetMock.bind({ uid }),
          }),
        };
      }

      if (name === "contractors") {
        return {
          doc: (contractorId: string) => ({
            get: async () => ({
              exists: contractors.has(contractorId),
              data: () => contractors.get(contractorId),
            }),
          }),
        };
      }

      throw new Error(`Unexpected collection ${name}`);
    },
  }),
}));

import { GET } from "@/app/api/me/route";

const TORQUE_WORKSPACE = {
  id: "0bcd72d2-5f25-4c83-a1d2-8f8f1c5d9001",
  slug: "torque-empire",
  displayName: "Torque Empire",
  type: "TORQUE_EMPIRE",
  status: "ACTIVE",
};

function request() {
  return new Request("http://localhost/api/me", {
    headers: { authorization: "Bearer test-token" },
  });
}

describe("/api/me workspace migration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    users.clear();
    contractors.clear();
  });

  test("first login migrates a representative legacy user and second login bypasses migration", async () => {
    users.set("manager-1", {
      role: "manager",
      company: "Torque Empire",
      email: "manager@example.com",
    });
    verifyIdTokenMock.mockResolvedValue({
      uid: "manager-1",
      email: "manager@example.com",
      role: "manager",
    });

    const firstResponse = await GET(request() as never);
    const firstPayload = await firstResponse.json();

    expect(firstResponse.status).toBe(200);
    expect(firstPayload.workspace).toEqual(TORQUE_WORKSPACE);
    expect(firstPayload.workspaceId).toBe(TORQUE_WORKSPACE.id);
    expect(firstPayload.workspaceSlug).toBe(TORQUE_WORKSPACE.slug);
    expect(userSetMock).toHaveBeenCalledTimes(1);
    expect(userSetMock).toHaveBeenCalledWith(
      expect.objectContaining({
        workspace: TORQUE_WORKSPACE,
        workspaceId: TORQUE_WORKSPACE.id,
        workspaceSlug: TORQUE_WORKSPACE.slug,
        updatedAt: expect.any(String),
      }),
      { merge: true },
    );

    userSetMock.mockClear();

    const secondResponse = await GET(request() as never);
    const secondPayload = await secondResponse.json();

    expect(secondResponse.status).toBe(200);
    expect(secondPayload.workspace).toEqual(TORQUE_WORKSPACE);
    expect(secondPayload.workspaceId).toBe(TORQUE_WORKSPACE.id);
    expect(secondPayload.workspaceSlug).toBe(TORQUE_WORKSPACE.slug);
    expect(userSetMock).not.toHaveBeenCalled();
  });
});
