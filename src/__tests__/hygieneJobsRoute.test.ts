import { GET, POST } from "@/app/api/hygiene/jobs/route";
import { HygieneWorkflowError } from "@/lib/hygiene/hygieneService";
import { AuthorizationError, requireAuthorizedUser } from "@/lib/server/authz";
import {
  completeHygieneDriverAction,
  getHygieneMobileJobs,
} from "@/lib/hygiene/hygieneService";

jest.mock("@/lib/server/authz", () => {
  class AuthorizationError extends Error {
    status: number;

    constructor(message: string, status = 403) {
      super(message);
      this.name = "AuthorizationError";
      this.status = status;
    }
  }

  return {
    AuthorizationError,
    requireAuthorizedUser: jest.fn(),
  };
});

jest.mock("@/lib/firebase/admin", () => ({
  getFirebaseStorageBucket: jest.fn(),
}));

jest.mock("@/lib/hygiene/hygieneService", () => {
  class HygieneWorkflowError extends Error {
    status: number;
    code: string;

    constructor(message: string, status = 409, code = "hygiene_workflow_conflict") {
      super(message);
      this.name = "HygieneWorkflowError";
      this.status = status;
      this.code = code;
    }
  }

  return {
    HygieneWorkflowError,
    completeHygieneDriverAction: jest.fn(),
    createHygieneSignature: jest.fn(),
    generateHygieneManifest: jest.fn(),
    getHygieneMobileJobs: jest.fn(),
  };
});

const user = {
  uid: "admin-1",
  email: "admin@example.test",
  role: "admin" as const,
};

function jsonRequest(body: Record<string, unknown>) {
  return {
    json: jest.fn().mockResolvedValue(body),
  } as never;
}

describe("/api/hygiene/jobs", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "warn").mockImplementation(() => undefined);
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    (requireAuthorizedUser as jest.Mock).mockResolvedValue(user);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("returns mobile jobs for an authorized production user", async () => {
    (getHygieneMobileJobs as jest.Mock).mockResolvedValue({
      collections: [{ collectionId: "TE-COL-1" }],
      clients: [{ clientId: "CBAVO" }],
    });

    const response = await GET({} as never);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data.collections).toHaveLength(1);
  });

  it("maps workflow step conflicts to 409 instead of 500", async () => {
    (completeHygieneDriverAction as jest.Mock).mockRejectedValue(
      new HygieneWorkflowError(
        "Cannot complete disposal facility confirmation before job completed.",
        409,
        "hygiene_workflow_step_conflict"
      )
    );

    const response = await POST(jsonRequest({
      action: "confirm-disposal",
      collectionId: "TE-COL-1",
    }));
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload.code).toBe("hygiene_workflow_step_conflict");
    expect(payload.error).toContain("Cannot complete disposal facility confirmation");
  });

  it("maps missing workflow collections to 404", async () => {
    (completeHygieneDriverAction as jest.Mock).mockRejectedValue(
      new HygieneWorkflowError("Hygiene collection does not exist: TE-COL-MISSING", 404, "hygiene_collection_not_found")
    );

    const response = await POST(jsonRequest({
      action: "accept-job",
      collectionId: "TE-COL-MISSING",
    }));
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload.code).toBe("hygiene_collection_not_found");
  });

  it("returns 400 for invalid request payloads", async () => {
    const response = await POST(jsonRequest({ collectionId: "TE-COL-1" }));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.code).toBe("hygiene_request_invalid");
    expect(completeHygieneDriverAction).not.toHaveBeenCalled();
  });

  it("returns 401 for unauthenticated requests", async () => {
    (requireAuthorizedUser as jest.Mock).mockRejectedValue(new AuthorizationError("unauthorized", 401));

    const response = await GET({} as never);
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload.error).toBe("unauthorized");
  });
});
