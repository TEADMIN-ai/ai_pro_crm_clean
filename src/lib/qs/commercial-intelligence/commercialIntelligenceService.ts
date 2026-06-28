import { QS_COLLECTIONS } from "@/lib/qs/collections";
import { createQsRecord, getQsRecord, listQsRecords, qsCollection, updateQsRecord } from "@/lib/qs/firestore";
import { listEstimates } from "@/lib/qs/estimating";
import {
  listCommercialScenariosForEstimate,
  listRecommendationsForEstimate,
  listSupplierOffers,
  listSupplierProfiles,
} from "@/lib/qs/supplier-intelligence";
import type {
  QSCommercialDashboardSummary,
  QSCommercialImpactScenario,
  QSCompletedProjectFeedback,
  QSMaterialPriceObservation,
  QSPriceMovementSignal,
  QSRegionalSupplierInsight,
  QSRecommendationOutcome,
  QSSupplierDecisionFlag,
  QSSupplierDecisionFlagReason,
  QSSupplierDecisionStatus,
  QSSupplierPerformanceRating,
  QSSupplierProductOffer,
  QSSupplierProfile,
  QSSupplierRecommendation,
  QSSupplierRiskLevel,
  QSTransportIntelligence,
  QsCreateInput,
  QsProvince,
  QsRecordStatus,
  QsUpdateInput,
  QSTrendDirection,
} from "@/types/qs";

type RatingInput = Omit<QsCreateInput<QSSupplierPerformanceRating>, "ratingId" | "overallSupplierScore" | "trendDirection" | "lastEvaluatedAt" | "status" | "version"> & {
  ratingId?: string;
  overallSupplierScore?: number;
  trendDirection?: QSTrendDirection;
  lastEvaluatedAt?: string;
  status?: QsRecordStatus;
  version?: number;
};

type FeedbackInput = Omit<QsCreateInput<QSCompletedProjectFeedback>, "feedbackId" | "learningStatus"> & {
  feedbackId?: string;
  learningStatus?: QSCompletedProjectFeedback["learningStatus"];
};

type ObservationInput = Omit<QsCreateInput<QSMaterialPriceObservation>, "observationId" | "status"> & {
  observationId?: string;
  status?: QsRecordStatus;
};

function nowIso() {
  return new Date().toISOString();
}

function round(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round((Number.isFinite(value) ? value : 0) * factor) / factor;
}

function clamp(value: number | null | undefined, min = 0, max = 100): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function average(values: number[]): number {
  const usable = values.filter((value) => Number.isFinite(value));
  return usable.length ? usable.reduce((sum, value) => sum + value, 0) / usable.length : 0;
}

export function calculateSupplierPerformanceScore(input: {
  deliveryReliabilityScore: number;
  priceAccuracyScore: number;
  qualityRating: number;
  stockAccuracyScore: number;
  communicationRating: number;
  returnsDefectsRate: number;
  invoiceAccuracyScore: number;
}): number {
  const returnsScore = 100 - clamp(input.returnsDefectsRate, 0, 100);
  return Math.round(
    (clamp(input.deliveryReliabilityScore) * 0.18)
    + (clamp(input.priceAccuracyScore) * 0.16)
    + (clamp(input.qualityRating) * 0.18)
    + (clamp(input.stockAccuracyScore) * 0.14)
    + (clamp(input.communicationRating) * 0.12)
    + (returnsScore * 0.12)
    + (clamp(input.invoiceAccuracyScore) * 0.1),
  );
}

export function resolveTrendDirection(currentScore: number, previousScore?: number | null): QSTrendDirection {
  if (typeof previousScore !== "number" || !Number.isFinite(previousScore)) return "insufficientData";
  const delta = currentScore - previousScore;
  if (delta >= 4) return "improving";
  if (delta <= -4) return "declining";
  return "stable";
}

export async function listSupplierPerformanceRatings(limit = 500): Promise<QSSupplierPerformanceRating[]> {
  return listQsRecords<QSSupplierPerformanceRating>(QS_COLLECTIONS.qsSupplierPerformanceRatings, { limit });
}

