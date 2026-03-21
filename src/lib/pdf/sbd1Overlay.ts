import { PDFDocument, StandardFonts } from "pdf-lib";

const SBD1_TEMPLATE_PATH = "/templates/SBD1.pdf";
const FIELD_FONT_SIZE = 9;
const CHECKBOX_FONT_SIZE = 12;
const startX = 140;
const gap = 15;
const yesX = 320;
const noX = 360;
const checkboxY = 335;

function cleanText(value: unknown): string {
  if (!value) {
    return "";
  }

  return String(value).replace(/\s+/g, " ").trim();
}

async function loadTemplateSafe(url: string): Promise<Uint8Array | null> {
  try {
    const response = await fetch(url);

    if (!response.ok) {
      console.error(`Template not found: ${url}`);
      return null;
    }

    return new Uint8Array(await response.arrayBuffer());
  } catch (error) {
    console.error("Template load failed:", error);
    return null;
  }
}

export async function generateSBD1Overlay(data: any) {
  const templateBytes = await loadTemplateSafe(SBD1_TEMPLATE_PATH);

  if (!templateBytes) {
    return null;
  }

  const pdfDoc = await PDFDocument.load(templateBytes);
  const page = pdfDoc.getPages()[0];

  if (!page) {
    return null;
  }

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const safeCompanyName = cleanText(data.companyName || "").slice(0, 40) || "Torque Empire Pty Ltd";
  let currentY = 455;

  page.drawText(safeCompanyName, {
    x: startX,
    y: currentY,
    size: FIELD_FONT_SIZE,
    font,
  });
  currentY -= gap;

  page.drawText("33 Banberry Drive Eldorado Park Ext 3", {
    x: startX,
    y: currentY,
    size: FIELD_FONT_SIZE,
    font,
  });
  currentY -= gap;

  page.drawText("33 Banberry Drive Eldorado Park Ext 3", {
    x: startX,
    y: currentY,
    size: FIELD_FONT_SIZE,
    font,
  });
  currentY -= gap;

  page.drawText(cleanText(data.contactNumber) || "0695024909", {
    x: startX,
    y: currentY,
    size: FIELD_FONT_SIZE,
    font,
  });
  currentY -= gap;

  page.drawText(cleanText(data.email) || "torqueempiresa@gmail.com", {
    x: startX,
    y: currentY,
    size: FIELD_FONT_SIZE,
    font,
  });
  currentY -= gap;

  page.drawText(cleanText(data.vatNumber) || "N/A", {
    x: startX,
    y: currentY,
    size: FIELD_FONT_SIZE,
    font,
  });

  page.drawText("X", {
    x: cleanText(data.bbbee).toUpperCase() === "YES" ? yesX : noX,
    y: checkboxY,
    size: CHECKBOX_FONT_SIZE,
    font,
  });

  page.drawText(new Date().toLocaleDateString(), {
    x: 420,
    y: 100,
    size: FIELD_FONT_SIZE,
    font,
  });

  return pdfDoc.save();
}
