import {
  buildCompletedProjectFeedbackPayload,
  buildRegionalSupplierInsights,
  buildTransportIntelligence,
  calculateCommercialDashboardSummary,
  calculatePriceMovementSignals,
  calculateSupplierPerformanceScore,
} from "@/lib/qs/commercial-intelligence";
import { buildSupplierRecommendations } from "@/lib/qs/supplier-intelligence";
import type {
  QSEstimate,
  QSMaterialPriceObservation,
  QSSupplierDecisionFlag,
  QSSupplierProductOffer,
  QSSupplierProfile,
} from "@/types/qs";

const estimate: QSEstimate = {
  estimateId: "estimate-1",
  sourceBoqId: "boq-1",
  projectId: "project-1",
  projectName: "Commercial Test",
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
      description: "Cement",
      trade: "Concrete",
      unit: "bag",
      quantity: 50,
      matchedMaterialIds: ["mat-cement"],
      materialUnitCost: 100,
      materialTotal: 5000,
      labourRate: 200,
      labourHours: 5,
      labourTotal: 1000,
      plantEquipmentCost: 120,
      transportAllowance: 180,
      wasteAllowance: 250,
      overheadAmount: 786,
      profitAmount: 1100,
      riskAmount: 366,
      lineSubtotal: 8802,
      vatAmount: 1320.3,
      lineTotal: 10122.3,
      confidenceScore: 90,
      warnings: [],
      pricingSource: "materialCurrent",
    },
  ],
  breakdown: {
    materialCost: 5000,
    labourCost: 1000,
    plantAllowance: 120,
    transportAllowance: 180,
    wasteAllowance: 250,
    overhead: 786,
    profit: 1100,
    riskAllowance: 366,
    subtotalExVat: 8802,
    vatAmount: 1320.3,
    totalInclVat: 10122.3,
  },
  totalEstimatedProjectValue: 10122.3,
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
    qualityScore: 80,
    reliabilityScore: 80,
    deliveryScore: 80,
    priceCompetitivenessScore: 80,
    stockAvailabilityScore: 80,
    overallSupplierScore: 80,
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
    materialId: "mat-cement",
    materialName: "Cement",
    category: "Concrete",
    unit: "bag",
    unitPriceExVat: 95,
    vatRate: 0.15,
    stockStatus: "inStock",
    availableQuantity: 100,
    leadTimeDays: 2,
    deliveryFee: 100,
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

function decision(overrides: Partial<QSSupplierDecisionFlag>): QSSupplierDecisionFlag {
  return {
    flagId: overrides.supplierId ?? "supplier-a",
    supplierId: overrides.supplierId ?? "supplier-a",
    supplierName: "Supplier A",
    status: "neutral",
    reason: "management_decision",
    notes: null,
    setByUid: "admin-1",
    setAt: "2026-06-27T00:00:00.000Z",
    statusHistory: [],
    version: 1,
    createdAt: "2026-06-27T00:00:00.000Z",
    updatedAt: "2026-06-27T00:00:00.000Z",
    createdBy: "admin-1",
    updatedBy: "admin-1",
    ...overrides,
  };
}

