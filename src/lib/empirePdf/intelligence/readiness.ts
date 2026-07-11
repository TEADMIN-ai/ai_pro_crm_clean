import type { PdfDocumentReadiness, PdfValidationIssue, PdfValidationReport } from "./types";

export type ReadinessThresholds = {
  internalUse: number;
  clientReview: number;
  submission: number;
};

export const DEFAULT_READINESS_THRESHOLDS: ReadinessThresholds = {
  internalUse: 0.72,
  clientReview: 0.84,
  submission: 0.94,
};

function hasErrors(issues: PdfValidationIssue[]): boolean {
  return issues.some((issue) => issue.severity === "error");
}

export function classifyDocumentReadiness(
  report: Pick<PdfValidationReport, "issues" | "confidenceScore">,
  thresholds: ReadinessThresholds = DEFAULT_READINESS_THRESHOLDS
): PdfDocumentReadiness {
  if (hasErrors(report.issues) || report.confidenceScore < thresholds.internalUse) {
    return "NOT_READY";
  }

  if (report.issues.length > 0) {
    return "REVIEW_REQUIRED";
  }

  if (report.confidenceScore >= thresholds.submission) {
    return "READY_FOR_SUBMISSION";
  }

  if (report.confidenceScore >= thresholds.clientReview) {
    return "READY_FOR_CLIENT_REVIEW";
  }

  return "READY_FOR_INTERNAL_USE";
}
