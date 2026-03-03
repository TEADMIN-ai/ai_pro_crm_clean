import {
  projectTenderImprovement,
  type TenderCategoryScores,
} from "@/lib/intelligence/tenderImprovementEngine";

export type TenderRiskRadarInput = {
  categoryScores: TenderCategoryScores;
  missingDocuments: number;
  daysUntilDeadline: number;
};

export type TenderRiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type TenderRiskRadarResult = {
  riskLevel: TenderRiskLevel;
  riskScore: number;
  riskReasons: string[];
};

function clampTo100(value: number): number {
  if (value < 0) return 0;
  if (value > 100) return 100;
  return value;
}

export function tenderRiskRadar({
  categoryScores,
  missingDocuments,
  daysUntilDeadline,
}: TenderRiskRadarInput): TenderRiskRadarResult {
  let riskScore = 0;
  const riskReasons: string[] = [];

  const projection = projectTenderImprovement(categoryScores);
  const weakestScore = categoryScores[projection.weakestCategory]?.score ?? 0;

  if (missingDocuments > 0) {
    riskScore += 25;
    riskReasons.push(`${missingDocuments} required document(s) are still missing`);
  }

  if (weakestScore < 65) {
    riskScore += 20;
    riskReasons.push(`Weakest category score is below target (${Math.round(weakestScore)}%)`);
  }

  if (projection.improvementDelta > 8) {
    riskScore += 15;
    riskReasons.push(`Projected uplift exceeds 8% (${projection.improvementDelta}%)`);
  }

  if (daysUntilDeadline <= 3) {
    riskScore += 20;
    riskReasons.push(`Deadline is close (${daysUntilDeadline} day(s) remaining)`);
  }

  if (daysUntilDeadline <= 1) {
    riskScore += 10;
    riskReasons.push("Critical deadline window: 24 hours or less");
  }

  const clampedScore = clampTo100(riskScore);

  let riskLevel: TenderRiskLevel = "LOW";
  if (clampedScore >= 81) {
    riskLevel = "CRITICAL";
  } else if (clampedScore >= 61) {
    riskLevel = "HIGH";
  } else if (clampedScore >= 31) {
    riskLevel = "MEDIUM";
  }

  return {
    riskLevel,
    riskScore: clampedScore,
    riskReasons,
  };
}
