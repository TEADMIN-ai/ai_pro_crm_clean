import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

export type SBD4Data = {
  bidder: {
    companyName: string;
  };
  declarations: {
    isEmployee: boolean;
    isDirector: boolean;
    relatedToStateEmployee: boolean;
    details?: string;
  };
  signoff: {
    name: string;
    capacity: string;
    initials: string;
  };
};

type TextPosition = {
  x: number;
  y: number;
  maxWidth?: number;
};

const SBD4_TEMPLATE_PATH = "/templates/SBD4.pdf";
const FIELD_FONT_SIZE = 10;
const DETAIL_FONT_SIZE = 9;
const SIGNATURE_FONT_SIZE = 9;
const SIGNATURE_MARK_SIZE = 10;
const CHECKBOX_MARK = "X";

const SBD4_POSITIONS = {
  bidderName: { x: 180, y: 700, maxWidth: 260 },
  details: { x: 180, y: 500, maxWidth: 300 },
  signoff: {
    initials: { x: 180, y: 200, maxWidth: 120 },
    name: { x: 180, y: 170, maxWidth: 220 },
    capacity: { x: 180, y: 150, maxWidth: 180 },
    date: { x: 180, y: 130, maxWidth: 120 },
  },
  declarations: {
    isEmployee: {
      yes: { x: 420, y: 640 },
      no: { x: 470, y: 640 },
    },
    isDirector: {
      yes: { x: 420, y: 600 },
      no: { x: 470, y: 600 },
    },
    relatedToStateEmployee: {
      yes: { x: 420, y: 560 },
      no: { x: 470, y: 560 },
    },
  },
} as const;

async function loadTemplateSafe(url: string): Promise<Uint8Array | null> {
  try {
    const res = await fetch(url);

    if (!res.ok) {
      console.error(`Template not found: ${url}`);
      return null;
    }

    return new Uint8Array(await res.arrayBuffer());
  } catch (err) {
    console.error("Template load failed:", err);
    return null;
  }
}

async function createSBD4Document(templateBytes?: Uint8Array | null): Promise<PDFDocument> {
  let pdfDoc: PDFDocument;

  if (!templateBytes) {
    console.warn("Using fallback blank PDF template");
    console.warn("Missing template. Place SBD1.pdf or SBD4.pdf in /public/templates/");

    pdfDoc = await PDFDocument.create();
    pdfDoc.addPage([595, 842]);
  } else {
    pdfDoc = await PDFDocument.load(templateBytes);
  }

  return pdfDoc;
}

function cleanText(value: unknown): string {
  if (!value) return "";

  return String(value)
    .replace(/&/g, "")
    .replace(/[^a-zA-Z0-9\s:%.,-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function fitSingleLineText(font: PDFFont, text: string, size: number, maxWidth?: number): string {
  const cleaned = cleanText(text);
  if (!cleaned || !maxWidth) {
    return cleaned;
  }

  if (font.widthOfTextAtSize(cleaned, size) <= maxWidth) {
    return cleaned;
  }

  let fitted = cleaned;
  while (fitted.length > 0 && font.widthOfTextAtSize(`${fitted}...`, size) > maxWidth) {
    fitted = fitted.slice(0, -1).trimEnd();
  }

  return fitted ? `${fitted}...` : "";
}

function drawTextField(
  page: PDFPage,
  font: PDFFont,
  text: string,
  position: TextPosition,
  size: number
) {
  const fittedText = fitSingleLineText(font, text, size, position.maxWidth);
  if (!fittedText) {
    return;
  }

  page.drawText(fittedText, {
    x: position.x,
    y: position.y,
    size,
    font,
    color: rgb(0, 0, 0),
    maxWidth: position.maxWidth,
  });
}

function drawCheck(
  page: PDFPage,
  font: PDFFont,
  condition: boolean,
  yesPos: TextPosition,
  noPos: TextPosition
) {
  const targetPosition = condition ? yesPos : noPos;

  page.drawText(CHECKBOX_MARK, {
    x: targetPosition.x,
    y: targetPosition.y,
    size: FIELD_FONT_SIZE,
    font,
    color: rgb(0, 0, 0),
  });
}

function drawSBD4Overlay(page: PDFPage, font: PDFFont, data: SBD4Data) {
  drawTextField(page, font, data.bidder.companyName, SBD4_POSITIONS.bidderName, FIELD_FONT_SIZE);

  drawCheck(
    page,
    font,
    data.declarations.isEmployee,
    SBD4_POSITIONS.declarations.isEmployee.yes,
    SBD4_POSITIONS.declarations.isEmployee.no
  );
  drawCheck(
    page,
    font,
    data.declarations.isDirector,
    SBD4_POSITIONS.declarations.isDirector.yes,
    SBD4_POSITIONS.declarations.isDirector.no
  );
  drawCheck(
    page,
    font,
    data.declarations.relatedToStateEmployee,
    SBD4_POSITIONS.declarations.relatedToStateEmployee.yes,
    SBD4_POSITIONS.declarations.relatedToStateEmployee.no
  );

  if (data.declarations.details) {
    drawTextField(page, font, data.declarations.details, SBD4_POSITIONS.details, DETAIL_FONT_SIZE);
  }

  const today = new Date().toLocaleDateString("en-ZA");

  drawTextField(page, font, data.signoff.name, SBD4_POSITIONS.signoff.name, SIGNATURE_FONT_SIZE);
  drawTextField(page, font, data.signoff.capacity, SBD4_POSITIONS.signoff.capacity, SIGNATURE_FONT_SIZE);
  drawTextField(page, font, today, SBD4_POSITIONS.signoff.date, SIGNATURE_FONT_SIZE);
  drawTextField(page, font, data.signoff.initials, SBD4_POSITIONS.signoff.initials, SIGNATURE_MARK_SIZE);
}

export async function loadSBD4Template(): Promise<Uint8Array> {
  const templateBytes = await loadTemplateSafe(SBD4_TEMPLATE_PATH);

  if (templateBytes) {
    return templateBytes;
  }

  const pdfDoc = await createSBD4Document(null);
  return pdfDoc.save();
}

export async function generateSBD4(
  templateBytes: Uint8Array | null | undefined,
  data: SBD4Data
): Promise<Uint8Array> {
  const pdfDoc = await createSBD4Document(templateBytes);
  const pages = pdfDoc.getPages();
  const page = pages[0];

  if (!page) {
    throw new Error("SBD4 template does not contain a first page");
  }

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  drawSBD4Overlay(page, font, data);

  return pdfDoc.save();
}

export function downloadSBD4(pdfBytes: Uint8Array) {
  const normalizedBytes = new Uint8Array(pdfBytes.byteLength);
  normalizedBytes.set(pdfBytes);

  const blob = new Blob([normalizedBytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);

  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "SBD4_Filled.pdf";
  anchor.click();

  URL.revokeObjectURL(url);
}
