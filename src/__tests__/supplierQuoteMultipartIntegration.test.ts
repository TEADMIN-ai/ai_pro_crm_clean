import { NextRequest } from "next/server";
import type { UserRole } from "@/lib/auth/roleUtils";
import type { AuthorizedUser } from "@/lib/server/authz";
import type { CanonicalDocumentReference, CanonicalSupplier } from "@/types/masterData";

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
  getFirebaseStorageBucket: () => ({ file: () => ({ save: jest.fn(async () => undefined) }) }),
}));

import { POST as POST_SUPPLIER_QUOTES } from "@/app/api/supplier-quotes/route";

type Row = Record<string, unknown>;
type Store = Record<string, Map<string, Row>>;
type Filter = { field: string; value: unknown };

function findUndefinedPath(value: unknown, path = "data"): string | null {
  if (value === undefined) return path;
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const result = findUndefinedPath(value[index], path + "." + index);
      if (result) return result;
    }
    return null;
  }
  if (value && typeof value === "object") {
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      const result = findUndefinedPath(entry, path + "." + key);
      if (result) return result;
    }
  }
  return null;
}

const now = "2026-08-13T08:00:00.000Z";

function createMockFirestore() {
  const store: Store = {};
  let sequence = 0;

  const collection = (path: string) => ({
    doc: (id?: string) => {
      const docId = id ?? `generated-${++sequence}`;
      const fullPath = `${path}/${docId}`;
      return {
        id: docId,
        async get() {
          const data = store[path]?.get(docId);
          return { id: docId, exists: Boolean(data), data: () => data };
        },
        async set(data: Row, options?: { merge?: boolean }) {
          const undefinedPath = findUndefinedPath(data);
          if (undefinedPath) throw new Error(`Cannot use undefined as a Firestore value at ${undefinedPath}`);
          store[path] ??= new Map();
          const previous = store[path].get(docId) ?? {};
          store[path].set(docId, options?.merge ? { ...previous, ...data } : data);
        },
        collection: (child: string) => collection(`${fullPath}/${child}`),
      };
    },
    where: (field: string | { isEqual?: (other: unknown) => boolean }, operator: string, value: unknown) => {
      const filters: Filter[] = [{ field: typeof field === "string" ? field : "__name__", value }];
      const query = {
        where: (nextField: string | { isEqual?: (other: unknown) => boolean }, _operator: string, nextValue: unknown) => {
          filters.push({ field: typeof nextField === "string" ? nextField : "__name__", value: nextValue });
          return query;
        },
        limit: () => query,
        async get() {
          const rows = Array.from(store[path]?.entries() ?? []);
          const docs = rows
            .filter(([id, data]) => filters.every((filter) => matchesFilter(id, data, filter)))
            .map(([id, data]) => ({ id, data: () => data }));
          return { docs, empty: docs.length === 0 };
        },
      };
      return query;
    },
    limit: () => ({
      async get() {
        const docs = Array.from(store[path]?.entries() ?? []).map(([id, data]) => ({ id, data: () => data }));
        return { docs, empty: docs.length === 0 };
      },
    }),
  });

  return { _store: store, collection };
}

function matchesFilter(id: string, data: Row, filter: Filter): boolean {
  if (filter.field === "__name__") {
    return Array.isArray(filter.value) ? filter.value.includes(id) : id === filter.value;
  }
  return data[filter.field] === filter.value;
}

function seed(collection: string, id: string, data: Row) {
  mockDb._store[collection] ??= new Map();
  mockDb._store[collection].set(id, data);
}

function staff(workspaceId = "workspace-a"): AuthorizedUser {
  return {
    uid: "staff-1",
    email: "staff@example.test",
    role: "staff",
    workspaceId,
  } as AuthorizedUser;
}

