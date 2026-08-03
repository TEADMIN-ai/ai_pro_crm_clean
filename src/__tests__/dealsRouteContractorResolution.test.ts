import { NextRequest } from "next/server";

const requireAuthorizedUser = jest.fn();
const resolveContractorReference = jest.fn();
const updateDeal = jest.fn();
let dealDocs: Array<{ id: string; data: () => Record<string, unknown> }> = [];

const db = {
  collection: jest.fn((collectionName: string) => {
    if (collectionName !== "deals") {
      throw new Error(`Unexpected collection ${collectionName}`);
    }

    return {
      get: jest.fn(async () => ({ docs: dealDocs })),
      doc: jest.fn(() => ({ update: updateDeal })),
    };
  }),
};

class MockAuthorizationError extends Error {
  status: number;

  constructor(message: string, status = 403) {
    super(message);
    this.status = status;
  }
}

jest.mock("@/lib/firebase/admin", () => ({
  getFirebaseAdmin: () => db,
}));

jest.mock("@/lib/server/authz", () => ({
  AuthorizationError: MockAuthorizationError,
  isPrivilegedRole: (role?: string) => role === "admin" || role === "manager" || role === "staff",
  requireAuthorizedUser: (...args: unknown[]) => requireAuthorizedUser(...args),
}));

jest.mock("@/lib/contractors/contractorReferenceResolver", () => ({
  getContractorBusinessName: (contractor: Record<string, unknown>) => contractor.companyName ?? "Linked contractor",
  resolveContractorReference: (...args: unknown[]) => resolveContractorReference(...args),
}));

jest.mock("@/lib/governance/emitter", () => ({
  emitGovernanceEvent: jest.fn(),
}));

jest.mock("@/lib/governance/observer", () => ({
  withGovernanceObservation:
    (_route: unknown, handler: (request: NextRequest, context: unknown, governanceContext: unknown) => Promise<Response>) =>
    (request: NextRequest, context: unknown) =>
      handler(request, context, {
        correlationId: "correlation-1",
        requestId: "request-1",
        route: { sourceName: "deals_get", routePath: "/api/deals", method: "GET" },
      }),
}));

import { GET } from "@/app/api/deals/route";

function makeDeal(id: string, data: Record<string, unknown>) {
  return {
    id,
    data: () => ({
      aiInsights: "fresh insights",
      aiInsightsUpdatedAt: Date.now(),
      contractorDocs: { tax: true, bbbee: true, cipc: true, coida: true },
      readinessScore: 100,
      riskLevel: "LOW",
      missingDocs: [],
      workspaceId: "workspace-a",
      ...data,
    }),
  };
}

function request() {
  return new NextRequest("http://localhost/api/deals");
}

describe("/api/deals contractor reference resolution", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    dealDocs = [];
    requireAuthorizedUser.mockResolvedValue({
      uid: "admin-1",
      email: "admin@example.test",
      role: "admin",
      workspaceId: "workspace-a",
    });
  });

  it("resolves legacy nested contractorAssignment references to canonical contractor fields", async () => {
    dealDocs = [
      makeDeal("deal-1", {
        contractorAssignment: { contractorId: "legacy-c" },
      }),
    ];
    resolveContractorReference.mockResolvedValue({
      ok: true,
      storedReference: "legacy-c",
      referenceType: "firestore_document_id",
      contractorId: "canonical-c",
      workspaceId: "workspace-a",
      contractor: { id: "canonical-c", companyName: "Canonical Contractor" },
    });

    const response = await GET(request());
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(resolveContractorReference).toHaveBeenCalledWith({
      reference: "legacy-c",
      actor: expect.objectContaining({ role: "admin", workspaceId: "workspace-a" }),
      expectedWorkspaceId: "workspace-a",
      dealId: "deal-1",
      logContext: "api.deals.list",
    });
    expect(payload.deals[0]).toEqual(
      expect.objectContaining({
        contractorId: "canonical-c",
        contractorName: "Canonical Contractor",
        storedContractorReference: "legacy-c",
        contractorReference: {
          status: "reference_present",
          field: "contractorAssignment.contractorId",
          value: "legacy-c",
        },
        contractorReferenceResolution: {
          status: "resolved",
          referenceField: "contractorAssignment.contractorId",
          referenceType: "firestore_document_id",
          contractorId: "canonical-c",
        },
      }),
    );
  });

  it("does not treat companyId as a contractor reference", async () => {
    dealDocs = [
      makeDeal("deal-1", {
        companyId: "company-c",
      }),
    ];

    const response = await GET(request());
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(resolveContractorReference).not.toHaveBeenCalled();
    expect(payload.deals[0].contractorId).toBeUndefined();
    expect(payload.deals[0].contractorName).toBeUndefined();
    expect(payload.deals[0].storedContractorReference).toBeNull();
    expect(payload.deals[0].contractorReferenceResolution).toEqual({ status: "none" });
  });

  it("blocks cross-workspace contractor references without exposing contractor data", async () => {
    dealDocs = [
      makeDeal("deal-1", {
        linkedContractorId: "other-workspace-c",
      }),
    ];
    resolveContractorReference.mockResolvedValue({
      ok: false,
      storedReference: "other-workspace-c",
      referenceType: "firestore_document_id",
      failureReason: "cross_workspace",
      candidateIds: ["other-workspace-c"],
    });

    const response = await GET(request());
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.deals[0].contractorId).toBeUndefined();
    expect(payload.deals[0].contractorName).toBeUndefined();
    expect(payload.deals[0].storedContractorReference).toBe("other-workspace-c");
    expect(payload.deals[0].contractorReferenceResolution).toEqual({
      status: "unresolved",
      referenceField: "linkedContractorId",
      failureReason: "cross_workspace",
    });
  });
});
