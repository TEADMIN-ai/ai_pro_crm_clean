import { WeightedConfidenceEngine, type ConfidenceEngine } from "./confidenceEngine";
import type { PdfLayoutPlan, PdfValidationIssue, PdfValidationReport } from "./types";

export type PdfValidationEngine = {
  validate(plans: PdfLayoutPlan[]): PdfValidationReport;
};

export class MetadataValidationEngine implements PdfValidationEngine {
  constructor(private readonly confidenceEngine: ConfidenceEngine = new WeightedConfidenceEngine()) {}

  validate(plans: PdfLayoutPlan[]): PdfValidationReport {
    const issues: PdfValidationIssue[] = [];

    for (const plan of plans) {
      const { field, value, resolvedRectangle } = plan;

      if (!value?.value && field.criticality !== "optional") {
        issues.push({
          code: "missing_mandatory_value",
          severity: field.criticality === "critical" ? "error" : "warning",
          fieldName: field.fieldName,
          message: `Missing mandatory value for ${field.fieldName}`,
          confidenceImpact: field.criticality === "critical" ? 0.1 : 0.04,
        });
      }

      if (
        !Number.isFinite(resolvedRectangle.x) ||
        !Number.isFinite(resolvedRectangle.y) ||
        resolvedRectangle.width < 0 ||
        resolvedRectangle.height < 0
      ) {
        issues.push({
          code: "field_clipping",
          severity: "error",
          fieldName: field.fieldName,
          message: `Invalid field rectangle for ${field.fieldName}`,
          confidenceImpact: 0.12,
        });
      }

      if (field.confidenceScore < 0.7 || plan.confidenceScore < 0.7) {
        issues.push({
          code: "low_confidence",
          severity: "warning",
          fieldName: field.fieldName,
          message: `Low metadata confidence for ${field.fieldName}`,
          confidenceImpact: 0.03,
        });
      }
    }

    return {
      issues,
      confidenceScore: this.confidenceEngine.score({
        fieldConfidenceScores: plans.map((plan) => plan.confidenceScore),
        validationIssues: issues,
      }),
      checkedAt: new Date().toISOString(),
    };
  }
}