export async function createSupplierPerformanceRating(input: RatingInput): Promise<QSSupplierPerformanceRating> {
  const previousRatings = input.supplierId
    ? (await listSupplierPerformanceRatings()).filter((rating) => rating.supplierId === input.supplierId)
    : [];
  const latestPrevious = previousRatings.sort((left, right) => String(right.lastEvaluatedAt).localeCompare(String(left.lastEvaluatedAt)))[0];
  const overallSupplierScore = input.overallSupplierScore ?? calculateSupplierPerformanceScore(input);
  const ratingId = input.ratingId ?? `qsr-${Date.now()}`;
  const timestamp = nowIso();

  return createQsRecord<QSSupplierPerformanceRating>(QS_COLLECTIONS.qsSupplierPerformanceRatings, "ratingId", {
    ...input,
    ratingId,
    overallSupplierScore,
    trendDirection: input.trendDirection ?? resolveTrendDirection(overallSupplierScore, latestPrevious?.overallSupplierScore),
    lastEvaluatedAt: input.lastEvaluatedAt ?? timestamp,
    status: input.status ?? "active",
    version: input.version ?? 1,
  });
}

export async function listCompletedProjectFeedback(limit = 500): Promise<QSCompletedProjectFeedback[]> {
  return listQsRecords<QSCompletedProjectFeedback>(QS_COLLECTIONS.qsCommercialFeedback, { limit });
}

export function buildCompletedProjectFeedbackPayload(input: FeedbackInput): QSCompletedProjectFeedback {
  const timestamp = nowIso();
  return {
    ...input,
    feedbackId: input.feedbackId ?? `qsf-${Date.now()}`,
    projectId: input.projectId ?? null,
    projectName: input.projectName ?? null,
    supplierId: input.supplierId ?? null,
    supplierName: input.supplierName ?? null,
    recommendationId: input.recommendationId ?? null,
    overrideReason: input.recommendationOutcome === "overridden" ? input.overrideReason ?? "Override reason not supplied." : input.overrideReason ?? null,
    projectFeedbackScore: input.projectFeedbackScore ?? null,
    projectFeedbackNotes: input.projectFeedbackNotes ?? null,
    learningStatus: input.learningStatus ?? "captured",
    completedAt: input.completedAt ?? timestamp,
    createdAt: input.createdAt ?? timestamp,
    updatedAt: input.updatedAt ?? timestamp,
    createdByUid: input.createdByUid ?? null,
    updatedByUid: input.updatedByUid ?? null,
    createdBy: input.createdBy ?? input.createdByUid ?? null,
    updatedBy: input.updatedBy ?? input.updatedByUid ?? null,
  };
}

export function createCompletedProjectFeedback(input: FeedbackInput): Promise<QSCompletedProjectFeedback> {
  return createQsRecord<QSCompletedProjectFeedback>(
    QS_COLLECTIONS.qsCommercialFeedback,
    "feedbackId",
    buildCompletedProjectFeedbackPayload(input),
  );
}

export async function listMaterialPriceObservations(limit = 500): Promise<QSMaterialPriceObservation[]> {
  return listQsRecords<QSMaterialPriceObservation>(QS_COLLECTIONS.qsMaterialPriceHistory, { limit });
}

export function createMaterialPriceObservation(input: ObservationInput): Promise<QSMaterialPriceObservation> {
  return createQsRecord<QSMaterialPriceObservation>(QS_COLLECTIONS.qsMaterialPriceHistory, "observationId", {
    ...input,
    observationId: input.observationId ?? `qspo-${Date.now()}`,
    supplierId: input.supplierId ?? null,
    supplierName: input.supplierName ?? null,
    province: input.province ?? null,
    city: input.city ?? null,
    status: input.status ?? "active",
  });
}

