import { NextRequest } from "next/server";
import type { UserRole } from "@/lib/auth/roleUtils";
import type { AuthorizedUser } from "@/lib/server/authz";
import type {
  CanonicalDocumentReference,
  CanonicalItem,
  CanonicalMasterEntity,
  CanonicalSupplier,
  MasterDataActor,
  MasterDataAuditEvent,
  MasterDataEntityType,
} from "@/types/masterData";

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

import { POST as ARCHIVE_MASTER_DATA } from "@/app/api/master-data/[entityType]/[canonicalId]/archive/route";
import { POST as REJECT_MASTER_DATA } from "@/app/api/master-data/[entityType]/[canonicalId]/reject/route";
import { POST as VERIFY_MASTER_DATA } from "@/app/api/master-data/[entityType]/[canonicalId]/verify/route";
import { GET as REVIEW_QUEUE } from "@/app/api/master-data/review/route";
import { POST as RESOLVE_DUPLICATE } from "@/app/api/master-data/duplicates/resolve/route";
import {
  buildMasterDataReviewQueues,
  resolveMasterDataDuplicate,
  type DuplicateResolutionInput,
  type MasterDataRepository,
} from "@/lib/master-data";

const now = "2026-08-10T00:00:00.000Z";
const expiredEvidencePath = "reports/teos_data_architecture/evidence/supplier-quotes/2026/SQ-2026-JCE-3744/original/Quote_3744_JC_Enterprise.pdf";

type StoredData = Record<string, Map<string, Record<string, unknown>>>;
type QueryFilter = { field: unknown; op: string; value: unknown };

class MemoryMasterDataRepository implements MasterDataRepository {
  records: CanonicalMasterEntity[];
  audits: MasterDataAuditEvent[] = [];

  constructor(seed: CanonicalMasterEntity[] = []) {
    this.records = [...seed];
  }

  async getByCanonicalId(entityType: MasterDataEntityType, canonicalId: string) {
    return this.records.find((record) => record.entityType === entityType && record.canonicalId === canonicalId) ?? null;
  }

  async listByEntityType(entityType: MasterDataEntityType, workspaceId: string) {
    return this.records.filter((record) => record.entityType === entityType && record.workspaceId === workspaceId);
  }

  async save(entity: CanonicalMasterEntity) {
    const index = this.records.findIndex((record) => record.entityType === entity.entityType && record.canonicalId === entity.canonicalId);
    if (index >= 0) this.records[index] = entity;
    else this.records.push(entity);
  }

  async writeAuditEvent(event: MasterDataAuditEvent) {
    this.audits.push(event);
  }
}

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

function actor(overrides: Partial<MasterDataActor> = {}): MasterDataActor {
  return { uid: "staff-1", role: "staff", workspaceId: "workspace-a", ...overrides };
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
    sourceEvidence: [{ sourcePath: expiredEvidencePath, filename: "Quote_3744_JC_Enterprise.pdf", issueDate: "2026-07-16", expiryDate: "2026-07-23" }],
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
    linkedSourceId: "SRC-JCE-QUOTE-3744",
    identityEvidence: [{ sourcePath: expiredEvidencePath, filename: "Quote_3744_JC_Enterprise.pdf", issueDate: "2026-07-16", expiryDate: "2026-07-23" }],
    documentIds: ["MDOC-SQ-2026-JCE-3744"],
    ...overrides,
  };
}

function item(overrides: Partial<CanonicalItem> = {}): CanonicalItem {
  return {
    entityType: "item",
    canonicalId: "TE-HYG-BIN-WHL-240-ORG-001",
    itemId: "TE-HYG-BIN-WHL-240-ORG-001",
    itemCode: "TE-HYG-BIN-WHL-240-ORG-001",
    displayName: "240L Orange wheelie bin with waste sticker",
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
    description: "240L Orange wheelie bin with waste sticker",
    category: "Hygiene bins",
    division: "Hygiene",
    unit: "each",
    packSize: null,
    conversionFactor: null,
    supplierSku: null,
    sourceIds: ["SRC-JCE-QUOTE-3744"],
    priceReferenceIds: ["SPH-QUOTE-3744-L1"],
    ...overrides,
  };
}