function supplier(overrides: Partial<CanonicalSupplier> = {}): CanonicalSupplier {
  const canonicalId = overrides.canonicalId ?? "TE-SUP-EXISTING";
  const displayName = overrides.displayName ?? "TEOS Staging Supply Co";
  return {
    entityType: "supplier",
    supplierId: canonicalId,
    canonicalId,
    displayName,
    legalName: displayName,
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
    createdBy: "seed",
    updatedBy: "seed",
    registrationNumber: "2025/111111/07",
    vatNumber: null,
    contactPerson: null,
    email: null,
    phone: null,
    address: null,
    regionCoverage: [],
    paymentTerms: null,
    linkedSourceId: null,
    identityEvidence: [],
    documentIds: [],
    ...overrides,
  };
}

function masterDocument(overrides: Partial<CanonicalDocumentReference> = {}): CanonicalDocumentReference {
  const canonicalId = overrides.canonicalId ?? "MDOC-existing";
  return {
    entityType: "document",
    documentId: canonicalId,
    canonicalId,
    documentType: "SUPPLIER_QUOTE",
    linkedEntityType: "supplier",
    linkedEntityId: "TE-SUP-EXISTING",
    displayName: "staging-supplier.pdf",
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
    createdBy: "seed",
    updatedBy: "seed",
    sourcePath: null,
    storagePath: null,
    filename: "staging-supplier.pdf",
    uploadedBy: "seed",
    uploadedAt: now,
    ...overrides,
  };
}

function seedBase(actorWorkspaceId = "workspace-a") {
  seed("users", "staff-1", { workspaceId: actorWorkspaceId });
  seed("deals", "deal-1", {
    id: "deal-1",
    workspaceId: "workspace-a",
    contractorAssignment: {
      contractorId: "contractor-1",
      contractorName: "Torque Empire (Pty) Ltd",
    },
    opportunityExecution: {
      requirements: { lineItems: ["Item A"] },
    },
  });
}

function multipart(overrides: Record<string, string | null | undefined> = {}) {
  const formData = new FormData();
  const values: Record<string, string | null | undefined> = {
    dealId: "deal-1",
    opportunityId: "opp-1",
    workspaceId: "workspace-a",
    contractorId: "contractor-1",
    contractorName: "Torque Empire (Pty) Ltd",
    supplierName: "TEOS Staging Supply Co",
    supplierRegistrationNumber: "2026/999999/07",
    supplierEmail: "staging-supplier@example.test",
    quotationNumber: "STG-SQ-001",
    sourceFileName: "staging-supplier.pdf",
    validityDate: "2026-08-31",
    total: "30500",
    ...overrides,
  };
  Object.entries(values).forEach(([key, value]) => {
    if (value !== null && value !== undefined) formData.set(key, value);
  });
  return formData;
}

async function postSupplierQuote(formData = multipart()) {
  return POST_SUPPLIER_QUOTES(new NextRequest("https://teos.test/api/supplier-quotes", {
    method: "POST",
    body: formData,
  }));
}

