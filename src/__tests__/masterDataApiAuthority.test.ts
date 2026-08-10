import fs from "node:fs";
import { NextRequest } from "next/server";
import type { UserRole } from "@/lib/auth/roleUtils";
import type { AuthorizedUser } from "@/lib/server/authz";
import type { CanonicalMasterEntity, CanonicalSourceRegistryEntry, CanonicalSupplier } from "@/types/masterData";

const mockRequireAuthorizedUser = jest.fn();
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
}));

import { GET as LIST_MASTER_DATA, POST as CREATE_MASTER_DATA } from "@/app/api/master-data/route";
import { GET as GET_MASTER_DATA, PATCH as UPDATE_MASTER_DATA } from "@/app/api/master-data/[entityType]/[canonicalId]/route";
import { POST as ARCHIVE_MASTER_DATA } from "@/app/api/master-data/[entityType]/[canonicalId]/archive/route";
import { POST as REJECT_MASTER_DATA } from "@/app/api/master-data/[entityType]/[canonicalId]/reject/route";
import { POST as VERIFY_MASTER_DATA } from "@/app/api/master-data/[entityType]/[canonicalId]/verify/route";

const now = "2026-08-10T00:00:00.000Z";
const evidencePath = "reports/teos_data_architecture/evidence/supplier-quotes/2026/SQ-2026-JCE-3744/original/Quote_3744_JC_Enterprise.pdf";

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

function params(entityType = "supplier", canonicalId = "TE-SUP-JCE-2021-628179-07") {
  return { params: Promise.resolve({ entityType, canonicalId }) };
}

function staff(overrides: Partial<AuthorizedUser> = {}): AuthorizedUser {
  return { uid: "staff-1", email: "staff@example.test", role: "staff", workspaceId: "workspace-a", ...overrides };
}

function supplier(overrides: Partial<CanonicalSupplier> = {}): CanonicalSupplier {
  return {
    entityType: "supplier",
    canonicalId: "TE-SUP-JCE-2021-628179-07",
    supplierId: "TE-SUP-JCE-2021-628179-07",
    displayName: "JC Enterprise / J Centre P",
    legalName: "JC Enterprise / J Centre P",
    tradingName: "J Centre P",
    externalIdentifiers: [{ system: "business_registration", value: "2021/628179/07", status: "active" }],
    workspaceId: "workspace-a",
    organisationId: null,
    status: "active",
    provenance: "OPERATIONAL_VERIFIED",
    verificationStatus: "PENDING_REVIEW",
    reviewStatus: "REVIEW_REQUIRED",
    sourceEvidence: [{ sourcePath: evidencePath }],
    notes: null,
    createdAt: now,
    updatedAt: now,
    createdBy: "staff-1",
    updatedBy: "staff-1",
    registrationNumber: "2021/628179/07",
    vatNumber: null,
    contactPerson: null,
    email: null,
    phone: null,
    address: null,
    regionCoverage: ["Gauteng"],
    paymentTerms: null,
    linkedSourceId: null,
    identityEvidence: [{ sourcePath: evidencePath }],
    documentIds: [],
    ...overrides,
  };
}

function sourceRecord(overrides: Partial<CanonicalSourceRegistryEntry> = {}): CanonicalSourceRegistryEntry {
  return {
    entityType: "source",
    canonicalId: "SRC-STATS-SA-CPI",
    sourceId: "SRC-STATS-SA-CPI",
    category: "benchmark_source",
    sourceName: "Stats SA CPI Index",
    sourceUrl: null,
    displayName: "Stats SA CPI Index",
    legalName: null,
    tradingName: null,
    externalIdentifiers: [],
    workspaceId: "workspace-a",
    organisationId: null,
    status: "active",
    provenance: "BENCHMARK_REFERENCE",
    verificationStatus: "PENDING_REVIEW",
    reviewStatus: "REVIEW_REQUIRED",
    sourceEvidence: [],
    notes: null,
    createdAt: now,
    updatedAt: now,
    createdBy: "staff-1",
    updatedBy: "staff-1",
    ...overrides,
  };
}

