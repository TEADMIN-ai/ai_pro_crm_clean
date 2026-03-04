import type { Deal } from "@/types/deal";

type TrajectoryDirection = "up" | "down" | "flat";

type PortfolioIntelligence = {
  avgWinProbability: number;
  avgRiskScore: number;
  highRiskCount: number;
  criticalRiskCount: number;
  improvingCount: number;
  decliningCount: number;
  stableCount: number;
  readinessRatio: number;
  executiveSummary: string;
};

type DealIntelligenceSnapshot = {
  winProbability?: unknown;
  riskScore?: unknown;
  missingDocuments?: unknown;
  trajectory?: {
    direction?: unknown;
  };
};

function toSafeNumber(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  return parsed;
}

function roundToTwo(value: number): number {
  return Math.round(value * 100) / 100;
}

function getDirection(value: unknown): TrajectoryDirection {
  if (value === "up" || value === "down" || value === "flat") {
    return value;
  }
  return "flat";
}

function buildExecutiveSummary(params: {
  dealCount: number;
  avgWinProbability: number;
  highRiskCount: number;
  criticalRiskCount: number;
}): string {
  const { dealCount, avgWinProbability, highRiskCount, criticalRiskCount } = params;

  if (dealCount === 0) {
    return "Portfolio operating in a neutral controlled state.";
  }

  const highRiskLowThreshold = Math.max(1, Math.floor(dealCount * 0.25));
  const criticalRiskHighThreshold = Math.max(1, Math.ceil(dealCount * 0.2));

  const highRiskIsLow = highRiskCount <= highRiskLowThreshold;
  const criticalRiskIsHigh = criticalRiskCount >= criticalRiskHighThreshold;

  if (avgWinProbability > 65 && highRiskIsLow) {
    return "Portfolio trending strong with controlled risk exposure.";
  }

  if (criticalRiskIsHigh) {
    return "Elevated portfolio risk requires immediate intervention.";
  }

  return "Portfolio operating in a neutral controlled state.";
}

export function calculatePortfolioIntelligence(deals: Deal[]): PortfolioIntelligence {
  if (!Array.isArray(deals) || deals.length === 0) {
    return {
      avgWinProbability: 0,
      avgRiskScore: 0,
      highRiskCount: 0,
      criticalRiskCount: 0,
      improvingCount: 0,
      decliningCount: 0,
      stableCount: 0,
      readinessRatio: 0,
      executiveSummary: "Portfolio operating in a neutral controlled state.",
    };
  }

  let winProbabilityTotal = 0;
  let riskScoreTotal = 0;
  let highRiskCount = 0;
  let criticalRiskCount = 0;
  let improvingCount = 0;
  let decliningCount = 0;
  let stableCount = 0;
  let readyCount = 0;

  for (const deal of deals) {
    const snapshot = deal as Deal & DealIntelligenceSnapshot;
    const winProbability = toSafeNumber(snapshot.winProbability);
    const riskScore = toSafeNumber(snapshot.riskScore);
    const missingDocuments = toSafeNumber(snapshot.missingDocuments);
    const direction = getDirection(snapshot.trajectory?.direction);

    winProbabilityTotal += winProbability;
    riskScoreTotal += riskScore;

    if (riskScore > 60) {
      highRiskCount += 1;
    }

    if (riskScore > 80) {
      criticalRiskCount += 1;
    }

    if (direction === "up") {
      improvingCount += 1;
    } else if (direction === "down") {
      decliningCount += 1;
    } else {
      stableCount += 1;
    }

    if (missingDocuments === 0 && riskScore < 60) {
      readyCount += 1;
    }
  }

  const dealCount = deals.length;
  const avgWinProbability = roundToTwo(winProbabilityTotal / dealCount);
  const avgRiskScore = roundToTwo(riskScoreTotal / dealCount);
  const readinessRatio = roundToTwo((readyCount / dealCount) * 100);
  const executiveSummary = buildExecutiveSummary({
    dealCount,
    avgWinProbability,
    highRiskCount,
    criticalRiskCount,
  });

  return {
    avgWinProbability,
    avgRiskScore,
    highRiskCount,
    criticalRiskCount,
    improvingCount,
    decliningCount,
    stableCount,
    readinessRatio,
    executiveSummary,
  };
}
