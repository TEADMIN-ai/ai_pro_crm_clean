const mockStore = new Map<string, Map<string, Record<string, unknown>>>();
const mockSet = jest.fn(async (collection: string, id: string, value: Record<string, unknown>, options?: { merge?: boolean }) => {
  if (!mockStore.has(collection)) mockStore.set(collection, new Map());
  const records = mockStore.get(collection)!;
  records.set(id, options?.merge ? { ...(records.get(id) ?? {}), ...value } : value);
});

function mockCollectionRecords(name: string) {
  if (!mockStore.has(name)) mockStore.set(name, new Map());
  return mockStore.get(name)!;
}

function mockQuery(name: string, filters: Array<[string, unknown]> = []) {
  return {
    where(field: string, _op: string, value: unknown) {
      return mockQuery(name, [...filters, [field, value]]);
    },
    limit() {
      return this;
    },
    async get() {
      const docs = Array.from(mockCollectionRecords(name).entries())
        .filter(([, data]) => filters.every(([field, value]) => data[field] === value))
        .map(([id, data]) => ({ id, data: () => data }));
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
          return { exists: Boolean(data), id, data: () => data };
        },
        set: (value: Record<string, unknown>, options?: { merge?: boolean }) => mockSet(name, id, value, options),
      }),
      add: jest.fn(),
      where: (field: string, op: string, value: unknown) => mockQuery(name).where(field, op, value),
    }),
  }),
}));

import {
  createClientCandidateForDeal,
  linkVerifiedClientToDeal,
  resolveDealClientIdentity,
} from "@/server/services/clientIdentityService";
import type { AuthorizedUser } from "@/lib/server/authz";
import type { CanonicalClient } from "@/types/masterData";

const actor: AuthorizedUser = { uid: "staff-1", role: "staff", workspaceId: "workspace-a" };

function seed(collection: string, id: string, data: Record<string, unknown>) {
  mockCollectionRecords(collection).set(id, data);
}

function client(overrides: Partial<CanonicalClient> = {}): CanonicalClient {
  return {
    entityType: "client",
    canonicalId: "TE-CLI-1",
    displayName: "TEST CLIENT",
    legalName: "TEST CLIENT",
    tradingName: null,
    externalIdentifiers: [],
    workspaceId: "workspace-a",
    organisationId: null,
    status: "active",
    provenance: "USER_CONFIRMED",
    verificationStatus: "VERIFIED",
    reviewStatus: "READY_FOR_USE",
    sourceEvidence: [{ sourcePath: "deals/deal-1" }],
    notes: null,
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    createdBy: "staff-1",
    updatedBy: "staff-1",
    registrationNumber: null,
    contactDetails: {},
    billingDetails: {},
    industrySector: null,
    relatedSiteIds: [],
    relatedOpportunityIds: [],
    relatedProjectIds: [],
    documentIds: [],
    ...overrides,
  };
}

beforeEach(() => {
  mockStore.clear();
  mockSet.mockClear();
  seed("deals", "deal-1", { id: "deal-1", workspaceId: "workspace-a", clientName: "/ Issuer TEST CLIENT" });
});

test("extracted client text alone is insufficient for Client Quote authority", async () => {
  const result = await resolveDealClientIdentity({ dealId: "deal-1", actor });
  expect(result).toMatchObject({ status: "CLIENT_REVIEW_REQUIRED", canonicalId: null, nextAction: "Verify Client Identity" });
});

test("governed candidate creation creates pending review client without automatic verification", async () => {
  const result = await createClientCandidateForDeal({ dealId: "deal-1", actor });
  expect(result.entity).toMatchObject({ entityType: "client", verificationStatus: "PENDING_REVIEW", reviewStatus: "REVIEW_REQUIRED" });
  expect(mockCollectionRecords("masterClients").get(result.entity.canonicalId)?.verificationStatus).toBe("PENDING_REVIEW");
  expect(mockCollectionRecords("clientQuotes").size).toBe(0);
});

test("ambiguous canonical matches fail closed", async () => {
  seed("masterClients", "TE-CLI-1", client());
  seed("masterClients", "TE-CLI-2", client({ canonicalId: "TE-CLI-2" }));
  await expect(createClientCandidateForDeal({ dealId: "deal-1", actor })).rejects.toMatchObject({ code: "AMBIGUOUS_CLIENT_MATCH" });
});

test("unverified client cannot be linked as commercial authority", async () => {
  seed("masterClients", "TE-CLI-1", client({ verificationStatus: "PENDING_REVIEW", reviewStatus: "REVIEW_REQUIRED" }));
  await expect(linkVerifiedClientToDeal({ dealId: "deal-1", canonicalId: "TE-CLI-1", actor })).rejects.toMatchObject({ code: "CLIENT_NOT_VERIFIED" });
});

test("verified client linkage persists canonical deal shape and audit", async () => {
  seed("masterClients", "TE-CLI-1", client());
  const result = await linkVerifiedClientToDeal({ dealId: "deal-1", canonicalId: "TE-CLI-1", actor });
  expect(result.clientId).toBe("TE-CLI-1");
  expect(mockCollectionRecords("deals").get("deal-1")).toMatchObject({
    clientId: "TE-CLI-1",
    clientMasterDataReference: { canonicalId: "TE-CLI-1", verificationStatus: "VERIFIED", source: "masterClients" },
  });
  expect(mockCollectionRecords("dealClientIdentityAuditEvents").size).toBe(1);
  expect(mockCollectionRecords("clientQuotes").size).toBe(0);
});

test("linkage is workspace scoped", async () => {
  seed("masterClients", "TE-CLI-1", client({ workspaceId: "workspace-b" }));
  await expect(linkVerifiedClientToDeal({ dealId: "deal-1", canonicalId: "TE-CLI-1", actor })).rejects.toMatchObject({ code: "CLIENT_WORKSPACE_MISMATCH" });
});

test("unauthorized linkage fails", async () => {
  seed("masterClients", "TE-CLI-1", client());
  await expect(linkVerifiedClientToDeal({ dealId: "deal-1", canonicalId: "TE-CLI-1", actor: { ...actor, role: "viewer" } })).rejects.toMatchObject({ status: 403 });
});

test("legacy client field variants remain readable while new writes use clientId", async () => {
  seed("masterClients", "TE-CLI-1", client());
  seed("deals", "deal-1", { id: "deal-1", workspaceId: "workspace-a", Client_ID: "TE-CLI-1" });
  await expect(resolveDealClientIdentity({ dealId: "deal-1", actor })).resolves.toMatchObject({ status: "RESOLVED_VERIFIED", canonicalId: "TE-CLI-1" });
  await linkVerifiedClientToDeal({ dealId: "deal-1", canonicalId: "TE-CLI-1", actor });
  expect(mockCollectionRecords("deals").get("deal-1")).toHaveProperty("clientId", "TE-CLI-1");
});
