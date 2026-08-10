import { NextRequest } from "next/server";
import type { UserRole } from "@/lib/auth/roleUtils";
import type { AuthorizedUser } from "@/lib/server/authz";
import type { CanonicalDocumentReference, CanonicalMasterEntity } from "@/types/masterData";

const mockRequireAuthorizedUser = jest.fn();
const mockFileExists = jest.fn();
const mockGetSignedUrl = jest.fn();
let mockDb: ReturnType<typeof createMockFirestore>;

class MockAuthorizationError extends Error {
  status: number;

  constructor(message: string, status = 403) {
    super(message);
    this.name = "AuthorizationError";
    this.status = status;
  }
}

jest.mock("@/lib/server/authz", () => ({
  AuthorizationError: MockAuthorizationError,
  assertPrivilegedRole: (user: AuthorizedUser) => {
    if (!["admin", "manager", "staff"].includes(user.role)) throw new MockAuthorizationError("unauthorized", 403);
  },
  isPrivilegedRole: (role: UserRole) => ["admin", "manager", "staff"].includes(role),
  requireAuthorizedUser: (request: NextRequest) => mockRequireAuthorizedUser(request),
}));

jest.mock("@/lib/firebase/admin", () => ({
  getFirebaseAdmin: () => mockDb,
  getFirebaseStorageBucket: () => ({
    file: (storagePath: string) => ({
      exists: () => mockFileExists(storagePath),
      getSignedUrl: (options: unknown) => mockGetSignedUrl(storagePath, options),
    }),
  }),
}));

import { GET as EVIDENCE_ACCESS } from "@/app/api/master-data/evidence/[documentId]/access/route";
import { POST as EVIDENCE_REVIEW } from "@/app/api/master-data/evidence/[documentId]/review/route";
import {
  adaptContractorEvidence,
  adaptFinanceEvidence,
  adaptHygieneEvidence,
  adaptSupplierQuoteEvidence,
  deriveEvidenceStatus,
  evaluateEvidencePurposeAuthority,
} from "@/lib/master-data/evidenceAuthority";

const now = "2026-08-10T00:00:00.000Z";

type StoredData = Record<string, Map<string, Record<string, unknown>>>;
type QueryFilter = { field: unknown; op: string; value: unknown };

function createMockFirestore(seed: StoredData = {}) {
  const store: StoredData = seed;
  const ensure = (name: string) => {
    store[name] ??= new Map();
    return store[name];
  };
  const collection = (name: string) => ({
    doc: (id: string) => ({
      async get() {
        const data = ensure(name).get(id);
        return { id, exists: Boolean(data), data: () => data };
      },
      async set(data: Record<string, unknown>, options?: { merge?: boolean }) {
        const existing = ensure(name).get(id) ?? {};
        ensure(name).set(id, options?.merge ? { ...existing, ...data } : data);
      },
    }),
    where: (field: unknown, op: string, value: unknown) => query(name, [{ field, op, value }]),
    limit: (count: number) => query(name, []).limit(count),
    async get() {
      return snapshot(Array.from(ensure(name).entries()));
    },
  });
  const query = (name: string, filters: QueryFilter[], max = Infinity) => ({
    where: (field: unknown, op: string, value: unknown) => query(name, [...filters, { field, op, value }], max),
    limit: (count: number) => query(name, filters, count),
    async get() {
      const entries = Array.from(ensure(name).entries()).filter(([, data]) =>
        filters.every((filter) => filter.op === "==" && data[String(filter.field)] === filter.value),
      );
      return snapshot(entries.slice(0, max));
    },
  });
  return { collection, _store: store };
}

function snapshot(entries: Array<[string, Record<string, unknown>]>) {
  return {
    empty: entries.length === 0,
    docs: entries.map(([id, data]) => ({ id, data: () => data })),
  };
}

function request(path: string, method = "GET", body?: unknown) {
  return new NextRequest(`https://teos.test${path}`, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
  });
}

function params(documentId = "MDOC-SQ-2026-JCE-3744") {
  return { params: Promise.resolve({ documentId }) };
}

function staff(overrides: Partial<AuthorizedUser> = {}): AuthorizedUser {
  return { uid: "staff-1", email: "staff@example.test", role: "staff", workspaceId: "workspace-a", ...overrides };
}

