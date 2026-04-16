type RequirementEntry = {
  uploaded?: boolean;
  valid?: boolean;
};

function generateFixSuggestions(results: Array<{ type: string; present: boolean; valid: boolean }>) {
  const suggestions: string[] = [];

  results.forEach((r) => {
    if (!r.present) {
      suggestions.push(`Upload ${r.type.toUpperCase()} document`);
    } else if (!r.valid) {
      suggestions.push(`Re-upload valid ${r.type.toUpperCase()} document`);
    }
  });

  return suggestions;
}

export function matchRequirements(contractor: any, tender: any) {
  const docs = contractor.documents || {};
  const required = ["cipc", "tax", "bbbee", "coida"];

  const results = required.map((doc) => {
    const entry = docs[doc] as RequirementEntry | undefined;

    return {
      type: doc,
      present: entry?.uploaded === true,
      valid: entry?.valid === true,
    };
  });

  const validCount = results.filter((r) => r.present && r.valid).length;
  const score = Math.round((validCount / required.length) * 100);
  const missing = results
    .filter((r) => !r.present || !r.valid)
    .map((r) => r.type);
  const riskLevel =
    score >= 80
      ? "LOW"
      : score >= 50
      ? "MEDIUM"
      : "HIGH";

  let recommendation = "Ready for submission";

  if (riskLevel === "HIGH") {
    recommendation = "Critical documents missing. Upload required documents immediately.";
  } else if (riskLevel === "MEDIUM") {
    recommendation = "Some requirements missing. Improve compliance before submission.";
  }

  const fixSuggestions = generateFixSuggestions(results);

  return {
    score,
    results,
    missing,
    ready: score >= 80,
    riskLevel,
    recommendation,
    fixSuggestions,
    tenderId: tender?.id ?? null,
  };
}
