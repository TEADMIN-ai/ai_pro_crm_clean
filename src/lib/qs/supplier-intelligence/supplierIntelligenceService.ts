import { QS_COLLECTIONS } from "@/lib/qs/collections";
import { createQsRecord, getQsRecord, listQsRecords, qsCollection, updateQsRecord } from "@/lib/qs/firestore";
import { getEstimate } from "@/lib/qs/estimating";
import type {
  QsCreateInput,
  QSEstimate,
  QSEstimateLine,
  QSCommercialImpactScenario,
  QSQuoteReadinessStatus,
  QSSupplierContactAction,
  QSSupplierContactActionType,
  QSSupplierProductOffer,
  QSSupplierProfile,
  QSSupplierRecommendation,
  QSSupplierRecommendationCategory,
  QSSupplierRiskLevel,
  QsUpdateInput,
} from "@/types/qs";

type ScoredOffer = {
  line: QSEstimateLine;
  offer: QSSupplierProductOffer;
  supplier: QSSupplierProfile;
  landedCostExVat: number;
  vatAmount: number;
  landedCostInclVat: number;
  priceScore: number;
  qualityScore: number;
  deliveryScore: number;
  stockAvailabilityScore: number;
  reliabilityScore: number;
  transportScore: number;
  overallValueScore: number;
  riskLevel: QSSupplierRiskLevel;
  confidenceScore: number;
  deliveryImpactDays: number;
  transportImpact: number;
  costImpact: number;
  marginImpact: number;
};

export type GenerateSupplierRecommendationsResult = {
  estimate: QSEstimate;
  recommendations: QSSupplierRecommendation[];
  scenarios: QSCommercialImpactScenario[];
};

const RECOMMENDATION_CATEGORIES: QSSupplierRecommendationCategory[] = [
  "BEST_PRICE",
  "BEST_QUALITY",
  "BEST_OVERALL_VALUE",
  "FASTEST_DELIVERY",
  "LOWEST_RISK",
];

function nowIso() {
  return new Date().toISOString();
}

function roundMoney(value: number): number {
  return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
}

function roundScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function clampPercent(value: number | null | undefined, fallback = 0): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.max(0, Math.min(100, value));
}

function stockScore(stockStatus: QSSupplierProductOffer["stockStatus"], availableQuantity: number | null | undefined, quantity: number): number {
  if (stockStatus === "inStock") return availableQuantity === undefined || availableQuantity === null || availableQuantity >= quantity ? 100 : 82;
  if (stockStatus === "limited") return availableQuantity && availableQuantity >= quantity ? 76 : 58;
  if (stockStatus === "backOrder") return 38;
  if (stockStatus === "outOfStock") return 5;
  return 45;
}

function qualityGradeScore(grade: string | null | undefined): number {
  const normalized = String(grade ?? "").trim().toUpperCase();
  if (["SABS", "PREMIUM", "A", "A+"].includes(normalized)) return 95;
  if (["B", "STANDARD", "COMMERCIAL"].includes(normalized)) return 78;
  if (["C", "BUDGET"].includes(normalized)) return 56;
  return 70;
}

function deliveryScore(leadTimeDays: number | null | undefined): number {
  const days = typeof leadTimeDays === "number" && Number.isFinite(leadTimeDays) ? leadTimeDays : 7;
  if (days <= 1) return 100;
  if (days <= 3) return 86;
  if (days <= 7) return 64;
  if (days <= 14) return 38;
  return 18;
}

function riskLevel(score: number, stock: number, reliability: number): QSSupplierRiskLevel {
  if (score >= 78 && stock >= 70 && reliability >= 70) return "low";
  if (score >= 52 && stock >= 35 && reliability >= 45) return "medium";
  return "high";
}

function riskPenalty(level: QSSupplierRiskLevel): number {
  if (level === "low") return 0;
  if (level === "medium") return 8;
  return 18;
}

