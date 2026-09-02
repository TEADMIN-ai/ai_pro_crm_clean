const getFirebaseAdmin = jest.fn();
const getFirebaseStorageBucket = jest.fn();

jest.mock("@/lib/firebase/admin", () => ({
  getFirebaseAdmin: () => getFirebaseAdmin(),
  getFirebaseStorageBucket: () => getFirebaseStorageBucket(),
}));

jest.mock("@/lib/pdf/extractTextFromPdf", () => ({
  extractTextFromPdfDetailed: jest.fn(),
}));

jest.mock("@/lib/vehicle-finance/config/featureFlags", () => ({
  getVehicleFinanceFeatureFlags: () => ({ ENABLE_VEHICLE_FINANCE_LICENCE_INTELLIGENCE: false }),
}));

jest.mock("@/lib/vehicle-finance/intelligence/driverLicenceIntelligenceJobs", () => ({ queueVehicleFinanceDriverLicenceIntelligence: jest.fn() }));
jest.mock("@/lib/vehicle-finance/intelligence/identityIntelligenceJobs", () => ({ queueVehicleFinanceIdentityIntelligence: jest.fn() }));
jest.mock("@/lib/vehicle-finance/intelligence/payslipIntelligenceJobs", () => ({ queueVehicleFinancePayslipIntelligence: jest.fn() }));
jest.mock("@/lib/vehicle-finance/intelligence/bankStatementIntelligenceJobs", () => ({ queueVehicleFinanceBankStatementIntelligence: jest.fn() }));

import {
  createVehicleFinanceBusinessClient,
  createVehicleFinanceCustomer,
  createVehicleFinanceProcurementCase,
  createVehicleFinanceSupplier,
  createVehicleFinanceSupplierQuote,
  getVehicleFinanceOverview,
  getVehicleFinancePartnerPortalOverview,
  publishVehicleFinancePartnerVisibleStatus,
  updateVehicleFinancePartnerQuoteAction,
  updateVehicleFinanceProcurementCaseLifecycle,
} from "@/lib/vehicleFinance/vehicleFinanceService";
import {
  VEHICLE_FINANCE_PARTNER_MESSAGE_TEMPLATES,
  VEHICLE_FINANCE_PARTNER_VISIBLE_STATUSES,
} from "@/types/vehicleFinance";

function createMemoryDb() {
  const store = new Map<string, Map<string, Record<string, unknown>>>();
  const ensure = (name: string) => {
    if (!store.has(name)) store.set(name, new Map());
    return store.get(name)!;
  };
  const snapshotFor = (id: string, data: Record<string, unknown> | undefined) => ({ id, exists: Boolean(data), data: () => data });
  const collection = jest.fn((name: string) => ({
    doc: jest.fn((id?: string) => {
      const docId = id ?? "generated-doc";
      return {
        set: jest.fn(async (value: Record<string, unknown>, options?: { merge?: boolean }) => {
          const records = ensure(name);
          records.set(docId, options?.merge ? { ...(records.get(docId) ?? {}), ...value } : value);
        }),
        get: jest.fn(async () => snapshotFor(docId, ensure(name).get(docId))),
      };
    }),
    add: jest.fn(async (value: Record<string, unknown>) => {
      const docId = name + "-" + (ensure(name).size + 1);
      ensure(name).set(docId, value);
      return { id: docId };
    }),
    where: jest.fn((field: string, op: string, expected: unknown) => ({
      limit: jest.fn((count: number) => ({
        get: jest.fn(async () => ({ docs: Array.from(ensure(name).entries()).filter(([, value]) => value[field] === expected).slice(0, count).map(([id, value]) => snapshotFor(id, value)), size: Array.from(ensure(name).values()).filter((value) => value[field] === expected).length, empty: !Array.from(ensure(name).values()).some((value) => value[field] === expected) })),
      })),
      get: jest.fn(async () => ({ docs: Array.from(ensure(name).entries()).filter(([, value]) => value[field] === expected).map(([id, value]) => snapshotFor(id, value)), size: Array.from(ensure(name).values()).filter((value) => value[field] === expected).length })),
    })),
    limit: jest.fn((count: number) => ({ get: jest.fn(async () => ({ docs: Array.from(ensure(name).entries()).slice(0, count).map(([id, value]) => snapshotFor(id, value)), size: Math.min(ensure(name).size, count) })) })),
  }));
  const db = {
    collection,
    runTransaction: jest.fn(async (callback) => callback({
      get: (ref) => ref.get(),
      set: (ref, value, options) => ref.set(value, options),
    })),
  };
  return { db, store };
}

const actor = { actorId: "staff-1", actorRole: "vehicleFinanceStaff", actorName: "staff@example.com" };

