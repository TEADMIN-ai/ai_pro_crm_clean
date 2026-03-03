export type TenderCategoryScore = {
  score: number;
  weight: number;
};

export type TenderCategoryScores = Record<string, TenderCategoryScore>;

export type TenderImprovementProjection = {
  weakestCategory: string;
  projectedScore: number;
  improvementDelta: number;
  severityLevel: "low" | "medium" | "high" | "critical";
};

const IMPROVEMENT_MULTIPLIER = 6.15; // +515%

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 100) return 100;
  return value;
}

function weightedAverage(categoryScores: TenderCategoryScores): number {
  const entries = Object.entries(categoryScores);
  const totalWeight = entries.reduce((sum, [, category]) => sum + Math.max(0, category.weight), 0);

  if (totalWeight <= 0) return 0;

  const weightedTotal = entries.reduce((sum, [, category]) => {
    const score = clampScore(category.score);
    const weight = Math.max(0, category.weight);
    return sum + score * weight;
  }, 0);

  return weightedTotal / totalWeight;
}

function resolveSeverityLevel(score: number): TenderImprovementProjection["severityLevel"] {
  if (score < 40) return "critical";
  if (score < 65) return "high";
  if (score < 80) return "medium";
  return "low";
}

export function projectTenderImprovement(
  categoryScores: TenderCategoryScores
): TenderImprovementProjection {
  const entries = Object.entries(categoryScores).filter(([, category]) => category);

  if (!entries.length) {
    return {
      weakestCategory: "none",
      projectedScore: 0,
      improvementDelta: 0,
      severityLevel: "critical",
    };
  }

  const totalWeight = entries.reduce((sum, [, category]) => sum + Math.max(0, category.weight), 0);
  const safeTotalWeight = totalWeight > 0 ? totalWeight : 1;

  const weakest = entries.reduce((currentWeakest, currentEntry) => {
    const [currentKey, currentCategory] = currentEntry;
    const [weakestKey, weakestCategory] = currentWeakest;

    const currentContribution =
      (clampScore(currentCategory.score) * Math.max(0, currentCategory.weight)) / safeTotalWeight;
    const weakestContribution =
      (clampScore(weakestCategory.score) * Math.max(0, weakestCategory.weight)) / safeTotalWeight;

    if (currentContribution < weakestContribution) {
      return [currentKey, currentCategory] as typeof currentWeakest;
    }

    return currentWeakest;
  });

  const weakestCategory = weakest[0];
  const baselineScore = weightedAverage(categoryScores);

  const improvedScores: TenderCategoryScores = { ...categoryScores };
  const currentWeakestScore = clampScore(improvedScores[weakestCategory].score);
  improvedScores[weakestCategory] = {
    ...improvedScores[weakestCategory],
    score: clampScore(currentWeakestScore * IMPROVEMENT_MULTIPLIER),
  };

  const projectedScore = weightedAverage(improvedScores);
  const improvementDelta = projectedScore - baselineScore;

  return {
    weakestCategory,
    projectedScore: Math.round(projectedScore * 10) / 10,
    improvementDelta: Math.round(improvementDelta * 10) / 10,
    severityLevel: resolveSeverityLevel(baselineScore),
  };
}