function document(overrides: Partial<CanonicalDocumentReference> = {}): CanonicalDocumentReference {
  return {
    entityType: "document",
    canonicalId: "MDOC-SQ-2026-JCE-3744",
    documentId: "MDOC-SQ-2026-JCE-3744",
    documentType: "SUPPLIER_QUOTE",
    linkedEntityType: "supplier",
    linkedEntityId: "TE-SUP-JCE-2021-628179-07",
    displayName: "Quote_3744_JC_Enterprise.pdf",
    legalName: null,
    tradingName: null,
    externalIdentifiers: [{ system: "supplier_quote", value: "SQ-2026-JCE-3744", status: "active" }],
    workspaceId: "workspace-a",
    organisationId: null,
    status: "active",
    provenance: "OPERATIONAL_VERIFIED",
    verificationStatus: "PENDING_REVIEW",
    reviewStatus: "REVIEW_REQUIRED",
    sourceEvidence: [],
    notes: null,
    createdAt: now,
    updatedAt: now,
    createdBy: "staff-1",
    updatedBy: "staff-1",
    sourcePath: null,
    storagePath: "supplier-quotes/workspace-a/deal-1/SQ-2026-JCE-3744/Quote_3744_JC_Enterprise.pdf",
    filename: "Quote_3744_JC_Enterprise.pdf",
    contentType: "application/pdf",
    issueDate: "2026-07-16",
    expiryDate: "2026-07-23",
    evidenceStatus: "PENDING_REVIEW",
    evidencePurposes: ["SUPPLIER_IDENTITY", "HISTORICAL_PRICE"],
    uploadedBy: "staff-1",
    uploadedAt: now,
    hash: null,
    sourceSystem: "supplier_quote_intake",
    linkedBusinessReferences: [{ referenceType: "supplier_quote", referenceId: "SQ-2026-JCE-3744", relationship: "source_document" }],
    ...overrides,
  };
}

function seed(entity: CanonicalMasterEntity) {
  const collection = entity.entityType === "document" ? "masterDocuments" : `master${entity.entityType.charAt(0).toUpperCase()}${entity.entityType.slice(1)}s`;
  mockDb._store[collection] ??= new Map();
  mockDb._store[collection].set(entity.canonicalId, entity as unknown as Record<string, unknown>);
}

