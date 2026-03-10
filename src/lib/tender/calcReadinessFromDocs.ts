import type { DocumentAnalysis } from "@/types/tenderAudit";

export type ReadinessCalc = {
  readinessScore: number;
  docsMissing: number;
  reasons: string[];
};

export function calcReadinessFromDocs(
  analyses: DocumentAnalysis[] = []
): ReadinessCalc {
  let score = 100;
  const reasons: string[] = [];

  const hasRegistration = analyses.some((a) => !!a.registrationNumber);
  const expiredDoc = analyses.some((a) => a.expired === true);
  const lowConfidence = analyses.some((a) => (a.confidence ?? 0) < 60);

  if (!hasRegistration) {
    score -= 20;
    reasons.push("Company registration number not detected");
  }

  if (expiredDoc) {
    score -= 40;
    reasons.push("Expired compliance document detected");
  }

  if (lowConfidence) {
    score -= 15;
    reasons.push("Low document extraction confidence");
  }

  const docsMissing = hasRegistration ? 0 : 1;

  return {
    readinessScore: Math.max(score, 0),
    docsMissing,
    reasons,
  };
}
