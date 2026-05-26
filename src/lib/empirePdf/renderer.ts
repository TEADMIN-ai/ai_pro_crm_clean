import { StandardFonts, rgb, type PDFDocument, type PDFPage } from "pdf-lib";

import { getBoundingBoxField } from "./boundingBoxes";
import {
  fitTextToBoundingBox,
  fitTextToBox,
  alignX,
  resolveCheckboxInBoundingBox,
  resolvePlacementBox,
} from "./layout";
import { resolveSemanticField } from "./semanticRegistry";
import type {
  EngineDebugField,
  EmpirePdfTemplateDefinition,
  FieldResolutionStrategy,
  IntelligentAnchorMatch,
  SemanticProfile,
  TemplateFieldDefinition,
} from "./templates";

function resolvePage(pdfDocument: PDFDocument, pageIndex: number): PDFPage | null {
  return pdfDocument.getPages()[pageIndex] ?? null;
}

function drawBoundingBoxDebug(
  page: PDFPage,
  font: Awaited<ReturnType<PDFDocument["embedFont"]>>,
  params: {
    fieldId: string;
    xMin: number;
    xMax: number;
    yMin: number;
    yMax: number;
    confidence: number;
    anchor: IntelligentAnchorMatch | null;
  }
) {
  page.drawRectangle({
    x: params.xMin,
    y: params.yMin,
    width: params.xMax - params.xMin,
    height: params.yMax - params.yMin,
    borderColor: rgb(1, 0, 0),
    borderWidth: 0.6,
  });

  page.drawText(`[BOUNDING_BOX] ${params.fieldId} ${params.confidence.toFixed(2)}`, {
    x: params.xMin,
    y: params.yMax + 2,
    size: 5.5,
    font,
    color: rgb(0.9, 0, 0),
  });

  if (params.anchor) {
    page.drawRectangle({
      x: params.anchor.x,
      y: params.anchor.y,
      width: params.anchor.width,
      height: params.anchor.height,
      borderColor: rgb(0, 0.35, 1),
      borderWidth: 0.5,
    });
  }
}

