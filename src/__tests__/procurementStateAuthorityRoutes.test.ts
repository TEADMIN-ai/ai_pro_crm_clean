const requireAuthorizedUser = jest.fn();
const assertPrivilegedRole = jest.fn();
const applyOpportunityExecutionAction = jest.fn();
const getFirebaseAdmin = jest.fn();
const getFirebaseStorageBucket = jest.fn();
const resendSend = jest.fn();

process.env.RESEND_API_KEY = "test-resend-key";

class MockAuthorizationError extends Error {
  status: number;

  constructor(message: string, status = 403) {
    super(message);
    this.status = status;
  }
}

jest.mock("@/lib/server/authz", () => ({
  AuthorizationError: MockAuthorizationError,
  assertPrivilegedRole: (...args: unknown[]) => assertPrivilegedRole(...args),
  requireAuthorizedUser: (...args: unknown[]) => requireAuthorizedUser(...args),
}));

jest.mock("@/server/services/opportunityExecutionService", () => ({
  applyOpportunityExecutionAction: (...args: unknown[]) => applyOpportunityExecutionAction(...args),
}));

jest.mock("@/lib/firebase/admin", () => ({
  getFirebaseAdmin: (...args: unknown[]) => getFirebaseAdmin(...args),
  getFirebaseStorageBucket: (...args: unknown[]) => getFirebaseStorageBucket(...args),
}));

jest.mock("@/lib/corporate/companyProfile", () => ({
  getCorporateFromAddress: () => "support@example.test",
}));

jest.mock("resend", () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: { send: resendSend },
  })),
}));

import { POST as submitDeal } from "@/app/api/deals/submit/route";
import { POST as sendTenderPack } from "@/app/api/tender-pack/send/route";

function jsonRequest(body: Record<string, unknown>) {
  return {
    json: jest.fn().mockResolvedValue(body),
  } as never;
}

const actor = {
  uid: "admin-1",
  email: "admin@example.test",
  role: "admin",
  workspaceId: "workspace-a",
};

describe("procurement state authority routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    requireAuthorizedUser.mockResolvedValue(actor);
    assertPrivilegedRole.mockImplementation(() => undefined);
  });

  it("routes legacy submit through the opportunity execution authority", async () => {
    applyOpportunityExecutionAction.mockResolvedValue({ state: { currentPhase: "SUBMITTED" } });

    const response = await submitDeal(jsonRequest({
      dealId: "deal-1",
      submission: { tenderPackId: "TP-1", submissionDocumentId: "DOC-1" },
    }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(applyOpportunityExecutionAction).toHaveBeenCalledWith({
      dealId: "deal-1",
      action: "record_submission",
      actor,
      submission: { tenderPackId: "TP-1", submissionDocumentId: "DOC-1" },
    });
  });

  it("returns the authority rejection when legacy submit has no durable evidence", async () => {
    applyOpportunityExecutionAction.mockRejectedValue(Object.assign(new Error("Durable submission evidence is required"), { status: 409 }));

    const response = await submitDeal(jsonRequest({ dealId: "deal-1", uiConfirmed: true }));
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload.error).toBe("Durable submission evidence is required");
  });

  it("rejects arbitrary client PDF tender-pack delivery before Firestore or email side effects", async () => {
    const response = await sendTenderPack(jsonRequest({
      dealId: "deal-1",
      tenderPackId: "TP-1",
      email: "client@example.test",
      pdfBase64: "JVBERi0xLjQ=",
    }));
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload.error).toContain("Client-supplied PDF content is not accepted");
    expect(getFirebaseAdmin).not.toHaveBeenCalled();
    expect(getFirebaseStorageBucket).not.toHaveBeenCalled();
    expect(resendSend).not.toHaveBeenCalled();
  });
});
