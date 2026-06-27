import {
  buildCommercialImpactScenarios,
  buildSupplierContactActionPayload,
  buildSupplierRecommendations,
  scoreSupplierOffersForEstimate,
} from "@/lib/qs/supplier-intelligence";
import { sanitizeQsFirestoreData } from "@/lib/qs/firestore";
import type { QSEstimate, QSSupplierProductOffer, QSSupplierProfile } from "@/types/qs";

const baseEstimate: QSEstimate = {
  estimateId: "estimate-1",
  sourceBoqId: "boq-1",
  projectId: "project-1",
  projectName: "Atlas Test",
  status: "quoteReady",
  version: 1,
  createdAt: "2026-06-27T00:00:00.000Z",
  updatedAt: "2026-06-27T00:00:00.000Z",
  createdBy: "admin-1",
  updatedBy: "admin-1",
  createdByUid: "admin-1",
  updatedByUid: "admin-1",
  assumptions: {
    vatRate: 0.15,
    vatEnabled: true,
    overheadPercentage: 0.12,
    profitPercentage: 0.15,
    riskPercentage: 0.05,
    lowConfidenceRiskPercentage: 0.08,
    missingPricingRiskPercentage: 0.12,
    waste: { mode: "percentage", value: 0.05 },
    transport: { mode: "percentage", value: 0.03 },
    plant: { mode: "percentage", value: 0.02 },
    labourRates: {},
  },
  lines: [
    {
      estimateLineId: "estimate-1-line-1",
      boqLineItemId: "line-1",
      boqDocumentId: "boq-1",
      description: "20MPa concrete",
      trade: "Concrete",
      unit: "m3",
      quantity: 10,
      matchedMaterialIds: ["mat-concrete"],
      materialUnitCost: 100,
      materialTotal: 1000,
      labourRate: 200,
      labourHours: 5,
      labourTotal: 1000,
      plantEquipmentCost: 40,
      transportAllowance: 60,
      wasteAllowance: 50,
      overheadAmount: 258,
      profitAmount: 362.67,
      riskAmount: 120.4,
      lineSubtotal: 2891.07,
      vatAmount: 433.66,
      lineTotal: 3324.73,
      confidenceScore: 90,
      warnings: [],
      pricingSource: "materialCurrent",
    },
  ],
  breakdown: {
    materialCost: 1000,
    labourCost: 1000,
    plantAllowance: 40,
    transportAllowance: 60,
    wasteAllowance: 50,
    overhead: 258,
    profit: 362.67,
    riskAllowance: 120.4,
    subtotalExVat: 2891.07,
    vatAmount: 433.66,
    totalInclVat: 3324.73,
  },
  totalEstimatedProjectValue: 3324.73,
  confidenceScore: 90,
  missingPricingWarnings: [],
  quoteReadinessStatus: "quoteReady",
  sourceItemCount: 1,
};

function supplier(overrides: Partial<QSSupplierProfile>): QSSupplierProfile {
  return {
    supplierId: "supplier-a",
    supplierName: "Supplier A",
    branches: [],
    deliveryAreas: ["Gauteng"],
    productCategories: ["Concrete"],
    qualityScore: 75,
    reliabilityScore: 75,
    deliveryScore: 75,
    priceCompetitivenessScore: 75,
    stockAvailabilityScore: 75,
    overallSupplierScore: 75,
    isPreferredSupplier: false,
    isSponsoredSupplier: false,
    supplierSubscriptionTier: "none",
    leadFeeEnabled: false,
    referralCommissionEnabled: false,
    featuredPlacementEnabled: false,
    status: "active",
    version: 1,
    createdAt: "2026-06-27T00:00:00.000Z",
    updatedAt: "2026-06-27T00:00:00.000Z",
    createdBy: "admin-1",
    updatedBy: "admin-1",
    ...overrides,
  };
}

function offer(overrides: Partial<QSSupplierProductOffer>): QSSupplierProductOffer {
  return {
    offerId: "offer-a",
    supplierId: "supplier-a",
    materialId: "mat-concrete",
    materialName: "20MPa concrete",
    category: "Concrete",
    unit: "m3",
    unitPriceExVat: 95,
    vatRate: 0.15,
    stockStatus: "inStock",
    availableQuantity: 100,
    leadTimeDays: 2,
    deliveryFee: 100,
    validFrom: "2026-06-01T00:00:00.000Z",
    validUntil: "2026-07-01T00:00:00.000Z",
    qualityGrade: "Standard",
    pricingSource: "supplierCatalogue",
    status: "active",
    version: 1,
    createdAt: "2026-06-27T00:00:00.000Z",
    updatedAt: "2026-06-27T00:00:00.000Z",
    createdBy: "admin-1",
    updatedBy: "admin-1",
    ...overrides,
  };
}

