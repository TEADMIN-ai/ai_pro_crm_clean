jest.mock("firebase-admin/firestore", () => ({ Timestamp: { fromDate: (date: Date) => date } }));

const getFirebaseAdmin = jest.fn();
const listContractors = jest.fn();
const resolveContractorReference = jest.fn();
const resolveApprovedClientQuote = jest.fn();
const resolveVerifiedTenderPackDocument = jest.fn();

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

jest.mock("@/server/services/commercialAuthorityService", () => ({
  resolveApprovedClientQuote: (input: unknown) => resolveApprovedClientQuote(input),
}));

jest.mock("@/server/services/tenderPackCommercialAuthorityService", () => ({
  resolveVerifiedTenderPackDocument: (input: unknown) => resolveVerifiedTenderPackDocument(input),
}));

import { applyOpportunityExecutionAction } from "@/server/services/opportunityExecutionService";

type Store = Record<string, Record<string, Record<string, unknown>>>;

const actor = { uid: "manager-1", email: "manager@example.test", role: "manager" as const, workspaceId: "workspace-1" };
const contractor = { id: "contractor-1", contractorId: "contractor-1", companyName: "Contractor", workspaceId: "workspace-1", status: "active", readinessScore: 100, taxValid: true };

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
  const query = (path: string, filters: Array<[string, unknown]> = []) => ({
    where(field: string, _op: string, value: unknown) {
      return query(path, [...filters, [field, value]]);
    },
    orderBy() {
      return this;
    },
    limit() {
      return this;
    },
    async get() {
      const docs = Object.entries(readCollection(path))
        .filter(([, data]) => filters.every(([field, value]) => data[field] === value))
        .map(([id, data]) => snapshot(id, data));
      return { empty: docs.length === 0, docs };
    },
  });
  const collection = (path: string) => ({
    doc: (id: string) => ({
      get: jest.fn(async () => snapshot(id, readCollection(path)[id])),
      set: jest.fn(async (data: Record<string, unknown>, options?: { merge?: boolean }) => writeDoc(path, id, data, options?.merge)),
      collection: (name: string) => collection(`${path}/${id}/${name}`),
    }),
    add: jest.fn(async (data: Record<string, unknown>) => {
      const id = `auto-${Object.keys(readCollection(path)).length + 1}`;
      writeDoc(path, id, data);
      return { id };
    }),
    where: (field: string, op: string, value: unknown) => query(path).where(field, op, value),
    orderBy: () => query(path),
    limit: () => query(path),
    get: jest.fn(async () => ({ docs: Object.entries(readCollection(path)).map(([id, data]) => snapshot(id, data)) })),
  });
  return { collection: jest.fn(collection), store, writes };
}

function readyDeal() {
  return {
    id: "deal-1",
    workspaceId: "workspace-1",
    status: "draft",
    stage: "lead",
    companyId: "contractor-1",
    contractorId: "contractor-1",
    contractorAssignment: { contractorId: "contractor-1", contractorName: "Contractor", assignedAt: "2026-08-01T00:00:00.000Z", workspaceId: "workspace-1", executionWorkspaceId: "exec-deal-1" },
    documents: [],
    opportunityExecution: {
      currentPhase: "READY_FOR_SUBMISSION",
      executionWorkspaceId: "exec-deal-1",
      requirementsReviewed: true,
      complianceReviewed: true,
      documentsPrepared: true,
      internalReviewApproved: true,
      internalReviewApprovalProvenance: { action: "complete_internal_review", status: "APPROVED", completedAt: "2026-08-18T20:00:00.000Z", completedBy: "manager-1" },
      contractorApprovalComplete: true,
      contractorApprovalProvenance: { action: "contractor_approval", status: "APPROVED", completedAt: "2026-08-18T20:01:00.000Z", completedBy: "manager-1" },
      tenderPackGenerated: true,
      tenderPackValidated: true,
      pricingComplete: true,
      submissionReviewApprovalProvenance: { action: "complete_submission_review", status: "APPROVED", completedAt: "2026-08-18T20:02:00.000Z", completedBy: "manager-1" },
      requirements: { reviewed: true, reviewStatus: "APPROVED", boqPricingSchedulePresent: false, signatureRequired: false, compulsoryReturnables: [], formsRequiringCompletion: [], annexuresAndAmendments: [] },
    },
  };
}

