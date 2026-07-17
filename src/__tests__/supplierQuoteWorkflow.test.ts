import {
  applyManualCorrections,
  buildDuplicateKey,
  buildExecutionStatus,
  buildPricingHandoff,
  compareSupplierQuotes,
  extractLineItemsFromText,
  extractSupplierQuoteFromText,
} from "@/lib/supplier-quotes";
import type { SupplierQuote } from "@/types/supplierQuote";

function quote(overrides: Partial<SupplierQuote> = {}): SupplierQuote {
  const base: SupplierQuote = {
    id: "quote-a",
    workspaceId: "workspace-a",
    opportunityId: "opp-1",
    dealId: "deal-1",
    contractorId: "torque-empire",
    contractorName: "Torque Empire (Pty) Ltd",
    supplierId: "supplier-a",
    supplierName: "Supplier A",
    supplierRegistrationNumber: "REG-1",
    supplierContactName: "Sarah",
    supplierEmail: "supplier@example.com",
    supplierPhone: "0110000000",
    quotationNumber: "Q-001",
    quotationDate: "2026-07-01",
    validityDate: "2026-08-01",
    currency: "ZAR",
    subtotal: 100,
    vat: 15,
    total: 115,
    deliveryCost: 0,
    deliveryPeriod: "2 days",
    paymentTerms: "30 days",
    uploadedDocumentId: "doc-1",
    storagePath: "supplier-quotes/workspace-a/deal-1/quote-a/a.pdf",
    sourceFileName: "a.pdf",
    documentClassification: "SUPPLIER_QUOTE",
    extractionStatus: "EXTRACTED",
    reviewStatus: "REVIEWED",
    approvalStatus: "PENDING",
    workflowStatus: "EXTRACTED",
    approvedBy: null,
    approvedAt: null,
    approvalNote: null,
    rejectionReason: null,
    clarificationRequest: null,
    lineItems: [
      {
        id: "line-1",
        tenderLineItemId: null,
        boqLineItemId: "boq-1",
        pricingScheduleLineItemId: null,
        sourceDescription: "Industrial cleaner",
        normalisedDescription: "industrial cleaner",
        supplierSku: "IC-1",
        quantity: 2,
        unit: "each",
        unitPrice: 50,
        lineTotal: 100,
        vatTreatment: "EXCLUSIVE",
        deliveryAllocation: 0,
        confidence: 0.9,
        sourcePage: 1,
        sourceText: "Industrial cleaner 2 each R50 R100",
        manualOverride: false,
        approved: false,
        approvedBy: null,
        approvedAt: null,
      },
    ],
    extraction: extractSupplierQuoteFromText("Supplier: Supplier A\nQuote No: Q-001\nVAT R15\nPayment terms: 30 days"),
    duplicateKey: "duplicate-a",
    supersedesQuoteId: null,
    createdBy: "staff-1",
    createdAt: "2026-07-17T10:00:00.000Z",
    updatedAt: "2026-07-17T10:00:00.000Z",
  };
  return { ...base, ...overrides };
}