function quoteReadinessFromRisk(base: QSQuoteReadinessStatus, level: QSSupplierRiskLevel): QSQuoteReadinessStatus {
  if (base === "blocked" || base === "pricingIncomplete") return base;
  if (level === "high") return "reviewRequired";
  return base;
}

function categorySortValue(scored: ScoredOffer, category: QSSupplierRecommendationCategory): number {
  if (category === "BEST_PRICE") return -scored.landedCostExVat;
  if (category === "BEST_QUALITY") return scored.qualityScore;
  if (category === "FASTEST_DELIVERY") return scored.deliveryScore;
  if (category === "LOWEST_RISK") return scored.reliabilityScore + scored.stockAvailabilityScore - riskPenalty(scored.riskLevel);
  return scored.overallValueScore;
}

function recommendationScore(scored: ScoredOffer, category: QSSupplierRecommendationCategory): number {
  if (category === "BEST_PRICE") return scored.priceScore;
  if (category === "BEST_QUALITY") return scored.qualityScore;
  if (category === "FASTEST_DELIVERY") return scored.deliveryScore;
  if (category === "LOWEST_RISK") return roundScore((scored.reliabilityScore + scored.stockAvailabilityScore + scored.deliveryScore) / 3 - riskPenalty(scored.riskLevel));
  return scored.overallValueScore;
}

function buildExplanation(scored: ScoredOffer, category: QSSupplierRecommendationCategory): string {
  const supplierName = scored.supplier.supplierName;
  if (category === "BEST_PRICE") {
    return `${supplierName} has the lowest landed cost for this BOQ material, improving direct cost by ${formatMoney(scored.costImpact)} before downstream margin effects.`;
  }
  if (category === "BEST_QUALITY") {
    return `${supplierName} offers the strongest quality position based on supplier quality score, offer grade, warranty notes, and material fit.`;
  }
  if (category === "FASTEST_DELIVERY") {
    return `${supplierName} has the strongest delivery outcome with an estimated lead time impact of ${scored.deliveryImpactDays} day(s).`;
  }
  if (category === "LOWEST_RISK") {
    return `${supplierName} is the lowest-risk option when reliability, stock status, delivery time, and transport exposure are weighed together.`;
  }
  return `${supplierName} provides the strongest overall commercial value after price, quality, delivery, stock, reliability, and transport impact are balanced.`;
}

function buildTradeOffs(scored: ScoredOffer): string[] {
  const tradeOffs: string[] = [];
  if (scored.costImpact < 0) tradeOffs.push(`Costs increase by ${formatMoney(Math.abs(scored.costImpact))} versus the current estimate line.`);
  if (scored.deliveryImpactDays > 3) tradeOffs.push(`Delivery may add ${scored.deliveryImpactDays} day(s), which can affect programme sequencing.`);
  if (scored.riskLevel !== "low") tradeOffs.push(`Commercial risk is ${scored.riskLevel}; review stock, warranty, and delivery commitments before appointing.`);
  if (scored.supplier.isSponsoredSupplier) tradeOffs.push("Supplier is sponsored; sponsorship is displayed but is not included in recommendation scoring.");
  if (!tradeOffs.length) tradeOffs.push("No material trade-off detected against current pricing and delivery assumptions.");
  return tradeOffs;
}