export function calculatePriceMovementSignals(observations: QSMaterialPriceObservation[]): QSPriceMovementSignal[] {
  const byMaterial = new Map<string, QSMaterialPriceObservation[]>();
  for (const observation of observations.filter((item) => item.status === "active")) {
    byMaterial.set(observation.materialId, [...(byMaterial.get(observation.materialId) ?? []), observation]);
  }

  return Array.from(byMaterial.values()).map((items) => {
    const sorted = [...items].sort((left, right) => String(left.observedAt).localeCompare(String(right.observedAt)));
    const first = sorted[0];
    const latest = sorted[sorted.length - 1];
    const movementPercentage = first && latest && first.price > 0 ? round(((latest.price - first.price) / first.price) * 100, 1) : 0;
    const confidence = sorted.length >= 3 ? "sufficientHistory" : "insufficientData";
    const trendDirection: QSTrendDirection = confidence === "insufficientData"
      ? "insufficientData"
      : movementPercentage > 2
        ? "declining"
        : movementPercentage < -2
          ? "improving"
          : "stable";

    return {
      materialId: latest.materialId,
      materialName: latest.materialName,
      observationCount: sorted.length,
      firstPrice: first.price,
      latestPrice: latest.price,
      movementPercentage,
      trendDirection,
      confidence,
    };
  });
}

export async function listSupplierDecisionFlags(limit = 500): Promise<QSSupplierDecisionFlag[]> {
  return listQsRecords<QSSupplierDecisionFlag>(QS_COLLECTIONS.qsSupplierDecisionFlags, { limit });
}

export async function getSupplierDecisionFlag(supplierId: string): Promise<QSSupplierDecisionFlag | null> {
  return getQsRecord<QSSupplierDecisionFlag>(QS_COLLECTIONS.qsSupplierDecisionFlags, supplierId);
}

export async function upsertSupplierDecisionFlag(input: {
  supplierId: string;
  supplierName?: string | null;
  status: QSSupplierDecisionStatus;
  reason: QSSupplierDecisionFlagReason;
  notes?: string | null;
  setByUid: string;
}): Promise<QSSupplierDecisionFlag> {
  const timestamp = nowIso();
  const existing = await getSupplierDecisionFlag(input.supplierId);
  const historyEntry = {
    status: input.status,
    reason: input.reason,
    notes: input.notes ?? null,
    setByUid: input.setByUid,
    setAt: timestamp,
  };

  if (existing) {
    return updateQsRecord<QSSupplierDecisionFlag>(QS_COLLECTIONS.qsSupplierDecisionFlags, input.supplierId, {
      supplierName: input.supplierName ?? existing.supplierName ?? null,
      status: input.status,
      reason: input.reason,
      notes: input.notes ?? null,
      setByUid: input.setByUid,
      setAt: timestamp,
      statusHistory: [...(existing.statusHistory ?? []), historyEntry],
      version: (existing.version ?? 1) + 1,
    } as QsUpdateInput<QSSupplierDecisionFlag>);
  }

  return createQsRecord<QSSupplierDecisionFlag>(QS_COLLECTIONS.qsSupplierDecisionFlags, "flagId", {
    flagId: input.supplierId,
    supplierId: input.supplierId,
    supplierName: input.supplierName ?? null,
    status: input.status,
    reason: input.reason,
    notes: input.notes ?? null,
    setByUid: input.setByUid,
    setAt: timestamp,
    statusHistory: [historyEntry],
    version: 1,
  });
}

