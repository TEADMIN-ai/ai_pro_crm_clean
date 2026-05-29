import type { PDFFont } from "pdf-lib";

import type {
  BoundingBoxCheckboxLayout,
  BoundingBoxFieldDefinition,
  BoundingBoxTextLayout,
  OverflowBehavior,
} from "./boundingBoxes";
import type { FieldAlignment, IntelligentAnchorMatch, TemplateFieldDefinition, TextPadding } from "./templates";

type PlacementBox = {
  x: number;
  y: number;
  width: number;
  height: number;
  usedFallback: boolean;
  confidence: number;
};

type ConstraintBox = {
  x: number;
  width: number;
  height: number;
  paddingX: number;
  paddingY: number;
  alignment: FieldAlignment;
  maxFontSize: number;
  minFontSize: number;
  lineHeight: number;
  maxLines: number;
  multiline: boolean;
  overflowBehavior: OverflowBehavior;
  baselineMode: "fixed" | "top";
  baseY: number;
};

export type FittedTextLayout = PlacementBox & {
  text: string;
  lines: string[];
  fontSize: number;
  lineHeight: number;
  overflowDetected: boolean;
  clippingRisk: boolean;
  multilineOverflowDetected: boolean;
  contentX: number;
  contentY: number;
  contentWidth: number;
  contentHeight: number;
};

export type BoundingTextFitResult = BoundingBoxTextLayout & {
  lineCount: number;
  overflowDetected: boolean;
  clippingRisk: boolean;
  multilineOverflowDetected: boolean;
};

