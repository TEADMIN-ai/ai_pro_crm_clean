const requireAuthorizedUser = jest.fn();
const documentGet = jest.fn();
const getSignedUrl = jest.fn();
const storageObjectExists = jest.fn();
const storageBucketFile = jest.fn();

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
    file: (...args: unknown[]) => storageBucketFile(...args),
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
    storageBucketFile.mockReturnValue({ exists: storageObjectExists, getSignedUrl });
    storageObjectExists.mockResolvedValue([true]);
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
    expect(documentGet).not.toHaveBeenCalled();
    expect(storageBucketFile).not.toHaveBeenCalled();
    expect(storageObjectExists).not.toHaveBeenCalled();
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
    expect(storageBucketFile).toHaveBeenCalledWith("contractors/target-contractor/cipc_123.pdf");
    expect(storageObjectExists).toHaveBeenCalledTimes(1);
    expect(getSignedUrl).toHaveBeenCalledTimes(1);
    expect(storageObjectExists.mock.invocationCallOrder[0]).toBeLessThan(getSignedUrl.mock.invocationCallOrder[0]);
    const options = getSignedUrl.mock.calls[0][0];
    expect(options.action).toBe("read");
    expect(options.expires).toBeGreaterThanOrEqual(before + 5 * 60 * 1000);
    expect(options.expires).toBeLessThanOrEqual(after + 5 * 60 * 1000);
  });
});

describe("contractor document download retrieval for manual-review uploads", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    storageBucketFile.mockReturnValue({ exists: storageObjectExists, getSignedUrl });
    storageObjectExists.mockResolvedValue([true]);
    getSignedUrl.mockResolvedValue(["https://signed.example/csd.pdf"]);
  });

  test("creates a signed URL for an uploaded CSD document even though extraction is unsupported", async () => {
    requireAuthorizedUser.mockResolvedValue({
      uid: "user-1",
      role: "contractor",
      contractorId: "target-contractor",
    });
    documentGet.mockResolvedValue({
      exists: true,
      data: () => ({
        storagePath: "contractors/target-contractor/csd_123.pdf",
      }),
    });

    const response = await GET(new Request("http://localhost/download?format=json") as never, {
      params: Promise.resolve({ contractorId: "target-contractor", documentType: "csd" }),
    });
    const payload = (await response.json()) as { success?: boolean; url?: string; documentType?: string };

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      success: true,
      url: "https://signed.example/csd.pdf",
      documentType: "csd",
    });
    expect(storageBucketFile).toHaveBeenCalledWith("contractors/target-contractor/csd_123.pdf");
    expect(storageObjectExists).toHaveBeenCalledTimes(1);
    expect(getSignedUrl).toHaveBeenCalledTimes(1);
  });

  test("still rejects document types that are not upload-supported", async () => {
    requireAuthorizedUser.mockResolvedValue({
      uid: "user-1",
      role: "contractor",
      contractorId: "target-contractor",
    });

    const response = await GET(new Request("http://localhost/download") as never, {
      params: Promise.resolve({ contractorId: "target-contractor", documentType: "passport" }),
    });

    expect(response.status).toBe(400);
    expect(documentGet).not.toHaveBeenCalled();
    expect(storageBucketFile).not.toHaveBeenCalled();
    expect(storageObjectExists).not.toHaveBeenCalled();
    expect(getSignedUrl).not.toHaveBeenCalled();
  });
});
