// src/lib/kpis/revenueIntelligence.ts

import type { Deal, DealStage } from "@/types/deal";
import type { Timestamp } from "firebase/firestore";

/**
 * Canonical revenue intelligence output
 * Currency assumed to be ZAR at presentation layer
 */
export type RevenueIntelligence = {
  totalPipelineValue: number;
  weightedPipelineValue: number;
  monthToDateRevenue: number;
  winRate: number;
  avgDealValue: number;
  stageBreakdown: Record<
    DealStage,
    {
      count: number;
      value: number;
      weightedValue: number;
    }
  >;
};

/**
 * Stage probability weights
 * MUST stay in sync with DealStage union
 */
const STAGE_WEIGHTS: Record<DealStage, number> = {
  lead: 0.1,
  tender: 0.2,
  proposal: 0.3,
  negotiation: 0.6,
  won: 1.0,
  lost: 0.0,
};

/**
 * Safe numeric coercion
 */
function num(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Normalize Firestore / JS dates safely
 */
function toDate(value: unknown): Date | null {
  if (!value) return null;

  if (value instanceof Date) return value;

  // Firestore Timestamp
  if (typeof value === "object" && "toDate" in (value as any)) {
    try {
      return (value as Timestamp).toDate();
    } catch {
      return null;
    }
  }

  const d = new Date(value as any);
  return Number.isNaN(d.getTime()) ? null : d;
}

function startOfMonth(): Date {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function computeRevenueIntelligence(
  deals: Deal[]
): RevenueIntelligence {
  const stageBreakdown: RevenueIntelligence["stageBreakdown"] = {
    lead: { count: 0, value: 0, weightedValue: 0 },
    tender: { count: 0, value: 0, weightedValue: 0 },
    proposal: { count: 0, value: 0, weightedValue: 0 },
    negotiation: { count: 0, value: 0, weightedValue: 0 },
    won: { count: 0, value: 0, weightedValue: 0 },
    lost: { count: 0, value: 0, weightedValue: 0 },
  };

  let totalPipelineValue = 0;
  let weightedPipelineValue = 0;

  let wonCount = 0;
  let lostCount = 0;

  let activeValueSum = 0;
  let activeValueCount = 0;

  let monthToDateRevenue = 0;
  const monthStart = startOfMonth();

  for (const deal of deals ?? []) {
    const stage: DealStage = deal.stage ?? "lead";
    const value = num(deal.value);
    const weight = STAGE_WEIGHTS[stage];
    const weighted = value * weight;

    stageBreakdown[stage].count += 1;
    stageBreakdown[stage].value += value;
    stageBreakdown[stage].weightedValue += weighted;

    if (stage !== "lost" && stage !== "won") {
      totalPipelineValue += value;
      weightedPipelineValue += weighted;

      if (value > 0) {
        activeValueSum += value;
        activeValueCount += 1;
      }
    }

    if (stage === "won") {
      wonCount += 1;

      const dealDate =
        toDate(deal.updatedAt) ?? toDate(deal.createdAt);

      if (dealDate && dealDate >= monthStart) {
        monthToDateRevenue += value;
      }
    }

    if (stage === "lost") {
      lostCount += 1;
    }
  }

  const denom = wonCount + lostCount;
  const winRate = denom > 0 ? wonCount / denom : 0;

  const avgDealValue =
    activeValueCount > 0 ? activeValueSum / activeValueCount : 0;

  return {
    totalPipelineValue,
    weightedPipelineValue,
    monthToDateRevenue,
    winRate,
    avgDealValue,
    stageBreakdown,
  };
}