describe("supplier quote multipart supplier identity resolution", () => {
  beforeEach(() => {
    mockDb = createMockFirestore();
    mockRequireAuthorizedUser.mockReset();
    mockRequireAuthorizedUser.mockResolvedValue(staff());
    seedBase();
  });

  it("uses registration-backed multipart identity instead of document/name-only ambiguity", async () => {
    seed("masterSuppliers", "TE-SUP-OTHER-REG", supplier({ canonicalId: "TE-SUP-OTHER-REG", supplierId: "TE-SUP-OTHER-REG", registrationNumber: "2025/111111/07" }));
    seed("masterDocuments", "MDOC-existing", masterDocument());

    const response = await postSupplierQuote();
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload.error).toBeUndefined();
    expect(payload.quote.supplierId).toBe("TE-SUP-TEOS-STAGING-SUPPLY-CO-2026-999999-07");
    expect(payload.quote.supplierRegistrationNumber).toBe("2026/999999/07");
    expect(payload.quote.masterDocumentId).toMatch(/^MDOC-/);
    expect(mockDb._store.masterSuppliers.has("TE-SUP-TEOS-STAGING-SUPPLY-CO-2026-999999-07")).toBe(true);
  });

  it("reuses an exact normalized registration match from canonical suppliers", async () => {
    seed("masterSuppliers", "TE-SUP-CANONICAL", supplier({
      canonicalId: "TE-SUP-CANONICAL",
      supplierId: "TE-SUP-CANONICAL",
      registrationNumber: "202699999907",
    }));

    const response = await postSupplierQuote();
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload.quote.supplierId).toBe("TE-SUP-CANONICAL");
    expect(Array.from(mockDb._store.masterSuppliers.keys()).filter((id) => id.includes("TEOS-STAGING-SUPPLY")).length).toBe(0);
  });

  it("creates a separate governed candidate for the same name with a different registration", async () => {
    seed("masterSuppliers", "TE-SUP-DIFFERENT-REG", supplier({
      canonicalId: "TE-SUP-DIFFERENT-REG",
      supplierId: "TE-SUP-DIFFERENT-REG",
      registrationNumber: "2024/222222/07",
    }));

    const response = await postSupplierQuote();
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload.quote.supplierId).toBe("TE-SUP-TEOS-STAGING-SUPPLY-CO-2026-999999-07");
    expect(payload.quote.supplierId).not.toBe("TE-SUP-DIFFERENT-REG");
  });

  it("keeps name-only ambiguity fail-closed when no strong identifier is present", async () => {
    seed("masterSuppliers", "TE-SUP-A", supplier({ canonicalId: "TE-SUP-A", supplierId: "TE-SUP-A", registrationNumber: "2025/111111/07" }));
    seed("masterSuppliers", "TE-SUP-B", supplier({ canonicalId: "TE-SUP-B", supplierId: "TE-SUP-B", registrationNumber: "2025/222222/07" }));

    const response = await postSupplierQuote(multipart({
      supplierRegistrationNumber: null,
      supplierEmail: null,
    }));
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload.error).toMatch(/ambiguous/i);
  });

  it("enforces workspace ownership before supplier resolution", async () => {
    mockRequireAuthorizedUser.mockResolvedValue(staff("workspace-b"));
    seed("users", "staff-1", { workspaceId: "workspace-b" });

    const response = await postSupplierQuote();
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload.error).toBe("Cross-workspace access rejected");
    expect(mockDb._store.masterSuppliers).toBeUndefined();
  });
});

describe("supplier quote multipart persistence normalization", () => {
  beforeEach(() => {
    mockDb = createMockFirestore();
    mockRequireAuthorizedUser.mockReset();
    mockRequireAuthorizedUser.mockResolvedValue(staff());
    seedBase();
  });

  it("uploads the staging multipart field set without quotationDate or undefined Firestore fields", async () => {
    const response = await postSupplierQuote(multipart({
      quotationDate: null,
      paymentTerms: null,
      deliveryPeriod: null,
      supplierPhone: null,
      supplierContactName: null,
      uploadedDocumentId: null,
      storagePath: null,
    }));
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload.error).toBeUndefined();
    expect(payload.quote.quotationDate).toBeNull();
    expect(payload.quote.validityDate).toBe("2026-08-31");
    expect(payload.quote.total).toBe(30500);
    expect(findUndefinedPath(payload.quote)).toBeNull();
    const persisted = Array.from(mockDb._store.supplierQuotes.values())[0];
    expect(findUndefinedPath(persisted)).toBeNull();
    expect(persisted.quotationDate).toBeNull();
    expect(persisted.supplierRegistrationNumber).toBe("2026/999999/07");
    expect(persisted.supplierEmail).toBe("staging-supplier@example.test");
  });

  it("persists a supplied quotationDate without replacing it", async () => {
    const response = await postSupplierQuote(multipart({ quotationDate: "2026-08-13", quotationNumber: "STG-SQ-002" }));
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload.quote.quotationDate).toBe("2026-08-13");
    const persisted = Array.from(mockDb._store.supplierQuotes.values())[0];
    expect(persisted.quotationDate).toBe("2026-08-13");
    expect(findUndefinedPath(persisted)).toBeNull();
  });
});
