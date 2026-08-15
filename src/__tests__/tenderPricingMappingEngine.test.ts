import { buildTenderPricingWorkspace } from "@/lib/tender-pricing";
import { normalizeTenderLineDescription } from "@/server/services/tenderPricingCanonicalSources";
import type { SupplierQuote } from "@/types/supplierQuote";
import type { TenderPricingTenderLineItem } from "@/types/tenderPricing";

function line(overrides: Partial<TenderPricingTenderLineItem> = {}): TenderPricingTenderLineItem {
  return { id: "line-1", itemCode: "A4-PAPER", description: "A4 copy paper 80gsm box of 5 reams", quantity: 10, unit: "box", compulsory: true, sourcePage: 1, sourceDocumentId: "boq-doc", ...overrides };
}

function quote(overrides: Partial<SupplierQuote> = {}): SupplierQuote {
  return {
    id: "quote-a", workspaceId: "workspace-a", opportunityId: "deal-1", dealId: "deal-1", contractorId: "torque", contractorName: "Torque Empire (Pty) Ltd", supplierId: "supplier-a", supplierName: "Supplier A", supplierRegistrationNumber: null, supplierContactName: null, supplierEmail: null, supplierPhone: null, quotationNumber: "Q-1", quotationDate: null, validityDate: "2026-08-31", currency: "ZAR", subtotal: 1250, vat: 187.5, total: 1437.5, deliveryCost: 0, deliveryPeriod: null, paymentTerms: null, uploadedDocumentId: "doc", storagePath: "quote.pdf", sourceFileName: "quote.pdf", documentClassification: "SUPPLIER_QUOTE", extractionStatus: "EXTRACTED", reviewStatus: "REVIEWED", approvalStatus: "APPROVED", workflowStatus: "APPROVED", approvedBy: "staff-1", approvedAt: "2026-08-01T10:00:00.000Z", approvalNote: null, rejectionReason: null, clarificationRequest: null,
    lineItems: [{ id: "supplier-line-1", tenderLineItemId: null, boqLineItemId: null, pricingScheduleLineItemId: null, sourceDescription: "A4 copy paper 80gsm box of 5 reams", normalisedDescription: "a4 copy paper 80gsm box of 5 reams", supplierSku: "A4-PAPER", quantity: 10, unit: "box", unitPrice: 125, lineTotal: 1250, vatTreatment: "EXCLUSIVE", deliveryAllocation: 0, confidence: 0.95, sourcePage: 1, sourceText: "A4 copy paper 80gsm box of 5 reams", manualOverride: false, approved: true, approvedBy: "staff-1", approvedAt: "2026-08-01T10:00:00.000Z" }],
    extraction: { exclusions: { value: [] } } as SupplierQuote["extraction"], duplicateKey: "dup", supersedesQuoteId: null, createdBy: "staff-1", createdAt: "2026-08-01T10:00:00.000Z", updatedAt: "2026-08-01T10:00:00.000Z", ...overrides,
  };
}

function build(input: { tenderLineItems?: TenderPricingTenderLineItem[]; supplierQuotes?: SupplierQuote[] } = {}) {
  return buildTenderPricingWorkspace({ workspaceId: "workspace-a", opportunityId: "deal-1", dealId: "deal-1", contractorId: "torque", contractorName: "Torque Empire (Pty) Ltd", tenderIntelligenceApproved: true, tenderLineItems: input.tenderLineItems ?? [line()], sourcePricingDocumentRequired: true, sourcePricingDocumentId: "boq-doc", sourcePricingDocumentPath: "boq.pdf", supplierQuotes: input.supplierQuotes ?? [quote()], createdBy: "staff-1", now: "2026-08-01T10:00:00.000Z" });
}

