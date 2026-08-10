import { NextRequest } from "next/server";
import type { UserRole } from "@/lib/auth/roleUtils";
import type { AuthorizedUser } from "@/lib/server/authz";
import type { CanonicalDocumentReference, CanonicalMasterEntity } from "@/types/masterData";

const mockRequireAuthorizedUser = jest.fn();
const mockAssertHygieneInternalAccess = jest.fn();
const mockFileExists = jest.fn();
const mockGetSignedUrl = jest.fn();
let mockDb: ReturnType<typeof createMockFirestore>;
let lastStoragePath: string | null = null;

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
  requireAuthorizedUser: (request: NextRequest) => mockRequireAuthorizedUser(request),
}));

jest.mock("@/lib/firebase/admin", () => ({
  getFirebaseAdmin: () => mockDb,
  getFirebaseStorageBucket: () => ({
    file: (storagePath: string) => {
      lastStoragePath = storagePath;
      return {
        exists: () => mockFileExists(storagePath),
        getSignedUrl: (options: unknown) => mockGetSignedUrl(storagePath, options),
      };
    },
  }),
}));

jest.mock("@/lib/hygiene/hygieneService", () => ({
  HYGIENE_COLLECTIONS: {
    collections: "hygieneCollections",
    signatures: "hygieneSignatures",
    evidencePhotos: "hygieneEvidencePhotos",
    complianceDocuments: "hygieneComplianceDocuments",
  },
  assertHygieneInternalAccess: (user: AuthorizedUser) => mockAssertHygieneInternalAccess(user),
}));

import { GET as HYGIENE_EVIDENCE_ACCESS } from "@/app/api/hygiene/evidence/access/route";
import { GET as MASTER_EVIDENCE_ACCESS } from "@/app/api/master-data/evidence/[documentId]/access/route";
import { evaluateGovernedStoragePath } from "@/lib/master-data/storagePathPolicy";

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

function request(path: string) {
  return new NextRequest(`https://teos.test${path}`);
}

function params(documentId = "MDOC-SUP-1") {
  return { params: Promise.resolve({ documentId }) };
}

function staff(overrides: Partial<AuthorizedUser> = {}): AuthorizedUser {
  return { uid: "staff-1", email: "staff@example.test", role: "staff" as UserRole, workspaceId: "workspace-a", ...overrides };
}

function document(overrides: Partial<CanonicalDocumentReference> = {}): CanonicalDocumentReference {
  return {
    entityType: "document",
    canonicalId: "MDOC-SUP-1",
    documentId: "MDOC-SUP-1",
    documentType: "SUPPLIER_QUOTE",
    linkedEntityType: "supplier",
    linkedEntityId: "TE-SUP-1",
    displayName: "supplier-quote.pdf",
    legalName: null,
    tradingName: null,
    externalIdentifiers: [],
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
    storagePath: "supplier-quotes/workspace-a/SQ-1/supplier-quote.pdf",
    filename: "supplier-quote.pdf",
    contentType: "application/pdf",
    issueDate: "2026-07-16",
    expiryDate: "2026-07-23",
    evidenceStatus: "PENDING_REVIEW",
    evidencePurposes: ["SUPPLIER_IDENTITY", "HISTORICAL_PRICE"],
    uploadedBy: "staff-1",
    uploadedAt: now,
    hash: null,
    sourceSystem: "supplier_quote_intake",
    linkedBusinessReferences: [{ referenceType: "supplier_quote", referenceId: "SQ-1", relationship: "source_document" }],
    ...overrides,
  };
}

function seed(collection: string, id: string, data: Record<string, unknown>) {
  mockDb._store[collection] ??= new Map();
  mockDb._store[collection].set(id, data);
}

function seedDocument(entity: CanonicalMasterEntity) {
  seed("masterDocuments", entity.canonicalId, entity as unknown as Record<string, unknown>);
}