describe("QS supplier intelligence service", () => {
  test("scores supplier offers using price, quality, delivery, stock, reliability, and transport", () => {
    const scored = scoreSupplierOffersForEstimate(baseEstimate, [
      supplier({ supplierId: "supplier-a", supplierName: "Cheap Supplier", qualityScore: 65 }),
      supplier({ supplierId: "supplier-b", supplierName: "Premium Supplier", qualityScore: 96, reliabilityScore: 95 }),
    ], [
      offer({ offerId: "offer-a", supplierId: "supplier-a", unitPriceExVat: 80, deliveryFee: 80, qualityGrade: "Budget" }),
      offer({ offerId: "offer-b", supplierId: "supplier-b", unitPriceExVat: 110, deliveryFee: 50, qualityGrade: "Premium" }),
    ]);

    expect(scored).toHaveLength(2);
    expect(scored.find((item) => item.offer.offerId === "offer-a")?.priceScore).toBeGreaterThan(
      scored.find((item) => item.offer.offerId === "offer-b")?.priceScore ?? 0,
    );
    expect(scored.find((item) => item.offer.offerId === "offer-b")?.qualityScore).toBeGreaterThan(
      scored.find((item) => item.offer.offerId === "offer-a")?.qualityScore ?? 0,
    );
  });

  test("selects best price, best quality, best overall value, fastest delivery, and lowest risk", () => {
    const recommendations = buildSupplierRecommendations(baseEstimate, [
      supplier({ supplierId: "cheap", supplierName: "Cheap Supplier", qualityScore: 58, reliabilityScore: 55, deliveryScore: 60 }),
      supplier({ supplierId: "quality", supplierName: "Quality Supplier", qualityScore: 98, reliabilityScore: 88, deliveryScore: 70 }),
      supplier({ supplierId: "fast", supplierName: "Fast Supplier", qualityScore: 75, reliabilityScore: 80, deliveryScore: 98 }),
    ], [
      offer({ offerId: "cheap-offer", supplierId: "cheap", unitPriceExVat: 70, deliveryFee: 40, qualityGrade: "Budget", leadTimeDays: 5 }),
      offer({ offerId: "quality-offer", supplierId: "quality", unitPriceExVat: 100, deliveryFee: 60, qualityGrade: "Premium", leadTimeDays: 4 }),
      offer({ offerId: "fast-offer", supplierId: "fast", unitPriceExVat: 95, deliveryFee: 75, qualityGrade: "Standard", leadTimeDays: 1 }),
    ]);

    expect(recommendations.find((item) => item.category === "BEST_PRICE")?.supplierId).toBe("cheap");
    expect(recommendations.find((item) => item.category === "BEST_QUALITY")?.supplierId).toBe("quality");
    expect(recommendations.find((item) => item.category === "FASTEST_DELIVERY")?.supplierId).toBe("fast");
    expect(recommendations.find((item) => item.category === "BEST_OVERALL_VALUE")).toBeDefined();
    expect(recommendations.find((item) => item.category === "LOWEST_RISK")).toBeDefined();
  });

  test("does not let sponsored supplier status override recommendation scoring", () => {
    const recommendations = buildSupplierRecommendations(baseEstimate, [
      supplier({ supplierId: "truth", supplierName: "Truth Supplier", qualityScore: 95, reliabilityScore: 95, deliveryScore: 95 }),
      supplier({ supplierId: "sponsored", supplierName: "Sponsored Supplier", qualityScore: 45, reliabilityScore: 45, deliveryScore: 45, isSponsoredSupplier: true }),
    ], [
      offer({ offerId: "truth-offer", supplierId: "truth", unitPriceExVat: 90, deliveryFee: 20, leadTimeDays: 1, qualityGrade: "Premium" }),
      offer({ offerId: "sponsored-offer", supplierId: "sponsored", unitPriceExVat: 130, deliveryFee: 300, leadTimeDays: 14, qualityGrade: "Budget" }),
    ]);

    expect(recommendations.find((item) => item.category === "BEST_OVERALL_VALUE")?.supplierId).toBe("truth");
    expect(recommendations.some((item) => item.supplierId === "sponsored" && item.isSponsoredSupplier)).toBe(false);
  });

  test("calculates commercial impact from supplier recommendation changes", () => {
    const recommendations = buildSupplierRecommendations(baseEstimate, [
      supplier({ supplierId: "saving", supplierName: "Saving Supplier", qualityScore: 90, reliabilityScore: 90 }),
    ], [
      offer({ offerId: "saving-offer", supplierId: "saving", unitPriceExVat: 70, deliveryFee: 50, leadTimeDays: 2 }),
    ]);
    const scenarios = buildCommercialImpactScenarios(baseEstimate, recommendations, [
      offer({ offerId: "saving-offer", supplierId: "saving", unitPriceExVat: 70, deliveryFee: 50, leadTimeDays: 2 }),
    ]);

    expect(scenarios[0].currentEstimateTotal).toBe(baseEstimate.totalEstimatedProjectValue);
    expect(scenarios[0].newEstimateTotal).toBeLessThan(baseEstimate.totalEstimatedProjectValue);
    expect(scenarios[0].costSaving).toBeGreaterThan(0);
    expect(scenarios[0].quoteReadinessImpact).toBe("quoteReady");
  });

  test("sanitizes undefined supplier payload fields before Firestore write", () => {
    const sanitized = sanitizeQsFirestoreData({
      supplierId: "supplier-a",
      optional: undefined,
      nested: {
        kept: null,
        removed: undefined,
      },
    });

    expect(Object.prototype.hasOwnProperty.call(sanitized, "optional")).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(sanitized.nested, "removed")).toBe(false);
    expect(sanitized.nested.kept).toBeNull();
  });

  test("builds structured supplier contact action payloads for lead tracking", () => {
    const payload = buildSupplierContactActionPayload({
      userUid: "admin-1",
      userRole: "admin",
      supplierId: "supplier-a",
      supplierName: "Supplier A",
      estimateId: "estimate-1",
      estimateLineId: "estimate-1-line-1",
      materialId: "mat-concrete",
      boqLineItemId: "line-1",
      actionType: "REQUEST_QUOTE",
      notes: undefined,
    });

    expect(payload.sourceModule).toBe("qsSupplierIntelligence");
    expect(payload.contactStatus).toBe("logged");
    expect(payload.actionType).toBe("REQUEST_QUOTE");
    expect(payload.notes).toBeNull();
    expect(payload.createdByUid).toBe("admin-1");
  });
});
