import { NextRequest } from "next/server";

const requireAuthorizedUser = jest.fn();
const resolveContractorReference = jest.fn();
const generateFixSuggestions = jest.fn((input?: unknown) => {
  void input;
  return ["Upload missing evidence"];
});
const analyzeTenderText = jest.fn((input?: unknown) => {
  void input;
  return { requirements: {}, missing: [], score: 0, risk: "UNKNOWN" };
});
const emitGovernanceEvent = jest.fn();
const generateAIInsights = jest.fn();
const recalculateContractorCompliance = jest.fn();
const updateDeal = jest.fn();
const setDeal = jest.fn();
const addDeal = jest.fn();
const batchSet = jest.fn();
const batchUpdate = jest.fn();
const transactionSet = jest.fn();
const transactionUpdate = jest.fn();
let dealDocs: Array<{ id: string; data: () => Record<string, unknown> }> = [];

const getDeals = jest.fn(async () => ({ docs: dealDocs }));
const whereDeals = jest.fn(() => ({ get: getDeals }));

const db = {
  collection: jest.fn((collectionName: string) => {
    if (collectionName !== "deals") {
      throw new Error(`Unexpected collection ${collectionName}`);
    }

    return {
      get: getDeals,
      where: whereDeals,
      doc: jest.fn(() => ({ update: updateDeal, set: setDeal })),
      add: addDeal,
    };
  }),
  batch: jest.fn(() => ({ set: batchSet, update: batchUpdate, commit: jest.fn() })),
  runTransaction: jest.fn(async (callback: (transaction: { set: jest.Mock; update: jest.Mock }) => unknown) =>
    callback({ set: transactionSet, update: transactionUpdate }),
  ),
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

jest.mock("@/lib/engine/fixSuggestions", () => ({
  generateFixSuggestions: (input: unknown) => generateFixSuggestions(input),
}));

jest.mock("@/lib/tenderAnalysisService", () => ({
  analyzeTenderText: (input: unknown) => analyzeTenderText(input),
}));

jest.mock("@/lib/contractors/contractorReferenceResolver", () => ({
  getContractorBusinessName: (contractor: Record<string, unknown>) => contractor.companyName ?? "Linked contractor",
  resolveContractorReference: (...args: unknown[]) => resolveContractorReference(...args),
}));

jest.mock("@/lib/deals/contractorReference", () => ({
  getDealContractorReference: (data: Record<string, unknown>) => {
    const value = data.linkedContractorId ?? data.contractorId;
    return typeof value === "string" && value.trim()
      ? { status: "reference_present", field: data.linkedContractorId ? "linkedContractorId" : "contractorId", value }
      : { status: "no_reference" };
  },
}));

jest.mock("@/lib/governance/emitter", () => ({ emitGovernanceEvent }));
jest.mock("@/lib/ai/generateInsights", () => ({ generateAIInsights }));
jest.mock("@/lib/server/recalculateContractorCompliance", () => ({ recalculateContractorCompliance }));

import { GET } from "@/app/api/deals/route";

function makeDeal(id: string, data: Record<string, unknown>) {
  return {
    id,
    data: () => ({
      title: "Tender",
      description: "Cleaning tender",
      workspaceId: "workspace-a",
      contractorId: "contractor-a",
      ...data,
    }),
  };
}

function request() {
  return new NextRequest("http://localhost/api/deals");
}

function expectNoWrites() {
  expect(updateDeal).not.toHaveBeenCalled();
  expect(setDeal).not.toHaveBeenCalled();
  expect(addDeal).not.toHaveBeenCalled();
  expect(batchSet).not.toHaveBeenCalled();
  expect(batchUpdate).not.toHaveBeenCalled();
  expect(transactionSet).not.toHaveBeenCalled();
  expect(transactionUpdate).not.toHaveBeenCalled();
  expect(emitGovernanceEvent).not.toHaveBeenCalled();
  expect(generateAIInsights).not.toHaveBeenCalled();
  expect(recalculateContractorCompliance).not.toHaveBeenCalled();
}

describe("GET /api/deals read-only behaviour", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    dealDocs = [];
    requireAuthorizedUser.mockResolvedValue({
      uid: "admin-1",
      email: "admin@example.test",
      role: "admin",
      workspaceId: "workspace-a",
    });
    resolveContractorReference.mockResolvedValue({
      ok: true,
      storedReference: "contractor-a",
      referenceType: "firestore_document_id",
      contractorId: "contractor-a",
      workspaceId: "workspace-a",
      contractor: { id: "contractor-a", companyName: "Contractor A" },
    });
  });

  it("returns deals without Firestore, AI, recomputation, governance, batch or transaction writes", async () => {
    dealDocs = [
      makeDeal("deal-1", {
        readinessScore: 40,
        riskLevel: "HIGH",
        missingDocs: ["sarsTcs"],
        aiInsights: "stored insight",
      }),
    ];

    const response = await GET(request());
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.deals[0]).toEqual(expect.objectContaining({
      id: "deal-1",
      contractorId: "contractor-a",
      contractorName: "Contractor A",
      aiInsights: "stored insight",
      missingDocs: ["sarsTcs"],
    }));
    expect(payload.deals[0].readinessProjection).toEqual(expect.objectContaining({
      source: "stored_snapshot",
      status: "BLOCKED",
      readinessScore: null,
      assignmentAllowed: false,
      eligible: false,
    }));
    expect(generateFixSuggestions).toHaveBeenCalled();
    expectNoWrites();
  });

  it("leaves stale readiness unresolved instead of silently repairing it to 100", async () => {
    dealDocs = [makeDeal("deal-1", { readinessScore: 100, riskLevel: "LOW", missingDocs: [] })];

    const response = await GET(request());
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.deals[0].readinessScore).toBeNull();
    expect(payload.deals[0].readinessProjection).toEqual(expect.objectContaining({
      status: "STALE",
      readinessScore: null,
      assignmentAllowed: false,
    }));
    expectNoWrites();
  });

  it("projects a current stored snapshot for display without authorising assignment", async () => {
    dealDocs = [
      makeDeal("deal-1", {
        readinessScore: 82,
        riskLevel: "LOW",
        missingDocs: [],
        readinessUpdatedAt: "2026-08-03T00:00:00.000Z",
        readinessLogicVersion: "v1",
      }),
    ];

    const response = await GET(request());
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.deals[0].readinessScore).toBe(82);
    expect(payload.deals[0].readinessProjection).toEqual(expect.objectContaining({
      status: "STALE",
      readinessScore: 82,
      assignmentAllowed: false,
      eligible: false,
    }));
    expectNoWrites();
  });

  it("keeps missing readiness evidence unknown and non-eligible", async () => {
    dealDocs = [makeDeal("deal-1", { readinessScore: undefined, missingDocs: [] })];

    const response = await GET(request());
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.deals[0].readinessScore).toBeNull();
    expect(payload.deals[0].readinessProjection).toEqual(expect.objectContaining({
      status: "UNKNOWN",
      assignmentAllowed: false,
      eligible: false,
    }));
    expect(generateFixSuggestions).not.toHaveBeenCalled();
    expectNoWrites();
  });

  it("preserves contractor role filtering", async () => {
    requireAuthorizedUser.mockResolvedValue({
      uid: "user-a",
      role: "contractor",
      contractorId: "contractor-a",
      workspaceId: "workspace-a",
    });
    dealDocs = [makeDeal("deal-1", { readinessScore: undefined, missingDocs: [] })];

    const response = await GET(request());

    expect(response.status).toBe(200);
    expect(whereDeals).toHaveBeenCalledWith("contractorId", "==", "contractor-a");
    expectNoWrites();
  });

  it("does not expose raw submitted status as canonical workflow phase", async () => {
    dealDocs = [makeDeal("deal-1", { status: "submitted", stage: "submitted", opportunityExecution: { submitted: true, readyForSubmission: true } })];

    const response = await GET(request());
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.deals[0].status).toBe("submitted");
    expect(payload.deals[0].legacyStatus).toBe("submitted");
    expect(payload.deals[0].workflowPhase).toBe("READY_FOR_SUBMISSION");
    expect(payload.deals[0].workflowPhase).not.toBe("submitted");
    expectNoWrites();
  });

  it("returns SUBMITTED from valid governed submission provenance", async () => {
    dealDocs = [makeDeal("deal-1", { status: "submitted", opportunityExecution: { submissionCompletionProvenance: { action: "record_submission", status: "SUBMITTED", completedAt: "2026-08-21T16:00:00.000Z", completedBy: "manager-1", clientQuoteId: "CQ-1", tenderPackDocumentId: "MDOC-TP-1", submissionEvidenceDocumentId: "SE-1" } } })];

    const response = await GET(request());
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.deals[0]).toEqual(expect.objectContaining({ status: "submitted", legacyStatus: "submitted", workflowPhase: "SUBMITTED" }));
    expectNoWrites();
  });

  it("returns controlled errors without exposing stack traces", async () => {
    getDeals.mockRejectedValueOnce(new Error("internal stack detail"));

    const response = await GET(request());
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload).toEqual({ error: "Failed to fetch deals" });
    expect(JSON.stringify(payload)).not.toContain("internal stack detail");
    expectNoWrites();
  });

  it("is idempotent across repeated GET requests", async () => {
    dealDocs = [makeDeal("deal-1", { readinessScore: undefined, missingDocs: [] })];

    const first = await GET(request());
    const second = await GET(request());

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expectNoWrites();
  });
});
