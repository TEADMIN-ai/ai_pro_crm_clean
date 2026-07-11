import { WeightedConfidenceEngine } from "./confidenceEngine";
import type { PdfDifferenceIssue, PdfDifferenceReport, PdfDifferenceReportRequest } from "./types";

export function createDifferenceReport(params: {
  request: PdfDifferenceReportRequest;
  issues?: PdfDifferenceIssue[];
  generatedAt?: string;
}): PdfDifferenceReport {
  const issues = params.issues ?? [];
  const confidenceEngine = new WeightedConfidenceEngine();

  return {
    request: params.request,
    issues,
    confidenceScore: confidenceEngine.score({
      fieldConfidenceScores: issues.length === 0 ? [] : issues.map(() => 1),
      validationIssues: issues.map((issue) => ({
        code: issue.code === "missing_value" ? "missing_mandatory_value" : "alignment_warning",
        severity: issue.severity,
        fieldName: issue.fieldName,
        message: issue.message,
        confidenceImpact: issue.confidenceImpact,
      })),
    }),
    generatedAt: params.generatedAt ?? new Date().toISOString(),
    imageComparisonPerformed: false,
  };
}
