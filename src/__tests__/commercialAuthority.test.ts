import { calculateApprovedSellingRate, calculateLandedUnitCost, evaluateSupplierQuoteLine } from "@/server/services/commercialAuthorityService";
import type { SupplierQuote } from "@/types/supplierQuote";

function quote(overrides: Partial<SupplierQuote> = {}): SupplierQuote {
  return {
    id: "SQ-1",
    workspaceId: "ws-1",
    opportunityId: "opp-1",
    dealId: "opp-1",
    contractorId: "contractor-1",
    contractorName: "Torque Empire",
    supplierId: "SUP-1",
    supplierName: "Verified Supplier",
    supplierResolutionStatus: "RESOLVED_VERIFIED",
    masterDocumentId: "DOC-SQ-1",
    currency: "ZAR",
    subtotal: 100,
    vat: 15,
    total: 115,
    deliveryCost: 10,
    uploadedDocumentId: "DOC-SQ-1",
    documentClassification: "SUPPLIER_QUOTE",
    extractionStatus: "EXTRACTED",
    reviewStatus: "REVIEWED",
    approvalStatus: "APPROVED",
    workflowStatus: "APPROVED",
    lineItems: [{ id: "LINE-1", sourceDescription: "330ml still water", normalisedDescription: "330ml still water", quantity: 10, unit: "each", unitPrice: 10, lineTotal: 100, vatTreatment: "EXCLUSIVE", deliveryAllocation: 10, confidence: 1, manualOverride: false, approved: true }],
    extraction: {} as SupplierQuote["extraction"],
    duplicateKey: "key",
    createdBy: "u1",
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("commercial authority", () => {
  test("keeps markup and margin calculations distinct", () => {
    expect(calculateApprovedSellingRate({ landedUnitCost: 100, method: "MARKUP", percentage: 0.2 })).toBe(120);
    expect(calculateApprovedSellingRate({ landedUnitCost: 100, method: "MARGIN", percentage: 0.2 })).toBe(125);
  });

  test("calculates explicit landed cost without inventing quantity totals", () => {
    expect(calculateLandedUnitCost({ unitCostExcl: 10, deliveryCost: 10, quantity: 10 })).toBe(11);
    expect(calculateLandedUnitCost({ unitCostExcl: 10, deliveryCost: 10, quantity: null })).toBe(20);
  });

  test("requires canonical Supplier_ID and governed quote evidence", () => {
    const result = evaluateSupplierQuoteLine({ quote: quote({ supplierId: null, supplierResolutionStatus: "REVIEW_REQUIRED", masterDocumentId: null }), line: quote().lineItems[0], itemId: "TE-WAT-330", itemUnit: "each", documentVerificationStatus: "PENDING_REVIEW", documentEvidenceStatus: "PENDING_REVIEW" });
    expect(result.allowed).toBe(false);
    expect(result.blockers.map((item) => item.code)).toEqual(expect.arrayContaining(["SUPPLIER_ID_REQUIRED", "SUPPLIER_QUOTE_DOCUMENT_REQUIRED", "SUPPLIER_QUOTE_EVIDENCE_NOT_ACCEPTED"]));
  });

  test("benchmark/source-only records cannot become supplier cost authority", () => {
    const result = evaluateSupplierQuoteLine({ quote: quote({ supplierId: null, supplierResolutionStatus: "SOURCE_ONLY", sourceId: "SRC-BENCHMARK" }), line: quote().lineItems[0], itemId: "TE-WAT-330", itemUnit: "each", documentVerificationStatus: "VERIFIED", documentEvidenceStatus: "VERIFIED" });
    expect(result.allowed).toBe(false);
    expect(result.blockers.some((item) => item.code === "SUPPLIER_ID_REQUIRED")).toBe(true);
  });

  test("expired supplier quote cannot drive current pricing", () => {
    const result = evaluateSupplierQuoteLine({ quote: quote({ validityDate: "2026-08-01" }), line: quote().lineItems[0], itemId: "TE-WAT-330", itemUnit: "each", documentVerificationStatus: "VERIFIED", documentEvidenceStatus: "VERIFIED", today: new Date("2026-08-11T00:00:00.000Z") });
    expect(result.allowed).toBe(false);
    expect(result.blockers.map((item) => item.code)).toContain("SUPPLIER_QUOTE_EXPIRED");
  });

  test("verified current quote line resolves canonical item and produces cost authority", () => {
    const result = evaluateSupplierQuoteLine({ quote: quote(), line: quote().lineItems[0], itemId: "TE-WAT-330", itemUnit: "each", documentVerificationStatus: "VERIFIED", documentEvidenceStatus: "VERIFIED", today: new Date("2026-08-11T00:00:00.000Z") });
    expect(result.allowed).toBe(true);
    expect(result.costLine).toMatchObject({ supplierId: "SUP-1", supplierQuoteDocumentId: "DOC-SQ-1", itemId: "TE-WAT-330", landedUnitCost: 11 });
  });

  test("ambiguous or incompatible item resolution fails closed", () => {
    const result = evaluateSupplierQuoteLine({ quote: quote(), line: quote().lineItems[0], itemId: null, itemUnit: "case", documentVerificationStatus: "VERIFIED", documentEvidenceStatus: "VERIFIED" });
    expect(result.allowed).toBe(false);
    expect(result.blockers.map((item) => item.code)).toEqual(expect.arrayContaining(["ITEM_ID_REQUIRED", "UNIT_MISMATCH"]));
  });
});