export function buildTransportIntelligence(
  supplier: QSSupplierProfile,
  offer: QSSupplierProductOffer,
): QSTransportIntelligence {
  const branch = supplier.branches.find((candidate) => candidate.province && supplier.deliveryAreas.includes(candidate.province)) ?? supplier.branches[0] ?? null;
  const deliveryFee = round(offer.deliveryFee ?? branch?.standardDeliveryFee ?? 0);
  const leadTimeDays = offer.leadTimeDays ?? branch?.averageLeadTimeDays ?? null;
  const hasGps = Boolean(branch?.gps);
  const distanceKm = typeof branch?.deliveryRadiusKm === "number" ? branch.deliveryRadiusKm : null;
  const distanceStatus = typeof distanceKm === "number" ? "known" : hasGps ? "distanceUnavailable" : "requiresBranchGps";
  const loadingUnloadingAllowance = round(Math.max(0, deliveryFee * 0.08));
  const deliveryConfidence = Math.round(
    (clamp(supplier.deliveryScore, 0, 100) * 0.45)
    + (clamp(supplier.reliabilityScore, 0, 100) * 0.25)
    + ((leadTimeDays === null ? 45 : leadTimeDays <= 2 ? 100 : leadTimeDays <= 7 ? 72 : 42) * 0.3),
  );
  const transportRisk: QSSupplierRiskLevel = deliveryConfidence >= 76 && distanceStatus !== "requiresBranchGps"
    ? "low"
    : deliveryConfidence >= 52
      ? "medium"
      : "high";

  return {
    supplierId: supplier.supplierId,
    supplierName: supplier.supplierName,
    branchId: branch?.branchId ?? null,
    branchName: branch?.branchName ?? null,
    province: branch?.province ?? supplier.deliveryAreas[0] ?? null,
    city: branch?.city ?? null,
    distanceKm,
    distanceStatus,
    deliveryFee,
    leadTimeDays,
    loadingUnloadingAllowance,
    transportRisk,
    deliveryConfidence,
    explanation: distanceStatus === "known"
      ? `Transport uses known branch delivery radius data for ${branch?.branchName ?? supplier.supplierName}.`
      : distanceStatus === "distanceUnavailable"
        ? "Branch GPS exists, but site distance has not been calculated yet."
        : "Distance unavailable; branch GPS is required before route-level transport modelling.",
  };
}

export function buildRegionalSupplierInsights(
  suppliers: QSSupplierProfile[],
  offers: QSSupplierProductOffer[],
  ratings: QSSupplierPerformanceRating[] = [],
): QSRegionalSupplierInsight[] {
  const regions = new Set<QsProvince>();
  for (const supplier of suppliers) {
    supplier.deliveryAreas.forEach((region) => regions.add(region));
    supplier.branches.forEach((branch) => regions.add(branch.province));
  }

  const ratingBySupplier = latestRatingsBySupplier(ratings);
  return Array.from(regions).sort().map((region) => {
    const regionalSuppliers = suppliers.filter((supplier) => supplier.deliveryAreas.includes(region) || supplier.branches.some((branch) => branch.province === region));
    const regionalOffers = offers.filter((offer) => regionalSuppliers.some((supplier) => supplier.supplierId === offer.supplierId) && offer.status === "active");

    if (regionalSuppliers.length < 2 || regionalOffers.length < 2) {
      return { region, cheapestSupplier: null, fastestDeliverySupplier: null, bestRatedSupplier: null, dataState: "insufficientData" };
    }

    const cheapest = [...regionalOffers].sort((left, right) => ((left.unitPriceExVat + (left.deliveryFee ?? 0)) - (right.unitPriceExVat + (right.deliveryFee ?? 0))))[0];
    const fastest = [...regionalOffers].filter((offer) => typeof offer.leadTimeDays === "number").sort((left, right) => (left.leadTimeDays ?? 999) - (right.leadTimeDays ?? 999))[0];
    const bestRated = [...regionalSuppliers].sort((left, right) => {
      const leftScore = ratingBySupplier.get(left.supplierId)?.overallSupplierScore ?? left.overallSupplierScore;
      const rightScore = ratingBySupplier.get(right.supplierId)?.overallSupplierScore ?? right.overallSupplierScore;
      return rightScore - leftScore;
    })[0];

    const cheapestSupplier = suppliers.find((supplier) => supplier.supplierId === cheapest.supplierId) ?? null;
    const fastestSupplier = fastest ? suppliers.find((supplier) => supplier.supplierId === fastest.supplierId) ?? null : null;

    return {
      region,
      cheapestSupplier: cheapestSupplier ? {
        supplierId: cheapestSupplier.supplierId,
        supplierName: cheapestSupplier.supplierName,
        landedCostExVat: round(cheapest.unitPriceExVat + (cheapest.deliveryFee ?? 0)),
      } : null,
      fastestDeliverySupplier: fastest && fastestSupplier ? {
        supplierId: fastestSupplier.supplierId,
        supplierName: fastestSupplier.supplierName,
        leadTimeDays: fastest.leadTimeDays ?? 0,
      } : null,
      bestRatedSupplier: bestRated ? {
        supplierId: bestRated.supplierId,
        supplierName: bestRated.supplierName,
        score: ratingBySupplier.get(bestRated.supplierId)?.overallSupplierScore ?? bestRated.overallSupplierScore,
      } : null,
      dataState: "sufficientData",
    };
  });
}