describe("vehicle finance business procurement governance", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getFirebaseStorageBucket.mockReturnValue({});
  });

  test("validates business-client creation before persistence", async () => {
    const { db, store } = createMemoryDb();
    getFirebaseAdmin.mockReturnValue(db);

    await expect(createVehicleFinanceBusinessClient({ registrationNumber: "2026/1", primaryContact: "A Contact", phone: "010", email: "a@example.com" }, actor)).rejects.toThrow("Legal name is required");
    expect(store.get("vehicleFinanceBusinessClients")?.size ?? 0).toBe(0);
  });

  test("registers a supplier without hard-coded brand assumptions", async () => {
    const { db } = createMemoryDb();
    getFirebaseAdmin.mockReturnValue(db);

    const supplier = await createVehicleFinanceSupplier({ legalName: "Any Dealer Pty Ltd", tradingName: "Any Dealer Midrand", supplierCategory: "DEALER", classification: "FRANCHISE", brandsRepresented: ["Brand A", "Brand B"], primarySalesContact: "Dealer Sales", email: "dealer@example.com", phone: "011", relationshipStatus: "CONFIRMED", preferredSupplier: true }, actor);

    expect(supplier.supplierId).toEqual(expect.any(String));
    expect(supplier.brandsRepresented).toEqual(["Brand A", "Brand B"]);
    expect(supplier.relationshipStatus).toBe("CONFIRMED");
    expect(supplier.operatingDivision).toBe("Torque Empire Car Division");
  });

  test("enforces procurement-case lifecycle transitions", async () => {
    const { db } = createMemoryDb();
    getFirebaseAdmin.mockReturnValue(db);
    const client = await createVehicleFinanceBusinessClient({ legalName: "VFS", registrationNumber: "2026/001", primaryContact: "Fleet Lead", phone: "010", email: "fleet@example.com" }, actor);
    const procurementCase = await createVehicleFinanceProcurementCase({ businessClientId: client.businessClientId, clientRequestor: "Fleet Lead", internalReference: "TE-001", accountOwner: "Torque Owner", vehicleQuantity: 2, make: "Any", model: "Sedan", condition: "NEW", purchaseMethod: "PURCHASE_ORDER" }, actor);

    await expect(updateVehicleFinanceProcurementCaseLifecycle(procurementCase.procurementCaseId, "SOURCING", actor)).rejects.toThrow("Invalid procurement lifecycle transition");
    const advanced = await updateVehicleFinanceProcurementCaseLifecycle(procurementCase.procurementCaseId, "REQUIREMENT_CONFIRMED", actor);
    expect(advanced.lifecycleStatus).toBe("REQUIREMENT_CONFIRMED");
  });

  test("links supplier quotations to canonical supplier and case IDs", async () => {
    const { db } = createMemoryDb();
    getFirebaseAdmin.mockReturnValue(db);
    const client = await createVehicleFinanceBusinessClient({ legalName: "VFS", registrationNumber: "2026/001", primaryContact: "Fleet Lead", phone: "010", email: "fleet@example.com" }, actor);
    const supplier = await createVehicleFinanceSupplier({ legalName: "BMW Midrand", supplierCategory: "DEALER", classification: "FRANCHISE", brandsRepresented: ["BMW"], primarySalesContact: "Corporate Sales", email: "bmw@example.com", phone: "011", relationshipStatus: "CONFIRMED" }, actor);
    const procurementCase = await createVehicleFinanceProcurementCase({ businessClientId: client.businessClientId, clientRequestor: "Fleet Lead", internalReference: "TE-002", accountOwner: "Torque Owner", vehicleQuantity: 1, make: "BMW", model: "X3", condition: "NEW", purchaseMethod: "FINANCE" }, actor);

    const quote = await createVehicleFinanceSupplierQuote({ supplierId: supplier.supplierId, procurementCaseId: procurementCase.procurementCaseId, vehicleDescription: "BMW X3 demo", quotedAmount: 850000, availability: "In stock", quoteState: "SUBMITTED" }, actor);

    expect(quote.supplierId).toBe(supplier.supplierId);
    expect(quote.procurementCaseId).toBe(procurementCase.procurementCaseId);
    expect(quote.quoteState).toBe("SUBMITTED");
    expect(quote.operatingDivision).toBe("Torque Empire Car Division");
  });

  test("fails closed when quotations reference nonexistent suppliers or cases", async () => {
    const { db } = createMemoryDb();
    getFirebaseAdmin.mockReturnValue(db);

    await expect(createVehicleFinanceSupplierQuote({ supplierId: "missing-supplier", procurementCaseId: "missing-case", vehicleDescription: "Audi sedan", quotedAmount: 700000, availability: "2 weeks" }, actor)).rejects.toThrow("Supplier not found");
  });

  test("overview exposes client and supplier relationships for rendering", async () => {
    const { db } = createMemoryDb();
    getFirebaseAdmin.mockReturnValue(db);
    const client = await createVehicleFinanceBusinessClient({ legalName: "VFS", registrationNumber: "2026/001", primaryContact: "Fleet Lead", phone: "010", email: "fleet@example.com" }, actor);
    const supplier = await createVehicleFinanceSupplier({ legalName: "Audi Sandton", supplierCategory: "DEALER", classification: "FRANCHISE", brandsRepresented: ["Audi"], primarySalesContact: "Fleet Sales", email: "audi@example.com", phone: "011", relationshipStatus: "CONFIRMED" }, actor);
    const procurementCase = await createVehicleFinanceProcurementCase({ businessClientId: client.businessClientId, clientRequestor: "Fleet Lead", internalReference: "TE-003", accountOwner: "Torque Owner", vehicleQuantity: 3, make: "Audi", model: "A4", condition: "NEW", purchaseMethod: "PURCHASE_ORDER" }, actor);
    await createVehicleFinanceSupplierQuote({ supplierId: supplier.supplierId, procurementCaseId: procurementCase.procurementCaseId, vehicleDescription: "Audi A4 fleet", quotedAmount: 650000, availability: "Factory order", quoteState: "SUBMITTED" }, actor);

    const overview = await getVehicleFinanceOverview();
    expect(overview.businessClients[0].businessClientId).toBe(client.businessClientId);
    expect(overview.procurementCases[0].businessClientId).toBe(client.businessClientId);
    expect(overview.supplierQuotes[0].supplierId).toBe(supplier.supplierId);
    expect(overview.procurementSummary.quotesAwaitingClientDecision).toBe(1);
  });

  test("individual customer creation remains in the original customer collection", async () => {
    const { db, store } = createMemoryDb();
    getFirebaseAdmin.mockReturnValue(db);

    const customer = await createVehicleFinanceCustomer({ firstName: "Individual", lastName: "Applicant", idNumber: "9001015009087", phone: "082", email: "person@example.com", address: "1 Road", employer: "Employer", monthlyIncome: 45000 }, actor);

    expect(customer.customerId).toEqual(expect.any(String));
    expect(customer.operatingDivision).toBe("Torque Empire Car Division");
    expect(store.get("vehicleFinanceCustomers")?.size).toBe(1);
    expect(store.get("vehicleFinanceBusinessClients")?.size ?? 0).toBe(0);
  });

  test("partner portal exposes only the authenticated supplier organisation, quotes, cases, documents and timeline", async () => {
    const { db } = createMemoryDb();
    getFirebaseAdmin.mockReturnValue(db);
    const client = await createVehicleFinanceBusinessClient({ legalName: "Fleet Client", registrationNumber: "2026/SC", primaryContact: "Fleet Lead", phone: "010", email: "fleet@example.com" }, actor);
    const supplierA = await createVehicleFinanceSupplier({ legalName: "Supplier A", supplierCategory: "DEALER", classification: "FRANCHISE", brandsRepresented: ["Brand A"], primarySalesContact: "A Sales", email: "a@example.com", phone: "011", relationshipStatus: "CONFIRMED", commercialNotes: "Internal margin-sensitive note" }, actor);
    const supplierB = await createVehicleFinanceSupplier({ legalName: "Supplier B", supplierCategory: "DEALER", classification: "FRANCHISE", brandsRepresented: ["Brand B"], primarySalesContact: "B Sales", email: "b@example.com", phone: "012", relationshipStatus: "CONFIRMED" }, actor);
    const caseA = await createVehicleFinanceProcurementCase({ businessClientId: client.businessClientId, clientRequestor: "Confidential A", internalReference: "TE-A", accountOwner: "Owner", vehicleQuantity: 1, make: "Brand A", model: "SUV", condition: "NEW", purchaseMethod: "PURCHASE_ORDER", budget: 900000, notes: "Internal client note" }, actor);
    const caseB = await createVehicleFinanceProcurementCase({ businessClientId: client.businessClientId, clientRequestor: "Confidential B", internalReference: "TE-B", accountOwner: "Owner", vehicleQuantity: 1, make: "Brand B", model: "Sedan", condition: "NEW", purchaseMethod: "PURCHASE_ORDER", budget: 700000 }, actor);
    const quoteA = await createVehicleFinanceSupplierQuote({ supplierId: supplierA.supplierId, procurementCaseId: caseA.procurementCaseId, vehicleDescription: "A SUV", quotedAmount: 800000, availability: "In stock", notes: "Internal quote scoring note", supportingDocuments: [{ fileName: "a-quote.pdf", fileUrl: "https://example.com/a.pdf" }] }, actor);
    const quoteB = await createVehicleFinanceSupplierQuote({ supplierId: supplierB.supplierId, procurementCaseId: caseB.procurementCaseId, vehicleDescription: "B Sedan", quotedAmount: 650000, availability: "Factory order", supportingDocuments: [{ fileName: "b-quote.pdf", fileUrl: "https://example.com/b.pdf" }] }, actor);

    const overview = await getVehicleFinancePartnerPortalOverview({ supplierId: supplierA.supplierId, actorId: "partner-a", actorRole: "vehicleFinancePartner", actorName: "partner-a@example.com" });

    expect(overview.supplier).toMatchObject({ supplierId: supplierA.supplierId, legalName: "Supplier A" });
    expect(JSON.stringify(overview)).toContain(quoteA.supplierQuoteId);
    expect(JSON.stringify(overview)).toContain(caseA.procurementCaseId);
    expect(JSON.stringify(overview)).toContain("a-quote.pdf");
    expect(JSON.stringify(overview)).not.toContain(quoteB.supplierQuoteId);
    expect(JSON.stringify(overview)).not.toContain(caseB.procurementCaseId);
    expect(JSON.stringify(overview)).not.toContain("b-quote.pdf");
    expect(JSON.stringify(overview)).not.toContain("Supplier B");
    expect(JSON.stringify(overview)).not.toContain("650000");
    expect(JSON.stringify(overview)).not.toContain(client.businessClientId);
    expect(JSON.stringify(overview)).not.toContain("Confidential A");
    expect(JSON.stringify(overview)).not.toContain("Internal margin-sensitive note");
    expect(JSON.stringify(overview)).not.toContain("Internal quote scoring note");
  });

  test("partner quote actions update only owned quote fields and never internal lifecycle authority", async () => {
    const { db, store } = createMemoryDb();
    getFirebaseAdmin.mockReturnValue(db);
    const client = await createVehicleFinanceBusinessClient({ legalName: "Fleet Client", registrationNumber: "2026/SC", primaryContact: "Fleet Lead", phone: "010", email: "fleet@example.com" }, actor);
    const supplierA = await createVehicleFinanceSupplier({ legalName: "Supplier A", supplierCategory: "DEALER", classification: "FRANCHISE", brandsRepresented: ["Brand A"], primarySalesContact: "A Sales", email: "a@example.com", phone: "011", relationshipStatus: "CONFIRMED" }, actor);
    const supplierB = await createVehicleFinanceSupplier({ legalName: "Supplier B", supplierCategory: "DEALER", classification: "FRANCHISE", brandsRepresented: ["Brand B"], primarySalesContact: "B Sales", email: "b@example.com", phone: "012", relationshipStatus: "CONFIRMED" }, actor);
    const procurementCase = await createVehicleFinanceProcurementCase({ businessClientId: client.businessClientId, clientRequestor: "Fleet Lead", internalReference: "TE-A", accountOwner: "Owner", vehicleQuantity: 1, make: "Brand A", model: "SUV", condition: "NEW", purchaseMethod: "PURCHASE_ORDER" }, actor);
    const quoteA = await createVehicleFinanceSupplierQuote({ supplierId: supplierA.supplierId, procurementCaseId: procurementCase.procurementCaseId, vehicleDescription: "A SUV", quotedAmount: 800000, availability: "In stock" }, actor);
    const quoteB = await createVehicleFinanceSupplierQuote({ supplierId: supplierB.supplierId, procurementCaseId: procurementCase.procurementCaseId, vehicleDescription: "B SUV", quotedAmount: 780000, availability: "In stock" }, actor);

    await expect(updateVehicleFinancePartnerQuoteAction(quoteB.supplierQuoteId, { action: "UPDATE_AVAILABILITY", availability: "Available now" }, { supplierId: supplierA.supplierId, actorId: "partner-a", actorRole: "vehicleFinancePartner", actorName: "partner-a@example.com" })).rejects.toThrow("Supplier quote not found");

    const updated = await updateVehicleFinancePartnerQuoteAction(quoteA.supplierQuoteId, { action: "REVISE_QUOTE", quotedAmount: 790000, availability: "Ready in 7 days", expectedDeliveryDate: "2026-10-10", colourSpecificationConfirmed: true, supplierReference: "SUP-A-1", lifecycleStatus: "COMPLETED", quoteState: "SELECTED", partnerVisibleStatus: "SELECTED", internalNotes: "Injected note", renderedPartnerMessage: "Injected supplier message", document: { fileName: "support.pdf", fileUrl: "https://example.com/support.pdf" } }, { supplierId: supplierA.supplierId, actorId: "partner-a", actorRole: "vehicleFinancePartner", actorName: "partner-a@example.com" });

    expect(updated).toMatchObject({ supplierQuoteId: quoteA.supplierQuoteId, quotedAmount: 790000, availability: "Ready in 7 days", partnerVisibleStatus: "QUOTE_RECEIVED", expectedDeliveryDate: "2026-10-10", colourSpecificationConfirmed: true, supplierReference: "SUP-A-1" });
    expect(JSON.stringify(updated)).not.toContain("Injected note");
    const storedCase = store.get("vehicleFinanceProcurementCases")?.get(procurementCase.procurementCaseId) as any;
    const storedQuote = store.get("vehicleFinanceSupplierQuotes")?.get(quoteA.supplierQuoteId) as any;
    expect(storedCase.lifecycleStatus).toBe("DRAFT");
    expect(storedCase.internalStatus).toBe("DRAFT");
    expect(storedQuote.quoteState).toBe("SUBMITTED");
    expect(storedQuote.internalNotes).toBeNull();
    expect(storedQuote.renderedPartnerMessage).toBeNull();
    expect(storedQuote.supportingDocuments.map((document: any) => document.fileName)).toContain("support.pdf");
  });

});

