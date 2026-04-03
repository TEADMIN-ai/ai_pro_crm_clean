import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import fs from "fs";
import path from "path";

import { SBD4_FIELDS } from "@/lib/pdf/maps/SBD4";
import { writeToField } from "@/lib/pdf/writeToField";

type DealInput = Record<string, unknown> & {
  title?: unknown;
};

type ContractorInput = Record<string, unknown> & {
  companyName?: unknown;
  name?: unknown;
  registrationNumber?: unknown;
  companyRegistrationNumber?: unknown;
  directorName?: unknown;
  contactPerson?: unknown;
  contactName?: unknown;
  directorId?: unknown;
};

function getString(value: unknown, fallback = "N/A") {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback;
}

export async function generateSBD4(deal: DealInput, contractor: ContractorInput) {
  const filePath = path.join(process.cwd(), "public", "templates", "SBD4.pdf");

  if (!fs.existsSync(filePath)) {
    throw new Error("SBD4 template not found");
  }

  const existingPdfBytes = fs.readFileSync(filePath);
  const pdfDoc = await PDFDocument.load(existingPdfBytes);

  const pages = pdfDoc.getPages();
  const page = pages[0];

  if (!page) {
    throw new Error("SBD4 template has no pages");
  }

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const companyName = getString(contractor.companyName, getString(contractor.name));
  const registrationNumber = getString(
    contractor.registrationNumber,
    getString(contractor.companyRegistrationNumber)
  );
  const directorName = getString(
    contractor.directorName,
    getString(contractor.contactPerson, getString(contractor.contactName))
  );
  const directorId = getString(contractor.directorId);
  const dateValue = new Date().toLocaleDateString("en-ZA");

  writeToField(page, companyName, {
    x: SBD4_FIELDS.companyName.x,
    y: SBD4_FIELDS.companyName.y,
    maxWidth: SBD4_FIELDS.companyName.maxWidth,
    font,
    size: 9,
    color: rgb(0, 0, 0),
  });

  writeToField(page, registrationNumber, {
    x: SBD4_FIELDS.registrationNumber.x,
    y: SBD4_FIELDS.registrationNumber.y,
    maxWidth: SBD4_FIELDS.registrationNumber.maxWidth,
    font,
    size: 9,
    color: rgb(0, 0, 0),
  });

  writeToField(page, directorName, {
    x: SBD4_FIELDS.directorName.x,
    y: SBD4_FIELDS.directorName.y,
    maxWidth: SBD4_FIELDS.directorName.maxWidth,
    font,
    size: 9,
    color: rgb(0, 0, 0),
  });

  writeToField(page, directorId, {
    x: SBD4_FIELDS.directorId.x,
    y: SBD4_FIELDS.directorId.y,
    maxWidth: SBD4_FIELDS.directorId.maxWidth,
    font,
    size: 9,
    color: rgb(0, 0, 0),
  });

  writeToField(page, companyName, {
    x: SBD4_FIELDS.signatureName.x,
    y: SBD4_FIELDS.signatureName.y,
    maxWidth: SBD4_FIELDS.signatureName.maxWidth,
    font,
    size: 9,
    color: rgb(0, 0, 0),
  });

  writeToField(page, dateValue, {
    x: SBD4_FIELDS.date.x,
    y: SBD4_FIELDS.date.y,
    maxWidth: SBD4_FIELDS.date.maxWidth,
    font,
    size: 9,
    color: rgb(0, 0, 0),
  });

  return await pdfDoc.save();
}
