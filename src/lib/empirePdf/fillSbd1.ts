import { readFile } from "fs/promises";
import path from "path";
import { PDFDocument, StandardFonts, PDFPage, PDFFont, rgb } from "pdf-lib";
import { fillTemplateWithIntelligence } from "@/lib/empirePdf/intelligentFillEngine";
import { SBD1_FIELDS } from "@/lib/pdf/maps/SBD1";

type DealInput = {
  id: string;
  title: string;
  value: number | null;
  readinessScore: number;
  missingDocs: string[];
  riskLevel: string;
  suggestions: string[];
};

type ContractorInput = {
  id: string;
  companyName: string;
  registrationNumber: string | null;
  bbbeeStatus: string | null;
  contactPerson?: string | null;
};

type FieldPlacement = {
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  textX?: number;
  textY?: number;
  size?: number;
};

const FIELD_MAP: Record<
  "companyName" | "registrationNumber" | "bbbeeStatus" | "contactPerson" | "date",
  FieldPlacement
> = {
  companyName: {
    page: 0,
    x: SBD1_FIELDS.companyName.x - 4,
    y: SBD1_FIELDS.companyName.y - 3,
    width: 320,
    height: 14,
    textX: SBD1_FIELDS.companyName.x,
    textY: SBD1_FIELDS.companyName.y,
    size: 9,
  },
  registrationNumber: {
    page: 0,
    x: SBD1_FIELDS.registrationNumber.x - 4,
    y: SBD1_FIELDS.registrationNumber.y - 3,
    width: 220,
    height: 14,
    textX: SBD1_FIELDS.registrationNumber.x,
    textY: SBD1_FIELDS.registrationNumber.y,
    size: 9,
  },
  bbbeeStatus: {
    page: 0,
    x: SBD1_FIELDS.taxNumber.x - 4,
    y: SBD1_FIELDS.taxNumber.y - 3,
    width: 220,
    height: 14,
    textX: SBD1_FIELDS.taxNumber.x,
    textY: SBD1_FIELDS.taxNumber.y,
    size: 9,
  },
  contactPerson: {
    page: 0,
    x: SBD1_FIELDS.contactPerson.x - 4,
    y: SBD1_FIELDS.contactPerson.y - 3,
    width: 260,
    height: 14,
    textX: SBD1_FIELDS.contactPerson.x,
    textY: SBD1_FIELDS.contactPerson.y,
    size: 9,
  },
  date: {
    page: 0,
    x: SBD1_FIELDS.date.x - 4,
    y: SBD1_FIELDS.date.y - 3,
    width: 125,
    height: 14,
    textX: SBD1_FIELDS.date.x,
    textY: SBD1_FIELDS.date.y,
    size: 9,
  },
};

function clean(value: unknown, fallback = "N/A"): string {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback;
}

function overlayField(
  page: PDFPage,
  font: PDFFont,
  value: string,
  placement: FieldPlacement,
) {
  page.drawRectangle({
    x: placement.x,
    y: placement.y,
    width: placement.width,
    height: placement.height,
    color: rgb(1, 1, 1),
  });

  page.drawText(value, {
    x: placement.textX ?? placement.x + 2,
    y: placement.textY ?? placement.y + 2,
    size: placement.size ?? 10,
    font,
    color: rgb(0, 0, 0),
  });
}

export async function fillSbd1(
  contractor: ContractorInput,
  deal: DealInput,
): Promise<Uint8Array> {
  const templatePath = path.join(process.cwd(), "public", "templates", "SBD1.pdf");
  const templateBytes = await readFile(templatePath);
  const currentDate = new Date().toLocaleDateString("en-ZA");

  try {
    const intelligentResult = await fillTemplateWithIntelligence({
      templateKey: "sbd1",
      templateBytes,
      profile: {
        contractorId: contractor.id,
        companyName: clean(contractor.companyName, contractor.id),
        regNumber: clean(contractor.registrationNumber, ""),
        vatNumber: "",
        taxPin: "",
        cidb: "",
        csdNumber: "",
        bankingDetails: "",
        directors: clean(contractor.contactPerson, contractor.companyName),
        address: "",
        contactPerson: clean(contractor.contactPerson, contractor.companyName),
        email: "",
        phone: "",
        bbbeeLevel: clean(contractor.bbbeeStatus, ""),
        bbbeeStatus: clean(contractor.bbbeeStatus, ""),
        signatoryRole: "Authorized Signatory",
        missingFields: [],
        sourceAttribution: {},
      },
      debug: process.env.EMPIREPDF_DEBUG === "1",
    });

    console.info("SBD1 intelligent fill completed", {
      contractorId: contractor.id,
      dealId: deal.id,
      averageConfidence: intelligentResult.result.averageConfidence,
      renderedFieldCount: intelligentResult.result.renderedFieldCount,
      warnings: intelligentResult.result.warnings,
    });

    return intelligentResult.pdfBytes;
  } catch (error) {
    console.warn("SBD1 intelligent fill failed, using legacy overlay fallback", {
      contractorId: contractor.id,
      dealId: deal.id,
      error: error instanceof Error ? error.message : error,
    });
  }

  const existingPdf = await PDFDocument.load(templateBytes);
  const pages = existingPdf.getPages();

  if (pages.length === 0) {
    throw new Error("SBD1 template has no pages");
  }

  const font = await existingPdf.embedFont(StandardFonts.Helvetica);

  const values = {
    companyName: clean(contractor.companyName, contractor.id),
    registrationNumber: clean(contractor.registrationNumber, "N/A"),
    bbbeeStatus: clean(contractor.bbbeeStatus, "N/A"),
    contactPerson: clean(contractor.contactPerson, contractor.companyName),
    date: currentDate,
  };

  const firstPage = pages[0];
  const secondPage = pages[1];

  void firstPage;
  void secondPage;

  overlayField(pages[FIELD_MAP.companyName.page], font, values.companyName, FIELD_MAP.companyName);
  overlayField(
    pages[FIELD_MAP.registrationNumber.page],
    font,
    values.registrationNumber,
    FIELD_MAP.registrationNumber,
  );
  overlayField(pages[FIELD_MAP.bbbeeStatus.page], font, values.bbbeeStatus, FIELD_MAP.bbbeeStatus);
  overlayField(
    pages[FIELD_MAP.contactPerson.page],
    font,
    values.contactPerson,
    FIELD_MAP.contactPerson,
  );
  overlayField(pages[FIELD_MAP.date.page], font, values.date, FIELD_MAP.date);

  return existingPdf.save();
}
