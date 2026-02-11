// src/lib/utils/admin/getAdminMetrics.ts

import type { Deal } from "@/types/deal";
import { computeDealRisk } from "@/lib/intelligence/computeDealRisk";

export interface AdminMetrics {
  totalDeals: number;
  totalPipelineValue: number;
  weightedRevenue: number;
  lockedDeals: number;
  unassignedDeals: number;

  highValueUnassigned: number;
  stuckInManagerReview: number;
  readyToSubmit: number;
  submissionConversion: number;

  stageCounts: Record<string, number>;

  staleDeals: number;

  // Intelligence Layer
  criticalRiskDeals: number;
  highRiskDeals: number;
  mediumRiskDeals: number;
  portfolioRiskScore: number; // 0–100
  revenueHealthScore: number; // 0–100
}

const STAGE_WEIGHT: Record<string, number> = {
  draft: 0.1,
  pricing: 0.25,
  manager_review: 0.5,
  submitted: 0.75,
  won: 1,
  lost: 0,
};

export function computeAdminMetrics(deals: Deal[]): AdminMetrics {
  const totalDeals = deals.length;

  let totalPipelineValue = 0;
  let weightedRevenue = 0;
  let lockedDeals = 0;
  let unassignedDeals = 0;
  let highValueUnassigned = 0;
  let stuckInManagerReview = 0;
  let readyToSubmit = 0;

  const stageCounts: Record<string, number> = {};
  const dealRisks = deals.map(computeDealRisk);

  let staleDeals = 0;

  deals.forEach((deal) => {
    const value = deal.value ?? 0;
    const stage = deal.stage ?? "undefined";

    totalPipelineValue += value;

    const weight = STAGE_WEIGHT[stage] ?? 0;
    weightedRevenue += value * weight;

    stageCounts[stage] = (stageCounts[stage] ?? 0) + 1;

    if (deal.isTenderLocked) lockedDeals++;
    if (!deal.assignedTo) unassignedDeals++;

    if (!deal.assignedTo && value > 200000) highValueUnassigned++;
    if (stage === "manager_review") stuckInManagerReview++;
    if (deal.pricingStatus === "manager_approved" && stage !== "submitted")
      readyToSubmit++;
  });

  // Risk aggregation
  const criticalRiskDeals = dealRisks.filter(
    (r) => r.riskLevel === "critical"
  ).length;

  const highRiskDeals = dealRisks.filter(
    (r) => r.riskLevel === "high"
  ).length;

  const mediumRiskDeals = dealRisks.filter(
    (r) => r.riskLevel === "medium"
  ).length;

  const averageRiskScore =
    dealRisks.reduce((sum, r) => sum + r.riskScore, 0) /
    (dealRisks.length || 1);

  const portfolioRiskScore = Math.round(averageRiskScore);

  // Revenue Health Score (inverse of risk impact)
  const revenueHealthScore = Math.max(
    0,
    100 - portfolioRiskScore
  );

  const wonCount = stageCounts["won"] ?? 0;
  const submittedCount = stageCounts["submitted"] ?? 0;

  const submissionConversion =
    submittedCount > 0
      ? (wonCount / submittedCount) * 100
      : 0;

  return {
    totalDeals,
    totalPipelineValue,
    weightedRevenue,
    lockedDeals,
    unassignedDeals,

    highValueUnassigned,
    stuckInManagerReview,
    readyToSubmit,
    submissionConversion,

    stageCounts,

    staleDeals,

    criticalRiskDeals,
    highRiskDeals,
    mediumRiskDeals,
    portfolioRiskScore,
    revenueHealthScore,
  };
}