function latestRatingsBySupplier(ratings: QSSupplierPerformanceRating[]): Map<string, QSSupplierPerformanceRating> {
  const sorted = [...ratings].sort((left, right) => String(right.lastEvaluatedAt).localeCompare(String(left.lastEvaluatedAt)));
  const map = new Map<string, QSSupplierPerformanceRating>();
  for (const rating of sorted) {
    if (!map.has(rating.supplierId) && rating.status === "active") map.set(rating.supplierId, rating);
  }
  return map;
}

function supplierNameForId(suppliers: QSSupplierProfile[], supplierId: string): string {
  return suppliers.find((supplier) => supplier.supplierId === supplierId)?.supplierName ?? supplierId;
}

export function calculateRecommendationAcceptanceRate(feedback: QSCompletedProjectFeedback[]): number | null {
  const actionable = feedback.filter((item) => item.recommendationOutcome === "accepted" || item.recommendationOutcome === "overridden");
  if (!actionable.length) return null;
  return round((actionable.filter((item) => item.recommendationOutcome === "accepted").length / actionable.length) * 100, 1);
}

function estimateMarginPercentage(estimate: { breakdown: { profit: number; totalInclVat: number } }): number {
  return round((estimate.breakdown.profit / Math.max(1, estimate.breakdown.totalInclVat)) * 100, 1);
}

export async function buildCommercialDashboardSummary(): Promise<QSCommercialDashboardSummary> {
  const [estimates, suppliers, offers, ratings, feedback, observations] = await Promise.all([
    listEstimates(500),
    listSupplierProfiles(500),
    listSupplierOffers(1000),
    listSupplierPerformanceRatings(500),
    listCompletedProjectFeedback(500),
    listMaterialPriceObservations(500),
  ]);
  const recommendationsByEstimate = await Promise.all(estimates.slice(0, 50).map((estimate) => listRecommendationsForEstimate(estimate.estimateId)));
  const scenariosByEstimate = await Promise.all(estimates.slice(0, 50).map((estimate) => listCommercialScenariosForEstimate(estimate.estimateId)));
  const recommendations = recommendationsByEstimate.flat();
  const scenarios = scenariosByEstimate.flat();
  return calculateCommercialDashboardSummary({ estimates, suppliers, offers, ratings, feedback, observations, recommendations, scenarios });
}

