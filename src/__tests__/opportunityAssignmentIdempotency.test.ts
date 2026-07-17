const getFirebaseAdmin = jest.fn();
const listContractors = jest.fn();
const resolveContractorReference = jest.fn();

jest.mock("@/lib/firebase/admin", () => ({
  getFirebaseAdmin: () => getFirebaseAdmin(),
}));

jest.mock("@/server/services/contractorService", () => ({
  listContractors: () => listContractors(),
}));

jest.mock("@/lib/contractors/contractorReferenceResolver", () => ({
  getContractorBusinessName: (contractor: Record<string, unknown>) => contractor.companyName ?? contractor.id,
  resolveContractorReference: (input: unknown) => resolveContractorReference(input),
}));

import { applyOpportunityExecutionAction } from "@/server/services/opportunityExecutionService";

type Store = Record<string, Record<string, Record<string, unknown>>>;

const actor = { uid: "staff-1", email: "staff@example.com", role: "staff" as const };
const baseDeal = {
  id: "deal-1",
  title: "Cleaning RFQ",
  companyId: "unassigned",
  stage: "lead",
  status: "draft",
  category: "cleaning",
  workspaceId: "workspace-a",
  closingDate: "2026-08-01T11:00:00",
  rfqNumber: "RFQ-1",
  clientName: "City",
  municipalityName: "Cape Town",
  opportunityExecution: { requirementsReviewed: true, requirements: { reviewed: true } },
  tenderAnalysis: { requiredCertificates: ["Tax compliance"], location: "Western Cape" },
  documents: [{ documentType: "rfq", name: "RFQ.pdf" }],
};
const contractorOne = { id: "c1", contractorId: "c1", companyName: "Clean Co", workspaceId: "workspace-a", taxValid: true, readinessScore: 90 };
const contractorTwo = { id: "c2", contractorId: "c2", companyName: "Build Co", workspaceId: "workspace-a", taxValid: true, readinessScore: 88 };

function snapshot(id: string, data?: Record<string, unknown>) {
  return { id, exists: Boolean(data), data: () => data };
}

function createDb(initial: Store) {
  const store: Store = structuredClone(initial);
  const writes: string[] = [];
  const readCollection = (path: string) => store[path] ?? {};
  const writeDoc = (path: string, id: string, data: Record<string, unknown>, merge = false) => {
    store[path] = store[path] ?? {};
    store[path][id] = merge ? { ...(store[path][id] ?? {}), ...data } : data;
    writes.push(`${path}/${id}`);
  };
  const makeCollection = (path: string) => ({
    doc: (id: string) => {
      const docRef = {
        get: jest.fn().mockImplementation(async () => snapshot(id, readCollection(path)[id])),
        set: jest.fn().mockImplementation(async (data: Record<string, unknown>, options?: { merge?: boolean }) => writeDoc(path, id, data, options?.merge)),
        collection: (name: string) => makeCollection(`${path}/${id}/${name}`),
      };
      return docRef;
    },
    add: jest.fn().mockImplementation(async (data: Record<string, unknown>) => {
      const id = `auto-${Object.keys(readCollection(path)).length + 1}`;
      writeDoc(path, id, data, false);
      return { id };
    }),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    get: jest.fn().mockImplementation(async () => ({
      docs: Object.entries(readCollection(path)).map(([id, data]) => snapshot(id, data)),
    })),
  });
  return { collection: jest.fn((name: string) => makeCollection(name)), store, writes };
}

describe("opportunity contractor assignment idempotency", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-07-17T10:00:00.000Z"));
    getFirebaseAdmin.mockReset();
    listContractors.mockReset().mockResolvedValue([contractorOne, contractorTwo]);
    resolveContractorReference.mockReset().mockImplementation(async ({ reference }: { reference: string }) => {
      const contractor = reference === "c2" ? contractorTwo : contractorOne;
      return { ok: true, storedReference: reference, referenceType: "firestore_document_id", contractorId: contractor.id, workspaceId: "workspace-a", contractor };
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  function seedDb() {
    return createDb({
      users: { "staff-1": { workspaceId: "workspace-a" } },
      deals: { "deal-1": baseDeal },
      contractors: { c1: contractorOne, c2: contractorTwo },
      opportunityExecutionWorkspaces: {},
      submissionReviews: {},
      auditLogs: {},
      "deals/deal-1/activity": {},
    });
  }

  test("retrying the same assignment preserves createdAt and does not duplicate activity or audit entries", async () => {
    const db = seedDb();
    getFirebaseAdmin.mockReturnValue(db);

    const first = await applyOpportunityExecutionAction({ dealId: "deal-1", action: "assign_contractor", actor, contractorId: "c1" });
    const firstWorkspace = db.store.opportunityExecutionWorkspaces["deal-1"];
    const firstReview = db.store.submissionReviews["deal-1"];
    const firstAssignment = db.store.deals["deal-1"].contractorAssignment as Record<string, unknown>;

    jest.setSystemTime(new Date("2026-07-17T11:00:00.000Z"));
    const second = await applyOpportunityExecutionAction({ dealId: "deal-1", action: "assign_contractor", actor, contractorId: "c1" });

    expect(first.state.executionWorkspaceId).toBe("exec-deal-1");
    expect(second.state.executionWorkspaceId).toBe("exec-deal-1");
    expect(first.state.submissionReviewConnected).toBe(true);
    expect(second.state.submissionReviewConnected).toBe(true);
    expect(db.store.opportunityExecutionWorkspaces["deal-1"].createdAt).toBe(firstWorkspace.createdAt);
    expect(db.store.submissionReviews["deal-1"].createdAt).toBe(firstReview.createdAt);
    expect((db.store.deals["deal-1"].contractorAssignment as Record<string, unknown>).assignedAt).toBe(firstAssignment.assignedAt);
    expect(Object.keys(db.store["deals/deal-1/activity"])).toEqual(["opportunity_assignment__deal-1__c1__v1"]);
    expect(Object.keys(db.store.auditLogs)).toEqual(["opportunity_assignment__deal-1__c1__v1"]);
  });

  test("changing assignment to a different contractor records a new assignment event", async () => {
    const db = seedDb();
    getFirebaseAdmin.mockReturnValue(db);

    await applyOpportunityExecutionAction({ dealId: "deal-1", action: "assign_contractor", actor, contractorId: "c1" });
    jest.setSystemTime(new Date("2026-07-17T12:00:00.000Z"));
    const changed = await applyOpportunityExecutionAction({ dealId: "deal-1", action: "assign_contractor", actor, contractorId: "c2" });

    expect(changed.state.executionWorkspaceId).toBe("exec-deal-1");
    expect(changed.state.submissionReviewConnected).toBe(true);
    expect(db.store.deals["deal-1"].contractorId).toBe("c2");
    expect((db.store.deals["deal-1"].contractorAssignment as Record<string, unknown>).assignmentVersion).toBe(2);
    expect(Object.keys(db.store["deals/deal-1/activity"]).sort()).toEqual([
      "opportunity_assignment__deal-1__c1__v1",
      "opportunity_assignment__deal-1__c2__v2",
    ]);
    expect(Object.keys(db.store.auditLogs).sort()).toEqual([
      "opportunity_assignment__deal-1__c1__v1",
      "opportunity_assignment__deal-1__c2__v2",
    ]);
  });
});