function approvedEvidence(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    dealId: "deal-1",
    opportunityId: "deal-1",
    workspaceId: "workspace-1",
    status: "APPROVED",
    reviewedBy: "manager-1",
    reviewedAt: "2026-08-21T15:23:47.012Z",
    evidenceType: "PORTAL_RECEIPT",
    portalReference: "PORTAL-REF-1",
    storagePath: "uploads/deals/deal-1/submission-evidence/evidence.pdf",
    ...overrides,
  };
}

function seedDb(submissionEvidence: Record<string, Record<string, unknown>>) {
  return createDb({
    users: { "manager-1": { workspaceId: "workspace-1" } },
    deals: { "deal-1": readyDeal() },
    contractors: { "contractor-1": contractor },
    "contractors/contractor-1/documents": {},
    "contractors/contractor-1/sarsTcs": {},
    tenderPricingWorkspaces: {},
    submissionEvidence,
    auditLogs: {},
    "deals/deal-1/activity": {},
  });
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date("2026-08-21T16:00:00.000Z"));
  listContractors.mockReset().mockResolvedValue([contractor]);
  resolveContractorReference.mockReset().mockResolvedValue({ ok: true, contractorId: "contractor-1", workspaceId: "workspace-1", contractor });
  resolveApprovedClientQuote.mockReset().mockResolvedValue({ clientQuoteId: "CQ-1" });
  resolveVerifiedTenderPackDocument.mockReset().mockResolvedValue({ documentId: "MDOC-TP-1" });
});

afterEach(() => {
  jest.useRealTimers();
});

test("record_submission resolves exactly one approved evidence and writes submitted state", async () => {
  const db = seedDb({ "SE-1": approvedEvidence("SE-1") });
  getFirebaseAdmin.mockReturnValue(db);

  await applyOpportunityExecutionAction({ dealId: "deal-1", action: "record_submission", actor });

  expect(db.store.deals["deal-1"].status).toBe("submitted");
  expect(db.store.deals["deal-1"].stage).toBe("submitted");
  expect(db.store.deals["deal-1"].opportunityExecution).toMatchObject({
    currentPhase: "SUBMITTED",
    submitted: true,
    submission: expect.objectContaining({ submissionEvidenceDocumentId: "SE-1" }),
    submissionCompletionProvenance: expect.objectContaining({
      action: "record_submission",
      status: "SUBMITTED",
      completedBy: "manager-1",
      clientQuoteId: "CQ-1",
      tenderPackDocumentId: "MDOC-TP-1",
      submissionEvidenceDocumentId: "SE-1",
    }),
  });
});

test("failed record_submission with no approved evidence leaves submitted state unchanged", async () => {
  const db = seedDb({});
  getFirebaseAdmin.mockReturnValue(db);

  await expect(applyOpportunityExecutionAction({ dealId: "deal-1", action: "record_submission", actor })).rejects.toMatchObject({ code: "SUBMISSION_EVIDENCE_REQUIRED" });

  expect(db.store.deals["deal-1"].status).toBe("draft");
  expect(db.store.deals["deal-1"].stage).toBe("lead");
  expect((db.store.deals["deal-1"].opportunityExecution as Record<string, unknown>).submitted).toBeUndefined();
});

test("failed record_submission with ambiguous evidence leaves submitted state unchanged", async () => {
  const db = seedDb({ "SE-1": approvedEvidence("SE-1"), "SE-2": approvedEvidence("SE-2") });
  getFirebaseAdmin.mockReturnValue(db);

  await expect(applyOpportunityExecutionAction({ dealId: "deal-1", action: "record_submission", actor })).rejects.toMatchObject({ code: "SUBMISSION_EVIDENCE_AMBIGUOUS" });

  expect(db.store.deals["deal-1"].status).toBe("draft");
  expect(db.store.deals["deal-1"].stage).toBe("lead");
  expect((db.store.deals["deal-1"].opportunityExecution as Record<string, unknown>).submitted).toBeUndefined();
});

test("explicit client-supplied evidence ID is still server validated", async () => {
  const db = seedDb({ "SE-foreign": approvedEvidence("SE-foreign", { dealId: "other-deal", opportunityId: "other-deal" }) });
  getFirebaseAdmin.mockReturnValue(db);

  await expect(applyOpportunityExecutionAction({ dealId: "deal-1", action: "record_submission", actor, submission: { submissionEvidenceDocumentId: "SE-foreign" } })).rejects.toMatchObject({ code: "SUBMISSION_EVIDENCE_NOT_APPROVED" });

  expect(db.store.deals["deal-1"].status).toBe("draft");
  expect((db.store.deals["deal-1"].opportunityExecution as Record<string, unknown>).submitted).toBeUndefined();
});
