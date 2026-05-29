import { StandardFonts, rgb, type PDFDocument, type PDFPage } from "pdf-lib";

import { getBoundingBoxField } from "./boundingBoxes";
import {
  alignX,
  fitTextToBoundingBox,
  fitTextToBox,
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
    label: string;
    xMin: number;
    xMax: number;
    yMin: number;
    yMax: number;
    anchor: IntelligentAnchorMatch | null;
    overflowDetected?: boolean;
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

  page.drawText(`${params.label} ${params.fieldId}`, {
    x: params.xMin,
    y: params.yMax + 4,
    size: 5.5,
    font,
    color: rgb(0.9, 0, 0),
  });

  if (params.overflowDetected) {
    page.drawText("overflow", {
      x: params.xMin,
      y: params.yMin - 8,
      size: 5,
      font,
      color: rgb(0.85, 0.33, 0.1),
    });
  }

  if (params.anchor) {
    page.drawRectangle({
      x: params.anchor.x,
      y: params.anchor.y,
      width: params.anchor.width,
      height: params.anchor.height,
      borderColor: rgb(0, 0.35, 1),
      borderWidth: 0.5,
    });

    page.drawText(
      `anchor ${params.anchor.x.toFixed(1)},${params.anchor.y.toFixed(1)} p${params.anchor.pageIndex + 1}`,
      {
        x: params.anchor.x,
        y: params.anchor.y + params.anchor.height + 3,
        size: 4.8,
        font,
        color: rgb(0, 0.2, 0.85),
      }
    );
  }
}

function resolveCheckboxStyle(field: TemplateFieldDefinition, glyph: string | undefined) {
  if (field.checkboxStyle) {
    return field.checkboxStyle;
  }

  if (glyph === "âœ“" || glyph === "✓") {
    return "tick";
  }

  return "x";
}

function drawCheckboxMark(
  page: PDFPage,
  params: {
    centerX: number;
    centerY: number;
    width: number;
    height: number;
    strokeWidth: number;
    style: "tick" | "x" | "filled_square";
  }
) {
  const size = Math.min(params.width, params.height);

  if (params.style === "filled_square") {
    const side = size * 0.62;
    page.drawRectangle({
      x: params.centerX - side / 2,
      y: params.centerY - side / 2,
      width: side,
      height: side,
      color: rgb(0, 0, 0),
    });
    return;
  }

  if (params.style === "tick") {
    page.drawLine({
      start: { x: params.centerX - size * 0.28, y: params.centerY - size * 0.02 },
      end: { x: params.centerX - size * 0.08, y: params.centerY - size * 0.24 },
      thickness: params.strokeWidth,
      color: rgb(0, 0, 0),
    });
    page.drawLine({
      start: { x: params.centerX - size * 0.08, y: params.centerY - size * 0.24 },
      end: { x: params.centerX + size * 0.30, y: params.centerY + size * 0.24 },
      thickness: params.strokeWidth,
      color: rgb(0, 0, 0),
    });
    return;
  }

  page.drawLine({
    start: { x: params.centerX - size * 0.28, y: params.centerY - size * 0.28 },
    end: { x: params.centerX + size * 0.28, y: params.centerY + size * 0.28 },
    thickness: params.strokeWidth,
    color: rgb(0, 0, 0),
  });
  page.drawLine({
    start: { x: params.centerX - size * 0.28, y: params.centerY + size * 0.28 },
    end: { x: params.centerX + size * 0.28, y: params.centerY - size * 0.28 },
    thickness: params.strokeWidth,
    color: rgb(0, 0, 0),
  });
}

