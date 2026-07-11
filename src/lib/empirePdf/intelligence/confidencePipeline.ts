import { WeightedConfidenceEngine, type ConfidenceEngine } from "./confidenceEngine";
import { classifyDocumentReadiness } from "./readiness";
import type { PdfDifferenceIssue, PdfValidationIssue } from "./types";

export type ConfidencePipelineInput = {
  fieldConfidenceScores: number[];
  validationIssues: PdfValidationIssue[];
  differenceIssues?: PdfDifferenceIssue[];
};

export function scoreDocumentConfidence(
  input: ConfidencePipelineInput,
  confidenceEngine: ConfidenceEngine = new WeightedConfidenceEngine()
) {
  const differenceValidationIssues: PdfValidationIssue[] = (input.differenceIssues ?? []).map((issue) => ({
    code: issue.code === "missing_value" ? "missing_mandatory_value" : "alignment_warning",
    severity: issue.severity,
    fieldName: issue.fieldName,
    message: issue.message,
    confidenceImpact: issue.confidenceImpact,
  }));
  const issues = [...input.validationIssues, ...differenceValidationIssues];
  const confidenceScore = confidenceEngine.score({
    fieldConfidenceScores: input.fieldConfidenceScores,
    validationIssues: issues,
  });

  return {
    confidenceScore,
    readiness: classifyDocumentReadiness({
      issues,
      confidenceScore,
    }),
  };
}
