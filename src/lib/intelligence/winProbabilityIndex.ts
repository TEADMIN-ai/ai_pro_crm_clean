type WinProbabilityInput = {
  overallScore: number;
  riskScore: number;
  improvementDelta: number;
  daysUntilDeadline: number;
  missingDocuments: number;
};

type WinClassification =
  | "Low Chance"
  | "Competitive"
  | "Strong Position"
  | "Highly Favorable";

export type WinProbabilityResult = {
  probability: number;
  classification: WinClassification;
  insight: string;
};

function clampToRange(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function classificationFor(probability: number): WinClassification {
  if (probability <= 40) return "Low Chance";
  if (probability <= 65) return "Competitive";
  if (probability <= 80) return "Strong Position";
  return "Highly Favorable";
}

function buildInsight({
  classification,
  missingDocuments,
  daysUntilDeadline,
  riskScore,
  improvementDelta,
}: {
  classification: WinClassification;
  missingDocuments: number;
  daysUntilDeadline: number;
  riskScore: number;
  improvementDelta: number;
}): string {
  const drivers: string[] = [];

  if (missingDocuments > 0) {
    drivers.push(`missing documents are reducing certainty`);
  } else {
    drivers.push(`document readiness is stable`);
  }

  if (daysUntilDeadline <= 1) {
    drivers.push(`deadline pressure is critical`);
  } else if (daysUntilDeadline <= 3) {
    drivers.push(`deadline pressure is elevated`);
  } else {
    drivers.push(`timeline pressure is manageable`);
  }

  if (riskScore >= 61) {
    drivers.push(`risk exposure remains high`);
  } else {
    drivers.push(`risk exposure is contained`);
  }

  if (improvementDelta > 8) {
    drivers.push(`targeted improvements can lift competitiveness quickly`);
  }

  return `${classification}: ${drivers.join(", ")}.`;
}

export function calculateWinProbabilityIndex({
  overallScore,
  riskScore,
  improvementDelta,
  daysUntilDeadline,
  missingDocuments,
}: WinProbabilityInput): WinProbabilityResult {
  let probability = overallScore * 0.6;

  probability -= riskScore * 0.3;
  probability += improvementDelta * 0.4;

  if (missingDocuments > 0) {
    probability -= 10;
  }
  if (daysUntilDeadline <= 3) {
    probability -= 5;
  }
  if (daysUntilDeadline <= 1) {
    probability -= 10;
  }

  const clamped = Math.round(clampToRange(probability, 0, 100) * 10) / 10;
  const classification = classificationFor(clamped);

  return {
    probability: clamped,
    classification,
    insight: buildInsight({
      classification,
      missingDocuments,
      daysUntilDeadline,
      riskScore,
      improvementDelta,
    }),
  };
}