describe("tender pricing mapping engine", () => {
  test("approved quote with obvious supplier line becomes matched and priced", () => {
    const workspace = build();
    expect(workspace.lineItems[0].mapping?.reviewStatus).toBe("MATCHED");
    expect(workspace.lineItems[0].priceSource).toBe("APPROVED_SUPPLIER_QUOTE");
    expect(workspace.totalSupplierCost).toBe(1250);
    expect(workspace.validationStatus).toBe("NOT_STARTED");
  });

  test("approved quote with no matching line remains unmatched without fabricated price", () => {
    const workspace = build({ tenderLineItems: [line({ itemCode: "GLOVES", description: "Disposable nitrile gloves box of 100", quantity: 8 })], supplierQuotes: [quote({ lineItems: [{ ...quote().lineItems[0], sourceDescription: "Steel anchor bolts", normalisedDescription: "steel anchor bolts", supplierSku: "BOLTS", quantity: 1, unit: "pack" }] })] });
    expect(workspace.lineItems[0].mapping?.reviewStatus).toBe("UNMATCHED");
    expect(workspace.lineItems[0].priceSource).toBe("UNPRICED");
    expect(workspace.lineItems[0].sourceCost).toBe(0);
    expect(workspace.lineItems[0].riskFlags).toContain("MISSING_ITEM");
    expect(workspace.lineItems[0].riskFlags).not.toContain("LOW_CONFIDENCE_MAPPING");
  });

  test("no approved quote lines available keeps truthful blocked pricing state", () => {
    const workspace = build({ supplierQuotes: [quote({ lineItems: [] })] });
    expect(workspace.blockers.map((item) => item.code)).toContain("QUOTE_LINE_ITEMS_REQUIRED");
    expect(workspace.lineItems[0].priceSource).toBe("UNPRICED");
    expect(workspace.totalSupplierCost).toBe(0);
  });

  test("low-confidence mapping remains governed", () => {
    const workspace = build({ tenderLineItems: [line({ itemCode: null, description: "A4 copy paper 80gsm", quantity: 10, unit: "box" })], supplierQuotes: [quote({ lineItems: [{ ...quote().lineItems[0], sourceDescription: "A4 copy paper", normalisedDescription: "a4 copy paper", supplierSku: null, quantity: 1, unit: "each" }] })] });
    expect(workspace.lineItems[0].mapping?.reviewStatus).toBe("REVIEW_REQUIRED");
    expect(workspace.lineItems[0].riskFlags).toContain("LOW_CONFIDENCE_MAPPING");
  });

  test("duplicate BOQ line numbers are removed from pricing description", () => {
    expect(normalizeTenderLineDescription("3 3 Disposable nitrile gloves, box of 100", "3")).toBe("Disposable nitrile gloves, box of 100");
    expect(normalizeTenderLineDescription("1 1 A4 copy paper, 80gsm", "1")).toBe("A4 copy paper, 80gsm");
  });


  test("missing quantity on a fixed-quantity line remains blocked", () => {
    const workspace = build({ tenderLineItems: [line({ quantity: null })] });
    expect(workspace.blockers.map((item) => item.code)).toContain("TENDER_LINE_QUANTITY_REQUIRED");
    expect(workspace.lineItems[0].priceSource).toBe("APPROVED_SUPPLIER_QUOTE");
  });

  test("reviewed unit-rate line maps by evidence without quantity matching", () => {
    const workspace = build({ tenderLineItems: [line({ quantity: null, quantityMode: "UNIT_RATE_ONLY", sourcePage: 38, description: "A4 copy paper 80gsm box of 5 reams" })] });
    const priced = workspace.lineItems[0];
    expect(priced.mapping?.reviewStatus).toBe("MATCHED");
    expect(priced.sourceCost).toBe(125);
    expect(priced.tenderUnitPrice).toBeGreaterThan(125);
    expect(priced.tenderLineTotal).toBeNull();
    expect(workspace.pricingAggregationMode).toBe("UNIT_RATE_ONLY");
    expect(workspace.totalSupplierCost).toBeNull();
    expect(workspace.total).toBeNull();
  });


  test("mixed fixed and unit-rate schedules do not expose a fabricated aggregate", () => {
    const workspace = build({ tenderLineItems: [line(), line({ id: "line-2", itemCode: "WATER", description: "Branded Still Water 330 ml Bottle", quantity: null, quantityMode: "UNIT_RATE_ONLY", unit: "each", sourcePage: 38 })] });
    expect(workspace.pricingAggregationMode).toBe("MIXED");
    expect(workspace.totalSupplierCost).toBeNull();
    expect(workspace.total).toBeNull();
  });
});
