import { appendWorkflowAudit } from "@/lib/manus/logging/workflowAudit";
import { manusLogger } from "@/lib/manus/logging/manusLogger";

import type { EngineDebugField, IntelligentFillAuditOptions, TenderFormId } from "./templates";

type PageLike = {
  getSize(): {
    width: number;
    height: number;
  };
};

export function validateRenderedField(params: {
  debugField: EngineDebugField;
  page: PageLike | null;
  seenFieldKeys: Set<string>;
}): string[] {
  const { debugField, page, seenFieldKeys } = params;
  const warnings: string[] = [];
  const width = debugField.width ?? 0;
  const height = debugField.height ?? 0;
  const renderedBounds = debugField.renderedBounds ?? {
    x: debugField.x,
    y: debugField.y,
    width,
    height: Math.max(height, debugField.fontSize),
  };

  if (seenFieldKeys.has(debugField.fieldKey)) {
    warnings.push(`Duplicate field rendering detected for ${debugField.fieldKey}`);
  } else {
    seenFieldKeys.add(debugField.fieldKey);
  }

  if (!Number.isFinite(debugField.x) || !Number.isFinite(debugField.y)) {
    warnings.push(`Invalid coordinates detected for ${debugField.fieldKey}`);
  }

  if (!Number.isFinite(width) || !Number.isFinite(height)) {
    warnings.push(`Invalid dimensions detected for ${debugField.fieldKey}`);
  }

  if (width < 0 || height < 0) {
    warnings.push(`Negative dimensions detected for ${debugField.fieldKey}`);
  }

  if (page) {
    const { width: pageWidth, height: pageHeight } = page.getSize();
    const maxX = renderedBounds.x + Math.max(renderedBounds.width, 0);
    const maxY = renderedBounds.y + Math.max(renderedBounds.height, 0);

    if (renderedBounds.x < 0 || renderedBounds.y < 0 || maxX > pageWidth || maxY > pageHeight) {
      warnings.push(`Rendered content escaped page bounds for ${debugField.fieldKey}`);
    }
  }

  if (debugField.boundingBox && debugField.rendered) {
    const tolerance = 0.25;
    const box = debugField.boundingBox;
    const maxX = renderedBounds.x + Math.max(renderedBounds.width, 0);
    const maxY = renderedBounds.y + Math.max(renderedBounds.height, 0);
    const boxMaxX = box.x + box.width;
    const boxMaxY = box.y + box.height;

    if (
      renderedBounds.x < box.x - tolerance ||
      renderedBounds.y < box.y - tolerance ||
      maxX > boxMaxX + tolerance ||
      maxY > boxMaxY + tolerance
    ) {
      warnings.push(`Rendered dimensions exceeded calibrated bounding box for ${debugField.fieldKey}`);
    }
  }

  if (debugField.overflowDetected) {
    warnings.push(`Overflow detected for ${debugField.fieldKey}`);
  }

  return warnings;
}

export function buildCalibrationQaReport(params: {
  formId: TenderFormId;
  templateVersion?: string | null;
  debugFields: EngineDebugField[];
}) {
  const renderedFields = params.debugFields.filter((field) => field.rendered);
  const calibratedFields = params.debugFields.filter((field) => field.boundingBox);
  const validationIssueCount = params.debugFields.reduce(
    (sum, field) => sum + (field.validationWarnings?.length ?? 0),
    0
  );
  const overflowEvents = params.debugFields.filter((field) => field.overflowDetected).length;
  const clippingEvents = params.debugFields.filter((field) => field.clippingRisk).length;
  const outOfBoundsEvents = params.debugFields.filter((field) =>
    (field.validationWarnings ?? []).some(
      (warning) =>
        warning.includes("escaped page bounds") ||
        warning.includes("exceeded calibrated bounding box") ||
        warning.includes("Negative") ||
        warning.includes("Invalid")
    )
  ).length;
  const checkboxAlignmentIssues = params.debugFields.filter(
    (field) =>
      field.rendered &&
      field.resolutionStrategy.includes("checkbox") &&
      (field.validationWarnings ?? []).some((warning) => warning.includes("bounding box"))
  ).length;
  const missingFields = params.debugFields.filter((field) => !field.rendered && field.criticality !== "optional").length;
  const checkedFieldCount = Math.max(renderedFields.length, 1);
  const placementAccuracy = Math.max(
    0,
    Math.round(((checkedFieldCount - outOfBoundsEvents) / checkedFieldCount) * 100)
  );
  const averageConfidence =
    params.debugFields.length > 0
      ? params.debugFields.reduce((sum, field) => sum + field.confidence, 0) / params.debugFields.length
      : 0;
  const calibrationPenalty = validationIssueCount * 2 + overflowEvents * 3 + missingFields * 4 + clippingEvents * 2;
  const calibrationConfidence = Math.max(0, Math.min(100, Math.round(averageConfidence * 100 - calibrationPenalty)));

  return {
    document: params.formId,
    templateVersion: params.templateVersion ?? null,
    placementAccuracy,
    overflowEvents,
    checkboxAlignmentIssues,
    missingFields,
    calibrationConfidence,
    validationIssueCount,
    outOfBoundsEvents,
    clippingEvents,
    renderedFieldCount: renderedFields.length,
    calibratedFieldCount: calibratedFields.length,
  };
}

export async function auditRenderedFieldWarnings(params: {
  templateKey: string;
  formId: string;
  debugField: EngineDebugField;
  warnings: string[];
  audit?: IntelligentFillAuditOptions;
}) {
  const { templateKey, formId, debugField, warnings, audit } = params;
  if (warnings.length === 0) {
    return;
  }

  const workflowContext = audit?.workflowContext;
  if (workflowContext) {
    manusLogger.warn("empirepdf_render_validation", workflowContext, {
      templateKey,
      formId,
      fieldKey: debugField.fieldKey,
      warnings,
      resolutionStrategy: debugField.resolutionStrategy,
    });

    await appendWorkflowAudit(workflowContext, {
      type: "empirepdf_render_validation",
      detail: {
        templateKey,
        formId,
        fieldKey: debugField.fieldKey,
        warnings,
        resolutionStrategy: debugField.resolutionStrategy,
      },
    });
  }

  console.warn("[EMPIREPDF_RENDER_VALIDATION]", {
    templateKey,
    formId,
    fieldKey: debugField.fieldKey,
    warnings,
    resolutionStrategy: debugField.resolutionStrategy,
  });
}