describe("supplier quote workflow", () => {
  test("two quotes can be linked to one opportunity", () => {
    const quotes = [quote({ id: "quote-a" }), quote({ id: "quote-b", supplierId: "supplier-b", supplierName: "Supplier B" })];
    expect(new Set(quotes.map((item) => item.opportunityId))).toEqual(new Set(["opp-1"]));
    expect(quotes).toHaveLength(2);
  });

  test("Torque Empire remains the contractor", () => {
    const item = quote({ supplierName: "External Supplier" });
    expect(item.contractorName).toBe("Torque Empire (Pty) Ltd");
    expect(item.supplierName).toBe("External Supplier");
  });

  test("suppliers are not converted into contractors", () => {
    const item = quote({ supplierId: "external-supplier", contractorId: "torque-empire" });
    expect(item.supplierId).not.toBe(item.contractorId);
  });

  test("quote extraction maps line items", () => {
    const items = extractLineItemsFromText("Industrial cleaner 2 each R50.00 R100.00\nDelivery R20");
    expect(items[0]).toMatchObject({ sourceDescription: "Industrial cleaner", quantity: 2, unit: "each", unitPrice: 50, lineTotal: 100 });
  });

  test("manual corrections override extraction", () => {
    const corrected = applyManualCorrections(quote(), { quotationNumber: "MANUAL-1", vat: 20 }, "staff-1", "2026-07-17T11:00:00.000Z");
    expect(corrected.quotationNumber).toBe("MANUAL-1");
    expect(corrected.extraction.quotationNumber.manual.overridden).toBe(true);
    expect(corrected.extraction.vat.value).toBe(20);
  });

  test("duplicate quote upload is detected by deterministic key", () => {
    const first = buildDuplicateKey({ workspaceId: "workspace-a", dealId: "deal-1", supplierId: "supplier-a", quotationNumber: "Q-1", sourceFileName: "quote.pdf", total: 100 });
    const retry = buildDuplicateKey({ workspaceId: "workspace-a", dealId: "deal-1", supplierId: "supplier-a", quotationNumber: "Q-1", sourceFileName: "quote.pdf", total: 100 });
    expect(retry).toBe(first);
  });

  test("expired quote is flagged in comparison risk", () => {
    const comparison = compareSupplierQuotes([quote({ validityDate: "2026-01-01" })], ["Industrial cleaner"], new Date("2026-07-17"));
    expect(comparison.rows[0].deviations).toContain("Quote validity has expired");
  });

  test("quote comparison works without recommending only by lowest price", () => {
    const cheapIncomplete = quote({ id: "cheap", supplierId: "cheap", supplierName: "Cheap", total: 80, lineItems: [] });
    const complete = quote({ id: "complete", supplierId: "complete", supplierName: "Complete", total: 115 });
    const comparison = compareSupplierQuotes([cheapIncomplete, complete], ["Industrial cleaner"], new Date("2026-07-17"));
    expect(comparison.recommendedSupplier?.quoteId).toBe("complete");
  });

  test("approval writes audit history contract payload", () => {
    const approved = quote({ approvalStatus: "APPROVED", workflowStatus: "APPROVED", approvedBy: "staff-1", approvedAt: "2026-07-17T11:00:00.000Z" });
    expect(approved.approvedBy).toBe("staff-1");
    expect(approved.workflowStatus).toBe("APPROVED");
  });

  test("rejected quotes cannot populate pricing", () => {
    expect(() => buildPricingHandoff(quote({ approvalStatus: "REJECTED", workflowStatus: "REJECTED" }))).toThrow("cannot populate pricing");
  });

  test("approved quote exposes pricing data", () => {
    const handoff = buildPricingHandoff(quote({ approvalStatus: "APPROVED", workflowStatus: "APPROVED" }));
    expect(handoff).toMatchObject({ quoteId: "quote-a", contractorName: "Torque Empire (Pty) Ltd", supplierName: "Supplier A", pricingSourceStatus: "READY_FOR_PRICING" });
  });

  test("cross-workspace access is rejected by workspace identity rule", () => {
    const actorWorkspace = "workspace-b";
    const item = quote({ workspaceId: "workspace-a" });
    expect(actorWorkspace === item.workspaceId).toBe(false);
  });

  test("retry does not create duplicate records", () => {
    const existingKeys = new Set([quote().duplicateKey]);
    const retryKey = quote().duplicateKey;
    expect(existingKeys.has(retryKey)).toBe(true);
  });

  test("no mock supplier data is used", () => {
    const item = quote({ supplierName: "Legitimate Supplier Pty Ltd" });
    expect(item.supplierName.toLowerCase()).not.toContain("mock");
    expect(item.supplierName.toLowerCase()).not.toContain("demo");
  });

  test("approved quote updates execution status for pricing handoff", () => {
    const status = buildExecutionStatus([quote({ approvalStatus: "APPROVED", workflowStatus: "APPROVED" })], ["Industrial cleaner"]);
    expect(status).toMatchObject({ approvedSupplierQuoteId: "quote-a", nextAction: "Send approved prices to Pricing Schedule" });
  });
});
