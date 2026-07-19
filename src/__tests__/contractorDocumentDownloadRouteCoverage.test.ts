const requireAuthorizedUser = jest.fn();
const documentGet = jest.fn();
const storageObjectExists = jest.fn();
const getSignedUrl = jest.fn();
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

describe("contractor document download route coverage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    requireAuthorizedUser.mockResolvedValue({
      uid: "user-1",
      role: "contractor",
      contractorId: "target-contractor",
    });
    storageBucketFile.mockReturnValue({ exists: storageObjectExists, getSignedUrl });
    storageObjectExists.mockResolvedValue([true]);
    getSignedUrl.mockResolvedValue(["https://signed.example/document.pdf"]);
  });

  test.each(["cipc", "bbbee", "taxClearance", "coida", "bankConfirmation", "csd", "cidb"])(
    "creates signed URLs for every upload-supported contractor document type: %s",
    async (documentType) => {
      documentGet.mockResolvedValue({
        exists: true,
        data: () => ({
          storagePath: `contractors/target-contractor/${documentType}_123.pdf`,
        }),
      });

      const response = await GET(new Request("http://localhost/download?format=json") as never, {
        params: Promise.resolve({ contractorId: "target-contractor", documentType }),
      });
      const payload = (await response.json()) as { success?: boolean; url?: string; documentType?: string };

      expect(response.status).toBe(200);
      expect(payload).toMatchObject({
        success: true,
        url: "https://signed.example/document.pdf",
        documentType,
      });
      expect(storageBucketFile).toHaveBeenCalledWith(`contractors/target-contractor/${documentType}_123.pdf`);
      expect(storageObjectExists).toHaveBeenCalledTimes(1);
      expect(getSignedUrl).toHaveBeenCalledTimes(1);
    },
  );

  test("returns a controlled error when the Firestore document record is missing", async () => {
    documentGet.mockResolvedValue({ exists: false, data: () => ({}) });

    const response = await GET(new Request("http://localhost/download?format=json") as never, {
      params: Promise.resolve({ contractorId: "target-contractor", documentType: "bbbee" }),
    });
    const payload = (await response.json()) as { error?: string };

    expect(response.status).toBe(404);
    expect(payload.error).toBe("Document not found");
    expect(storageBucketFile).not.toHaveBeenCalled();
    expect(storageObjectExists).not.toHaveBeenCalled();
    expect(getSignedUrl).not.toHaveBeenCalled();
  });

  test("returns a controlled error when the Firebase Storage object is missing", async () => {
    documentGet.mockResolvedValue({
      exists: true,
      data: () => ({ storagePath: "contractors/target-contractor/cidb_123.pdf" }),
    });
    storageObjectExists.mockResolvedValue([false]);

    const response = await GET(new Request("http://localhost/download?format=json") as never, {
      params: Promise.resolve({ contractorId: "target-contractor", documentType: "cidb" }),
    });
    const payload = (await response.json()) as { error?: string };

    expect(response.status).toBe(404);
    expect(payload.error).toBe("Document storage object not found");
    expect(storageBucketFile).toHaveBeenCalledWith("contractors/target-contractor/cidb_123.pdf");
    expect(storageObjectExists).toHaveBeenCalledTimes(1);
    expect(getSignedUrl).not.toHaveBeenCalled();
  });
});
