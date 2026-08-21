const mockStore = new Map<string, Map<string, Record<string, unknown>>>();
const mockAdd = jest.fn(async (collection: string, data: Record<string, unknown>) => {
  const id = `add-${mockStore.get(collection)?.size ?? 0}`;
  mockCollectionRecords(collection).set(id, { id, ...data });
  return { id };
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
          return { exists: Boolean(data), id, data: () => data };
        },
        set: (data: Record<string, unknown>, options?: { merge?: boolean }) => {
          const records = mockCollectionRecords(name);
          records.set(id, options?.merge ? { ...(records.get(id) ?? {}), ...data } : data);
          return Promise.resolve();
        },
      }),
      add: (data: Record<string, unknown>) => mockAdd(name, data),
      where: (field: string, op: string, value: unknown) => mockQuery(name).where(field, op, value),
    }),
  }),
}));

import { createApprovedClientQuoteFromLockedPricing } from "@/server/services/clientQuoteAuthorityService";
import { PRICED_TENDER_DOCUMENT_TYPE } from "@/server/services/pricedDocumentAuthorityService";
import type { AuthorizedUser } from "@/lib/server/authz";
import type { TenderPricingWorkspace } from "@/types/tenderPricing";

const actor: AuthorizedUser = { uid: "manager-1", role: "manager", workspaceId: "workspace-1" };

function seed(collection: string, id: string, data: Record<string, unknown>) {
  mockCollectionRecords(collection).set(id, data);
}

function pricing(documentId = "MDOC-PRICED-pricing-1-r1"): TenderPricingWorkspace {
  return {
    id: "pricing-1",
    workspaceId: "workspace-1",
    opportunityId: "deal-1",
    dealId: "deal-1",
    contractorId: "torque",
    contractorName: "Torque Empire (Pty) Ltd",
    approvedSupplierQuoteIds: ["supplier-quote-1"],
    pricingStatus: "LOCKED",
    mappingStatus: "APPROVED",
    commercialReviewStatus: "STAFF_APPROVED",
    managementApprovalStatus: "MANAGER_APPROVED",
    documentFillStatus: "DOCUMENT_FILLED",
    validationStatus: "VALIDATED",
    lockStatus: "LOCKED",
    currency: "ZAR",
    subtotal: 100,
    vat: 15,
    total: 115,
    totalSupplierCost: 80,
    pricingAggregationMode: "FIXED_QUANTITY",
    deliveryCost: 0,
    handlingCost: 0,
    overheadCost: 0,
    riskAllowance: 0,
    contingency: 0,
    grossProfit: 20,
    grossMarginPercentage: 20,
    blockers: [],
    nextAction: "Send approved priced document to Submission Review.",
    revision: 1,
    revisions: [],
    approvals: [
      { status: "STAFF_APPROVED", role: "staff", revision: 1, approvedBy: "staff-1", approvedAt: "2026-08-01T00:00:00.000Z", total: 115, margin: 20 },
      { status: "MANAGER_APPROVED", role: "manager", revision: 1, approvedBy: "manager-1", approvedAt: "2026-08-01T00:00:00.000Z", total: 115, margin: 20 },
    ],
    documentFillEvidence: { sourceDocumentId: "source-doc", sourceDocumentPath: "source.pdf", pricedDocumentId: documentId, governedDocumentId: documentId, governedDocumentStatus: "VERIFIED", storagePath: "priced-documents/workspace-1/deal-1/pricing-1/revision-1/priced-document.json", originalPreserved: true, fieldMappings: [{ fieldName: "grandTotal", value: "115", source: "approved_pricing_record", confidence: 1 }], warnings: [], validationIssues: [] },
    lineItems: [{
      id: "line-1",
      itemCode: "ITEM-1",
      description: "Item 1",
      quantity: 1,
      unit: "each",
      compulsory: true,
      sourceCost: 80,
      supplierSubtotal: 80,
      deliveryAllocation: 0,
      handlingAllocation: 0,
      labourAllocation: 0,
      overheadAllocation: 0,
      riskAllowance: 0,
      contingency: 0,
      profitMargin: 20,
      vatTreatment: "EXCLUSIVE",
      tenderUnitPrice: 100,
      tenderLineTotal: 100,
      grossProfit: 20,
      grossMarginPercentage: 20,
      priceSource: "APPROVED_SUPPLIER_QUOTE",
      riskFlags: [],
      supplierOptions: [],
      calculationEvidence: { sourceCost: 80, additions: { delivery: 0, handling: 0, labour: 0, overhead: 0, risk: 0, contingency: 0 }, margin: 20, vat: 15, formula: "test", assumptions: [] },
      mapping: { id: "mapping-1", tenderLineItemId: "line-1", supplierQuoteId: "supplier-quote-1", supplierLineItemId: "supplier-line-1", supplierName: "Supplier", matchConfidence: 1, mappingReason: "approved", quantityConversion: 1, unitConversion: 1, conversionReason: "same unit", supplierUnitCost: 80, priceSource: "APPROVED_SUPPLIER_QUOTE", reviewStatus: "APPROVED" },
    }],
    createdBy: "staff-1",
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
  };
}

beforeEach(() => {
  mockStore.clear();
  mockAdd.mockClear();
  seed("deals", "deal-1", { id: "deal-1", workspaceId: "workspace-1", clientId: "TE-CLI-1" });
  seed("masterClients", "TE-CLI-1", { entityType: "client", canonicalId: "TE-CLI-1", workspaceId: "workspace-1", status: "active", verificationStatus: "VERIFIED", reviewStatus: "READY_FOR_USE" });
  seed("supplierQuotes", "supplier-quote-1", { id: "supplier-quote-1", masterDocumentId: "MDOC-SUPPLIER-QUOTE-1" });
});

test("synthetic pricedDocumentId without masterDocuments record is insufficient and creates no draft", async () => {
  await expect(createApprovedClientQuoteFromLockedPricing({ pricing: pricing("priced-pricing-1"), actor })).rejects.toMatchObject({ code: "PRICED_DOCUMENT_NOT_GOVERNED" });
  expect(mockCollectionRecords("clientQuotes").size).toBe(0);
});

test("successful handoff creates approved Client Quote with governed generatedDocumentId", async () => {
  const documentId = "MDOC-PRICED-pricing-1-r1";
  seed("masterDocuments", documentId, { entityType: "document", canonicalId: documentId, documentId, documentType: PRICED_TENDER_DOCUMENT_TYPE, linkedEntityId: "deal-1", workspaceId: "workspace-1", status: "active", verificationStatus: "VERIFIED", reviewStatus: "READY_FOR_USE", storagePath: "priced-documents/workspace-1/deal-1/pricing-1/revision-1/priced-document.json" });

  const quote = await createApprovedClientQuoteFromLockedPricing({ pricing: pricing(documentId), actor });

  expect(quote).toMatchObject({ status: "APPROVED", generatedDocumentId: documentId, clientId: "TE-CLI-1" });
  expect(quote.lines.every((line) => line.approvedBy === actor.uid && Boolean(line.approvedAt))).toBe(true);
  expect(Array.from(mockCollectionRecords("clientQuotes").values())).toHaveLength(1);
  expect(Array.from(mockCollectionRecords("clientQuotes").values())[0]).toMatchObject({ status: "APPROVED", generatedDocumentId: documentId });
});