function document(overrides: Partial<CanonicalDocumentReference> = {}): CanonicalDocumentReference {
  return {
    entityType: "document",
    documentId: "MDOC-SQ-2026-JCE-3744",
    canonicalId: "MDOC-SQ-2026-JCE-3744",
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
    sourceEvidence: [{ sourcePath: expiredEvidencePath, filename: "Quote_3744_JC_Enterprise.pdf", issueDate: "2026-07-16", expiryDate: "2026-07-23" }],
    notes: null,
    createdAt: now,
    updatedAt: now,
    createdBy: "staff-1",
    updatedBy: "staff-1",
    sourcePath: expiredEvidencePath,
    storagePath: null,
    filename: "Quote_3744_JC_Enterprise.pdf",
    issueDate: "2026-07-16",
    expiryDate: "2026-07-23",
    uploadedBy: "staff-1",
    uploadedAt: now,
    hash: null,
    ...overrides,
  };
}

function seed(entity: CanonicalMasterEntity) {
  const collection = entity.entityType === "supplier" ? "masterSuppliers" : entity.entityType === "item" ? "masterItems" : entity.entityType === "document" ? "masterDocuments" : `master${entity.entityType.charAt(0).toUpperCase()}${entity.entityType.slice(1)}s`;
  mockDb._store[collection] ??= new Map();
  mockDb._store[collection].set(entity.canonicalId, entity as unknown as Record<string, unknown>);
}

