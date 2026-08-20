
const stores = new Map<string, Map<string, Record<string, unknown>>>();
const setCalls: Array<{ collection: string; id: string; data: Record<string, unknown> }> = [];
const addCalls: Array<{ collection: string; data: Record<string, unknown> }> = [];
function store(name: string) { let current = stores.get(name); if (!current) { current = new Map(); stores.set(name, current); } return current; }
function snap(id: string, data?: Record<string, unknown>) { return { id, exists: Boolean(data), data: () => data }; }

jest.mock("@/lib/firebase/admin", () => ({ getFirebaseAdmin: () => ({ collection: (name: string) => ({ doc: (id: string) => ({ get: jest.fn(async () => snap(id, store(name).get(id))), set: jest.fn(async (data: Record<string, unknown>) => { store(name).set(id, data); setCalls.push({ collection: name, id, data }); }) }), where: (field: string, op: string, value: unknown) => ({ get: jest.fn(async () => ({ docs: Array.from(store(name).entries()).filter(([, data]) => op === "==" && data[field] === value).map(([id, data]) => snap(id, data)) })) }), add: jest.fn(async (data: Record<string, unknown>) => { addCalls.push({ collection: name, data }); return { id: `${name}-${addCalls.length}` }; }) }) }) }));
import { registerTenderPackDocument, resolveVerifiedTenderPackDocument } from "@/server/services/tenderPackCommercialAuthorityService";
const actor = { uid: "ops-1", role: "staff" as const, workspaceId: "workspace-1" };

describe("Tender Pack commercial authority", () => {
  beforeEach(() => { jest.clearAllMocks(); stores.clear(); setCalls.length = 0; addCalls.length = 0; });
  it("registers a durable verified TENDER_PACK master document", async () => {
    const documentId = await registerTenderPackDocument({ packId: "pack-1", opportunityId: "deal-1", workspaceId: "workspace-1", clientQuoteId: "client-quote-1", storagePath: "tenderPacks/governed/workspace-1/deal-1/contractor-1/pack.pdf", filename: "pack.pdf", actor });
    expect(documentId).toBe("MDOC-TENDER-PACK-pack-1");
    expect(setCalls[0]).toMatchObject({ collection: "masterDocuments", id: "MDOC-TENDER-PACK-pack-1" });
    expect(setCalls[0].data).toMatchObject({ documentType: "TENDER_PACK", linkedEntityId: "deal-1", workspaceId: "workspace-1", verificationStatus: "VERIFIED", status: "active", storagePath: expect.any(String) });
    await expect(resolveVerifiedTenderPackDocument({ opportunityId: "deal-1", workspaceId: "workspace-1" })).resolves.toMatchObject({ documentId, documentType: "TENDER_PACK" });
  });
  it("rejects missing durable document even when execution flags exist elsewhere", async () => {
    await expect(resolveVerifiedTenderPackDocument({ opportunityId: "deal-1", workspaceId: "workspace-1" })).rejects.toMatchObject({ code: "TENDER_PACK_DOCUMENT_REQUIRED" });
  });
});