describe("vehicle finance partner-visible status publication governance", () => {
  beforeEach(() => { jest.clearAllMocks(); getFirebaseStorageBucket.mockReturnValue({}); });
  async function createPublishedQuoteFixture() { const { db, store } = createMemoryDb(); getFirebaseAdmin.mockReturnValue(db); const client = await createVehicleFinanceBusinessClient({ legalName: "Fleet Client", registrationNumber: "2026/PUB", primaryContact: "Fleet Lead", phone: "010", email: "fleet@example.com" }, actor); const supplier = await createVehicleFinanceSupplier({ legalName: "Supplier A", supplierCategory: "DEALER", classification: "FRANCHISE", brandsRepresented: ["Brand A"], primarySalesContact: "A Sales", email: "a@example.com", phone: "011", relationshipStatus: "CONFIRMED" }, actor); const procurementCase = await createVehicleFinanceProcurementCase({ businessClientId: client.businessClientId, clientRequestor: "Fleet Lead", internalReference: "TE-PUB", accountOwner: "Owner", vehicleQuantity: 1, make: "Brand A", model: "SUV", condition: "NEW", purchaseMethod: "PURCHASE_ORDER" }, actor); const quote = await createVehicleFinanceSupplierQuote({ supplierId: supplier.supplierId, procurementCaseId: procurementCase.procurementCaseId, vehicleDescription: "A SUV", quotedAmount: 800000, availability: "In stock" }, actor); return { store, supplier, procurementCase, quote }; }
  test("partner and unauthorized roles cannot update partner-visible status", async () => { const { supplier, quote } = await createPublishedQuoteFixture(); await expect(publishVehicleFinancePartnerVisibleStatus(quote.supplierQuoteId, { partnerVisibleStatus: "UNDER_REVIEW" }, { supplierId: supplier.supplierId, actorId: "partner-a", actorRole: "vehicleFinancePartner", actorName: "partner-a@example.com" } as any)).rejects.toThrow("unauthorized"); await expect(publishVehicleFinancePartnerVisibleStatus(quote.supplierQuoteId, { partnerVisibleStatus: "UNDER_REVIEW" }, { actorId: "contractor-1", actorRole: "contractor", actorName: "contractor@example.com" })).rejects.toThrow("unauthorized"); });
  test("valid internal roles publish partner-visible status and create audit/timeline metadata", async () => { const { store, procurementCase, quote } = await createPublishedQuoteFixture(); const published = await publishVehicleFinancePartnerVisibleStatus(quote.supplierQuoteId, { partnerVisibleStatus: "UNDER_REVIEW", messageTemplateId: "under_review_default" }, actor); expect(published.partnerVisibleStatus).toBe("UNDER_REVIEW"); expect(published.partnerVisibleStatusUpdatedBy).toBe(actor.actorId); expect(published.partnerVisibleStatusUpdatedAt).toEqual(expect.any(String)); expect(published.messageTemplateId).toBe("under_review_default"); expect(published.renderedPartnerMessage).toBe("Your quotation is currently under review."); expect(published.publishedBy).toBe(actor.actorId); expect(published.publishedAt).toEqual(expect.any(String)); expect(published.partnerPublicationOrder).toBe(1); expect(store.get("vehicleFinanceProcurementCases")?.get(procurementCase.procurementCaseId)).toMatchObject({ partnerPublicationSequence: 1 }); expect(published.partnerActivityHistory.at(-1)).toMatchObject({ status: "UNDER_REVIEW", note: "Your quotation is currently under review." }); expect(Array.from(store.get("auditLogs")?.values() ?? []).some((entry) => entry.eventType === "VEHICLE_FINANCE_PARTNER_VISIBLE_STATUS_PUBLISHED")).toBe(true); });
  test("same-status quotes without provenance create the initial governed publication", async () => {
    const { store, procurementCase, quote } = await createPublishedQuoteFixture();
    const published = await publishVehicleFinancePartnerVisibleStatus(quote.supplierQuoteId, { partnerVisibleStatus: "QUOTE_RECEIVED", messageTemplateId: "quote_received_received" }, actor);
    const auditEntries = Array.from(store.get("auditLogs")?.values() ?? []).filter((entry: any) => entry.eventType === "VEHICLE_FINANCE_PARTNER_VISIBLE_STATUS_PUBLISHED" && entry.targetId === quote.supplierQuoteId);

    expect(published).toMatchObject({ partnerVisibleStatus: "QUOTE_RECEIVED", messageTemplateId: "quote_received_received", renderedPartnerMessage: "Your quotation has been received by Torque Empire.", partnerPublicationOrder: 1, publishedBy: actor.actorId });
    expect(published.publishedAt).toEqual(expect.any(String));
    expect(published.partnerActivityHistory).toHaveLength(2);
    expect(published.partnerActivityHistory.at(-1)).toMatchObject({ status: "QUOTE_RECEIVED", note: "Your quotation has been received by Torque Empire." });
    expect(store.get("vehicleFinanceProcurementCases")?.get(procurementCase.procurementCaseId)).toMatchObject({ partnerPublicationSequence: 1 });
    expect(auditEntries).toHaveLength(1);
  });

  test("same-status invalid templates fail closed before initial publication", async () => {
    const { store, quote } = await createPublishedQuoteFixture();
    await expect(publishVehicleFinancePartnerVisibleStatus(quote.supplierQuoteId, { partnerVisibleStatus: "QUOTE_RECEIVED", messageTemplateId: "under_review_default" }, actor)).rejects.toThrow("Invalid partner-visible message template");
    const storedQuote = store.get("vehicleFinanceSupplierQuotes")?.get(quote.supplierQuoteId) as any;
    expect(storedQuote.publishedAt).toBeNull();
    expect(Array.from(store.get("auditLogs")?.values() ?? []).some((entry: any) => entry.eventType === "VEHICLE_FINANCE_PARTNER_VISIBLE_STATUS_PUBLISHED")).toBe(false);
  });

  test("same complete status and template are idempotent", async () => {
    const { store, procurementCase, quote } = await createPublishedQuoteFixture();
    const first = await publishVehicleFinancePartnerVisibleStatus(quote.supplierQuoteId, { partnerVisibleStatus: "QUOTE_RECEIVED", messageTemplateId: "quote_received_received" }, actor);
    const second = await publishVehicleFinancePartnerVisibleStatus(quote.supplierQuoteId, { partnerVisibleStatus: "QUOTE_RECEIVED", messageTemplateId: "quote_received_received" }, actor);
    const auditEntries = Array.from(store.get("auditLogs")?.values() ?? []).filter((entry: any) => entry.eventType === "VEHICLE_FINANCE_PARTNER_VISIBLE_STATUS_PUBLISHED" && entry.targetId === quote.supplierQuoteId);

    expect(second).toEqual(first);
    expect(second.partnerActivityHistory).toHaveLength(2);
    expect(second.partnerPublicationOrder).toBe(1);
    expect(store.get("vehicleFinanceProcurementCases")?.get(procurementCase.procurementCaseId)).toMatchObject({ partnerPublicationSequence: 1 });
    expect(auditEntries).toHaveLength(1);
  });

  test("invalid partner-visible transitions fail closed", async () => { const { store, quote } = await createPublishedQuoteFixture(); await expect(publishVehicleFinancePartnerVisibleStatus(quote.supplierQuoteId, { partnerVisibleStatus: "COMPLETED" }, actor)).rejects.toThrow("Invalid partner-visible status transition"); const storedQuote = store.get("vehicleFinanceSupplierQuotes")?.get(quote.supplierQuoteId) as any; expect(storedQuote.partnerVisibleStatus).toBe("QUOTE_RECEIVED"); expect(storedQuote.partnerVisibleStatusUpdatedBy).toBeNull(); });
  test("published partner-visible status appears in supplier overview and timeline", async () => { const { supplier, quote } = await createPublishedQuoteFixture(); await publishVehicleFinancePartnerVisibleStatus(quote.supplierQuoteId, { partnerVisibleStatus: "UNDER_REVIEW", messageTemplateId: "under_review_default" }, actor); const overview = await getVehicleFinancePartnerPortalOverview({ supplierId: supplier.supplierId, actorId: "partner-a", actorRole: "vehicleFinancePartner", actorName: "partner-a@example.com" }); expect(JSON.stringify(overview.supplierQuotes)).toContain("UNDER_REVIEW"); expect(overview.timeline.some((entry) => entry.status === "UNDER_REVIEW" && entry.note === "Your quotation is currently under review.")).toBe(true); });
  test("partner-visible status publication rejects restricted supplier-visible notes", async () => { const { quote } = await createPublishedQuoteFixture(); await expect(publishVehicleFinancePartnerVisibleStatus(quote.supplierQuoteId, { partnerVisibleStatus: "REVISION_REQUESTED", messageTemplateId: "revision_requested_default", reviewedCustomMessage: "Internal margin and client budget are approved", reviewedCustomMessageApproved: true }, actor)).rejects.toThrow("restricted information"); });
  test("reviewed custom partner messages are stored only for explicitly enabled templates", async () => { const { quote } = await createPublishedQuoteFixture(); const revision = await publishVehicleFinancePartnerVisibleStatus(quote.supplierQuoteId, { partnerVisibleStatus: "REVISION_REQUESTED", messageTemplateId: "revision_requested_default", reviewedCustomMessage: "Please upload the revised quotation with updated delivery timing.", reviewedCustomMessageApproved: true }, actor); expect(revision.messageTemplateId).toBe("revision_requested_default"); expect(revision.renderedPartnerMessage).toBe("Please upload the revised quotation with updated delivery timing."); expect(revision.partnerActivityHistory.at(-1)?.note).toBe("Please upload the revised quotation with updated delivery timing."); });
  test("curated template publication ignores restricted legacy message fields", async () => { const { quote } = await createPublishedQuoteFixture(); const published = await publishVehicleFinancePartnerVisibleStatus(quote.supplierQuoteId, { partnerVisibleStatus: "UNDER_REVIEW", messageTemplateId: "under_review_default", partnerMessage: "Internal margin and client budget", internalNotes: "Competitor pricing" }, actor); expect(published.renderedPartnerMessage).toBe("Your quotation is currently under review."); expect(JSON.stringify(published)).not.toContain("client budget"); expect(JSON.stringify(published.partnerActivityHistory)).not.toContain("Competitor pricing"); });

  test("provides a curated template for every supported partner-visible status", () => {
    expect(new Set(VEHICLE_FINANCE_PARTNER_MESSAGE_TEMPLATES.map((template) => template.status))).toEqual(new Set(VEHICLE_FINANCE_PARTNER_VISIBLE_STATUSES));
  });
  test("invalid template and status combinations fail closed before a no-op publication", async () => {
    const { quote } = await createPublishedQuoteFixture();
    await expect(publishVehicleFinancePartnerVisibleStatus(quote.supplierQuoteId, { partnerVisibleStatus: "QUOTE_RECEIVED", messageTemplateId: "under_review_default" }, actor)).rejects.toThrow("Invalid partner-visible message template");
  });
  test("partner quote actions cannot alter published template or rendered message data", async () => {
    const { supplier, quote } = await createPublishedQuoteFixture();
    const published = await publishVehicleFinancePartnerVisibleStatus(quote.supplierQuoteId, { partnerVisibleStatus: "UNDER_REVIEW", messageTemplateId: "under_review_default" }, actor);
    const updated = await updateVehicleFinancePartnerQuoteAction(quote.supplierQuoteId, { action: "UPDATE_AVAILABILITY", availability: "Ready now", messageTemplateId: "revision_requested_default", renderedPartnerMessage: "Injected message", publishedAt: "2026-01-01T00:00:00.000Z", publishedBy: "partner-a" }, { supplierId: supplier.supplierId, actorId: "partner-a", actorRole: "vehicleFinancePartner", actorName: "partner-a@example.com" });
    expect(updated).toMatchObject({ messageTemplateId: published.messageTemplateId, renderedPartnerMessage: published.renderedPartnerMessage, publishedAt: published.publishedAt });
    expect(updated).not.toHaveProperty("publishedBy");
  });
  test("partner projections omit internal publication identifiers while exposing the approved message", async () => {
    const { supplier, quote } = await createPublishedQuoteFixture();
    await publishVehicleFinancePartnerVisibleStatus(quote.supplierQuoteId, { partnerVisibleStatus: "UNDER_REVIEW", messageTemplateId: "under_review_default" }, actor);
    const overview = await getVehicleFinancePartnerPortalOverview({ supplierId: supplier.supplierId, actorId: "partner-a", actorRole: "vehicleFinancePartner", actorName: "partner-a@example.com" });
    const projectedQuote = overview.supplierQuotes[0] as Record<string, unknown>;
    expect(projectedQuote).toMatchObject({ partnerVisibleStatus: "UNDER_REVIEW", renderedPartnerMessage: "Your quotation is currently under review." });
    expect(projectedQuote).not.toHaveProperty("partnerVisibleStatusUpdatedBy");
    expect(projectedQuote).not.toHaveProperty("publishedBy");
    expect(JSON.stringify(projectedQuote)).not.toContain("staff-1");
  });
  test("case projection selects the newer complete publication and ignores incomplete records", async () => {
    const { store, supplier, procurementCase, quote } = await createPublishedQuoteFixture();
    const laterQuote = await createVehicleFinanceSupplierQuote({ supplierId: supplier.supplierId, procurementCaseId: procurementCase.procurementCaseId, vehicleDescription: "A SUV alternative", quotedAmount: 810000, availability: "In stock" }, actor);
    const incompleteQuote = await createVehicleFinanceSupplierQuote({ supplierId: supplier.supplierId, procurementCaseId: procurementCase.procurementCaseId, vehicleDescription: "Unpublished SUV", quotedAmount: 820000, availability: "In stock" }, actor);
    await publishVehicleFinancePartnerVisibleStatus(quote.supplierQuoteId, { partnerVisibleStatus: "UNDER_REVIEW", messageTemplateId: "under_review_default" }, actor);
    await publishVehicleFinancePartnerVisibleStatus(laterQuote.supplierQuoteId, { partnerVisibleStatus: "UNDER_REVIEW", messageTemplateId: "under_review_default" }, actor);
    await publishVehicleFinancePartnerVisibleStatus(laterQuote.supplierQuoteId, { partnerVisibleStatus: "SUBMITTED_TO_CLIENT", messageTemplateId: "submitted_to_client_default" }, actor);
    await publishVehicleFinancePartnerVisibleStatus(laterQuote.supplierQuoteId, { partnerVisibleStatus: "CLIENT_REVIEW", messageTemplateId: "client_review_default" }, actor);

    const records = store.get("vehicleFinanceSupplierQuotes")!;
    records.set(quote.supplierQuoteId, { ...records.get(quote.supplierQuoteId)!, publishedAt: "2026-09-02T10:00:00.000Z", partnerPublicationOrder: 99 });
    records.set(laterQuote.supplierQuoteId, { ...records.get(laterQuote.supplierQuoteId)!, publishedAt: "2026-09-02T10:00:01.000Z", partnerPublicationOrder: 1 });
    records.set(incompleteQuote.supplierQuoteId, { ...records.get(incompleteQuote.supplierQuoteId)!, partnerVisibleStatus: "COMPLETED", messageTemplateId: "completed_default", renderedPartnerMessage: "This procurement transaction has been completed.", publishedAt: "2026-09-02T10:00:02.000Z", partnerPublicationOrder: 100, publishedBy: null });

    const overview = await getVehicleFinancePartnerPortalOverview({ supplierId: supplier.supplierId, actorId: "partner-a", actorRole: "vehicleFinancePartner", actorName: "partner-a@example.com" });
    const projectedCase = overview.procurementCases.find((item) => item.procurementCaseId === procurementCase.procurementCaseId) as Record<string, unknown>;
    expect(projectedCase).toMatchObject({ partnerVisibleStatus: "CLIENT_REVIEW", renderedPartnerMessage: "The client is currently reviewing the submitted quotation." });
  });

  test("case projection uses server publication order for equal timestamps", async () => {
    const { store, supplier, procurementCase, quote } = await createPublishedQuoteFixture();
    const laterQuote = await createVehicleFinanceSupplierQuote({ supplierId: supplier.supplierId, procurementCaseId: procurementCase.procurementCaseId, vehicleDescription: "A SUV alternative", quotedAmount: 810000, availability: "In stock" }, actor);
    await publishVehicleFinancePartnerVisibleStatus(quote.supplierQuoteId, { partnerVisibleStatus: "UNDER_REVIEW", messageTemplateId: "under_review_default" }, actor);
    await publishVehicleFinancePartnerVisibleStatus(laterQuote.supplierQuoteId, { partnerVisibleStatus: "UNDER_REVIEW", messageTemplateId: "under_review_default" }, actor);
    await publishVehicleFinancePartnerVisibleStatus(laterQuote.supplierQuoteId, { partnerVisibleStatus: "SUBMITTED_TO_CLIENT", messageTemplateId: "submitted_to_client_default" }, actor);
    await publishVehicleFinancePartnerVisibleStatus(laterQuote.supplierQuoteId, { partnerVisibleStatus: "CLIENT_REVIEW", messageTemplateId: "client_review_default" }, actor);

    const records = store.get("vehicleFinanceSupplierQuotes")!;
    records.set(quote.supplierQuoteId, { ...records.get(quote.supplierQuoteId)!, publishedAt: "2026-09-02T10:00:00.000Z", partnerPublicationOrder: 1 });
    records.set(laterQuote.supplierQuoteId, { ...records.get(laterQuote.supplierQuoteId)!, publishedAt: "2026-09-02T10:00:00.000Z", partnerPublicationOrder: 2 });

    const selections = await Promise.all(Array.from({ length: 3 }, async () => {
      const overview = await getVehicleFinancePartnerPortalOverview({ supplierId: supplier.supplierId, actorId: "partner-a", actorRole: "vehicleFinancePartner", actorName: "partner-a@example.com" });
      return overview.procurementCases.find((item) => item.procurementCaseId === procurementCase.procurementCaseId);
    }));

    expect(selections).toEqual(Array(3).fill(expect.objectContaining({ partnerVisibleStatus: "CLIENT_REVIEW", renderedPartnerMessage: "The client is currently reviewing the submitted quotation." })));
  });

  test("case projection fails safely before any complete publication exists", async () => {
    const { supplier, procurementCase } = await createPublishedQuoteFixture();
    const overview = await getVehicleFinancePartnerPortalOverview({ supplierId: supplier.supplierId, actorId: "partner-a", actorRole: "vehicleFinancePartner", actorName: "partner-a@example.com" });
    const projectedCase = overview.procurementCases.find((item) => item.procurementCaseId === procurementCase.procurementCaseId) as Record<string, unknown>;
    expect(projectedCase).toMatchObject({ partnerVisibleStatus: null, renderedPartnerMessage: null });
  });
});