async function json(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

describe("Master Data Phase 3 review workflow", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDb = createMockFirestore();
    mockRequireAuthorizedUser.mockResolvedValue(staff());
  });

  test("privileged review access loads pending queues and non-privileged access is blocked", async () => {
    seed(supplier());
    const allowed = await REVIEW_QUEUE(request("/api/master-data/review?workspaceId=workspace-a"));
    expect(allowed.status).toBe(200);
    expect(await json(allowed)).toMatchObject({ counts: { pendingSuppliers: 1 } });

    mockRequireAuthorizedUser.mockResolvedValue(staff({ role: "viewer" as UserRole }));
    const blocked = await REVIEW_QUEUE(request("/api/master-data/review?workspaceId=workspace-a"));
    expect(blocked.status).toBe(403);
  });

  test("cross-workspace review is blocked", async () => {
    mockRequireAuthorizedUser.mockResolvedValue(staff({ workspaceId: "workspace-a" }));
    const response = await REVIEW_QUEUE(request("/api/master-data/review?workspaceId=workspace-b"));
    expect(response.status).toBe(403);
  });

  test("pending supplier appears then disappears from pending queue after verification", async () => {
    const repository = new MemoryMasterDataRepository([supplier()]);
    const before = await buildMasterDataReviewQueues({ repository, workspaceId: "workspace-a", today: new Date("2026-08-10") });
    expect(before.counts.pendingSuppliers).toBe(1);

    repository.records[0] = supplier({ verificationStatus: "VERIFIED", reviewStatus: "READY_FOR_USE" });
    const after = await buildMasterDataReviewQueues({ repository, workspaceId: "workspace-a", today: new Date("2026-08-10") });
    expect(after.counts.pendingSuppliers).toBe(0);
  });

  test("missing evidence blocks verification through the route", async () => {
    seed(supplier({ canonicalId: "TE-SUP-NO-EVIDENCE", supplierId: "TE-SUP-NO-EVIDENCE", sourceEvidence: [], identityEvidence: [], phone: "+27000000000" }));
    const response = await VERIFY_MASTER_DATA(request("/api/master-data/supplier/TE-SUP-NO-EVIDENCE/verify", "POST"), params("supplier", "TE-SUP-NO-EVIDENCE"));
    expect(response.status).toBe(409);
  });

  test("expired quote can support historical evidence but not current pricing eligibility", async () => {
    const queues = await buildMasterDataReviewQueues({
      repository: new MemoryMasterDataRepository([supplier(), document()]),
      workspaceId: "workspace-a",
      today: new Date("2026-08-10"),
    });
    const record = queues.records.find((item) => item.entity.canonicalId === "TE-SUP-JCE-2021-628179-07");
    expect(record).toMatchObject({
      evidenceStatus: "expired",
      currentPricingEligibility: "NO_UPDATED_QUOTE_REQUIRED",
      linkedQuoteIds: ["SQ-2026-JCE-3744"],
    });
  });

  test("duplicate candidate is shown and not auto-merged", async () => {
    const duplicate = supplier({ canonicalId: "TE-SUP-JCE-DUP", supplierId: "TE-SUP-JCE-DUP", displayName: "J Centre P Duplicate" });
    const repository = new MemoryMasterDataRepository([supplier(), duplicate]);
    const queues = await buildMasterDataReviewQueues({ repository, workspaceId: "workspace-a" });
    expect(queues.counts.duplicateCandidates).toBe(1);
    expect(repository.records).toHaveLength(2);
  });

  test("canonical survivor is recorded without deleting the duplicate record", async () => {
    const duplicate = supplier({ canonicalId: "TE-SUP-JCE-DUP", supplierId: "TE-SUP-JCE-DUP", displayName: "J Centre P Duplicate" });
    const repository = new MemoryMasterDataRepository([supplier(), duplicate]);
    const resolution: DuplicateResolutionInput = {
      workspaceId: "workspace-a",
      entityType: "supplier",
      candidateAId: "TE-SUP-JCE-2021-628179-07",
      candidateBId: "TE-SUP-JCE-DUP",
      outcome: "same_entity",
      canonicalSurvivorId: "TE-SUP-JCE-2021-628179-07",
      reason: "same registration evidence",
    };
    const result = await resolveMasterDataDuplicate({ actor: actor(), repository, resolution, now });
    expect(result.survivor?.externalIdentifiers).toContainEqual({ system: "master_data_alias", value: "TE-SUP-JCE-DUP", status: "alias" });
    expect(repository.records).toHaveLength(2);
    expect(repository.audits.some((audit) => audit.action === "duplicate_resolution")).toBe(true);
  });

  test("duplicate resolve route records review required outcome", async () => {
    seed(supplier());
    seed(supplier({ canonicalId: "TE-SUP-JCE-DUP", supplierId: "TE-SUP-JCE-DUP" }));
    const response = await RESOLVE_DUPLICATE(request("/api/master-data/duplicates/resolve", "POST", {
      workspaceId: "workspace-a",
      entityType: "supplier",
      candidateAId: "TE-SUP-JCE-2021-628179-07",
      candidateBId: "TE-SUP-JCE-DUP",
      outcome: "review_required",
      reason: "needs original registration evidence",
    }));
    expect(response.status).toBe(200);
    expect(mockDb._store.masterDataAuditEvents.size).toBeGreaterThan(0);
  });

  test("reject action persists and archive preserves history", async () => {
    seed(supplier());
    const rejected = await REJECT_MASTER_DATA(request("/api/master-data/supplier/TE-SUP-JCE-2021-628179-07/reject", "POST"), params());
    expect(rejected.status).toBe(200);
    expect(mockDb._store.masterSuppliers.get("TE-SUP-JCE-2021-628179-07")).toMatchObject({ verificationStatus: "REJECTED", reviewStatus: "BLOCKED" });

    const archived = await ARCHIVE_MASTER_DATA(request("/api/master-data/supplier/TE-SUP-JCE-2021-628179-07/archive", "POST"), params());
    expect(archived.status).toBe(200);
    expect(mockDb._store.masterSuppliers.get("TE-SUP-JCE-2021-628179-07")).toMatchObject({ status: "archived", verificationStatus: "ARCHIVED" });
    expect(mockDb._store.masterDataAuditEvents.size).toBe(2);
  });

  test("Item review respects identity and pricing separation", async () => {
    const queues = await buildMasterDataReviewQueues({ repository: new MemoryMasterDataRepository([item()]), workspaceId: "workspace-a" });
    const itemRecord = queues.records.find((record) => record.entity.entityType === "item");
    expect(itemRecord?.queue).toBe("pendingItems");
    expect((itemRecord?.entity as CanonicalItem).priceReferenceIds).toEqual(["SPH-QUOTE-3744-L1"]);
    expect(itemRecord?.entity.verificationStatus).toBe("PENDING_REVIEW");
  });
});
