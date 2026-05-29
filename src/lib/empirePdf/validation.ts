import { appendWorkflowAudit } from "@/lib/manus/logging/workflowAudit";
import { manusLogger } from "@/lib/manus/logging/manusLogger";

import type { EngineDebugField, IntelligentFillAuditOptions } from "./templates";

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
    const maxX = debugField.x + Math.max(width, 0);
    const maxY = debugField.y + Math.max(height, debugField.fontSize);

    if (debugField.x < 0 || debugField.y < 0 || maxX > pageWidth || maxY > pageHeight) {
      warnings.push(`Rendered content escaped page bounds for ${debugField.fieldKey}`);
    }
  }

  if (debugField.overflowDetected) {
    warnings.push(`Overflow detected for ${debugField.fieldKey}`);
  }

  return warnings;
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
