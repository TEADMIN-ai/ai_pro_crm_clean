const mockStore = new Map<string, Map<string, Record<string, unknown>>>();

function mockCollectionRecords(name: string) {
  if (!mockStore.has(name)) mockStore.set(name, new Map());
  return mockStore.get(name)!;
}

function mockQuery(name: string, filters: Array<[string, unknown]> = []) {
  return {
    where(field: string, _op: string, value: unknown) {
      return mockQuery(name, [...filters, [field, value]]);
    },
    async get() {
      const docs = Array.from(mockCollectionRecords(name).entries())
        .filter(([, data]) => filters.every(([field, value]) => data[field] === value))
        .map(([id, data]) => ({ id, exists: true, data: () => data }));
      return { empty: docs.length === 0, docs };
    },
  };
}

jest.mock("@/lib/firebase/admin", () => ({
  getFirebaseAdmin: () => ({
    collection: (name: string) => ({
      doc: (id: string) => ({
        async get() {
          const data = mockCollectionRecords(name).get(id);
          return { id, exists: Boolean(data), data: () => data };
        },
        set: (data: Record<string, unknown>, options?: { merge?: boolean }) => {
          const records = mockCollectionRecords(name);
          records.set(id, options?.merge ? { ...(records.get(id) ?? {}), ...data } : data);
          return Promise.resolve();
        },
      }),
      where: (field: string, op: string, value: unknown) => mockQuery(name).where(field, op, value),
      add: async (data: Record<string, unknown>) => {
        const id = `add-${mockCollectionRecords(name).size}`;
        mockCollectionRecords(name).set(id, { id, ...data });
        return { id };
      },
    }),
  }),
}));

const mockResolveApprovedClientQuote = jest.fn();
const mockResolveVerifiedTenderPackDocument = jest.fn();

jest.mock("@/server/services/commercialAuthorityService", () => ({
  resolveApprovedClientQuote: (...args: unknown[]) => mockResolveApprovedClientQuote(...args),
}));

jest.mock("@/server/services/tenderPackCommercialAuthorityService", () => ({
  resolveVerifiedTenderPackDocument: (...args: unknown[]) => mockResolveVerifiedTenderPackDocument(...args),
}));

import { getSubmissionEvidenceAuthoritySnapshot, resolveSingleApprovedSubmissionEvidence, resolveSubmissionEvidence } from "@/server/services/submissionEvidenceAuthorityService";

const actor = { uid: "manager-1", email: "manager@example.test", role: "manager" as const, workspaceId: "workspace-1" };

function seed(collection: string, id: string, data: Record<string, unknown>) {
  mockCollectionRecords(collection).set(id, data);
}

function approvedEvidence(id: string, overrides: Record<string, unknown> = {}) {
  seed("submissionEvidence", id, {
    id,
    dealId: "deal-1",
    opportunityId: "deal-1",
    workspaceId: "workspace-1",
    status: "APPROVED",
    reviewedBy: "manager-1",
    reviewedAt: "2026-08-21T15:23:47.012Z",
    evidenceType: "PORTAL_RECEIPT",
    testMarker: "TEST / DO NOT SUBMIT",
    storagePath: "uploads/deals/deal-1/submission-evidence/evidence.pdf",
    ...overrides,
  });
}

beforeEach(() => {
  mockStore.clear();
  mockResolveApprovedClientQuote.mockReset().mockResolvedValue({ clientQuoteId: "CQ-1" });
  mockResolveVerifiedTenderPackDocument.mockReset().mockResolvedValue({ documentId: "MDOC-TP-1" });
  seed("deals", "deal-1", { id: "deal-1", workspaceId: "workspace-1" });
});

test("no evidence ID and exactly one approved evidence resolves successfully", async () => {
  approvedEvidence("SE-1");

  await expect(resolveSingleApprovedSubmissionEvidence({ dealId: "deal-1", actor })).resolves.toMatchObject({ id: "SE-1" });
});

test("zero approved evidence fails closed", async () => {
  await expect(resolveSingleApprovedSubmissionEvidence({ dealId: "deal-1", actor })).rejects.toMatchObject({ code: "SUBMISSION_EVIDENCE_REQUIRED" });
});

test("multiple approved evidence records fail closed as ambiguous", async () => {
  approvedEvidence("SE-1");
  approvedEvidence("SE-2");

  await expect(resolveSingleApprovedSubmissionEvidence({ dealId: "deal-1", actor })).rejects.toMatchObject({ code: "SUBMISSION_EVIDENCE_AMBIGUOUS", evidenceIds: ["SE-1", "SE-2"] });
});

test("explicit valid evidence ID succeeds", async () => {
  approvedEvidence("SE-1");

  await expect(resolveSubmissionEvidence({ dealId: "deal-1", evidenceId: "SE-1", actor })).resolves.toMatchObject({ id: "SE-1" });
});

test("explicit foreign evidence ID fails closed", async () => {
  approvedEvidence("SE-foreign", { dealId: "other-deal", opportunityId: "other-deal" });

  await expect(resolveSubmissionEvidence({ dealId: "deal-1", evidenceId: "SE-foreign", actor })).rejects.toMatchObject({ code: "SUBMISSION_EVIDENCE_NOT_APPROVED" });
});

test("wrong workspace evidence fails closed", async () => {
  approvedEvidence("SE-foreign-workspace", { workspaceId: "workspace-2" });

  await expect(resolveSubmissionEvidence({ dealId: "deal-1", evidenceId: "SE-foreign-workspace", actor })).rejects.toMatchObject({ code: "SUBMISSION_EVIDENCE_NOT_APPROVED" });
});

test("rejected or unreviewed evidence fails closed", async () => {
  approvedEvidence("SE-rejected", { status: "REJECTED" });
  approvedEvidence("SE-unreviewed", { reviewedBy: null, reviewedAt: null });

  await expect(resolveSubmissionEvidence({ dealId: "deal-1", evidenceId: "SE-rejected", actor })).rejects.toMatchObject({ code: "SUBMISSION_EVIDENCE_NOT_APPROVED" });
  await expect(resolveSubmissionEvidence({ dealId: "deal-1", evidenceId: "SE-unreviewed", actor })).rejects.toMatchObject({ code: "SUBMISSION_EVIDENCE_NOT_APPROVED" });
});

test("authority snapshot exposes exactly one approved evidence ID for UI forwarding", async () => {
  approvedEvidence("SE-1");

  await expect(getSubmissionEvidenceAuthoritySnapshot({ dealId: "deal-1", actor })).resolves.toMatchObject({
    clientQuoteReady: true,
    tenderPackDocumentReady: true,
    submissionEvidenceReady: true,
    approvedSubmissionEvidenceId: "SE-1",
    approvedSubmissionEvidenceCount: 1,
  });
});

test("TEST DO NOT SUBMIT evidence alone does not mark submission complete", async () => {
  approvedEvidence("SE-1");
  const deal = mockCollectionRecords("deals").get("deal-1");

  expect(deal?.opportunityExecution).toBeUndefined();
  await expect(resolveSingleApprovedSubmissionEvidence({ dealId: "deal-1", actor })).resolves.toMatchObject({ testMarker: "TEST / DO NOT SUBMIT" });
  expect(mockCollectionRecords("deals").get("deal-1")?.opportunityExecution).toBeUndefined();
});
