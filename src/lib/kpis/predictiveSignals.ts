import type { Deal } from "@/types/deal";

/* ----------------------------- Types ----------------------------- */

export type PredictiveDealSignal = {
  dealId: string;
  title: string;
  stage: string;
  value: number;
  daysSinceActivity: number | null;
  risk: "low" | "medium" | "high";
};

export type PredictiveSummary = {
  totalPipelineValue: number;
  atRiskValue: number;
  winRateSignal: "strong" | "neutral" | "weak";
};

export type PredictiveRevenueSignals = {
  summary: PredictiveSummary;
  items: PredictiveDealSignal[];
};

/* --------------------------- Helpers ----------------------------- */

function daysBetween(a: Date, b: Date) {
  const ms = Math.abs(a.getTime() - b.getTime());
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

/* ---------------------------- Core ------------------------------- */

export function computePredictiveRevenueSignals(
  deals: Deal[]
): PredictiveRevenueSignals {
  const now = new Date();

  let totalPipelineValue = 0;
  let atRiskValue = 0;
  let won = 0;
  let closed = 0;

  const items: PredictiveDealSignal[] = deals.map((deal) => {
    const value = deal.value ?? 0;
    totalPipelineValue += value;

    const stage = deal.stage ?? "lead";

    if (stage === "won") won++;
    if (stage === "won" || stage === "lost") closed++;

    // ✅ SAFE updatedAt handling
    const updated =
      deal.updatedAt ? new Date(deal.updatedAt as any) : null;

    const daysSinceActivity =
      updated && !isNaN(updated.getTime())
        ? daysBetween(now, updated)
        : null;

    let risk: "low" | "medium" | "high" = "low";

    if (daysSinceActivity !== null) {
      if (daysSinceActivity > 30) risk = "high";
      else if (daysSinceActivity > 14) risk = "medium";
    }

    if (risk === "high") {
      atRiskValue += value;
    }

    return {
      dealId: deal.id,
      title: deal.title,
      stage,
      value,
      daysSinceActivity,
      risk,
    };
  });

  const winRate =
    closed === 0 ? 0 : won / closed;

  const winRateSignal: PredictiveSummary["winRateSignal"] =
    winRate > 0.6 ? "strong" : winRate > 0.35 ? "neutral" : "weak";

  return {
    summary: {
      totalPipelineValue,
      atRiskValue,
      winRateSignal,
    },
    items,
  };
}

