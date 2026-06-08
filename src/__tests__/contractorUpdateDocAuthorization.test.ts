const requireAuthorizedUser = jest.fn();
const contractorSet = jest.fn();
const auditAdd = jest.fn();
const extractTextFromPdf = jest.fn();
const validateDocument = jest.fn();

jest.mock("@/lib/server/authz", () => {
  const actual = jest.requireActual("@/lib/server/authz");
  return {
    ...actual,
    requireAuthorizedUser: (...args: unknown[]) => requireAuthorizedUser(...args),
  };
});

jest.mock("@/lib/firebase/admin", () => ({
  getFirebaseAdmin: () => ({
    collection: (name: string) => {
      if (name === "contractors") {
        return {
          doc: () => ({
            get: jest.fn().mockResolvedValue({
              data: () => ({ documents: {} }),
            }),
            set: contractorSet,
          }),
        };
      }

      if (name === "contractorComplianceAudit") {
        return {
          add: auditAdd,
        };
      }

      throw new Error(`Unexpected collection ${name}`);
    },
  }),
}));

jest.mock("@/lib/documents/extractTextFromPdf", () => ({
  extractTextFromPdf: (...args: unknown[]) => extractTextFromPdf(...args),
}));

jest.mock("@/lib/documents/validateCompliance", () => ({
  validateDocument: (...args: unknown[]) => validateDocument(...args),
}));

import { POST } from "@/app/api/contractors/[contractorId]/update-doc/route";

function createRequest() {
  const formData = new FormData();
  formData.set("docType", "cipc");
  formData.set("file", new File(["%PDF-1.4"], "cipc.pdf", { type: "application/pdf" }));

  return new Request("http://localhost/api/contractors/target-contractor/update-doc", {
    method: "POST",
    body: formData,
  });
}

describe("contractor update-doc authorization", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    extractTextFromPdf.mockResolvedValue("registration certificate");
    validateDocument.mockReturnValue({
      valid: true,
      issues: [],
      extracted: {},
    });
  });

  test("rejects a contractor updating another contractor document", async () => {
    requireAuthorizedUser.mockResolvedValue({
      uid: "user-1",
      email: "one@example.com",
      role: "contractor",
      contractorId: "own-contractor",
    });

    const response = await POST(createRequest() as never, {
      params: Promise.resolve({ contractorId: "target-contractor" }),
    });

    expect(response.status).toBe(403);
    expect(contractorSet).not.toHaveBeenCalled();
    expect(auditAdd).not.toHaveBeenCalled();
    expect(extractTextFromPdf).not.toHaveBeenCalled();
  });

  test("allows a contractor updating their own document", async () => {
    requireAuthorizedUser.mockResolvedValue({
      uid: "user-1",
      email: "one@example.com",
      role: "contractor",
      contractorId: "target-contractor",
    });

    const response = await POST(createRequest() as never, {
      params: Promise.resolve({ contractorId: "target-contractor" }),
    });

    expect(response.status).toBe(200);
    expect(contractorSet).toHaveBeenCalledTimes(1);
    expect(auditAdd).toHaveBeenCalledTimes(1);
  });

  test("allows staff to update contractor documents through the server route", async () => {
    requireAuthorizedUser.mockResolvedValue({
      uid: "staff-1",
      email: "staff@example.com",
      role: "staff",
    });

    const response = await POST(createRequest() as never, {
      params: Promise.resolve({ contractorId: "target-contractor" }),
    });

    expect(response.status).toBe(200);
    expect(contractorSet).toHaveBeenCalledTimes(1);
    expect(auditAdd).toHaveBeenCalledTimes(1);
  });
});