describe("Master Data Phase 5 evidence storage authority", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    lastStoragePath = null;
    mockDb = createMockFirestore();
    mockRequireAuthorizedUser.mockResolvedValue(staff());
    mockAssertHygieneInternalAccess.mockImplementation((user: AuthorizedUser) => {
      if (!["admin", "manager", "staff", "driver"].includes(user.role)) throw new MockAuthorizationError("unauthorized", 403);
    });
    mockFileExists.mockResolvedValue([true]);
    mockGetSignedUrl.mockResolvedValue(["https://signed.example/evidence"]);
    jest.spyOn(console, "info").mockImplementation(() => undefined);
    jest.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("storage path policy rejects malformed, traversal, encoded traversal and arbitrary paths", () => {
    expect(evaluateGovernedStoragePath("../secret.pdf").allowed).toBe(false);
    expect(evaluateGovernedStoragePath("hygiene/signatures/client/collection/%2e%2e/secret.png").allowed).toBe(false);
    expect(evaluateGovernedStoragePath("gs://bucket/hygiene/signatures/client/collection/sig.png").allowed).toBe(false);
    expect(evaluateGovernedStoragePath("https://storage.example/hygiene/signatures/client/collection/sig.png").allowed).toBe(false);
    expect(evaluateGovernedStoragePath("random/path/file.pdf").allowed).toBe(false);
    expect(evaluateGovernedStoragePath("hygiene/signatures/client/collection/sig.png").allowed).toBe(true);
  });

  test("unauthenticated, non-authorized and cross-workspace Hygiene evidence access is blocked", async () => {
    mockRequireAuthorizedUser.mockRejectedValueOnce(new MockAuthorizationError("unauthorized", 401));
    expect((await HYGIENE_EVIDENCE_ACCESS(request("/api/hygiene/evidence/access?kind=photo&recordId=TE-EP-1&collectionId=TE-COL-1"))).status).toBe(401);

    mockRequireAuthorizedUser.mockResolvedValue(staff({ role: "viewer" as UserRole }));
    expect((await HYGIENE_EVIDENCE_ACCESS(request("/api/hygiene/evidence/access?kind=photo&recordId=TE-EP-1&collectionId=TE-COL-1"))).status).toBe(403);

    mockRequireAuthorizedUser.mockResolvedValue(staff({ workspaceId: "workspace-b" }));
    expect((await HYGIENE_EVIDENCE_ACCESS(request("/api/hygiene/evidence/access?kind=photo&recordId=TE-EP-1&collectionId=TE-COL-1&workspaceId=workspace-a"))).status).toBe(403);
  });

  test("Hygiene signature access requires exact Collection_ID relationship and persisted storage path", async () => {
    seed("hygieneCollections", "TE-COL-1", { collectionId: "TE-COL-1", clientId: "TE-CLI-1", siteId: "TE-SIT-1" });
    seed("hygieneSignatures", "TE-SIG-1", {
      signatureId: "TE-SIG-1",
      collectionId: "TE-COL-1",
      clientId: "TE-CLI-1",
      siteId: "TE-SIT-1",
      signatureStoragePath: "hygiene/signatures/TE-CLI-1/TE-COL-1/TE-SIG-1.png",
    });
    const ok = await HYGIENE_EVIDENCE_ACCESS(request("/api/hygiene/evidence/access?kind=signature&recordId=TE-SIG-1&collectionId=TE-COL-1&storagePath=hygiene/signatures/evil/path.png"));
    expect(ok.status).toBe(200);
    expect(lastStoragePath).toBe("hygiene/signatures/TE-CLI-1/TE-COL-1/TE-SIG-1.png");

    const mismatch = await HYGIENE_EVIDENCE_ACCESS(request("/api/hygiene/evidence/access?kind=signature&recordId=TE-SIG-1&collectionId=TE-COL-OTHER"));
    expect(mismatch.status).toBe(404);
  });

  test("Hygiene photo access requires collection/workspace relationship and valid persisted path", async () => {
    seed("hygieneCollections", "TE-COL-1", { collectionId: "TE-COL-1", clientId: "TE-CLI-1", siteId: "TE-SIT-1" });
    seed("hygieneEvidencePhotos", "TE-EP-1", {
      photoId: "TE-EP-1",
      collectionId: "TE-COL-1",
      clientId: "TE-CLI-1",
      siteId: "TE-SIT-1",
      category: "Site Arrival",
      storagePath: "hygiene/evidence/TE-CLI-1/TE-COL-1/TE-EP-1-photo.jpg",
      fileUrl: "https://legacy.example/should-not-be-used",
    });
    const ok = await HYGIENE_EVIDENCE_ACCESS(request("/api/hygiene/evidence/access?kind=photo&recordId=TE-EP-1&collectionId=TE-COL-1&storagePath=hygiene/evidence/evil/path.jpg"));
    expect(ok.status).toBe(200);
    expect(lastStoragePath).toBe("hygiene/evidence/TE-CLI-1/TE-COL-1/TE-EP-1-photo.jpg");

    seed("hygieneEvidencePhotos", "TE-EP-BAD", {
      photoId: "TE-EP-BAD",
      collectionId: "TE-COL-1",
      clientId: "TE-CLI-1",
      siteId: "TE-SIT-1",
      category: "Site Arrival",
      storagePath: "hygiene/evidence/TE-CLI-1/TE-COL-2/TE-EP-BAD-photo.jpg",
    });
    expect((await HYGIENE_EVIDENCE_ACCESS(request("/api/hygiene/evidence/access?kind=photo&recordId=TE-EP-BAD&collectionId=TE-COL-1"))).status).toBe(403);
  });

  test("Master Data supplier evidence access uses persisted path and returns short-lived URL only after validation", async () => {
    seedDocument(document());
    const response = await MASTER_EVIDENCE_ACCESS(request("/api/master-data/evidence/MDOC-SUP-1/access?workspaceId=workspace-a&storagePath=hygiene/signatures/evil/path.png"), params());
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload).toMatchObject({ accessMode: "signed_url", accessUrl: "https://signed.example/evidence" });
    expect(lastStoragePath).toBe("supplier-quotes/workspace-a/SQ-1/supplier-quote.pdf");
    expect(mockDb._store.masterDocuments.get("MDOC-SUP-1")).not.toHaveProperty("accessUrl");
  });

  test("Master Data evidence access rejects malformed persisted storage path", async () => {
    seedDocument(document({ storagePath: "supplier-quotes/workspace-a/%2e%2e/secret.pdf" }));
    const response = await MASTER_EVIDENCE_ACCESS(request("/api/master-data/evidence/MDOC-SUP-1/access?workspaceId=workspace-a"), params());
    expect(response.status).toBe(403);
  });
});
