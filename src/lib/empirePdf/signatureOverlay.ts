import { PDFPage, PDFFont, rgb } from "pdf-lib";

type SignaturePlacement = {
  nameX: number;
  nameY: number;
  nameWidth: number;
  dateX: number;
  dateY: number;
  dateWidth: number;
  maskHeight?: number;
  fontSize?: number;
};

const DEFAULT_PLACEMENT: SignaturePlacement = {
  nameX: 278,
  nameY: 355,
  nameWidth: 170,
  dateX: 282,
  dateY: 399,
  dateWidth: 120,
  maskHeight: 14,
  fontSize: 10,
};

function clean(value: string): string {
  return value.trim().length > 0 ? value.trim() : "Authorized Signatory";
}

export function applySignature(
  page: PDFPage,
  font: PDFFont,
  name: string,
  date: string,
  placement: SignaturePlacement = DEFAULT_PLACEMENT,
) {
  const maskHeight = placement.maskHeight ?? 14;
  const fontSize = placement.fontSize ?? 10;

  page.drawRectangle({
    x: placement.nameX - 4,
    y: placement.nameY - 3,
    width: placement.nameWidth,
    height: maskHeight,
    color: rgb(1, 1, 1),
  });

  page.drawText(clean(name), {
    x: placement.nameX,
    y: placement.nameY,
    size: fontSize,
    font,
    color: rgb(0, 0, 0),
  });

  page.drawRectangle({
    x: placement.dateX - 4,
    y: placement.dateY - 3,
    width: placement.dateWidth,
    height: maskHeight,
    color: rgb(1, 1, 1),
  });

  page.drawText(date.trim(), {
    x: placement.dateX,
    y: placement.dateY,
    size: fontSize,
    font,
    color: rgb(0, 0, 0),
  });
}
