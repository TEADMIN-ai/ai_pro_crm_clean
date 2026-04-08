type ContractorDocs = Partial<Record<"tax" | "bbbee" | "cipc" | "coida", boolean>>;

export function calculateReadiness(contractorDocs: ContractorDocs) {
  const requiredDocs = ["tax", "bbbee", "cipc", "coida"] as const;

  const missingDocs = requiredDocs.filter((doc) => !contractorDocs?.[doc]);
  const score = ((requiredDocs.length - missingDocs.length) / requiredDocs.length) * 100;

  let riskLevel: "LOW" | "MEDIUM" | "HIGH" = "LOW";

  if (score < 60) {
    riskLevel = "HIGH";
  } else if (score < 80) {
    riskLevel = "MEDIUM";
  }

  return {
    readinessScore: Math.round(score),
    missingDocs,
    riskLevel,
  };
}
