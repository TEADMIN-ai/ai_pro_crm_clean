type AttributionSnapshot = {
  probability: number;
  riskScore: number;
  missingDocuments: number;
  overallScore: number;
  daysUntilDeadline?: number;
};

type ImpactAttributionInput = {
  previousSnapshot: AttributionSnapshot;
  currentSnapshot: AttributionSnapshot;
};

type ImpactAttributionResult = {
  deltaProbability: number;
  explanationLines: string[];
};

export function calculateImpactAttribution({
  previousSnapshot,
  currentSnapshot,
}: ImpactAttributionInput): ImpactAttributionResult {
  const deltaProbability = Math.round((currentSnapshot.probability - previousSnapshot.probability) * 10) / 10;
  const explanationLines: string[] = [];

  if (deltaProbability > 0) {
    if (currentSnapshot.overallScore > previousSnapshot.overallScore) {
      explanationLines.push("Overall tender score improved.");
    }
    if (currentSnapshot.riskScore < previousSnapshot.riskScore) {
      explanationLines.push("Risk level decreased.");
    }
    if (currentSnapshot.missingDocuments < previousSnapshot.missingDocuments) {
      explanationLines.push("Missing documents reduced.");
    }
    if ((currentSnapshot.daysUntilDeadline ?? 999) > 3) {
      explanationLines.push("Deadline pressure stabilized.");
    }
  } else if (deltaProbability < 0) {
    if (currentSnapshot.riskScore > previousSnapshot.riskScore) {
      explanationLines.push("Risk level increased.");
    }
    if ((currentSnapshot.daysUntilDeadline ?? 999) <= 3) {
      explanationLines.push("Deadline approaching.");
    }
    if (currentSnapshot.missingDocuments > previousSnapshot.missingDocuments) {
      explanationLines.push("New missing documents detected.");
    }
    if (currentSnapshot.overallScore < previousSnapshot.overallScore) {
      explanationLines.push("Category performance declined.");
    }
  } else {
    explanationLines.push("No significant scoring or risk changes detected.");
  }

  if (explanationLines.length === 0) {
    explanationLines.push("No significant scoring or risk changes detected.");
  }

  return {
    deltaProbability,
    explanationLines,
  };
}
