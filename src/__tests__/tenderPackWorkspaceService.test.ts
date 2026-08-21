const stores = new Map<string, Map<string, Record<string, unknown>>>();

function collectionStore(name: string) {
  let store = stores.get(name);
  if (!store) {
    store = new Map();
    stores.set(name, store);
  }
  return store;
}

function snapshot(id: string, data?: Record<string, unknown>) {
  return { id, exists: Boolean(data), data: () => data };
}

function query(name: string, filters: Array<[string, unknown]> = []) {
  return {
    where(field: string, _op: string, value: unknown) {
      return query(name, [...filters, [field, value]]);
    },
    async get() {
      return {
        docs: Array.from(collectionStore(name).entries())
          .filter(([, data]) => filters.every(([field, value]) => data[field] === value))
          .map(([id, data]) => snapshot(id, data)),
      };
    },
  };
}

jest.mock("@/lib/firebase/admin", () => ({
  getFirebaseAdmin: () => ({
    collection: (name: string) => ({
      doc: (id: string) => ({
        async get() {
          return snapshot(id, collectionStore(name).get(id));
        },
      }),
      where: (field: string, op: string, value: unknown) => query(name).where(field, op, value),
    }),
  }),
}));

import { getTenderPackWorkspaceState } from "@/server/services/tenderPackWorkspaceService";
import type { AuthorizedUser } from "@/lib/server/authz";

const actor: AuthorizedUser = { uid: "ops-1", role: "manager", workspaceId: "workspace-1" };

function seed(collection: string, id: string, data: Record<string, unknown>) {
  collectionStore(collection).set(id, data);
}

function seedReadyDeal() {
  seed("users", "ops-1", { workspaceId: "workspace-1" });
  seed("deals", "deal-1", {
    id: "deal-1",
    title: "Test RFQ",
    workspaceId: "workspace-1",
    contractorAssignment: { contractorId: "contractor-1" },
  });
  seed("contractors", "contractor-1", {
    companyName: "Torque Empire",
    complianceApproved: true,
    tenderLockStatus: "READY",
    docsMissing: 0,
    expiredDocumentCount: 0,
  });
  seed("clientQuotes", "client-quote-1", {
    clientQuoteId: "client-quote-1",
    opportunityId: "deal-1",
    workspaceId: "workspace-1",
    clientId: "client-1",
    status: "APPROVED",
    generatedDocumentId: "priced-doc-1",
    lines: [{ approvedBy: "manager-1", approvedAt: "2026-08-21T00:00:00.000Z", sellingUnitRate: 10 }],
  });
  seed("masterDocuments", "priced-doc-1", {
    documentId: "priced-doc-1",
    documentType: "PRICED_TENDER_DOCUMENT",
    linkedEntityId: "deal-1",
    workspaceId: "workspace-1",
    status: "active",
    verificationStatus: "VERIFIED",
    storagePath: "priced/document.json",
  });
}

beforeEach(() => {
  stores.clear();
});

test("deal-scoped workspace resolves approved Client Quote and generation payload", async () => {
  seedReadyDeal();

  const state = await getTenderPackWorkspaceState({ dealId: "deal-1", actor });

  expect(state.clientQuote).toMatchObject({ clientQuoteId: "client-quote-1", status: "APPROVED" });
  expect(state.generationPayload).toEqual({ dealId: "deal-1", clientQuoteId: "client-quote-1" });
  expect(state.canGenerate).toBe(true);
  expect(state.durableReady).toBe(false);
  expect(state.blockers).toContain("Durable Tender Pack must be generated");
});

test("durable readiness is derived from active VERIFIED TENDER_PACK master document", async () => {
  seedReadyDeal();
  seed("tenderPacks", "pack-1", {
    dealId: "deal-1",
    opportunityId: "deal-1",
    workspaceId: "workspace-1",
    clientQuoteId: "client-quote-1",
    governanceMode: "GOVERNED",
    storagePath: "tenderPacks/governed/workspace-1/deal-1/contractor-1/pack.pdf",
  });
  seed("masterDocuments", "tender-pack-doc-1", {
    documentId: "tender-pack-doc-1",
    documentType: "TENDER_PACK",
    linkedEntityId: "deal-1",
    workspaceId: "workspace-1",
    status: "active",
    verificationStatus: "VERIFIED",
    reviewStatus: "READY_FOR_USE",
    storagePath: "tenderPacks/governed/workspace-1/deal-1/contractor-1/pack.pdf",
  });

  const state = await getTenderPackWorkspaceState({ dealId: "deal-1", actor });

  expect(state.durableReady).toBe(true);
  expect(state.tenderPackDocument).toMatchObject({ documentId: "tender-pack-doc-1", documentType: "TENDER_PACK", verificationStatus: "VERIFIED" });
  expect(state.tenderPacks).toHaveLength(1);
});

test("missing approved Client Quote fails closed", async () => {
  seedReadyDeal();
  collectionStore("clientQuotes").clear();

  const state = await getTenderPackWorkspaceState({ dealId: "deal-1", actor });

  expect(state.clientQuote).toBeNull();
  expect(state.generationPayload).toBeNull();
  expect(state.canGenerate).toBe(false);
  expect(state.blockers).toContain("Approved Client Quote must be generated");
});

test("workspace mismatch is rejected before projecting generation state", async () => {
  seedReadyDeal();

  await expect(getTenderPackWorkspaceState({ dealId: "deal-1", actor: { ...actor, workspaceId: "foreign-workspace" } })).rejects.toMatchObject({ status: 403 });
});
