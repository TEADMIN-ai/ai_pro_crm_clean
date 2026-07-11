import { classifyDocumentReadiness } from "./readiness";
import type {
  PdfValidationIssue,
  PdfValidationIssueCode,
  PdfValidationReport,
  PdfValidationReportSummary,
} from "./types";

function byCode(issues: PdfValidationIssue[], codes: PdfValidationIssueCode[]): PdfValidationIssue[] {
  const codeSet = new Set(codes);
  return issues.filter((issue) => codeSet.has(issue.code));
}

export function buildValidationReport(params: {
  documentName?: string;
  documentVersion?: string;
  issues: PdfValidationIssue[];
  confidenceScore: number;
  referenceMetadata?: PdfValidationReport['referenceMetadata'];
  checkedAt?: string;
}): PdfValidationReport {
  const warnings = params.issues.filter((issue) => issue.severity === "warning");
  const errors = params.issues.filter((issue) => issue.severity === "error");
  const report = {
    documentName: params.documentName,
    documentVersion: params.documentVersion,
    issues: params.issues,
    warnings,
    errors,
    confidenceScore: params.confidenceScore,
    referenceMetadata: params.referenceMetadata,
    checkedAt: params.checkedAt ?? new Date().toISOString(),
  };

  return {
    ...report,
    readiness: classifyDocumentReadiness(report),
  };
}

export function summarizeValidationReport(report: PdfValidationReport): PdfValidationReportSummary {
  return {
    missingFields: byCode(report.issues, ["missing_mandatory_value"]),
    overflow: byCode(report.issues, ["text_overflow"]),
    alignmentWarnings: byCode(report.issues, ["alignment_warning", "text_outside_boundaries", "checkbox_alignment"]),
    fontScaling: byCode(report.issues, ["font_scaling"]),
    checkboxMismatch: byCode(report.issues, ["checkbox_mismatch"]),
    signaturePlacement: byCode(report.issues, ["signature_placement", "signature_overlap"]),
    pageOverflow: byCode(report.issues, ["page_overflow"]),
    unknownFields: byCode(report.issues, ["unknown_field"]),
    warnings: report.warnings ?? report.issues.filter((issue) => issue.severity === "warning"),
    errors: report.errors ?? report.issues.filter((issue) => issue.severity === "error"),
    overallConfidence: report.confidenceScore,
    readiness: report.readiness ?? classifyDocumentReadiness(report),
  };
}
