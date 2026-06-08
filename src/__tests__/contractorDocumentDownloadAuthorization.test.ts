const requireAuthorizedUser = jest.fn();
const documentGet = jest.fn();
const getSignedUrl = jest.fn();

jest.mock("@/lib/server/authz", () => {
  const actual = jest.requireActual("@/lib/server/authz");
  return {
    ...actual,
    requireAuthorizedUser: (...args: unknown[]) => requireAuthorizedUser(...args),
  };
});

jest.mock("@/lib/firebase/admin", () => ({
  getFirebaseAdmin: () => ({
    collection: () => ({
      doc: () => ({
        collection: () => ({
          doc: () => ({
            get: documentGet,
          }),
        }),
      }),
    }),
  }),
  getFirebaseStorageBucket: () => ({
    file: () => ({
      getSignedUrl,
    }),
  }),
}));

import { GET } from "@/app/api/contractors/[contractorId]/documents/[documentType]/download/route";

describe("contractor document download authorization", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    documentGet.mockResolvedValue({
      exists: true,
      data: () => ({
        storagePath: "contractors/target-contractor/cipc_123.pdf",
      }),
    });
    getSignedUrl.mockResolvedValue(["https://signed.example/cipc.pdf"]);
  });

  test("rejects another contractor before creating a signed URL", async () => {
    requireAuthorizedUser.mockResolvedValue({
      uid: "user-1",
      role: "contractor",
      contractorId: "own-contractor",
    });

    const response = await GET(new Request("http://localhost/download") as never, {
      params: Promise.resolve({ contractorId: "target-contractor", documentType: "cipc" }),
    });

    expect(response.status).toBe(403);
    expect(getSignedUrl).not.toHaveBeenCalled();
  });

  test("creates a short-lived signed URL for an authorized contractor", async () => {
    requireAuthorizedUser.mockResolvedValue({
      uid: "user-1",
      role: "contractor",
      contractorId: "target-contractor",
    });

    const before = Date.now();
    const response = await GET(new Request("http://localhost/download") as never, {
      params: Promise.resolve({ contractorId: "target-contractor", documentType: "cipc" }),
    });
    const after = Date.now();

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("https://signed.example/cipc.pdf");
    expect(getSignedUrl).toHaveBeenCalledTimes(1);
    const options = getSignedUrl.mock.calls[0][0];
    expect(options.action).toBe("read");
    expect(options.expires).toBeGreaterThanOrEqual(before + 5 * 60 * 1000);
    expect(options.expires).toBeLessThanOrEqual(after + 5 * 60 * 1000);
  });
});
