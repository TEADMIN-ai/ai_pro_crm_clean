import { PDFDocument, rgb, StandardFonts, type PDFPage } from "pdf-lib";
import fs from "fs";
import path from "path";

import { drawDebugGrid } from "@/lib/pdf/drawDebugGrid";
import { drawCheckbox } from "@/lib/pdf/helpers/drawCheckbox";
import { SBD1_CHECKBOXES, SBD1_FIELDS } from "@/lib/pdf/maps/SBD1";
import { writeToField } from "@/lib/pdf/writeToField";

type DealInput = Record<string, unknown> & {
  title?: unknown;
  status?: unknown;
  tenderNumber?: unknown;
};

type ContractorInput = Record<string, unknown> & {
  companyName?: unknown;
  name?: unknown;
  registrationNumber?: unknown;
  companyRegistrationNumber?: unknown;
  taxNumber?: unknown;
  taxPin?: unknown;
  contactPerson?: unknown;
  contactName?: unknown;
  email?: unknown;
  contactEmail?: unknown;
  phone?: unknown;
  contactPhone?: unknown;
  address1?: unknown;
  address2?: unknown;
  address?: unknown;
  streetAddress?: unknown;
  postalAddress?: unknown;
  physicalAddress?: unknown;
  isVatVendor?: unknown;
};

function getString(value: unknown, fallback = "N/A") {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback;
}

function getOptionalString(value: unknown): string {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : "";
}

function writeMappedField(
  page: PDFPage,
  text: unknown,
  field: (typeof SBD1_FIELDS)[keyof typeof SBD1_FIELDS],
  font: Awaited<ReturnType<PDFDocument["embedFont"]>>
) {
  return writeToField(page, text, {
    x: field.x,
    y: field.y,
    maxWidth: field.maxWidth,
    font,
    size: 9,
    color: rgb(0, 0, 0),
  });
}

export async function generateSBD1(deal: DealInput, contractor: ContractorInput) {
  const filePath = path.join(process.cwd(), "public", "templates", "SBD1.pdf");

  if (!fs.existsSync(filePath)) {
    throw new Error("SBD1 template not found");
  }

  const existingPdfBytes = fs.readFileSync(filePath);
  const pdfDoc = await PDFDocument.load(existingPdfBytes);

  const pages = pdfDoc.getPages();
  const firstPage = pages[0];

  if (!firstPage) {
    throw new Error("SBD1 template has no pages");
  }

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const companyName = getString(contractor.companyName, getString(contractor.name));
  const registrationNumber = getString(contractor.registrationNumber, getString(contractor.companyRegistrationNumber));
  const taxNumber = getString(contractor.taxNumber, getString(contractor.taxPin));
  const tenderTitle = getString(deal.title);
  const tenderNumber = getString(deal.tenderNumber, getString(deal.status));
  const contactPerson = getString(contractor.contactPerson, getString(contractor.contactName, companyName));
  const contactEmail = getString(contractor.email, getString(contractor.contactEmail));
  const contactPhone = getString(contractor.phone, getString(contractor.contactPhone));
  const addressLine1 = getString(
    contractor.address1,
    getOptionalString(contractor.streetAddress) ||
      getOptionalString(contractor.address) ||
      getOptionalString(contractor.physicalAddress) ||
      "N/A"
  );
  const addressLine2 = getString(
    contractor.address2,
    getOptionalString(contractor.postalAddress) || getOptionalString(contractor.address) || addressLine1
  );
  const dateValue = new Date().toLocaleDateString("en-ZA");
  const isVatVendor =
    contractor.isVatVendor === true
      ? true
      : contractor.isVatVendor === false
        ? false
        : null;

  if (process.env.DEBUG_PDF_GRID === "1") {
    drawDebugGrid(firstPage);
  }

  writeMappedField(firstPage, companyName, SBD1_FIELDS.companyName, font);
  writeMappedField(firstPage, registrationNumber, SBD1_FIELDS.registrationNumber, font);
  writeMappedField(firstPage, taxNumber, SBD1_FIELDS.taxNumber, font);
  writeMappedField(firstPage, tenderTitle, SBD1_FIELDS.tenderTitle, font);
  writeMappedField(firstPage, tenderNumber, SBD1_FIELDS.tenderNumber, font);
  writeMappedField(firstPage, contactPerson, SBD1_FIELDS.contactPerson, font);
  writeMappedField(firstPage, contactEmail, SBD1_FIELDS.contactEmail, font);
  writeMappedField(firstPage, contactPhone, SBD1_FIELDS.contactPhone, font);
  writeMappedField(firstPage, addressLine1, SBD1_FIELDS.addressLine1, font);
  writeMappedField(firstPage, addressLine2, SBD1_FIELDS.addressLine2, font);
  writeMappedField(firstPage, dateValue, SBD1_FIELDS.date, font);
  writeMappedField(firstPage, companyName, SBD1_FIELDS.signatureName, font);
  drawCheckbox(firstPage, isVatVendor === true, SBD1_CHECKBOXES.isVatVendorYes);
  drawCheckbox(firstPage, isVatVendor === false, SBD1_CHECKBOXES.isVatVendorNo);
  drawCheckbox(firstPage, true, SBD1_CHECKBOXES.acceptsTermsYes);

  const pdfBytes = await pdfDoc.save();
  return pdfBytes;
}
