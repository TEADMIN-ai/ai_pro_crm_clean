import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import fs from "fs";
import path from "path";

import { writeToField } from "@/lib/pdf/writeToField";

type DealInput = Record<string, unknown> & {
  title?: unknown;
  tenderNumber?: unknown;
};

type ContractorInput = Record<string, unknown> & {
  companyName?: unknown;
  name?: unknown;
  registrationNumber?: unknown;
  companyRegistrationNumber?: unknown;
  bbbeeLevel?: unknown;
  bbbeeStatus?: unknown;
};

const SBD6_FIELDS = {
  companyName: { x: 140, y: 515, maxWidth: 320 },
  registrationNumber: { x: 140, y: 492, maxWidth: 220 },
  tenderTitle: { x: 140, y: 468, maxWidth: 340 },
  tenderNumber: { x: 140, y: 445, maxWidth: 220 },
  bbbeeLevel: { x: 140, y: 422, maxWidth: 220 },
  signatureName: { x: 140, y: 210, maxWidth: 320 },
  date: { x: 420, y: 210, maxWidth: 120 },
} as const;

function getString(value: unknown, fallback = "N/A") {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback;
}

export async function generateSBD6Template(deal: DealInput, contractor: ContractorInput) {
  const templatePath = path.join(process.cwd(), "public", "templates", "SBD6.pdf");
  if (!fs.existsSync(templatePath)) {
    throw new Error("SBD6 template not found");
  }

  const pdfDoc = await PDFDocument.load(fs.readFileSync(templatePath));
  const page = pdfDoc.getPages()[0];
  if (!page) {
    throw new Error("SBD6 template has no pages");
  }

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const companyName = getString(contractor.companyName, getString(contractor.name));
  const registrationNumber = getString(
    contractor.registrationNumber,
    getString(contractor.companyRegistrationNumber)
  );
  const bbbeeLevel = getString(contractor.bbbeeLevel, getString(contractor.bbbeeStatus));

  writeToField(page, companyName, { ...SBD6_FIELDS.companyName, font, size: 9, color: rgb(0, 0, 0) });
  writeToField(page, registrationNumber, { ...SBD6_FIELDS.registrationNumber, font, size: 9, color: rgb(0, 0, 0) });
  writeToField(page, getString(deal.title), { ...SBD6_FIELDS.tenderTitle, font, size: 9, color: rgb(0, 0, 0) });
  writeToField(page, getString(deal.tenderNumber), { ...SBD6_FIELDS.tenderNumber, font, size: 9, color: rgb(0, 0, 0) });
  writeToField(page, bbbeeLevel, { ...SBD6_FIELDS.bbbeeLevel, font, size: 9, color: rgb(0, 0, 0) });
  writeToField(page, companyName, { ...SBD6_FIELDS.signatureName, font, size: 9, color: rgb(0, 0, 0) });
  writeToField(page, new Date().toLocaleDateString("en-ZA"), { ...SBD6_FIELDS.date, font, size: 9, color: rgb(0, 0, 0) });

  return pdfDoc.save();
}