function drawFittedLines(
  page: PDFPage,
  font: Awaited<ReturnType<PDFDocument["embedFont"]>>,
  params: {
    lines: string[];
    fontSize: number;
    lineHeight: number;
    contentX: number;
    contentY: number;
    contentWidth: number;
    alignment: TemplateFieldDefinition["alignment"];
  }
) {
  params.lines.forEach((line, index) => {
    const textX = alignX(
      params.alignment,
      params.contentX,
      params.contentWidth,
      font.widthOfTextAtSize(line, params.fontSize)
    );

    page.drawText(line, {
      x: textX,
      y: params.contentY - index * params.lineHeight,
      size: params.fontSize,
      font,
      color: rgb(0, 0, 0),
    });
  });
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
      validationWarnings: [],
      renderDurationMs: Date.now() - renderStartedAt,
      x: 0,
      y: 0,
      width: field.fallback.width,
      height: field.fallback.height ?? field.textBounds.height ?? 14,
      fontSize: field.maxFontSize ?? 11,
      lineHeight: field.lineHeight,
      templateVersion: params.template.templateVersion,
      fieldVersion: field.fieldVersion,
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
            label: `[BOX p${boundedField?.pageNumber ?? field.pageIndex + 1}]`,
            xMin: boundedField?.xMin ?? field.fallback.x,
            xMax: boundedField?.xMax ?? field.fallback.x + field.fallback.width,
            yMin: boundedField?.yMin ?? field.fallback.y,
            yMax: boundedField?.yMax ?? field.fallback.y + (field.fallback.height ?? 10),
            anchor,
          });
        }

        return buildDebugField("checkbox_bounding_box", {
          usedFallback: false,
          fallbackUsed: false,
          anchorUsed: Boolean(anchor),
          confidence: resolved.confidence,
          x: boundedField?.x ?? field.fallback.x,
          y: boundedField?.y ?? field.fallback.y,
          width: boundedField?.width ?? field.fallback.width,
          height: boundedField?.height ?? (field.fallback.height ?? 10),
        });
      }

      drawCheckboxMark(page, checkbox);

      if (debug) {
        drawBoundingBoxDebug(page, font, {
          fieldId: field.fieldId,
          label: `[BOX p${boundedField.pageNumber}]`,
          xMin: boundedField.xMin,
          xMax: boundedField.xMax,
          yMin: boundedField.yMin,
          yMax: boundedField.yMax,
          anchor,
        });
      }

      return buildDebugField("checkbox_bounding_box", {
        value: checkbox.style,
        rendered: true,
        renderSuccess: true,
        usedFallback: false,
        fallbackUsed: false,
        anchorUsed: Boolean(anchor),
        confidence: resolved.confidence,
        x: checkbox.x,
        y: checkbox.y,
        width: checkbox.width,
        height: checkbox.height,
        fontSize: boundedField.maxFontSize,
        lineHeight: boundedField.lineHeight,
        fieldVersion: boundedField.fieldVersion,
        templateVersion: boundedField.templateVersion,
      });
    }

    const box = resolvePlacementBox(field, anchor);
    const checkboxStyle = resolveCheckboxStyle(field, field.checkboxGlyph);
    const checkboxWidth = Math.max(box.width, 10);
    const checkboxHeight = Math.max(box.height, 10);
    const checkbox = {
      centerX: box.x + checkboxWidth / 2,
      centerY: box.y + checkboxHeight / 2,
      width: checkboxWidth,
      height: checkboxHeight,
      strokeWidth: Math.max(Math.min(checkboxWidth, checkboxHeight) * 0.12, 0.9),
      style: checkboxStyle,
    } as const;
    const confidence = Math.min(box.confidence, resolved.confidence);

    if (!value) {
      return buildDebugField(box.usedFallback ? "checkbox_fallback" : "checkbox_anchor", {
        usedFallback: box.usedFallback,
        fallbackUsed: box.usedFallback,
        anchorUsed: !box.usedFallback,
        confidence,
        x: box.x,
        y: box.y,
        width: checkboxWidth,
        height: checkboxHeight,
      });
    }

    drawCheckboxMark(page, checkbox);

    if (debug) {
      drawBoundingBoxDebug(page, font, {
        fieldId: field.fieldId,
        label: `[PLACE p${field.pageIndex + 1}]`,
        xMin: box.x,
        xMax: box.x + checkboxWidth,
        yMin: box.y,
        yMax: box.y + checkboxHeight,
        anchor,
      });
    }

    return buildDebugField(box.usedFallback ? "checkbox_fallback" : "checkbox_anchor", {
      value: checkboxStyle,
      rendered: true,
      renderSuccess: true,
      usedFallback: box.usedFallback,
      fallbackUsed: box.usedFallback,
      anchorUsed: !box.usedFallback,
      confidence,
      x: box.x,
      y: box.y,
      width: checkboxWidth,
      height: checkboxHeight,
      fontSize: field.maxFontSize ?? 10,
      lineHeight: field.lineHeight,
    });
  }

  if (!value) {
    return buildDebugField("not_rendered_missing_value");
  }

  if (boundedField && canUseBoundingBox) {
    const fitted = fitTextToBoundingBox(font, value, boundedField);

    if (fitted) {
      drawFittedLines(page, font, {
        lines: fitted.lines,
        fontSize: fitted.fontSize,
        lineHeight: fitted.lineHeight,
        contentX: fitted.contentX,
        contentY: fitted.contentY,
        contentWidth: fitted.contentWidth,
        alignment: boundedField.alignment,
      });

      if (debug) {
        drawBoundingBoxDebug(page, font, {
          fieldId: field.fieldId,
          label: `[BOX ${boundedField.templateVersion} p${boundedField.pageNumber}]`,
          xMin: boundedField.xMin,
          xMax: boundedField.xMax,
          yMin: boundedField.yMin,
          yMax: boundedField.yMax,
          anchor,
          overflowDetected: fitted.overflowDetected,
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
        x: fitted.contentX,
        y: fitted.contentY,
        width: fitted.contentWidth,
        height: fitted.contentHeight,
        fontSize: fitted.fontSize,
        lineHeight: fitted.lineHeight,
        fieldVersion: boundedField.fieldVersion,
        templateVersion: boundedField.templateVersion,
      });
    }
  }

  const fitted = fitTextToBox(font, value, field, anchor);

  drawFittedLines(page, font, {
    lines: fitted.lines,
    fontSize: fitted.fontSize,
    lineHeight: fitted.lineHeight,
    contentX: fitted.contentX,
    contentY: fitted.contentY,
    contentWidth: fitted.contentWidth,
    alignment: field.alignment,
  });

  if (debug) {
    drawBoundingBoxDebug(page, font, {
      fieldId: field.fieldId,
      label: `[PLACE p${field.pageIndex + 1}]`,
      xMin: fitted.x,
      xMax: fitted.x + fitted.width,
      yMin: fitted.y,
      yMax: fitted.y + fitted.height,
      anchor,
      overflowDetected: fitted.overflowDetected,
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
    x: fitted.contentX,
    y: fitted.contentY,
    width: fitted.contentWidth,
    height: fitted.contentHeight,
    fontSize: fitted.fontSize,
    lineHeight: fitted.lineHeight,
  });
}