export async function renderTemplateField(params: {
  pdfDocument: PDFDocument;
  template: EmpirePdfTemplateDefinition;
  profile: SemanticProfile;
  field: TemplateFieldDefinition;
  anchor: IntelligentAnchorMatch | null;
  debug: boolean;
}): Promise<EngineDebugField | null> {
  const { pdfDocument, profile, field, anchor, debug } = params;
  const renderStartedAt = Date.now();
  const page = resolvePage(pdfDocument, field.pageIndex);
  if (!page) {
    return null;
  }

  const font = await pdfDocument.embedFont(StandardFonts.Helvetica);
  const resolved = resolveSemanticField({
    formId: params.template.formId,
    fieldId: field.fieldId,
    anchorText: anchor?.sourceText || field.anchorText,
    profile,
  });
  const value = resolved.value;
  const boundedField = getBoundingBoxField(params.template.formId, field.fieldId);
  const canUseBoundingBox = Boolean(boundedField) && resolved.confidence >= 0.7;

  function buildDebugField(
    strategy: FieldResolutionStrategy,
    overrides: Partial<EngineDebugField> = {}
  ): EngineDebugField {
    return {
      fieldId: field.fieldId,
      pageIndex: field.pageIndex,
      fieldKey: `${params.template.formId}.${field.fieldId}`,
      value,
      rendered: false,
      renderSuccess: false,
      usedFallback: true,
      fallbackUsed: true,
      anchorFound: Boolean(anchor),
      matchedAnchor: anchor,
      anchorUsed: Boolean(anchor),
      anchorText: field.anchorText,
      aliasMatched: resolved.aliasMatched,
      semanticAliasUsed: resolved.semanticAliasUsed,
      source: resolved.source,
      sourceField: resolved.sourceField,
      confidence: resolved.confidence,
      resolutionStrategy: strategy,
      criticality: field.criticality ?? "important",
      missingDependencies: resolved.missingDependencies,
      overflowDetected: false,
      clippingRisk: false,
      multilineOverflowDetected: false,
      renderDurationMs: Date.now() - renderStartedAt,
      x: 0,
      y: 0,
      fontSize: field.maxFontSize ?? 10,
      ...overrides,
    };
  }

  if (field.fieldType === "checkbox") {
    if (boundedField && canUseBoundingBox) {
      const checkbox = resolveCheckboxInBoundingBox(boundedField);

      if (!value || !checkbox) {
        if (debug) {
          drawBoundingBoxDebug(page, font, {
            fieldId: field.fieldId,
            xMin: boundedField.xMin,
            xMax: boundedField.xMax,
            yMin: boundedField.yMin,
            yMax: boundedField.yMax,
            confidence: resolved.confidence,
            anchor,
          });
        }

        return buildDebugField("checkbox_bounding_box", {
          usedFallback: false,
          fallbackUsed: false,
          anchorUsed: Boolean(anchor),
          confidence: resolved.confidence,
          x: boundedField.xMin,
          y: boundedField.yMin,
        });
      }

      const horizontalInset = Math.max(checkbox.width * 0.18, 1.4);
      const verticalInset = Math.max(checkbox.height * 0.18, 1.4);

      page.drawLine({
        start: {
          x: checkbox.centerX - checkbox.width / 2 + horizontalInset,
          y: checkbox.centerY - checkbox.height / 2 + verticalInset,
        },
        end: {
          x: checkbox.centerX + checkbox.width / 2 - horizontalInset,
          y: checkbox.centerY + checkbox.height / 2 - verticalInset,
        },
        thickness: checkbox.strokeWidth,
        color: rgb(0, 0, 0),
      });
      page.drawLine({
        start: {
          x: checkbox.centerX - checkbox.width / 2 + horizontalInset,
          y: checkbox.centerY + checkbox.height / 2 - verticalInset,
        },
        end: {
          x: checkbox.centerX + checkbox.width / 2 - horizontalInset,
          y: checkbox.centerY - checkbox.height / 2 + verticalInset,
        },
        thickness: checkbox.strokeWidth,
        color: rgb(0, 0, 0),
      });

      if (debug) {
        drawBoundingBoxDebug(page, font, {
          fieldId: field.fieldId,
          xMin: boundedField.xMin,
          xMax: boundedField.xMax,
          yMin: boundedField.yMin,
          yMax: boundedField.yMax,
          confidence: resolved.confidence,
          anchor,
        });
      }

      return buildDebugField("checkbox_bounding_box", {
        value: "X",
        rendered: true,
        renderSuccess: true,
        usedFallback: false,
        fallbackUsed: false,
        anchorUsed: Boolean(anchor),
        confidence: resolved.confidence,
        x: checkbox.centerX,
        y: checkbox.centerY,
        fontSize: boundedField.maxFontSize,
      });
    }

    const box = resolvePlacementBox(field, anchor);
    const confidence = Math.min(box.confidence, resolved.confidence);

    if (!value) {
      return buildDebugField(box.usedFallback ? "checkbox_fallback" : "checkbox_anchor", {
        usedFallback: box.usedFallback,
        fallbackUsed: box.usedFallback,
        anchorUsed: !box.usedFallback,
        confidence,
        x: box.x,
        y: box.y,
      });
    }

    const mark = field.checkboxGlyph ?? "X";
    page.drawText(mark, {
      x: box.x,
      y: box.y,
      size: field.maxFontSize ?? 10,
      font,
      color: rgb(0, 0, 0),
    });

    return buildDebugField(box.usedFallback ? "checkbox_fallback" : "checkbox_anchor", {
      value: mark,
      rendered: true,
      renderSuccess: true,
      usedFallback: box.usedFallback,
      fallbackUsed: box.usedFallback,
      anchorUsed: !box.usedFallback,
      confidence,
      x: box.x,
      y: box.y,
      fontSize: field.maxFontSize ?? 10,
    });
  }

  if (!value) {
    return buildDebugField("not_rendered_missing_value");
  }

  if (boundedField && canUseBoundingBox) {
    const fitted = fitTextToBoundingBox(font, value, boundedField);

    if (fitted) {
      const firstLine = fitted.text.split("\n")[0] ?? "";
      const textX = alignX(
        boundedField.alignment,
        fitted.x,
        fitted.width,
        font.widthOfTextAtSize(firstLine, fitted.fontSize)
      );

      page.drawText(fitted.text, {
        x: textX,
        y: fitted.y,
        size: fitted.fontSize,
        lineHeight: fitted.lineHeight,
        maxWidth: fitted.width,
        font,
        color: rgb(0, 0, 0),
      });

      if (debug) {
        drawBoundingBoxDebug(page, font, {
          fieldId: field.fieldId,
          xMin: boundedField.xMin,
          xMax: boundedField.xMax,
          yMin: boundedField.yMin,
          yMax: boundedField.yMax,
          confidence: resolved.confidence,
          anchor,
        });
      }

      return buildDebugField("bounding_box_anchor", {
        rendered: true,
        renderSuccess: true,
        usedFallback: false,
        fallbackUsed: false,
        anchorUsed: Boolean(anchor),
        confidence: resolved.confidence,
        overflowDetected: fitted.overflowDetected,
        clippingRisk: fitted.clippingRisk,
        multilineOverflowDetected: fitted.multilineOverflowDetected,
        x: textX,
        y: fitted.y,
        fontSize: fitted.fontSize,
      });
    }
  }

  const fitted = fitTextToBox(font, value, field, anchor);
  const firstLine = fitted.text.split("\n")[0] ?? "";
  const textX = alignX(field.alignment, fitted.x, fitted.width, font.widthOfTextAtSize(firstLine, fitted.fontSize));

  page.drawText(fitted.text, {
    x: textX,
    y: fitted.y,
    size: fitted.fontSize,
    lineHeight: fitted.lineHeight,
    maxWidth: fitted.width,
    font,
    color: rgb(0, 0, 0),
  });

  if (debug) {
    page.drawRectangle({
      x: fitted.x,
      y: fitted.y - 2,
      width: fitted.width,
      height: fitted.height,
      borderColor: rgb(1, 0, 0),
      borderWidth: 0.5,
    });
  }

  return buildDebugField(fitted.usedFallback ? "placement_fallback" : "placement_anchor", {
    rendered: true,
    renderSuccess: true,
    usedFallback: fitted.usedFallback,
    fallbackUsed: fitted.usedFallback,
    anchorUsed: !fitted.usedFallback,
    confidence: Math.min(fitted.confidence, resolved.confidence),
    overflowDetected: fitted.overflowDetected,
    clippingRisk: fitted.clippingRisk,
    multilineOverflowDetected: fitted.multilineOverflowDetected,
    x: textX,
    y: fitted.y,
    fontSize: fitted.fontSize,
  });
}
