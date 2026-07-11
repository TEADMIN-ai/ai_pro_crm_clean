import { PDFDocument, StandardFonts } from "pdf-lib";

import { createAnchorResolver } from "./anchorDetection";
import { renderTemplateField } from "./renderer";
import { resolveSemanticField } from "./semanticRegistry";
import { buildSemanticProfile } from "./semanticContext";
import { EMPIRE_PDF_TEMPLATE_REGISTRY } from "./templates";
import { getBoundingBoxField } from "./boundingBoxes";
import { getPdfBinaryType, normalizePdfBinary } from "./utils/normalizePdfBinary";
import { auditRenderedFieldWarnings, buildCalibrationQaReport, validateRenderedField } from "./validation";
import { buildRendererIntelligenceReport } from "./intelligence/renderIntelligence";
import type { CompanyProfile } from "@/lib/autofill/buildCompanyProfile";
import type {
  EngineDebugField,
  EmpirePdfTemplateDefinition,
  IntelligentAnchorMatch,
  IntelligentFillAuditOptions,
  IntelligentFillResult,
  SemanticProfile,
  TemplateFieldDefinition,
} from "./templates";
import type { SbdFormKey } from "@/lib/pdfs/templates/sbdSchema";

const HIGH_CONFIDENCE_SIGNATURE_ANCHOR_THRESHOLD = 0.9;

function hasExplicitSignatureSection(
  template: EmpirePdfTemplateDefinition,
  field: TemplateFieldDefinition
): boolean {
  return (
    template.metadata?.signatureSections?.some(
      (section) =>
        section.pageIndex === field.pageIndex &&
        (!section.fieldIds || section.fieldIds.includes(field.fieldId))
    ) === true
  );
}

function hasHighConfidenceSignatureAnchor(anchor: IntelligentAnchorMatch | null): boolean {
  if (!anchor || anchor.confidence < HIGH_CONFIDENCE_SIGNATURE_ANCHOR_THRESHOLD) {
    return false;
  }

  const normalizedAnchor = anchor.sourceText
    .normalize("NFKD")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();

  return (
    normalizedAnchor.includes("SIGNATURE") ||
    normalizedAnchor.includes("AUTHORISED SIGNATORY") ||
    normalizedAnchor.includes("AUTHORIZED SIGNATORY")
  );
}

function shouldSuppressSbd1SignatureName(params: {
  template: EmpirePdfTemplateDefinition;
  field: TemplateFieldDefinition;
  anchor: IntelligentAnchorMatch | null;
}): boolean {
  const { template, field, anchor } = params;
  if (template.formId !== "SBD1" || field.fieldId !== "signature_name") {
    return false;
  }

  return (
    !getBoundingBoxField(template.formId, field.fieldId) &&
    !hasHighConfidenceSignatureAnchor(anchor) &&
    !hasExplicitSignatureSection(template, field)
  );
}

function buildSuppressedDebugField(params: {
  template: EmpirePdfTemplateDefinition;
  field: TemplateFieldDefinition;
  anchor: IntelligentAnchorMatch | null;
  profile: SemanticProfile;
  renderStartedAt: number;
}): EngineDebugField {
  const { template, field, anchor, profile, renderStartedAt } = params;
  const resolved = resolveSemanticField({
    formId: template.formId,
    fieldId: field.fieldId,
    anchorText: anchor?.sourceText || field.anchorText,
    profile,
  });

  return {
    fieldId: field.fieldId,
    pageIndex: field.pageIndex,
    fieldKey: `${template.formId}.${field.fieldId}`,
    value: resolved.value,
    rendered: false,
    renderSuccess: true,
    usedFallback: false,
    fallbackUsed: false,
    anchorFound: Boolean(anchor),
    matchedAnchor: anchor,
    anchorUsed: false,
    anchorText: field.anchorText,
    aliasMatched: resolved.aliasMatched,
    semanticAliasUsed: resolved.semanticAliasUsed,
    source: resolved.source,
    sourceField: resolved.sourceField,
    confidence: resolved.confidence,
    resolutionStrategy: "not_rendered_suppressed",
    criticality: field.criticality ?? "important",
    missingDependencies: resolved.missingDependencies,
    overflowDetected: false,
    clippingRisk: false,
    multilineOverflowDetected: false,
    validationWarnings: [],
    renderDurationMs: Date.now() - renderStartedAt,
    x: field.fallback.x,
    y: field.fallback.y,
    width: field.fallback.width,
    height: field.fallback.height ?? field.textBounds.height ?? 14,
    fontSize: field.maxFontSize ?? 11,
    lineHeight: field.lineHeight,
    templateVersion: template.templateVersion,
    fieldVersion: field.fieldVersion,
  };
}