export function calculateCommercialDashboardSummary(args: {
  estimates: Awaited<ReturnType<typeof listEstimates>>;
  suppliers: QSSupplierProfile[];
  offers: QSSupplierProductOffer[];
  ratings: QSSupplierPerformanceRating[];
  feedback: QSCompletedProjectFeedback[];
  observations: QSMaterialPriceObservation[];
  recommendations: QSSupplierRecommendation[];
  scenarios: QSCommercialImpactScenario[];
}): QSCommercialDashboardSummary {
  const latestRatings = latestRatingsBySupplier(args.ratings);
  const averageMarginPercentage = round(average(args.estimates.map(estimateMarginPercentage)), 1);
  const missingPricingCount = args.estimates.reduce((total, estimate) => total + estimate.missingPricingWarnings.length, 0);
  const lowMarginEstimates = args.estimates
    .map((estimate) => ({
      estimateId: estimate.estimateId,
      projectName: estimate.projectName,
      marginPercentage: estimateMarginPercentage(estimate),
      totalEstimatedProjectValue: estimate.totalEstimatedProjectValue,
    }))
    .filter((estimate) => estimate.marginPercentage < 8)
    .sort((left, right) => left.marginPercentage - right.marginPercentage)
    .slice(0, 8);
  const supplierPerformanceLeaderboard = args.suppliers
    .map((supplier) => {
      const rating = latestRatings.get(supplier.supplierId);
      return {
        supplierId: supplier.supplierId,
        supplierName: supplier.supplierName,
        overallSupplierScore: rating?.overallSupplierScore ?? supplier.overallSupplierScore,
        trendDirection: rating?.trendDirection ?? "insufficientData" as QSTrendDirection,
      };
    })
    .sort((left, right) => right.overallSupplierScore - left.overallSupplierScore)
    .slice(0, 10);
  const savingsOpportunities = [...args.scenarios]
    .filter((scenario) => scenario.costSaving > 0)
    .sort((left, right) => right.costSaving - left.costSaving)
    .slice(0, 8)
    .map((scenario) => ({
      scenarioId: scenario.scenarioId,
      estimateId: scenario.estimateId,
      supplierName: scenario.supplierName,
      costSaving: scenario.costSaving,
      profitImpact: scenario.profitImpact,
    }));
  const riskOrder: Record<QSSupplierRiskLevel, number> = { high: 3, medium: 2, low: 1 };
  const highestRisk = [...args.recommendations].sort((left, right) => {
    const riskDelta = riskOrder[right.riskLevel] - riskOrder[left.riskLevel];
    return riskDelta || left.score - right.score;
  })[0] ?? null;
  const transportRiskSummary: Record<QSSupplierRiskLevel, number> = { low: 0, medium: 0, high: 0 };
  for (const offer of args.offers) {
    const supplier = args.suppliers.find((candidate) => candidate.supplierId === offer.supplierId);
    if (!supplier) continue;
    transportRiskSummary[buildTransportIntelligence(supplier, offer).transportRisk] += 1;
  }
  const dataGaps: string[] = [];
  if (!args.feedback.length) dataGaps.push("No completed-project feedback has been captured yet.");
  if (!args.ratings.length) dataGaps.push("No supplier performance ratings have been captured yet.");
  if (!args.observations.length) dataGaps.push("No material price observations have been captured yet.");
  if (!args.scenarios.length) dataGaps.push("No commercial impact scenarios have been generated yet.");
  const priceMovementSignals = calculatePriceMovementSignals(args.observations);
  if (!priceMovementSignals.some((signal) => signal.confidence === "sufficientHistory")) {
    dataGaps.push("Price movement cards need at least three observations per material.");
  }

  const healthComponents = [
    Math.max(0, 100 - missingPricingCount * 6),
    Math.min(100, Math.max(0, averageMarginPercentage * 8)),
    supplierPerformanceLeaderboard[0]?.overallSupplierScore ?? 50,
    savingsOpportunities.length ? 78 : 58,
    transportRiskSummary.high > 0 ? 62 : 82,
  ];

  return {
    commercialHealthScore: Math.round(average(healthComponents)),
    averageMarginPercentage,
    missingPricingCount,
    lowMarginEstimates,
    supplierPerformanceLeaderboard,
    savingsOpportunities,
    highestRiskSupplierMaterial: highestRisk ? {
      supplierId: highestRisk.supplierId,
      supplierName: supplierNameForId(args.suppliers, highestRisk.supplierId),
      materialName: highestRisk.materialName,
      riskLevel: highestRisk.riskLevel,
      score: highestRisk.score,
    } : null,
    recommendationAcceptanceRate: calculateRecommendationAcceptanceRate(args.feedback),
    priceMovementSignals,
    transportRiskSummary,
    recentCommercialImpactScenarios: [...args.scenarios]
      .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)))
      .slice(0, 10),
    regionalInsights: buildRegionalSupplierInsights(args.suppliers, args.offers, args.ratings),
    dataGaps,
  };
}

export async function listCommercialFeedbackByRecommendationOutcome(outcome: QSRecommendationOutcome): Promise<QSCompletedProjectFeedback[]> {
  const snapshot = await qsCollection(QS_COLLECTIONS.qsCommercialFeedback).where("recommendationOutcome", "==", outcome).limit(500).get();
  return snapshot.docs.map((doc) => ({ feedbackId: doc.id, ...doc.data() }) as QSCompletedProjectFeedback);
}
