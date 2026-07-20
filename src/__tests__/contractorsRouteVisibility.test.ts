import { NextRequest } from "next/server";

const requireAuthorizedUser = jest.fn();
const listContractors = jest.fn();

class MockAuthorizationError extends Error {
  status: number;

  constructor(message: string, status = 403) {
    super(message);
    this.status = status;
  }
}

jest.mock("firebase-admin/auth", () => ({ getAuth: jest.fn() }));

jest.mock("@/lib/server/authz", () => ({
  AuthorizationError: MockAuthorizationError,
  assertPrivilegedRole: (user: { role?: string }) => {
    if (!["admin", "manager", "staff"].includes(user.role ?? "")) {
      throw new MockAuthorizationError("unauthorized", 403);
    }
  },
  requireAuthorizedUser: (...args: unknown[]) => requireAuthorizedUser(...args),
}));

jest.mock("@/server/services/contractorService", () => ({
  listContractors: (...args: unknown[]) => listContractors(...args),
}));

jest.mock("@/lib/firebase/admin", () => ({ getFirebaseAdmin: jest.fn() }));
jest.mock("@/lib/contractors/contractorAuthLink", () => ({ ensureContractorAuthLinkage: jest.fn() }));
jest.mock("@/lib/email/contractorOnboardingEmail", () => ({ sendContractorOnboardingEmail: jest.fn() }));

import { GET } from "@/app/api/contractors/route";

function request(url: string) {
  return new NextRequest(url);
}

describe("/api/contractors visibility scope", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("passes the actor workspace and ignores caller-supplied workspace parameters", async () => {
    requireAuthorizedUser.mockResolvedValue({ uid: "admin-1", role: "admin", workspaceId: "workspace-a" });
    listContractors.mockResolvedValue([{ id: "contractor-a", companyName: "Production Contractor" }]);

    const response = await GET(request("http://localhost/api/contractors?workspaceId=workspace-b&includeArchived=true&includeNonProduction=true&includeLegacyUnassigned=true"));

    expect(response.status).toBe(200);
    expect(listContractors).toHaveBeenCalledWith({
      workspaceId: "workspace-a",
      actorRole: "admin",
      includeArchived: true,
      includeNonProduction: true,
      includeLegacyUnassigned: true,
    });
  });

  test("restricts non-production and archive include flags to admins", async () => {
    requireAuthorizedUser.mockResolvedValue({ uid: "manager-1", role: "manager", workspaceId: "workspace-a" });
    listContractors.mockResolvedValue([]);

    const response = await GET(request("http://localhost/api/contractors?includeArchived=true&includeNonProduction=true&includeLegacyUnassigned=true"));

    expect(response.status).toBe(200);
    expect(listContractors).toHaveBeenCalledWith({
      workspaceId: "workspace-a",
      actorRole: "manager",
      includeArchived: false,
      includeNonProduction: false,
      includeLegacyUnassigned: false,
    });
  });

  test("rejects requests without canonical workspace context", async () => {
    requireAuthorizedUser.mockResolvedValue({ uid: "staff-1", role: "staff" });

    const response = await GET(request("http://localhost/api/contractors"));

    expect(response.status).toBe(403);
    expect(listContractors).not.toHaveBeenCalled();
  });

  test("does not return fallback demo contractors when the repository fails", async () => {
    requireAuthorizedUser.mockResolvedValue({ uid: "staff-1", role: "staff", workspaceId: "workspace-a" });
    listContractors.mockRejectedValue(new Error("Firestore unavailable"));

    const response = await GET(request("http://localhost/api/contractors"));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(JSON.stringify(body)).not.toContain("demo");
    expect(JSON.stringify(body)).not.toContain("mock");
    expect(JSON.stringify(body)).not.toContain("contractor-1");
  });
});
