import { sanitizeFirestoreData } from "@/lib/firebase/sanitizeFirestoreData";
import { calculateQSEstimate, DEFAULT_QS_ESTIMATE_CONFIG } from "@/lib/qs/estimating";
import type { Material, QsBoqDocument, QsBoqLineItem } from "@/types/qs";

const sourceBoq: QsBoqDocument = {
  boqDocumentId: "boq-test-1",
  projectId: "project-1",
  projectName: "Test School Upgrade",
  documentType: "boq",
  fileName: "test-boq.xlsx",
  fileType: "xlsx",
  mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  storagePath: null,
  uploadedBy: "user-1",
  uploadedByRole: "staff",
  extractionSource: "spreadsheet",
  ocrUsed: false,
  parserUsed: "xlsx",
  originalTextPreview: "Concrete works",
  textLength: 100,
  itemCount: 1,
  reviewStatus: "accepted",
  confidenceDistribution: { High: 1, Medium: 0, Low: 0 },
  extractionTimeMs: 100,
  createdAt: "2026-06-27T08:00:00.000Z",
  updatedAt: "2026-06-27T08:00:00.000Z",
};

function boqLine(overrides: Partial<QsBoqLineItem> = {}): QsBoqLineItem {
  return {
    boqLineItemId: "boq-test-1-line-1",
    boqDocumentId: "boq-test-1",
    lineNumber: 1,
    section: "Concrete",
    trade: "Concrete",
    originalText: "10 m3 concrete 25MPa",
    description: "Concrete 25MPa",
    quantity: 10,
    unit: "m3",
    normalizedUnit: "m3",
    materialMatch: {
      materialId: "mat-concrete",
      materialName: "Ready mix concrete 25MPa",
      matchConfidence: "High",
      suggestedMaterialIds: [],
      unknownMaterial: false,
    },
    confidenceScore: "High",
    status: "accepted",
    notes: null,
    createdAt: "2026-06-27T08:00:00.000Z",
    updatedAt: "2026-06-27T08:00:00.000Z",
    ...overrides,
  };
}

const material: Material = {
  materialId: "mat-concrete",
  sku: "CONC-25",
  barcode: null,
  name: "Ready mix concrete 25MPa",
  normalizedName: "ready mix concrete 25mpa",
  description: null,
  categoryId: "concrete",
  subcategory: null,
  brandId: null,
  unit: "m3",
  vatApplicable: true,
  defaultSupplier: null,
  averageMarketPrice: null,
  preferredSupplier: null,
  currentPrice: 100,
  status: "active",
  tags: ["concrete"],
  searchKeywords: ["concrete"],
  supplierIds: [],
  createdAt: "2026-06-27T08:00:00.000Z",
  updatedAt: "2026-06-27T08:00:00.000Z",
};

describe("QS estimating engine", () => {
  test("calculates material, labour, allowances, margin, VAT and total deterministically", () => {
    const estimate = calculateQSEstimate({
      estimateId: "qse-test-1",
      sourceBoq,
      lineItems: [boqLine()],
      materials: [material],
      version: 1,
      createdAt: "2026-06-27T08:00:00.000Z",
      updatedAt: "2026-06-27T08:00:00.000Z",
      createdByUid: "staff-1",
      updatedByUid: "staff-1",
    });

    expect(estimate.breakdown.materialCost).toBe(1000);
    expect(estimate.breakdown.labourCost).toBe(1462.5);
    expect(estimate.breakdown.profit).toBeGreaterThan(0);
    expect(estimate.breakdown.vatAmount).toBeGreaterThan(0);
    expect(estimate.totalEstimatedProjectValue).toBe(estimate.breakdown.totalInclVat);
    expect(estimate.quoteReadinessStatus).toBe("quoteReady");
  });

  test("flags missing material pricing and blocks quote readiness", () => {
    const estimate = calculateQSEstimate({
      estimateId: "qse-test-2",
      sourceBoq,
      lineItems: [boqLine()],
      materials: [{ ...material, currentPrice: null, averageMarketPrice: null }],
      version: 1,
      createdAt: "2026-06-27T08:00:00.000Z",
      updatedAt: "2026-06-27T08:00:00.000Z",
    });

    expect(estimate.lines[0].pricingSource).toBe("none");
    expect(estimate.missingPricingWarnings.join(" ")).toContain("no current, supplier, or historical price");
    expect(estimate.quoteReadinessStatus).toBe("pricingIncomplete");
  });

  test("honours VAT disabled assumptions", () => {
    const estimate = calculateQSEstimate({
      estimateId: "qse-test-3",
      sourceBoq,
      lineItems: [boqLine()],
      materials: [material],
      config: { ...DEFAULT_QS_ESTIMATE_CONFIG, vatEnabled: false },
      version: 1,
      createdAt: "2026-06-27T08:00:00.000Z",
      updatedAt: "2026-06-27T08:00:00.000Z",
    });

    expect(estimate.breakdown.vatAmount).toBe(0);
    expect(estimate.breakdown.totalInclVat).toBe(estimate.breakdown.subtotalExVat);
  });

  test("includes risk and margin in line totals", () => {
    const estimate = calculateQSEstimate({
      estimateId: "qse-test-4",
      sourceBoq,
      lineItems: [boqLine({ confidenceScore: "Low" })],
      materials: [material],
      version: 1,
      createdAt: "2026-06-27T08:00:00.000Z",
      updatedAt: "2026-06-27T08:00:00.000Z",
    });

    expect(estimate.lines[0].riskAmount).toBeGreaterThan(0);
    expect(estimate.lines[0].profitAmount).toBeGreaterThan(0);
    expect(estimate.quoteReadinessStatus).toBe("reviewRequired");
  });

  test("removes undefined values before Firestore writes", () => {
    const sanitized = sanitizeFirestoreData({
      estimateId: "qse-test",
      optional: undefined,
      nested: {
        keep: "value",
        remove: undefined,
      },
      list: [1, undefined, { remove: undefined, keep: true }],
    });

    expect(JSON.stringify(sanitized)).not.toContain("undefined");
    expect(sanitized).toEqual({
      estimateId: "qse-test",
      nested: { keep: "value" },
      list: [1, null, { keep: true }],
    });
  });
});
