import type { DocumentAnalysis, TenderEvaluation } from "@/types/tenderAudit";

export function evaluateTenderReadiness(
  analysis?: DocumentAnalysis
): TenderEvaluation {
  let score = 100;

  const riskFlags: string[] = [];
  const missingRequirements: string[] = [];
  const recommendations: string[] = [];

  if (!analysis) {
    return {
      readinessScore: 0,
      complianceStatus: "FAIL",
      riskFlags: ["No document analysis available"],
      missingRequirements: ["All compliance documents"],
      recommendations: ["Upload required tender documents"],
    };
  }

  if (!analysis.registrationNumber) {
    score -= 20;
    missingRequirements.push("Company Registration Number");
    recommendations.push("Upload CIPC registration document");
  }

  if (analysis.expired) {
    score -= 40;
    riskFlags.push("Document expired");
    recommendations.push("Upload updated compliance document");
  }

  if ((analysis.confidence ?? 0) < 60) {
    score -= 15;
    riskFlags.push("Low AI extraction confidence");
    recommendations.push("Verify document quality or upload clearer scan");
  }

  if (analysis.duplicate) {
    score -= 10;
    riskFlags.push("Possible duplicate submission detected");
  }

  let complianceStatus: TenderEvaluation["complianceStatus"] = "PASS";

  if (score < 60) {
    complianceStatus = "FAIL";
  } else if (score < 80) {
    complianceStatus = "WARNING";
  }

  return {
    readinessScore: Math.max(score, 0),
    complianceStatus,
    riskFlags,
    missingRequirements,
    recommendations,
  };
}