function formatMoney(value: number): string {
  return `R${roundMoney(value).toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function lineBaselineTotal(line: QSEstimateLine): number {
  return roundMoney(line.materialTotal + line.transportAllowance);
}

function recalculateLineWithOffer(estimate: QSEstimate, line: QSEstimateLine, scored: ScoredOffer): number {
  const materialTotal = scored.landedCostExVat;
  const labourTotal = line.labourTotal;
  const directCost = materialTotal + labourTotal;
  const plant = line.plantEquipmentCost;
  const waste = roundMoney(estimate.assumptions.waste.mode === "fixed" ? estimate.assumptions.waste.value : materialTotal * estimate.assumptions.waste.value);
  const transport = roundMoney(scored.offer.deliveryFee ?? 0);
  const overhead = roundMoney((directCost + plant + transport + waste) * estimate.assumptions.overheadPercentage);
  const riskRate = scored.riskLevel === "high" ? estimate.assumptions.lowConfidenceRiskPercentage : estimate.assumptions.riskPercentage;
  const risk = roundMoney((directCost + plant + transport + waste + overhead) * riskRate);
  const profit = roundMoney((directCost + plant + transport + waste + overhead + risk) * estimate.assumptions.profitPercentage);
  const subtotal = roundMoney(directCost + plant + transport + waste + overhead + risk + profit);
  return roundMoney(subtotal + (estimate.assumptions.vatEnabled ? subtotal * estimate.assumptions.vatRate : 0));
}

export function scoreSupplierOffersForEstimate(
  estimate: QSEstimate,
  suppliers: QSSupplierProfile[],
  offers: QSSupplierProductOffer[],
): ScoredOffer[] {
  const activeSuppliers = new Map(suppliers.filter((supplier) => supplier.status === "active").map((supplier) => [supplier.supplierId, supplier]));
  const activeOffers = offers.filter((offer) => offer.status === "active");
  const scored: ScoredOffer[] = [];

  for (const line of estimate.lines) {
    const lineOffers = activeOffers.filter((offer) => line.matchedMaterialIds.includes(offer.materialId));
    if (!lineOffers.length) continue;

    const landedCosts = lineOffers.map((offer) => roundMoney((offer.unitPriceExVat * line.quantity) + (offer.deliveryFee ?? 0)));
    const minCost = Math.min(...landedCosts);
    const maxCost = Math.max(...landedCosts);
    const spread = Math.max(1, maxCost - minCost);

    for (const offer of lineOffers) {
      const supplier = activeSuppliers.get(offer.supplierId);
      if (!supplier) continue;

      const landedCostExVat = roundMoney((offer.unitPriceExVat * line.quantity) + (offer.deliveryFee ?? 0));
      const vatAmount = roundMoney(landedCostExVat * offer.vatRate);
      const stock = stockScore(offer.stockStatus, offer.availableQuantity, line.quantity);
      const quality = roundScore((clampPercent(supplier.qualityScore, 70) * 0.65) + (qualityGradeScore(offer.qualityGrade) * 0.35));
      const delivery = roundScore((deliveryScore(offer.leadTimeDays) * 0.7) + (clampPercent(supplier.deliveryScore, 70) * 0.3));
      const reliability = clampPercent(supplier.reliabilityScore, 70);
      const transportScore = roundScore(100 - Math.min(80, ((offer.deliveryFee ?? 0) / Math.max(1, landedCostExVat)) * 100));
      const priceScore = roundScore(100 - (((landedCostExVat - minCost) / spread) * 55));
      const overallValueScore = roundScore(
        (priceScore * 0.3)
        + (quality * 0.18)
        + (delivery * 0.16)
        + (stock * 0.14)
        + (reliability * 0.14)
        + (transportScore * 0.08),
      );
      const level = riskLevel(overallValueScore, stock, reliability);
      const baseline = lineBaselineTotal(line);
      const costImpact = roundMoney(baseline - landedCostExVat);

      scored.push({
        line,
        offer,
        supplier,
        landedCostExVat,
        vatAmount,
        landedCostInclVat: roundMoney(landedCostExVat + vatAmount),
        priceScore,
        qualityScore: quality,
        deliveryScore: delivery,
        stockAvailabilityScore: stock,
        reliabilityScore: reliability,
        transportScore,
        overallValueScore,
        riskLevel: level,
        confidenceScore: roundScore((line.confidenceScore * 0.35) + (overallValueScore * 0.65)),
        deliveryImpactDays: Math.max(0, offer.leadTimeDays ?? 0),
        transportImpact: roundMoney((offer.deliveryFee ?? 0) - line.transportAllowance),
        costImpact,
        marginImpact: roundMoney(costImpact * estimate.assumptions.profitPercentage),
      });
    }
  }

  return scored;
}

export function buildSupplierRecommendations(
  estimate: QSEstimate,
  suppliers: QSSupplierProfile[],
  offers: QSSupplierProductOffer[],
  createdByUid?: string | null,
): QSSupplierRecommendation[] {
  const createdAt = nowIso();
  const scored = scoreSupplierOffersForEstimate(estimate, suppliers, offers);
  const recommendations: QSSupplierRecommendation[] = [];

  for (const line of estimate.lines) {
    const lineScores = scored.filter((candidate) => candidate.line.estimateLineId === line.estimateLineId);
    for (const category of RECOMMENDATION_CATEGORIES) {
      const winner = [...lineScores].sort((a, b) => categorySortValue(b, category) - categorySortValue(a, category))[0];
      if (!winner) continue;

      recommendations.push({
        recommendationId: `${estimate.estimateId}-${line.estimateLineId}-${category}-${winner.offer.offerId}`,
        estimateId: estimate.estimateId,
        estimateLineId: line.estimateLineId,
        boqLineItemId: line.boqLineItemId,
        materialId: winner.offer.materialId,
        category,
        supplierId: winner.supplier.supplierId,
        supplierName: winner.supplier.supplierName,
        offerId: winner.offer.offerId,
        materialName: winner.offer.materialName,
        isSponsoredSupplier: winner.supplier.isSponsoredSupplier,
        unitPriceExVat: winner.offer.unitPriceExVat,
        quantity: line.quantity,
        landedCostExVat: winner.landedCostExVat,
        vatAmount: winner.vatAmount,
        landedCostInclVat: winner.landedCostInclVat,
        score: recommendationScore(winner, category),
        priceScore: winner.priceScore,
        qualityScore: winner.qualityScore,
        deliveryScore: winner.deliveryScore,
        stockAvailabilityScore: winner.stockAvailabilityScore,
        reliabilityScore: winner.reliabilityScore,
        transportScore: winner.transportScore,
        costImpact: winner.costImpact,
        marginImpact: winner.marginImpact,
        deliveryImpactDays: winner.deliveryImpactDays,
        transportImpact: winner.transportImpact,
        riskLevel: winner.riskLevel,
        explanation: buildExplanation(winner, category),
        tradeOffs: buildTradeOffs(winner),
        confidenceScore: winner.confidenceScore,
        status: "active",
        version: 1,
        createdAt,
        updatedAt: createdAt,
        createdBy: createdByUid ?? null,
        updatedBy: createdByUid ?? null,
        createdByUid: createdByUid ?? null,
        updatedByUid: createdByUid ?? null,
      });
    }
  }

  return recommendations;
}

export function buildCommercialImpactScenarios(
  estimate: QSEstimate,
  recommendations: QSSupplierRecommendation[],
  offers: QSSupplierProductOffer[],
  createdByUid?: string | null,
): QSCommercialImpactScenario[] {
  const createdAt = nowIso();
  const lineById = new Map(estimate.lines.map((line) => [line.estimateLineId, line]));
  const offerById = new Map(offers.map((offer) => [offer.offerId, offer]));

  return recommendations.map((recommendation) => {
    const line = lineById.get(recommendation.estimateLineId);
    const offer = offerById.get(recommendation.offerId);
    const fallbackNewTotal = roundMoney(estimate.totalEstimatedProjectValue - recommendation.costImpact);
    const syntheticScored = line && offer
      ? {
          line,
          offer,
          supplier: {
            supplierId: recommendation.supplierId,
            supplierName: recommendation.supplierName,
            qualityScore: recommendation.qualityScore,
            reliabilityScore: recommendation.reliabilityScore,
            deliveryScore: recommendation.deliveryScore,
            priceCompetitivenessScore: recommendation.priceScore,
            stockAvailabilityScore: recommendation.stockAvailabilityScore,
            overallSupplierScore: recommendation.score,
            isSponsoredSupplier: recommendation.isSponsoredSupplier,
          } as QSSupplierProfile,
          riskLevel: recommendation.riskLevel,
        } as ScoredOffer
      : null;
    const replacementLineTotal = line && syntheticScored ? recalculateLineWithOffer(estimate, line, syntheticScored) : null;
    const newEstimateTotal = replacementLineTotal && line
      ? roundMoney(estimate.totalEstimatedProjectValue - line.lineTotal + replacementLineTotal)
      : fallbackNewTotal;
    const delta = roundMoney(estimate.totalEstimatedProjectValue - newEstimateTotal);
    const marginImpact = roundMoney(delta * estimate.assumptions.profitPercentage);

    return {
      scenarioId: `${recommendation.recommendationId}-scenario`,
      estimateId: estimate.estimateId,
      estimateLineId: recommendation.estimateLineId,
      supplierId: recommendation.supplierId,
      supplierName: recommendation.supplierName,
      offerId: recommendation.offerId,
      recommendationCategory: recommendation.category,
      currentEstimateTotal: estimate.totalEstimatedProjectValue,
      newEstimateTotal,
      costSaving: Math.max(0, delta),
      costIncrease: Math.max(0, -delta),
      profitImpact: marginImpact,
      marginImpactPercentage: roundMoney((marginImpact / Math.max(1, estimate.totalEstimatedProjectValue)) * 100),
      transportImpact: recommendation.transportImpact,
      deliveryImpactDays: recommendation.deliveryImpactDays,
      riskImpact: recommendation.riskLevel,
      quoteReadinessImpact: quoteReadinessFromRisk(estimate.quoteReadinessStatus, recommendation.riskLevel),
      explanation: delta >= 0
        ? `${recommendation.supplierName} can improve the estimate by ${formatMoney(delta)} while carrying ${recommendation.riskLevel} supplier risk.`
        : `${recommendation.supplierName} increases the estimate by ${formatMoney(Math.abs(delta))}; use only if the quality, delivery, or risk benefit justifies the premium.`,
      status: "active",
      version: 1,
      createdAt,
      updatedAt: createdAt,
      createdBy: createdByUid ?? null,
      updatedBy: createdByUid ?? null,
      createdByUid: createdByUid ?? null,
      updatedByUid: createdByUid ?? null,
    };
  });
}

export function listSupplierProfiles(limit = 100) {
  return listQsRecords<QSSupplierProfile>(QS_COLLECTIONS.qsSuppliers, { limit });
}

export function getSupplierProfile(supplierId: string) {
  return getQsRecord<QSSupplierProfile>(QS_COLLECTIONS.qsSuppliers, supplierId);
}

export function createSupplierProfile(payload: QsCreateInput<QSSupplierProfile>) {
  return createQsRecord<QSSupplierProfile>(QS_COLLECTIONS.qsSuppliers, "supplierId", payload);
}

export function updateSupplierProfile(supplierId: string, updates: QsUpdateInput<QSSupplierProfile>) {
  return updateQsRecord<QSSupplierProfile>(QS_COLLECTIONS.qsSuppliers, supplierId, updates);
}

export function listSupplierOffers(limit = 500) {
  return listQsRecords<QSSupplierProductOffer>(QS_COLLECTIONS.qsSupplierOffers, { limit });
}

export function createSupplierOffer(payload: QsCreateInput<QSSupplierProductOffer>) {
  return createQsRecord<QSSupplierProductOffer>(QS_COLLECTIONS.qsSupplierOffers, "offerId", payload);
}

export async function listRecommendationsForEstimate(estimateId: string): Promise<QSSupplierRecommendation[]> {
  const snapshot = await qsCollection(QS_COLLECTIONS.qsSupplierRecommendations).where("estimateId", "==", estimateId).limit(500).get();
  return snapshot.docs.map((doc) => ({ recommendationId: doc.id, ...doc.data() }) as QSSupplierRecommendation);
}

export async function listCommercialScenariosForEstimate(estimateId: string): Promise<QSCommercialImpactScenario[]> {
  const snapshot = await qsCollection(QS_COLLECTIONS.qsSupplierCommercialScenarios).where("estimateId", "==", estimateId).limit(500).get();
  return snapshot.docs.map((doc) => ({ scenarioId: doc.id, ...doc.data() }) as QSCommercialImpactScenario);
}

export async function generateSupplierRecommendationsForEstimate(
  estimateId: string,
  createdByUid?: string | null,
): Promise<GenerateSupplierRecommendationsResult> {
  const [estimate, suppliers, offers] = await Promise.all([
    getEstimate(estimateId),
    listSupplierProfiles(500),
    listSupplierOffers(1000),
  ]);

  if (!estimate) {
    throw new Error(`QS estimate not found: ${estimateId}`);
  }

  const recommendations = buildSupplierRecommendations(estimate, suppliers, offers, createdByUid);
  const scenarios = buildCommercialImpactScenarios(estimate, recommendations, offers, createdByUid);

  await Promise.all([
    ...recommendations.map((recommendation) => createQsRecord<QSSupplierRecommendation>(
      QS_COLLECTIONS.qsSupplierRecommendations,
      "recommendationId",
      recommendation,
    )),
    ...scenarios.map((scenario) => createQsRecord<QSCommercialImpactScenario>(
      QS_COLLECTIONS.qsSupplierCommercialScenarios,
      "scenarioId",
      scenario,
    )),
  ]);

  return { estimate, recommendations, scenarios };
}

export async function generateCommercialScenariosForEstimate(
  estimateId: string,
  createdByUid?: string | null,
): Promise<QSCommercialImpactScenario[]> {
  const [estimate, recommendations, offers] = await Promise.all([
    getEstimate(estimateId),
    listRecommendationsForEstimate(estimateId),
    listSupplierOffers(1000),
  ]);

  if (!estimate) {
    throw new Error(`QS estimate not found: ${estimateId}`);
  }

  const sourceRecommendations = recommendations.length
    ? recommendations
    : (await generateSupplierRecommendationsForEstimate(estimateId, createdByUid)).recommendations;
  const scenarios = buildCommercialImpactScenarios(estimate, sourceRecommendations, offers, createdByUid);

  await Promise.all(scenarios.map((scenario) => createQsRecord<QSCommercialImpactScenario>(
    QS_COLLECTIONS.qsSupplierCommercialScenarios,
    "scenarioId",
    scenario,
  )));

  return scenarios;
}

export async function logSupplierContactAction(args: {
  userUid: string;
  userRole?: string | null;
  contractorId?: string | null;
  supplierId: string;
  supplierName?: string | null;
  estimateId?: string | null;
  estimateLineId?: string | null;
  materialId?: string | null;
  boqLineItemId?: string | null;
  actionType: QSSupplierContactActionType;
  notes?: string | null;
}): Promise<QSSupplierContactAction> {
  return createQsRecord<QSSupplierContactAction>(
    QS_COLLECTIONS.qsSupplierContactActions,
    "contactActionId",
    buildSupplierContactActionPayload(args),
  );
}

export function buildSupplierContactActionPayload(args: {
  userUid: string;
  userRole?: string | null;
  contractorId?: string | null;
  supplierId: string;
  supplierName?: string | null;
  estimateId?: string | null;
  estimateLineId?: string | null;
  materialId?: string | null;
  boqLineItemId?: string | null;
  actionType: QSSupplierContactActionType;
  notes?: string | null;
}): Omit<QSSupplierContactAction, "createdAt" | "updatedAt"> {
  const contactActionId = `qs-lead-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    contactActionId,
    contractorId: args.contractorId ?? null,
    userUid: args.userUid,
    userRole: args.userRole ?? null,
    supplierId: args.supplierId,
    supplierName: args.supplierName ?? null,
    estimateId: args.estimateId ?? null,
    estimateLineId: args.estimateLineId ?? null,
    materialId: args.materialId ?? null,
    boqLineItemId: args.boqLineItemId ?? null,
    actionType: args.actionType,
    contactStatus: "logged",
    sourceModule: "qsSupplierIntelligence",
    notes: args.notes ?? null,
    createdByUid: args.userUid,
    updatedByUid: args.userUid,
    createdBy: args.userUid,
    updatedBy: args.userUid,
  };
}
