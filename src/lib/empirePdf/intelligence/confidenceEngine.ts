import type { PdfValidationIssue } from "./types";

export type ConfidenceEngine = {
  score(params: {
    fieldConfidenceScores: number[];
    validationIssues: PdfValidationIssue[];
  }): number;
};

export class WeightedConfidenceEngine implements ConfidenceEngine {
  score(params: { fieldConfidenceScores: number[]; validationIssues: PdfValidationIssue[] }): number {
    const base =
      params.fieldConfidenceScores.length > 0
        ? params.fieldConfidenceScores.reduce((sum, score) => sum + score, 0) / params.fieldConfidenceScores.length
        : 0;
    const penalty = params.validationIssues.reduce((sum, issue) => sum + issue.confidenceImpact, 0);

    return Math.max(0, Math.min(1, Number((base - penalty).toFixed(4))));
  }
}