describe("QS commercial intelligence foundations", () => {
  test("calculates supplier performance score from rating components", () => {
    const score = calculateSupplierPerformanceScore({
      deliveryReliabilityScore: 90,
      priceAccuracyScore: 80,
      qualityRating: 85,
      stockAccuracyScore: 70,
      communicationRating: 75,
      returnsDefectsRate: 5,
      invoiceAccuracyScore: 95,
    });

    expect(score).toBeGreaterThan(80);
    expect(score).toBeLessThanOrEqual(100);
  });

  test("builds completed-project feedback payload for learning foundation capture", () => {
    const payload = buildCompletedProjectFeedbackPayload({
      estimateId: "estimate-1",
      recommendationOutcome: "overridden",
      overrideReason: "Supplier had no stock on appointment.",
      expectedMaterialCost: 1000,
      actualMaterialCost: 1120,
      expectedLabourCost: 500,
      actualLabourCost: 530,
      expectedTransportCost: 100,
      actualTransportCost: 160,
      deliveryPerformanceScore: 70,
      defectsReturnsRate: 2,
      finalProfitMarginPercentage: 12,
      completedAt: "2026-06-28T00:00:00.000Z",
    });

    expect(payload.learningStatus).toBe("captured");
    expect(payload.recommendationOutcome).toBe("overridden");
    expect(payload.overrideReason).toContain("no stock");
  });

  test("returns insufficient-data price movement when history is thin", () => {
    const observations: QSMaterialPriceObservation[] = [
      {
        observationId: "obs-1",
        materialId: "mat-cement",
        materialName: "Cement",
        unit: "bag",
        price: 100,
        currency: "ZAR",
        observedAt: "2026-06-01T00:00:00.000Z",
        source: "manual",
        status: "active",
        createdAt: "2026-06-01T00:00:00.000Z",
        updatedAt: "2026-06-01T00:00:00.000Z",
      },
      {
        observationId: "obs-2",
        materialId: "mat-cement",
        materialName: "Cement",
        unit: "bag",
        price: 105,
        currency: "ZAR",
        observedAt: "2026-06-02T00:00:00.000Z",
        source: "manual",
        status: "active",
        createdAt: "2026-06-02T00:00:00.000Z",
        updatedAt: "2026-06-02T00:00:00.000Z",
      },
    ];

    expect(calculatePriceMovementSignals(observations)[0].confidence).toBe("insufficientData");
  });

  test("uses transport fallback when branch GPS and distance are unavailable", () => {
    const transport = buildTransportIntelligence(
      supplier({ branches: [{ branchId: "b1", branchName: "Main", province: "Gauteng", deliveryRadiusKm: null }] }),
      offer({ deliveryFee: 250, leadTimeDays: 4 }),
    );

    expect(transport.distanceStatus).toBe("requiresBranchGps");
    expect(transport.explanation).toContain("branch GPS");
  });

  test("decision flags influence supplier recommendations and blocked suppliers are excluded", () => {
    const recommendations = buildSupplierRecommendations(
      estimate,
      [
        supplier({ supplierId: "blocked", supplierName: "Blocked Supplier", qualityScore: 99, reliabilityScore: 99, deliveryScore: 99 }),
        supplier({ supplierId: "preferred", supplierName: "Preferred Supplier", qualityScore: 80, reliabilityScore: 80, deliveryScore: 80 }),
        supplier({ supplierId: "watch", supplierName: "Watch Supplier", qualityScore: 88, reliabilityScore: 88, deliveryScore: 88 }),
      ],
      [
        offer({ offerId: "blocked-offer", supplierId: "blocked", unitPriceExVat: 80, deliveryFee: 20 }),
        offer({ offerId: "preferred-offer", supplierId: "preferred", unitPriceExVat: 84, deliveryFee: 20 }),
        offer({ offerId: "watch-offer", supplierId: "watch", unitPriceExVat: 84, deliveryFee: 20 }),
      ],
      "admin-1",
      {
        decisionFlags: [
          decision({ supplierId: "blocked", status: "blocked", reason: "quality_concerns" }),
          decision({ supplierId: "preferred", status: "preferred", reason: "management_decision" }),
          decision({ supplierId: "watch", status: "watchlist", reason: "delivery_performance" }),
        ],
      },
    );

    expect(recommendations.some((item) => item.supplierId === "blocked")).toBe(false);
    expect(recommendations.find((item) => item.category === "BEST_OVERALL_VALUE")?.supplierId).toBe("preferred");
  });

  test("calculates dashboard summary from available data and data gaps", () => {
    const summary = calculateCommercialDashboardSummary({
      estimates: [estimate],
      suppliers: [supplier({ supplierId: "supplier-a", supplierName: "Supplier A" })],
      offers: [offer({ supplierId: "supplier-a" })],
      ratings: [],
      feedback: [],
      observations: [],
      recommendations: [],
      scenarios: [],
    });

    expect(summary.commercialHealthScore).toBeGreaterThan(0);
    expect(summary.missingPricingCount).toBe(0);
    expect(summary.dataGaps).toContain("No completed-project feedback has been captured yet.");
  });

  test("regional intelligence reports insufficient data honestly", () => {
    const insights = buildRegionalSupplierInsights(
      [supplier({ supplierId: "supplier-a", deliveryAreas: ["Gauteng"] })],
      [offer({ supplierId: "supplier-a" })],
      [],
    );

    expect(insights[0].dataState).toBe("insufficientData");
  });
});