function lineWidth(font: PDFFont, text: string, size: number): number {
  return font.widthOfTextAtSize(text, size);
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normalizePadding(padding: number | TextPadding | undefined): TextPadding {
  if (typeof padding === "number") {
    return { x: padding, y: padding };
  }

  return padding ?? { x: 0, y: 0 };
}

function truncateLineToWidth(font: PDFFont, text: string, size: number, width: number): string {
  const normalized = normalizeWhitespace(text);
  if (!normalized) {
    return "";
  }

  if (lineWidth(font, normalized, size) <= width) {
    return normalized;
  }

  const ellipsis = "...";
  let clipped = normalized;

  while (clipped.length > 0 && lineWidth(font, `${clipped}${ellipsis}`, size) > width) {
    clipped = clipped.slice(0, -1).trimEnd();
  }

  return clipped ? `${clipped}${ellipsis}` : ellipsis;
}

function wrapTextOnSpaces(font: PDFFont, text: string, size: number, width: number): string[] {
  const normalized = normalizeWhitespace(text);
  if (!normalized) {
    return [];
  }

  const words = normalized.split(" ");
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    if (!currentLine) {
      currentLine = word;
      continue;
    }

    const candidate = `${currentLine} ${word}`;
    if (lineWidth(font, candidate, size) <= width) {
      currentLine = candidate;
      continue;
    }

    lines.push(currentLine);
    currentLine = word;
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

function buildCandidateLines(
  font: PDFFont,
  value: string,
  fontSize: number,
  box: ConstraintBox
): string[] {
  if (!box.multiline && box.overflowBehavior !== "wrap") {
    return [normalizeWhitespace(value)];
  }

  return wrapTextOnSpaces(font, value, fontSize, getContentWidth(box));
}

function getContentWidth(box: ConstraintBox): number {
  return Math.max(box.width - box.paddingX * 2, 0);
}

function getContentHeight(box: ConstraintBox): number {
  return Math.max(box.height - box.paddingY * 2, 0);
}

function computeLineHeight(box: ConstraintBox, fontSize: number): number {
  return Math.max(box.lineHeight, Number((fontSize + 0.5).toFixed(2)));
}

function getFontHeightAtSize(font: PDFFont, fontSize: number, options?: { descender?: boolean }): number {
  const fontWithMetrics = font as PDFFont & {
    heightAtSize?: (size: number, options?: { descender?: boolean }) => number;
  };

  if (typeof fontWithMetrics.heightAtSize === "function") {
    return fontWithMetrics.heightAtSize(fontSize, options);
  }

  return fontSize * (options?.descender === false ? 0.718 : 0.925);
}

function resolveBaselineY(
  font: PDFFont,
  lines: string[],
  box: ConstraintBox,
  fontSize: number,
  lineHeight: number
): number {
  if (box.baselineMode === "fixed") {
    return box.baseY;
  }

  const contentBottom = box.baseY + box.paddingY;
  const contentHeight = getContentHeight(box);
  const fontHeight = getFontHeightAtSize(font, fontSize);
  const ascenderHeight = getFontHeightAtSize(font, fontSize, { descender: false });
  const descenderHeight = Math.max(fontHeight - ascenderHeight, 0);
  const blockHeight = Math.max((Math.max(lines.length, 1) - 1) * lineHeight + fontHeight, fontHeight);
  const centeredBlockBottom = contentBottom + Math.max((contentHeight - blockHeight) / 2, 0);

  return Number((centeredBlockBottom + (Math.max(lines.length, 1) - 1) * lineHeight + descenderHeight).toFixed(2));
}

function measureTextFit(font: PDFFont, lines: string[], fontSize: number, box: ConstraintBox) {
  const contentWidth = getContentWidth(box);
  const contentHeight = getContentHeight(box);
  const lineHeight = computeLineHeight(box, fontSize);
  const tooWide = lines.some((line) => lineWidth(font, line, fontSize) > contentWidth);
  const tooTall = lines.length > box.maxLines || lines.length * lineHeight > contentHeight;

  return {
    lineHeight,
    tooWide,
    tooTall,
    contentWidth,
    contentHeight,
  };
}

function finalizeOverflowLines(font: PDFFont, value: string, fontSize: number, box: ConstraintBox) {
  const contentWidth = getContentWidth(box);
  const contentHeight = getContentHeight(box);
  const lineHeight = computeLineHeight(box, fontSize);
  const heightLineLimit = Math.max(Math.floor(contentHeight / Math.max(lineHeight, 1)), 1);
  const maxVisibleLines = Math.max(Math.min(box.maxLines, heightLineLimit), 1);
  const wrappedLines =
    box.multiline || box.overflowBehavior === "wrap"
      ? wrapTextOnSpaces(font, value, fontSize, contentWidth)
      : [normalizeWhitespace(value)];
  const visibleLines = (wrappedLines.length > 0 ? wrappedLines : [normalizeWhitespace(value)]).slice(0, maxVisibleLines);
  const lastIndex = visibleLines.length - 1;

  if (lastIndex >= 0) {
    visibleLines[lastIndex] = truncateLineToWidth(font, visibleLines[lastIndex] ?? "", fontSize, contentWidth);
  }

  const tooWide = visibleLines.some((line) => lineWidth(font, line, fontSize) > contentWidth);
  const multilineOverflowDetected = box.multiline && wrappedLines.length > maxVisibleLines;

  return {
    lines: visibleLines,
    lineHeight,
    overflowDetected: true,
    clippingRisk: true,
    multilineOverflowDetected,
    contentWidth,
    contentHeight,
  };
}

function fitTextWithinConstraintBox(font: PDFFont, value: string, box: ConstraintBox) {
  const normalized = normalizeWhitespace(value);
  if (!normalized) {
    return null;
  }

  let fontSize = box.maxFontSize;

  while (fontSize >= box.minFontSize) {
    const lines = buildCandidateLines(font, normalized, fontSize, box);
    const measured = measureTextFit(font, lines, fontSize, box);

    if (!measured.tooWide && !measured.tooTall) {
      return {
        text: lines.join("\n"),
        lines,
        fontSize,
        lineHeight: measured.lineHeight,
        overflowDetected: false,
        clippingRisk: false,
        multilineOverflowDetected: false,
        contentWidth: measured.contentWidth,
        contentHeight: measured.contentHeight,
        contentY: resolveBaselineY(font, lines, box, fontSize, measured.lineHeight),
      };
    }

    fontSize = Number((fontSize - 0.5).toFixed(2));
  }

  const overflowLayout = finalizeOverflowLines(font, normalized, box.minFontSize, box);

  return {
    text: overflowLayout.lines.join("\n"),
    lines: overflowLayout.lines,
    fontSize: box.minFontSize,
    lineHeight: overflowLayout.lineHeight,
    overflowDetected: overflowLayout.overflowDetected,
    clippingRisk: overflowLayout.clippingRisk,
    multilineOverflowDetected: overflowLayout.multilineOverflowDetected,
    contentWidth: overflowLayout.contentWidth,
    contentHeight: overflowLayout.contentHeight,
    contentY: resolveBaselineY(font, overflowLayout.lines, box, box.minFontSize, overflowLayout.lineHeight),
  };
}

function toFallbackConstraintBox(field: TemplateFieldDefinition, placement: PlacementBox): ConstraintBox {
  const padding = normalizePadding(field.padding);

  return {
    x: placement.x,
    width: Math.max(placement.width, 0),
    height: Math.max(placement.height, 0),
    paddingX: padding.x,
    paddingY: padding.y,
    alignment: field.alignment,
    maxFontSize: field.maxFontSize ?? 11,
    minFontSize: field.minFontSize ?? 6,
    lineHeight: field.lineHeight ?? Math.max((field.maxFontSize ?? 11) + 0.5, 8),
    maxLines: field.maxLines ?? (field.multiline ? Math.max(Math.floor((placement.height - padding.y * 2) / Math.max(field.lineHeight ?? 10, 1)), 1) : 1),
    multiline: field.multiline === true,
    overflowBehavior: field.overflowBehavior ?? (field.multiline ? "wrap" : "scale"),
    baselineMode: "fixed",
    baseY: placement.y,
  };
}

function toBoundingConstraintBox(box: BoundingBoxFieldDefinition): ConstraintBox {
  return {
    x: box.x,
    width: box.width,
    height: box.height,
    paddingX: box.padding,
    paddingY: box.padding,
    alignment: box.alignment,
    maxFontSize: box.maxFontSize,
    minFontSize: box.minFontSize,
    lineHeight: box.lineHeight,
    maxLines: box.maxLines,
    multiline: box.multiline,
    overflowBehavior: box.overflowBehavior,
    baselineMode: "top",
    baseY: box.y,
  };
}

export function resolvePlacementBox(
  field: TemplateFieldDefinition,
  anchor: IntelligentAnchorMatch | null
): PlacementBox {
  if (!anchor) {
    return {
      x: field.fallback.x,
      y: field.fallback.y,
      width: field.fallback.width,
      height: field.fallback.height ?? field.textBounds.height ?? 14,
      usedFallback: true,
      confidence: 0,
    };
  }

  const width = field.textBounds.width;
  const height = field.textBounds.height ?? field.fallback.height ?? 14;
  const offsetX = 8;
  const offsetY = 10;

  if (field.placement === "right") {
    return {
      x: anchor.x + anchor.width + offsetX,
      y: anchor.y,
      width,
      height,
      usedFallback: false,
      confidence: anchor.confidence,
    };
  }

  if (field.placement === "inline") {
    return {
      x: anchor.x + anchor.width + 4,
      y: anchor.y,
      width,
      height,
      usedFallback: false,
      confidence: anchor.confidence,
    };
  }

  if (field.placement === "replace") {
    return {
      x: anchor.x,
      y: anchor.y,
      width,
      height,
      usedFallback: false,
      confidence: anchor.confidence,
    };
  }

  return {
    x: anchor.x,
    y: anchor.y - anchor.height - offsetY,
    width,
    height,
    usedFallback: false,
    confidence: anchor.confidence,
  };
}

export function fitTextToBox(
  font: PDFFont,
  value: string,
  field: TemplateFieldDefinition,
  anchor: IntelligentAnchorMatch | null
): FittedTextLayout {
  const placement = resolvePlacementBox(field, anchor);
  const constraintBox = toFallbackConstraintBox(field, placement);
  const fitted = fitTextWithinConstraintBox(font, value, constraintBox);

  if (!fitted) {
    return {
      ...placement,
      text: "",
      lines: [],
      fontSize: field.minFontSize ?? 6,
      lineHeight: field.lineHeight ?? 8,
      overflowDetected: false,
      clippingRisk: false,
      multilineOverflowDetected: false,
      contentX: placement.x + constraintBox.paddingX,
      contentY: placement.y,
      contentWidth: getContentWidth(constraintBox),
      contentHeight: getContentHeight(constraintBox),
    };
  }

  return {
    ...placement,
    text: fitted.text,
    lines: fitted.lines,
    fontSize: fitted.fontSize,
    lineHeight: fitted.lineHeight,
    overflowDetected: fitted.overflowDetected,
    clippingRisk: fitted.clippingRisk,
    multilineOverflowDetected: fitted.multilineOverflowDetected,
    contentX: placement.x + constraintBox.paddingX,
    contentY: fitted.contentY,
    contentWidth: fitted.contentWidth,
    contentHeight: fitted.contentHeight,
  };
}

export function alignX(alignment: FieldAlignment, x: number, width: number, textWidth: number): number {
  if (alignment === "center") {
    return x + Math.max((width - textWidth) / 2, 0);
  }

  if (alignment === "right") {
    return x + Math.max(width - textWidth, 0);
  }

  return x;
}

export function fitTextToBoundingBox(
  font: PDFFont,
  value: string,
  box: BoundingBoxFieldDefinition
): BoundingTextFitResult | null {
  if (box.width <= 0 || box.height <= 0) {
    return null;
  }

  const constraintBox = toBoundingConstraintBox(box);
  const fitted = fitTextWithinConstraintBox(font, value, constraintBox);
  if (!fitted) {
    return null;
  }

  return {
    fieldId: box.fieldId,
    page: box.page,
    x: box.x,
    y: fitted.contentY,
    width: box.width,
    height: box.height,
    fontSize: fitted.fontSize,
    lineHeight: fitted.lineHeight,
    text: fitted.text,
    lines: fitted.lines,
    lineCount: fitted.lines.length,
    overflowDetected: fitted.overflowDetected,
    clippingRisk: fitted.clippingRisk,
    multilineOverflowDetected: fitted.multilineOverflowDetected,
    contentX: box.x + box.padding,
    contentY: fitted.contentY,
    contentWidth: fitted.contentWidth,
    contentHeight: fitted.contentHeight,
  };
}

export function resolveCheckboxInBoundingBox(
  box: BoundingBoxFieldDefinition
): BoundingBoxCheckboxLayout | null {
  if (!box.isCheckbox || box.width <= 0 || box.height <= 0) {
    return null;
  }

  return {
    fieldId: box.fieldId,
    page: box.page,
    x: box.x,
    y: box.y,
    centerX: box.x + box.width / 2,
    centerY: box.y + box.height / 2,
    width: box.width,
    height: box.height,
    strokeWidth: Math.max(Math.min(box.width, box.height) * 0.12, 0.9),
    style: box.checkboxStyle,
  };
}
