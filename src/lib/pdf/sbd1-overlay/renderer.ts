import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

import type { SBD1OverlayPlan } from "./types";

function resolvePage(pages: PDFPage[], pageIndex = 0): PDFPage | undefined {
  if (pageIndex < 0) {
    return pages[pages.length + pageIndex];
  }

  return pages[pageIndex];
}

function fitSingleLineText(font: PDFFont, text: string, size: number, maxWidth?: number): string {
  if (!text || !maxWidth) {
    return text;
  }

  if (font.widthOfTextAtSize(text, size) <= maxWidth) {
    return text;
  }

  let fitted = text;
  while (fitted.length > 0 && font.widthOfTextAtSize(`${fitted}...`, size) > maxWidth) {
    fitted = fitted.slice(0, -1).trimEnd();
  }

  return fitted ? `${fitted}...` : "";
}

function drawMaskedText(
  page: PDFPage,
  font: PDFFont,
  instruction: SBD1OverlayPlan["textInstructions"][number]
): void {
  const fittedText = fitSingleLineText(font, instruction.text, instruction.size, instruction.maxWidth);

  console.info("SBD1 overlay render field", {
    field: instruction.field,
    value: fittedText,
    pageIndex: instruction.pageIndex ?? 0,
  });

  if (!fittedText) {
    return;
  }

  if (instruction.mask) {
    page.drawRectangle({
      x: instruction.mask.x,
      y: instruction.mask.y,
      width: instruction.mask.width,
      height: instruction.mask.height,
      color: rgb(1, 1, 1),
      borderWidth: 0,
    });
  }

  page.drawText(fittedText, {
    x: instruction.x,
    y: instruction.y,
    size: instruction.size,
    maxWidth: instruction.maxWidth,
    font,
    color: rgb(0, 0, 0),
  });
}

export async function renderSBD1Overlay(
  plan: SBD1OverlayPlan,
  templateBytes: Uint8Array
): Promise<Uint8Array | null> {
  const pdfDocument = await PDFDocument.load(templateBytes);
  const pages = pdfDocument.getPages();
  const firstPage = pages[0];

  if (!firstPage) {
    return null;
  }

  const font = await pdfDocument.embedFont(StandardFonts.Helvetica);

  for (const instruction of plan.textInstructions) {
    const page = resolvePage(pages, instruction.pageIndex);
    if (!page) {
      continue;
    }

    drawMaskedText(page, font, instruction);
  }

  console.info("SBD1 overlay render field", {
    field: plan.checkboxInstruction.field,
    value: plan.checkboxInstruction.mark,
    pageIndex: plan.checkboxInstruction.pageIndex ?? 0,
  });

  resolvePage(pages, plan.checkboxInstruction.pageIndex)?.drawText(plan.checkboxInstruction.mark, {
    x: plan.checkboxInstruction.x,
    y: plan.checkboxInstruction.y,
    size: plan.checkboxInstruction.size,
    font,
    color: rgb(0, 0, 0),
  });

  const datePage = resolvePage(pages, plan.dateInstruction.pageIndex);
  if (datePage) {
    drawMaskedText(datePage, font, plan.dateInstruction);
  }

  return pdfDocument.save();
}
