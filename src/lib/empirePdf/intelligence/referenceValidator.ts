import type { PdfReferenceDocumentSet, PdfReferenceMetadata, PdfValidationIssue, PdfValidationReport } from "./types";
import { buildValidationReport } from "./validationReport";

export function validateReferenceDocumentSet(
  documentSet: PdfReferenceDocumentSet,
  metadata?: PdfReferenceMetadata,
  requestedVersion?: string | null
): PdfValidationReport {
  const issues: PdfValidationIssue[] = [];

  if (!documentSet.blankPdf) {
    issues.push({
      code: "missing_mandatory_value",
      severity: "warning",
      message: `Blank PDF reference is not registered for ${documentSet.documentName}`,
      confidenceImpact: 0.08,
    });
  }

  if (!documentSet.approvedPdf) {
    issues.push({
      code: "missing_mandatory_value",
      severity: "warning",
      message: `Approved PDF reference is not registered for ${documentSet.documentName}`,
      confidenceImpact: 0.12,
    });
  }

  if (!metadata) {
    issues.push({ code: "reference_metadata_missing", severity: "warning", message: "Reference metadata is not registered for " + documentSet.documentName, confidenceImpact: 0.06 });
  } else {
    if (requestedVersion) {
      if (!metadata.matchedVersion) {
        issues.push({ code: "reference_version_mismatch", severity: "warning", message: "Requested " + documentSet.documentName + " " + requestedVersion + " but matched reference version " + metadata.version, confidenceImpact: 0.05 });
      }
    }
    if (metadata.fieldMapCount === 0) {
      issues.push({ code: "field_map_missing", severity: "warning", message: "No approved field map registry is loaded for " + documentSet.documentName + " " + metadata.version, confidenceImpact: 0.04 });
    }
  }

  return buildValidationReport({
    documentName: documentSet.documentName,
    documentVersion: documentSet.version,
    referenceMetadata: metadata,
    issues,
    confidenceScore: Math.max(0, 1 - issues.reduce((sum, issue) => sum + issue.confidenceImpact, 0)),
  });
}