export async function fillTemplateWithIntelligence(params: {
  templateKey: SbdFormKey;
  templateBytes: Buffer | Uint8Array | ArrayBuffer;
  profile: CompanyProfile;
  debug?: boolean;
  debugBoundingBoxes?: boolean;
  suppressSbd1SignatureName?: boolean;
  audit?: IntelligentFillAuditOptions;
}): Promise<{ pdfBytes: Uint8Array; result: IntelligentFillResult }> {
  const template = EMPIRE_PDF_TEMPLATE_REGISTRY[params.templateKey];
  if (!template) {
    throw new Error(`No intelligent template registered for '${params.templateKey}'`);
  }

  const originalType = getPdfBinaryType(params.templateBytes);
  const normalizedTemplateBytes = normalizePdfBinary(params.templateBytes);

  console.info("[EMPIREPDF_INTELLIGENT_FILL]", {
    stage: "binary_normalization_applied",
    templateKey: params.templateKey,
    byteLength: normalizedTemplateBytes.byteLength,
    originalType,
    normalizedType: getPdfBinaryType(normalizedTemplateBytes),
  });

  const pdfDocument = await PDFDocument.load(normalizedTemplateBytes);
  await pdfDocument.embedFont(StandardFonts.Helvetica);
  const semanticProfile = buildSemanticProfile(params.profile);
  const warnings: string[] = [];
  const debugFields: EngineDebugField[] = [];
  const reviewFlags: IntelligentFillResult["reviewFlags"] = [];
  const seenFieldKeys = new Set<string>();
  const debugBoundingBoxes =
    process.env.NODE_ENV !== "production" &&
    (params.debugBoundingBoxes === true ||
      params.debug === true ||
      process.env.EMPIREPDF_DEBUG_CALIBRATION === "true");
  let anchorResolver: Awaited<ReturnType<typeof createAnchorResolver>> | null = null;

  try {
    anchorResolver = await createAnchorResolver(normalizedTemplateBytes);
  } catch (error) {
    const message = `Anchor index build failed for ${template.formId}: ${
      error instanceof Error ? error.message : "unknown error"
    }`;
    warnings.push(message);
    console.warn("[EMPIREPDF_INTELLIGENT_FILL]", {
      stage: "anchor_resolver_init_failed",
      templateKey: params.templateKey,
      formId: template.formId,
      warning: message,
    });
    throw new Error(message);
  }

  for (const field of template.fields) {
    const renderStartedAt = Date.now();
    let anchor = null;

    try {
      anchor = anchorResolver?.detect(field.anchorText, field.pageIndex) ?? null;
    } catch (error) {
      warnings.push(
        `Anchor detection failed for ${template.formId}.${field.fieldId}: ${
          error instanceof Error ? error.message : "unknown error"
        }`
      );
    }

    const semanticResolution = resolveSemanticField({
      formId: template.formId,
      fieldId: field.fieldId,
      anchorText: anchor?.sourceText || field.anchorText,
      profile: semanticProfile,
    });

    reviewFlags.push(...semanticResolution.reviewFlags);

    console.info(
      `[SEMANTIC_FIELD] field=${field.fieldId} alias=${semanticResolution.aliasMatched} source=${semanticResolution.source} confidence=${semanticResolution.confidence.toFixed(
        2
      )} fallback=${!anchor}`
    );

    if (semanticResolution.confidence < 0.7) {
      const warning = `Low confidence semantic resolution for ${template.formId}.${field.fieldId} (${semanticResolution.confidence})`;
      warnings.push(warning);
      console.warn("[SEMANTIC_FIELD_LOW_CONFIDENCE]", {
        formId: template.formId,
        fieldId: field.fieldId,
        source: semanticResolution.source,
        aliasMatched: semanticResolution.aliasMatched,
        confidence: semanticResolution.confidence,
        reviewFlags: semanticResolution.reviewFlags,
      });
    }

    const debugField = params.suppressSbd1SignatureName !== false && shouldSuppressSbd1SignatureName({ template, field, anchor })
      ? buildSuppressedDebugField({
          template,
          field,
          anchor,
          profile: semanticProfile,
          renderStartedAt,
        })
      : await renderTemplateField({
          pdfDocument,
          template,
          profile: semanticProfile,
          field,
          anchor,
          debug: debugBoundingBoxes,
        });

    if (debugField) {
      if (debugField.fallbackUsed) {
        warnings.push(`Anchor fallback used for ${template.formId}.${field.fieldId}`);
      }

      const pages =
        typeof (pdfDocument as { getPages?: unknown }).getPages === "function"
          ? (pdfDocument as { getPages: () => Array<{ getSize: () => { width: number; height: number } }> }).getPages()
          : [];
      const validationWarnings = validateRenderedField({
        debugField,
        page: pages[debugField.pageIndex] ?? null,
        seenFieldKeys,
      });
      debugField.validationWarnings = validationWarnings;
      if (validationWarnings.length > 0) {
        warnings.push(...validationWarnings);
        await auditRenderedFieldWarnings({
          templateKey: params.templateKey,
          formId: template.formId,
          debugField,
          warnings: validationWarnings,
          audit: params.audit,
        });
      }

      console.info("[EMPIREPDF_INTELLIGENT_FILL]", {
        stage: "field_resolution_completed",
        templateKey: params.templateKey,
        formId: template.formId,
        fieldKey: debugField.fieldKey,
        confidence: debugField.confidence,
        anchorUsed: debugField.anchorUsed,
        semanticAliasUsed: debugField.semanticAliasUsed,
        fallbackUsed: debugField.fallbackUsed,
        renderDurationMs: debugField.renderDurationMs,
        matchedAnchor: debugField.matchedAnchor?.sourceText ?? null,
        sourceField: debugField.sourceField,
        criticality: debugField.criticality,
        missingDependencies: debugField.missingDependencies,
        overflowDetected: debugField.overflowDetected,
        multilineOverflowDetected: debugField.multilineOverflowDetected,
        clippingRisk: debugField.clippingRisk,
        resolutionStrategy: debugField.resolutionStrategy,
        renderSuccess: debugField.renderSuccess,
        validationWarnings: debugField.validationWarnings,
        templateVersion: debugField.templateVersion ?? template.templateVersion ?? null,
        fieldVersion: debugField.fieldVersion ?? null,
      });
      debugFields.push(debugField);
    }
  }

  const averageConfidence =
    debugFields.length > 0
      ? debugFields.reduce((sum, field) => sum + field.confidence, 0) / debugFields.length
      : 0;
  const renderedFieldCount = debugFields.filter((field) => field.rendered).length;
  const qaReport = buildCalibrationQaReport({
    formId: template.formId,
    templateVersion: template.templateVersion ?? null,
    debugFields,
  });
  const intelligence = buildRendererIntelligenceReport({
    templateKey: params.templateKey,
    debugFields,
    qaReport,
  });

  return {
    pdfBytes: await pdfDocument.save(),
    result: {
      debugFields,
      warnings,
      reviewFlags,
      averageConfidence,
      renderedFieldCount,
      intelligence,
      qaReport,
    },
  };
}
