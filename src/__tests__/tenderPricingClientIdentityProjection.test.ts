jest.mock("firebase-admin/firestore", () => ({
  Timestamp: { fromDate: (date: Date) => date },
  FieldPath: { documentId: () => "__name__" },
}));

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
        set: jest.fn(),
      }),
      where: (field: string, op: string, value: unknown) => mockQuery(name).where(field, op, value),
    }),
  }),
}));

import { getTenderPricingWorkspaceForDeal } from "@/server/services/tenderPricingService";
import type { AuthorizedUser } from "@/lib/server/authz";

const actor: AuthorizedUser = { uid: "manager-1", role: "manager", workspaceId: "workspace-1" };

function seed(collection: string, id: string, data: Record<string, unknown>) {
  mockCollectionRecords(collection).set(id, data);
}

function seedPricing(overrides: Record<string, unknown> = {}) {
  seed("tenderPricingWorkspaces", "pricing-1", {
    id: "pricing-1",
    workspaceId: "workspace-1",
    opportunityId: "deal-1",
    dealId: "deal-1",
    pricingStatus: "LOCKED",
    validationStatus: "VALIDATED",
    lockStatus: "LOCKED",
    nextAction: "Client identity required",
    clientIdentityStatus: "CLIENT_REVIEW_REQUIRED",
    clientIdentityBlocker: "Client identity required",
    clientIdentityNextAction: "Verify Client Identity",
    ...overrides,
  });
}

function seedVerifiedClient(id = "TE-CLI-1", overrides: Record<string, unknown> = {}) {
  seed("masterClients", id, {
    entityType: "client",
    canonicalId: id,
    displayName: "TEST CLIENT",
    legalName: "TEST CLIENT",
    workspaceId: "workspace-1",
    status: "active",
    verificationStatus: "VERIFIED",
    reviewStatus: "READY_FOR_USE",
    ...overrides,
  });
}

beforeEach(() => {
  mockStore.clear();
  seed("users", actor.uid, { workspaceId: actor.workspaceId });
});

test("linked verified deal client removes Tender Pricing client identity blocker on page rebuild", async () => {
  seed("deals", "deal-1", { id: "deal-1", workspaceId: "workspace-1", clientId: "TE-CLI-1", clientName: "TEST CLIENT" });
  seedVerifiedClient();
  seedPricing();

  const pricing = await getTenderPricingWorkspaceForDeal("deal-1", actor);

  expect(pricing).toMatchObject({
    clientIdentityStatus: "RESOLVED_VERIFIED",
    clientIdentityCanonicalId: "TE-CLI-1",
    clientIdentityBlocker: null,
    clientIdentityNextAction: null,
    nextAction: "Send approved priced document to Submission Review.",
  });
});

test("missing linkage still projects Verify Client Identity for locked pricing", async () => {
  seed("deals", "deal-1", { id: "deal-1", workspaceId: "workspace-1", clientName: "TEST CLIENT" });
  seedPricing({ nextAction: "Send approved priced document to Submission Review.", clientIdentityBlocker: null });

  const pricing = await getTenderPricingWorkspaceForDeal("deal-1", actor);

  expect(pricing).toMatchObject({
    clientIdentityStatus: "CLIENT_REVIEW_REQUIRED",
    clientIdentityCanonicalId: null,
    clientIdentityBlocker: "Client identity required",
    clientIdentityNextAction: "Verify Client Identity",
    nextAction: "Client identity required",
  });
});

test("unverified linked client remains blocked", async () => {
  seed("deals", "deal-1", { id: "deal-1", workspaceId: "workspace-1", clientId: "TE-CLI-1", clientName: "TEST CLIENT" });
  seedVerifiedClient("TE-CLI-1", { verificationStatus: "PENDING_REVIEW", reviewStatus: "REVIEW_REQUIRED" });
  seedPricing({ clientIdentityBlocker: null });

  const pricing = await getTenderPricingWorkspaceForDeal("deal-1", actor);

  expect(pricing).toMatchObject({
    clientIdentityStatus: "CLIENT_VERIFICATION_REQUIRED",
    clientIdentityCanonicalId: "TE-CLI-1",
    clientIdentityBlocker: "Client identity required",
    clientIdentityNextAction: "Verify Client Identity",
  });
});

test("legacy supported client fields still resolve on Tender Pricing projection", async () => {
  seed("deals", "deal-1", { id: "deal-1", workspaceId: "workspace-1", Client_ID: "TE-CLI-1" });
  seedVerifiedClient();
  seedPricing();

  const pricing = await getTenderPricingWorkspaceForDeal("deal-1", actor);

  expect(pricing).toMatchObject({
    clientIdentityStatus: "RESOLVED_VERIFIED",
    clientIdentityCanonicalId: "TE-CLI-1",
    clientIdentityBlocker: null,
  });
});
