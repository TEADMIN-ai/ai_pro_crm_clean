import { readFile } from "fs/promises";
import path from "path";
import { PDFDocument, PDFPage, PDFFont, StandardFonts, degrees, rgb } from "pdf-lib";

type TenderDealData = {
  id: string;
  title: string;
  value: number | null;
  readinessScore: number;
  missingDocs: string[];
  riskLevel: string;
  suggestions: string[];
};

type TenderContractorData = {
  id: string;
  companyName: string;
  registrationNumber: string | null;
  bbbeeStatus: string | null;
  logoBase64?: string | null;
};

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN = 50;
const PRIMARY = rgb(0.07, 0.16, 0.31);
const SECONDARY = rgb(0.12, 0.31, 0.47);
const DIVIDER = rgb(0.76, 0.83, 0.9);
const BODY = rgb(0.08, 0.08, 0.08);
const MUTED = rgb(0.5, 0.5, 0.5);

function formatCurrency(value: number | null): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "N/A";
  }

  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    maximumFractionDigits: 2,
  }).format(value);
}

function normalizeBase64Image(input?: string | null): Uint8Array | null {
  if (!input) {
    return null;
  }

  const normalized = input.includes(",") ? input.split(",").pop() ?? "" : input;
  if (!normalized) {
    return null;
  }

  return Uint8Array.from(Buffer.from(normalized, "base64"));
}

async function loadLogoBytes(logoBase64?: string | null): Promise<Uint8Array | null> {
  const inlineLogo = normalizeBase64Image(logoBase64);
  if (inlineLogo) {
    return inlineLogo;
  }

  try {
    const logoPath = path.join(process.cwd(), "public", "logo.png");
    const file = await readFile(logoPath);
    return Uint8Array.from(file);
  } catch {
    return null;
  }
}

function drawFooter(page: PDFPage, text: string, font: PDFFont) {
  const size = 9;
  const textWidth = font.widthOfTextAtSize(text, size);

  page.drawLine({
    start: { x: MARGIN, y: 36 },
    end: { x: PAGE_WIDTH - MARGIN, y: 36 },
    thickness: 1,
    color: DIVIDER,
  });

  page.drawText(text, {
    x: (PAGE_WIDTH - textWidth) / 2,
    y: 20,
    size,
    font,
    color: MUTED,
  });
}

function drawWatermark(page: PDFPage, font: PDFFont) {
  const text = "Torque Empire AI";
  const size = 46;
  const textWidth = font.widthOfTextAtSize(text, size);

  page.drawText(text, {
    x: (PAGE_WIDTH - textWidth) / 2,
    y: PAGE_HEIGHT / 2,
    size,
    font,
    color: rgb(0.1, 0.2, 0.35),
    opacity: 0.07,
    rotate: degrees(-20),
  });
}

function drawHeaderBand(page: PDFPage, color: ReturnType<typeof rgb>) {
  page.drawRectangle({
    x: 0,
    y: 770,
    width: PAGE_WIDTH,
    height: 72,
    color,
  });
}

function drawSectionTitle(
  page: PDFPage,
  title: string,
  y: number,
  font: PDFFont,
) {
  page.drawText(title, {
    x: MARGIN,
    y,
    size: 14,
    font,
    color: rgb(0.1, 0.17, 0.27),
  });

  page.drawLine({
    start: { x: MARGIN, y: y - 8 },
    end: { x: PAGE_WIDTH - MARGIN, y: y - 8 },
    thickness: 1,
    color: DIVIDER,
  });
}

export async function generateTenderPdf(
  deal: TenderDealData,
  contractor: TenderContractorData,
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const logoBytes = await loadLogoBytes(contractor.logoBase64);
  const logoImage = logoBytes ? await pdfDoc.embedPng(logoBytes) : null;

  const firstPage = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const secondPage = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);

  drawHeaderBand(firstPage, PRIMARY);
  drawHeaderBand(secondPage, SECONDARY);
  drawWatermark(firstPage, boldFont);
  drawWatermark(secondPage, boldFont);

  firstPage.drawText("Torque Empire Tender Submission Pack", {
    x: MARGIN,
    y: 798,
    size: 22,
    font: boldFont,
    color: rgb(1, 1, 1),
  });

  if (logoImage) {
    const scaled = logoImage.scale(0.22);
    const maxWidth = 92;
    const ratio = Math.min(1, maxWidth / scaled.width);
    const width = scaled.width * ratio;
    const height = scaled.height * ratio;

    firstPage.drawImage(logoImage, {
      x: PAGE_WIDTH - MARGIN - width,
      y: 782,
      width,
      height,
    });
  }

  let y = 710;
  const labelX = MARGIN;
  const valueX = 220;

  const drawField = (label: string, value: string) => {
    firstPage.drawText(label, {
      x: labelX,
      y,
      size: 12,
      font: boldFont,
      color: rgb(0.15, 0.23, 0.35),
    });

    firstPage.drawText(value, {
      x: valueX,
      y,
      size: 12,
      font,
      color: BODY,
    });

    firstPage.drawLine({
      start: { x: MARGIN, y: y - 10 },
      end: { x: PAGE_WIDTH - MARGIN, y: y - 10 },
      thickness: 0.8,
      color: DIVIDER,
    });

    y -= 30;
  };

  drawField("Company Name", contractor.companyName);
  drawField("Deal Title", deal.title);
  drawField("Contract Value", formatCurrency(deal.value));
  drawField("Readiness Score", `${deal.readinessScore}%`);
  drawField("Registration Number", contractor.registrationNumber ?? "N/A");
  drawField("B-BBEE Status", contractor.bbbeeStatus ?? "N/A");

  secondPage.drawText("COMPLIANCE SUMMARY", {
    x: MARGIN,
    y: 798,
    size: 22,
    font: boldFont,
    color: rgb(1, 1, 1),
  });

  let secondY = 720;

  drawSectionTitle(secondPage, "Missing Docs", secondY, boldFont);
  secondY -= 34;

  const drawLine = (text: string) => {
    secondPage.drawText(text, {
      x: MARGIN + 12,
      y: secondY,
      size: 11,
      font,
      color: BODY,
    });
    secondY -= 18;
  };

  if (deal.missingDocs.length === 0) {
    drawLine("None");
  } else {
    deal.missingDocs.forEach((item) => drawLine(`- ${item}`));
  }

  secondY -= 12;
  drawSectionTitle(secondPage, "Risk Level", secondY, boldFont);
  secondY -= 34;
  drawLine(deal.riskLevel || "LOW");

  secondY -= 12;
  drawSectionTitle(secondPage, "Suggestions", secondY, boldFont);
  secondY -= 34;

  if (deal.suggestions.length === 0) {
    drawLine("No additional suggestions");
  } else {
    deal.suggestions.forEach((item) => drawLine(`- ${item}`));
  }

  const footerText = "Generated by Torque Empire AI Intelligence Engine";
  drawFooter(firstPage, footerText, font);
  drawFooter(secondPage, footerText, font);

  return pdfDoc.save();
}
