// src/lib/intelligence/admin/computeAdminMetrics.ts

import type { Deal } from "@/types/deal";
import { computeDealRisk } from "@/lib/risk/computeDealRisk";

export interface AdminMetrics {
  totalDeals: number;
  totalPipelineValue: number;
  weightedRevenue: number;

  // Risk counts
  criticalRiskCount: number;
  highRiskCount: number;
  mediumRiskCount: number;
  lowRiskCount: number;

  // Operational counts
  readyToSubmitCount: number;
  managerReviewStuckCount: number;

  // Performance
  submissionConversion: number;
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

  let readyToSubmitCount = 0;
  let managerReviewStuckCount = 0;

  const stageCounts: Record<string, number> = {};

  // ---- Deal Loop ----
  deals.forEach((deal) => {
    const value = deal.value ?? 0;
    const stage = deal.stage ?? "draft";

    totalPipelineValue += value;

    const weight = STAGE_WEIGHT[stage] ?? 0;
    weightedRevenue += value * weight;

    stageCounts[stage] = (stageCounts[stage] ?? 0) + 1;

    if (
      deal.pricingStatus === "manager_approved" &&
      stage !== "submitted"
    ) {
      readyToSubmitCount++;
    }

    if (stage === "manager_review") {
      managerReviewStuckCount++;
    }
  });

  // ---- Risk Aggregation ----
  const dealRisks = deals.map((deal) => computeDealRisk(deal));

  const criticalRiskCount = dealRisks.filter(
    (r) => r.level === "critical"
  ).length;

  const highRiskCount = dealRisks.filter(
    (r) => r.level === "high"
  ).length;

  const mediumRiskCount = dealRisks.filter(
    (r) => r.level === "medium"
  ).length;

  const lowRiskCount = dealRisks.filter(
    (r) => r.level === "low"
  ).length;

  // ---- Conversion Rate ----
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

    criticalRiskCount,
    highRiskCount,
    mediumRiskCount,
    lowRiskCount,

    readyToSubmitCount,
    managerReviewStuckCount,

    submissionConversion,
  };
}

