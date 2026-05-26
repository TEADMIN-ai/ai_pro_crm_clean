import type { PDFFont } from "pdf-lib";

import type {
  BoundingBoxCheckboxLayout,
  BoundingBoxFieldDefinition,
  BoundingBoxTextLayout,
} from "./boundingBoxes";
import type { FieldAlignment, IntelligentAnchorMatch, TemplateFieldDefinition } from "./templates";

type PlacementBox = {
  x: number;
  y: number;
  width: number;
  height: number;
  usedFallback: boolean;
  confidence: number;
};

export type FittedTextLayout = PlacementBox & {
  text: string;
  fontSize: number;
  lineHeight: number;
  overflowDetected: boolean;
  clippingRisk: boolean;
  multilineOverflowDetected: boolean;
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

function clipLineToWidth(font: PDFFont, text: string, size: number, width: number): string {
  const normalized = text.trim();
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

function splitLongWord(font: PDFFont, word: string, size: number, width: number): string[] {
  if (lineWidth(font, word, size) <= width) {
    return [word];
  }

  const segments: string[] = [];
  let remaining = word;

  while (remaining.length > 0) {
    let sliceLength = remaining.length;

    while (sliceLength > 1 && lineWidth(font, remaining.slice(0, sliceLength), size) > width) {
      sliceLength -= 1;
    }

    segments.push(remaining.slice(0, sliceLength));
    remaining = remaining.slice(sliceLength);
  }

  return segments;
}

function wrapText(font: PDFFont, text: string, size: number, width: number): string[] {
  const words = text
    .split(/\s+/)
    .filter(Boolean)
    .flatMap((word) => splitLongWord(font, word, size, width));
  if (words.length === 0) {
    return [];
  }

  const lines: string[] = [];
  let current = words[0];

  for (const word of words.slice(1)) {
    const candidate = `${current} ${word}`;
    if (lineWidth(font, candidate, size) <= width) {
      current = candidate;
      continue;
    }

    lines.push(current);
    current = word;
  }

  lines.push(current);
  return lines;
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
  const box = resolvePlacementBox(field, anchor);
  const maxFontSize = field.maxFontSize ?? 10;
  const minFontSize = field.minFontSize ?? 7;
  let fontSize = maxFontSize;
  let lines = field.multiline ? wrapText(font, value, fontSize, box.width) : [value];
  const maxHeight = box.height;

  while (fontSize > minFontSize) {
    const lineHeight = field.lineHeight ?? fontSize + 1;
    const tooWide = lines.some((line) => lineWidth(font, line, fontSize) > box.width);
    const tooTall = lines.length * lineHeight > maxHeight;

    if (!tooWide && !tooTall) {
      return {
        ...box,
        text: lines.join("\n"),
        fontSize,
        lineHeight,
        overflowDetected: false,
        clippingRisk: false,
        multilineOverflowDetected: false,
      };
    }

    fontSize -= 0.5;
    lines = field.multiline ? wrapText(font, value, fontSize, box.width) : [value];
  }

  const lineHeight = field.lineHeight ?? minFontSize + 1;
  const clippedLines = field.multiline ? wrapText(font, value, minFontSize, box.width) : [value];
  const tooWideAtMinSize = clippedLines.some((line) => lineWidth(font, line, minFontSize) > box.width);
  const tooTallAtMinSize = clippedLines.length * lineHeight > maxHeight;

  return {
    ...box,
    text: clippedLines.join("\n"),
    fontSize: minFontSize,
    lineHeight,
    overflowDetected: tooWideAtMinSize || tooTallAtMinSize,
    clippingRisk: tooWideAtMinSize,
    multilineOverflowDetected: field.multiline === true && tooTallAtMinSize,
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

function boxWidth(box: BoundingBoxFieldDefinition): number {
  return Math.max(box.xMax - box.xMin, 0);
}

function boxHeight(box: BoundingBoxFieldDefinition): number {
  return Math.max(box.yMax - box.yMin, 0);
}

function buildCandidateLines(
  font: PDFFont,
  value: string,
  fontSize: number,
  box: BoundingBoxFieldDefinition,
  allowClip = false
): string[] {
  if (box.multiline) {
    return wrapText(font, value, fontSize, boxWidth(box));
  }

  return [allowClip ? clipLineToWidth(font, value, fontSize, boxWidth(box)) : value.trim()];
}

export function fitTextToBoundingBox(
  font: PDFFont,
  value: string,
  box: BoundingBoxFieldDefinition
): BoundingTextFitResult | null {
  const normalized = value.trim();
  if (!normalized) {
    return null;
  }

  const width = boxWidth(box);
  const height = boxHeight(box);

  if (width <= 0 || height <= 0) {
    return null;
  }

  let fontSize = box.maxFontSize;

  while (fontSize >= box.minFontSize) {
    const lineHeight = Math.max(box.lineSpacing, fontSize + 0.5);
    const lines = buildCandidateLines(font, normalized, fontSize, box);
    const tooWide = lines.some((line) => lineWidth(font, line, fontSize) > width);
    const tooTall = lines.length * lineHeight > height;

    if (!tooWide && !tooTall) {
      return {
        fieldId: box.fieldId,
        page: box.page,
        x: box.xMin,
        y: box.yMax - fontSize,
        width,
        height,
        fontSize,
        lineHeight,
        text: lines.join("\n"),
        lineCount: lines.length,
        overflowDetected: false,
        clippingRisk: false,
        multilineOverflowDetected: false,
      };
    }

    fontSize = Number((fontSize - 0.5).toFixed(2));
  }

  const finalFontSize = box.minFontSize;
  const lineHeight = Math.max(box.lineSpacing, finalFontSize + 0.5);
  const maxLineCount = Math.max(Math.floor(height / lineHeight), 1);
  const lines = buildCandidateLines(font, normalized, finalFontSize, box, true)
    .slice(0, maxLineCount)
    .map((line, index, allLines) =>
      index === allLines.length - 1 ? clipLineToWidth(font, line, finalFontSize, width) : line
    );

  if (lines.length === 0) {
    return null;
  }

  return {
    fieldId: box.fieldId,
    page: box.page,
    x: box.xMin,
    y: box.yMax - finalFontSize,
    width,
    height,
    fontSize: finalFontSize,
    lineHeight,
    text: lines.join("\n"),
    lineCount: lines.length,
    overflowDetected: true,
    clippingRisk: true,
    multilineOverflowDetected: box.multiline && maxLineCount < buildCandidateLines(font, normalized, finalFontSize, box).length,
  };
}

export function resolveCheckboxInBoundingBox(
  box: BoundingBoxFieldDefinition
): BoundingBoxCheckboxLayout | null {
  if (!box.isCheckbox) {
    return null;
  }

  const width = boxWidth(box);
  const height = boxHeight(box);
  if (width <= 0 || height <= 0) {
    return null;
  }

  return {
    fieldId: box.fieldId,
    page: box.page,
    centerX: box.xMin + width / 2,
    centerY: box.yMin + height / 2,
    width,
    height,
    strokeWidth: Math.max(Math.min(width, height) * 0.12, 0.9),
  };
}