async function json(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

describe("Master Data Phase 4 evidence authority", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDb = createMockFirestore();
    mockRequireAuthorizedUser.mockResolvedValue(staff());
    mockFileExists.mockResolvedValue([true]);
    mockGetSignedUrl.mockResolvedValue(["https://signed.example/evidence.pdf"]);
  });

  test("unauthenticated and non-privileged evidence access is blocked", async () => {
    mockRequireAuthorizedUser.mockRejectedValue(new MockAuthorizationError("unauthorized", 401));
    expect((await EVIDENCE_ACCESS(request("/api/master-data/evidence/MDOC-SQ-2026-JCE-3744/access?workspaceId=workspace-a"), params())).status).toBe(401);

    mockRequireAuthorizedUser.mockResolvedValue(staff({ role: "viewer" as UserRole }));
    expect((await EVIDENCE_ACCESS(request("/api/master-data/evidence/MDOC-SQ-2026-JCE-3744/access?workspaceId=workspace-a"), params())).status).toBe(403);
  });

  test("cross-workspace evidence access is blocked and valid workspace retrieval succeeds", async () => {
    seed(document());
    mockRequireAuthorizedUser.mockResolvedValue(staff({ workspaceId: "workspace-b" }));
    expect((await EVIDENCE_ACCESS(request("/api/master-data/evidence/MDOC-SQ-2026-JCE-3744/access?workspaceId=workspace-a"), params())).status).toBe(403);

    mockRequireAuthorizedUser.mockResolvedValue(staff());
    const response = await EVIDENCE_ACCESS(request("/api/master-data/evidence/MDOC-SQ-2026-JCE-3744/access?workspaceId=workspace-a"), params());
    expect(response.status).toBe(200);
    expect(await json(response)).toMatchObject({ accessMode: "signed_url", accessUrl: "https://signed.example/evidence.pdf" });
  });

  test("file existence does not imply VERIFIED", () => {
    expect(deriveEvidenceStatus(document({ evidenceStatus: undefined }), new Date("2026-07-17"))).toBe("PENDING_REVIEW");
  });

  test("expired supplier quote can support history but not current QS pricing", () => {
    const quote = adaptSupplierQuoteEvidence(document(), new Date("2026-08-10"));
    expect(quote.identityAuthority.status).toBe("ALLOWED");
    expect(quote.currentPricingAuthority.status).toBe("BLOCKED");
    expect(quote.currentPricingAuthority.reason).toMatch(/Expired supplier quote/);
  });

  test("benchmark evidence cannot become verified supplier quote authority", () => {
    const decision = evaluateEvidencePurposeAuthority({
      document: document({ provenance: "BENCHMARK_REFERENCE", expiryDate: null }),
      purpose: "SUPPLIER_QUOTE_REVIEW",
    });
    expect(decision.status).toBe("BLOCKED");
  });

  test("Hygiene signature evidence must match Collection_ID and cannot satisfy disposal evidence", () => {
    const hygiene = document({
      canonicalId: "MDOC-TE-SIG-1",
      documentId: "MDOC-TE-SIG-1",
      documentType: "HYGIENE_SIGNATURE",
      linkedEntityType: "site",
      linkedEntityId: "SITE-1",
      linkedBusinessReferences: [{ referenceType: "hygiene_collection", referenceId: "TE-COL-2026-0001", relationship: "customer_acknowledgement" }],
      expiryDate: null,
      verificationStatus: "VERIFIED",
      evidenceStatus: "VERIFIED",
    });
    expect(adaptHygieneEvidence({ document: hygiene, collectionId: "TE-COL-2026-0001", purpose: "HYGIENE_COLLECTION_ACKNOWLEDGEMENT" }).decision.status).toBe("ALLOWED");
    expect(adaptHygieneEvidence({ document: hygiene, collectionId: "TE-COL-OTHER", purpose: "HYGIENE_COLLECTION_ACKNOWLEDGEMENT" }).decision.status).toBe("BLOCKED");
    expect(adaptHygieneEvidence({ document: hygiene, disposalBatchId: "DISP-1", purpose: "HYGIENE_DISPOSAL_PROOF" }).decision.status).toBe("BLOCKED");
  });

  test("contractor and finance adapters preserve authority boundaries", () => {
    const contractor = document({
      canonicalId: "MDOC-CONTRACTOR-CSD",
      documentId: "MDOC-CONTRACTOR-CSD",
      documentType: "CONTRACTOR_COMPLIANCE",
      linkedEntityType: "contractor",
      linkedEntityId: "CONTRACTOR-1",
      expiryDate: null,
      verificationStatus: "VERIFIED",
      evidenceStatus: "VERIFIED",
    });
    expect(adaptContractorEvidence(contractor)).toMatchObject({ authority: "existing_contractor_authority", contractorId: "CONTRACTOR-1" });
    expect(adaptFinanceEvidence(document({ linkedBusinessReferences: [{ referenceType: "bank_transaction", referenceId: "BANK-260626-03", relationship: "supporting_evidence" }] })).linkedReferences).toHaveLength(1);
  });

  test("review actions produce audit events, persist rejection reason, and retain historical-only evidence", async () => {
    seed(document({ expiryDate: null, evidenceStatus: "PRESENT" }));
    const verified = await EVIDENCE_REVIEW(request("/api/master-data/evidence/MDOC-SQ-2026-JCE-3744/review", "POST", {
      workspaceId: "workspace-a",
      action: "verify",
      purpose: "SUPPLIER_IDENTITY",
      reason: "original quote inspected",
    }), params());
    expect(verified.status).toBe(200);
    expect(mockDb._store.masterDataAuditEvents.size).toBe(2);

    const rejected = await EVIDENCE_REVIEW(request("/api/master-data/evidence/MDOC-SQ-2026-JCE-3744/review", "POST", {
      workspaceId: "workspace-a",
      action: "reject",
      purpose: "SUPPLIER_IDENTITY",
      reason: "wrong supplier",
    }), params());
    expect(rejected.status).toBe(200);
    expect(mockDb._store.masterDocuments.get("MDOC-SQ-2026-JCE-3744")).toMatchObject({ rejectionReason: "wrong supplier", evidenceStatus: "REJECTED" });

    const historical = document({ canonicalId: "MDOC-HIST", documentId: "MDOC-HIST", expiryDate: "2026-07-23" });
    seed(historical);
    const historicalOnly = await EVIDENCE_REVIEW(request("/api/master-data/evidence/MDOC-HIST/review", "POST", {
      workspaceId: "workspace-a",
      action: "historical_only",
      purpose: "HISTORICAL_PRICE",
      reason: "expired quote retained for history",
    }), params("MDOC-HIST"));
    expect(historicalOnly.status).toBe(200);
    expect(mockDb._store.masterDocuments.get("MDOC-HIST")).toMatchObject({ evidenceStatus: "HISTORICAL_ONLY" });
  });

  test("malformed Document_ID/entity relationship fails closed", async () => {
    seed(document({ canonicalId: "MDOC-BAD", documentId: "MDOC-OTHER" }));
    const response = await EVIDENCE_ACCESS(request("/api/master-data/evidence/MDOC-BAD/access?workspaceId=workspace-a"), params("MDOC-BAD"));
    expect(response.status).toBe(400);
  });
});
