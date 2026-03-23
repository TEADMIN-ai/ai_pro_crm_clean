import { rgb, type PDFFont, type PDFPage } from "pdf-lib";

const DEFAULT_FONT_SIZE = 10;
const DEFAULT_COLOR = rgb(0, 0, 0);
const ELLIPSIS = "...";

export type PdfWriteField = {
  x: number;
  y: number;
  maxWidth: number;
  font: PDFFont;
  size?: number;
  lineHeight?: number;
  color?: ReturnType<typeof rgb>;
};

export type WriteToFieldResult = {
  written: boolean;
  text: string;
};

export function cleanFieldText(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value)
    .replace(/&/g, "")
    .replace(/[^a-zA-Z0-9\s:%.,/\-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function fitTextToField(text: string, field: Pick<PdfWriteField, "font" | "maxWidth" | "size">): string {
  const cleaned = cleanFieldText(text);
  const size = field.size ?? DEFAULT_FONT_SIZE;

  if (!cleaned || field.maxWidth <= 0) {
    return "";
  }

  if (field.font.widthOfTextAtSize(cleaned, size) <= field.maxWidth) {
    return cleaned;
  }

  let fitted = cleaned;
  while (fitted && field.font.widthOfTextAtSize(`${fitted}${ELLIPSIS}`, size) > field.maxWidth) {
    fitted = fitted.slice(0, -1).trimEnd();
  }

  return fitted ? `${fitted}${ELLIPSIS}` : "";
}

export function writeToField(page: PDFPage, text: unknown, field: PdfWriteField): WriteToFieldResult {
  const fittedText = fitTextToField(String(text ?? ""), field);

  if (!fittedText) {
    return {
      written: false,
      text: "",
    };
  }

  page.drawText(fittedText, {
    x: field.x,
    y: field.y,
    size: field.size ?? DEFAULT_FONT_SIZE,
    maxWidth: field.maxWidth,
    lineHeight: field.lineHeight,
    font: field.font,
    color: field.color ?? DEFAULT_COLOR,
  });

  return {
    written: true,
    text: fittedText,
  };
}