function seed(entity: CanonicalMasterEntity) {
  const collection = entity.entityType === "supplier" ? "masterSuppliers" : entity.entityType === "source" ? "masterSources" : `master${entity.entityType.charAt(0).toUpperCase()}${entity.entityType.slice(1)}s`;
  mockDb._store[collection] ??= new Map();
  mockDb._store[collection].set(entity.canonicalId, entity as unknown as Record<string, unknown>);
}

async function json(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

describe("Master Data API authority", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDb = createMockFirestore();
    mockRequireAuthorizedUser.mockResolvedValue(staff());
  });

  test("unauthenticated request is rejected", async () => {
    mockRequireAuthorizedUser.mockRejectedValue(new MockAuthorizationError("unauthorized", 401));
    const response = await LIST_MASTER_DATA(request("/api/master-data?entityType=supplier&workspaceId=workspace-a"));
    expect(response.status).toBe(401);
    expect(await json(response)).toMatchObject({ error: "unauthorized" });
  });

  test("authenticated non-privileged user is rejected", async () => {
    mockRequireAuthorizedUser.mockResolvedValue(staff({ role: "viewer" as UserRole }));
    const response = await CREATE_MASTER_DATA(request("/api/master-data", "POST", supplier()));
    expect(response.status).toBe(403);
  });

  test("privileged user with correct workspace can create and retrieve a verified supplier", async () => {
    const create = await CREATE_MASTER_DATA(request("/api/master-data", "POST", supplier({ verificationStatus: "VERIFIED", reviewStatus: "READY_FOR_USE" })));
    expect(create.status).toBe(201);

    const get = await GET_MASTER_DATA(request("/api/master-data/supplier/TE-SUP-JCE-2021-628179-07"), params());
    expect(get.status).toBe(200);
    expect(await json(get)).toMatchObject({ entity: { canonicalId: "TE-SUP-JCE-2021-628179-07", verificationStatus: "VERIFIED" } });
  });

  test("cross-workspace create and update are blocked", async () => {
    const create = await CREATE_MASTER_DATA(request("/api/master-data", "POST", supplier({ workspaceId: "workspace-b" })));
    expect(create.status).toBe(403);

    seed(supplier({ workspaceId: "workspace-b" }));
    const update = await UPDATE_MASTER_DATA(request("/api/master-data/supplier/TE-SUP-JCE-2021-628179-07", "PATCH", { notes: "blocked" }), params());
    expect(update.status).toBe(403);
  });

  test("duplicate canonical ID and duplicate supplier registration number are rejected", async () => {
    seed(supplier());
    const duplicateId = await CREATE_MASTER_DATA(request("/api/master-data", "POST", supplier()));
    expect(duplicateId.status).toBe(409);

    const duplicateRegistration = await CREATE_MASTER_DATA(request("/api/master-data", "POST", supplier({
      canonicalId: "TE-SUP-JCE-DUPLICATE",
      supplierId: "TE-SUP-JCE-DUPLICATE",
    })));
    expect(duplicateRegistration.status).toBe(409);
    expect((await json(duplicateRegistration)).error).toMatch(/Registration number|duplicate|review/i);
  });

  test("invalid provenance and low-priority VERIFIED state are rejected", async () => {
    const invalid = await CREATE_MASTER_DATA(request("/api/master-data", "POST", supplier({ provenance: "BAD" as never })));
    expect(invalid.status).toBe(400);

    const seedVerified = await CREATE_MASTER_DATA(request("/api/master-data", "POST", supplier({
      canonicalId: "TE-SUP-SEED",
      supplierId: "TE-SUP-SEED",
      provenance: "SEED_DATA",
      verificationStatus: "VERIFIED",
      registrationNumber: "2026/000001/07",
    })));
    expect(seedVerified.status).toBe(409);
  });

  test("benchmark/source record cannot be promoted to Supplier_ID", async () => {
    const response = await CREATE_MASTER_DATA(request("/api/master-data", "POST", {
      ...sourceRecord(),
      supplierId: "TE-SUP-FORBIDDEN",
    }));
    expect(response.status).toBe(409);
    expect((await json(response)).error).toContain("Source_ID must not be promoted");
  });

  test("unresolved supplier creation remains pending and review required", async () => {
    const response = await CREATE_MASTER_DATA(request("/api/master-data", "POST", supplier({
      canonicalId: "TE-SUP-PHONE-ONLY",
      supplierId: "TE-SUP-PHONE-ONLY",
      registrationNumber: null,
      externalIdentifiers: [],
      identityEvidence: [],
      sourceEvidence: [],
      phone: "+27000000000",
    })));
    expect(response.status).toBe(201);
    expect(await json(response)).toMatchObject({ entity: { verificationStatus: "PENDING_REVIEW", reviewStatus: "REVIEW_REQUIRED" } });
  });

  test("archive preserves entity and audit history rather than deleting it", async () => {
    seed(supplier({ verificationStatus: "VERIFIED", reviewStatus: "READY_FOR_USE" }));
    const response = await ARCHIVE_MASTER_DATA(request("/api/master-data/supplier/TE-SUP-JCE-2021-628179-07/archive", "POST"), params());
    expect(response.status).toBe(200);

    const stored = mockDb._store.masterSuppliers.get("TE-SUP-JCE-2021-628179-07");
    expect(stored).toMatchObject({ status: "archived", verificationStatus: "ARCHIVED" });
    expect(mockDb._store.masterDataAuditEvents.size).toBe(1);
  });

  test("verify action requires evidence and reject action records resulting state", async () => {
    seed(supplier({ canonicalId: "TE-SUP-NO-EVIDENCE", supplierId: "TE-SUP-NO-EVIDENCE", sourceEvidence: [], identityEvidence: [], phone: "+27000000000" }));
    const noEvidence = await VERIFY_MASTER_DATA(request("/api/master-data/supplier/TE-SUP-NO-EVIDENCE/verify", "POST"), params("supplier", "TE-SUP-NO-EVIDENCE"));
    expect(noEvidence.status).toBe(409);

    seed(supplier());
    const verified = await VERIFY_MASTER_DATA(request("/api/master-data/supplier/TE-SUP-JCE-2021-628179-07/verify", "POST"), params());
    expect(verified.status).toBe(200);
    expect(await json(verified)).toMatchObject({ entity: { verificationStatus: "VERIFIED", reviewStatus: "READY_FOR_USE" } });

    const rejected = await REJECT_MASTER_DATA(request("/api/master-data/supplier/TE-SUP-JCE-2021-628179-07/reject", "POST"), params());
    expect(rejected.status).toBe(200);
    expect(await json(rejected)).toMatchObject({ entity: { verificationStatus: "REJECTED", reviewStatus: "BLOCKED" }, auditEvent: { action: "rejection" } });
  });

  test("canonical ID/entity-type mismatch and malformed payload are rejected", async () => {
    seed(supplier());
    const badPatchId = await UPDATE_MASTER_DATA(request("/api/master-data/supplier/TE-SUP-JCE-2021-628179-07", "PATCH", { canonicalId: "TE-SUP-OTHER" }), params());
    expect(badPatchId.status).toBe(400);

    const badPatchType = await UPDATE_MASTER_DATA(request("/api/master-data/supplier/TE-SUP-JCE-2021-628179-07", "PATCH", { entityType: "client" }), params());
    expect(badPatchType.status).toBe(400);

    const malformed = await CREATE_MASTER_DATA(request("/api/master-data", "POST", { displayName: "Missing identity" }));
    expect(malformed.status).toBe(400);
  });
});

describe("Master Data Firestore rule validation", () => {
  test("master collections block direct client writes and preserve existing authority rules", () => {
    const rules = fs.readFileSync("firestore.rules", "utf8");
    for (const collection of ["masterClients", "masterSuppliers", "masterSites", "masterItems", "masterSources", "masterDocuments", "masterEmployees", "masterDataAuditEvents"]) {
      expect(rules).toContain(`match /${collection}/{docId}`);
    }
    expect((rules.match(/allow create, update, delete: if false;/g) ?? []).length).toBeGreaterThanOrEqual(8);
    expect(rules).toContain("match /contractors/{docId}");
    expect(rules).toContain("allow write: if false;");
    expect(rules).toContain("match /hygieneSignatures/{docId}");
    expect(rules).toContain("allow create: if isSignedIn() && (isHygieneStaffMutation() || isHygieneDriverMutation());");
  });
});
